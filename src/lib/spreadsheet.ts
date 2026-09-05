/**
 * Phase 8 — Excel migration compatibility.
 * Lou's existing spreadsheet (saved as CSV from Excel) feeds the canonical
 * Postgres schema without forcing an immediate cutover:
 *   1. upload → parse → staged rows (original values preserved verbatim);
 *   2. human review — nothing touches canonical data until a row is imported;
 *   3. import is NON-DESTRUCTIVE by design: new rows create services, matched
 *      rows only FILL empty fields / add missing need facts — a canonical
 *      value is never overwritten (so better-verified data is never lost);
 *   4. the canonical directory exports back to CSV.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  serviceAttributes,
  services,
  spreadsheetImports,
  stagedServices,
} from "../db/schema";
import { logServiceChange } from "./admin";
import { NEEDS_TAXONOMY } from "./extraction";

/** Fields a spreadsheet column can map to (name is required, handled separately). */
export type MappableField =
  | "organisation"
  | "description"
  | "website"
  | "phone"
  | "email"
  | "address"
  | "catchment";

export type MappedRow = {
  name: string;
  organisation: string | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  catchment: string | null;
  needs: string[];
  /** original cell values verbatim, including unmapped columns */
  raw: Record<string, string>;
};

export type SpreadsheetFact = {
  attrType: "eligibility" | "delivery" | "access";
  key: string;
  value: string;
  expiresAt?: Date | null;
};

/** Header aliases (lowercased before matching). */
const HEADER_ALIASES: Record<string, string> = {
  "service name": "name",
  name: "name",
  service: "name",
  provider: "organisation",
  organisation: "organisation",
  organization: "organisation",
  org: "organisation",
  description: "description",
  "what they do": "description",
  summary: "description",
  website: "website",
  web: "website",
  url: "website",
  phone: "phone",
  "phone number": "phone",
  contact: "phone",
  email: "email",
  "e-mail": "email",
  address: "address",
  location: "address",
  suburb: "address",
  location_area: "address",
  catchment: "catchment",
  area: "catchment",
  region: "catchment",
  regions: "catchment",
  catchment_lgas: "catchment",
  "what they help with": "needs",
  needs: "needs",
  "needs help with": "needs",
  "help with": "needs",
  services: "needs",
};

/** Plain-language need labels → taxonomy tokens. */
const NEEDS_ALIASES: Record<string, string> = {
  housing: "housing_accommodation",
  accommodation: "housing_accommodation",
  "crisis accommodation": "housing_accommodation",
  housing_accommodation: "housing_accommodation",
  dfv: "dfv_safety",
  "domestic violence": "dfv_safety",
  "family violence": "dfv_safety",
  dfv_safety: "dfv_safety",
  counselling: "mental_health_counselling",
  counseling: "mental_health_counselling",
  "mental health": "mental_health_counselling",
  mental_health_counselling: "mental_health_counselling",
  financial: "financial",
  money: "financial",
  legal: "legal",
  aod: "aod",
  "alcohol and other drugs": "aod",
  "drugs and alcohol": "aod",
  immigration: "immigration_visa",
  visa: "immigration_visa",
  "immigration and visa": "immigration_visa",
  immigration_visa: "immigration_visa",
  children: "children_family",
  family: "children_family",
  "children and family": "children_family",
  children_family: "children_family",
  health: "health",
  employment: "employment",
  jobs: "employment",
  food: "food_basic_needs",
  "basic needs": "food_basic_needs",
  food_basic_needs: "food_basic_needs",
};

/** Map one plain need label to a taxonomy token (alias → taxonomy; unknown → normalised token). */
export function normaliseNeedToken(label: string): string | null {
  const cleaned = label.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;]$/, "");
  if (!cleaned) return null;
  return NEEDS_ALIASES[cleaned] ?? cleaned.replace(/[\s/-]+/g, "_");
}

