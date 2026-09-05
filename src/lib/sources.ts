/**
 * Phase 7A — source adapters for the existing-service updater.
 * Every adapter normalises what it retrieves into the same SourceSnapshot
 * shape (facts + source URL + evidence type + retrieval time) before the
 * updater compares anything with canonical data.
 *
 * Adapter selection is by service.source_url:
 *  - URL present in FIXTURES  → deterministic snapshot fixture (demo path,
 *    per implementation plan decision #2 — live websites can't break it)
 *  - "brightdata:<real url>"  → Bright Data Web Scraper API over plain HTTP
 *    (POST /datasets/v3/scrape, falling back to trigger → poll → download).
 *    Requires BRIGHT_DATA_API_KEY + BRIGHT_DATA_DATASET_ID. No CLI needed.
 *  - "https://…"             → simple direct fetch of an official page that
 *    serves the normalised snapshot JSON shape
 *
 * Any adapter failure throws — the updater records it as a source failure
 * and never touches canonical data.
 */
export type SourceFact =
  | { kind: "service_field"; field: string; value: string }
  | { kind: "attribute"; attrType: string; key: string; value: string };

export type EvidenceType = "fixture" | "direct_fetch" | "bright_data";

export type SourceSnapshot = {
  sourceName: string;
  sourceUrl: string;
  evidenceType: EvidenceType;
  retrievedAt: Date;
  facts: SourceFact[];
};

/** Raw page payload every non-fixture source is expected to serve. */
type SourcePayload = { sourceName?: string; facts?: unknown };

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

function normaliseFacts(payload: SourcePayload, sourceUrl: string): SourceFact[] {
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

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Simple direct fetch of an official page serving the normalised payload. */
async function directFetch(serviceUrl: string): Promise<SourceSnapshot> {
  const payload = (await fetchJson(serviceUrl, {}, 10_000)) as SourcePayload;
  return {
    sourceName: payload.sourceName ?? serviceUrl,
    sourceUrl: serviceUrl,
    evidenceType: "direct_fetch",
    retrievedAt: new Date(),
    facts: normaliseFacts(payload, serviceUrl),
  };
}

/**
 * Bright Data Web Scraper API over plain HTTP (no CLI).
 * Uses the synchronous endpoint when possible; if Bright Data returns a
 * snapshot_id (long job), polls progress then downloads.
 */
async function brightDataScrape(pageUrl: string): Promise<SourceSnapshot> {
  const apiKey = process.env.BRIGHT_DATA_API_KEY;
  const datasetId = process.env.BRIGHT_DATA_DATASET_ID;
  if (!apiKey || !datasetId) {
    throw new Error("Bright Data scrape requested but BRIGHT_DATA_API_KEY / BRIGHT_DATA_DATASET_ID are not configured");
  }
  const auth = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const scrape = (await fetchJson(
    `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${datasetId}&format=json`,
    { method: "POST", headers: auth, body: JSON.stringify([{ url: pageUrl }]) },
    50_000,
  )) as Record<string, unknown>;

  let records = scrape;
  // long job: poll progress until ready, then download the snapshot
  if (typeof scrape.snapshot_id === "string") {
    const snapshotId = scrape.snapshot_id;
    const deadline = Date.now() + 90_000;
    for (;;) {
      await new Promise((r) => setTimeout(r, 10_000));
      const progress = (await fetchJson(
        `https://api.brightdata.com/datasets/v3/progress/${snapshotId}`,
        { headers: auth },
        15_000,
      )) as Record<string, unknown>;
      const status = progress.status;
      if (status === "failed") throw new Error(`Bright Data snapshot ${snapshotId} failed`);
      if (status === "ready") break;
      if (Date.now() > deadline) throw new Error(`Bright Data snapshot ${snapshotId} timed out`);
    }
    records = (await fetchJson(
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
      { headers: auth },
      30_000,
    )) as Record<string, unknown>;
  }

  const list = Array.isArray(records) ? records : [records];
  const payload = (list[0] ?? {}) as SourcePayload;
  return {
    sourceName: payload.sourceName ?? pageUrl,
    sourceUrl: pageUrl,
    evidenceType: "bright_data",
    retrievedAt: new Date(),
    facts: normaliseFacts(payload, pageUrl),
  };
}

/** Fetch the current machine-accessible snapshot for a service. */
export async function fetchSnapshot(serviceUrl: string): Promise<SourceSnapshot> {
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
  if (serviceUrl.startsWith("brightdata:")) return brightDataScrape(serviceUrl.slice("brightdata:".length));
  if (/^https?:\/\//.test(serviceUrl)) return directFetch(serviceUrl);
  throw new Error("no machine-accessible source configured for this service");
}
