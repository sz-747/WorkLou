"use server";

/**
 * Phase 2 — Context server actions.
 * Safety rules (docs/product.md):
 * - extractDraftContext always creates a NEW draft version; it never mutates
 *   an existing context row (worker-approved data is never silently overwritten).
 * - saveDraftContext / approveContext only ever touch rows with status='draft'.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CaseContext } from "../../../db/schema";
import { emptyCaseContext, extractContextFromNotes } from "../../../lib/extraction";
import { contextFromFormData } from "../../../lib/context-form";
import { recordCaseNotes } from "../../../lib/case-notes";
import { approveContextDraft, createContextDraft, saveContextDraft } from "../../../lib/context";

/** Save the raw notes on the case, run LLM extraction, insert a NEW draft version. */
export async function extractDraftContext(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const notes = String(fd.get("notes") ?? "").trim();
  if (!caseId || !notes) {
    redirect(`/women/${caseId}?extractError=${encodeURIComponent("Notes are required.")}`);
  }

  // Keep the current snapshot for the UI and an immutable revision for audit/history.
  const noteRevisionId = await recordCaseNotes(caseId, notes);

  let extraction: { context: CaseContext; model: string };
  try {
    extraction = await extractContextFromNotes(notes);
  } catch {
    extraction = { context: emptyCaseContext(), model: "manual_fallback" };
  }

  await createContextDraft({
    caseId,
    noteRevisionId,
    context: extraction.context,
    extractionModel: extraction.model,
  });

  revalidatePath(`/women/${caseId}`);
  revalidatePath("/clients");
}

/** Worker edits a draft in place. Approved rows are never touched. */
export async function saveDraftContext(fd: FormData): Promise<void> {
  const contextId = String(fd.get("contextId"));
  const caseId = String(fd.get("caseId"));

  await saveContextDraft(contextId, contextFromFormData(fd));

  revalidatePath(`/women/${caseId}`);
  revalidatePath("/clients");
}

/** Worker approves a draft. Only drafts can be approved; approved rows never change. */
export async function approveContext(fd: FormData): Promise<void> {
  const contextId = String(fd.get("contextId"));
  const caseId = String(fd.get("caseId"));

  await approveContextDraft(contextId);

  revalidatePath(`/women/${caseId}`);
  revalidatePath("/clients");
}