function splitTokens(value: string | undefined): string[] {
  return (value ?? "")
    .split(";")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function firstValue(value: string | undefined): string | null {
  return value?.split(";").map((part) => part.trim()).find(Boolean) ?? null;
}

/** Exact prototype columns that state a service capability, not mere text mentions. */
function prototypeNeeds(raw: Record<string, string>): string[] {
  const serviceType = raw.service_type?.trim().toLowerCase();
  const delivery = splitTokens(raw.accommodation_delivery);
  const needs: string[] = [];
  if (
    serviceType === "crisis_accommodation" ||
    serviceType === "referral_only" ||
    delivery.some((value) =>
      [
        "crisis_accommodation",
        "published_accommodation_component",
        "transitional_housing_listed",
        "referral_service",
        "referral_only",
      ].includes(value),
    )
  ) {
    needs.push("housing_accommodation");
  }
  if (serviceType === "residential_rehabilitation") needs.push("aod");
  return needs;
}

function policyValue(value: string | undefined, allowed: string[], excluded: string[]): string {
  const normalised = value?.trim().toLowerCase() ?? "";
  if (allowed.includes(normalised)) return "allowed";
  if (excluded.includes(normalised)) return "not_allowed";
  return "unknown";
}

/** Typed facts from exact prototype columns. Unclear prose remains `unknown`. */
export function mapPrototypeFacts(raw: Record<string, string>): SpreadsheetFact[] {
  const facts: SpreadsheetFact[] = [];
  const add = (attrType: SpreadsheetFact["attrType"], key: string, value: string) =>
    facts.push({ attrType, key, value });

  if ("women_with_children" in raw) {
    add(
      "eligibility",
      "children",
      policyValue(
        raw.women_with_children,
        ["accepted", "yes", "included_in_published_service_scope"],
        ["not_accepted", "no"],
      ),
    );
  }
  if ("pets_on_site" in raw) {
    add(
      "eligibility",
      "pets",
      policyValue(raw.pets_on_site, ["allowed", "yes"], ["not_allowed", "no"]),
    );
  }
  if ("visa_policy" in raw) {
    const visa = raw.visa_policy.trim().toLowerCase();
    add(
      "eligibility",
      "visa",
      visa === "temporary_visa_considered"
        ? "temporary_visa_considered"
        : visa.includes("regardless of residency or visa")
          ? "no_restrictions"
          : "unknown",
    );
  }
  if ("nil_income_policy" in raw) {
    const income = raw.nil_income_policy.trim().toLowerCase();
    add(
      "eligibility",
      "income",
      income === "nil_income_considered"
        ? "nil_income_considered"
        : income.includes("regardless of income")
          ? "no_income"
        : "unknown",
    );
  }
  if (raw.accommodation_delivery?.trim()) {
    add("delivery", "format", raw.accommodation_delivery.trim().toLowerCase());
  }
  if ("wheelchair_access" in raw) {
    add(
      "access",
      "wheelchair",
      policyValue(raw.wheelchair_access, ["accessible"], ["not_accessible"]),
    );
  }
  if ("capacity_status" in raw) {
    const expiry = raw.capacity_expires_at?.trim();
    add("delivery", "capacity", raw.capacity_status.trim().toLowerCase() || "unknown");
    facts[facts.length - 1].expiresAt = expiry && Number.isFinite(Date.parse(expiry))
      ? new Date(expiry)
      : null;
  }
  return facts;
}

/**
 * Minimal RFC4180-ish CSV parser: quoted fields, doubled quotes inside
 * quotes, commas/newlines inside quotes, CRLF or LF line endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      // comma separates fields (semicolons stay literal data)
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

/** Map one spreadsheet row (original headers + cells) to the canonical shape. Null if no name. */
export function mapSpreadsheetRow(headers: string[], row: string[]): MappedRow | null {
  const raw: Record<string, string> = {};
  const mapped: Record<string, string | null> = {
    name: null,
    organisation: null,
    description: null,
    website: null,
    phone: null,
    email: null,
    address: null,
    catchment: null,
    needs: null,
  };
  headers.forEach((h, i) => {
    const value = (row[i] ?? "").trim();
    raw[h] = value; // original preserved verbatim, mapped or not
    const canonical = HEADER_ALIASES[h.trim().toLowerCase()];
    if (canonical && value) mapped[canonical] = value;
  });
  const name = mapped.name;
  if (!name) return null;
  const needs = (mapped.needs ?? "")
    .split(/[;,/]/)
    .map((n) => normaliseNeedToken(n))
    .filter((n): n is string => n !== null);
  const uniqueNeeds = [...new Set([...needs, ...prototypeNeeds(raw)])];
  return {
    name,
    organisation: mapped.organisation,
    description: mapped.description,
    website: mapped.website,
    phone: mapped.phone,
    email: mapped.email,
    address: mapped.address,
    catchment: mapped.catchment,
    needs: uniqueNeeds,
    raw,
  };
}

/** Match key for a service name: lowercase, punctuation stripped, spaces collapsed. */
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Parse spreadsheet text and stage every mapped row. Each row is matched
 * against canonical services by normalised name. Returns the batch
 * summary. Nothing canonical is written.
 */
export async function importSpreadsheetText(input: {
  text: string;
  filename: string;
  importedBy: string;
}): Promise<{ importId: string; rows: number; newRows: number; matchedRows: number }> {
  const table = parseCsv(input.text);
  if (table.length < 2) {
    throw new Error("spreadsheet has no data rows (need a header row + at least one service)");
  }
  const headers = table[0].map((h) => h.trim());
  const mappedRows = table
    .slice(1)
    .map((row, idx) => ({ row, number: idx + 2 })) // +2: 1-based + header
    .map(({ row, number }) => ({ mapped: mapSpreadsheetRow(headers, row), number }))
    .filter((r): r is { mapped: MappedRow; number: number } => r.mapped !== null);
  if (mappedRows.length === 0) {
    throw new Error("no rows with a service name found in the spreadsheet");
  }

  // match against canonical services by normalised name
  const canonical = await db.select({ id: services.id, name: services.name }).from(services);
  const byNameKey = new Map(canonical.map((s) => [nameKey(s.name), s.id]));

  const [batch] = await db
    .insert(spreadsheetImports)
    .values({
      filename: input.filename,
      importedBy: input.importedBy,
      rowCount: mappedRows.length,
    })
    .returning();

  await db.insert(stagedServices).values(
    mappedRows.map(({ mapped, number }) => {
      const matchedServiceId = byNameKey.get(nameKey(mapped.name)) ?? null;
      return {
        importId: batch.id,
        rowNumber: number,
        rawValues: mapped.raw,
        name: mapped.name,
        organisation: mapped.organisation,
        description: mapped.description,
        website: mapped.website,
        phone: mapped.phone,
        email: mapped.email,
        address: mapped.address,
        catchment: mapped.catchment,
        needs: mapped.needs,
        matchStatus: matchedServiceId ? "matched" : "new",
        matchedServiceId,
      };
    }),
  );

  return {
    importId: batch.id,
    rows: mappedRows.length,
    newRows: mappedRows.filter((r) => !byNameKey.has(nameKey(r.mapped.name))).length,
    matchedRows: mappedRows.filter((r) => byNameKey.has(nameKey(r.mapped.name))).length,
  };
}

export type StagedRow = typeof stagedServices.$inferSelect;

/** All staged rows, newest import first, then row number. */
export async function getStagedRows(): Promise<(StagedRow & { importFilename: string })[]> {
  return (
    await db
      .select({ staged: stagedServices, filename: spreadsheetImports.filename })
      .from(stagedServices)
      .innerJoin(spreadsheetImports, eq(stagedServices.importId, spreadsheetImports.id))
      .orderBy(desc(spreadsheetImports.importedAt), stagedServices.rowNumber)
  ).map(({ staged, filename }) => ({ ...staged, importFilename: filename }));
}

const FILLABLE: MappableField[] = [
  "organisation",
  "description",
  "website",
  "phone",
  "email",
  "address",
  "catchment",
];

/**
 * Import one staged row into canonical data — the human decision.
 * NON-DESTRUCTIVE: 'new' rows create a service (excel provenance);
 * 'matched' rows only FILL empty core fields and add MISSING need facts —
 * existing canonical values are never overwritten, so better-verified data
 * (machine, provider-confirmed, admin-corrected) always survives. Every
 * change appends to the service change log. Returns the outcome, or null
 * if the row is unknown or already decided.
 */
export async function importStagedRow(
  stagedId: string,
  importedBy: string,
): Promise<NonNullable<StagedRow["outcome"]> | null> {
  const [staged] = await db.select().from(stagedServices).where(eq(stagedServices.id, stagedId));
  if (!staged || staged.status !== "staged") return null;
  const [batch] = await db
    .select({ filename: spreadsheetImports.filename })
    .from(spreadsheetImports)
    .where(eq(spreadsheetImports.id, staged.importId));

  let outcome: NonNullable<StagedRow["outcome"]>;

  if (staged.matchStatus === "new") {
    const sourceUrl = firstValue(staged.rawValues.source_urls);
    const importedStatus = staged.rawValues.status === "active" ? "active" : "needs_review";
    const [created] = await db
      .insert(services)
      .values({
        name: staged.name,
        organisation: staged.organisation,
        description: staged.description,
        website: staged.website,
        phone: staged.phone,
        email: staged.email,
        address: staged.address,
        catchment: staged.catchment,
        status: importedStatus,
        sourceType: "excel_import",
        sourceName: staged.rawValues.source_name || `Spreadsheet import: ${batch?.filename ?? "unknown file"}`,
        sourceUrl,
      })
      .returning();
    await logServiceChange({
      serviceId: created.id,
      attributeId: null,
      entity: "service",
      field: "service",
      oldValue: null,
      newValue: "created",
      changedBy: importedBy,
      note: `Imported from spreadsheet (staging row ${staged.rowNumber}).`,
    });
    const addedNeeds = await addMissingNeeds(created.id, staged.needs, importedBy, staged.rowNumber, staged.rawValues);
    await addMissingPrototypeFacts(created.id, staged.rawValues, importedBy, staged.rowNumber);
    outcome = { mode: "created", filled: FILLABLE.filter((f) => staged[f]), skipped: [], addedNeeds };
  } else {
    const serviceId = staged.matchedServiceId!;
    const [current] = await db.select().from(services).where(eq(services.id, serviceId));
    if (!current) return null;

    const filled: string[] = [];
    const skipped: { field: string; current: string }[] = [];
    const updates: Record<string, string> = {};
    for (const field of FILLABLE) {
      const value = staged[field];
      if (!value) continue;
      const currentStr = current[field];
      if (currentStr === null || currentStr === "") {
        updates[field] = value;
        filled.push(field);
      } else if (currentStr !== value) {
        // existing canonical value kept — never overwritten by the spreadsheet
        skipped.push({ field, current: currentStr });
      }
    }
    if (Object.keys(updates).length > 0) {
      await db
        .update(services)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(services.id, serviceId));
      for (const field of filled) {
        await logServiceChange({
          serviceId,
          attributeId: null,
          entity: "service",
          field,
          oldValue: null,
          newValue: updates[field],
          changedBy: importedBy,
          note: `Filled from spreadsheet import (staging row ${staged.rowNumber}) — field was empty.`,
        });
      }
    }
    const addedNeeds = await addMissingNeeds(serviceId, staged.needs, importedBy, staged.rowNumber, staged.rawValues);
    await addMissingPrototypeFacts(serviceId, staged.rawValues, importedBy, staged.rowNumber);
    outcome = { mode: "merged", filled, skipped, addedNeeds };
  }

  await db
    .update(stagedServices)
    .set({ status: "imported", outcome, decidedBy: importedBy, decidedAt: new Date() })
    .where(eq(stagedServices.id, stagedId));
  return outcome;
}

