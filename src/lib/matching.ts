/**
 * Phase 3 — Find support matching.
 * Deterministic and structured-only: the worker-approved CaseContext is
 * compared against typed service_attributes rows. No LLM anywhere in this
 * path (docs/product.md: "No LLM-driven matching").
 *
 * Pure functions (evaluateService / matchServices) take plain data so the
 * logic is unit-testable without a DB; the two small query helpers load the
 * inputs server-side. Matching only ever runs against APPROVED contexts —
 * drafts are never used.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { caseContexts, serviceAttributes, services, type CaseContext } from "../db/schema";

/** A single stored service fact (provenance + freshness included). */
export type FactRow = {
  attrType: string;
  key: string;
  value: string;
  sourceType: string;
  sourceName: string | null;
  retrievedAt: Date | string | null;
  verificationStatus: string;
  confirmedBy: string | null;
  confirmedAt: Date | string | null;
  notes: string | null;
};

/** A service plus its stored facts — the only inputs to matching. */
export type ServiceCandidate = {
  id: string;
  name: string;
  organisation: string | null;
  phone: string | null;
  catchment: string | null;
  attributes: FactRow[];
};

export type CriterionStatus =
  | "matched"
  | "stale"
  | "needs_provider_confirmation"
  | "not_recorded"
  | "mismatch";

/** Why a service fits / does not fit one criterion, with evidence. */
export type Criterion = {
  criterion: string;
  status: CriterionStatus;
  value: string | null;
  detail: string;
  fact: FactRow | null;
};

export type MatchResult = {
  service: ServiceCandidate;
  matchedNeeds: string[];
  criteria: Criterion[];
  suitable: boolean;
  /** One-line deterministic reason when not suitable. Null when suitable. */
  reason: string | null;
};

/** Deterministic freshness ordering for ranking (never shown as a "score"). */
const FRESHNESS_RANK: Record<string, number> = {
  provider_confirmed: 3,
  verified_machine: 2,
  stale: 1,
  needs_provider_confirmation: 0,
};

function attr(service: ServiceCandidate, attrType: string, key: string): FactRow | undefined {
  return service.attributes.find((a) => a.attrType === attrType && a.key === key);
}

function factStatus(fact: FactRow): CriterionStatus {
  if (fact.verificationStatus === "stale") return "stale";
  if (fact.verificationStatus === "needs_provider_confirmation") return "needs_provider_confirmation";
  return "matched";
}

