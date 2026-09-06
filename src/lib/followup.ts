/**
 * Phase 6 — Follow up (step 5A, follow-up half only).
 * Tracks provider responses, outcomes, and a simple timeline for sent
 * referrals. Outcomes distinguish "support received" from merely
 * sent/accepted. Follow-up drafts are LLM text for the worker to review and
 * send themselves — nothing is ever transmitted by the tool.
 */
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { db } from "../db";
import { cases, referralEvents, referrals, services } from "../db/schema";
import { chatCompletionsUrl, fetchLlm } from "./extraction";
import { sydneyDate } from "./dates";

/** Outcome options (referrals.outcome check constraint keeps these in sync). */
export const OUTCOMES = [
  { value: "awaiting_reply", label: "Awaiting reply", final: false },
  { value: "accepted", label: "Accepted", final: false },
  { value: "declined", label: "Declined", final: true },
  { value: "referred_elsewhere", label: "Referred elsewhere", final: true },
  { value: "support_received", label: "Support received", final: true },
  { value: "other", label: "Other", final: true },
] as const;

export type OutcomeValue = (typeof OUTCOMES)[number]["value"];

export function outcomeLabel(value: string): string {
  return OUTCOMES.find((o) => o.value === value)?.label ?? value;
}

export function isValidOutcome(value: string): value is OutcomeValue {
  return OUTCOMES.some((o) => o.value === value);
}

/** Final outcomes close the referral; awaiting_reply keeps it open. */
export function isFinalOutcome(value: string): boolean {
  return OUTCOMES.find((o) => o.value === value)?.final ?? true;
}

const OPEN_STATUSES = ["sent", "responded"] as const;

export type ReferralEventRow = {
  id: string;
  referralId: string;
  kind: string;
  note: string;
  occurredAt: Date;
};

/** Append a timeline event. Internal — call sites own the status guards. */
async function insertEvent(
  referralId: string,
  kind: string,
  note: string,
  occurredAt: Date = new Date(),
): Promise<void> {
  await db.insert(referralEvents).values({ referralId, kind, note, occurredAt });
}

/**
 * Worker records a provider response. Only for open referrals (sent or
 * already responded); moves status sent → responded.
 */
export async function recordProviderResponse(
  referralId: string,
  note: string,
  occurredAt: Date = new Date(),
): Promise<boolean> {
  const trimmed = note.trim();
  if (!trimmed) return false;
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(referrals)
      .set({ status: "responded" })
      .where(
        and(
          eq(referrals.id, referralId),
          inArray(referrals.status, [...OPEN_STATUSES]),
        ),
      )
      .returning({ id: referrals.id });
    if (updated.length === 0) return false;
    await tx.insert(referralEvents).values({
      referralId,
      kind: "provider_response",
      note: trimmed,
      occurredAt,
    });
    return true;
  });
}

/**
 * Worker records an outcome. awaiting_reply keeps the referral open
 * (status responded); final outcomes close it and stamp outcome_at.
 * Once closed, no further responses or outcomes are recorded.
 */
export async function recordOutcome(
  referralId: string,
  outcome: OutcomeValue,
  notes: string | null,
): Promise<boolean> {
  if (!isValidOutcome(outcome)) return false;
  const final = isFinalOutcome(outcome);
  const note = notes?.trim()
    ? `${outcomeLabel(outcome)} — ${notes.trim()}`
    : outcomeLabel(outcome);
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(referrals)
      .set({
        outcome,
        outcomeNotes: notes?.trim() || null,
        outcomeAt: new Date(),
        status: final ? "closed" : "responded",
      })
      .where(
        and(
          eq(referrals.id, referralId),
          inArray(referrals.status, [...OPEN_STATUSES]),
        ),
      )
      .returning({ id: referrals.id });
    if (updated.length === 0) return false;
    await tx.insert(referralEvents).values({ referralId, kind: "outcome", note });
    return true;
  });
}

/** All timeline events for one referral, oldest first. */
export async function getReferralEvents(referralId: string): Promise<ReferralEventRow[]> {
  return db
    .select({
      id: referralEvents.id,
      referralId: referralEvents.referralId,
      kind: referralEvents.kind,
      note: referralEvents.note,
      occurredAt: referralEvents.occurredAt,
    })
    .from(referralEvents)
    .where(eq(referralEvents.referralId, referralId))
    .orderBy(asc(referralEvents.occurredAt));
}

