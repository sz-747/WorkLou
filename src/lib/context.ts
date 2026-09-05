import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { caseContexts, type CaseContext } from "../db/schema";

export async function createContextDraft(input: {
  caseId: string;
  noteRevisionId: string;
  context: CaseContext;
  extractionModel: string;
}) {
  return db.transaction(async (tx) => {
    const [{ maxVersion }] = await tx
      .select({ maxVersion: sql<number>`coalesce(max(${caseContexts.version}), 0)::int` })
      .from(caseContexts)
      .where(eq(caseContexts.caseId, input.caseId));
    const [draft] = await tx
      .insert(caseContexts)
      .values({ ...input, version: maxVersion + 1, status: "draft" })
      .returning();
    return draft;
  });
}

export async function saveContextDraft(contextId: string, context: CaseContext): Promise<boolean> {
  const updated = await db
    .update(caseContexts)
    .set({ context })
    .where(and(eq(caseContexts.id, contextId), eq(caseContexts.status, "draft")))
    .returning({ id: caseContexts.id });
  return updated.length > 0;
}

export async function approveContextDraft(contextId: string): Promise<boolean> {
  const updated = await db
    .update(caseContexts)
    .set({ status: "approved", approvedAt: new Date() })
    .where(and(eq(caseContexts.id, contextId), eq(caseContexts.status, "draft")))
    .returning({ id: caseContexts.id });
  return updated.length > 0;
}
