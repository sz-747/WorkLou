/**
 * Phase 5 tests: referral draft input building (pure) + referral
 * draft → sent persistence flow. Creates its own test rows and cleans up.
 * Run: npm run db:test:refer
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import { caseContexts, cases, referrals, serviceAttributes, services, type CaseContext } from "./schema";
import { parseExtraction } from "../lib/extraction";
import {
  CONTEXT_FIELDS,
  fieldSourceOf,
  fieldHasValue,
} from "../lib/context-fields";
import {
  buildReferralDraftInput,
  defaultFollowUpDate,
  getReferralsForCase,
  insertReferralDraft,
  markReferralSent,
  saveReferralDraftText,
} from "../lib/refer";
import type { FactRow } from "../lib/matching";

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

/** Seed-mirroring fixture (Amira). No field_sources → legacy defaults apply. */
const context: CaseContext = {
  needs: ["housing_accommodation", "dfv_safety"],
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
  summary: "Woman escaping DFV needs urgent crisis accommodation.",
};

const service = { name: "Watershed Women's Crisis Accommodation", organisation: "Watershed", phone: "(02) 9000 0001", catchment: "Inner West" };

const knownFacts: FactRow[] = [
  { attrType: "need", key: "need", value: "housing_accommodation", sourceType: "excel_import", sourceName: "Excel v3", retrievedAt: daysAgo(45), verificationStatus: "verified_machine", confirmedBy: null, confirmedAt: null, notes: null },
  { attrType: "eligibility", key: "children", value: "welcome", sourceType: "provider_confirmed", sourceName: "Provider confirmation — Caseworker (phone)", retrievedAt: daysAgo(20), verificationStatus: "provider_confirmed", confirmedBy: "Caseworker (phone)", confirmedAt: daysAgo(20), notes: null },
];

/** The minimal core share set (PRD): needs, suburb, languages, summary. */
const coreKeys = CONTEXT_FIELDS.filter((f) => f.core).map((f) => f.key);

