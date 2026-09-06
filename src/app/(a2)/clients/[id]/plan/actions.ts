"use server";

import { revalidatePath } from "next/cache";
import { getLatestApprovedContext } from "../../../../../lib/matching";
import {
  findActiveReferralForService,
  insertReferralDraft,
  saveReferralDraftText,
} from "../../../../../lib/refer";
import { CONTEXT_FIELDS } from "../../../../../lib/context-fields";

/**
 * Keep the email to an alternative community service as a referral draft.
 * Nothing is transmitted — this is the same draft-only state Refer uses, so
 * the draft shows up in her plan and in Letters.
 */
export async function keepAltEmailDraft(formData: FormData): Promise<void> {
  const caseId = String(formData.get("caseId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!caseId || !serviceId || !body) return;

  const existing = await findActiveReferralForService(caseId, serviceId);
  if (existing) {
    await saveReferralDraftText(existing.id, body);
  } else {
    const approved = await getLatestApprovedContext(caseId);
    if (!approved) return;
    await insertReferralDraft({
      caseId,
      contextId: approved.id,
      serviceId,
      draftText: body,
      sharedFields: CONTEXT_FIELDS.map((field) => field.key),
    });
  }

  revalidatePath(`/clients/${caseId}/plan`);
}
