"use server";

import { revalidatePath } from "next/cache";
import { CONTEXT_FIELDS } from "../../../../../lib/context-fields";
import { getLatestApprovedContext } from "../../../../../lib/matching";
import {
  defaultFollowUpDate,
  findActiveReferralForService,
  insertReferralDraft,
  markReferralSent,
  saveReferralDraftText,
} from "../../../../../lib/refer";

export type ReferralActionState = {
  status: "idle" | "success" | "error";
  serviceId: string | null;
  message: string | null;
};

/** Record a referral the caseworker has sent from Gmail and place it in Follow-ups. */
export async function approveReferral(
  _previousState: ReferralActionState,
  formData: FormData,
): Promise<ReferralActionState> {
  const caseId = String(formData.get("caseId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!caseId || !serviceId || !body) {
    return { status: "error", serviceId, message: "The referral needs a service and message." };
  }

  try {
    const approved = await getLatestApprovedContext(caseId);
    if (!approved) {
      return { status: "error", serviceId, message: "Approve the extracted information first." };
    }

    const existing = await findActiveReferralForService(caseId, serviceId);
    let referralId: string;
    if (existing) {
      if (existing.status !== "draft") {
        return {
          status: "error",
          serviceId,
          message: "This service is already in Follow-ups for this person.",
        };
      }
      const saved = await saveReferralDraftText(existing.id, body);
      if (!saved) throw new Error("The referral draft could not be updated.");
      referralId = existing.id;
    } else {
      referralId = await insertReferralDraft({
        caseId,
        contextId: approved.id,
        serviceId,
        draftText: body,
        sharedFields: CONTEXT_FIELDS.map((field) => field.key),
      });
    }

    const sent = await markReferralSent(
      referralId,
      defaultFollowUpDate(new Date(), approved.context.urgency),
    );
    if (!sent) throw new Error("The referral could not be added to Follow-ups.");

    revalidatePath(`/clients/${caseId}/plan`);
    revalidatePath(`/clients/${caseId}`);
    revalidatePath("/clients");
    revalidatePath("/follow-ups");
    return {
      status: "success",
      serviceId,
      message: "Email marked as sent and added to Follow-ups.",
    };
  } catch (error) {
    return {
      status: "error",
      serviceId,
      message: error instanceof Error ? error.message : "The referral could not be approved.",
    };
  }
}
