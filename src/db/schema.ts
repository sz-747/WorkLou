import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  date,
  check,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Lou's Place casework tool — Phase 1 schema.
 * Follows docs/implementation_plan.md. Do not redesign without updating the plan.
 */

/**
 * Who stated a context field (Phase 5 Refer): the woman herself, or the
 * caseworker's own observation/assessment. Tagged at extraction, editable
 * by the worker during Context review.
 */
export type FieldSource = "woman_stated" | "worker_observation";

/** Lightweight structured case context (see implementation_plan.md decisions #4). */
export type CaseContext = {
  needs: string[];
  suburb: string | null;
  catchment?: string | null;
  children: { count: number } | null;
  pets: { has_pet: boolean; details?: string } | null;
  income: { status?: string; source?: string } | null;
  visa: string | null;
  languages: string[];
  urgency: string | null;
  safety_preferences: string | null;
  safe_contact_method: string | null;
  summary: string | null;
  /** per-field provenance: who stated each field (Phase 5). */
  field_sources?: Record<string, FieldSource> | null;
};

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    organisation: text("organisation"),
    description: text("description"),
    status: text("status").notNull().default("active"),
    website: text("website"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    catchment: text("catchment"),
    sourceType: text("source_type"),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("services_status_check", sql`${t.status} in ('active','needs_review','inactive')`),
    index("services_name_idx").on(t.name),
  ],
);

export const serviceAttributes = pgTable(
  "service_attributes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    attrType: text("attr_type").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    // provenance + freshness
    sourceType: text("source_type").notNull(),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    verificationStatus: text("verification_status").notNull(),
    confirmedBy: text("confirmed_by"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (t) => [
    check(
      "service_attributes_attr_type_check",
      sql`${t.attrType} in ('need','eligibility','delivery','cost','wait_time','language','access')`,
    ),
    check(
      "service_attributes_source_type_check",
      sql`${t.sourceType} in ('machine','excel_import','provider_confirmed','manual')`,
    ),
    check(
      "service_attributes_verification_status_check",
      sql`${t.verificationStatus} in ('verified_machine','needs_provider_confirmation','stale','provider_confirmed','admin_corrected')`,
    ),
    index("service_attributes_lookup_idx").on(t.serviceId, t.attrType, t.key),
  ],
);

/**
 * Append-only change history for service knowledge (Phase 7 admin view).
 * Every admin correction of a service field or a structured fact writes a
 * row here — nothing is ever deleted, so prior values and prior provenance
 * remain inspectable after a fact row is corrected in place.
 */
export const serviceChangeLog = pgTable(
  "service_change_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    /** the fact row this change concerns, when entity='attribute' (plain reference — kept even after the row itself is corrected in place). */
    attributeId: uuid("attribute_id"),
    entity: text("entity").notNull(),
    field: text("field").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changedBy: text("changed_by").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("service_change_log_entity_check", sql`${t.entity} in ('service','attribute')`),
    index("service_change_log_service_idx").on(t.serviceId, t.createdAt),
  ],
);

/**
 * Phase 7A — existing-service updater run log. One row per scheduled or
 * manual run, with counts and a structured log (source fetches ok/failed,
 * candidates created/deduped, freshness refreshes). Failures here never
 * touch canonical service data.
 */
export const updaterRuns = pgTable(
  "updater_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trigger: text("trigger").notNull(),
    status: text("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    servicesChecked: integer("services_checked").notNull().default(0),
    sourcesOk: integer("sources_ok").notNull().default(0),
    sourcesFailed: integer("sources_failed").notNull().default(0),
    candidatesCreated: integer("candidates_created").notNull().default(0),
    candidatesUpdated: integer("candidates_updated").notNull().default(0),
    candidatesSkipped: integer("candidates_skipped").notNull().default(0),
    refreshed: integer("refreshed").notNull().default(0),
    error: text("error"),
    log: jsonb("log").$type<{ at: string; message: string }[]>(),
  },
  (t) => [
    check("updater_runs_trigger_check", sql`${t.trigger} in ('manual','scheduled')`),
    check("updater_runs_status_check", sql`${t.status} in ('running','completed','failed')`),
  ],
);

