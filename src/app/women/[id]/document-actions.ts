"use server";

/**
 * Phase 6 — Documentation server actions (step 5B).
 * draftDocument: LLM drafts a case note from stored case/referral data for
 * worker review. saveDocumentDraft / approveDocumentAction: the worker edits
 * and approves; approving is the only way a note becomes final. Original
 * notes are never modified. Nothing is ever transmitted.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { cases } from "../../../db/schema";
import { getLatestApprovedContext } from "../../../lib/matching";
import { getReferralsForCase } from "../../../lib/refer";
import { getReferralEventsForCase } from "../../../lib/followup";
import {
  approveDocument,
  buildCaseNoteInput,
  draftCaseNoteText,
  fallbackCaseNoteText,
  getProviderConfirmationsForCase,
  insertDocumentDraft,
  saveDocumentDraftText,
} from "../../../lib/document";
import { getNotesForContext } from "../../../lib/case-notes";

function fdStr(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Draft a case note from the stored case/referral data. Worker reviews it. */
export async function draftDocument(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));

  const back = (msg: string): never =>
    redirect(`/women/${caseId}?documentError=${encodeURIComponent(msg)}`);

  const [caseRow] = await db.select().from(cases).where(eq(cases.id, caseId));
  if (!caseRow) back("Case not found.");

  const approvedContext = await getLatestApprovedContext(caseId);
  const approvedNotes = await getNotesForContext(caseId, approvedContext?.noteRevisionId ?? null);
  const referrals = await getReferralsForCase(caseId);
  const confirmations = await getProviderConfirmationsForCase(caseId);
  const events = await getReferralEventsForCase(caseId);

  const input = buildCaseNoteInput(
    {
      clientRef: caseRow.clientRef,
      appointmentAt: caseRow.appointmentAt,
      originalNotes: approvedNotes,
      context: approvedContext?.context ?? null,
      referrals,
      confirmations,
      events,
    },
  );

  let text: string;
  try {
    text = await draftCaseNoteText(input);
  } catch {
    text = fallbackCaseNoteText(input);
  }

  await insertDocumentDraft(caseId, text!);
  revalidatePath(`/women/${caseId}`);
}

/** Worker saves edits to a draft. Approved documents are never edited. */
export async function saveDocumentDraft(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const documentId = String(fd.get("documentId"));
  const draftText = fdStr(fd, "draftText");

  const back = (msg: string): never =>
    redirect(`/women/${caseId}?documentError=${encodeURIComponent(msg)}`);
  if (!draftText) back("The case note cannot be empty.");

  const ok = await saveDocumentDraftText(documentId, draftText!);
  if (!ok) back("Only draft case notes can be edited.");
  revalidatePath(`/women/${caseId}`);
}

/** Worker approves a draft — it becomes the final case note. */
export async function approveDocumentAction(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const documentId = String(fd.get("documentId"));

  const back = (msg: string): never =>
    redirect(`/women/${caseId}?documentError=${encodeURIComponent(msg)}`);

  const ok = await approveDocument(documentId);
  if (!ok) back("Only draft case notes can be approved.");
  revalidatePath(`/women/${caseId}`);
}
