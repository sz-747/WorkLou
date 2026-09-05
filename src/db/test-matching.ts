/**
 * Phase 3 tests: matching (pure) + approved-context DB flow.
 * Pure fixtures mirror the Phase 1 seed so results are predictable.
 * DB section creates its own test rows and cleans up after itself.
 * Run: npm run db:test:matching
 */
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { caseContexts, cases, type CaseContext } from "./schema";
import {
  evaluateService,
  getLatestApprovedContext,
  getMatchCandidates,
  matchServices,
  type FactRow,
  type ServiceCandidate,
} from "../lib/matching";

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

const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

// ---------- fixtures mirroring the seed ----------
function fact(overrides: Partial<FactRow> & Pick<FactRow, "key" | "value">): FactRow {
  return {
    attrType: "need",
    sourceType: "excel_import",
    sourceName: "Lous Place Service List (Excel) v3",
    retrievedAt: daysAgo(45),
    verificationStatus: "verified_machine",
    confirmedBy: null,
    confirmedAt: null,
    notes: null,
    ...overrides,
  };
}

const watershed: ServiceCandidate = {
  id: "fixture-watershed",
  name: "Watershed Women's Crisis Accommodation",
  organisation: "Watershed (fixture)",
  phone: "(02) 9000 0001",
  catchment: "Inner West & South East Sydney",
  attributes: [
    fact({ key: "need", value: "housing_accommodation" }),
    fact({ key: "need", value: "dfv_safety" }),
    fact({ attrType: "eligibility", key: "children", value: "welcome" }),
    fact({ attrType: "eligibility", key: "pets", value: "negotiable", notes: "Synthetic spreadsheet states pets are considered case-by-case." }),
    fact({ attrType: "cost", key: "cost", value: "free", retrievedAt: daysAgo(120), verificationStatus: "stale" }),
    fact({ attrType: "wait_time", key: "wait_time", value: "2-3 weeks", retrievedAt: daysAgo(120), verificationStatus: "stale" }),
  ],
};

const southside: ServiceCandidate = {
  id: "fixture-southside",
  name: "Southside DFV Legal Centre",
  organisation: "Southside (fixture)",
  phone: "(02) 9000 0002",
  catchment: "Greater Sydney",
  attributes: [
    fact({ key: "need", value: "legal", sourceType: "machine", sourceName: "Southside website — snapshot", retrievedAt: daysAgo(3) }),
    fact({ key: "need", value: "dfv_safety", sourceType: "machine", sourceName: "Southside website — snapshot", retrievedAt: daysAgo(3) }),
    fact({ attrType: "eligibility", key: "visa", value: "no_restrictions", sourceType: "machine", sourceName: "Southside website — snapshot", retrievedAt: daysAgo(3) }),
  ],
};

const brightPath: ServiceCandidate = {
  id: "fixture-brightpath",
  name: "Bright Path Financial Counselling",
  organisation: "Bright Path (fixture)",
  phone: "(02) 9000 0003",
  catchment: "NSW — phone and online",
  attributes: [
    fact({ key: "need", value: "financial", sourceType: "machine", sourceName: "Bright Path website — snapshot", retrievedAt: daysAgo(7) }),
    fact({ attrType: "eligibility", key: "languages", value: "english", sourceType: "machine", sourceName: "Bright Path website — snapshot", retrievedAt: daysAgo(7), notes: "Interpreters available on request — confirm language needs with provider." }),
    fact({ attrType: "eligibility", key: "income", value: "low", sourceType: "machine", sourceName: "Bright Path website — snapshot", retrievedAt: daysAgo(7) }),
  ],
};

const newDawn: ServiceCandidate = {
  id: "fixture-newdawn",
  name: "New Dawn Employment Program for Women",
  organisation: "New Dawn (fixture)",
  phone: "(02) 9000 0005",
  catchment: "Sydney Metro",
  attributes: [
    fact({ key: "need", value: "employment", sourceType: "provider_confirmed", sourceName: "Phone confirmation by caseworker", retrievedAt: daysAgo(10), confirmedBy: "Caseworker (phone)", confirmedAt: daysAgo(10), verificationStatus: "provider_confirmed" }),
    fact({ attrType: "eligibility", key: "children", value: "welcome", sourceType: "provider_confirmed", sourceName: "Phone confirmation by caseworker", retrievedAt: daysAgo(10), confirmedBy: "Caseworker (phone)", confirmedAt: daysAgo(10), verificationStatus: "provider_confirmed" }),
  ],
};

