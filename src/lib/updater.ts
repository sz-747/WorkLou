/**
 * Phase 7A — existing-service updater.
 * Scheduled or manual run: fetch current machine-accessible source data
 * (fixture / direct fetch / Bright Data — see sources.ts), compare with
 * stored canonical facts, and create structured update candidates with
 * full provenance (source URL, evidence type, retrieval time).
 *
 * Per build_plan Phase 7 ("nothing auto-applied without review"):
 *  - unchanged values only refresh freshness (retrieved_at, source, and
 *    stale → verified_machine); provider-confirmed / legacy
 *    admin-corrected
 *    facts keep their human status;
 *  - every value change (and every new fact) becomes a pending update
 *    candidate for human review — nothing touches canonical data until
 *    a reviewer approves it (applyUpdateCandidate), which also writes the
 *    append-only change log. Rejections and failed sources never touch
 *    canonical data. Missing facts are never invented — a candidate only
 *    exists because the source reported it.
 *
 * Runs are idempotent: a pending candidate for the same service+scope+key
 * is updated in place with the latest evidence (or skipped when the
 * proposed value is unchanged) — repeated runs never duplicate rows.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { serviceAttributes, services, updateCandidates, updaterRuns } from "../db/schema";
import { logServiceChange } from "./service-history";
import { fetchSnapshot, type SourceSnapshot } from "./sources";

export type RunTrigger = "manual" | "scheduled";

export type RunSummary = {
  runId: string;
  trigger: RunTrigger;
  status: string;
  servicesChecked: number;
  sourcesOk: number;
  sourcesFailed: number;
  candidatesCreated: number;
  candidatesUpdated: number;
  candidatesSkipped: number;
  refreshed: number;
  log: { at: string; message: string }[];
};

/** Field names on `services` a source may report. */
const SERVICE_FIELDS = [
  "name",
  "organisation",
  "description",
  "website",
  "phone",
  "email",
  "address",
  "catchment",
] as const;
type EditableServiceField = (typeof SERVICE_FIELDS)[number];

type LogEntry = { at: string; message: string };

/** True when the fact's human confirmation must be preserved on refresh. */
function isHumanConfirmed(status: string): boolean {
  return status === "provider_confirmed" || status === "admin_corrected";
}

/** Compare one snapshot against canonical data. Pure — returns the work to do. */
export type PlannedAction =
  | { kind: "refresh"; attrId: string; current: typeof serviceAttributes.$inferSelect }
  | {
      kind: "candidate";
      scope: "service_field" | "attribute";
      attributeId: string | null;
      attrType: string | null;
      key: string;
      currentValue: string | null;
      newValue: string;
      reason: string;
    }
  | { kind: "skip"; message: string };

export function planForFact(
  fact: SourceSnapshot["facts"][number],
  service: typeof services.$inferSelect,
  storedFacts: (typeof serviceAttributes.$inferSelect)[],
): PlannedAction {
  if (fact.kind === "service_field") {
    if (!SERVICE_FIELDS.includes(fact.field as EditableServiceField)) {
      return { kind: "skip", message: `unknown service field "${fact.field}" ignored` };
    }
    const current = service[fact.field as EditableServiceField];
    const currentStr = current === null || current === undefined ? null : String(current);
    if (currentStr === fact.value) return { kind: "skip", message: `service field ${fact.field} unchanged` };
    return {
      kind: "candidate",
      scope: "service_field",
      attributeId: null,
      attrType: null,
      key: fact.field,
      currentValue: currentStr,
      newValue: fact.value,
      reason: "contact/details changed on the source page",
    };
  }
  // multi-value aware: a key like `need` can have several stored rows.
  // Same value → refresh that row; unknown value on a single-row key →
  // value change; unknown value on a multi-row key → additional value.
  const storedSameKey = storedFacts.filter((a) => a.attrType === fact.attrType && a.key === fact.key);
  const matching = storedSameKey.find((a) => a.value === fact.value);
  if (matching) return { kind: "refresh", attrId: matching.id, current: matching };
  if (storedSameKey.length === 0) {
    return {
      kind: "candidate",
      scope: "attribute",
      attributeId: null,
      attrType: fact.attrType,
      key: fact.key,
      currentValue: null,
      newValue: fact.value,
      reason: "new fact reported by the source — not previously recorded",
    };
  }
  if (storedSameKey.length > 1) {
    return {
      kind: "candidate",
      scope: "attribute",
      attributeId: null,
      attrType: fact.attrType,
      key: fact.key,
      currentValue: null,
      newValue: fact.value,
      reason: "additional value reported by the source page (stored values unchanged)",
    };
  }
  const stored = storedSameKey[0];
  return {
    kind: "candidate",
    scope: "attribute",
    attributeId: stored.id,
    attrType: fact.attrType,
    key: fact.key,
    currentValue: stored.value,
    newValue: fact.value,
    reason: isHumanConfirmed(stored.verificationStatus)
      ? `value changed on the source page; stored value was human-confirmed (${stored.verificationStatus}) — human review required`
      : "value changed on the source page",
  };
}

