/**
 * Phase 1 tests: create/read/update relationships + basic deterministic queries.
 * Creates its own test rows and cleans up after itself. Run: npm run db:test
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import {
  caseContexts,
  caseDocuments,
  cases,
  discoveryCandidates,
  referrals,
  serviceAttributes,
  services,
} from "./schema";

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

async function main() {
  console.log("Phase 1 DB tests");

  // ---------- CREATE ----------
  console.log("[CREATE] service + attribute + referral chain");

  const [testService] = await db
    .insert(services)
    .values({
      name: "TEST — Temporary Food Relief Service",
      organisation: "Test Org",
      description: "Temporary service created by db:test",
      status: "active",
      catchment: "Sydney",
      sourceType: "manual",
      sourceName: "db:test",
    })
    .returning();

  const [testAttr] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: testService.id,
      attrType: "need",
      key: "need",
      value: "food_basic_needs",
      sourceType: "machine",
      sourceName: "test fixture",
      retrievedAt: new Date(),
      verificationStatus: "verified_machine",
    })
    .returning();

  // Target the seeded demo case explicitly — never an arbitrary row, so a
  // concurrently-created test case (other suites create/delete their own cases)
  // can never be picked and vanish before the case_documents insert below.
  const [seededCase] = await db
    .select()
    .from(cases)
    .where(eq(cases.clientRef, "CASE-2026-001"))
    .limit(1);
  assert("seeded case exists", !!seededCase);

  const [approvedContext] = await db
    .insert(caseContexts)
    .values({
      caseId: seededCase.id,
      version: 2,
      context: {
        needs: ["food_basic_needs"],
        suburb: "Waterloo",
        catchment: "Inner South Sydney",
        children: { count: 2 },
        pets: { has_pet: true, details: "dog" },
        income: { status: "low" },
        visa: "bridging_e",
        languages: ["english", "arabic"],
        urgency: "high",
        safety_preferences: null,
        safe_contact_method: "sms",
        summary: "test context",
      },
      status: "approved",
      extractionModel: "db:test",
      approvedAt: new Date(),
    })
    .returning();

  const [testReferral] = await db
    .insert(referrals)
    .values({
      caseId: seededCase.id,
      contextId: approvedContext.id,
      serviceId: testService.id,
      draftText: "TEST referral draft — factual content only from stored context.",
      status: "draft",
      followUpDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    })
    .returning();

  assert("service created", !!testService.id);
  assert("attribute created linked to service", testAttr.serviceId === testService.id);
  assert("referral created (case + context + service linked)", !!testReferral.id);

  // ---------- READ (joins) ----------
  console.log("[READ] referral with joins");

  const joined = await db
    .select({
      referralId: referrals.id,
      referralStatus: referrals.status,
      serviceName: services.name,
      clientRef: cases.clientRef,
      contextNeeds: caseContexts.context,
      contextStatus: caseContexts.status,
    })
    .from(referrals)
    .innerJoin(services, eq(referrals.serviceId, services.id))
    .innerJoin(cases, eq(referrals.caseId, cases.id))
    .innerJoin(caseContexts, eq(referrals.contextId, caseContexts.id))
    .where(eq(referrals.id, testReferral.id));

  assert("referral joins to service, case, context", joined.length === 1);
  assert(
    "joined context carries needs",
    (joined[0]?.contextNeeds?.needs ?? []).includes("food_basic_needs"),
  );
  assert("referral used the approved context", joined[0]?.contextStatus === "approved");

  // ---------- UPDATE ----------
  console.log("[UPDATE] referral status progression + provider confirmation");

  await db
    .update(referrals)
    .set({ status: "approved" })
    .where(eq(referrals.id, testReferral.id));
  await db
    .update(referrals)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(referrals.id, testReferral.id));

  const [sentReferral] = await db
    .select()
    .from(referrals)
    .where(eq(referrals.id, testReferral.id));
  assert("referral status progressed draft -> approved -> sent", sentReferral.status === "sent");
  assert("sent_at recorded when worker marks sent", !!sentReferral.sentAt);

  // provider confirmation on a needs-provider-confirmation fact.
  // Self-contained: the test creates its own pets fact on the test service, so
  // the seeded Watershed pets fact (possibly already provider-confirmed by the
  // demo run) is neither relied on nor modified. The fact is removed with the
  // test service at cleanup (cascade).
  const [petsFact] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: testService.id,
      attrType: "access",
      key: "pets",
      value: "unknown",
      sourceType: "excel_import",
      sourceName: "Test fixture",
      verificationStatus: "needs_provider_confirmation",
      notes: "Pet policy genuinely requires direct provider confirmation.",
    })
    .returning();
  assert("seeded needs-provider-confirmation fact exists", !!petsFact?.id);

  await db
    .update(serviceAttributes)
    .set({
      value: "small_pets_ok",
      sourceType: "provider_confirmed",
      sourceName: "Phone confirmation by caseworker",
      confirmedBy: "Test Worker (phone)",
      confirmedAt: new Date(),
      verificationStatus: "provider_confirmed",
      notes: "Confirmed directly with provider in db:test.",
    })
    .where(eq(serviceAttributes.id, petsFact.id));

  const [confirmed] = await db
    .select()
    .from(serviceAttributes)
    .where(eq(serviceAttributes.id, petsFact.id));
  assert(
    "provider confirmation recorded (by + at + source + distinct status)",
    !!confirmed?.confirmedAt &&
      confirmed?.sourceType === "provider_confirmed" &&
      confirmed?.verificationStatus === "provider_confirmed",
  );
  assert("confirmed fact value updated", confirmed?.value === "small_pets_ok");

  // outcome update
  await db
    .update(referrals)
    .set({
      status: "responded",
      outcome: "accepted",
      outcomeNotes: "Place offered pending intake call.",
      outcomeAt: new Date(),
    })
    .where(eq(referrals.id, testReferral.id));
  const [responded] = await db
    .select()
    .from(referrals)
    .where(eq(referrals.id, testReferral.id));
  assert("outcome recorded on referral", responded.outcome === "accepted" && !!responded.outcomeAt);

  // ---------- BASIC QUERIES (deterministic, no LLM) ----------
  console.log("[QUERY] deterministic match + freshness");

  const housingMatches = await db
    .select({
      serviceName: services.name,
      value: serviceAttributes.value,
      sourceName: serviceAttributes.sourceName,
      retrievedAt: serviceAttributes.retrievedAt,
      verificationStatus: serviceAttributes.verificationStatus,
    })
    .from(serviceAttributes)
    .innerJoin(services, eq(serviceAttributes.serviceId, services.id))
    .where(
      and(
        eq(serviceAttributes.attrType, "need"),
        eq(serviceAttributes.key, "need"),
        eq(serviceAttributes.value, "housing_accommodation"),
      ),
    );
  assert(
    "deterministic need query returns Watershed with provenance",
    housingMatches.some((m) => m.serviceName.includes("Watershed")),
  );
  assert(
    "match result carries source + freshness",
    housingMatches.every((m) => !!m.sourceName && !!m.retrievedAt),
  );

  const needingHuman = await db
    .select({ key: serviceAttributes.key, serviceName: services.name })
    .from(serviceAttributes)
    .innerJoin(services, eq(serviceAttributes.serviceId, services.id))
    .where(eq(serviceAttributes.verificationStatus, "needs_provider_confirmation"));
  assert(
    "provider-only facts are distinguishable",
    needingHuman.some((f) => f.key === "wait_time"),
  );

  const staleCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceAttributes)
    .where(eq(serviceAttributes.verificationStatus, "stale"));
  assert("stale facts are countable", (staleCount[0]?.count ?? 0) >= 2);

  // jsonb case-context query
  const caseWithHousingNeed = await db
    .select({ clientRef: cases.clientRef })
    .from(caseContexts)
    .innerJoin(cases, eq(caseContexts.caseId, cases.id))
    .where(sql`${caseContexts.context} -> 'needs' ? 'housing_accommodation'`);
  // seeded case may now have several context versions (Phase 2 walkthroughs);
  // the point is the jsonb containment query finds the seeded case by need
  assert(
    "jsonb context query finds the case by need",
    caseWithHousingNeed.length >= 1 &&
      caseWithHousingNeed.some((r) => r.clientRef === seededCase.clientRef),
  );

  // case documents + discovery candidates create/read
  const [testDoc] = await db
    .insert(caseDocuments)
    .values({
      caseId: seededCase.id,
      draftText: "TEST case note draft.",
      status: "draft",
    })
    .returning();
  assert("case document created and linked to case", testDoc.caseId === seededCase.id);

  const [testCandidate] = await db
    .insert(discoveryCandidates)
    .values({
      name: "TEST — Emerging Housing Service",
      sourceUrl: "https://example.org/housing",
      sourceName: "test discovery run",
      dedupKey: "test|emerging|sydney",
      extractedData: { needs: ["housing_accommodation"], catchment: "Sydney" },
      status: "pending_review",
    })
    .returning();
  assert("discovery candidate created with dedup key", !!testCandidate.dedupKey);

  const dedupeHit = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(discoveryCandidates)
    .where(eq(discoveryCandidates.dedupKey, "test|emerging|sydney"));
  assert("discovery dedup query works", (dedupeHit[0]?.count ?? 0) === 1);

  // ---------- CLEANUP ----------
  console.log("[CLEANUP] removing test rows");
  await db.delete(referrals).where(eq(referrals.id, testReferral.id));
  await db.delete(caseContexts).where(eq(caseContexts.id, approvedContext.id));
  await db.delete(caseDocuments).where(eq(caseDocuments.id, testDoc.id));
  await db.delete(discoveryCandidates).where(eq(discoveryCandidates.id, testCandidate.id));
  await db.delete(serviceAttributes).where(eq(serviceAttributes.id, testAttr.id));
  await db.delete(services).where(eq(services.id, testService.id));

  const leftoverTest = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(services)
    .where(eq(services.name, "TEST — Temporary Food Relief Service"));
  assert("test rows cleaned up (cascade checked)", (leftoverTest[0]?.count ?? 0) === 0);

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