/** Evaluate one service against the approved context. Pure. */
export function evaluateService(context: CaseContext, service: ServiceCandidate): MatchResult {
  const criteria: Criterion[] = [];
  const hardExclusions: string[] = [];
  const matchedNeeds: string[] = [];

  // --- needs: attr_type='need', value IN context.needs ---
  for (const need of context.needs) {
    // stored need rows are one-per-need; find the row whose value matches
    const needFact = service.attributes.find(
      (a) => a.attrType === "need" && a.key === "need" && a.value === need,
    );
    if (needFact) {
      matchedNeeds.push(need);
      criteria.push({
        criterion: `need: ${need}`,
        status: factStatus(needFact),
        value: needFact.value,
        detail: `provides ${need}`,
        fact: needFact,
      });
    }
  }
  const offeredNeeds = service.attributes
    .filter((a) => a.attrType === "need" && a.key === "need")
    .map((a) => a.value);

  // --- children (only evaluated if the client has children) ---
  if (context.children && context.children.count > 0) {
    const fact = attr(service, "eligibility", "children");
    if (!fact || fact.value === "unknown") {
      criteria.push({
        criterion: "children",
        status: fact ? "needs_provider_confirmation" : "not_recorded",
        value: fact?.value ?? null,
        detail: fact
          ? "children policy unknown — needs provider confirmation"
          : "children policy unknown — not recorded for this service",
        fact: fact ?? null,
      });
    } else if (["welcome", "allowed", "yes"].includes(fact.value)) {
      criteria.push({
        criterion: "children",
        status: factStatus(fact),
        value: fact.value,
        detail: `children ${fact.value}`,
        fact,
      });
    } else if (["no", "not_accepted", "no_children"].includes(fact.value)) {
      hardExclusions.push(`children not accepted (children: ${fact.value})`);
      criteria.push({
        criterion: "children",
        status: "mismatch",
        value: fact.value,
        detail: `children ${fact.value} — client has ${context.children.count} child(ren)`,
        fact,
      });
    }
  }

  // --- pets (only if the client has a pet) ---
  if (context.pets?.has_pet) {
    const fact = attr(service, "eligibility", "pets");
    if (!fact || fact.value === "unknown") {
      criteria.push({
        criterion: "pets",
        status: fact ? "needs_provider_confirmation" : "not_recorded",
        value: fact?.value ?? null,
        detail: fact
          ? "pet policy unknown — needs provider confirmation"
          : "pet policy unknown — not recorded for this service",
        fact: fact ?? null,
      });
    } else if (["welcome", "allowed", "yes", "negotiable"].includes(fact.value)) {
      criteria.push({ criterion: "pets", status: factStatus(fact), value: fact.value, detail: `pets ${fact.value}`, fact });
    } else if (["no", "not_allowed", "no_pets"].includes(fact.value)) {
      hardExclusions.push(`pets not accepted (pets: ${fact.value})`);
      criteria.push({ criterion: "pets", status: "mismatch", value: fact.value, detail: `pets ${fact.value} — client has a pet`, fact });
    }
  }

  // --- visa (only if the client's visa is stated) ---
  if (context.visa) {
    const fact = attr(service, "eligibility", "visa");
    if (!fact || fact.value === "unknown") {
      criteria.push({
        criterion: "visa",
        status: fact ? "needs_provider_confirmation" : "not_recorded",
        value: fact?.value ?? null,
        detail: fact
          ? "visa restrictions unknown — needs provider confirmation"
          : "visa restrictions unknown — not recorded for this service",
        fact: fact ?? null,
      });
    } else if (fact.value === "no_restrictions") {
      criteria.push({ criterion: "visa", status: factStatus(fact), value: fact.value, detail: "no visa restrictions", fact });
    } else {
      // a recorded restriction (e.g. 'citizens_only') excludes the client
      hardExclusions.push(`visa restricted (visa: ${fact.value}; client visa: ${context.visa})`);
      criteria.push({ criterion: "visa", status: "mismatch", value: fact.value, detail: `visa restriction: ${fact.value} — client on ${context.visa}`, fact });
    }
  }

  // --- languages (flagged, never a hard exclusion on its own) ---
  if (context.languages.length > 0) {
    const fact = service.attributes.find((a) => a.key === "languages");
    if (!fact || fact.value === "unknown") {
      criteria.push({
        criterion: "languages",
        status: fact ? "needs_provider_confirmation" : "not_recorded",
        value: fact?.value ?? null,
        detail: fact
          ? "language support unknown — needs provider confirmation"
          : "language support unknown — not recorded for this service",
        fact: fact ?? null,
      });
    } else if (context.languages.includes(fact.value)) {
      criteria.push({ criterion: "languages", status: factStatus(fact), value: fact.value, detail: `supports ${fact.value}`, fact });
    } else {
      criteria.push({
        criterion: "languages",
        status: "mismatch",
        value: fact.value,
        detail: `recorded language: ${fact.value}; client speaks ${context.languages.join(", ")} — confirm interpretation options`,
        fact,
      });
    }
  }

  // --- income (flagged, never a hard exclusion on its own) ---
  if (context.income?.status) {
    const fact = attr(service, "eligibility", "income");
    if (!fact || fact.value === "unknown") {
      criteria.push({
        criterion: "income",
        status: fact ? "needs_provider_confirmation" : "not_recorded",
        value: fact?.value ?? null,
        detail: fact
          ? "income eligibility unknown — needs provider confirmation"
          : "income eligibility unknown — not recorded for this service",
        fact: fact ?? null,
      });
    } else if (fact.value === context.income.status) {
      criteria.push({
        criterion: "income",
        status: factStatus(fact),
        value: fact.value,
        detail: `income eligibility "${fact.value}" — matches client`,
        fact,
      });
    } else {
      criteria.push({
        criterion: "income",
        status: "mismatch",
        value: fact.value,
        detail: `income eligibility "${fact.value}" — client income "${context.income.status}"`,
        fact,
      });
    }
  }

  // --- wait time (only when urgency is high — freshness matters most then) ---
  if (context.urgency === "high") {
    const fact = attr(service, "wait_time", "wait_time");
    if (!fact || fact.value === "unknown") {
      criteria.push({
        criterion: "wait time",
        status: fact ? "needs_provider_confirmation" : "not_recorded",
        value: fact?.value ?? null,
        detail: fact
          ? "wait time unknown — needs provider confirmation"
          : "wait time unknown — not recorded for this service",
        fact: fact ?? null,
      });
    } else {
      criteria.push({ criterion: "wait time", status: factStatus(fact), value: fact.value, detail: `wait time: ${fact.value}`, fact });
    }
  }

  // --- suitability: hard exclusions beat need matches; no needs = not suitable ---
  if (hardExclusions.length > 0) {
    return { service, matchedNeeds, criteria, suitable: false, reason: hardExclusions[0] };
  }
  if (matchedNeeds.length === 0) {
    return {
      service,
      matchedNeeds,
      criteria,
      suitable: false,
      reason: `does not provide the client's needs (${context.needs.join(", ")}) — offers: ${
        offeredNeeds.join(", ") || "none recorded"
      }`,
    };
  }
  return { service, matchedNeeds, criteria, suitable: true, reason: null };
}

