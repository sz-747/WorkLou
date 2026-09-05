/**
 * Phase 7B (discovery side) — find NEW community services.
 * SERP API (Bright Data) → discovered provider URLs → direct fetch →
 * normalise → deduplicate → review queue.
 *
 * Queueing is ALL this does: rows land in `discovery_candidates` with full
 * provenance (source URL, retrieval timestamp, evidence type) for a human
 * to review. Merging a candidate into the canonical `services` +
 * `service_attributes` is a separate human decision (rest of Phase 7B) —
 * discovery never touches caseworker-facing data.
 *
 * Idempotent: provider pages already in the canonical DB or already queued
 * (any status) are skipped, and the same provider name on the same site is
 * never queued twice (dedup key = normalised name @ site).
 *
 * Review/merge (the human half, also this file): `approveDiscoveryCandidate`
 * creates the canonical service from the candidate's stored evidence —
 * extracted service fields → `services` columns, attribute facts →
 * `service_attributes` rows, each carrying the candidate's provenance
 * (source URL, retrieval time, evidence type) — and logs the decision in the
 * append-only change log. `rejectDiscoveryCandidate` records the decision and
 * leaves canonical data untouched. Only pending candidates can be decided;
 * after a decision the row (and the URL/name it carries) is never re-queued.
 */
import { eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { discoveryCandidates, serviceAttributes, services } from "../db/schema";
import { logServiceChange } from "./admin";
import { serpSearch, type SerpResult } from "./brightdata";
import { fetchSnapshot, type SourceSnapshot } from "./sources";
import type { SourceFact } from "./source-facts";

export const DEFAULT_DISCOVERY_QUERIES = [
  "women's housing accommodation support Sydney",
  "domestic violence support services Sydney",
  "free financial counselling for women Sydney",
  "community legal centre women Sydney",
];

/** Social/profile pages are not provider service pages. */
const JUNK_HOSTS = new Set([
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "youtube.com",
  "reddit.com",
  "tiktok.com",
]);

export type DiscoveryLogEntry = { at: string; message: string };

export type DiscoverySummary = {
  queries: string[];
  resultsFound: number;
  urlsConsidered: number;
  created: number;
  skipped: number;
  failed: number;
  log: DiscoveryLogEntry[];
};

export type DiscoveryDeps = {
  search?: (query: string) => Promise<SerpResult[]>; // default: Bright Data SERP API
  snapshot?: (url: string) => Promise<SourceSnapshot>; // default: direct fetch (fixture for fixture URLs)
};

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const log = (entries: DiscoveryLogEntry[], message: string) =>
  entries.push({ at: new Date().toISOString(), message });

export async function runDiscovery({
  queries = DEFAULT_DISCOVERY_QUERIES,
  limitPerQuery = 5,
  deps,
}: {
  queries?: string[];
  limitPerQuery?: number;
  deps?: DiscoveryDeps;
} = {}): Promise<DiscoverySummary> {
  const search = deps?.search ?? serpSearch;
  const snapshot = deps?.snapshot ?? fetchSnapshot;
  const entries: DiscoveryLogEntry[] = [];

  // 1. SERP API → provider URLs (deduped within the run)
  const found = new Map<string, { result: SerpResult; query: string }>();
  let failed = 0;
  for (const query of queries) {
    try {
      const results = await search(query);
      for (const result of results.slice(0, limitPerQuery)) {
        if (!found.has(result.url)) found.set(result.url, { result, query });
      }
    } catch (err) {
      failed++;
      log(entries, `SEARCH FAILED for "${query}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. what we already know: canonical provider pages + already-queued candidates
  const knownUrls = new Set(
    (await db.select({ url: services.sourceUrl }).from(services).where(isNotNull(services.sourceUrl))).map(
      (r) => r.url as string,
    ),
  );
  const existingCandidates = await db
    .select({ url: discoveryCandidates.sourceUrl, dedupKey: discoveryCandidates.dedupKey, name: discoveryCandidates.name })
    .from(discoveryCandidates);
  const queuedUrls = new Set(existingCandidates.map((c) => c.url as string));
  const knownDedupKeys = new Set<string>(existingCandidates.map((c) => c.dedupKey));
  for (const s of await db
    .select({ name: services.name, url: services.sourceUrl })
    .from(services)
    .where(isNotNull(services.sourceUrl))) {
    knownDedupKeys.add(`${slug(s.name)}@${hostname(s.url as string)}`);
  }

  // 3. fetch each candidate page → normalise → dedupe → queue
  let created = 0;
  let skipped = 0;
  let considered = 0;
  for (const [url, { result, query }] of found) {
    considered++;
    const host = hostname(url);
    if (JUNK_HOSTS.has(host)) {
      skipped++;
      log(entries, `skipped (social/profile page): ${url}`);
      continue;
    }
    if (knownUrls.has(url)) {
      skipped++;
      log(entries, `skipped (already a known service): ${url}`);
      continue;
    }
    if (queuedUrls.has(url)) {
      skipped++;
      log(entries, `skipped (already in the discovery queue): ${url}`);
      continue;
    }
    try {
      const snap = await snapshot(url);
      const nameFact = snap.facts.find(
        (f): f is Extract<SourceFact, { kind: "service_field" }> => f.kind === "service_field" && f.field === "name",
      );
      const name = nameFact?.value?.trim() || result.title;
      const dedupKey = `${slug(name)}@${host}`;
      if (knownDedupKeys.has(dedupKey)) {
        skipped++;
        log(entries, `skipped (duplicate of a known/queued provider — same name on the same site): ${url}`);
        continue;
      }
      await db.insert(discoveryCandidates).values({
        name,
        sourceUrl: url,
        sourceName: `SERP discovery — "${query}" (Bright Data)`,
        dedupKey,
        extractedData: { facts: snap.facts, serp: { title: result.title, snippet: result.snippet, position: result.position } },
        status: "pending_review",
        retrievedAt: snap.retrievedAt,
        evidenceType: snap.evidenceType,
      });
      knownDedupKeys.add(dedupKey);
      queuedUrls.add(url);
      created++;
      log(entries, `queued candidate: "${name}" (${url})`);
    } catch (err) {
      failed++;
      log(entries, `SOURCE FAILED ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { queries, resultsFound: found.size, urlsConsidered: considered, created, skipped, failed, log: entries };
}

/** Extracted service fields that map onto `services` columns on approval. */
const CANDIDATE_SERVICE_FIELDS = ["organisation", "description", "phone", "email", "address", "catchment"] as const;

/**
 * Approve a pending discovery candidate: the extracted evidence becomes a
 * canonical service (service fields → services columns, attribute facts →
 * service_attributes rows with machine provenance + the candidate's
 * retrieval time). Returns the created service; null when the candidate no
 * longer exists or was already decided.
 */
export async function approveDiscoveryCandidate(candidateId: string, decidedBy: string) {
  const [c] = await db.select().from(discoveryCandidates).where(eq(discoveryCandidates.id, candidateId));
  if (!c || c.status !== "pending_review") return null;

  const facts = (((c.extractedData as { facts?: SourceFact[] } | null)?.facts) ?? []) as SourceFact[];
  const serviceField = (field: string) =>
    facts.find(
      (f): f is Extract<SourceFact, { kind: "service_field" }> => f.kind === "service_field" && f.field === field,
    )?.value ?? null;

  const created = await db.transaction(async (tx) => {
    const [service] = await tx
      .insert(services)
      .values({
        name: serviceField("name") ?? c.name,
        ...Object.fromEntries(CANDIDATE_SERVICE_FIELDS.map((f) => [f, serviceField(f)])),
        status: "active",
        sourceType: "discovery_review",
        sourceName: c.sourceName,
        sourceUrl: c.sourceUrl,
      })
      .returning();

    const attributeFacts = facts.filter(
      (f): f is Extract<SourceFact, { kind: "attribute" }> => f.kind === "attribute",
    );
    if (attributeFacts.length > 0) {
      await tx.insert(serviceAttributes).values(
        attributeFacts.map((f) => ({
          serviceId: service.id,
          attrType: f.attrType,
          key: f.key,
          value: f.value,
          sourceType: "machine",
          sourceName: c.sourceName,
          sourceUrl: c.sourceUrl,
          retrievedAt: c.retrievedAt,
          verificationStatus: "verified_machine",
        })),
      );
    }

    await tx
      .update(discoveryCandidates)
      .set({ status: "merged", decidedBy, decidedAt: new Date() })
      .where(eq(discoveryCandidates.id, c.id));
    return service;
  });

  await logServiceChange({
    serviceId: created.id,
    attributeId: null,
    entity: "service",
    field: "created",
    oldValue: null,
    newValue: created.name,
    changedBy: `Discovery approved by ${decidedBy}`,
    note: `candidate: ${c.name} — source: ${c.sourceUrl ?? c.sourceName ?? "—"} (${c.evidenceType ?? "unknown"} evidence), retrieved ${c.retrievedAt ? new Date(c.retrievedAt).toLocaleDateString("en-AU") : "—"}`,
  });

  return created;
}

/**
 * Reject a pending discovery candidate: the decision is recorded on the row
 * and canonical data is untouched. Returns the updated candidate; null when
 * it no longer exists or was already decided.
 */
export async function rejectDiscoveryCandidate(candidateId: string, decidedBy: string) {
  const [c] = await db.select().from(discoveryCandidates).where(eq(discoveryCandidates.id, candidateId));
  if (!c || c.status !== "pending_review") return null;
  const [updated] = await db
    .update(discoveryCandidates)
    .set({ status: "rejected", decidedBy, decidedAt: new Date() })
    .where(eq(discoveryCandidates.id, c.id))
    .returning();
  return updated;
}
