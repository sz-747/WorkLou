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
  id?: string;
  attrType: string;
  key: string;
  value: string;
  sourceType: string;
  sourceName: string | null;
  retrievedAt: Date | string | null;
  expiresAt?: Date | string | null;
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
  admin_corrected: 3,
  verified_machine: 2,
  stale: 1,
  needs_provider_confirmation: 0,
};

function attr(service: ServiceCandidate, attrType: string, key: string): FactRow | undefined {
  return service.attributes.find((a) => a.attrType === attrType && a.key === key);
}

function factStatus(fact: FactRow, now: Date = new Date()): CriterionStatus {
  if (
    fact.verificationStatus === "stale" ||
    (fact.expiresAt && new Date(fact.expiresAt).getTime() <= now.getTime())
  ) return "stale";
  if (fact.verificationStatus === "needs_provider_confirmation") return "needs_provider_confirmation";
  return "matched";
}

function locationKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function geographyMatches(context: CaseContext, service: ServiceCandidate): boolean {
  if (!service.catchment) return false;
  const wanted = [context.suburb, context.catchment].filter((value): value is string => !!value);
  const offered = service.catchment.split(/[;,|]/).map(locationKey).filter(Boolean);
  return wanted.map(locationKey).some((value) => offered.includes(value));
}

/** Evaluate one service against the approved context. Pure. */
export function evaluateService(context: CaseContext, service: ServiceCandidate, now: Date = new Date()): MatchResult {
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
        status: factStatus(needFact, now),
        value: needFact.value,
        detail: `provides ${need}`,
        fact: needFact,
      });
    }
  }
  const offeredNeeds = service.attributes
    .filter((a) => a.attrType === "need" && a.key === "need")
    .map((a) => a.value);

  // Geography is a ranking preference, not a hard exclusion: catchment data
  // may be incomplete, but an exact recorded match should win a tie.
  if (context.suburb || context.catchment) {
    const matches = geographyMatches(context, service);
    criteria.push({
      criterion: "geography",
      status: matches ? "matched" : service.catchment ? "mismatch" : "not_recorded",
      value: service.catchment,
      detail: matches
        ? `recorded catchment matches ${context.suburb ?? context.catchment}`
        : service.catchment
          ? `recorded catchment: ${service.catchment}`
          : "catchment not recorded",
      fact: null,
    });
  }

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
        status: factStatus(fact, now),
        value: fact.value,
        detail: `children ${fact.value}`,
        fact,
      });
    } else if (["no", "not_accepted", "not_allowed", "no_children"].includes(fact.value)) {
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
      criteria.push({ criterion: "pets", status: factStatus(fact, now), value: fact.value, detail: `pets ${fact.value}`, fact });
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
      criteria.push({ criterion: "visa", status: factStatus(fact, now), value: fact.value, detail: "no visa restrictions", fact });
    } else if (["citizens_only", "permanent_residents_only", "no_temporary_visa"].includes(fact.value)) {
      hardExclusions.push(`visa restricted (visa: ${fact.value}; client visa: ${context.visa})`);
      criteria.push({ criterion: "visa", status: "mismatch", value: fact.value, detail: `visa restriction: ${fact.value} — client on ${context.visa}`, fact });
    } else {
      criteria.push({
        criterion: "visa",
        status: "needs_provider_confirmation",
        value: fact.value,
        detail: `visa policy is conditional (${fact.value}) — confirm for ${context.visa}`,
        fact,
      });
    }
  }

  // --- languages (flagged, never a hard exclusion on its own) ---
  if (context.languages.length > 0) {
    const languageFacts = service.attributes.filter((a) => a.key === "languages");
    const fact = languageFacts.find((item) => context.languages.includes(item.value));
    const unknown = languageFacts.find((item) => item.value === "unknown");
    if (fact) {
      criteria.push({ criterion: "languages", status: factStatus(fact, now), value: fact.value, detail: `supports ${fact.value}`, fact });
    } else if (languageFacts.length === 0 || unknown) {
      criteria.push({
        criterion: "languages",
        status: unknown ? "needs_provider_confirmation" : "not_recorded",
        value: unknown?.value ?? null,
        detail: unknown
          ? "language support unknown — needs provider confirmation"
          : "language support unknown — not recorded for this service",
        fact: unknown ?? null,
      });
    } else {
      criteria.push({
        criterion: "languages",
        status: "mismatch",
        value: languageFacts.map((item) => item.value).join(", "),
        detail: `recorded languages: ${languageFacts.map((item) => item.value).join(", ")}; client speaks ${context.languages.join(", ")} — confirm interpretation options`,
        fact: languageFacts[0],
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
    } else if (fact.value === "nil_income_considered") {
      criteria.push({
        criterion: "income",
        status: "needs_provider_confirmation",
        value: fact.value,
        detail: `nil income is considered — confirm eligibility for this case`,
        fact,
      });
    } else if (fact.value === context.income.status) {
      criteria.push({
        criterion: "income",
        status: factStatus(fact, now),
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
      criteria.push({ criterion: "wait time", status: factStatus(fact, now), value: fact.value, detail: `wait time: ${fact.value}`, fact });
    }
  }

  // Capacity is volatile. A current "full" report excludes; an expired
  // report is only a prompt to re-check and never decides suitability.
  if (context.needs.includes("housing_accommodation")) {
    const delivery = attr(service, "delivery", "format");
    if (delivery) {
      criteria.push({
        criterion: "delivery",
        status: factStatus(delivery, now),
        value: delivery.value,
        detail: `delivery format: ${delivery.value}`,
        fact: delivery,
      });
    }
    const fact = attr(service, "delivery", "capacity");
    if (fact) {
      const status = factStatus(fact, now);
      if (status === "stale") {
        criteria.push({
          criterion: "capacity",
          status,
          value: fact.value,
          detail: `capacity report expired — refresh or confirm with provider`,
          fact,
        });
      } else if (fact.value === "full") {
        hardExclusions.push("currently reported full");
        criteria.push({ criterion: "capacity", status: "mismatch", value: fact.value, detail: "currently reported full", fact });
      } else if (fact.value === "reported_available") {
        criteria.push({ criterion: "capacity", status, value: fact.value, detail: "capacity reported available", fact });
      } else {
        criteria.push({ criterion: "capacity", status: "needs_provider_confirmation", value: fact.value, detail: "current capacity unknown", fact });
      }
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

function geographyScore(result: MatchResult): number {
  return result.criteria.some(
    (criterion) => criterion.criterion === "geography" && criterion.status === "matched",
  )
    ? 1
    : 0;
}

function deliveryScore(result: MatchResult): number {
  const value = result.criteria.find((criterion) => criterion.criterion === "delivery")?.value;
  if (value === "crisis_accommodation") return 2;
  if (value === "referral_only" || value === "referral_service") return 1;
  return 0;
}

/**
 * Evaluate + rank all services. Pure. Deterministic order: matched needs,
 * then fact freshness (provider_confirmed > verified_machine > stale),
 * then name. No scores are exposed to the UI.
 */
export function matchServices(context: CaseContext, candidates: ServiceCandidate[], now: Date = new Date()): MatchResult[] {
  return candidates
    .map((c) => evaluateService(context, c, now))
    .sort(
      (a, b) =>
        Number(b.suitable) - Number(a.suitable) ||
        b.matchedNeeds.length - a.matchedNeeds.length ||
        geographyScore(b) - geographyScore(a) ||
        deliveryScore(b) - deliveryScore(a) ||
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