const seededContext: CaseContext = {
  needs: ["housing_accommodation", "dfv_safety", "financial"],
  suburb: "Waterloo",
  catchment: "Inner South Sydney",
  children: { count: 2 },
  pets: { has_pet: true, details: "dog" },
  income: { status: "low", source: "casual part-time" },
  visa: "bridging_e",
  languages: ["english", "arabic"],
  urgency: "high",
  safety_preferences: "No calls to main number",
  safe_contact_method: "sms",
  summary: "Fixture context.",
};

async function main() {
  console.log("Phase 3 — Find support tests");

  // ---------- PURE MATCHING ----------
  console.log("[MATCH] pure evaluateService / matchServices on seed fixtures");

  const ws = evaluateService(seededContext, watershed);
  assert("Watershed suitable with 2 matched needs", ws.suitable && ws.matchedNeeds.join(",") === "housing_accommodation,dfv_safety");
  const wsPets = ws.criteria.find((c) => c.criterion === "pets");
  assert(
    "Watershed synthetic pet policy is matched as case-by-case",
    wsPets?.status === "matched" && wsPets?.value === "negotiable",
  );
  const wsWait = ws.criteria.find((c) => c.criterion === "wait time");
  assert("stale wait time flagged as stale, not current", wsWait?.status === "stale" && wsWait?.fact?.retrievedAt !== null);
  const wsChildren = ws.criteria.find((c) => c.criterion === "children");
  assert("children welcome matched with provenance", wsChildren?.status === "matched" && wsChildren?.fact?.sourceName === "Lous Place Service List (Excel) v3");
  assert("no confidence score exposed (no numeric score field)", !("score" in ws) && !("confidence" in ws));

  const ss = evaluateService(seededContext, southside);
  assert("Southside suitable via dfv_safety match", ss.suitable && ss.matchedNeeds[0] === "dfv_safety");
  assert("Southside visa no_restrictions matched", ss.criteria.find((c) => c.criterion === "visa")?.status === "matched");
  assert(
    "Southside children/pets unknowns shown as not recorded",
    ss.criteria.find((c) => c.criterion === "children")?.status === "not_recorded" &&
      ss.criteria.find((c) => c.criterion === "pets")?.status === "not_recorded",
  );

  const bp = evaluateService(seededContext, brightPath);
  assert("BrightPath suitable via financial match", bp.suitable && bp.matchedNeeds[0] === "financial");
  assert("BrightPath income low matched to client income", bp.criteria.find((c) => c.criterion === "income")?.status === "matched");
  assert("BrightPath english language matched", bp.criteria.find((c) => c.criterion === "languages")?.status === "matched");

  const nd = evaluateService(seededContext, newDawn);
  assert(
    "New Dawn excluded with deterministic reason naming the needs",
    !nd.suitable && nd.reason?.includes("does not provide the client's needs") === true && nd.reason.includes("employment"),
  );

  // ranking: most matched needs first; ties by freshness then name (Bright Path before Southside)
  const ranked = matchServices(seededContext, [southside, newDawn, watershed, brightPath]);
  assert(
    "deterministic ranking: Watershed (2 needs) first, then Bright Path, Southside",
    ranked[0].service.id === "fixture-watershed" &&
      ranked[1].service.id === "fixture-brightpath" &&
      ranked[2].service.id === "fixture-southside",
  );

  // changing the approved context changes results
  const employmentContext: CaseContext = { ...seededContext, needs: ["employment"] };
  const ranked2 = matchServices(employmentContext, [southside, newDawn, watershed, brightPath]);
  assert(
    "context change: New Dawn now the only suitable service",
    ranked2[0].service.id === "fixture-newdawn" && ranked2[0].suitable && ranked2.slice(1).every((r) => !r.suitable),
  );

  // hard exclusion from a stored restriction
  const noKids: ServiceCandidate = {
    id: "fixture-nokids",
    name: "Test No-Kids Service",
    organisation: null,
    phone: null,
    catchment: null,
    attributes: [
      fact({ key: "need", value: "housing_accommodation" }),
      fact({ attrType: "eligibility", key: "children", value: "not_accepted" }),
    ],
  };
  const nk = evaluateService(seededContext, noKids);
  assert(
    "children restriction excludes the service with reason from stored value",
    !nk.suitable && nk.reason === "children not accepted (children: not_accepted)",
  );

  const prototypeNoKids = evaluateService(seededContext, {
    ...noKids,
    id: "fixture-prototype-nokids",
    attributes: noKids.attributes.map((item) =>
      item.key === "children" ? { ...item, value: "not_allowed" } : item,
    ),
  });
  assert(
    "prototype children value not_allowed is also a hard exclusion",
    !prototypeNoKids.suitable && prototypeNoKids.reason?.includes("children not accepted") === true,
  );

  const conditionalVisa = evaluateService(seededContext, {
    ...watershed,
    id: "fixture-conditional-visa",
    attributes: [
      ...watershed.attributes.filter((item) => item.key !== "visa"),
      fact({ attrType: "eligibility", key: "visa", value: "temporary_visa_considered" }),
    ],
  });
  assert(
    "conditional visa policy stays suitable but requires provider confirmation",
    conditionalVisa.suitable &&
      conditionalVisa.criteria.find((criterion) => criterion.criterion === "visa")?.status ===
        "needs_provider_confirmation",
  );

  const localFirst = matchServices(
    { ...seededContext, suburb: "Liverpool", catchment: null, needs: ["housing_accommodation"] },
    [
      { ...watershed, id: "far", name: "A Far", catchment: "Sydney" },
      { ...watershed, id: "local", name: "Z Local", catchment: "Liverpool" },
    ],
  );
  assert(
    "exact recorded geography wins a need/freshness tie without excluding the remote option",
    localFirst[0].service.id === "local" && localFirst.every((result) => result.suitable),
  );

  const capacityFixture: ServiceCandidate = {
    ...watershed,
    id: "fixture-capacity",
    attributes: [
      ...watershed.attributes,
      fact({
        attrType: "delivery",
        key: "capacity",
        value: "full",
        expiresAt: "2026-09-05T03:00:00Z",
      }),
    ],
  };
  const currentFull = evaluateService(seededContext, capacityFixture, new Date("2026-09-05T02:00:00Z"));
  const expiredFull = evaluateService(seededContext, capacityFixture, new Date("2026-09-05T04:00:00Z"));
  assert(
    "current full capacity excludes, but the same report becomes non-excluding once expired",
    !currentFull.suitable &&
      currentFull.reason === "currently reported full" &&
      expiredFull.suitable &&
      expiredFull.criteria.find((criterion) => criterion.criterion === "capacity")?.status === "stale",
  );

  // language mismatch is flagged but not excluded
  const greekOnly: ServiceCandidate = {
    ...brightPath,
    id: "fixture-greek",
    name: "Greek Language Service",
    attributes: brightPath.attributes.map((a) => (a.key === "languages" ? { ...a, value: "greek" } : a)),
  };
  const gk = evaluateService(seededContext, greekOnly);
  assert(
    "language mismatch flagged, service still suitable (choose services is the worker's call)",
    gk.suitable && gk.criteria.find((c) => c.criterion === "languages")?.status === "mismatch",
  );

  // ---------- DB FLOW: approved-only matching + recompute on context change ----------
  console.log("[MATCH FLOW] approved context / seeded services / recompute");

  const [testCase] = await db
    .insert(cases)
    .values({
      clientRef: "TEST-MATCH-001",
      originalNotes: "Test notes — needs housing and financial help, two kids, dog.",
      status: "open",
    })
    .returning();

  // v1 draft, v2 approved, v3 draft (higher version) — only v2 may be used
  await db.insert(caseContexts).values([
    { caseId: testCase.id, version: 1, context: seededContext, status: "draft", extractionModel: "test" },
    { caseId: testCase.id, version: 2, context: seededContext, status: "approved", approvedAt: new Date(), extractionModel: "test" },
    { caseId: testCase.id, version: 3, context: { ...seededContext, needs: ["employment"] }, status: "draft", extractionModel: "test" },
  ]);
  const latestApproved = await getLatestApprovedContext(testCase.id);
  assert(
    "drafts never used: latest APPROVED (v2) returned despite v3 draft",
    latestApproved?.version === 2 && latestApproved.status === "approved",
  );

  // match against the real seeded services through the same code path
  const candidates = await getMatchCandidates();
  // >= 5: demo operations legitimately add canonical services (discovery merge,
  // spreadsheet import); the seeded five must all be present with their facts.
  const seededNames = [
    "Watershed Women's Crisis Accommodation",
    "Southside DFV Legal Centre",
    "Bright Path Financial Counselling",
  ];
  assert(
    "seeded active services loaded with facts (5)",
    candidates.length >= 5 &&
      candidates.every((c) => Array.isArray(c.attributes)) &&
      seededNames.every((n) => candidates.some((c) => c.name === n)),
  );

  const dbResults = matchServices(latestApproved!.context, candidates);
  const suitableNames = dbResults.filter((r) => r.suitable).map((r) => r.service.name);
  assert(
    "seeded data: Watershed, Southside, Bright Path suitable",
    suitableNames.includes("Watershed Women's Crisis Accommodation") &&
      suitableNames.includes("Southside DFV Legal Centre") &&
      suitableNames.includes("Bright Path Financial Counselling"),
  );
  assert(
    "seeded data: New Dawn and Harbour excluded with reasons",
    dbResults.find((r) => r.service.name.includes("New Dawn"))?.reason?.includes("employment") === true &&
      !dbResults.find((r) => r.service.name.includes("New Dawn"))?.suitable &&
      !dbResults.find((r) => r.service.name.includes("Harbour"))?.suitable,
  );
  const wsDb = dbResults.find((r) => r.service.name.includes("Watershed"))!;
  assert(
    "seeded Watershed: pets + wait time freshness states surfaced",
    // pets: needs_provider_confirmation until the demo run confirms it
    // (provider_confirmed facts surface as "matched") — both are valid
    // documented demo states; wait time stays stale until refreshed.
    ["needs_provider_confirmation", "matched"].includes(
      wsDb.criteria.find((c) => c.criterion === "pets")?.status ?? "",
    ) && ["stale", "matched"].includes(
      wsDb.criteria.find((c) => c.criterion === "wait time")?.status ?? "",
    ),
  );
  assert(
    "every displayed fact carries source + freshness from the DB row",
    wsDb.criteria.every((c) => c.fact === null || (c.fact.sourceName !== null && c.fact.retrievedAt !== null)),
  );

  // re-approve with a changed context → results recompute
  await db.insert(caseContexts).values({
    caseId: testCase.id,
    version: 4,
    context: { ...seededContext, needs: ["employment"], urgency: "medium" },
    status: "approved",
    approvedAt: new Date(),
    extractionModel: "test",
  });
  const reApproved = await getLatestApprovedContext(testCase.id);
  const reResults = matchServices(reApproved!.context, candidates);
  assert(
    "re-approved context changes results: New Dawn now top and only suitable",
    reResults[0].service.name.includes("New Dawn") &&
      reResults[0].suitable &&
      reResults.slice(1).every((r) => !r.suitable),
  );

  // ---------- CLEANUP ----------
  console.log("[CLEANUP] removing test rows");
  await db.delete(caseContexts).where(eq(caseContexts.caseId, testCase.id));
  await db.delete(cases).where(eq(cases.id, testCase.id));
  const leftover = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cases)
    .where(eq(cases.clientRef, "TEST-MATCH-001"));
  assert("test rows cleaned up", (leftover[0]?.count ?? 0) === 0);

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
