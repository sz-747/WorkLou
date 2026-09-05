/**
 * Phase 2 — Context extraction.
 * LLM is used ONLY to extract/normalise the worker's rough notes into the
 * structured CaseContext shape (docs/product.md: "The LLM never invents
 * service facts — it only extracts, normalises, and drafts text for human
 * review"). Matching (Phase 3) never uses this module.
 *
 * parseExtraction is a pure function so the mapping is unit-testable
 * without the LLM.
 */
import type { CaseContext } from "../db/schema";

/** Initial needs taxonomy (implementation plan decision #3). */
export const NEEDS_TAXONOMY = [
  "housing_accommodation",
  "dfv_safety",
  "mental_health_counselling",
  "financial",
  "legal",
  "aod",
  "immigration_visa",
  "children_family",
  "health",
  "employment",
  "food_basic_needs",
] as const;

const EXTRACT_SYSTEM_PROMPT = `You extract structured case context from a caseworker's rough appointment notes for a women's support service.
Return ONLY a JSON object (no prose, no markdown fences) with this exact shape:
{
  "needs": string[],            // from this taxonomy ONLY: ${NEEDS_TAXONOMY.join(", ")}
  "suburb": string | null,      // where she stays, e.g. "Waterloo"
  "catchment": string | null,   // broader area if stated, e.g. "Inner South Sydney"
  "children": { "count": number } | null,
  "pets": { "has_pet": boolean, "details": string | null } | null,
  "income": { "status": string | null, "source": string | null } | null, // status e.g. "low"
  "visa": string | null,        // e.g. "bridging_e", "citizen", "none"
  "languages": string[],       // lowercase
  "urgency": "high" | "medium" | "low" | null,
  "safety_preferences": string | null,  // e.g. "No calls to main number"
  "safe_contact_method": string | null, // e.g. "sms", "email"
  "summary": string | null      // one or two factual sentences from the notes only
}
Rules:
- Extract ONLY what the notes state. Use null for anything not mentioned. Never invent or guess.
- needs values must be lowercase snake_case tokens from the taxonomy.
- Keep it factual and brief.`;

function toSnakeCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "") // drop punctuation first (e.g. " / " → space)
    .replace(/[\s_-]+/g, "_");
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => toSnakeCase(String(x))).filter(Boolean);
  if (typeof v === "string")
    return v
      .split(",")
      .map((x) => toSnakeCase(x))
      .filter(Boolean);
  return [];
}

function toStr(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/**
 * Pure: map a raw LLM response (possibly fenced/prose-wrapped) to a
 * normalised CaseContext. Throws on unparseable JSON.
 */
export function parseExtraction(raw: string): CaseContext {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  const data = JSON.parse(text) as Record<string, unknown>;

  let children: CaseContext["children"] = null;
  if (typeof data.children === "number") children = { count: data.children };
  else if (data.children && typeof data.children === "object") {
    const count = Number((data.children as Record<string, unknown>).count);
    if (Number.isFinite(count)) children = { count };
  }

  let pets: CaseContext["pets"] = null;
  if (typeof data.pets === "boolean") pets = { has_pet: data.pets };
  else if (data.pets && typeof data.pets === "object") {
    const p = data.pets as Record<string, unknown>;
    pets = { has_pet: Boolean(p.has_pet), details: toStr(p.details) ?? undefined };
  }

  let income: CaseContext["income"] = null;
  if (typeof data.income === "string") income = { status: toSnakeCase(data.income) };
  else if (data.income && typeof data.income === "object") {
    const i = data.income as Record<string, unknown>;
    income = { status: toStr(i.status), source: toStr(i.source) };
  }

  const urgency = toStr(data.urgency)?.toLowerCase();
  const needs = toStringArray(data.needs);

  return {
    needs,
    suburb: toStr(data.suburb),
    catchment: toStr(data.catchment),
    children,
    pets,
    income,
    visa: toStr(data.visa),
    languages: toStringArray(data.languages),
    urgency: urgency && ["high", "medium", "low"].includes(urgency) ? urgency : null,
    safety_preferences: toStr(data.safety_preferences),
    safe_contact_method: toStr(data.safe_contact_method)
      ? toSnakeCase(data.safe_contact_method)
      : null,
    summary: toStr(data.summary),
  };
}

function chatCompletionsUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

/** Call the configured LLM and return the extracted context + model provenance. */
export async function extractContextFromNotes(
  notes: string,
): Promise<{ context: CaseContext; model: string }> {
  const base = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!base || !apiKey || !model) {
    throw new Error("LLM not configured (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL missing)");
  }

  const res = await fetch(chatCompletionsUrl(base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM_PROMPT },
        { role: "user", content: notes },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM request failed (HTTP ${res.status})`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned no content");

  return { context: parseExtraction(content), model };
}
