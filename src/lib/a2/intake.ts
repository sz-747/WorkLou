/**
 * Intake — the first minutes of a call. The worker types her name and the raw
 * call notes; we store the notes verbatim (append-only revision), run the
 * existing LLM extraction over them and open a DRAFT context so the structured
 * fields — children, income, language, visa, suburb, urgency — land in the
 * columns the schema already defines. Nothing is approved here: the worker
 * reviews the pills in stage 1 before anything is used for matching.
 */
import { desc, like } from "drizzle-orm";
import { db } from "../../db";
import { cases } from "../../db/schema";
import type { CaseContext } from "../../db/schema";
import { recordCaseNotes } from "../case-notes";
import { createContextDraft } from "../context";
import { emptyCaseContext, extractContextFromNotes } from "../extraction";

/** Next de-identified data label for the year: CASE-2026-004. */
async function nextClientRef(now: Date): Promise<string> {
  const year = now.getFullYear();
  const prefix = `CASE-${year}-`;
  const [latest] = await db
    .select({ clientRef: cases.clientRef })
    .from(cases)
    .where(like(cases.clientRef, `${prefix}%`))
    .orderBy(desc(cases.clientRef))
    .limit(1);
  const n = latest ? Number(latest.clientRef.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(n) ? n : 1).padStart(3, "0")}`;
}

export type NewPersonInput = { name: string; notes: string };

/** Creates the case, keeps the notes, extracts a draft context. Returns caseId. */
export async function createPersonFromNotes(
  input: NewPersonInput,
  now: Date = new Date(),
): Promise<string> {
  const name = input.name.trim();
  const notes = input.notes.trim();
  if (!name) throw new Error("Her name is required.");
  if (!notes) throw new Error("Call notes are required.");

  const [caseRow] = await db
    .insert(cases)
    .values({
      clientRef: await nextClientRef(now),
      clientName: name,
      originalNotes: notes,
      status: "open",
    })
    .returning();

  const noteRevisionId = await recordCaseNotes(caseRow.id, notes);

  let extraction: { context: CaseContext; model: string };
  try {
    extraction = await extractContextFromNotes(notes);
  } catch {
    // Extraction can fail (model down); the notes are already safe and the
    // worker can fill the draft in by hand in stage 1.
    extraction = { context: emptyCaseContext(), model: "manual_fallback" };
  }

  await createContextDraft({
    caseId: caseRow.id,
    noteRevisionId,
    context: extraction.context,
    extractionModel: extraction.model,
  });

  return caseRow.id;
}
