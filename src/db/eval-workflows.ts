import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { eq, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  caseNoteRevisions,
  cases,
  services,
  spreadsheetImports,
  stagedServices,
  referrals,
  type CaseContext,
} from "./schema";
import { emptyCaseContext, parseExtraction } from "../lib/extraction";
import { getNotesForContext, recordCaseNotes } from "../lib/case-notes";
import { approveContextDraft, createContextDraft, saveContextDraft } from "../lib/context";
import { getLatestApprovedContext, getMatchCandidates, matchServices, type MatchResult } from "../lib/matching";
import { groupFacts, recordProviderConfirmation } from "../lib/verify";
import {
  buildReferralDraftInput,
  defaultFollowUpDate,
  fallbackReferralText,
  getReferralsForCase,
  insertReferralDraft,
  markReferralSent,
  saveReferralDraftText,
} from "../lib/refer";
import {
  getReferralEventsForCase,
  recordOutcome,
  recordProviderResponse,
} from "../lib/followup";
import {
  approveDocument,
  buildCaseNoteInput,
  fallbackCaseNoteText,
  getCaseDocuments,
  getProviderConfirmationsForCase,
  insertDocumentDraft,
  saveDocumentDraftText,
} from "../lib/document";
import { importSpreadsheetText, importStagedRow, parseCsv } from "../lib/spreadsheet";

type Workflow = {
  name: string;
  notes: string;
  context: CaseContext;
  selectedService: string;
  expectedTop?: string;
  excludedService?: string;
  expectedSignal?: { service: string; criterion: string; status: string };
};

const context = (overrides: Partial<CaseContext>): CaseContext => ({
  ...emptyCaseContext(),
  needs: ["housing_accommodation"],
  languages: ["english"],
  summary: "Worker-reviewed synthetic demo context.",
  ...overrides,
});

const workflows: Workflow[] = [
  { name: "Sydney crisis baseline", notes: "Woman in Sydney needs crisis accommodation.", context: context({ suburb: "Sydney", urgency: "medium" }), selectedService: "DEMO Harbour House", expectedTop: "DEMO Harbour House" },
  { name: "Sydney family, pet, temporary visa, nil income", notes: "Woman in Sydney has two children and a dog, a bridging visa, no income, and needs urgent housing.", context: context({ suburb: "Sydney", children: { count: 2 }, pets: { has_pet: true, details: "dog" }, visa: "bridging_e", income: { status: "no_income" }, urgency: "high" }), selectedService: "DEMO Harbour House", expectedTop: "DEMO Harbour House", expectedSignal: { service: "DEMO Harbour House", criterion: "visa", status: "needs_provider_confirmation" } },
  { name: "Parramatta single woman", notes: "Woman in Parramatta needs crisis accommodation and has no children or pets.", context: context({ suburb: "Parramatta", urgency: "medium" }), selectedService: "DEMO Jacaranda Rooms", expectedTop: "DEMO Jacaranda Rooms", expectedSignal: { service: "DEMO Jacaranda Rooms", criterion: "capacity", status: "stale" } },
  { name: "Parramatta parent avoids child exclusion", notes: "Woman in Parramatta needs housing with her child.", context: context({ suburb: "Parramatta", children: { count: 1 }, urgency: "high" }), selectedService: "DEMO Harbour House", excludedService: "DEMO Jacaranda Rooms" },
  { name: "Liverpool family with pet", notes: "Woman in Liverpool needs urgent accommodation with two children and a cat.", context: context({ suburb: "Liverpool", children: { count: 2 }, pets: { has_pet: true, details: "cat" }, urgency: "high" }), selectedService: "DEMO River Family Refuge", expectedTop: "DEMO River Family Refuge" },
  { name: "Hornsby family", notes: "Woman in Hornsby needs accommodation with one child.", context: context({ suburb: "Hornsby", children: { count: 1 }, urgency: "medium" }), selectedService: "DEMO Northside Lodge", expectedTop: "DEMO Northside Lodge" },
  { name: "Sydney referral gateway", notes: "Woman in Sydney wants a housing referral pathway and has one child.", context: context({ suburb: "Sydney", children: { count: 1 }, urgency: "low" }), selectedService: "DEMO Community Housing Hub" },
  { name: "Inner West residential rehabilitation", notes: "Woman in the Inner West is seeking residential alcohol and other drug rehabilitation.", context: context({ needs: ["aod"], suburb: "Inner West", urgency: "medium" }), selectedService: "DEMO Banksia Recovery", expectedTop: "DEMO Banksia Recovery" },
  { name: "Arabic language confirmation", notes: "Arabic-speaking woman in Sydney needs crisis accommodation.", context: context({ suburb: "Sydney", languages: ["arabic"], urgency: "medium" }), selectedService: "DEMO Harbour House", expectedTop: "DEMO Harbour House", expectedSignal: { service: "DEMO Harbour House", criterion: "languages", status: "not_recorded" } },
  { name: "Hornsby pet policy confirmation", notes: "Woman in Hornsby needs housing and has a small dog.", context: context({ suburb: "Hornsby", pets: { has_pet: true, details: "small dog" }, urgency: "high" }), selectedService: "DEMO Northside Lodge", expectedTop: "DEMO Northside Lodge", expectedSignal: { service: "DEMO Northside Lodge", criterion: "pets", status: "needs_provider_confirmation" } },
];

