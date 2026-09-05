/**
 * Phase 7 — source adapters for the existing-service updater.
 * Every adapter normalises what it retrieves into the same SourceSnapshot
 * shape (facts + source URL + evidence type + retrieval time) before the
 * updater compares anything with canonical data.
 *
 * Adapter selection by service.source_url:
 *  - URL present in FIXTURES → deterministic snapshot fixture (demo path,
 *    implementation plan decision #2 — live websites can't break it)
 *  - "https://…" → direct fetch first. If the direct fetch itself fails
 *    (network error / non-200, e.g. a provider site that blocks plain
 *    fetching), fall back to the Bright Data Web Unlocker adapter
 *    (src/lib/brightdata.ts) when BRIGHT_DATA_API_KEY +
 *    BRIGHT_DATA_UNLOCKER_ZONE are configured.
 *
 *    Content from either path is normalised the same way: pages serving the
 *    normalised JSON payload are used as-is; any other content (HTML or
 *    the Web Unlocker's markdown) goes through LLM extraction
 *    (src/lib/page-extraction.ts).
 *
 * Any adapter failure throws — the updater records it as a source failure
 * and never touches canonical data. The unlocker is behind a small
 * injectable boundary (SourceFetchDeps) so the provider can be replaced
 * later without touching the updater.
 */
import { unlockerFetch } from "./brightdata";
import { extractFactsFromPage } from "./page-extraction";
import { normaliseFacts, type EvidenceType, type SourcePayload } from "./source-facts";

export { normaliseFacts } from "./source-facts";
export type { EvidenceType, SourceFact } from "./source-facts";
import type { SourceFact } from "./source-facts";

export type SourceSnapshot = {
  sourceName: string;
  sourceUrl: string;
  evidenceType: EvidenceType;
  retrievedAt: Date;
  facts: SourceFact[];
};

/**
 * Deterministic snapshots of the demo services' official pages
 * (implementation plan decision #2: real sources snapshotted into
 * deterministic fixtures so the demo cannot break). Keyed by the service's
 * stored source_url.
 */
export const FIXTURES: Record<string, { sourceName: string; facts: SourceFact[] }> = {
  // Southside: page unchanged since seed — a run only refreshes freshness.
  "https://southsidedfv.example.org/services": {
    sourceName: "Southside DFV Legal Centre website — snapshot (fixture)",
    facts: [
      { kind: "service_field", field: "phone", value: "(02) 9000 0002" },
      { kind: "attribute", attrType: "need", key: "need", value: "legal" },
      { kind: "attribute", attrType: "need", key: "need", value: "dfv_safety" },
      { kind: "attribute", attrType: "eligibility", key: "visa", value: "no_restrictions" },
      { kind: "attribute", attrType: "cost", key: "cost", value: "free" },
    ],
  },
  // Bright Path: page has changed since seed — phone number differs (candidate),
  // plus a wait time the service never had recorded (new-fact candidate).
  // Everything else just refreshes freshness.
  "https://brightpath.example.org/eligibility": {
    sourceName: "Bright Path website — snapshot (fixture)",
    facts: [
      { kind: "service_field", field: "phone", value: "(02) 9000 1003" },
      { kind: "attribute", attrType: "need", key: "need", value: "financial" },
      { kind: "attribute", attrType: "delivery", key: "format", value: "phone_online" },
      { kind: "attribute", attrType: "eligibility", key: "income", value: "low" },
      { kind: "attribute", attrType: "eligibility", key: "languages", value: "english" },
      { kind: "attribute", attrType: "wait_time", key: "wait_time", value: "1-2 weeks" },
    ],
  },
};

export type FetchedPage = { ok: boolean; status: number; text: string };

/** Injectable boundaries — tests stub these; defaults are the real implementations. */
export type SourceFetchDeps = {
  httpGet?: (url: string) => Promise<FetchedPage>;
  unlocker?: (url: string) => Promise<{ statusCode: number; body: string }>;
  extract?: (content: string, sourceUrl: string) => Promise<{ sourceName: string; facts: SourceFact[] }>;
};

async function directHttpGet(url: string, timeoutMs = 10_000): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalise fetched page content into a snapshot: JSON payloads as-is,
 * anything else through LLM extraction.
 */
async function snapshotFromContent(
  content: string,
  sourceUrl: string,
  evidenceType: EvidenceType,
  deps: SourceFetchDeps,
): Promise<SourceSnapshot> {
  let payload: SourcePayload | null = null;
  try {
    payload = JSON.parse(content) as SourcePayload;
  } catch {
    /* not JSON — normal case for real provider pages */
  }
  if (payload) {
    try {
      return {
        sourceName: payload.sourceName ?? sourceUrl,
        sourceUrl,
        evidenceType,
        retrievedAt: new Date(),
        facts: normaliseFacts(payload, sourceUrl),
      };
    } catch {
      /* JSON but not a normalised payload — fall through to extraction */
    }
  }
  const extracted = await (deps.extract ?? extractFactsFromPage)(content, sourceUrl);
  return {
    sourceName: extracted.sourceName,
    sourceUrl,
    evidenceType,
    retrievedAt: new Date(),
    facts: extracted.facts,
  };
}

/** Fetch the current machine-accessible snapshot for a service. */
export async function fetchSnapshot(serviceUrl: string, deps: SourceFetchDeps = {}): Promise<SourceSnapshot> {
  if (FIXTURES[serviceUrl]) {
    const fixture = FIXTURES[serviceUrl];
    return {
      sourceName: fixture.sourceName,
      sourceUrl: serviceUrl,
      evidenceType: "fixture",
      retrievedAt: new Date(),
      facts: fixture.facts,
    };
  }
  if (!/^https?:\/\//.test(serviceUrl)) {
    throw new Error("no machine-accessible source configured for this service");
  }

  // direct fetch first
  const httpGet = deps.httpGet ?? directHttpGet;
  let page: FetchedPage | null = null;
  let directError: string;
  try {
    page = await httpGet(serviceUrl);
    directError = `HTTP ${page.status}`;
  } catch (err) {
    directError = err instanceof Error ? err.message : String(err);
  }
  if (page?.ok) return snapshotFromContent(page.text, serviceUrl, "direct_fetch", deps);

  // Web Unlocker fallback for provider sites normal fetching can't reach
  const unlocker = deps.unlocker ?? unlockerDefault();
  if (!unlocker) {
    throw new Error(
      `direct fetch of ${serviceUrl} failed (${directError}); Web Unlocker fallback not configured (BRIGHT_DATA_API_KEY / BRIGHT_DATA_UNLOCKER_ZONE)`,
    );
  }
  try {
    const content = await unlocker(serviceUrl);
    return await snapshotFromContent(content.body, serviceUrl, "web_unlocker", deps);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`direct fetch of ${serviceUrl} failed (${directError}); Web Unlocker fallback also failed (${msg})`);
  }
}

/** Default unlocker boundary: the real Bright Data adapter, when configured. */
function unlockerDefault(): SourceFetchDeps["unlocker"] {
  if (!process.env.BRIGHT_DATA_API_KEY || !process.env.BRIGHT_DATA_UNLOCKER_ZONE) return null;
  return (url: string) => unlockerFetch(url);
}
