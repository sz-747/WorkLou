/**
 * Phase 4 tests: verify grouping (pure) + provider confirmation DB flow.
 * Creates its own test service/rows and cleans up after itself.
 * Run: npm run db:test:verify
 */
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import {
  cases,
  providerConfirmationEvents,
  serviceAttributes,
  services,
  type CaseContext,
} from "./schema";
import { matchServices, type FactRow, type ServiceCandidate } from "../lib/matching";
import { groupFacts, markFactStale, recordProviderConfirmation } from "../lib/verify";

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

const context: CaseContext = {
  needs: ["housing_accommodation"],
  suburb: "Waterloo",
  catchment: null,
  children: { count: 2 },
  pets: { has_pet: true, details: "dog" },
  income: { status: "low" },
  visa: "student",
  languages: ["english", "arabic"],
  urgency: "high",
  safety_preferences: null,
  safe_contact_method: null,
  summary: "Fixture context.",
};

function fact(overrides: Partial<FactRow> & Pick<FactRow, "attrType" | "key" | "value">): FactRow {
  return {
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

const fixtureFacts: FactRow[] = [
  fact({ attrType: "need", key: "need", value: "housing_accommodation" }),
  fact({ attrType: "eligibility", key: "children", value: "welcome", sourceType: "provider_confirmed", sourceName: "Provider confirmation — Caseworker (phone)", verificationStatus: "provider_confirmed", confirmedBy: "Caseworker (phone)", confirmedAt: daysAgo(20) }),
  fact({ attrType: "eligibility", key: "pets", value: "unknown", verificationStatus: "needs_provider_confirmation" }),
  fact({ attrType: "wait_time", key: "wait_time", value: "2-3 weeks", retrievedAt: daysAgo(120), verificationStatus: "stale", sourceType: "provider_confirmed", sourceName: "Provider confirmation — Caseworker (phone)", confirmedBy: "Caseworker (phone)", confirmedAt: daysAgo(120) }),
];

async function main() {
  console.log("Phase 4 — Verify tests");

  // ---------- PURE: known vs provider-only grouping ----------
  console.log("[GROUP] machine-known vs provider-only unknowns");

  const group = groupFacts(context, fixtureFacts);
  assert(
    "machine-known group: housing + provider-confirmed children policy",
    group.known.length === 2 &&
      group.known.some((f) => f.key === "need") &&
      group.known.some((f) => f.key === "children" && f.verificationStatus === "provider_confirmed"),
  );
  assert(
    "unknown value is NEVER claimed known (pets excluded from known)",
    !group.known.some((f) => f.key === "pets"),
  );
  assert(
    "durable profile gaps are left for online refresh, not added to the provider call",
    !group.needsConfirmation.some((item) => ["need", "children", "pets", "visa", "languages", "income"].includes(item.key)),
  );
  assert(
    "multiple requested languages never create duplicate provider questions",
    group.needsConfirmation.filter((item) => item.key === "languages").length === 0,
  );
  const wait = group.needsConfirmation.find((i) => i.key === "wait_time");
  assert(
    "stale fact moved to needs-confirmation with history kept visible",
    wait?.fact?.verificationStatus === "stale" && wait.history?.includes("confirmed by Caseworker (phone)") === true,
  );
  assert(
    "provider call is limited to reusable current wait time and capacity questions",
    group.needsConfirmation.map((i) => i.key).join(",") === "wait_time,capacity",
  );
  assert(
    "known facts are not duplicated in the needs-confirmation list",
    !group.needsConfirmation.some((i) => i.key === "need" || i.key === "children"),
  );

  // irrelevant-context criteria do not produce phantom unknowns
  const noKidsCtx: CaseContext = { ...context, children: null, pets: null, visa: null, languages: [], income: null, urgency: "low" };
  const group2 = groupFacts(noKidsCtx, fixtureFacts);
  assert(
    "wait time remains useful regardless of case urgency; housing still asks capacity",
    group2.needsConfirmation.map((item) => item.key).join(",") === "wait_time,capacity",
  );
  const duplicateWait = fact({
    attrType: "wait_time",
    key: "wait_time",
    value: "unknown",
    retrievedAt: daysAgo(10),
    verificationStatus: "needs_provider_confirmation",
  });
  const deduplicated = groupFacts(context, [...fixtureFacts, duplicateWait]);
  assert(
    "duplicate stored wait rows still produce one provider question",
    deduplicated.needsConfirmation.filter((item) => item.key === "wait_time").length === 1,
  );
  const currentWait = fact({
    attrType: "wait_time",
    key: "wait_time",
    value: "today",
    retrievedAt: daysAgo(0),
  });
  const currentWins = groupFacts(context, [...fixtureFacts, currentWait]);
  assert(
    "one current wait-time answer suppresses older duplicate history",
    !currentWins.needsConfirmation.some((item) => item.key === "wait_time"),
  );

  // ---------- DB FLOW: record confirmation → shared knowledge → reuse ----------
  console.log("[VERIFY FLOW] provider confirmation persists and is shared");

  const [testService] = await db
    .insert(services)
    .values({
      name: "TEST Verify Service",
      organisation: "Test (cleaned up)",
      description: "Temporary test service for Phase 4 tests.",
      status: "active",
      sourceType: "manual",
      sourceName: "test",
    })
    .returning();

  const [testCase] = await db
    .insert(cases)
    .values({ clientRef: "TEST-VERIFY-001", originalNotes: "test notes" })
    .returning();

  const [petsFact] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: testService.id,
      attrType: "eligibility",
      key: "pets",
      value: "unknown",
      sourceType: "excel_import",
      sourceName: "Lous Place Service List (Excel) v3",
      retrievedAt: daysAgo(45),
      verificationStatus: "needs_provider_confirmation",
    })
    .returning();

  await recordProviderConfirmation({
    caseId: testCase.id,
    attrId: petsFact.id,
    serviceId: testService.id,
    attrType: "eligibility",
    key: "pets",
    value: "welcome",
    confirmedBy: "Caseworker — phone",
    confirmedAt: daysAgo(0),
    notes: "Dogs accepted up to 15kg.",
  });

  const [confirmed] = await db.select().from(serviceAttributes).where(eq(serviceAttributes.id, petsFact.id));
  assert(
    "confirmation updates the EXISTING row with full provenance",
    confirmed.value === "welcome" &&
      confirmed.sourceType === "provider_confirmed" &&
      confirmed.verificationStatus === "provider_confirmed" &&
      confirmed.confirmedBy === "Caseworker — phone" &&
      !!confirmed.confirmedAt &&
      !!confirmed.retrievedAt &&
      confirmed.notes === "Dogs accepted up to 15kg.",
  );
  const countPets = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceAttributes)
    .where(sql`${serviceAttributes.serviceId} = ${testService.id} and ${serviceAttributes.key} = 'pets'`);
  assert("no duplicate parallel fact created (still one pets row)", countPets[0]?.count === 1);

  // another case sees the confirmation through a FRESH query (shared knowledge)
  const freshFacts = (await db.select().from(serviceAttributes).where(eq(serviceAttributes.serviceId, testService.id))) as FactRow[];
  const regrouped = groupFacts(context, freshFacts);
  assert(
    "another case reuses the confirmation: pets now in the known group",
    regrouped.known.some((f) => f.key === "pets" && f.verificationStatus === "provider_confirmed" && !!f.confirmedBy),
  );

  // Find support reflects the confirmation
  const [needFact] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: testService.id,
      attrType: "need",
      key: "need",
      value: "housing_accommodation",
      sourceType: "excel_import",
      sourceName: "Lous Place Service List (Excel) v3",
      retrievedAt: daysAgo(45),
      verificationStatus: "verified_machine",
    })
    .returning();
  const candidate: ServiceCandidate = {
    id: testService.id,
    name: "TEST Verify Service",
    organisation: null,
    phone: null,
    catchment: null,
    attributes: (await db.select().from(serviceAttributes).where(eq(serviceAttributes.serviceId, testService.id))) as FactRow[],
  };
  const match = matchServices(context, [candidate]);
  const petsCriterion = match[0].criteria.find((c) => c.criterion === "pets");
  assert(
    "Find support now shows pets as matched with provider-confirmed provenance",
    petsCriterion?.status === "matched" && petsCriterion.fact?.verificationStatus === "provider_confirmed",
  );

  // insert a MISSING fact via confirmation (no attrId)
  const insertedId = await recordProviderConfirmation({
    caseId: testCase.id,
    attrId: null,
    serviceId: testService.id,
    attrType: "eligibility",
    key: "visa",
    value: "no_restrictions",
    confirmedBy: "Caseworker — email",
    confirmedAt: daysAgo(1),
    notes: null,
  });
  const [inserted] = await db.select().from(serviceAttributes).where(eq(serviceAttributes.id, insertedId));
  assert(
    "missing fact inserted as provider-confirmed (not guessed) with source + timestamp",
    inserted.verificationStatus === "provider_confirmed" && inserted.confirmedBy === "Caseworker — email" && !!inserted.confirmedAt,
  );
  const expiredCapacity = fact({
    attrType: "delivery",
    key: "capacity",
    value: "reported_available",
    sourceType: "provider_confirmed",
    verificationStatus: "provider_confirmed",
    expiresAt: "2026-09-05T03:00:00Z",
  });
  const expiryGroup = groupFacts(
    context,
    [...fixtureFacts, expiredCapacity],
    new Date("2026-09-05T04:00:00Z"),
  );
  assert(
    "expired provider-confirmed capacity is never shown or drafted as known",
    !expiryGroup.known.includes(expiredCapacity) &&
      expiryGroup.needsConfirmation.some((item) => item.fact === expiredCapacity),
  );
  const confirmationHistory = await db
    .select()
    .from(providerConfirmationEvents)
    .where(eq(providerConfirmationEvents.caseId, testCase.id));
  assert(
    "provider confirmation history is append-only and case-specific",
    confirmationHistory.length === 2 &&
      confirmationHistory.every((event) => event.caseId === testCase.id),
  );

  // ---------- DB FLOW: expiry without deleting history ----------
  console.log("[EXPIRY] volatile facts expire, history is kept");

  await markFactStale(insertedId);
  const [staled] = await db.select().from(serviceAttributes).where(eq(serviceAttributes.id, insertedId));
  assert(
    "mark stale flips ONLY verification_status — source, who, when, notes all kept",
    staled.verificationStatus === "stale" &&
      staled.value === "no_restrictions" &&
      staled.confirmedBy === "Caseworker — email" &&
      !!staled.confirmedAt &&
      staled.sourceType === "provider_confirmed" &&
      staled.notes === null,
  );
  const staledGroup = groupFacts(context, [
    ...(await db.select().from(serviceAttributes).where(eq(serviceAttributes.serviceId, testService.id))),
  ] as FactRow[]);
  assert(
    "a stale durable profile fact stays out of the provider availability call",
    !staledGroup.needsConfirmation.some((item) => item.key === "visa"),
  );

  // ---------- CLEANUP ----------
  console.log("[CLEANUP] removing test rows");
  await db.delete(cases).where(eq(cases.id, testCase.id));
  await db.delete(services).where(eq(services.id, testService.id));
  const leftover = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceAttributes)
    .where(eq(serviceAttributes.serviceId, testService.id));
  assert("test rows cleaned up (attributes cascade)", (leftover[0]?.count ?? 0) === 0);

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
