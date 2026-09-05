/**
 * Phase 2 tests: extraction mapping (pure) + context draft/edit/approve DB flow.
 * Creates its own test rows and cleans up after itself. Run: npm run db:test:context
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { caseContexts, caseNoteRevisions, cases, type CaseContext } from "./schema";
import { emptyCaseContext, parseExtraction } from "../lib/extraction";
import { contextFromFormData } from "../lib/context-form";
import { getNotesForContext, recordCaseNotes } from "../lib/case-notes";

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
  console.log("Phase 2 — Context tests");

  // ---------- EXTRACTION MAPPING (pure, no LLM) ----------
  console.log("[EXTRACT MAP] parseExtraction normalisation");

  const plain = parseExtraction(
    JSON.stringify({
      needs: ["Housing / Accommodation", "dfv_safety"],
      suburb: "Waterloo",
      catchment: "Inner South Sydney",
      children: { count: 2 },
      pets: { has_pet: true, details: "dog" },
      income: { status: "low", source: "casual part-time" },
      visa: "bridging_e",
      languages: ["English", "Arabic"],
      urgency: "HIGH",
      safety_preferences: "No calls to main number",
      safe_contact_method: "SMS",
      summary: "Woman escaping DFV needs urgent crisis accommodation.",
    }),
  );
  assert("needs normalised to taxonomy tokens", plain.needs[0] === "housing_accommodation" && plain.needs[1] === "dfv_safety");
  assert("languages lowercased", plain.languages.join(",") === "english,arabic");
  assert("urgency lowercased", plain.urgency === "high");
  assert("safe contact method snake-cased", plain.safe_contact_method === "sms");
  assert("children mapped", plain.children?.count === 2);
  assert("pets mapped with details", plain.pets?.has_pet === true && plain.pets?.details === "dog");
  assert("income mapped", plain.income?.status === "low");

  const fenced = parseExtraction(
    'Here is the JSON:\n```json\n{"needs":["financial"],"children":3,"urgency":"medium"}\n```',
  );
  assert("fenced + prose-wrapped JSON parsed", fenced.needs[0] === "financial");
  assert("children as plain number mapped", fenced.children?.count === 3);
  assert("urgency medium kept", fenced.urgency === "medium");
  assert("unmentioned fields become null", fenced.suburb === null && fenced.visa === null);
  assert("unmentioned lists become empty", fenced.languages.length === 0);

  const unknown = parseExtraction('{"needs":["education_support"],"safe_contact_method":"Email"}');
  assert(
    "unknown need kept (worker reviews; never silently dropped)",
    unknown.needs.includes("education_support"),
  );
  assert("invalid urgency dropped to null", parseExtraction('{"urgency":"soon"}').urgency === null);

  // ---------- PURE: draft-review form mapping keeps field_sources ----------
  console.log("[FORM MAP] contextFromFormData keeps worker-corrected field_sources");
  {
    const fd = new FormData();
    fd.set("needs", "housing_accommodation, DFV safety");
    fd.set("suburb", "Waterloo");
    fd.set("languages", "English, Arabic");
    fd.set("summary", "Needs urgent crisis accommodation.");
    fd.set("childrenCount", "2");
    fd.set("petHas", "yes");
    fd.set("petDetails", "dog");
    fd.set("incomeStatus", "low");
    fd.set("incomeSource", "casual part-time");
    fd.set("visa", "bridging_e");
    fd.set("urgency", "high");
    fd.set("safetyPreferences", "No calls to main number");
    fd.set("safeContactMethod", "sms");
    // worker corrections: urgency and safe-contact are worker observations
    fd.set("source_urgency", "worker_observation");
    fd.set("source_safe_contact_method", "worker_observation");

    const saved = contextFromFormData(fd);
    assert(
      "form values mapped (needs tokens, children, pets)",
      saved.needs[0] === "housing_accommodation" &&
        saved.needs[1] === "dfv_safety" &&
        saved.children?.count === 2 &&
        saved.pets?.has_pet === true &&
        saved.pets?.details === "dog",
    );
    assert(
      "worker-corrected tags kept on save (regression: never dropped)",
      saved.field_sources?.urgency === "worker_observation" &&
        saved.field_sources?.safe_contact_method === "worker_observation",
    );
    assert(
      "untagged fields default to woman-stated",
      saved.field_sources?.needs === "woman_stated" &&
        saved.field_sources?.suburb === "woman_stated",
    );
    assert(
      "fields with no recorded value carry no tag",
      contextFromFormData(new FormData()).field_sources !== undefined &&
        Object.keys(contextFromFormData(new FormData()).field_sources ?? {}).length === 0,
    );

    // a DB round-trip of the mapped context preserves the tags
    const [tagCase] = await db
      .insert(cases)
      .values({ clientRef: "TEST-FORMMAP-001", originalNotes: "n", status: "open" })
      .returning();
    const [tagCtx] = await db
      .insert(caseContexts)
      .values({ caseId: tagCase.id, version: 1, context: saved, status: "draft" })
      .returning();
    const [back] = await db.select().from(caseContexts).where(eq(caseContexts.id, tagCtx.id));
    assert(
      "tags persist through a DB round-trip",
      back.context.field_sources?.urgency === "worker_observation" &&
        back.context.field_sources?.suburb === "woman_stated",
    );
    await db.delete(cases).where(eq(cases.id, tagCase.id));
  }

  // ---------- DB FLOW: draft → edit → approve → re-extract ----------
  console.log("[CONTEXT FLOW] draft / edit / approve / re-extract versioning");

  const [testCase] = await db
    .insert(cases)
    .values({
      clientRef: "TEST-CTX-001",
      originalNotes: "Test notes — needs housing, two kids, cat.",
      status: "open",
    })
    .returning();

  // raw notes persist as a current snapshot and immutable history
  await recordCaseNotes(testCase.id, "Updated test notes — needs housing urgently, two kids, cat.");
  const secondRevisionId = await recordCaseNotes(testCase.id, "Second note version — corrected pet to dog.");
  const [caseAfterNotes] = await db.select().from(cases).where(eq(cases.id, testCase.id));
  const noteHistory = await db
    .select()
    .from(caseNoteRevisions)
    .where(eq(caseNoteRevisions.caseId, testCase.id))
    .orderBy(caseNoteRevisions.recordedAt);
  assert(
    "raw-note edits keep an immutable history while the case shows the latest snapshot",
    caseAfterNotes.originalNotes === "Second note version — corrected pet to dog." &&
      noteHistory.length === 2 &&
      noteHistory[0].notes.startsWith("Updated test notes") &&
      noteHistory[1].notes.startsWith("Second note version"),
  );
  const manual = emptyCaseContext();
  assert(
    "manual fallback context is empty, editable, and never invents facts",
    manual.needs.length === 0 && manual.languages.length === 0 && manual.summary === null,
  );

  // extraction creates a NEW draft version (v1)
  const draftContext: CaseContext = {
    needs: ["housing_accommodation"],
    suburb: "Waterloo",
    catchment: null,
    children: { count: 2 },
    pets: { has_pet: true, details: "cat" },
    income: null,
    visa: null,
    languages: ["english"],
    urgency: "high",
    safety_preferences: null,
    safe_contact_method: null,
    summary: "Test draft context.",
  };
  const [v1] = await db
    .insert(caseContexts)
    .values({
      caseId: testCase.id,
      noteRevisionId: secondRevisionId,
      version: 1,
      context: draftContext,
      status: "draft",
      extractionModel: "test-model",
    })
    .returning();
  assert("extraction saved as clearly-marked draft", v1.status === "draft" && v1.extractionModel === "test-model");
  assert("context is linked to the exact raw-note revision it was extracted from", v1.noteRevisionId === secondRevisionId);
  assert("draft has no approved_at", v1.approvedAt === null);

  // worker edits the draft in place (draft rows only)
  const edited: CaseContext = { ...draftContext, suburb: "Marrickville", urgency: "medium" };
  await db
    .update(caseContexts)
    .set({ context: edited })
    .where(and(eq(caseContexts.id, v1.id), eq(caseContexts.status, "draft")));
  const [v1Edited] = await db.select().from(caseContexts).where(eq(caseContexts.id, v1.id));
  assert("worker edit saved on the draft", v1Edited.context.suburb === "Marrickville");
  assert("edited row is still a draft", v1Edited.status === "draft");

  // approve (drafts only), approved_at set
  await db
    .update(caseContexts)
    .set({ status: "approved", approvedAt: new Date() })
    .where(and(eq(caseContexts.id, v1.id), eq(caseContexts.status, "draft")));
  const [v1Approved] = await db.select().from(caseContexts).where(eq(caseContexts.id, v1.id));
  assert("approval state persists with timestamp", v1Approved.status === "approved" && !!v1Approved.approvedAt);
  const thirdRevisionId = await recordCaseNotes(testCase.id, "New notes for a later, unapproved extraction.");
  assert(
    "approved context keeps its own notes when the case receives newer raw notes",
    (await getNotesForContext(testCase.id, v1Approved.noteRevisionId)) ===
      "Second note version — corrected pet to dog.",
  );

  // guard: editing with the draft-only guard must NOT touch the approved row
  const guardedEdit: CaseContext = { ...edited, suburb: "SHOULD NOT APPLY" };
  await db
    .update(caseContexts)
    .set({ context: guardedEdit })
    .where(and(eq(caseContexts.id, v1.id), eq(caseContexts.status, "draft")));
  const [v1AfterGuard] = await db.select().from(caseContexts).where(eq(caseContexts.id, v1.id));
  assert("approved row is never silently overwritten", v1AfterGuard.context.suburb === "Marrickville" && v1AfterGuard.status === "approved");

  // re-extraction after approval creates v2 draft; v1 stays intact
  const [v2] = await db
    .insert(caseContexts)
    .values({
      caseId: testCase.id,
      noteRevisionId: thirdRevisionId,
      version: 2,
      context: { ...edited, urgency: "high" },
      status: "draft",
      extractionModel: "test-model",
    })
    .returning();
  const versions = await db
    .select()
    .from(caseContexts)
    .where(eq(caseContexts.caseId, testCase.id))
    .orderBy(caseContexts.version);
  assert(
    "re-extraction supersedes (v2 draft), never mutates v1",
    versions.length === 2 && versions[1].status === "draft" && versions[0].status === "approved" && versions[0].context.suburb === "Marrickville",
  );

  // reload query: latest context for the case
  const [latest] = await db
    .select()
    .from(caseContexts)
    .where(eq(caseContexts.caseId, testCase.id))
    .orderBy(sql`${caseContexts.version} desc`)
    .limit(1);
  assert("reload shows latest context with correct version/status", latest.version === 2 && latest.status === "draft");

  // ---------- CLEANUP ----------
  console.log("[CLEANUP] removing test rows");
  await db.delete(caseContexts).where(eq(caseContexts.caseId, testCase.id));
  await db.delete(cases).where(eq(cases.id, testCase.id));
  const leftover = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cases)
    .where(eq(cases.clientRef, "TEST-CTX-001"));
  assert("test rows cleaned up (cascade checked)", (leftover[0]?.count ?? 0) === 0);

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
