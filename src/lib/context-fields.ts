/**
 * Phase 5 — Case-context field metadata.
 * Shared by Context (extraction tagging + draft review) and Refer (share
 * selection, woman-stated vs worker-observation separation).
 * Kept separate so extraction, refer, and the UI agree on one field list.
 */
import type { CaseContext, FieldSource } from "../db/schema";

export type ContextFieldDef = {
  key: string;
  label: string;
  /** minimal core set pre-checked in the Refer share controls */
  core: boolean;
};

/** Every CaseContext field a referral can share, in display order. */
export const CONTEXT_FIELDS: ContextFieldDef[] = [
  { key: "needs", label: "Needs", core: true },
  { key: "suburb", label: "Suburb", core: true },
  { key: "languages", label: "Languages", core: true },
  { key: "summary", label: "Summary", core: true },
  { key: "catchment", label: "Catchment area", core: false },
  { key: "children", label: "Children", core: false },
  { key: "pets", label: "Pets", core: false },
  { key: "income", label: "Income", core: false },
  { key: "visa", label: "Visa", core: false },
  { key: "urgency", label: "Urgency", core: false },
  { key: "safety_preferences", label: "Safety preferences", core: false },
  { key: "safe_contact_method", label: "Safe contact method", core: false },
];

/** Contexts stored before Phase 5 tagging: everything the notes state is
 * woman-stated; urgency is the caseworker's assessment. */
const LEGACY_DEFAULT: FieldSource = "woman_stated";
const LEGACY_DEFAULT_OVERRIDES: Record<string, FieldSource> = {
  urgency: "worker_observation",
};

/** Who stated a field: stored tag if valid, else the legacy default. */
export function fieldSourceOf(context: CaseContext, key: string): FieldSource {
  const stored = context.field_sources?.[key];
  if (stored === "woman_stated" || stored === "worker_observation") return stored;
  return LEGACY_DEFAULT_OVERRIDES[key] ?? LEGACY_DEFAULT;
}

/** Human-readable value of one context field; null when nothing recorded. */
export function fieldValuePreview(key: string, ctx: CaseContext): string | null {
  switch (key) {
    case "needs":
      return ctx.needs.length ? ctx.needs.join(", ") : null;
    case "languages":
      return ctx.languages.length ? ctx.languages.join(", ") : null;
    case "children":
      return ctx.children ? `${ctx.children.count} child(ren)` : null;
    case "pets":
      if (!ctx.pets) return null;
      return ctx.pets.has_pet
        ? `has pet${ctx.pets.details ? ` (${ctx.pets.details})` : ""}`
        : "no pets";
    case "income":
      return ctx.income
        ? [ctx.income.status, ctx.income.source].filter(Boolean).join(" — ") || null
        : null;
    default: {
      const v = (ctx as unknown as Record<string, unknown>)[key];
      return typeof v === "string" && v.trim() ? v : null;
    }
  }
}

/** Whether a context field carries any value (drives tagging + share UI). */
export function fieldHasValue(key: string, ctx: CaseContext): boolean {
  return fieldValuePreview(key, ctx) !== null;
}