/** Timeline events for every referral of a case, oldest first. */
export async function getReferralEventsForCase(caseId: string): Promise<ReferralEventRow[]> {
  return db
    .select({
      id: referralEvents.id,
      referralId: referralEvents.referralId,
      kind: referralEvents.kind,
      note: referralEvents.note,
      occurredAt: referralEvents.occurredAt,
    })
    .from(referralEvents)
    .innerJoin(referrals, eq(referralEvents.referralId, referrals.id))
    .where(eq(referrals.caseId, caseId))
    .orderBy(asc(referralEvents.occurredAt));
}

/** Sent referrals whose follow-up is due (due date today or past, still open). */
export async function getDueFollowUps(today: string = sydneyDate(new Date())) {
  return db
    .select({
      referralId: referrals.id,
      followUpDue: referrals.followUpDue,
      clientRef: cases.clientRef,
      clientName: cases.clientName,
      caseId: cases.id,
      serviceName: services.name,
      sentAt: referrals.sentAt,
      status: referrals.status,
      outcome: referrals.outcome,
    })
    .from(referrals)
    .innerJoin(cases, eq(referrals.caseId, cases.id))
    .innerJoin(services, eq(referrals.serviceId, services.id))
    .where(
      and(
        inArray(referrals.status, [...OPEN_STATUSES]),
        lte(referrals.followUpDue, today),
      ),
    )
    .orderBy(asc(referrals.followUpDue));
}

export type FollowUpDraftInput = {
  serviceName: string;
  clientRef: string;
  sentAt: string;
  referralText: string;
  status: string;
  outcome: string | null;
  /** provider responses recorded so far, oldest first */
  responses: { occurredAt: string; note: string }[];
};

/**
 * Pure: build the exact input to the follow-up draft. Only stored referral
 * data enters — the text that was sent, the outcome, and recorded responses.
 */
export function buildFollowUpDraftInput(
  referral: {
    serviceName: string;
    clientRef: string;
    sentAt: Date | string | null;
    draftText: string | null;
    status: string;
    outcome: string | null;
  },
  events: { kind: string; note: string; occurredAt: Date | string }[],
): FollowUpDraftInput {
  return {
    serviceName: referral.serviceName,
    clientRef: referral.clientRef,
    sentAt: referral.sentAt ? sydneyDate(referral.sentAt) : "",
    referralText: referral.draftText ?? "",
    status: referral.status,
    outcome: referral.outcome ? outcomeLabel(referral.outcome) : null,
    responses: events
      .filter((e) => e.kind === "provider_response")
      .map((e) => ({
        occurredAt: sydneyDate(e.occurredAt),
        note: e.note,
      })),
  };
}

const DRAFT_SYSTEM_PROMPT = `You draft a short follow-up message from a caseworker at Lou's Place to a support service provider they previously sent a referral to.
You receive JSON with: the provider service, the case reference, when the referral was sent, the referral message that was sent, its current status/outcome, and any provider responses recorded so far.
STRICT RULES:
- Use ONLY the provided information. Never invent, infer, or embellish.
- Plain text, under 120 words, polite and brief.
Structure:
1. One-line reminder naming the service and the case reference, and when the referral was sent.
2. One-line summary of what was sought (from the referral text only).
3. One-line request for an update on the referral status.`;

/** Call the configured LLM to draft a follow-up message (worker reviews and sends it). */
export async function draftFollowUpText(input: FollowUpDraftInput): Promise<string> {
  const base = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!base || !apiKey || !model) {
    throw new Error("LLM not configured (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL missing)");
  }

  const res = await fetchLlm(chatCompletionsUrl(base), {
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

export function fallbackFollowUpText(input: FollowUpDraftInput): string {
  return [
    `Hello ${input.serviceName},`,
    `I am following up on referral ${input.clientRef}, sent ${input.sentAt || "date not recorded"}.`,
    "Please provide an update on the referral status.",
  ].join("\n\n");
}

/**
 * Store a follow-up draft as a timeline event for worker review.
 * Open referrals only; nothing is transmitted.
 */
export async function storeFollowUpDraft(referralId: string, draftText: string): Promise<boolean> {
  const open = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(
      and(eq(referrals.id, referralId), inArray(referrals.status, [...OPEN_STATUSES])),
    );
  if (open.length === 0) return false;
  await insertEvent(referralId, "follow_up_draft", draftText);
  return true;
}

/** True while a referral accepts responses/outcomes (used by the UI). */
export function referralIsOpen(status: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}
