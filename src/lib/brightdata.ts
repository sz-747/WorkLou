/**
 * Phase 7 — Bright Data REST adapters.
 * Two small, replaceable adapters over Bright Data's unified request
 * endpoint (POST https://api.brightdata.com/request, Bearer auth):
 *
 *  - serpSearch()     — SERP API: google search results for discovering
 *                       NEW community services (Phase 7B discovery).
 *  - unlockerFetch()  — Web Unlocker API: current content of an arbitrary
 *                       provider page, for when normal direct fetching is
 *                       insufficient (bot-blocked sites etc.).
 *
 * There is deliberately NO dependency on the Web Scraper Dataset API or
 * BRIGHT_DATA_DATASET_ID. Both adapters are plain functions over an
 * injectable fetch implementation, so they are unit-testable offline and
 * the whole provider can be swapped later without touching callers.
 *
 * Required env (see .base44/environment.json):
 *  - BRIGHT_DATA_API_KEY       — API token (both adapters)
 *  - BRIGHT_DATA_SERP_ZONE     — SERP API zone name (discovery)
 *  - BRIGHT_DATA_UNLOCKER_ZONE — Web Unlocker zone name (content retrieval)
 */

const API_URL = "https://api.brightdata.com/request";

export type SerpResult = {
  position: number;
  title: string;
  url: string;
  snippet: string | null;
};

export type UnlockerContent = { statusCode: number; body: string };

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
type AdapterDeps = { fetchImpl?: FetchLike; timeoutMs?: number };

async function brightDataRequest(
  payload: Record<string, unknown>,
  { fetchImpl = fetch, timeoutMs = 90_000 }: AdapterDeps,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BRIGHT_DATA_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`Bright Data HTTP ${res.status}${text ? `: ${text}` : ""}`);
    }
    return (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Web Unlocker API — retrieve the current content of an arbitrary page
 * (returned as markdown, ideal for downstream LLM normalisation).
 */
export async function unlockerFetch(pageUrl: string, deps: AdapterDeps = {}): Promise<UnlockerContent> {
  const zone = process.env.BRIGHT_DATA_UNLOCKER_ZONE;
  if (!process.env.BRIGHT_DATA_API_KEY || !zone) {
    throw new Error(
      "Bright Data Web Unlocker not configured — set BRIGHT_DATA_API_KEY and BRIGHT_DATA_UNLOCKER_ZONE",
    );
  }
  const data = await brightDataRequest(
    { zone, url: pageUrl, format: "raw", data_format: "markdown" },
    deps,
  );
  const body = typeof data.body === "string" ? data.body : "";
  if (!body.trim()) {
    throw new Error(`Web Unlocker returned no content for ${pageUrl} (status ${String(data.status_code)})`);
  }
  return { statusCode: typeof data.status_code === "number" ? data.status_code : 200, body };
}

/**
 * SERP API — google search results for a query (parsed organic results).
 */
export async function serpSearch(
  query: string,
  { country = "au", language = "en", ...deps }: AdapterDeps & { country?: string; language?: string } = {},
): Promise<SerpResult[]> {
  const zone = process.env.BRIGHT_DATA_SERP_ZONE;
  if (!process.env.BRIGHT_DATA_API_KEY || !zone) {
    throw new Error(
      "Bright Data SERP API not configured — set BRIGHT_DATA_API_KEY and BRIGHT_DATA_SERP_ZONE",
    );
  }
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=${country}&hl=${language}`;
  // parsed_light returns just the top-10 organic results as JSON
  const data = await brightDataRequest(
    { zone, url: searchUrl, format: "raw", data_format: "parsed_light" },
    deps,
  );
  const organic = Array.isArray(data.organic) ? (data.organic as Record<string, unknown>[]) : [];
  const results = organic
    .filter((r) => typeof r.link === "string" && typeof r.title === "string")
    .map((r, i) => ({
      position: typeof r.pos === "number" ? r.pos : i + 1,
      title: r.title as string,
      url: r.link as string,
      snippet: typeof r.snippet === "string" ? r.snippet : null,
    }));
  if (results.length === 0) {
    throw new Error(`SERP API returned no organic results for "${query}"`);
  }
  return results;
}
