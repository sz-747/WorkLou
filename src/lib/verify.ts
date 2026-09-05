/**
 * Phase 4 — Verify.
 * Splits a service's stored facts into (a) already known from
 * machine-accessible sources and (b) volatile availability facts that
 * genuinely require a current provider answer, then records those answers
 * into the shared service knowledge.
 *
 * No LLM here and no machine refetching (that is Phase 7A's job):
 * this module only displays stored machine-sourced facts and persists
 * human confirmations. Confirmations update the EXISTING fact row (or
 * insert the missing one) so knowledge stays shared, never duplicated.
 * Marking a fact stale only flips verification_status — source,
 * timestamps, confirmed_by, and notes are never cleared, nothing deleted.
 */
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  providerConfirmationEvents,
  serviceAttributes,
  services,
  type CaseContext,
} from "../db/schema";
import type { FactRow } from "./matching";

export type VerifyItem = {
  label: string;
  attrType: string;
  key: string;
  /** null = the service has NO stored fact for this criterion at all. */
  fact: FactRow | null;
  hint: string;
  /** prior confirmation history kept visible when a fact went stale. */
  history: string | null;
};

export type VerifyGroup = {
  /** already known from machine-accessible sources or provider confirmations. */
  known: FactRow[];
  /** current operational facts that need a provider answer (or are missing). */
  needsConfirmation: VerifyItem[];
};

const LABELS: Record<string, string> = {
  children: "children policy",
  pets: "pet policy",
  visa: "visa restrictions",
  languages: "language support",
  income: "income eligibility",
  wait_time: "wait time",
  cost: "cost",
  need: "need",
  format: "delivery format",
  intake: "intake",
  referral_required: "referral requirement",
};

export function factLabel(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, " ");
}

/** Whether a stored fact counts as known (shared by Verify and Refer). */
function isExpired(fact: FactRow, now: Date): boolean {
  return !!fact.expiresAt && new Date(fact.expiresAt).getTime() <= now.getTime();
}

export function isKnownFact(fact: FactRow): boolean {
  return isKnownFactAt(fact, new Date());
}

export function isKnownFactAt(fact: FactRow, now: Date): boolean {
  const conditional = new Set(["temporary_visa_considered", "nil_income_considered"]);
  return (
    !isExpired(fact, now) &&
    fact.value !== "unknown" &&
    !conditional.has(fact.value) &&
    (fact.verificationStatus === "verified_machine" ||
      fact.verificationStatus === "provider_confirmed" ||
      fact.verificationStatus === "admin_corrected")
  );
}

function needsConfirmation(fact: FactRow, now: Date): boolean {
  return (
    isExpired(fact, now) ||
    fact.value === "unknown" ||
    fact.value === "temporary_visa_considered" ||
    fact.value === "nil_income_considered" ||
    fact.verificationStatus === "needs_provider_confirmation" ||
    fact.verificationStatus === "stale"
  );
}

function historyLine(fact: FactRow): string {
  const parts = [`previous value: "${fact.value}"`, `source: ${fact.sourceName ?? fact.sourceType}`];
  if (fact.confirmedBy && fact.confirmedAt)
    parts.push(`confirmed by ${fact.confirmedBy} on ${new Date(fact.confirmedAt).toLocaleDateString("en-AU")}`);
  parts.push(`recorded ${fact.retrievedAt ? new Date(fact.retrievedAt).toLocaleDateString("en-AU") : "—"}`);
  return parts.join("; ");
}

/**
 * Group a service's facts for verification against the case's criteria.
 * Durable service-profile gaps (pets, languages, visa, income, etc.) belong
 * to the background online updater. The caseworker call list contains only
 * volatile operational facts whose answer can change within hours or days.
 */
