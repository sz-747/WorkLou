/**
 * Letters view model. Letters are the Phase 6 case documents (draft or
 * approved) — one row per document, newest first.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { caseDocuments, cases } from "../../db/schema";
import { contactLabel, displayName, joinParts } from "./format";

export type LetterRow = {
  key: string;
  caseId: string;
  name: string;
  detail: string;
  meta: string;
};

/** First line of the draft, used as the letter's title in the sheet. */
function titleOf(draftText: string): string {
  const line = draftText.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "Untitled";
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

export async function getLetterRows(now: Date = new Date()): Promise<LetterRow[]> {
  const rows = await db
    .select({
      id: caseDocuments.id,
      caseId: caseDocuments.caseId,
      clientRef: cases.clientRef,
      clientName: cases.clientName,
      draftText: caseDocuments.draftText,
      status: caseDocuments.status,
      createdAt: caseDocuments.createdAt,
      approvedAt: caseDocuments.approvedAt,
    })
    .from(caseDocuments)
    .innerJoin(cases, eq(caseDocuments.caseId, cases.id))
    .orderBy(desc(caseDocuments.createdAt));

  return rows.map((row) => ({
    key: row.id,
    caseId: row.caseId,
    name: `${titleOf(row.draftText)} · ${displayName(row)}`,
    detail: joinParts([
      row.status === "approved" ? "approved" : "draft kept",
      contactLabel(row.approvedAt ?? row.createdAt, now),
    ]),
    meta: row.status === "approved" ? "Approved" : "Draft",
  }));
}
