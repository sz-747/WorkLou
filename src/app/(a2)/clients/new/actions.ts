"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPersonFromNotes } from "../../../../lib/a2/intake";
import { approveContextDraft } from "../../../../lib/context";
import { CONTEXT_FIELDS, fieldValuePreview } from "../../../../lib/context-fields";
import { getMatchCandidates, matchServices } from "../../../../lib/matching";

export type IntakeField = {
  key: string;
  label: string;
  value: string | null;
};

export type IntakeState = {
  status: "idle" | "success" | "error";
  caseId: string | null;
  contextId: string | null;
  name: string;
  email: string;
  notes: string;
  fields: IntakeField[];
  matchCount: number | null;
  warning: string | null;
  error: string | null;
};

/** Save the rough intake, run extraction, and return the draft for review. */
export async function addPerson(
  _previousState: IntakeState,
  fd: FormData,
): Promise<IntakeState> {
  const name = String(fd.get("name") ?? "");
  const email = String(fd.get("email") ?? "");
  const notes = String(fd.get("notes") ?? "");

  try {
    const result = await createPersonFromNotes({ name, email, notes });
    const candidates = await getMatchCandidates();
    const ranked = matchServices(result.context, candidates);
    revalidatePath("/clients");

    return {
      status: "success",
      caseId: result.caseId,
      contextId: result.contextId,
      name: name.trim(),
      email: email.trim(),
      notes: notes.trim(),
      fields: CONTEXT_FIELDS.map(({ key, label }) => ({
        key,
        label,
        value: fieldValuePreview(key, result.context),
      })),
      matchCount: ranked.length,
      warning:
        result.extractionModel === "manual_fallback"
          ? "The notes were saved, but automatic extraction was unavailable. Review and add the missing details before using them for a real referral."
          : null,
      error: null,
    };
  } catch (error) {
    return {
      status: "error",
      caseId: null,
      contextId: null,
      name,
      email,
      notes,
      fields: [],
      matchCount: null,
      warning: null,
      error: error instanceof Error ? error.message : "Could not add this person.",
    };
  }
}

/** Approve the reviewed extraction, then run matching on the plan route. */
export async function continueToServices(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId") ?? "");
  const contextId = String(fd.get("contextId") ?? "");

  if (!caseId || !contextId) {
    redirect("/clients/new?error=Extract%20the%20call%20notes%20first.");
  }

  let approved = false;
  try {
    approved = await approveContextDraft(contextId);
  } catch {
    approved = false;
  }

  if (!approved) {
    redirect(
      `/clients/${caseId}/plan?error=${encodeURIComponent("These details could not be approved. Review the case before searching.")}`,
    );
  }

  revalidatePath(`/clients/${caseId}`);
  revalidatePath(`/clients/${caseId}/plan`);
  revalidatePath("/clients");
  redirect(`/clients/${caseId}/plan`);
}