export function groupFacts(context: CaseContext, facts: FactRow[], now: Date = new Date()): VerifyGroup {
  const known: FactRow[] = [];
  const pending: VerifyItem[] = [];

  const relevant: { attrType: string; key: string; hint: string }[] = [
    { attrType: "wait_time", key: "wait_time", hint: "ask the provider: current wait time" },
  ];
  if (context.needs.includes("housing_accommodation"))
    relevant.push({ attrType: "delivery", key: "capacity", hint: "ask the provider: current capacity" });

  for (const fact of facts) {
    if (isKnownFactAt(fact, now)) known.push(fact);
  }

  // Emit at most one call question per operational fact. A current answer wins
  // over any older duplicate row; otherwise show the newest available history.
  for (const r of relevant) {
    const matching = facts.filter((fact) => fact.attrType === r.attrType && fact.key === r.key);
    if (matching.some((fact) => isKnownFactAt(fact, now))) continue;

    const fact = matching
      .filter((item) => needsConfirmation(item, now))
      .sort((a, b) => {
        const time = (item: FactRow) => new Date(item.confirmedAt ?? item.retrievedAt ?? 0).getTime();
        return time(b) - time(a);
      })[0];
    if (fact) {
      const stale = fact.verificationStatus === "stale" || isExpired(fact, now);
      pending.push({
        label: factLabel(fact.key),
        attrType: fact.attrType,
        key: fact.key,
        fact,
        hint: r.hint,
        history: stale || fact.confirmedAt ? historyLine(fact) : null,
      });
    } else if (matching.length === 0) {
      pending.push({ label: factLabel(r.key), attrType: r.attrType, key: r.key, fact: null, hint: r.hint, history: null });
    }
  }

  return { known, needsConfirmation: pending };
}

export type ConfirmationInput = {
  caseId: string;
  /** existing fact row to update in place; null inserts the missing fact. */
  attrId: string | null;
  serviceId: string;
  attrType: string;
  key: string;
  value: string;
  confirmedBy: string;
  confirmedAt: Date;
  notes: string | null;
};

function providerConfirmationExpiry(key: string, confirmedAt: Date): Date | null {
  const ttlHours: Record<string, number> = { capacity: 4, wait_time: 24 };
  const hours = ttlHours[key];
  return hours ? new Date(confirmedAt.getTime() + hours * 60 * 60 * 1000) : null;
}

/**
 * Record a provider confirmation into the shared service knowledge.
 * Updates the existing row (never a parallel duplicate) or inserts the
 * missing fact, with full provenance: source_type, who, when, notes.
 */
export async function recordProviderConfirmation(input: ConfirmationInput): Promise<string> {
  const sourceName = `Provider confirmation — ${input.confirmedBy}`;
  return db.transaction(async (tx) => {
    let attributeId = input.attrId;
    if (attributeId) {
      const updated = await tx
        .update(serviceAttributes)
        .set({
          value: input.value,
          sourceType: "provider_confirmed",
          sourceName,
          retrievedAt: input.confirmedAt,
          expiresAt: providerConfirmationExpiry(input.key, input.confirmedAt),
          verificationStatus: "provider_confirmed",
          confirmedBy: input.confirmedBy,
          confirmedAt: input.confirmedAt,
          notes: input.notes ?? undefined,
        })
        .where(eq(serviceAttributes.id, attributeId))
        .returning({ id: serviceAttributes.id });
      if (updated.length === 0) throw new Error("Confirmation fact not found");
    } else {
      const [row] = await tx
        .insert(serviceAttributes)
        .values({
          serviceId: input.serviceId,
          attrType: input.attrType,
          key: input.key,
          value: input.value,
          sourceType: "provider_confirmed",
          sourceName,
          retrievedAt: input.confirmedAt,
          expiresAt: providerConfirmationExpiry(input.key, input.confirmedAt),
          verificationStatus: "provider_confirmed",
          confirmedBy: input.confirmedBy,
          confirmedAt: input.confirmedAt,
          notes: input.notes ?? undefined,
        })
        .returning({ id: serviceAttributes.id });
      attributeId = row.id;
    }
    await tx.insert(providerConfirmationEvents).values({
      caseId: input.caseId,
      serviceId: input.serviceId,
      attributeId,
      attrType: input.attrType,
      key: input.key,
      value: input.value,
      confirmedBy: input.confirmedBy,
      confirmedAt: input.confirmedAt,
      notes: input.notes,
    });
    return attributeId;
  });
}

/**
 * A volatile fact expires: only verification_status flips to 'stale'.
 * Source, timestamps, confirmed_by and notes stay on the row — history
 * is never deleted. The fact returns to the needs-confirmation list.
 */
export async function markFactStale(attrId: string): Promise<void> {
  await db
    .update(serviceAttributes)
    .set({ verificationStatus: "stale" })
    .where(eq(serviceAttributes.id, attrId));
}

/** A service plus all its stored facts, for the Verify stage. */
export async function getServiceForVerify(serviceId: string) {
  const [s] = await db.select().from(services).where(eq(services.id, serviceId));
  if (!s) return null;
  const facts = await db
    .select()
    .from(serviceAttributes)
    .where(eq(serviceAttributes.serviceId, serviceId));
  return { id: s.id, name: s.name, phone: s.phone, facts };
}
