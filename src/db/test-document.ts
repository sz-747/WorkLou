/**
 * Phase 6 (step 5B) tests: case documentation. Input building (pure —
 * woman-stated vs worker-observed split, original notes verbatim, follow-up
 * drafts excluded) and the DB flow: draft → edit → approve → guards →
 * persistence. Creates its own test rows and cleans up.
 * Run: npm run db:test:document
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import { caseContexts, caseDocuments, cases, referrals, services, type CaseContext } from "./schema";
import { insertReferralDraft, markReferralSent } from "../lib/refer";
import { recordOutcome, recordProviderResponse } from "../lib/followup";
import {
  approveDocument,
  buildCaseNoteInput,
  getCaseDocuments,
  getProviderConfirmationsForCase,
  insertDocumentDraft,
  saveDocumentDraftText,
  fallbackCaseNoteText,
} from "../lib/document";
import { recordProviderConfirmation } from "../lib/verify";

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

const context: CaseContext = {
  needs: ["housing_accommodation"],
  suburb: "Waterloo",
  children: { count: 2 },
  pets: null,
  income: null,
  visa: "bridging_e",
  languages: ["english"],
  urgency: "high — at risk of homelessness this week",
  safety_preferences: null,
  safe_contact_method: null,
  summary: "Woman needs crisis accommodation.",
  field_sources: {
    needs: "woman_stated",
    suburb: "woman_stated",
    languages: "woman_stated",
    summary: "woman_stated",
    visa: "woman_stated",
    urgency: "worker_observation",
    children: "worker_observation",
  },
};

async function main() {
  console.log("Phase 6 step 5B — Documentation tests");

  // ---------- PURE: buildCaseNoteInput ----------
  console.log("[INPUT] case-note input built from stored data only");

  const input = buildCaseNoteInput({
    clientRef: "CASE-2026-099",
    appointmentAt: "2026-08-31T15:30:00Z",
    originalNotes: "Rough notes: she said she needs housing urgently.",
    context,
    referrals: [
      {
        serviceName: "Test Housing Service",
        status: "responded",
        sentAt: "2026-09-02T03:00:00Z",
        draftText: "Referral text sent to the service.",
        outcome: "support_received",
        outcomeNotes: "Place offered.",
        followUpDue: "2026-09-09",
      },
      {
        serviceName: "Draft Service",
        status: "draft",
        sentAt: null,
        draftText: null,
        outcome: null,
        outcomeNotes: null,
        followUpDue: null,
      },
    ],
    confirmations: [
      {
        serviceName: "Test Housing Service",
        fact: "intake: phone intake Mon-Fri",
        confirmedBy: "Provider on phone",
        confirmedAt: "2026-09-02T01:00:00Z",
      },
    ],
    events: [
      { kind: "provider_response", note: "They called back.", occurredAt: "2026-09-03T01:00:00Z" },
      { kind: "outcome", note: "Support received — Place offered.", occurredAt: "2026-09-04T01:00:00Z" },
      { kind: "follow_up_draft", note: "draft text, NOT activity", occurredAt: "2026-09-05T01:00:00Z" },
    ],
  });

  assert("original notes enter verbatim", input.originalNotes === "Rough notes: she said she needs housing urgently.");
  assert("appointment date uses the Sydney calendar date", input.appointmentDate === "2026-09-01");
  const womanFields = input.womanStated.map((f) => f.field);
  const workerFields = input.workerObservations.map((f) => f.field);
  assert(
    "woman-stated fields separated from worker observations via stored tags",
    womanFields.includes("Visa") && womanFields.includes("Needs") && !womanFields.includes("Urgency"),
  );
  assert(
    "worker-observed fields (urgency, children) land in worker observations only",
    workerFields.includes("Urgency") && workerFields.includes("Children") && !workerFields.includes("Visa"),
  );
  assert(
    "referrals carry only stored data incl. outcome + outcome notes; sent date ISO",
    input.referrals[0].serviceName === "Test Housing Service" &&
      input.referrals[0].sentAt === "2026-09-02" &&
      input.referrals[0].outcome === "Support received" &&
      input.referrals[0].outcomeNotes === "Place offered.",
  );
  assert(
    "provider confirmations included with who/when",
    input.providerConfirmations.length === 1 &&
      input.providerConfirmations[0].confirmedBy === "Provider on phone" &&
      input.providerConfirmations[0].confirmedAt === "2026-09-02",
  );
  assert(
    "follow-up activity: responses + outcomes only, drafts excluded, chronological",
    input.followUpActivity.length === 2 &&
      input.followUpActivity[0].kind === "provider response" &&
      input.followUpActivity[1].kind === "outcome recorded",
  );
  const noContext = buildCaseNoteInput({
    clientRef: "C",
    appointmentAt: "2026-09-01T00:00:00Z",
    originalNotes: "notes",
    context: null,
    referrals: [],
    confirmations: [],
    events: [],
  });
  assert(
    "null context tolerated: empty field lists, note still buildable",
    noContext.womanStated.length === 0 && noContext.workerObservations.length === 0,
  );

  // ---------- DB FLOW ----------
  console.log("[DB] draft → edit → approve → guards → persistence");

  const [testService] = await db
    .insert(services)
    .values({ name: "Doc Test Service", sourceType: "synthetic", sourceName: "doc test" })
    .returning({ id: services.id });
  const [testCase] = await db
    .insert(cases)
    .values({ clientRef: "CASE-DOC-TEST", status: "open", originalNotes: "Original notes for doc test." })
    .returning({ id: cases.id });
  const [ctx] = await db
    .insert(caseContexts)
    .values({ caseId: testCase.id, version: 1, status: "approved", context })
    .returning({ id: caseContexts.id });

  const draftReferralId = await insertReferralDraft({
    caseId: testCase.id,
    contextId: ctx.id,
    serviceId: testService.id,
    draftText: "Referral draft text.",
    sharedFields: ["needs"],
  });
  const sentOk = await markReferralSent(draftReferralId, "2026-09-09");
  assert("sent referral set up", sentOk);
  await recordProviderResponse(draftReferralId, "Provider responded positively.");
  await recordOutcome(draftReferralId, "support_received", "Housing secured.");

  await recordProviderConfirmation({
    caseId: testCase.id,
    attrId: null,
    serviceId: testService.id,
    attrType: "delivery",
    key: "intake",
    value: "phone intake Mon-Fri",
    confirmedBy: "Provider on phone",
    confirmedAt: new Date(),
    notes: null,
  });

  const confirmations = await getProviderConfirmationsForCase(testCase.id);
  assert(
    "provider confirmations for the case's referred services returned",
    confirmations.length === 1 && confirmations[0].serviceName === "Doc Test Service",
  );
  const fallbackNote = fallbackCaseNoteText(input);
  assert(
    "deterministic case-note fallback has every required section in order",
    ["Woman said", "Current concerns", "Actions taken", "Referrals", "Worker observations", "Next steps"]
      .map((heading) => fallbackNote.indexOf(heading))
      .every((position, index, positions) => position >= 0 && (index === 0 || position > positions[index - 1])),
  );

  const [otherCase] = await db
    .insert(cases)
    .values({ clientRef: "CASE-DOC-OTHER", status: "open", originalNotes: "Other case." })
    .returning({ id: cases.id });
  await recordProviderConfirmation({
    caseId: otherCase.id,
    attrId: null,
    serviceId: testService.id,
    attrType: "eligibility",
    key: "pets",
    value: "allowed",
    confirmedBy: "Other provider call",
    confirmedAt: new Date(),
    notes: null,
  });
  const isolatedConfirmations = await getProviderConfirmationsForCase(testCase.id);
  assert(
    "another case's confirmation for the same service never enters this case note",
    isolatedConfirmations.length === 1 &&
      !isolatedConfirmations.some((c) => c.fact.includes("pet policy")),
  );
  await db.delete(cases).where(eq(cases.id, otherCase.id));

  const docId = await insertDocumentDraft(testCase.id, "Draft note text v1.");
  const docs1 = await getCaseDocuments(testCase.id);
  assert(
    "draft persisted with status draft and no approvedAt",
    docs1.length === 1 && docs1[0].status === "draft" && docs1[0].approvedAt === null,
  );

  assert("empty text rejected", !(await saveDocumentDraftText(docId, "   ")));
  assert("worker edits persist", await saveDocumentDraftText(docId, "Edited note text v2."));

  assert("approval works once", await approveDocument(docId));
  const docs2 = await getCaseDocuments(testCase.id);
  assert(
    "approved note persists with status approved + approvedAt stamped",
    docs2[0].status === "approved" && docs2[0].draftText === "Edited note text v2." && docs2[0].approvedAt !== null,
  );
  assert("guard: approved note cannot be edited", !(await saveDocumentDraftText(docId, "sneaky edit")));
  const [immutableApproved] = await db
    .select({ text: caseDocuments.draftText })
    .from(caseDocuments)
    .where(eq(caseDocuments.id, docId));
  assert("guard: rejected edit leaves approved text unchanged", immutableApproved.text === "Edited note text v2.");
  assert("guard: approved note cannot be re-approved", !(await approveDocument(docId)));
  assert("guard: unknown id rejected", !(await approveDocument("00000000-0000-0000-0000-000000000000")));

  const docId2 = await insertDocumentDraft(testCase.id, "Second draft.");
  const docs3 = await getCaseDocuments(testCase.id);
  assert(
    "multiple documents listed newest first, older approved one intact",
    docs3.length === 2 && docs3[0].draftText === "Second draft." && docs3[1].status === "approved",
  );

  const [caseAfter] = await db.select().from(cases).where(eq(cases.id, testCase.id));
  assert(
    "original notes unchanged by all documentation operations",
    caseAfter.originalNotes === "Original notes for doc test.",
  );

  // ---------- CLEANUP ----------
  console.log("[CLEANUP] removing test rows");
  await db.delete(cases).where(eq(cases.id, testCase.id));
  await db.delete(services).where(eq(services.id, testService.id));
  const orphanDocs = await getCaseDocuments(testCase.id);
  const orphanReferrals = await db.select().from(referrals).where(eq(referrals.caseId, testCase.id));
  assert(
    "test rows cleaned up (case delete cascades documents + referrals + context)",
    orphanDocs.length === 0 && orphanReferrals.length === 0,
  );

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