async function addMissingPrototypeFacts(
  serviceId: string,
  raw: Record<string, string>,
  importedBy: string,
  rowNumber: number,
): Promise<void> {
  const proposed = mapPrototypeFacts(raw);
  if (proposed.length === 0) return;
  const existing = await db
    .select({ attrType: serviceAttributes.attrType, key: serviceAttributes.key })
    .from(serviceAttributes)
    .where(eq(serviceAttributes.serviceId, serviceId));
  const knownKeys = new Set(existing.map((fact) => `${fact.attrType}:${fact.key}`));
  const toAdd = proposed.filter((fact) => !knownKeys.has(`${fact.attrType}:${fact.key}`));
  if (toAdd.length === 0) return;
  const synthetic = raw.review_state === "synthetic_fixture";
  const retrievedAt = raw.retrieved_at && Number.isFinite(Date.parse(raw.retrieved_at))
    ? new Date(raw.retrieved_at)
    : new Date();
  const inserted = await db
    .insert(serviceAttributes)
    .values(
      toAdd.map((fact) => ({
        serviceId,
        attrType: fact.attrType,
        key: fact.key,
        value: fact.value,
        sourceType: "excel_import" as const,
        sourceName: raw.source_name || "Spreadsheet import",
        sourceUrl: firstValue(raw.source_urls),
        retrievedAt,
        expiresAt: fact.expiresAt,
        verificationStatus:
          fact.expiresAt && fact.expiresAt.getTime() <= Date.now()
            ? "stale"
            : synthetic
              ? "verified_machine"
              : "needs_provider_confirmation",
        notes: `From spreadsheet import (staging row ${rowNumber}).`,
      })),
    )
    .returning({ id: serviceAttributes.id, key: serviceAttributes.key, value: serviceAttributes.value });
  for (const fact of inserted) {
    await logServiceChange({
      serviceId,
      attributeId: fact.id,
      entity: "attribute",
      field: fact.key,
      oldValue: null,
      newValue: fact.value,
      changedBy: importedBy,
      note: `Structured fact added from spreadsheet import (staging row ${rowNumber}).`,
    });
  }
}

