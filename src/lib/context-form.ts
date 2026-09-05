/**
 * Phase 2/5 — Context draft-review form mapping.
 * Pure: builds a CaseContext from the review form's field names, including
 * the worker-corrected who-stated-what tags (field_sources) that Refer uses
 * to keep woman-stated information separate from worker observations.
 * Extracted from the Context server action so it is directly testable.
 */
import type { CaseContext, FieldSource } from "../db/schema";
import { CONTEXT_FIELDS, fieldHasValue } from "./context-fields";

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

/** Build a CaseContext from the review-form field names (incl. field_sources). */
export function contextFromFormData(fd: FormData): CaseContext {
  const childrenCount = Number(fdStr(fd, "childrenCount"));
  const petHas = fdStr(fd, "petHas"); // "" | "yes" | "no"
  const incomeStatus = fdStr(fd, "incomeStatus");
  const incomeSource = fdStr(fd, "incomeSource");
  const base: CaseContext = {
    needs: fdList(fd, "needs"),
    suburb: fdStr(fd, "suburb"),
    catchment: fdStr(fd, "catchment"),
    children:
      Number.isFinite(childrenCount) && fdStr(fd, "childrenCount") !== null
        ? { count: childrenCount }
        : null,
    pets:
      petHas === "yes"
        ? { has_pet: true, details: fdStr(fd, "petDetails") ?? undefined }
        : petHas === "no"
          ? { has_pet: false }
          : null,
    income: incomeStatus || incomeSource
      ? { status: incomeStatus ?? undefined, source: incomeSource ?? undefined }
      : null,
    visa: fdStr(fd, "visa"),
    languages: fdList(fd, "languages"),
    urgency: fdStr(fd, "urgency"),
    safety_preferences: fdStr(fd, "safetyPreferences"),
    safe_contact_method: fdStr(fd, "safeContactMethod"),
    summary: fdStr(fd, "summary"),
  };

  // Phase 5: worker-corrected tags for who stated each field — kept on save,
  // so the Refer stage's woman-stated / worker-observation split survives edits.
  const field_sources: Record<string, FieldSource> = {};
  for (const f of CONTEXT_FIELDS) {
    if (!fieldHasValue(f.key, base)) continue;
    field_sources[f.key] =
      fdStr(fd, `source_${f.key}`) === "worker_observation"
        ? "worker_observation"
        : "woman_stated";
  }
  return { ...base, field_sources };
}
