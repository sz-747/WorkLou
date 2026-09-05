/**
 * Phase 8 tests: Excel migration compatibility — CSV parsing, header/needs
 * mapping, staging (raw values preserved), non-destructive import (fill-only
 * merge, never overwrite), discard, guards, and CSV export of the canonical
 * directory. Creates its own test services/rows and cleans up after itself.
 * Run: npm run db:test:spreadsheet
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { serviceAttributes, services, spreadsheetImports, stagedServices } from "./schema";
import {
  buildServicesCsv,
  discardStagedRow,
  exportServicesCsv,
  importSpreadsheetText,
  importStagedRow,
  mapSpreadsheetRow,
  normaliseNeedToken,
  parseCsv,
} from "../lib/spreadsheet";

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

/** Exercises quoting, doubled quotes, commas-in-quotes, and CRLF. */
const TEST_CSV =
  "Service name,Phone,Email,What they help with,Notes\r\n" +
  '"Existing ""Migration"" Test Service",(02) 9000 0170,intake@test.example.org,"Housing; domestic violence",excel row\r\n' +
  "Brand New Test Service,0412 000 000,,financial,brand new\r\n";

async function main() {
  console.log("Phase 8 — Spreadsheet migration tests");
  console.log("Pure: CSV parsing + mapping");

  const table = parseCsv(TEST_CSV);
  assert("parses header + 2 rows", table.length === 3);
  assert("doubled quotes inside quotes unescaped", table[1][0] === 'Existing "Migration" Test Service');
  assert("comma inside quotes preserved", table[1][1] === "(02) 9000 0170");
  assert("CRLF handled", table[1][5 - 1] === "excel row" && table[2][0] === "Brand New Test Service");
  assert("trailing final line without CRLF parsed", table[2][4] === "brand new");

  const mapped = mapSpreadsheetRow(
    ["Service name", "Phone", "What they help with", "Notes"],
    ["Quoted, Name", "02 0000 0000", "Housing; domestic violence", "note"],
  );
  assert("alias headers map to canonical fields", mapped?.name === "Quoted, Name" && mapped?.phone === "02 0000 0000");
  assert(
    "needs labels map to taxonomy tokens",
    JSON.stringify(mapped?.needs) === '["housing_accommodation","dfv_safety"]',
  );
  assert("unmapped headers preserved verbatim in raw", mapped?.raw["Notes"] === "note");
  assert("row without a service name is skipped", mapSpreadsheetRow(["Phone"], ["02 0000 0000"]) === null);

  assert("needs aliases normalise", normaliseNeedToken("Crisis accommodation") === "housing_accommodation");
  assert("unknown need label becomes a normalised token", normaliseNeedToken("Dog Support Groups") === "dog_support_groups");

  const csvOut = buildServicesCsv([
    {
      name: 'Test "A", Ltd',
      organisation: null,
      phone: "02 0000 0000",
      email: null,
      website: null,
      address: null,
      catchment: null,
      description: null,
      status: "active",
      sourceType: "excel_import",
      needs: ["financial", "legal"],
    },
  ]);
  assert(
    "export CSV escapes quotes/commas and joins needs",
    csvOut.split("\r\n")[1] === '"Test ""A"", Ltd",,02 0000 0000,,,,,,active,excel_import,financial; legal',
  );

  console.log("DB: staging preserves originals; import is non-destructive");

  // fixture canonical service: filled phone (must survive), empty email (fill candidate)
  const [existing] = await db
    .insert(services)
    .values({
      name: "Existing Migration Test Service",
      phone: "(02) 9000 0001",
      sourceType: "excel_import",
      sourceName: "Lous Place Service List (Excel) v3",
    })
    .returning();
  await db.insert(serviceAttributes).values({
    serviceId: existing.id,
    attrType: "need",
    key: "need",
    value: "housing_accommodation",
    sourceType: "excel_import",
    sourceName: "Lous Place Service List (Excel) v3",
    retrievedAt: new Date(),
    verificationStatus: "verified_machine",
  });

  const batch = await importSpreadsheetText({
    text: TEST_CSV,
    filename: "TEST-migration-list.csv",
    importedBy: "Test Runner",
  });
  assert(
    "stages all rows with counts",
    batch.rows === 2 && batch.newRows === 1 && batch.matchedRows === 1,
  );

  const stagedRows = await db
    .select()
    .from(stagedServices)
    .where(eq(stagedServices.importId, batch.importId));
  const matchedRow = stagedRows.find((r) => r.matchStatus === "matched");
  const newRow = stagedRows.find((r) => r.matchStatus === "new");
  assert("matched existing service by normalised name", !!matchedRow?.matchedServiceId);
  assert("new service detected as new", !!newRow && newRow.matchedServiceId === null);
  assert(
    "original values preserved verbatim (incl. unmapped columns)",
    matchedRow?.rawValues["Notes"] === "excel row" &&
      matchedRow?.rawValues["Service name"] === 'Existing "Migration" Test Service',
  );

  // --- import the MATCHED row: fill-only merge ---
  const mergeOutcome = await importStagedRow(matchedRow!.id, "Test Runner");
  assert("matched import reports merged mode", mergeOutcome?.mode === "merged");
  assert("empty field (email) filled from spreadsheet", (mergeOutcome?.filled ?? []).includes("email"));
  assert(
    "non-empty field (phone) kept — not overwritten",
    (mergeOutcome?.skipped ?? []).some((s) => s.field === "phone" && s.current === "(02) 9000 0001"),
  );
  assert(
    "missing need fact added, existing need not duplicated",
    JSON.stringify(mergeOutcome?.addedNeeds) === '["dfv_safety"]',
  );
  const [afterMerge] = await db.select().from(services).where(eq(services.id, existing.id));
  assert(
    "canonical keeps better data: phone unchanged, email filled",
    afterMerge.phone === "(02) 9000 0001" && afterMerge.email === "intake@test.example.org",
  );
  const existingFacts = await db
    .select()
    .from(serviceAttributes)
    .where(eq(serviceAttributes.serviceId, existing.id));
  assert(
    "added need fact carries excel provenance + needs provider confirmation; existing need not duplicated",
    existingFacts.some(
      (f) =>
        f.value === "dfv_safety" &&
        f.sourceType === "excel_import" &&
        f.verificationStatus === "needs_provider_confirmation",
    ) && existingFacts.filter((f) => f.value === "housing_accommodation").length === 1,
  );

  // --- import the NEW row: creates the service ---
  const createOutcome = await importStagedRow(newRow!.id, "Test Runner");
  assert("new import reports created mode", createOutcome?.mode === "created");
  const [created] = await db
    .select()
    .from(services)
    .where(eq(services.name, "Brand New Test Service"));
  assert(
    "canonical service created with excel_import provenance + spreadsheet source",
    !!created &&
      created.sourceType === "excel_import" &&
      created.sourceName === "Spreadsheet import: TEST-migration-list.csv",
  );
  const createdFacts = await db
    .select()
    .from(serviceAttributes)
    .where(eq(serviceAttributes.serviceId, created.id));
  assert(
    "created service got its need fact (needs provider confirmation)",
    createdFacts.some(
      (f) => f.value === "financial" && f.verificationStatus === "needs_provider_confirmation",
    ),
  );

  // --- guards: decided rows are never re-decided ---
  assert("re-import of an imported row rejected", (await importStagedRow(newRow!.id, "Test Runner")) === null);
  assert("discard of an imported row rejected", (await discardStagedRow(newRow!.id, "Test Runner")) === false);

  // --- discard leaves canonical untouched ---
  const [discardTarget] = await db
    .insert(services)
    .values({ name: "Discard Target Service", phone: "02 0000 9999" })
    .returning();
  const discardBatch = await importSpreadsheetText({
    text: "Service name,Phone\r\nDiscard Target Service,0499 999 999\r\n",
    filename: "TEST-discard.csv",
    importedBy: "Test Runner",
  });
  const [discardStaged] = await db
    .select()
    .from(stagedServices)
    .where(eq(stagedServices.importId, discardBatch.importId));
  assert("discard succeeds once", (await discardStagedRow(discardStaged.id, "Test Runner")) === true);
  const [afterDiscard] = await db.select().from(services).where(eq(services.id, discardTarget.id));
  assert("discarded row leaves canonical data untouched", afterDiscard.phone === "02 0000 9999");

  // --- export reflects current canonical data ---
  const exported = await exportServicesCsv();
  const exportLines = exported.split("\r\n");
  assert("export header row", exportLines[0].startsWith("Service name,Organisation,Phone,Email,Website"));
  const existingLine = exportLines.find((l) => l.includes("Existing Migration Test Service"));
  assert(
    "export shows the kept canonical phone + excel-filled email",
    !!existingLine && existingLine.includes("(02) 9000 0001") && existingLine.includes("intake@test.example.org"),
  );
  assert(
    "export includes the imported new service with its needs",
    exportLines.some((l) => l.includes("Brand New Test Service") && l.includes("financial")),
  );

  if (process.env.TEST_NOCLEANUP) {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
    return;
  }
  await db
    .delete(spreadsheetImports)
    .where(inArray(spreadsheetImports.id, [batch.importId, discardBatch.importId]));
  await db
    .delete(services)
    .where(inArray(services.id, [existing.id, created.id, discardTarget.id]));
  // scoped to THIS test's batches — other rows (demo staging) are not ours to check
  const leftovers = await db
    .select({ id: stagedServices.id })
    .from(stagedServices)
    .where(
      inArray(stagedServices.importId, [batch.importId, discardBatch.importId]),
    );
  const [createdGone] = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.name, "Brand New Test Service"));
  assert(
    "cleanup: staged rows + batches + test services removed",
    leftovers.length === 0 && !createdGone,
  );
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