async function main() {
  console.log("Phase 5 — Refer tests");

  // ---------- PURE: draft input built from approved context only ----------
  console.log("[DRAFT INPUT] share selection → draft input");

  const input = buildReferralDraftInput(context, coreKeys, service, knownFacts);
  const sharedKeys = input.womanStated.concat(input.workerObservations).map((i) => i.key);
  assert(
    "minimal core set shared: needs, suburb, languages, summary",
    sharedKeys.join(",") === "needs,suburb,languages,summary",
  );
  const serialized = JSON.stringify(input);
  assert(
    "excluded fields appear nowhere in the draft input (visa, children, pets, income, urgency, safety, contact)",
    !serialized.includes("bridging_e") &&
      !serialized.includes("child(ren)") &&
      !serialized.includes("dog") &&
      !serialized.includes("casual part-time") &&
      !serialized.includes("high") &&
      !serialized.includes("No calls to main number") &&
      !serialized.includes("sms"),
  );
  assert(
    "woman-stated core items grouped separately (all woman_stated by legacy default)",
    input.womanStated.length === 4 && input.workerObservations.length === 0,
  );
  assert(
    "known service facts included with labels",
    input.serviceFacts.length === 2 &&
      input.serviceFacts.some((f) => f.key === "children" && f.value === "welcome"),
  );

  // sharing urgency (a worker observation by legacy default) separates it
  const withUrgency = buildReferralDraftInput(context, [...coreKeys, "urgency"], service, knownFacts);
  assert(
    "worker observations stay separate from woman-stated items in the draft input",
    withUrgency.womanStated.length === 4 &&
      withUrgency.workerObservations.length === 1 &&
      withUrgency.workerObservations[0].key === "urgency",
  );

  // excluded field stays out even when re-shared list omits it
  const visaShared = buildReferralDraftInput(context, [...coreKeys, "visa"], service, knownFacts);
  assert(
    "opt-in field included once shared (visa woman-stated)",
    visaShared.womanStated.some((i) => i.key === "visa" && i.value === "bridging_e"),
  );

  // fields with no value are never shared
  const noSummary: CaseContext = { ...context, summary: null };
  const noSummaryInput = buildReferralDraftInput(noSummary, coreKeys, service, knownFacts);
  assert(
    "nothing-recorded fields are dropped even if checked",
    !noSummaryInput.womanStated.some((i) => i.key === "summary"),
  );

  // ---------- PURE: field source tags + defaults ----------
  console.log("[FIELD SOURCES] tagging and legacy defaults");

  assert(
    "legacy contexts (no field_sources): urgency defaults to worker observation, needs to woman-stated",
    fieldSourceOf(context, "urgency") === "worker_observation" &&
      fieldSourceOf(context, "needs") === "woman_stated",
  );
  const tagged: CaseContext = {
    ...context,
    field_sources: { needs: "woman_stated", suburb: "worker_observation" },
  };
  assert(
    "stored tags respected: suburb worker observation overrides legacy default",
    fieldSourceOf(tagged, "suburb") === "worker_observation" &&
      fieldSourceOf(tagged, "urgency") === "worker_observation",
  );

  const parsed = parseExtraction(
    JSON.stringify({
      needs: ["housing_accommodation"],
      suburb: "Waterloo",
      visa: "bridging_e",
      field_sources: { suburb: "worker_observation", visa: "nonsense" },
    }),
  );
  assert(
    "parseExtraction normalises tags: valid kept, invalid → woman_stated, missing → woman_stated",
    parsed.field_sources?.suburb === "worker_observation" &&
      parsed.field_sources?.visa === "woman_stated" &&
      parsed.field_sources?.needs === "woman_stated",
  );
  assert(
    "parseExtraction tags only fields with values (null suburb absent from tags when unrecorded)",
    parseExtraction('{"needs":["legal"],"suburb":null}').field_sources?.suburb === undefined,
  );

  // ---------- PURE: follow-up default ----------
  console.log("[FOLLOW UP] default date");

  const fixed = new Date("2026-09-05T10:00:00Z");
  assert(
    "default follow-up date is one week out (worker-editable in the form)",
    defaultFollowUpDate(fixed) === "2026-09-12",
  );

  // ---------- DB FLOW: draft → edit → sent → reload preserves ----------
  console.log("[REFER FLOW] draft persisted, edited, marked sent, reload preserves");

  const [testService] = await db
    .insert(services)
    .values({
      name: "TEST Refer Service",
      organisation: "Test (cleaned up)",
      description: "Temporary test service for Phase 5 tests.",
      status: "active",
      sourceType: "manual",
      sourceName: "test",
    })
    .returning();

  const [testCase] = await db
    .insert(cases)
    .values({ clientRef: "TEST-REFER-001", originalNotes: "test notes", status: "open" })
    .returning();

  const [approvedCtx] = await db
    .insert(caseContexts)
    .values({
      caseId: testCase.id,
      version: 1,
      context,
      status: "approved",
      approvedAt: daysAgo(0),
    })
    .returning();

  const [attr] = await db
    .insert(serviceAttributes)
    .values({
      serviceId: testService.id,
      attrType: "need",
      key: "need",
      value: "housing_accommodation",
      sourceType: "excel_import",
      sourceName: "test",
      retrievedAt: daysAgo(45),
      verificationStatus: "verified_machine",
    })
    .returning();

  const referralId = await insertReferralDraft({
    caseId: testCase.id,
    contextId: approvedCtx.id,
    serviceId: testService.id,
    draftText: "Draft referral text (deterministic test draft).",
    sharedFields: coreKeys,
  });

  const list = await getReferralsForCase(testCase.id);
  assert(
    "draft persisted with status draft, shared fields, draft text, linked to approved context + service",
    list.length === 1 &&
      list[0].id === referralId &&
      list[0].status === "draft" &&
      list[0].sharedFields?.join(",") === "needs,suburb,languages,summary" &&
      list[0].draftText === "Draft referral text (deterministic test draft)." &&
      list[0].serviceName === "TEST Refer Service",
  );

  const saved = await saveReferralDraftText(referralId, "Edited by worker before sending.");
  assert(
    "worker edit saved on the draft",
    saved && (await getReferralsForCase(testCase.id))[0].draftText === "Edited by worker before sending.",
  );

  const followUpDue = defaultFollowUpDate(new Date("2026-09-05T10:00:00Z"));
  const sent = await markReferralSent(referralId, followUpDue);
  const afterSent = (await getReferralsForCase(testCase.id))[0];
  assert(
    "mark sent persists status + sent_at + follow_up_due (nothing transmitted)",
    sent &&
      afterSent.status === "sent" &&
      !!afterSent.sentAt &&
      afterSent.followUpDue === "2026-09-12",
  );

  // fresh query = reload: everything preserved
  const reloaded = await getReferralsForCase(testCase.id);
  assert(
    "reload preserves the sent referral state end to end",
    reloaded[0].status === "sent" &&
      reloaded[0].draftText === "Edited by worker before sending." &&
      reloaded[0].followUpDue === "2026-09-12" &&
      !!reloaded[0].sentAt,
  );

  // draft-only guards: a sent referral is never edited or re-marked
  const guardEdit = await saveReferralDraftText(referralId, "should not change");
  const guardSent = await markReferralSent(referralId, "2099-01-01");
  const guarded = (await getReferralsForCase(testCase.id))[0];
  assert(
    "sent referrals never change: edit and re-mark are no-ops, first sent_at kept",
    guardEdit === false &&
      guardSent === false &&
      guarded.draftText === "Edited by worker before sending." &&
      guarded.followUpDue === "2026-09-12" &&
      new Date(guarded.sentAt as Date).getTime() === new Date(reloaded[0].sentAt as Date).getTime(),
  );

  assert("fieldHasValue helper drives share controls", fieldHasValue("visa", context) && !fieldHasValue("visa", { ...context, visa: null }));

  // ---------- CLEANUP ----------
  console.log("[CLEANUP] removing test rows");
  // order matters: referrals reference contexts — delete referrals first,
  // then the case (cascades contexts), then the service (cascades attributes)
  await db.delete(referrals).where(eq(referrals.caseId, testCase.id));
  await db.delete(caseContexts).where(eq(caseContexts.caseId, testCase.id));
  await db.delete(cases).where(eq(cases.id, testCase.id));
  await db.delete(services).where(eq(services.id, testService.id));
  const leftoverCases = await db.select().from(cases).where(eq(cases.id, testCase.id));
  const leftoverAttrs = await db
    .select()
    .from(serviceAttributes)
    .where(eq(serviceAttributes.serviceId, testService.id));
  assert("test rows cleaned up (cascades verified)", leftoverCases.length === 0 && leftoverAttrs.length === 0);

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
