/**
 * Phase 7 — Bright Data adapter tests. Verifies BOTH adapters
 * independently, offline, with a stubbed fetch implementation:
 * request shape (unified /request endpoint, Bearer auth, zone, format),
 * response parsing, async/error paths, not-configured behaviour, and the
 * updater's direct-fetch-first → Web Unlocker fallback. No DB usage —
 * run with npm run db:test:brightdata
 */
import { serpSearch, unlockerFetch, type SerpResult } from "../lib/brightdata";
import { fetchSnapshot, type SourceFetchDeps } from "../lib/sources";
import type { SourceSnapshot } from "../lib/sources";

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

/** Stub Response — enough for the adapters (ok/status/text/json). */
class StubResponse {
  ok: boolean;
  status: number;
  body: string;
  constructor(status: number, body: unknown) {
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  async text() {
    return this.body;
  }
  async json() {
    return JSON.parse(this.body);
  }
}

type Captured = { url: string; init: RequestInit };

async function main() {
  console.log("Phase 7 — Bright Data adapter tests (SERP API + Web Unlocker)");

  const saved = { ...process.env };
  process.env.BRIGHT_DATA_API_KEY = "test-api-key";
  process.env.BRIGHT_DATA_SERP_ZONE = "test_serp_zone";
  process.env.BRIGHT_DATA_UNLOCKER_ZONE = "test_unlocker_zone";
  const restore = () => {
    delete process.env.BRIGHT_DATA_API_KEY;
    delete process.env.BRIGHT_DATA_SERP_ZONE;
    delete process.env.BRIGHT_DATA_UNLOCKER_ZONE;
    Object.assign(process.env, saved);
  };

  // ---------- Web Unlocker adapter ----------
  console.log("[UNLOCKER] request shape + response parsing");

  let captured: Captured | null = null;
  const captureFetch = (body: unknown, status = 200) => async (url: string, init: RequestInit) => {
    captured = { url, init };
    return new StubResponse(status, body);
  };

  const unlocked = await unlockerFetch("https://provider.example.org/services", {
    fetchImpl: captureFetch({ status_code: 200, body: "# Community legal centre\nFree advice…" }),
  });
  const body = JSON.parse(String(captured?.init.body));
  assert(
    "unified endpoint, Bearer auth, unlocker zone, markdown data format requested",
    captured?.url === "https://api.brightdata.com/request" &&
      (captured?.init.headers as Record<string, string>).Authorization === "Bearer test-api-key" &&
      body.zone === "test_unlocker_zone" &&
      body.url === "https://provider.example.org/services" &&
      body.format === "raw" &&
      body.data_format === "markdown",
  );
  assert("content + status returned", unlocked.statusCode === 200 && unlocked.body.includes("Community legal centre"));

  try {
    await unlockerFetch("https://provider.example.org/blocked", {
      fetchImpl: captureFetch({ status_code: 403, body: "" }),
    });
    assert("empty unlocker body throws", false);
  } catch (err) {
    assert("empty unlocker body throws with the URL and status", /no content.*blocked.*403/.test((err as Error).message));
  }

  try {
    await unlockerFetch("https://provider.example.org/x", {
      fetchImpl: async () => new StubResponse(401, "Unauthorized"),
    });
    assert("API HTTP error throws", false);
  } catch (err) {
    assert("API HTTP error surfaces status", /Bright Data HTTP 401/.test((err as Error).message));
  }

  delete process.env.BRIGHT_DATA_UNLOCKER_ZONE;
  try {
    await unlockerFetch("https://provider.example.org/x", { fetchImpl: captureFetch({ body: "x" }) });
    assert("not-configured throws", false);
  } catch (err) {
    assert(
      "missing zone reported cleanly (no crash, no BRIGHT_DATA_DATASET_ID mention)",
      /Web Unlocker not configured/.test((err as Error).message) &&
        !/DATASET/i.test((err as Error).message),
    );
  }
  process.env.BRIGHT_DATA_UNLOCKER_ZONE = "test_unlocker_zone";

  // ---------- SERP API adapter ----------
  console.log("[SERP] request shape + organic parsing");

  captured = null;
  const organic = {
    organic: [
      { pos: 1, title: "Women's Housing Company", link: "https://womenshousing.example.org/", snippet: "Housing support for women" },
      { pos: 2, title: "Community Legal Centre", link: "https://clc.example.org/services", snippet: "Free legal help" },
      { pos: 3, title: "no link field", snippet: "junk" },
    ],
  };
  const results: SerpResult[] = await serpSearch("women's housing Sydney", {
    fetchImpl: captureFetch(organic),
  });
  const serpBody = JSON.parse(String(captured?.init.body));
  assert(
    "google search URL built from the query with au/en, SERP zone, parsed_light format",
    captured?.url === "https://api.brightdata.com/request" &&
      serpBody.zone === "test_serp_zone" &&
      serpBody.format === "raw" &&
      serpBody.data_format === "parsed_light" &&
      decodeURIComponent(serpBody.url).includes("q=women's housing Sydney") &&
      serpBody.url.includes("gl=au") &&
      serpBody.url.includes("hl=en"),
  );
  assert(
    "organic results parsed, junk entries without link/title dropped",
    results.length === 2 &&
      results[0].url === "https://womenshousing.example.org/" &&
      results[0].title === "Women's Housing Company" &&
      results[0].snippet === "Housing support for women",
  );

  try {
    await serpSearch("nothing here", { fetchImpl: captureFetch({ organic: [] }) });
    assert("no organic results throws", false);
  } catch (err) {
    assert("no organic results reported cleanly", /no organic results/.test((err as Error).message));
  }

  delete process.env.BRIGHT_DATA_SERP_ZONE;
  try {
    await serpSearch("q", { fetchImpl: captureFetch(organic) });
    assert("not-configured throws", false);
  } catch (err) {
    assert("missing SERP zone reported cleanly", /SERP API not configured/.test((err as Error).message));
  }
  process.env.BRIGHT_DATA_SERP_ZONE = "test_serp_zone";

  // ---------- updater adapter flow: direct fetch first, Web Unlocker fallback ----------
  console.log("[SOURCES] direct fetch first → Web Unlocker fallback");

  const payload = JSON.stringify({ sourceName: "Provider", facts: [{ kind: "service_field", field: "phone", value: "02 1111" }] });
  let unlockerCalls = 0;
  const deps: SourceFetchDeps = {
    httpGet: async () => ({ ok: true, status: 200, text: payload }),
    unlocker: async () => {
      unlockerCalls++;
      return { statusCode: 200, body: "should not be called" };
    },
    extract: async () => {
      throw new Error("extract should not be called for a JSON payload");
    },
  };
  const direct: SourceSnapshot = await fetchSnapshot("https://provider.example.org/payload", deps);
  assert(
    "direct fetch used as-is for JSON payloads (no unlocker, no LLM)",
    direct.evidenceType === "direct_fetch" && unlockerCalls === 0 && direct.facts[0].value === "02 1111",
  );

  let extractCalls = 0;
  const fallbackDeps: SourceFetchDeps = {
    httpGet: async () => {
      throw new Error("network blocked");
    },
    unlocker: async (url) => {
      unlockerCalls++;
      return { statusCode: 200, body: `# markdown page for ${url}` };
    },
    extract: async (content, url) => {
      extractCalls++;
      return {
        sourceName: "Extracted provider",
        facts: [
          { kind: "service_field", field: "name", value: "Extracted provider" },
          { kind: "attribute", attrType: "need", key: "need", value: "legal" },
        ],
      };
    },
  };
  const unlockedSnapshot: SourceSnapshot = await fetchSnapshot("https://provider.example.org/blocked", fallbackDeps);
  assert(
    "failed direct fetch falls back to Web Unlocker + LLM normalisation with web_unlocker provenance",
    unlockedSnapshot.evidenceType === "web_unlocker" &&
      unlockerCalls === 1 &&
      extractCalls === 1 &&
      unlockedSnapshot.facts.some((f) => f.kind === "attribute" && f.value === "legal"),
  );

  try {
    await fetchSnapshot("https://provider.example.org/403", {
      httpGet: async () => ({ ok: false, status: 403, text: "Forbidden" }),
      unlocker: async () => {
        throw new Error("unlocker also down");
      },
    });
    assert("both paths failing throws", false);
  } catch (err) {
    assert(
      "both paths failing → combined error mentions direct fetch + unlocker",
      /HTTP 403/.test((err as Error).message) && /Web Unlocker fallback also failed/.test((err as Error).message),
    );
  }

  // no unlocker configured + direct fails → clear message, no silent skip
  delete process.env.BRIGHT_DATA_UNLOCKER_ZONE; // simulate "adapter not configured"
  try {
    await fetchSnapshot("https://provider.example.org/still-blocked", {
      httpGet: async () => ({ ok: false, status: 403, text: "" }),
      unlocker: undefined,
    });
    assert("fallback not configured throws", false);
  } catch (err) {
    assert(
      "fallback not configured → direct failure preserved with setup hint",
      /HTTP 403/.test((err as Error).message) && /BRIGHT_DATA_UNLOCKER_ZONE/.test((err as Error).message),
    );
  }
  process.env.BRIGHT_DATA_UNLOCKER_ZONE = "test_unlocker_zone";

  const fixtureSnapshot = await fetchSnapshot("https://brightpath.example.org/eligibility");
  assert("fixture adapter untouched by the rework", fixtureSnapshot.evidenceType === "fixture");

  restore();
  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
