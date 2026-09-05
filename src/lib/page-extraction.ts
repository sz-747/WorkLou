/**
 * Phase 7 — LLM normalisation of fetched provider pages.
 * Raw page content (HTML etc.) from a direct fetch is turned into the same
 * normalised SourceFact[] shape every
 * other adapter produces. Uses the same LLM configuration as the worker
 * stages (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL). Only facts the page
 * actually states may be extracted — the prompt forbids invention and the
 * output is validated by the shared normaliser.
 */
import { chatCompletionsUrl } from "./extraction";
import { normaliseFacts, type SourceFact } from "./source-facts";

const SYSTEM_PROMPT = `You extract structured facts about community support services from a provider organisation's web page.

Return STRICT JSON only, shaped as:
{"sourceName": "<organisation/page name>", "facts": [
  {"kind": "service_field", "field": "name"|"phone"|"description", "value": "<string>"},
  {"kind": "attribute", "attrType": "<one of: need|eligibility|cost|wait_time|delivery>", "key": "<string>", "value": "<string>"}
]}

Rules:
- Include a fact ONLY if the page explicitly states it. Never invent or guess values.
- need keys come from this taxonomy: housing_accommodation, dfv_safety, mental_health, financial, legal, aod, immigration, children_family, health, employment, food. Use key "need" for each need the service addresses.
- Common eligibility keys: pets (welcome|not_allowed|case_by_case), visa (no_restrictions|citizens_only|...), income, languages. Use key "languages" once per language.
- cost: key "cost", value free|low_cost|subsidised|... ; wait_time: key "wait_time" ; delivery: key "format", value in_person|phone_online|online_only.
- service_field phone should include area code as shown on the page.
- If the page is not a community-service page or states nothing usable, return {"sourceName": "", "facts": []}.`;

export async function extractFactsFromPage(
  content: string,
  sourceUrl: string,
): Promise<{ sourceName: string; facts: SourceFact[] }> {
  const base = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!base || !apiKey || !model) {
    throw new Error(
      "page fetched but LLM not configured to normalise it (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL missing)",
    );
  }

  const res = await fetch(chatCompletionsUrl(base), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: content.slice(0, 20_000) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM page extraction failed (HTTP ${res.status})`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("LLM returned no content for page extraction");

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("LLM page extraction returned no JSON object");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as {
    sourceName?: unknown;
    facts?: unknown;
  };
  const facts = normaliseFacts({ facts: parsed.facts }, sourceUrl); // throws if nothing usable
  return {
    sourceName: typeof parsed.sourceName === "string" && parsed.sourceName.trim() ? parsed.sourceName : sourceUrl,
    facts,
  };
}
