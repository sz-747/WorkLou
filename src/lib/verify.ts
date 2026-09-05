/**
 * Phase 4 — Verify.
 * Splits a service's stored facts into (a) already known from
 * machine-accessible sources and (b) genuinely provider-only unknowns,
 * and records provider confirmations into the shared service knowledge.
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
import { serviceAttributes, services, type CaseContext } from "../db/schema";
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
  /** genuinely needs direct provider confirmation (or is missing entirely). */
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
export function isKnownFact(fact: FactRow): boolean {
  return (
    fact.value !== "unknown" &&
    (fact.verificationStatus === "verified_machine" ||
      fact.verificationStatus === "provider_confirmed" ||
      fact.verificationStatus === "admin_corrected")
  );
}

function needsConfirmation(fact: FactRow): boolean {
  return (
    fact.value === "unknown" ||
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
 * Pure and deterministic: unknowns (missing facts, 'unknown' values,
 * stale facts) are always shown as needing confirmation — never assumed known.
 */
export function groupFacts(context: CaseContext, facts: FactRow[]): VerifyGroup {
  const known: FactRow[] = [];
  const pending: VerifyItem[] = [];

  for (const fact of facts) {
    if (isKnownFact(fact)) known.push(fact);
    else if (needsConfirmation(fact)) {
      const stale = fact.verificationStatus === "stale";
      pending.push({
        label: factLabel(fact.key),
        attrType: fact.attrType,
        key: fact.key,
        fact,
        hint: `ask the provider: ${factLabel(fact.key)}`,
        history: stale || fact.confirmedAt ? historyLine(fact) : null,
      });
    }
    // facts that are neither known nor pending (none in the current status set) are ignored
  }

  // relevant criteria with NO stored fact at all are explicit unknowns
  const relevant: { attrType: string; key: string; hint: string }[] = [];
  if (context.children && context.children.count > 0)
    relevant.push({ attrType: "eligibility", key: "children", hint: "ask the provider: children policy" });
  if (context.pets?.has_pet)
    relevant.push({ attrType: "eligibility", key: "pets", hint: "ask the provider: pet policy" });
  if (context.visa)
    relevant.push({ attrType: "eligibility", key: "visa", hint: "ask the provider: visa restrictions" });
  if (context.languages.length > 0)
    relevant.push({ attrType: "eligibility", key: "languages", hint: "ask the provider: language support / interpreters" });
  if (context.income?.status)
    relevant.push({ attrType: "eligibility", key: "income", hint: "ask the provider: income eligibility" });
  if (context.urgency === "high")
    relevant.push({ attrType: "wait_time", key: "wait_time", hint: "ask the provider: current wait time" });

  for (const r of relevant) {
    if (!facts.some((f) => f.attrType === r.attrType && f.key === r.key)) {
      pending.push({ label: factLabel(r.key), attrType: r.attrType, key: r.key, fact: null, hint: r.hint, history: null });
    }
  }

  return { known, needsConfirmation: pending };
}

export type ConfirmationInput = {
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

/**
 * Record a provider confirmation into the shared service knowledge.
 * Updates the existing row (never a parallel duplicate) or inserts the
 * missing fact, with full provenance: source_type, who, when, notes.
 */
export async function recordProviderConfirmation(input: ConfirmationInput): Promise<string> {
  const sourceName = `Provider confirmation — ${input.confirmedBy}`;
  if (input.attrId) {
    await db
      .update(serviceAttributes)
      .set({
        value: input.value,
        sourceType: "provider_confirmed",
        sourceName,
        retrievedAt: input.confirmedAt,
        verificationStatus: "provider_confirmed",
        confirmedBy: input.confirmedBy,
        confirmedAt: input.confirmedAt,
        notes: input.notes ?? undefined,
      })
      .where(eq(serviceAttributes.id, input.attrId));
    return input.attrId;
  }
  const [row] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: input.serviceId,
      attrType: input.attrType,
      key: input.key,
      value: input.value,
      sourceType: "provider_confirmed",
      sourceName,
      retrievedAt: input.confirmedAt,
      verificationStatus: "provider_confirmed",
      confirmedBy: input.confirmedBy,
      confirmedAt: input.confirmedAt,
      notes: input.notes ?? undefined,
    })
    .returning({ id: serviceAttributes.id });
  return row.id;
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
