/**
 * Phase 7 — shared source-fact primitives. Imported by the source adapters
 * (sources.ts) and the LLM page normaliser (page-extraction.ts) so both
 * produce/validate the exact same fact shape without an import cycle.
 */
export type SourceFact =
  | { kind: "service_field"; field: string; value: string }
  | { kind: "attribute"; attrType: string; key: string; value: string };

export type EvidenceType = "fixture" | "direct_fetch" | "web_unlocker";

/** Raw page payload a machine-accessible source may serve directly. */
export type SourcePayload = { sourceName?: string; facts?: unknown };

/** Validate + trim a raw facts payload into SourceFact[]. Throws when nothing usable. */
export function normaliseFacts(payload: SourcePayload, sourceUrl: string): SourceFact[] {
  if (!Array.isArray(payload.facts)) {
    throw new Error(`source at ${sourceUrl} did not return a normalised facts payload`);
  }
  const facts: SourceFact[] = [];
  for (const f of payload.facts) {
    if (!f || typeof f !== "object") continue;
    const cand = f as Partial<SourceFact>;
    if (cand.kind === "service_field" && typeof cand.field === "string" && typeof cand.value === "string") {
      facts.push({ kind: "service_field", field: cand.field, value: cand.value });
    } else if (
      cand.kind === "attribute" &&
      typeof cand.attrType === "string" &&
      typeof cand.key === "string" &&
      typeof cand.value === "string"
    ) {
      facts.push({ kind: "attribute", attrType: cand.attrType, key: cand.key, value: cand.value });
    }
  }
  if (facts.length === 0) {
    throw new Error(`source at ${sourceUrl} returned no usable facts`);
  }
  return facts;
}