/**
 * Phase 7A — structured update candidates. A proposed change to canonical
 * service data, with full provenance (source URL, evidence type, retrieval
 * time). Nothing is auto-applied (build plan: "nothing auto-applied without
 * review"): admin approval applies it (canonical rows updated in place +
 * change log), rejection leaves canonical data untouched. At most one
 * pending candidate per service+scope+key (idempotent re-runs update it in
 * place with the latest evidence rather than duplicating).
 */
export const updateCandidates = pgTable(
  "update_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => updaterRuns.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    /** current fact row this change concerns, when scope='attribute' (null = new fact). */
    attributeId: uuid("attribute_id"),
    scope: text("scope").notNull(),
    attrType: text("attr_type"),
    key: text("key").notNull(),
    currentValue: text("current_value"),
    newValue: text("new_value").notNull(),
    sourceType: text("source_type").notNull().default("machine"),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
    evidenceType: text("evidence_type").notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
    status: text("status").notNull().default("pending_review"),
    reason: text("reason"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("update_candidates_scope_check", sql`${t.scope} in ('service_field','attribute')`),
    check(
      "update_candidates_evidence_type_check",
      sql`${t.evidenceType} in ('fixture','direct_fetch','web_unlocker')`,
    ),
    check(
      "update_candidates_status_check",
      sql`${t.status} in ('pending_review','applied','rejected')`,
    ),
    index("update_candidates_pending_idx").on(t.serviceId, t.scope, t.key, t.status),
  ],
);

/**
 * Phase 8 — Excel migration compatibility: staging layer.
 * Lou's existing spreadsheet lands here VERBATIM first (one staged row per
 * spreadsheet line, original values preserved in raw_values). Nothing
 * touches canonical services until a human imports a staged row — the
 * import is non-destructive (it only fills gaps, never overwrites).
 */
export const spreadsheetImports = pgTable("spreadsheet_imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  filename: text("filename").notNull(),
  importedBy: text("imported_by").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  rowCount: integer("row_count").notNull(),
});

/**
 * One staged spreadsheet row. `rawValues` keeps every original cell
 * verbatim (header → original text, incl. unmapped columns); the typed
 * columns hold the mapped canonical view. matchStatus says whether the
 * row matched an existing canonical service (by normalised name) at
 * staging time; outcome records what an import actually did.
 */
export const stagedServices = pgTable(
  "staged_services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    importId: uuid("import_id")
      .notNull()
      .references(() => spreadsheetImports.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    rawValues: jsonb("raw_values").$type<Record<string, string>>().notNull(),
    name: text("name").notNull(),
    organisation: text("organisation"),
    description: text("description"),
    website: text("website"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    catchment: text("catchment"),
    needs: jsonb("needs").$type<string[]>().notNull().default([]),
    matchStatus: text("match_status").notNull(),
    /** plain reference — staged rows survive canonical-service deletion */
    matchedServiceId: uuid("matched_service_id"),
    status: text("status").notNull().default("staged"),
    /** what the import did: fields filled / skipped (with current value) / needs added */
    outcome: jsonb("outcome").$type<{
      mode: "created" | "merged";
      filled: string[];
      skipped: { field: string; current: string }[];
      addedNeeds: string[];
    }>(),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("staged_services_match_status_check", sql`${t.matchStatus} in ('new','matched')`),
    check("staged_services_status_check", sql`${t.status} in ('staged','imported','discarded')`),
    index("staged_services_import_idx").on(t.importId, t.rowNumber),
  ],
);

export const cases = pgTable("cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientRef: text("client_ref").notNull(),
  /**
   * The woman's name, used for every worker-facing screen. client_ref stays the
   * de-identified label used for data (referral text, exports, evaluation).
   */
  clientName: text("client_name"),
  originalNotes: text("original_notes").notNull(),
  appointmentAt: timestamp("appointment_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Append-only record of every raw-note version submitted for extraction. */
export const caseNoteRevisions = pgTable(
  "case_note_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    notes: text("notes").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("case_note_revisions_case_idx").on(t.caseId, t.recordedAt)],
);

/**
 * Case-specific, append-only audit trail of provider confirmations. The
 * shared service fact may be refreshed for reuse, but documentation reads
 * these events so another case's phone call can never leak into this case.
 */
export const providerConfirmationEvents = pgTable(
  "provider_confirmation_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    attributeId: uuid("attribute_id").references(() => serviceAttributes.id, {
      onDelete: "set null",
    }),
    attrType: text("attr_type").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    confirmedBy: text("confirmed_by").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("provider_confirmation_events_case_idx").on(t.caseId, t.confirmedAt),
    index("provider_confirmation_events_service_idx").on(t.serviceId, t.confirmedAt),
  ],
);

