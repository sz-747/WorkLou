"use server";

/**
 * Phase 6 — Follow-up server actions (step 5A).
 * recordResponse / recordOutcome: worker-recorded history, guarded to open
 * referrals. draftFollowUp: LLM draft for worker review — the worker sends it
 * themselves; nothing is ever transmitted by the tool.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "../../../db";
import { cases, referralEvents, referrals, services } from "../../../db/schema";
import {
  buildFollowUpDraftInput,
  draftFollowUpText,
  fallbackFollowUpText,
  isValidOutcome,
  recordOutcome,
  recordProviderResponse,
  storeFollowUpDraft,
  referralIsOpen,
} from "../../../lib/followup";

function fdStr(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Load one referral + service name for draft building. */
async function loadForDraft(referralId: string) {
  const [row] = await db
    .select({
      id: referrals.id,
      caseId: referrals.caseId,
      clientRef: cases.clientRef,
      sentAt: referrals.sentAt,
      draftText: referrals.draftText,
      status: referrals.status,
      outcome: referrals.outcome,
      serviceName: services.name,
    })
    .from(referrals)
    .innerJoin(services, eq(referrals.serviceId, services.id))
    .innerJoin(cases, eq(referrals.caseId, cases.id))
    .where(eq(referrals.id, referralId));
  return row ?? null;
}

/** Worker records what the provider said. Open referrals only. */
export async function recordResponse(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const referralId = String(fd.get("referralId"));
  const responseText = fdStr(fd, "responseText");

  const back = (msg: string): never =>
    redirect(`/women/${caseId}?followUpError=${encodeURIComponent(msg)}`);
  if (!responseText) back("Write what the provider said before saving.");

  const ok = await recordProviderResponse(referralId, responseText!);
  if (!ok) back("Only open (sent/responded) referrals accept responses.");
  revalidatePath(`/women/${caseId}`);
}

/** Worker records an outcome. awaiting_reply keeps the referral open. */
export async function recordOutcomeAction(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const referralId = String(fd.get("referralId"));
  const outcome = String(fd.get("outcome"));
  const outcomeNotes = fdStr(fd, "outcomeNotes");

  const back = (msg: string): never =>
    redirect(`/women/${caseId}?followUpError=${encodeURIComponent(msg)}`);
  if (!isValidOutcome(outcome)) back("Choose a valid outcome.");

  const ok = await recordOutcome(referralId, outcome as Parameters<typeof recordOutcome>[1], outcomeNotes);
  if (!ok) back("Only open (sent/responded) referrals accept outcomes.");
  revalidatePath(`/women/${caseId}`);
}

/** Draft a follow-up message for worker review. Nothing is transmitted. */
export async function draftFollowUp(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const referralId = String(fd.get("referralId"));

  const back = (msg: string): never =>
    redirect(`/women/${caseId}?followUpError=${encodeURIComponent(msg)}`);

  const referral = await loadForDraft(referralId);
  if (!referral) back("Referral not found.");
  if (!referralIsOpen(referral.status)) back("Only open (sent/responded) referrals can be followed up.");

  const events = await db
    .select()
    .from(referralEvents)
    .where(eq(referralEvents.referralId, referralId))
    .orderBy(asc(referralEvents.occurredAt));

  const input = buildFollowUpDraftInput(
    {
      serviceName: referral.serviceName,
      clientRef: referral.clientRef,
      sentAt: referral.sentAt,
      draftText: referral.draftText,
      status: referral.status,
      outcome: referral.outcome,
    },
    events,
  );

  let text: string;
  try {
    text = await draftFollowUpText(input);
  } catch {
    text = fallbackFollowUpText(input);
  }

  await storeFollowUpDraft(referralId, text!);
  revalidatePath(`/women/${caseId}`);
}