async function upsertCandidate(
  runId: string,
  serviceId: string,
  snapshot: SourceSnapshot,
  action: Extract<PlannedAction, { kind: "candidate" }>,
  log: LogEntry[],
): Promise<"created" | "updated" | "skipped"> {
  const sameTarget = and(
    eq(updateCandidates.serviceId, serviceId),
    eq(updateCandidates.scope, action.scope),
    eq(updateCandidates.key, action.key),
    action.scope === "attribute" && action.attrType
      ? eq(updateCandidates.attrType, action.attrType)
      : undefined,
  );

  // additions/new facts (currentValue null, e.g. multi-value needs) dedupe
  // per proposed value — several can be pending at once without clobbering
  const [sameValue] = await db
    .select()
    .from(updateCandidates)
    .where(and(sameTarget, eq(updateCandidates.newValue, action.newValue)))
    .orderBy(desc(updateCandidates.updatedAt))
    .limit(1);
  if (sameValue) {
    if (sameValue.status === "pending_review") {
      log.push({ at: new Date().toISOString(), message: `candidate dedup: ${action.key} "${action.newValue}" already pending` });
      return "skipped";
    }
    if (sameValue.status === "rejected" && sameValue.sourceUrl === snapshot.sourceUrl) {
      log.push({
        at: new Date().toISOString(),
        message: `candidate dedup: ${action.key} "${action.newValue}" was rejected on this source — not re-proposed`,
      });
      return "skipped";
    }
  }

  // value changes (currentValue set) replace the pending candidate for the
  // same stored value in place — newest evidence wins
  if (action.currentValue !== null) {
    const [latestChange] = await db
      .select()
      .from(updateCandidates)
      .where(and(sameTarget, eq(updateCandidates.currentValue, action.currentValue)))
      .orderBy(desc(updateCandidates.updatedAt))
      .limit(1);
    if (latestChange?.status === "pending_review") {
      await db
        .update(updateCandidates)
        .set({
          runId,
          newValue: action.newValue,
          sourceName: snapshot.sourceName,
          sourceUrl: snapshot.sourceUrl,
          evidenceType: snapshot.evidenceType,
          retrievedAt: snapshot.retrievedAt,
          reason: action.reason,
          updatedAt: new Date(),
        })
        .where(eq(updateCandidates.id, latestChange.id));
      log.push({ at: new Date().toISOString(), message: `candidate updated: ${action.key} now proposes "${action.newValue}" (latest evidence)` });
      return "updated";
    }
  }

  await db.insert(updateCandidates).values({
    runId,
    serviceId,
    attributeId: action.attributeId,
    scope: action.scope,
    attrType: action.attrType,
    key: action.key,
    currentValue: action.currentValue,
    newValue: action.newValue,
    sourceType: "machine",
    sourceName: snapshot.sourceName,
    sourceUrl: snapshot.sourceUrl,
    evidenceType: snapshot.evidenceType,
    retrievedAt: snapshot.retrievedAt,
    status: "pending_review",
    reason: action.reason,
  });
  log.push({
    at: new Date().toISOString(),
    message: `candidate created: ${action.scope === "service_field" ? "service field" : action.attrType} ${action.key}: "${action.currentValue ?? "—"}" → "${action.newValue}" (${action.reason})`,
  });
  return "created";
}

/**
 * Run the updater over all active services. Never throws half-way: failures
 * are recorded and the run continues. `only` scopes the run to specific
 * service ids (used by the test suite to stay hermetic).
 */