export const caseContexts = pgTable(
  "case_contexts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    noteRevisionId: uuid("note_revision_id").references(() => caseNoteRevisions.id, {
      onDelete: "set null",
    }),
    version: integer("version").notNull(),
    context: jsonb("context").$type<CaseContext>().notNull(),
    status: text("status").notNull().default("draft"),
    extractionModel: text("extraction_model"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [
    check("case_contexts_status_check", sql`${t.status} in ('draft','approved')`),
    uniqueIndex("case_contexts_case_version_idx").on(t.caseId, t.version),
  ],
);

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    contextId: uuid("context_id")
      .notNull()
      .references(() => caseContexts.id),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    draftText: text("draft_text"),
    /** which approved-context fields the worker chose to share (Phase 5) */
    sharedFields: jsonb("shared_fields").$type<string[]>(),
    status: text("status").notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    followUpDue: date("follow_up_due"),
    outcome: text("outcome"),
    outcomeNotes: text("outcome_notes"),
    outcomeAt: timestamp("outcome_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "referrals_status_check",
      sql`${t.status} in ('draft','approved','sent','responded','closed')`,
    ),
    check(
      "referrals_outcome_check",
      sql`${t.outcome} is null or ${t.outcome} in ('awaiting_reply','accepted','declined','referred_elsewhere','support_received','other')`,
    ),
    index("referrals_case_idx").on(t.caseId),
  ],
);

/**
 * Follow-up timeline events (Phase 6, step 5A). Append-only history per
 * referral: provider responses, outcomes, and follow-up drafts the worker
 * requested for review. Nothing here is ever transmitted.
 */
export const referralEvents = pgTable(
  "referral_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referralId: uuid("referral_id")
      .notNull()
      .references(() => referrals.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    note: text("note").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "referral_events_kind_check",
      sql`${t.kind} in ('provider_response','outcome','follow_up_draft')`,
    ),
    index("referral_events_referral_idx").on(t.referralId, t.occurredAt),
  ],
);

export const caseDocuments = pgTable(
  "case_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    draftText: text("draft_text").notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [check("case_documents_status_check", sql`${t.status} in ('draft','approved')`)],
);

export const discoveryCandidates = pgTable(
  "discovery_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    sourceUrl: text("source_url"),
    sourceName: text("source_name"),
    dedupKey: text("dedup_key").notNull(),
    extractedData: jsonb("extracted_data"),
    status: text("status").notNull().default("pending_review"),
    /** provenance: how/when the candidate page content was retrieved */
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
    evidenceType: text("evidence_type"),
    /** review decision provenance (who decided and when) */
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "discovery_candidates_status_check",
      sql`${t.status} in ('pending_review','merged','rejected')`,
    ),
    index("discovery_candidates_dedup_idx").on(t.dedupKey),
  ],
);
