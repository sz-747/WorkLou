/**
 * Phase 7A updater tests: source fixtures → compare → candidates with
 * provenance; idempotent re-runs; approve applies to canonical data with
 * change-log history; reject leaves canonical untouched; source failures
 * never corrupt data. Scoped to its own test services (only=) so demo
 * data is untouched. Run: npm run db:test:updater
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import { serviceAttributes, serviceChangeLog, services, updateCandidates, updaterRuns } from "./schema";
import { FIXTURES } from "../lib/sources";
import { authorizeSchedulerRequest } from "../lib/scheduler-auth";
import {
  applyUpdateCandidate,
  rejectUpdateCandidate,
  runUpdater,
} from "../lib/updater";

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
const TEST_SOURCE_URL = "https://test-updater.example.org/page";

async function main() {
  console.log("Phase 7A — Existing-service updater tests");

  console.log("[SCHEDULER AUTH] machine-triggered routes require the shared secret");
  const scheduledRequest = new Request("http://localhost/api/updater/run", {
    method: "POST",
    headers: { authorization: "Bearer test-scheduler-secret" },
  });
  assert(
    "correct scheduler token is accepted",
    authorizeSchedulerRequest(scheduledRequest, "test-scheduler-secret").ok,
  );
  const wrongToken = authorizeSchedulerRequest(scheduledRequest, "different-secret");
  assert(
    "wrong scheduler token is rejected without running a job",
    !wrongToken.ok && wrongToken.status === 401,
  );
  const missingSecret = authorizeSchedulerRequest(scheduledRequest, undefined);
  assert(
    "missing deployment secret fails closed",
    !missingSecret.ok && missingSecret.status === 503,
  );

  // deterministic source snapshot for the test service
  FIXTURES[TEST_SOURCE_URL] = {
    sourceName: "TEST Updater Source (fixture)",
    facts: [
      { kind: "service_field", field: "phone", value: "02 9999 8888" },
      { kind: "attribute", attrType: "need", key: "need", value: "housing_accommodation" },
      { kind: "attribute", attrType: "eligibility", key: "pets", value: "welcome" },
      { kind: "attribute", attrType: "cost", key: "cost", value: "free" },
      { kind: "attribute", attrType: "wait_time", key: "wait_time", value: "1-2 weeks" },
      { kind: "attribute", attrType: "delivery", key: "format", value: "in_person" },
      { kind: "attribute", attrType: "eligibility", key: "visa", value: "no_restrictions" },
    ],
  };

  const [testService] = await db
    .insert(services)
    .values({
      name: "TEST Updater Service",
      organisation: "Test (cleaned up)",
      description: "Temporary test service for updater tests.",
      status: "active",
      phone: "02 0000 0000",
      sourceType: "machine",
      sourceName: "TEST Updater Source (fixture)",
      sourceUrl: TEST_SOURCE_URL,
    })
    .returning();

  const [needFact] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: testService.id,
      attrType: "need",
      key: "need",
      value: "housing_accommodation",
      sourceType: "machine",
      sourceName: "TEST Updater Source (fixture)",
      retrievedAt: daysAgo(30),
      verificationStatus: "verified_machine",
    })
    .returning();
  const [petsFact] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: testService.id,
      attrType: "eligibility",
      key: "pets",
      value: "welcome",
      sourceType: "provider_confirmed",
      sourceName: "Phone confirmation by caseworker",
      retrievedAt: daysAgo(20),
      confirmedBy: "Caseworker (phone)",
      confirmedAt: daysAgo(20),
      verificationStatus: "provider_confirmed",
    })
    .returning();
  const [costFact] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: testService.id,
      attrType: "cost",
      key: "cost",
      value: "free",
      sourceType: "excel_import",
      sourceName: "Lous Place Service List (Excel) v3",
      retrievedAt: daysAgo(120),
      verificationStatus: "stale",
    })
    .returning();
  const [waitFact] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: testService.id,
      attrType: "wait_time",
      key: "wait_time",
      value: "2-4 weeks",
      sourceType: "excel_import",
      sourceName: "Lous Place Service List (Excel) v3",
      retrievedAt: daysAgo(120),
      verificationStatus: "stale",
    })
    .returning();
  const [deliveryFact] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: testService.id,
      attrType: "delivery",
      key: "format",
      value: "phone_online",
      sourceType: "machine",
      sourceName: "TEST Updater Source (fixture)",
      retrievedAt: daysAgo(7),
      verificationStatus: "verified_machine",
    })
    .returning();

  const runIds: string[] = [];
  const pendingFor = (scope: string, key: string) =>
    db
      .select()
      .from(updateCandidates)
      .where(
        and(
          eq(updateCandidates.serviceId, testService.id),
          eq(updateCandidates.scope, scope),
          eq(updateCandidates.key, key),
          eq(updateCandidates.status, "pending_review"),
        ),
      );

  // ---------- run 1: compare + candidates ----------
  console.log("[RUN 1] changed source info creates structured candidates; canonical untouched");

  const run1 = await runUpdater({ trigger: "manual", only: [testService.id] });
  runIds.push(run1.runId);
  assert(
    "run logged completed with sources ok and zero failures",
    run1.status === "completed" && run1.sourcesOk === 1 && run1.sourcesFailed === 0,
  );

  const allPending = await db
    .select()
    .from(updateCandidates)
    .where(and(eq(updateCandidates.serviceId, testService.id), eq(updateCandidates.status, "pending_review")));
  assert(
    "four candidates created: phone field change, wait_time change, delivery change, new visa fact",
    run1.candidatesCreated === 4 &&
      allPending.length === 4 &&
      allPending.some((c) => c.scope === "service_field" && c.key === "phone" && c.currentValue === "02 0000 0000" && c.newValue === "02 9999 8888") &&
      allPending.some((c) => c.key === "wait_time" && c.currentValue === "2-4 weeks" && c.newValue === "1-2 weeks") &&
      allPending.some((c) => c.key === "format" && c.currentValue === "phone_online" && c.newValue === "in_person") &&
      allPending.some((c) => c.key === "visa" && c.currentValue === null && c.newValue === "no_restrictions"),
  );

  const withProvenance = allPending.filter(
    (c) => c.sourceUrl === TEST_SOURCE_URL && c.evidenceType === "fixture" && !!c.retrievedAt && !!c.reason,
  );
  assert("every candidate preserves source URL, evidence type, retrieval time, reason", withProvenance.length === 4);

  const [svcAfter1] = await db.select().from(services).where(eq(services.id, testService.id));
  const factsAfter1 = await db.select().from(serviceAttributes).where(eq(serviceAttributes.serviceId, testService.id));
  assert(
    "canonical data untouched by the run itself (no auto-apply)",
    svcAfter1.phone === "02 0000 0000" &&
      factsAfter1.find((f) => f.key === "wait_time")?.value === "2-4 weeks" &&
      factsAfter1.find((f) => f.key === "format")?.value === "phone_online" &&
      !factsAfter1.some((f) => f.key === "visa"),
  );

  const [costAfter1] = factsAfter1.filter((f) => f.id === costFact.id);
  assert(
    "unchanged stale fact refreshed in place (stale → verified_machine, fresh retrieval)",
    costAfter1.verificationStatus === "verified_machine" &&
      costAfter1.retrievedAt !== null &&
      costAfter1.retrievedAt > daysAgo(1),
  );
  const [petsAfter1] = factsAfter1.filter((f) => f.id === petsFact.id);
  assert(
    "provider-confirmed fact keeps human status + who on refresh",
    petsAfter1.verificationStatus === "provider_confirmed" && petsAfter1.confirmedBy === "Caseworker (phone)",
  );
  assert(
    "new-fact candidate is source-evidenced, not invented",
    allPending.find((c) => c.key === "visa")?.reason === "new fact reported by the source — not previously recorded",
  );

  // ---------- run 2: idempotency ----------
  console.log("[RUN 2] repeated run is idempotent — no duplicate candidates");

  const run2 = await runUpdater({ trigger: "manual", only: [testService.id] });
  runIds.push(run2.runId);
  const stillPending = await db
    .select()
    .from(updateCandidates)
    .where(and(eq(updateCandidates.serviceId, testService.id), eq(updateCandidates.status, "pending_review")));
  assert(
    "second run creates nothing new; same 4 pending candidates",
    run2.candidatesCreated === 0 &&
      run2.candidatesUpdated === 0 &&
      run2.candidatesSkipped === 4 &&
      stillPending.length === 4,
  );

  // ---------- run 3: changed evidence updates the pending candidate in place ----------
  console.log("[RUN 3] newer evidence updates the pending candidate, still no duplicates");

  FIXTURES[TEST_SOURCE_URL].facts = FIXTURES[TEST_SOURCE_URL].facts.map((f) =>
    f.kind === "attribute" && f.key === "wait_time" ? { ...f, value: "3-5 weeks" } : f,
  );
  const run3 = await runUpdater({ trigger: "manual", only: [testService.id] });
  runIds.push(run3.runId);
  const waitCand = (await pendingFor("attribute", "wait_time"))[0];
  const allPending3 = await db
    .select()
    .from(updateCandidates)
    .where(and(eq(updateCandidates.serviceId, testService.id), eq(updateCandidates.status, "pending_review")));
  assert(
    "candidate updated in place with latest evidence (still 4 pending)",
    run3.candidatesUpdated === 1 && waitCand?.newValue === "3-5 weeks" && allPending3.length === 4,
  );

  // ---------- approve: applies to canonical data ----------
  console.log("[APPROVE] approved candidates update canonical data with change history");

  const phoneCand = (await pendingFor("service_field", "phone"))[0];
  const visaCand = (await pendingFor("attribute", "visa"))[0];
  const formatCand = (await pendingFor("attribute", "format"))[0];

  const appliedPhone = await applyUpdateCandidate(phoneCand.id, "Lou (reviewer)");
  const [svcApproved] = await db.select().from(services).where(eq(services.id, testService.id));
  const phoneLog = await db
    .select()
    .from(serviceChangeLog)
    .where(and(eq(serviceChangeLog.serviceId, testService.id), eq(serviceChangeLog.field, "phone")));
  assert(
    "approved service-field change applied + logged old → new with who",
    appliedPhone?.status === "applied" &&
      appliedPhone?.decidedBy === "Lou (reviewer)" &&
      svcApproved.phone === "02 9999 8888" &&
      phoneLog.length === 1 &&
      phoneLog[0].oldValue === "02 0000 0000" &&
      phoneLog[0].newValue === "02 9999 8888" &&
      !!appliedPhone?.decidedAt,
  );

  const appliedWait = await applyUpdateCandidate(waitCand.id, "Lou (reviewer)");
  const [waitFactApplied] = await db.select().from(serviceAttributes).where(eq(serviceAttributes.id, waitFact.id));
  const waitLog = await db
    .select()
    .from(serviceChangeLog)
    .where(and(eq(serviceChangeLog.attributeId, waitFact.id), eq(serviceChangeLog.field, "value")));
  assert(
    "approved attribute change applied in place with machine provenance + history",
    appliedWait?.status === "applied" &&
      waitFactApplied.value === "3-5 weeks" &&
      waitFactApplied.sourceType === "machine" &&
      waitFactApplied.verificationStatus === "verified_machine" &&
      waitFactApplied.retrievedAt !== null &&
      waitFactApplied.retrievedAt > daysAgo(1) &&
      waitLog.length === 1 &&
      waitLog[0].oldValue === "2-4 weeks" &&
      waitLog[0].newValue === "3-5 weeks",
  );

  const appliedVisa = await applyUpdateCandidate(visaCand.id, "Lou (reviewer)");
  const visaRows = await db
    .select()
    .from(serviceAttributes)
    .where(and(eq(serviceAttributes.serviceId, testService.id), eq(serviceAttributes.key, "visa")));
  assert(
    "approved new-fact candidate inserts exactly one fact with machine provenance",
    appliedVisa?.status === "applied" &&
      visaRows.length === 1 &&
      visaRows[0].value === "no_restrictions" &&
      visaRows[0].sourceType === "machine" &&
      visaRows[0].verificationStatus === "verified_machine",
  );

  assert(
    "approve on an already-decided candidate is rejected safely",
    (await applyUpdateCandidate(visaCand.id, "Lou (reviewer)")) === null,
  );

  // ---------- reject: canonical untouched ----------
  console.log("[REJECT] rejected candidates leave canonical data untouched");

  const rejected = await rejectUpdateCandidate(formatCand.id, "Lou (reviewer)", "page is out of date — delivery still phone/online");
  const [formatAfterReject] = await db.select().from(serviceAttributes).where(eq(serviceAttributes.id, deliveryFact.id));
  assert(
    "rejection recorded with who/when; fact value unchanged",
    rejected?.status === "rejected" &&
      rejected?.decidedBy === "Lou (reviewer)" &&
      formatAfterReject.value === "phone_online" &&
      formatAfterReject.verificationStatus === "verified_machine",
  );
  assert(
    "reject on an already-decided candidate is rejected safely",
    (await rejectUpdateCandidate(formatCand.id, "Lou (reviewer)", null)) === null,
  );

  // ---------- source failure: no corruption ----------
  console.log("[FAILURE] source failures are logged and never corrupt data");

  const [failService] = await db
    .insert(services)
    .values({
      name: "TEST Updater Broken Source",
      organisation: "Test (cleaned up)",
      status: "active",
      sourceType: "machine",
      sourceName: "Unreachable page",
      sourceUrl: "https://nonexistent.invalid/page",
    })
    .returning();
  const failRun = await runUpdater({ trigger: "manual", only: [failService.id] });
  runIds.push(failRun.runId);
  assert(
    "failed source counted + logged; run still completes",
    failRun.status === "completed" && failRun.sourcesFailed === 1 && failRun.sourcesOk === 0 &&
      failRun.log.some((e) => e.message.includes("SOURCE FAILED")),
  );
  const failCands = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(updateCandidates)
    .where(eq(updateCandidates.serviceId, failService.id));
  assert("failed source produced zero candidates", (failCands[0]?.count ?? 0) === 0);

  // re-run after evidence: the approved/rejected decisions stay stable
  const run4 = await runUpdater({ trigger: "manual", only: [testService.id] });
  runIds.push(run4.runId);
  const pendingAfter4 = await db
    .select()
    .from(updateCandidates)
    .where(and(eq(updateCandidates.serviceId, testService.id), eq(updateCandidates.status, "pending_review")));
  assert(
    "re-run after decisions creates no duplicates and re-proposes nothing new",
    run4.candidatesCreated === 0 && pendingAfter4.length === 0,
  );

  // ---------- CLEANUP ----------
  console.log("[CLEANUP] removing test rows");
  delete FIXTURES[TEST_SOURCE_URL];
  await db.delete(services).where(inArray(services.id, [testService.id, failService.id]));
  await db.delete(updaterRuns).where(inArray(updaterRuns.id, runIds));
  const left = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(updateCandidates)
    .where(inArray(updateCandidates.serviceId, [testService.id, failService.id]));
  assert("test rows cleaned up (candidates cascade with services)", (left[0]?.count ?? 0) === 0);

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
