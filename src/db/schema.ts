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
} from "drizzle-orm/pg-core";

/**
 * Lou's Place casework tool — Phase 1 schema.
 * Follows docs/implementation_plan.md. Do not redesign without updating the plan.
 */

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
      sql`${t.verificationStatus} in ('verified_machine','needs_provider_confirmation','stale','provider_confirmed')`,
    ),
    index("service_attributes_lookup_idx").on(t.serviceId, t.attrType, t.key),
  ],
);

export const cases = pgTable("cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientRef: text("client_ref").notNull(),
  originalNotes: text("original_notes").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const caseContexts = pgTable(
  "case_contexts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    context: jsonb("context").$type<CaseContext>().notNull(),
    status: text("status").notNull().default("draft"),
    extractionModel: text("extraction_model"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [
    check("case_contexts_status_check", sql`${t.status} in ('draft','approved')`),
    index("case_contexts_case_idx").on(t.caseId, t.version),
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
      sql`${t.outcome} is null or ${t.outcome} in ('accepted','declined','no_response','other')`,
    ),
    index("referrals_case_idx").on(t.caseId),
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