export async function runUpdater({ trigger, only }: { trigger: RunTrigger; only?: string[] }): Promise<RunSummary> {
  const [run] = await db
    .insert(updaterRuns)
    .values({ trigger, status: "running", log: [] })
    .returning();
  const log: LogEntry[] = [];
  let sourcesOk = 0;
  let sourcesFailed = 0;
  let candidatesCreated = 0;
  let candidatesUpdated = 0;
  let candidatesSkipped = 0;
  let refreshed = 0;
  let servicesChecked = 0;

  try {
    const active = (await db.select().from(services).where(eq(services.status, "active"))).filter(
      (s) => !only || only.includes(s.id),
    );

    for (const service of active) {
      servicesChecked++;
      if (!service.sourceUrl) {
        log.push({ at: new Date().toISOString(), message: `${service.name}: skipped — no machine source configured (provider/excel-only service)` });
        continue;
      }
      let snapshot: SourceSnapshot;
      try {
        snapshot = await fetchSnapshot(service.sourceUrl);
      } catch (err) {
        sourcesFailed++;
        log.push({
          at: new Date().toISOString(),
          message: `${service.name}: SOURCE FAILED — ${err instanceof Error ? err.message : String(err)} (canonical data untouched)`,
        });
        continue;
      }
      sourcesOk++;
      log.push({ at: new Date().toISOString(), message: `${service.name}: fetched source ok (${snapshot.evidenceType})` });

      const storedFacts = await db
        .select()
        .from(serviceAttributes)
        .where(eq(serviceAttributes.serviceId, service.id));

      for (const fact of snapshot.facts) {
        const action = planForFact(fact, service, storedFacts);
        if (action.kind === "skip") continue;
        if (action.kind === "refresh") {
          // freshness refresh only — the value did not change
          const keepStatus = isHumanConfirmed(action.current.verificationStatus);
          await db
            .update(serviceAttributes)
            .set({
              retrievedAt: snapshot.retrievedAt,
              sourceName: snapshot.sourceName,
              sourceUrl: snapshot.sourceUrl,
              sourceType: keepStatus ? action.current.sourceType : "machine",
              verificationStatus: keepStatus
                ? action.current.verificationStatus
                : action.current.verificationStatus === "stale"
                  ? "verified_machine"
                  : action.current.verificationStatus === "needs_provider_confirmation"
                    ? "needs_provider_confirmation"
                    : action.current.verificationStatus,
            })
            .where(eq(serviceAttributes.id, action.attrId));
          refreshed++;
          continue;
        }
        const result = await upsertCandidate(run.id, service.id, snapshot, action, log);
        if (result === "created") candidatesCreated++;
        else if (result === "updated") candidatesUpdated++;
        else candidatesSkipped++;
      }
    }

    const status = "completed";
    const [done] = await db
      .update(updaterRuns)
      .set({
        status,
        finishedAt: new Date(),
        servicesChecked,
        sourcesOk,
        sourcesFailed,
        candidatesCreated,
        candidatesUpdated,
        candidatesSkipped,
        refreshed,
        log,
      })
      .where(eq(updaterRuns.id, run.id))
      .returning();
    return {
      runId: run.id,
      trigger,
      status: done.status,
      servicesChecked,
      sourcesOk,
      sourcesFailed,
      candidatesCreated,
      candidatesUpdated,
      candidatesSkipped,
      refreshed,
      log,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(updaterRuns)
      .set({ status: "failed", finishedAt: new Date(), error: message, log, servicesChecked, sourcesOk, sourcesFailed, candidatesCreated, candidatesUpdated, candidatesSkipped, refreshed })
      .where(eq(updaterRuns.id, run.id));
    return {
      runId: run.id,
      trigger,
      status: "failed",
      servicesChecked,
      sourcesOk,
      sourcesFailed,
      candidatesCreated,
      candidatesUpdated,
      candidatesSkipped,
      refreshed,
      log,
    };
  }
}

/** Pending and decided review candidates, newest first. */
export async function getUpdateCandidates() {
  const pending = await db
    .select({ candidate: updateCandidates, serviceName: services.name })
    .from(updateCandidates)
    .innerJoin(services, eq(services.id, updateCandidates.serviceId))
    .where(eq(updateCandidates.status, "pending_review"))
    .orderBy(desc(updateCandidates.createdAt));
  const decided = await db
    .select({ candidate: updateCandidates, serviceName: services.name })
    .from(updateCandidates)
    .innerJoin(services, eq(services.id, updateCandidates.serviceId))
    .where(eq(updateCandidates.status, "applied"))
    .orderBy(desc(updateCandidates.decidedAt))
    .limit(20);
  const rejected = await db
    .select({ candidate: updateCandidates, serviceName: services.name })
    .from(updateCandidates)
    .innerJoin(services, eq(services.id, updateCandidates.serviceId))
    .where(eq(updateCandidates.status, "rejected"))
    .orderBy(desc(updateCandidates.decidedAt))
    .limit(20);
  return { pending, applied: decided, rejected };
}

export async function getUpdaterRuns(limit = 10) {
  return db.select().from(updaterRuns).orderBy(desc(updaterRuns.startedAt)).limit(limit);
}

/**
 * A reviewer approves a candidate: apply to canonical data in place (with the
 * candidate's machine provenance + freshness), write the append-only
 * change log, mark the candidate applied. Returns null for non-pending or
 * unknown candidates.
 */
export async function applyUpdateCandidate(candidateId: string, decidedBy: string) {
  const [c] = await db.select().from(updateCandidates).where(eq(updateCandidates.id, candidateId));
  if (!c || c.status !== "pending_review") return null;

  if (c.scope === "service_field") {
    const [service] = await db.select().from(services).where(eq(services.id, c.serviceId));
    const oldValue = service ? String(service[c.key as keyof typeof service] ?? "") : null;
    await db
      .update(services)
      .set({ [c.key]: c.newValue, updatedAt: new Date() })
      .where(eq(services.id, c.serviceId));
    await logServiceChange({
      serviceId: c.serviceId,
      attributeId: null,
      entity: "service",
      field: c.key,
      oldValue,
      newValue: c.newValue,
      changedBy: `Updater approved by ${decidedBy}`,
      note: `source: ${c.sourceName ?? c.sourceUrl} (${c.evidenceType}), retrieved ${c.retrievedAt ? new Date(c.retrievedAt).toLocaleDateString("en-AU") : "—"}`,
    });
  } else {
    if (c.attributeId) {
      const [fact] = await db
        .select()
        .from(serviceAttributes)
        .where(eq(serviceAttributes.id, c.attributeId));
      await db
        .update(serviceAttributes)
        .set({
          value: c.newValue,
          sourceType: "machine",
          sourceName: c.sourceName,
          sourceUrl: c.sourceUrl,
          retrievedAt: c.retrievedAt,
          verificationStatus: "verified_machine",
          confirmedBy: null,
          confirmedAt: null,
        })
        .where(eq(serviceAttributes.id, c.attributeId));
      await logServiceChange({
        serviceId: c.serviceId,
        attributeId: c.attributeId,
        entity: "attribute",
        field: "value",
        oldValue: fact?.value ?? null,
        newValue: c.newValue,
        changedBy: `Updater approved by ${decidedBy}`,
        note: `source: ${c.sourceName ?? c.sourceUrl} (${c.evidenceType}), retrieved ${c.retrievedAt ? new Date(c.retrievedAt).toLocaleDateString("en-AU") : "—"}; replaced ${fact?.verificationStatus ?? "unknown"} fact`,
      });
    } else {
      // new fact reported by the source — insert with machine provenance
      const [inserted] = await db
        .insert(serviceAttributes)
        .values({
          serviceId: c.serviceId,
          attrType: c.attrType ?? "eligibility",
          key: c.key,
          value: c.newValue,
          sourceType: "machine",
          sourceName: c.sourceName,
          sourceUrl: c.sourceUrl,
          retrievedAt: c.retrievedAt,
          verificationStatus: "verified_machine",
        })
        .returning();
      await logServiceChange({
        serviceId: c.serviceId,
        attributeId: inserted.id,
        entity: "attribute",
        field: `new fact ${c.attrType}/${c.key}`,
        oldValue: null,
        newValue: c.newValue,
        changedBy: `Updater approved by ${decidedBy}`,
        note: `source: ${c.sourceName ?? c.sourceUrl} (${c.evidenceType})`,
      });
    }
  }

  const [updated] = await db
    .update(updateCandidates)
    .set({ status: "applied", decidedBy, decidedAt: new Date(), updatedAt: new Date() })
    .where(eq(updateCandidates.id, candidateId))
    .returning();
  return updated;
}

/** A reviewer rejects a candidate: canonical data untouched, rejection recorded with who/when. */
export async function rejectUpdateCandidate(candidateId: string, decidedBy: string, reason: string | null) {
  const [c] = await db.select().from(updateCandidates).where(eq(updateCandidates.id, candidateId));
  if (!c || c.status !== "pending_review") return null;
  const [updated] = await db
    .update(updateCandidates)
    .set({ status: "rejected", decidedBy, decidedAt: new Date(), reason: reason ?? c.reason, updatedAt: new Date() })
    .where(eq(updateCandidates.id, candidateId))
    .returning();
  return updated;
}