/** Add need facts not already recorded. Returns the tokens actually added. */
async function addMissingNeeds(
  serviceId: string,
  needs: string[],
  importedBy: string,
  rowNumber: number,
  raw?: Record<string, string>,
): Promise<string[]> {
  if (needs.length === 0) return [];
  const existing = await db
    .select({ value: serviceAttributes.value })
    .from(serviceAttributes)
    .where(
      // only recorded NEED facts count as known — other fact types are irrelevant
      and(
        eq(serviceAttributes.serviceId, serviceId),
        eq(serviceAttributes.attrType, "need"),
      ),
    );
  const knownValues = new Set(existing.map((a) => a.value));
  const toAdd = needs.filter((n) => !knownValues.has(n));
  if (toAdd.length === 0) return [];
  const synthetic = raw?.review_state === "synthetic_fixture";
  await db.insert(serviceAttributes).values(
    toAdd.map((need) => ({
      serviceId,
      attrType: "need",
      key: "need",
      value: need,
      sourceType: "excel_import",
      sourceName: raw?.source_name || "Spreadsheet import",
      sourceUrl: firstValue(raw?.source_urls),
      retrievedAt: new Date(),
      // spreadsheet data is not verified — provider confirmation still applies
      verificationStatus: synthetic ? "verified_machine" : "needs_provider_confirmation",
      notes: `From spreadsheet import (staging row ${rowNumber}).`,
    })),
  );
  for (const need of toAdd) {
    await logServiceChange({
      serviceId,
      attributeId: null,
      entity: "attribute",
      field: "need",
      oldValue: null,
      newValue: need,
      changedBy: importedBy,
      note: `Need fact added from spreadsheet import (staging row ${rowNumber}) — needs provider confirmation.`,
    });
  }
  return toAdd;
}

