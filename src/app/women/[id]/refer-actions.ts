"use server";

/**
 * Phase 5 — Refer server actions.
 * generateReferralDraft: builds the draft ONLY from the latest APPROVED
 * context + the worker's share selection + the chosen service's stored
 * facts. Nothing is ever transmitted.
 * saveReferralDraft: worker edits a draft (draft-only).
 * markReferralSent: demo-only — records status/sent_at/follow_up_due.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildReferralDraftInput,
  draftReferralText,
  insertReferralDraft,
  markReferralSent,
  saveReferralDraftText,
  getServiceForRefer,
  defaultFollowUpDate,
  findActiveReferralForService,
} from "../../../lib/refer";
import { getLatestApprovedContext, getMatchCandidates, matchServices } from "../../../lib/matching";
import { CONTEXT_FIELDS } from "../../../lib/context-fields";

function fdStr(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Generate a referral draft from approved context only. */
export async function generateReferralDraft(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const serviceId = String(fd.get("serviceId"));
  const sharedFields = fd
    .getAll("share")
    .map(String)
    .filter((v) => CONTEXT_FIELDS.some((f) => f.key === v));

  const back = (msg: string) =>
    redirect(`/women/${caseId}?referError=${encodeURIComponent(msg)}`);
  if (!serviceId) back("Choose a service to refer to.");
  if (sharedFields.length === 0) back("Choose at least one item to share.");

  const approved = await getLatestApprovedContext(caseId);
  if (!approved) back("No approved context — approve a context first (stage 1).");

  // the service must come from the case's Find support results
  const results = matchServices(approved.context, await getMatchCandidates());
  const chosen = results.find((r) => r.suitable && r.service.id === serviceId);
  if (!chosen) back("That service is not in your Find support results for this case.");

  const loaded = await getServiceForRefer(serviceId);
  if (!loaded) back("Service not found.");

  // Guard: one active referral per case+service — a new draft is only allowed
  // once the previous referral reached a final outcome (no duplicates while open).
  const active = await findActiveReferralForService(caseId, serviceId);
  if (active) {
    back(
      `An open referral to that service already exists (status: ${active.status}) — follow it up in stage 5 or record a final outcome before referring again.`,
    );
  }

  const input = buildReferralDraftInput(
    approved.context,
    sharedFields,
    loaded.service,
    loaded.facts,
  );

  let draftText: string;
  try {
    draftText = await draftReferralText(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Referral drafting failed.";
    back(msg);
  }

  await insertReferralDraft({
    caseId,
    contextId: approved.id,
    serviceId,
    draftText,
    sharedFields,
  });

  revalidatePath(`/women/${caseId}`);
}

/** Worker edits a draft in place. Sent referrals are never touched. */
export async function saveReferralDraft(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const referralId = String(fd.get("referralId"));
  const draftText = fdStr(fd, "draftText");

  const back = (msg: string) =>
    redirect(`/women/${caseId}?referError=${encodeURIComponent(msg)}`);
  if (!draftText) back("The referral draft cannot be empty.");
  const ok = await saveReferralDraftText(referralId, draftText);
  if (!ok) back("Only draft referrals can be edited — sent referrals never change.");
  revalidatePath(`/women/${caseId}`);
}

/** Demo-only: records the referral as sent with the follow-up date. */
export async function markSent(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const referralId = String(fd.get("referralId"));
  const followUpDue = fdStr(fd, "followUpDue") ?? defaultFollowUpDate();

  const ok = await markReferralSent(referralId, followUpDue);
  if (!ok) {
    redirect(
      `/women/${caseId}?referError=${encodeURIComponent(
        "Only draft referrals can be marked sent — sent referrals never change.",
      )}`,
    );
  }
  revalidatePath(`/women/${caseId}`);
}
