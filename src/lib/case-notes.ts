import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { caseNoteRevisions, cases } from "../db/schema";

/** Save the current raw notes and immutable history as one database operation. */
export async function recordCaseNotes(caseId: string, notes: string): Promise<string> {
  const value = notes.trim();
  if (!value) throw new Error("Notes are required");
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(cases)
      .set({ originalNotes: value })
      .where(eq(cases.id, caseId))
      .returning({ id: cases.id });
    if (updated.length === 0) throw new Error("Case not found");
    const [revision] = await tx
      .insert(caseNoteRevisions)
      .values({ caseId, notes: value })
      .returning({ id: caseNoteRevisions.id });
    return revision.id;
  });
}

/** Resolve the raw notes linked to a context; current-case text is legacy fallback only. */
export async function getNotesForContext(caseId: string, noteRevisionId: string | null): Promise<string> {
  if (noteRevisionId) {
    const [revision] = await db
      .select({ notes: caseNoteRevisions.notes })
      .from(caseNoteRevisions)
      .where(and(eq(caseNoteRevisions.id, noteRevisionId), eq(caseNoteRevisions.caseId, caseId)));
    if (revision) return revision.notes;
  }
  const [caseRow] = await db
    .select({ notes: cases.originalNotes })
    .from(cases)
    .where(eq(cases.id, caseId));
  if (!caseRow) throw new Error("Case not found");
  return caseRow.notes;
}
