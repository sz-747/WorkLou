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
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../db";
import { caseContexts, cases, type CaseContext } from "../../../db/schema";
import { extractContextFromNotes } from "../../../lib/extraction";

function fdStr(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function fdList(fd: FormData, key: string): string[] {
  const v = fdStr(fd, key);
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/[\s-]+/g, "_"))
    .filter(Boolean);
}

/** Build a CaseContext from the review-form field names. */
function contextFromFormData(fd: FormData): CaseContext {
  const childrenCount = Number(fdStr(fd, "childrenCount"));
  const petHas = fdStr(fd, "petHas"); // "" | "yes" | "no"
  return {
    needs: fdList(fd, "needs"),
    suburb: fdStr(fd, "suburb"),
    catchment: fdStr(fd, "catchment"),
    children: Number.isFinite(childrenCount) && fdStr(fd, "childrenCount") !== null
      ? { count: childrenCount }
      : null,
    pets:
      petHas === "yes"
        ? { has_pet: true, details: fdStr(fd, "petDetails") ?? undefined }
        : petHas === "no"
          ? { has_pet: false }
          : null,
    income: {
      status: fdStr(fd, "incomeStatus"),
      source: fdStr(fd, "incomeSource"),
    },
    visa: fdStr(fd, "visa"),
    languages: fdList(fd, "languages"),
    urgency: fdStr(fd, "urgency"),
    safety_preferences: fdStr(fd, "safetyPreferences"),
    safe_contact_method: fdStr(fd, "safeContactMethod"),
    summary: fdStr(fd, "summary"),
  };
}

/** Save the raw notes on the case, run LLM extraction, insert a NEW draft version. */
export async function extractDraftContext(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const notes = String(fd.get("notes") ?? "").trim();
  if (!caseId || !notes) {
    redirect(`/women/${caseId}?extractError=${encodeURIComponent("Notes are required.")}`);
  }

  // persist the raw notes on the case
  await db.update(cases).set({ originalNotes: notes }).where(eq(cases.id, caseId));

  let extraction: { context: CaseContext; model: string };
  try {
    extraction = await extractContextFromNotes(notes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Extraction failed.";
    redirect(`/women/${caseId}?extractError=${encodeURIComponent(msg)}`);
  }

  const [{ maxVersion }] = await db
    .select({ maxVersion: sql<number>`coalesce(max(${caseContexts.version}), 0)::int` })
    .from(caseContexts)
    .where(eq(caseContexts.caseId, caseId));

  await db.insert(caseContexts).values({
    caseId,
    version: maxVersion + 1,
    context: extraction.context,
    status: "draft",
    extractionModel: extraction.model,
  });

  revalidatePath(`/women/${caseId}`);
}

/** Worker edits a draft in place. Approved rows are never touched. */
export async function saveDraftContext(fd: FormData): Promise<void> {
  const contextId = String(fd.get("contextId"));
  const caseId = String(fd.get("caseId"));

  await db
    .update(caseContexts)
    .set({ context: contextFromFormData(fd) })
    .where(and(eq(caseContexts.id, contextId), eq(caseContexts.status, "draft")));

  revalidatePath(`/women/${caseId}`);
}

/** Worker approves a draft. Only drafts can be approved; approved rows never change. */
export async function approveContext(fd: FormData): Promise<void> {
  const contextId = String(fd.get("contextId"));
  const caseId = String(fd.get("caseId"));

  await db
    .update(caseContexts)
    .set({ status: "approved", approvedAt: new Date() })
    .where(and(eq(caseContexts.id, contextId), eq(caseContexts.status, "draft")));

  revalidatePath(`/women/${caseId}`);
}
