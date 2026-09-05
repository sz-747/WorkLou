/**
 * Phase 7 — Bright Data adapter tests. Verifies the SERP adapter offline,
 * with a stubbed fetch implementation: request shape (unified /request
 * endpoint, Bearer auth, zone, format), response parsing, async/error
 * paths, not-configured behaviour, and the source-adapter flow
 * (fixture → direct fetch, JSON payload fast path, LLM-extraction path,
 * failed fetch → source failure). No DB usage — run with
 * npm run db:test:brightdata
 */
import { serpSearch, type SerpResult } from "../lib/brightdata";
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

/** Stub Response — enough for the adapter (ok/status/text/json). */
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
  console.log("Phase 7 — Bright Data adapter tests (SERP API)");

  const saved = { ...process.env };
  process.env.BRIGHT_DATA_API_KEY = "test-api-key";
  process.env.BRIGHT_DATA_SERP_ZONE = "test_serp_zone";
  const restore = () => {
    delete process.env.BRIGHT_DATA_API_KEY;
    delete process.env.BRIGHT_DATA_SERP_ZONE;
    Object.assign(process.env, saved);
  };

  let captured: Captured | null = null;
  const captureFetch = (body: unknown, status = 200) => async (url: string, init: RequestInit) => {
    captured = { url, init };
    return new StubResponse(status, body);
  };

  // ---------- SERP API adapter ----------
  console.log("[SERP] request shape + organic parsing");

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

  try {
    await serpSearch("q", { fetchImpl: async () => new StubResponse(401, "Unauthorized") });
    assert("API HTTP error throws", false);
  } catch (err) {
    assert("API HTTP error surfaces status", /Bright Data HTTP 401/.test((err as Error).message));
  }

  delete process.env.BRIGHT_DATA_SERP_ZONE;
  try {
    await serpSearch("q", { fetchImpl: captureFetch(organic) });
    assert("not-configured throws", false);
  } catch (err) {
    assert("missing SERP zone reported cleanly", /SERP API not configured/.test((err as Error).message));
  }
  process.env.BRIGHT_DATA_SERP_ZONE = "test_serp_zone";

  // ---------- source adapter flow: fixture + direct fetch ----------
  console.log("[SOURCES] fixture + direct fetch (JSON fast path, LLM path, failure)");

  const payload = JSON.stringify({ sourceName: "Provider", facts: [{ kind: "service_field", field: "phone", value: "02 1111" }] });
  const deps: SourceFetchDeps = {
    httpGet: async () => ({ ok: true, status: 200, text: payload }),
    extract: async () => {
      throw new Error("extract should not be called for a JSON payload");
    },
  };
  const direct: SourceSnapshot = await fetchSnapshot("https://provider.example.org/payload", deps);
  assert(
    "direct fetch used as-is for JSON payloads (no LLM)",
    direct.evidenceType === "direct_fetch" && direct.facts[0].value === "02 1111",
  );

  let extractCalls = 0;
  const htmlDeps: SourceFetchDeps = {
    httpGet: async () => ({ ok: true, status: 200, text: "<html>provider page</html>" }),
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
  const extractedSnapshot: SourceSnapshot = await fetchSnapshot("https://provider.example.org/page", htmlDeps);
  assert(
    "non-JSON page content goes through LLM normalisation with direct_fetch provenance",
    extractedSnapshot.evidenceType === "direct_fetch" &&
      extractCalls === 1 &&
      extractedSnapshot.facts.some((f) => f.kind === "attribute" && f.value === "legal"),
  );

  try {
    await fetchSnapshot("https://provider.example.org/403", {
      httpGet: async () => ({ ok: false, status: 403, text: "Forbidden" }),
    });
    assert("failed direct fetch throws", false);
  } catch (err) {
    assert(
      "failed direct fetch → clear source failure, no fallback fetcher involved",
      /direct fetch of https:\/\/provider\.example\.org\/403 failed \(HTTP 403\)/.test((err as Error).message) &&
        !/Unlocker/i.test((err as Error).message),
    );
  }

  try {
    await fetchSnapshot("https://provider.example.org/blocked", {
      httpGet: async () => {
        throw new Error("network blocked");
      },
    });
    assert("network error throws", false);
  } catch (err) {
    assert(
      "network error during direct fetch → source failure with the error message",
      /direct fetch of https:\/\/provider\.example\.org\/blocked failed \(network blocked\)/.test(
        (err as Error).message,
      ),
    );
  }

  const fixtureSnapshot = await fetchSnapshot("https://brightpath.example.org/eligibility");
  assert("fixture adapter untouched", fixtureSnapshot.evidenceType === "fixture");

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