function freshnessScore(result: MatchResult): number {
  return result.criteria.reduce(
    (max, c) => Math.max(max, c.fact ? (FRESHNESS_RANK[c.fact.verificationStatus] ?? 0) : 0),
    0,
  );
}

/**
 * Evaluate + rank all services. Pure. Deterministic order: matched needs,
 * then fact freshness (provider_confirmed > verified_machine > stale),
 * then name. No scores are exposed to the UI.
 */
export function matchServices(context: CaseContext, candidates: ServiceCandidate[]): MatchResult[] {
  return candidates
    .map((c) => evaluateService(context, c))
    .sort(
      (a, b) =>
        b.matchedNeeds.length - a.matchedNeeds.length ||
        freshnessScore(b) - freshnessScore(a) ||
        a.service.name.localeCompare(b.service.name),
    );
}

/** Latest APPROVED context for a case — drafts are never used for matching. */
export async function getLatestApprovedContext(caseId: string) {
  const [row] = await db
    .select()
    .from(caseContexts)
    .where(and(eq(caseContexts.caseId, caseId), eq(caseContexts.status, "approved")))
    .orderBy(desc(caseContexts.version))
    .limit(1);
  return row ?? null;
}

/** All active services with their stored facts, grouped for matching. */
export async function getMatchCandidates(): Promise<ServiceCandidate[]> {
  const serviceRows = await db.select().from(services).where(eq(services.status, "active"));
  const attrRows = await db.select().from(serviceAttributes);
  const byService = new Map<string, FactRow[]>();
  for (const a of attrRows) {
    const list = byService.get(a.serviceId) ?? [];
    list.push(a);
    byService.set(a.serviceId, list);
  }
  return serviceRows.map((s) => ({
    id: s.id,
    name: s.name,
    organisation: s.organisation,
    phone: s.phone,
    catchment: s.catchment,
    attributes: byService.get(s.id) ?? [],
  }));
}
