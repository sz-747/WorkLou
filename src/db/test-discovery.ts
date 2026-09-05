/**
 * Phase 7B (discovery side) tests — SERP → provider URLs → snapshot →
 * normalise → dedupe → review queue. Search and page fetching are injected
 * stubs (no network): this verifies the pipeline, the provenance stored on
 * queue rows, idempotency, and that discovery NEVER touches canonical
 * services/service_attributes. Creates + cleans up its own rows.
 * Run: npm run db:test:discovery
 */
import { sql } from "drizzle-orm";
import { db } from "./index";
import { discoveryCandidates, serviceAttributes, serviceChangeLog, services } from "./schema";
import {
  approveDiscoveryCandidate,
  rejectDiscoveryCandidate,
  runDiscovery,
} from "../lib/discovery";
import type { SerpResult } from "../lib/brightdata";
import type { SourceSnapshot } from "../lib/sources";

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

async function main() {
  console.log("Phase 7B — Discovery pipeline tests");

  const knownServiceUrl = "https://brightpath.example.org/eligibility"; // seeded canonical service
  const newUrl = "https://newprovider.example.org/services";
  const dupUrl = "https://newprovider.example.org/contact"; // same provider, different page
  const socialUrl = "https://facebook.com/newprovider";
  const failUrl = "https://broken.example.org/";

  const searchResults: SerpResult[] = [
    { position: 1, title: "New Provider Community Service", url: newUrl, snippet: "Support for women" },
    { position: 2, title: "Bright Path Financial Counselling", url: knownServiceUrl, snippet: "already known" },
    { position: 3, title: "Social profile", url: socialUrl, snippet: "junk" },
    { position: 4, title: "Broken page", url: failUrl, snippet: "unreachable" },
    { position: 5, title: "New Provider contact page", url: dupUrl, snippet: "duplicate provider" },
  ];

  const stubSnapshot = (url: string): SourceSnapshot => ({
    sourceName: `stub page for ${url}`,
    sourceUrl: url,
    evidenceType: "direct_fetch",
    retrievedAt: new Date("2026-09-05T10:00:00Z"),
    facts: [
      { kind: "service_field", field: "name", value: "New Provider Community Service" },
      { kind: "service_field", field: "phone", value: "(02) 9000 7777" },
      { kind: "attribute", attrType: "need", key: "need", value: "housing_accommodation" },
    ],
  });

  const deps = {
    search: async () => searchResults,
    snapshot: async (url: string) => {
      if (url === failUrl) throw new Error("unreachable page");
      return stubSnapshot(url);
    },
  };

  const svcCountBefore = await db.select({ c: sql<number>`count(*)::int` }).from(services);
  const attrCountBefore = await db.select({ c: sql<number>`count(*)::int` }).from(serviceAttributes);

  // ---------- run 1: queueing + dedupe ----------
  console.log("[RUN 1] provider URLs → normalised, deduplicated review-queue rows");

  const run1 = await runDiscovery({ queries: ["test query"], deps });
  const mine = await db.select().from(discoveryCandidates).where(sql`${discoveryCandidates.sourceUrl} like 'https://%.example.org/%'`);

  assert(
    "summary: 5 results considered, 1 created, 3 skipped (known/social/duplicate), 1 failed, 0 search failures",
    run1.resultsFound === 5 &&
      run1.created === 1 &&
      run1.skipped === 3 &&
      run1.failed === 1 &&
      run1.log.some((e) => e.message.includes("already a known service")) &&
      run1.log.some((e) => e.message.includes("social/profile page")) &&
      run1.log.some((e) => e.message.includes("SOURCE FAILED")),
  );

  const queued = mine.filter((c) => c.sourceUrl === newUrl);
  assert(
    "exactly one queue row created for the new provider",
    queued.length === 1 &&
      queued[0].name === "New Provider Community Service" &&
      queued[0].status === "pending_review",
  );
  assert(
    "queue row preserves provenance: source URL, SERP source name, retrieval timestamp, evidence type",
    queued[0].sourceUrl === newUrl &&
      queued[0].sourceName?.includes("SERP discovery") === true &&
      new Date(queued[0].retrievedAt ?? 0).toISOString() === "2026-09-05T10:00:00.000Z" &&
      queued[0].evidenceType === "direct_fetch",
  );
  const extracted = queued[0].extractedData as { facts?: unknown[]; serp?: { snippet?: string } };
  assert(
    "extracted data carries the normalised facts + SERP context",
    Array.isArray(extracted.facts) && extracted.facts.length === 3 && extracted.serp?.snippet === "Support for women",
  );
  assert(
    "dedup key = normalised name @ site",
    queued[0].dedupKey === "new-provider-community-service@newprovider.example.org",
  );
  assert(
    "duplicate provider page (same name, same site) deduplicated, not queued",
    mine.every((c) => c.sourceUrl !== dupUrl),
  );

  const svcCountAfter = await db.select({ c: sql<number>`count(*)::int` }).from(services);
  const attrCountAfter = await db.select({ c: sql<number>`count(*)::int` }).from(serviceAttributes);
  assert(
    "canonical services/service_attributes completely untouched",
    svcCountAfter[0].c === svcCountBefore[0].c && attrCountAfter[0].c === attrCountBefore[0].c,
  );

  // ---------- run 2: idempotency ----------
  console.log("[RUN 2] repeated discovery is idempotent");

  const run2 = await runDiscovery({ queries: ["test query"], deps });
  const stillQueued = await db.select().from(discoveryCandidates).where(sql`${discoveryCandidates.sourceUrl} like 'https://%.example.org/%'`);
  assert(
    "second run queues nothing new; same single candidate row",
    run2.created === 0 && stillQueued.filter((c) => c.sourceUrl === newUrl).length === 1,
  );

  // ---------- search failure never corrupts ----------
  console.log("[FAILURE] search failure is recorded, run completes");

  const failRun = await runDiscovery({
    queries: ["q1", "q2"],
    deps: { search: async () => { throw new Error("SERP API not configured"); }, snapshot: async (u) => stubSnapshot(u) },
  });
  assert(
    "failed searches logged + counted; no rows created",
    failRun.created === 0 && failRun.failed === 2 && failRun.log.every((e) => e.message.includes("SEARCH FAILED")),
  );

  // ---------- review/merge: approve → canonical; reject → untouched ----------
  console.log("[REVIEW] approve merges into canonical; reject leaves canonical untouched");

  const [cand] = stillQueued.filter((c) => c.sourceUrl === newUrl);
  const approved = await approveDiscoveryCandidate(cand.id, "Lou (admin)");
  assert(
    "approval creates the canonical service with extracted fields + discovery provenance",
    approved?.name === "New Provider Community Service" &&
      approved?.phone === "(02) 9000 7777" &&
      approved?.status === "active" &&
      approved?.sourceType === "discovery_review" &&
      approved?.sourceUrl === newUrl &&
      approved?.sourceName?.includes("SERP discovery") === true,
  );
  const newAttrs = await db
    .select()
    .from(serviceAttributes)
    .where(sql`${serviceAttributes.serviceId} = ${approved!.id}`);
  assert(
    "attribute facts inserted with machine provenance + the candidate's retrieval time",
    newAttrs.length === 1 &&
      newAttrs[0].attrType === "need" &&
      newAttrs[0].value === "housing_accommodation" &&
      newAttrs[0].sourceType === "machine" &&
      newAttrs[0].verificationStatus === "verified_machine" &&
      newAttrs[0].sourceUrl === newUrl &&
      new Date(newAttrs[0].retrievedAt as Date).toISOString() === "2026-09-05T10:00:00.000Z",
  );
  const [mergedCand] = await db.select().from(discoveryCandidates).where(sql`${discoveryCandidates.id} = ${cand.id}`);
  assert(
    "candidate marked merged with who/when",
    mergedCand.status === "merged" && mergedCand.decidedBy === "Lou (admin)" && mergedCand.decidedAt !== null,
  );
  assert(
    "deciding an already-decided candidate is rejected safely",
    (await approveDiscoveryCandidate(cand.id, "X")) === null && (await rejectDiscoveryCandidate(cand.id, "X")) === null,
  );
  const history = await db.select().from(serviceChangeLog).where(sql`${serviceChangeLog.serviceId} = ${approved!.id}`);
  assert(
    "append-only change log records the discovery approval",
    history.length === 1 && history[0].field === "created" && history[0].changedBy.includes("Lou (admin)"),
  );

  const rejectUrl = "https://rejectme.example.org/";
  await runDiscovery({
    queries: ["q"],
    deps: {
      search: async () => [{ position: 1, title: "Reject Me Service", url: rejectUrl, snippet: "nope" }],
      snapshot: async () => ({
        sourceName: `stub page for ${rejectUrl}`,
        sourceUrl: rejectUrl,
        evidenceType: "direct_fetch",
        retrievedAt: new Date("2026-09-05T10:00:00Z"),
        facts: [{ kind: "service_field", field: "name", value: "Reject Me Service" }],
      }),
    },
  });
  const [rejectCand] = await db.select().from(discoveryCandidates).where(sql`${discoveryCandidates.sourceUrl} = ${rejectUrl}`);
  const svcPre = (await db.select({ c: sql<number>`count(*)::int` }).from(services))[0].c;
  const attrPre = (await db.select({ c: sql<number>`count(*)::int` }).from(serviceAttributes))[0].c;
  const rejected = await rejectDiscoveryCandidate(rejectCand.id, "Lou (admin)");
  const svcPost = (await db.select({ c: sql<number>`count(*)::int` }).from(services))[0].c;
  const attrPost = (await db.select({ c: sql<number>`count(*)::int` }).from(serviceAttributes))[0].c;
  assert(
    "rejection records the decision, canonical data untouched",
    rejected?.status === "rejected" && rejected?.decidedBy === "Lou (admin)" && svcPost === svcPre && attrPost === attrPre,
  );

  // ---------- idempotency with decided candidates ----------
  console.log("[RUN 3] repeated runs do not duplicate reviewed or pending candidates");
  const run3 = await runDiscovery({ queries: ["test query"], deps });
  assert(
    "run 3 queues nothing: merged URL is now a known service, reviewed candidate stays decided once",
    run3.created === 0,
  );

  // ---------- CLEANUP ----------
  console.log("[CLEANUP] removing test rows");
  await db.delete(services).where(sql`${services.id} = ${approved!.id}`); // cascades attributes + change log
  await db.delete(discoveryCandidates).where(sql`${discoveryCandidates.sourceUrl} like 'https://%.example.org/%'`);
  const left = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(discoveryCandidates)
    .where(sql`${discoveryCandidates.sourceUrl} like 'https://%.example.org/%'`);
  assert("test rows cleaned up", (left[0]?.c ?? 0) === 0);

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