let checks = 0;
function assert(label: string, condition: boolean): void {
  checks++;
  if (!condition) throw new Error(`FAILED: ${label}`);
}

function confirmationValue(key: string, current: string | undefined): string {
  if (key === "children" || key === "pets") return "allowed";
  if (key === "visa") return "no_restrictions";
  if (key === "languages") return "interpreter_available";
  if (key === "income") return "no_income";
  if (key === "wait_time") return "same_day_callback";
  if (key === "capacity") return "call_to_confirm";
  return current && current !== "unknown" ? current : "confirmed";
}

async function main(): Promise<void> {
  const csvPath = process.env.WORKFLOW_CSV_PATH ?? resolve(process.cwd(), "..", "NSW-shelter-prototype-data", "base44_services_import.csv");
  const csv = readFileSync(csvPath, "utf8");
  const table = parseCsv(csv);
  assert("exact CSV has 67 columns", table[0]?.length === 67);
  assert("exact CSV has 226 data rows", table.length - 1 === 226);

  const demoNames = workflows.map((item) => item.selectedService).filter((value, index, all) => all.indexOf(value) === index);
  const existing = await db.select({ name: services.name }).from(services).where(inArray(services.name, demoNames));
  assert("workflow database starts without prior DEMO service rows", existing.length === 0);

  const importIds: string[] = [];
  const caseIds: string[] = [];
  const results: { workflow: string; top: string; selected: string; verifyItems: number; matchMs: number; totalMs: number; status: string }[] = [];
  try {
    for (let i = 0; i < workflows.length; i++) {
      const started = performance.now();
      const workflow = workflows[i];
      const staged = await importSpreadsheetText({ text: csv, filename: "base44_services_import.csv", importedBy: `10-workflow-eval-${i + 1}` });
      importIds.push(staged.importId);
      assert(`${workflow.name}: all 226 CSV rows stage`, staged.rows === 226);
      const stagedRows = await db.select().from(stagedServices).where(eq(stagedServices.importId, staged.importId));
      const demoRows = stagedRows.filter((row) => String(row.rawValues.service_id).startsWith("demo-"));
      assert(`${workflow.name}: six demo fixtures found`, demoRows.length === 6);
      for (const row of demoRows) assert(`${workflow.name}: import ${row.name}`, (await importStagedRow(row.id, `10-workflow-eval-${i + 1}`)) !== null);
      const imported = await db.select().from(services).where(inArray(services.name, demoRows.map((row) => row.name)));
      const serviceIds = imported.map((row) => row.id);
      assert(`${workflow.name}: six unique programs survive import`, imported.length === 6 && new Set(imported.map((row) => row.name)).size === 6);
      assert(`${workflow.name}: provider stays separate from program`, imported.every((row) => row.organisation === "Synthetic demo provider"));

      const appointmentAt = new Date(Date.UTC(2026, 8, 1 + i, 1));
      const [caseRow] = await db.insert(cases).values({ clientRef: `EVAL-${String(i + 1).padStart(2, "0")}`, originalNotes: "Pending note capture", appointmentAt }).returning();
      caseIds.push(caseRow.id);
      const noteRevisionId = await recordCaseNotes(caseRow.id, workflow.notes);
      const reviewedContext = parseExtraction(JSON.stringify(workflow.context));
      const draft = await createContextDraft({ caseId: caseRow.id, noteRevisionId, context: reviewedContext, extractionModel: "deterministic-eval-fixture" });
      assert(`${workflow.name}: context draft edits`, await saveContextDraft(draft.id, reviewedContext));
      assert(`${workflow.name}: context approves`, await approveContextDraft(draft.id));
      assert(`${workflow.name}: approved context is immutable`, !(await saveContextDraft(draft.id, emptyCaseContext())));
      const approved = await getLatestApprovedContext(caseRow.id);
      assert(`${workflow.name}: approved context reloads with note link`, approved?.noteRevisionId === noteRevisionId);

      const candidates = (await getMatchCandidates()).filter((candidate) => serviceIds.includes(candidate.id));
      const matchStarted = performance.now();
      const matches = matchServices(reviewedContext, candidates, new Date("2026-09-06T00:00:00Z"));
      const matchMs = performance.now() - matchStarted;
      const selected = matches.find((result) => result.service.name === workflow.selectedService);
      assert(`${workflow.name}: selected service is suitable`, selected?.suitable === true);
      if (workflow.expectedTop) assert(`${workflow.name}: expected deterministic top result`, matches[0]?.service.name === workflow.expectedTop);
      if (workflow.excludedService) assert(`${workflow.name}: explicit exclusion enforced`, matches.find((result) => result.service.name === workflow.excludedService)?.suitable === false);
      if (workflow.expectedSignal) {
        const signalled = matches.find((result) => result.service.name === workflow.expectedSignal?.service)?.criteria.find((criterion) => criterion.criterion === workflow.expectedSignal?.criterion);
        assert(`${workflow.name}: expected verification signal`, signalled?.status === workflow.expectedSignal.status);
      }

      const chosen = selected as MatchResult;
      const evaluationNow = new Date("2026-09-06T00:00:00Z");
      const verify = groupFacts(reviewedContext, chosen.service.attributes, evaluationNow);
      for (const pending of verify.needsConfirmation) {
        await recordProviderConfirmation({
          caseId: caseRow.id,
          attrId: pending.fact?.id ?? null,
          serviceId: chosen.service.id,
          attrType: pending.attrType,
          key: pending.key,
          value: pending.key === "languages"
            ? reviewedContext.languages[0]
            : confirmationValue(pending.key, pending.fact?.value),
          confirmedBy: "Synthetic provider call",
          confirmedAt: evaluationNow,
          notes: `Verification for ${workflow.name}`,
        });
      }
      const refreshedChosen = (await getMatchCandidates()).find((candidate) => candidate.id === chosen.service.id)!;
      assert(`${workflow.name}: every relevant Verify item resolves`, groupFacts(reviewedContext, refreshedChosen.attributes, evaluationNow).needsConfirmation.length === 0);

      const referralInput = buildReferralDraftInput(reviewedContext, ["needs", "suburb", "languages", "summary"], refreshedChosen, refreshedChosen.attributes);
      const referralId = await insertReferralDraft({ caseId: caseRow.id, contextId: approved!.id, serviceId: chosen.service.id, draftText: fallbackReferralText(referralInput), sharedFields: ["needs", "suburb", "languages", "summary"] });
      assert(`${workflow.name}: referral edit persists`, await saveReferralDraftText(referralId, `${fallbackReferralText(referralInput)}\n\nReviewed by caseworker.`));
      const due = defaultFollowUpDate(new Date("2026-09-06T00:00:00Z"), reviewedContext.urgency);
      assert(`${workflow.name}: referral can be marked sent`, await markReferralSent(referralId, due));
      assert(`${workflow.name}: provider response records`, await recordProviderResponse(referralId, "Provider response recorded for the evaluation."));
      assert(`${workflow.name}: accepted remains open`, await recordOutcome(referralId, "accepted", "Offer made; support not started."));
      const [accepted] = await db.select().from(referrals).where(eq(referrals.id, referralId));
      assert(`${workflow.name}: accepted status is responded`, accepted.status === "responded");
      assert(`${workflow.name}: support received closes`, await recordOutcome(referralId, "support_received", "Support commenced."));

      const referralRows = await getReferralsForCase(caseRow.id);
      const confirmations = await getProviderConfirmationsForCase(caseRow.id);
      const events = await getReferralEventsForCase(caseRow.id);
      const linkedNotes = await getNotesForContext(caseRow.id, approved!.noteRevisionId);
      const docInput = buildCaseNoteInput({ clientRef: caseRow.clientRef, appointmentAt: caseRow.appointmentAt, originalNotes: linkedNotes, context: reviewedContext, referrals: referralRows, confirmations, events });
      const docId = await insertDocumentDraft(caseRow.id, fallbackCaseNoteText(docInput));
      assert(`${workflow.name}: case-note edit persists`, await saveDocumentDraftText(docId, `${fallbackCaseNoteText(docInput)}\n\nReviewed by caseworker.`));
      assert(`${workflow.name}: case note approves`, await approveDocument(docId));
      const docs = await getCaseDocuments(caseRow.id);
      const revisions = await db.select().from(caseNoteRevisions).where(eq(caseNoteRevisions.caseId, caseRow.id));
      assert(`${workflow.name}: final state and raw notes survive`, docs[0]?.status === "approved" && revisions.length === 1 && revisions[0].notes === workflow.notes);

      results.push({ workflow: workflow.name, top: matches[0].service.name, selected: chosen.service.name, verifyItems: verify.needsConfirmation.length, matchMs: Number(matchMs.toFixed(3)), totalMs: Number((performance.now() - started).toFixed(1)), status: "PASS" });

      await db.delete(cases).where(eq(cases.id, caseRow.id));
      await db.delete(services).where(inArray(services.id, serviceIds));
      await db.delete(spreadsheetImports).where(eq(spreadsheetImports.id, staged.importId));
    }

    console.table(results);
    const matchTimes = results.map((result) => result.matchMs).sort((a, b) => a - b);
    console.log(JSON.stringify({ csv: { rows: 226, columns: 67, demoServices: 6 }, workflows: { passed: results.length, total: workflows.length, checks }, matchingLatencyMs: { median: matchTimes[Math.floor(matchTimes.length / 2)], max: Math.max(...matchTimes) }, results }, null, 2));
  } finally {
    if (caseIds.length > 0) await db.delete(cases).where(inArray(cases.id, caseIds));
    await db.delete(services).where(inArray(services.name, demoNames));
    if (importIds.length > 0) await db.delete(spreadsheetImports).where(inArray(spreadsheetImports.id, importIds));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
