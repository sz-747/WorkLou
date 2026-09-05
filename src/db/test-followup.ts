/**
 * Phase 6 (step 5A) tests: follow-up tracking. Outcome validation (pure),
 * follow-up draft input building (pure), and the DB flow: sent referral →
 * provider response → outcome → guards → due-follow-ups query. Creates its
 * own test rows and cleans up.
 * Run: npm run db:test:followup
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { caseContexts, cases, referralEvents, referrals, services } from "./schema";
import { markReferralSent, insertReferralDraft } from "../lib/refer";
import {
  OUTCOMES,
  buildFollowUpDraftInput,
  getDueFollowUps,
  getReferralEvents,
  getReferralEventsForCase,
  isFinalOutcome,
  isValidOutcome,
  outcomeLabel,
  recordOutcome,
  recordProviderResponse,
  referralIsOpen,
  storeFollowUpDraft,
} from "../lib/followup";

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
const daysFromNow = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

const context = {
  needs: ["housing_accommodation"],
  suburb: "Waterloo",
  children: null,
  pets: null,
  income: null,
  visa: null,
  languages: ["english"],
  urgency: null,
  safety_preferences: null,
  safe_contact_method: null,
  summary: "Woman needs crisis accommodation.",
};

async function main() {
  console.log("Phase 6 step 5A — Follow-up tests");

  // ---------- PURE: outcomes ----------
  console.log("[OUTCOMES] validation and semantics");

  assert(
    "requested outcome options exist: awaiting reply, accepted, declined, referred elsewhere, support received",
    ["awaiting_reply", "accepted", "declined", "referred_elsewhere", "support_received"].every(
      (v) => isValidOutcome(v),
    ),
  );
  assert("invalid outcome values rejected", !isValidOutcome("nope") && !isValidOutcome(""));
  assert(
    "awaiting reply is the only non-final outcome (keeps referral open); others close it",
    !isFinalOutcome("awaiting_reply") &&
      ["accepted", "declined", "referred_elsewhere", "support_received"].every(isFinalOutcome),
  );
  assert(
    "support received has its own label, distinct from accepted",
    outcomeLabel("support_received") === "Support received" &&
      outcomeLabel("accepted") === "Accepted" &&
      OUTCOMES.filter((o) => o.value === "support_received").length === 1,
  );
  assert("referralIsOpen: sent/responded open, draft/closed not", referralIsOpen("sent") && referralIsOpen("responded") && !referralIsOpen("draft") && !referralIsOpen("closed"));

  // ---------- PURE: follow-up draft input ----------
  console.log("[DRAFT INPUT] stored referral data only");

  const draftInput = buildFollowUpDraftInput(
    {
      serviceName: "Watershed Women's Crisis Accommodation",
      clientRef: "CASE-2026-001",
      sentAt: daysAgo(3),
      draftText: "Referral text that was sent to the provider.",
      status: "responded",
      outcome: null,
    },
    [
      { kind: "provider_response", note: "Provider asked for more time.", occurredAt: daysAgo(1) },
      { kind: "follow_up_draft", note: "draft text", occurredAt: daysAgo(1) },
      { kind: "outcome", note: "Outcome recorded", occurredAt: daysAgo(1) },
    ],
  );
  assert(
    "draft input carries service, case ref, sent date, referral text, status",
    draftInput.serviceName === "Watershed Women's Crisis Accommodation" &&
      draftInput.clientRef === "CASE-2026-001" &&
      draftInput.sentAt === new Date(daysAgo(3)).toISOString().slice(0, 10) &&
      draftInput.referralText === "Referral text that was sent to the provider." &&
      draftInput.status === "responded",
  );
  assert(
    "only provider responses enter the draft input (drafts/outcomes excluded)",
    draftInput.responses.length === 1 && draftInput.responses[0].note === "Provider asked for more time.",
  );

  // ---------- DB FLOW: sent → response → outcome → guards → due query ----------
  console.log("[FOLLOW-UP FLOW] response, outcome, timeline, guards, My Work due list");

  const [testService] = await db
    .insert(services)
    .values({
      name: "TEST Follow-up Service",
      organisation: "Test (cleaned up)",
      description: "Temporary test service for follow-up tests.",
      status: "active",
      sourceType: "manual",
      sourceName: "test",
    })
    .returning();

  const [testCase] = await db
    .insert(cases)
    .values({ clientRef: "TEST-FOLLOWUP-001", originalNotes: "test notes", status: "open" })
    .returning();

  const [approvedCtx] = await db
    .insert(caseContexts)
    .values({ caseId: testCase.id, version: 1, context, status: "approved", approvedAt: daysAgo(0) })
    .returning();

  // a referral still in draft — follow-up actions must reject it
  const draftReferralId = await insertReferralDraft({
    caseId: testCase.id,
    contextId: approvedCtx.id,
    serviceId: testService.id,
    draftText: "Draft, never sent.",
    sharedFields: ["needs"],
  });

  // sent with follow-up due TODAY → must appear in My Work
  const dueReferralId = await insertReferralDraft({
    caseId: testCase.id,
    contextId: approvedCtx.id,
    serviceId: testService.id,
    draftText: "Sent yesterday, follow-up due today.",
    sharedFields: ["needs"],
  });
  await markReferralSent(dueReferralId, today());

  // sent with follow-up in the FUTURE → must NOT appear
  const futureReferralId = await insertReferralDraft({
    caseId: testCase.id,
    contextId: approvedCtx.id,
    serviceId: testService.id,
    draftText: "Sent yesterday, follow-up next week.",
    sharedFields: ["needs"],
  });
  await markReferralSent(futureReferralId, daysFromNow(7));

  assert(
    "My Work due list: today-due referral listed, future-dated and draft referrals not",
    (await getDueFollowUps()).some((f) => f.referralId === dueReferralId) &&
      !(await getDueFollowUps()).some((f) => f.referralId === futureReferralId) &&
      !(await getDueFollowUps()).some((f) => f.referralId === draftReferralId),
  );

  assert(
    "guard: responses and outcomes rejected on draft referrals",
    !(await recordProviderResponse(draftReferralId, "nope")) &&
      !(await recordOutcome(draftReferralId, "accepted", null)),
  );

  // worker records what the provider said
  const resp1 = await recordProviderResponse(dueReferralId, "Provider asked for more time.");
  const [afterResp] = await db.select().from(referrals).where(eq(referrals.id, dueReferralId));
  assert(
    "provider response saved: status sent → responded, timeline event created",
    resp1 && afterResp.status === "responded" && (await getReferralEvents(dueReferralId)).length === 1,
  );
  const resp2 = await recordProviderResponse(dueReferralId, "Provider confirmed a place may open next week.");
  assert(
    "a second response can be recorded on a responded referral",
    resp2 && (await getReferralEvents(dueReferralId)).length === 2,
  );

  // follow-up draft stored for review (deterministic text; LLM not exercised here)
  const storedDraft = await storeFollowUpDraft(dueReferralId, "Deterministic follow-up draft for review.");
  assert(
    "follow-up draft stored as a timeline event, not sent anywhere",
    storedDraft &&
      (await getReferralEvents(dueReferralId)).some(
        (e) => e.kind === "follow_up_draft" && e.note === "Deterministic follow-up draft for review.",
      ),
  );

  // awaiting reply keeps the referral open
  const ar = await recordOutcome(dueReferralId, "awaiting_reply", "Chasing weekly.");
  const [afterAwaiting] = await db.select().from(referrals).where(eq(referrals.id, dueReferralId));
  assert(
    "outcome awaiting reply: outcome persisted, referral stays open (responded)",
    ar && afterAwaiting.outcome === "awaiting_reply" && afterAwaiting.status === "responded" && referralIsOpen(afterAwaiting.status),
  );
  assert(
    "awaiting-reply referral with due follow-up still listed in My Work",
    (await getDueFollowUps()).some((f) => f.referralId === dueReferralId && f.outcome === "awaiting_reply"),
  );

  // final outcome closes it
  const sr = await recordOutcome(dueReferralId, "support_received", "Woman moved in on Monday.");
  const [afterSupport] = await db.select().from(referrals).where(eq(referrals.id, dueReferralId));
  const eventsAfter = await getReferralEvents(dueReferralId);
  assert(
    "outcome support received: persists outcome + notes + outcome_at, closes referral, timelines the outcome",
    sr &&
      afterSupport.outcome === "support_received" &&
      afterSupport.outcomeNotes === "Woman moved in on Monday." &&
      !!afterSupport.outcomeAt &&
      afterSupport.status === "closed" &&
      eventsAfter.some((e) => e.kind === "outcome" && e.note.includes("Support received")),
  );
  assert(
    "closed referral leaves the My Work due list (support received ≠ merely sent)",
    !(await getDueFollowUps()).some((f) => f.referralId === dueReferralId),
  );

  // guards once closed
  assert(
    "guard: closed referral accepts no further responses or outcomes",
    !(await recordProviderResponse(dueReferralId, "late reply")) &&
      !(await recordOutcome(dueReferralId, "declined", "too late")) &&
      !(await storeFollowUpDraft(dueReferralId, "draft after close")),
  );

  const caseEvents = await getReferralEventsForCase(testCase.id);
  const dueEventTimes = caseEvents
    .filter((e) => e.referralId === dueReferralId)
    .map((e) => new Date(e.occurredAt).getTime());
  assert(
    "case-level timeline query returns events for the case in chronological order",
    caseEvents.length === 5 && dueEventTimes.every((t, i) => i === 0 || t >= dueEventTimes[i - 1]),
  );

  // ---------- CLEANUP ----------
  console.log("[CLEANUP] removing test rows");
  await db.delete(referralEvents).where(
    inArray(
      referralEvents.referralId,
      [draftReferralId, dueReferralId, futureReferralId],
    ),
  );
  await db.delete(referrals).where(eq(referrals.caseId, testCase.id));
  await db.delete(caseContexts).where(eq(caseContexts.caseId, testCase.id));
  await db.delete(cases).where(eq(cases.id, testCase.id));
  await db.delete(services).where(eq(services.id, testService.id));
  const leftovers = await db.select().from(referralEvents).where(
    inArray(referralEvents.referralId, [draftReferralId, dueReferralId, futureReferralId]),
  );
  assert("test rows cleaned up (no orphan events)", leftovers.length === 0);

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
