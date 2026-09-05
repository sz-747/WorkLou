/**
 * Phase 5 — Refer.
 * Builds a factual referral draft from the worker-selected subset of the
 * APPROVED case context plus the chosen service's stored facts. The LLM
 * drafts prose but never invents facts: it receives ONLY the selected items
 * and stored facts (docs/product.md: "The LLM never invents service facts").
 * Nothing is ever transmitted — "Mark as sent" is a DB-only state change.
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { referrals, serviceAttributes, services, type CaseContext, type FieldSource } from "../db/schema";
import { CONTEXT_FIELDS, fieldHasValue, fieldSourceOf, fieldValuePreview } from "./context-fields";
import { chatCompletionsUrl } from "./extraction";
import { isKnownFact, factLabel } from "./verify";
import type { FactRow } from "./matching";

export type SharedItem = {
  key: string;
  label: string;
  value: string;
  source: FieldSource;
};

export type ReferralDraftInput = {
  service: {
    name: string;
    organisation: string | null;
    phone: string | null;
    catchment: string | null;
  };
  /** woman-stated context items the worker chose to share */
  womanStated: SharedItem[];
  /** worker observations the worker chose to share */
  workerObservations: SharedItem[];
  /** known stored facts about the chosen service */
  serviceFacts: { key: string; label: string; value: string }[];
};

/**
 * Build the exact inputs to the referral draft. Pure. Only the shared fields
 * with a recorded value enter the result — excluded (unchecked) fields are
 * absent entirely, so nothing outside the selection can reach the draft.
 */
export function buildReferralDraftInput(
  context: CaseContext,
  sharedFieldKeys: string[],
  service: { name: string; organisation: string | null; phone: string | null; catchment: string | null },
  facts: FactRow[],
): ReferralDraftInput {
  const wanted = new Set(sharedFieldKeys);
  const items: SharedItem[] = CONTEXT_FIELDS.filter(
    (f) => wanted.has(f.key) && fieldHasValue(f.key, context),
  ).map((f) => ({
    key: f.key,
    label: f.label,
    value: fieldValuePreview(f.key, context)!,
    source: fieldSourceOf(context, f.key),
  }));
  return {
    service: {
      name: service.name,
      organisation: service.organisation,
      phone: service.phone,
      catchment: service.catchment,
    },
    womanStated: items.filter((i) => i.source === "woman_stated"),
    workerObservations: items.filter((i) => i.source === "worker_observation"),
    serviceFacts: facts
      .filter(isKnownFact)
      .map((f) => ({ key: f.key, label: factLabel(f.key), value: f.value })),
  };
}

const DRAFT_SYSTEM_PROMPT = `You draft a short factual referral message from a caseworker at Lou's Place (a women's support service) to a support service provider.
You receive JSON with: the service being referred to, the case information the caseworker chose to share, and known facts about the service.
STRICT RULES:
- Use ONLY the provided information. Never invent, infer, guess, or embellish. No names or contact details that are not provided.
- The woman-stated information and the caseworker observations must stay in two clearly labelled separate sections, in that order.
- Plain text, no markdown headings, under 200 words.
Structure:
1. One-line greeting naming the service and the kind of support being sought (from the provided needs and service facts only).
2. A section titled "About the woman (as she stated):" — one short bullet per woman-stated item.
3. A section titled "Caseworker observations:" — one short bullet per worker observation (omit the section entirely if there are none).
4. One-line closing asking the provider to assess suitability for a referral.`;

/** Call the configured LLM to draft the referral text from the given input. */
export async function draftReferralText(input: ReferralDraftInput): Promise<string> {
  const base = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!base || !apiKey || !model) {
    throw new Error("LLM not configured (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL missing)");
  }

  const res = await fetch(chatCompletionsUrl(base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: DRAFT_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM request failed (HTTP ${res.status})`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error("LLM returned no content");
  return content.trim();
}

/** Default next-follow-up date: one week from now (worker-editable in the form). */
export function defaultFollowUpDate(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

/** Insert a referral draft row (status 'draft'). */
export async function insertReferralDraft(input: {
  caseId: string;
  contextId: string;
  serviceId: string;
  draftText: string;
  sharedFields: string[];
}): Promise<string> {
  const [row] = await db
    .insert(referrals)
    .values({
      caseId: input.caseId,
      contextId: input.contextId,
      serviceId: input.serviceId,
      draftText: input.draftText,
      status: "draft",
      sharedFields: input.sharedFields,
    })
    .returning({ id: referrals.id });
  return row.id;
}

/** Worker edits a draft. Draft-only: sent referrals never change. */
export async function saveReferralDraftText(referralId: string, draftText: string): Promise<boolean> {
  const result = await db
    .update(referrals)
    .set({ draftText })
    .where(and(eq(referrals.id, referralId), eq(referrals.status, "draft")))
    .returning({ id: referrals.id });
  return result.length > 0;
}

/**
 * Worker marks a referral sent — demo only, nothing is transmitted.
 * Draft-only guard; sets status, sent_at and follow_up_due together.
 */
export async function markReferralSent(referralId: string, followUpDue: string): Promise<boolean> {
  const result = await db
    .update(referrals)
    .set({ status: "sent", sentAt: new Date(), followUpDue })
    .where(and(eq(referrals.id, referralId), eq(referrals.status, "draft")))
    .returning({ id: referrals.id });
  return result.length > 0;
}

/** All referrals for a case with service names, oldest first. */
export async function getReferralsForCase(caseId: string) {
  return db
    .select({
      id: referrals.id,
      serviceId: referrals.serviceId,
      serviceName: services.name,
      status: referrals.status,
      draftText: referrals.draftText,
      sentAt: referrals.sentAt,
      followUpDue: referrals.followUpDue,
      sharedFields: referrals.sharedFields,
      outcome: referrals.outcome,
      outcomeAt: referrals.outcomeAt,
      createdAt: referrals.createdAt,
    })
    .from(referrals)
    .innerJoin(services, eq(referrals.serviceId, services.id))
    .where(eq(referrals.caseId, caseId))
    .orderBy(asc(referrals.createdAt));
}

/** The chosen service's row + stored facts, for draft generation. */
export async function getServiceForRefer(serviceId: string) {
  const [s] = await db.select().from(services).where(eq(services.id, serviceId));
  if (!s) return null;
  const facts = await db
    .select()
    .from(serviceAttributes)
    .where(eq(serviceAttributes.serviceId, serviceId));
  return { service: s, facts };
}
