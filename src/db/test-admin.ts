/**
 * Phase 7 admin tests: service correction + fact correction persistence,
 * change-log history, and the caseworker-queries-use-corrected-data
 * acceptance. Creates its own test service/rows and cleans up after itself.
 * Run: npm run db:test:admin
 */
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { serviceAttributes, serviceChangeLog, services, type CaseContext } from "./schema";
import { matchServices, type FactRow, type ServiceCandidate } from "../lib/matching";
import { groupFacts } from "../lib/verify";
import {
  correctServiceAttribute,
  getChangeHistory,
  getServicesOverview,
  updateServiceAdmin,
} from "../lib/admin";

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
  income: { status: "low", source: null },
  visa: "student",
  languages: ["english"],
  urgency: "high",
  safety_preferences: null,
  safe_contact_method: null,
  summary: "Fixture context.",
};

async function main() {
  console.log("Phase 7 — Admin tests");

  const [testService] = await db
    .insert(services)
    .values({
      name: "TEST Admin Service",
      organisation: "Test (cleaned up)",
      description: "Temporary test service for admin tests.",
      status: "active",
      phone: "02 0000 0000",
      sourceType: "excel_import",
      sourceName: "Lous Place Service List (Excel) v3",
    })
    .returning();

  const [petsFact] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: testService.id,
      attrType: "eligibility",
      key: "pets",
      value: "welcome",
      sourceType: "excel_import",
      sourceName: "Lous Place Service List (Excel) v3",
      retrievedAt: daysAgo(60),
      verificationStatus: "verified_machine",
      notes: "Excel v3 row said pets welcome.",
    })
    .returning();
  const [needFact] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: testService.id,
      attrType: "need",
      key: "need",
      value: "housing_accommodation",
      sourceType: "excel_import",
      sourceName: "Lous Place Service List (Excel) v3",
      retrievedAt: daysAgo(60),
      verificationStatus: "verified_machine",
    })
    .returning();

  // ---------- service correction + history ----------
  console.log("[SERVICE] core-field correction persists and is logged");

  const changed = await updateServiceAdmin({
    serviceId: testService.id,
    patch: { phone: "02 9999 9999", status: "needs_review", name: "TEST Admin Service" },
    changedBy: "Lou (admin)",
  });
  assert("only actually-changed fields count as corrections (2 of 3)", changed === 2);

  const [after] = await db.select().from(services).where(eq(services.id, testService.id));
  assert(
    "service correction persisted (phone + status, name untouched)",
    after.phone === "02 9999 9999" && after.status === "needs_review" && after.name === "TEST Admin Service" && after.updatedAt > after.createdAt,
  );

  const svcHistory = await getChangeHistory(testService.id);
  assert(
    "change history records old → new values with who",
    svcHistory.length === 2 &&
      svcHistory.some((h) => h.field === "phone" && h.oldValue === "02 0000 0000" && h.newValue === "02 9999 9999" && h.changedBy === "Lou (admin)") &&
      svcHistory.some((h) => h.field === "status" && h.oldValue === "active" && h.newValue === "needs_review"),
  );

  const noop = await updateServiceAdmin({
    serviceId: testService.id,
    patch: { phone: "02 9999 9999" },
    changedBy: "Lou (admin)",
  });
  assert("no-op patch changes and logs nothing", noop === 0 && (await getChangeHistory(testService.id)).length === 2);

  // ---------- fact correction ----------
  console.log("[FACT] fact correction updates in place with new provenance + logged prior provenance");

  const corrected = await correctServiceAttribute({
    attrId: petsFact.id,
    value: "not_allowed",
    notes: "Provider no longer accepts pets.",
    changedBy: "Lou (admin)",
  });
  assert(
    "correction persisted in place with admin provenance + freshness",
    corrected?.value === "not_allowed" &&
      corrected?.sourceType === "manual" &&
      corrected?.sourceName === "Admin correction" &&
      corrected?.verificationStatus === "admin_corrected" &&
      !!corrected?.retrievedAt &&
      corrected?.notes === "Provider no longer accepts pets.",
  );

  const countPets = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceAttributes)
    .where(sql`${serviceAttributes.serviceId} = ${testService.id} and ${serviceAttributes.key} = 'pets'`);
  assert("no parallel duplicate fact created (still one pets row)", countPets[0]?.count === 1);

  const factHistory = (await getChangeHistory(testService.id)).filter((h) => h.entity === "attribute");
  assert(
    "change history preserves the ORIGINAL provenance that was replaced",
    factHistory.some((h) => h.field === "source_type" && h.oldValue === "excel_import" && h.newValue === "manual") &&
      factHistory.some((h) => h.field === "value" && h.oldValue === "welcome" && h.newValue === "not_allowed"),
  );

  // ---------- caseworker queries use the corrected data ----------
  console.log("[MATCH] caseworker queries immediately use corrected data");

  const freshFacts = (await db
    .select()
    .from(serviceAttributes)
    .where(eq(serviceAttributes.serviceId, testService.id))) as FactRow[];
  const candidate: ServiceCandidate = {
    id: testService.id,
    name: "TEST Admin Service",
    organisation: null,
    phone: "02 9999 9999",
    catchment: null,
    attributes: freshFacts,
  };
  const [result] = matchServices(context, [candidate]);
  const petsCriterion = result.criteria.find((c) => c.criterion === "pets");
  assert(
    "corrected pets fact now hard-excludes the service (was suitable before the correction)",
    !result.suitable &&
      result.reason?.includes("pets not accepted") &&
      petsCriterion?.status === "mismatch" &&
      petsCriterion?.fact?.value === "not_allowed",
  );

  const group = groupFacts(context, freshFacts);
  assert(
    "admin-corrected facts count as known (never sent back to provider confirmation)",
    group.known.some((f) => f.key === "pets" && f.verificationStatus === "admin_corrected"),
  );

  // correct pets back to allowed → service becomes suitable again
  await correctServiceAttribute({
    attrId: petsFact.id,
    value: "welcome",
    notes: "Re-checked with provider: pets welcome again.",
    changedBy: "Lou (admin)",
  });
  const [roundTrip] = matchServices(context, [
    {
      ...candidate,
      attributes: (await db
        .select()
        .from(serviceAttributes)
        .where(eq(serviceAttributes.serviceId, testService.id))) as FactRow[],
    },
  ]);
  assert("second correction flips the caseworker query back to suitable", roundTrip.suitable);

  const stacked = (await getChangeHistory(testService.id)).filter(
    (h) => h.entity === "attribute" && h.field === "value",
  );
  assert(
    "history is append-only: every correction stacks (welcome → not_allowed → welcome)",
    stacked.length === 2 &&
      stacked[0].newValue === "welcome" &&
      stacked[0].oldValue === "not_allowed",
  );

  // ---------- overview + guards ----------
  console.log("[OVERVIEW] overview aggregates + guards");

  const overview = await getServicesOverview();
  const mine = overview.find((s) => s.id === testService.id);
  assert(
    "overview lists the service with fact counts + freshness",
    mine?.factCount === 2 && mine?.adminCorrected === 1 && mine?.needsAttention === 0 && !!mine?.lastChecked,
  );

  assert(
    "unknown service id: no change, no log row",
    (await updateServiceAdmin({ serviceId: "00000000-0000-0000-0000-000000000000", patch: { phone: "x" }, changedBy: "y" })) === 0,
  );
  assert(
    "unknown fact id: no correction",
    (await correctServiceAttribute({ attrId: "00000000-0000-0000-0000-000000000000", value: "x", notes: null, changedBy: "y" })) === null,
  );
  assert(
    "empty fact value rejected",
    (await correctServiceAttribute({ attrId: petsFact.id, value: "   ", notes: null, changedBy: "y" })) === null,
  );

  // ---------- CLEANUP ----------
  console.log("[CLEANUP] removing test rows");
  await db.delete(services).where(eq(services.id, testService.id));
  const logLeft = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceChangeLog)
    .where(eq(serviceChangeLog.serviceId, testService.id));
  assert("test rows cleaned up (change log cascades with the service)", (logLeft[0]?.count ?? 0) === 0);

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