/** Discard a staged row — canonical data untouched, decision recorded. */
export async function discardStagedRow(stagedId: string, decidedBy: string): Promise<boolean> {
  const result = await db
    .update(stagedServices)
    .set({ status: "discarded", decidedBy, decidedAt: new Date() })
    .where(
      and(
        // exactly this row — never other batches' staged rows
        eq(stagedServices.id, stagedId),
        // staged-only guard: decided rows are never re-decided
        inArray(stagedServices.status, ["staged"]),
      ),
    )
    .returning({ id: stagedServices.id });
  return result.length > 0;
}

/** Escape one CSV cell (RFC4180). */
function csvCell(value: string | null | undefined): string {
  const v = value ?? "";
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export const EXPORT_HEADERS = [
  "Service name",
  "Organisation",
  "Phone",
  "Email",
  "Website",
  "Address",
  "Catchment",
  "Description",
  "Status",
  "Source",
  "Needs",
] as const;

/** Pure: canonical service rows → CSV text (same column order as EXPORT_HEADERS). */
export function buildServicesCsv(
  rows: {
    name: string;
    organisation: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    catchment: string | null;
    description: string | null;
    status: string;
    sourceType: string | null;
    needs: string[];
  }[],
): string {
  const lines = [EXPORT_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.organisation,
        r.phone,
        r.email,
        r.website,
        r.address,
        r.catchment,
        r.description,
        r.status,
        r.sourceType,
        r.needs.join("; "),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

/** Current canonical service directory (services + recorded needs) for export. */
export async function getServicesForExport() {
  const serviceRows = await db.select().from(services).orderBy(services.name);
  const needRows = await db
    .select({ serviceId: serviceAttributes.serviceId, value: serviceAttributes.value })
    .from(serviceAttributes)
    .where(eq(serviceAttributes.attrType, "need"))
    .orderBy(serviceAttributes.value);
  const needsByService = new Map<string, string[]>();
  for (const n of needRows) {
    const list = needsByService.get(n.serviceId) ?? [];
    list.push(n.value);
    needsByService.set(n.serviceId, list);
  }
  return serviceRows.map((s) => ({
    name: s.name,
    organisation: s.organisation,
    phone: s.phone,
    email: s.email,
    website: s.website,
    address: s.address,
    catchment: s.catchment,
    description: s.description,
    status: s.status,
    sourceType: s.sourceType,
    needs: needsByService.get(s.id) ?? [],
  }));
}

/** Convenience: canonical directory → CSV text. */
export async function exportServicesCsv(): Promise<string> {
  return buildServicesCsv(await getServicesForExport());
}
