/**
 * Phase 7 admin — service-knowledge inspection + correction.
 * The admin can inspect where every fact came from (source/provenance,
 * freshness, provider confirmations) and correct service data. Every
 * correction updates the shared rows in place (caseworker queries see the
 * corrected data immediately) and appends to service_change_log — the
 * prior value and prior provenance are never lost. No analytics, no
 * dashboards: read + edit only.
 */
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  discoveryCandidates,
  serviceAttributes,
  serviceChangeLog,
  services,
} from "../db/schema";

/** Editable core fields of a service (the admin correct-form fields). */
export const SERVICE_FIELDS = [
  "name",
  "organisation",
  "description",
  "status",
  "website",
  "phone",
  "email",
  "address",
  "catchment",
  "sourceName",
  "sourceUrl",
] as const;

export type ServicePatch = Partial<Record<(typeof SERVICE_FIELDS)[number], string | null>>;

export type ServiceOverview = {
  id: string;
  name: string;
  status: string;
  sourceName: string | null;
  sourceType: string | null;
  factCount: number;
  providerConfirmed: number;
  adminCorrected: number;
  /** update candidates: stale or needs-provider-confirmation facts */
  needsAttention: number;
  /** when any of this service's facts was last checked (retrieved or confirmed) */
  lastChecked: Date | null;
};

export type FactDetail = typeof serviceAttributes.$inferSelect;

/** All services with fact aggregates for the admin overview. */
export async function getServicesOverview(): Promise<ServiceOverview[]> {
  const serviceRows = await db.select().from(services).orderBy(services.name);
  const agg = await db
    .select({
      serviceId: serviceAttributes.serviceId,
      factCount: sql<number>`count(*)::int`,
      providerConfirmed: sql<number>`count(*) filter (where ${serviceAttributes.verificationStatus} = 'provider_confirmed')::int`,
      adminCorrected: sql<number>`count(*) filter (where ${serviceAttributes.verificationStatus} = 'admin_corrected')::int`,
      needsAttention: sql<number>`count(*) filter (where ${serviceAttributes.verificationStatus} in ('stale','needs_provider_confirmation') or ${serviceAttributes.value} = 'unknown')::int`,
      lastChecked: sql<Date | null>`greatest(max(${serviceAttributes.retrievedAt}), max(${serviceAttributes.confirmedAt}))`,
    })
    .from(serviceAttributes)
    .groupBy(serviceAttributes.serviceId);
  const byId = new Map(agg.map((a) => [a.serviceId, a]));
  return serviceRows.map((s) => {
    const a = byId.get(s.id);
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      sourceName: s.sourceName,
      sourceType: s.sourceType,
      factCount: a?.factCount ?? 0,
      providerConfirmed: a?.providerConfirmed ?? 0,
      adminCorrected: a?.adminCorrected ?? 0,
      needsAttention: a?.needsAttention ?? 0,
      lastChecked: a?.lastChecked ?? null,
    };
  });
}

/** One service with all its structured facts, for the admin detail page. */
export async function getServiceForAdmin(serviceId: string) {
  const [s] = await db.select().from(services).where(eq(services.id, serviceId));
  if (!s) return null;
  const facts = await db
    .select()
    .from(serviceAttributes)
    .where(eq(serviceAttributes.serviceId, serviceId))
    .orderBy(serviceAttributes.attrType, serviceAttributes.key);
  return { service: s, facts };
}

/** Append-only change history for one service, newest first. */
export async function getChangeHistory(serviceId: string) {
  return db
    .select()
    .from(serviceChangeLog)
    .where(eq(serviceChangeLog.serviceId, serviceId))
    .orderBy(desc(serviceChangeLog.createdAt), serviceChangeLog.id);
}

/** The discovery queue (Phase 7B) — inspectable here, merge/reject arrives with 7B. */
export async function getDiscoveryCandidates() {
  return db.select().from(discoveryCandidates).orderBy(desc(discoveryCandidates.createdAt));
}

/** Shared append-only change-log writer (admin corrections + updater applies). */
export async function logServiceChange(entry: {
  serviceId: string;
  attributeId: string | null;
  entity: "service" | "attribute";
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  note: string | null;
}) {
  await db.insert(serviceChangeLog).values(entry);
}

/**
 * Correct a service's core fields. Only actually-changed fields are
 * updated and logged; updated_at is refreshed. Returns the number of
 * changed fields (0 = nothing changed / unknown service).
 */
export async function updateServiceAdmin(input: {
  serviceId: string;
  patch: ServicePatch;
  changedBy: string;
}): Promise<number> {
  const [current] = await db.select().from(services).where(eq(services.id, input.serviceId));
  if (!current) return 0;

  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
  const updates: Record<string, string | null> = {};
  for (const field of SERVICE_FIELDS) {
    const next = input.patch[field];
    if (next === undefined) continue;
    const old = current[field as keyof typeof current];
    const oldStr = old === null || old === undefined ? null : String(old);
    if (next === oldStr) continue;
    if (field === "name" && !next) continue; // name is required
    if (field === "status" && next && !["active", "needs_review", "inactive"].includes(next))
      continue;
    changes.push({ field, oldValue: oldStr, newValue: next });
    updates[field] = next;
  }

  if (changes.length > 0) {
    await db
      .update(services)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(services.id, input.serviceId));
    for (const c of changes) {
      await logServiceChange({
        serviceId: input.serviceId,
        attributeId: null,
        entity: "service",
        changedBy: input.changedBy,
        note: null,
        ...c,
      });
    }
  }
  return changes.length;
}

/**
 * Correct one structured fact's value. Updates the existing row in place
 * (never a parallel duplicate) so caseworker queries immediately use the
 * corrected data, and logs value/source/notes changes — prior provenance
 * (source_type, source_name) is preserved in the change log.
 * Returns the updated row, or null for an unknown fact / invalid value.
 */
export async function correctServiceAttribute(input: {
  attrId: string;
  value: string;
  notes: string | null;
  changedBy: string;
}): Promise<FactDetail | null> {
  const [current] = await db
    .select()
    .from(serviceAttributes)
    .where(eq(serviceAttributes.id, input.attrId));
  if (!current) return null;
  const value = input.value.trim();
  if (!value) return null;

  const updates: Record<string, unknown> = {
    value,
    sourceType: "manual",
    sourceName: "Admin correction",
    retrievedAt: new Date(),
    verificationStatus: "admin_corrected",
  };
  if (input.notes !== null) updates.notes = input.notes;

  // log what is being replaced, so the original provenance stays inspectable
  const logRows: { field: string; oldValue: string | null; newValue: string | null }[] = [
    { field: "value", oldValue: current.value, newValue: value },
    { field: "source_type", oldValue: current.sourceType, newValue: "manual" },
    { field: "source_name", oldValue: current.sourceName, newValue: "Admin correction" },
    { field: "verification_status", oldValue: current.verificationStatus, newValue: "admin_corrected" },
  ];
  if (input.notes !== null && input.notes !== current.notes) {
    logRows.push({ field: "notes", oldValue: current.notes, newValue: input.notes });
  }

  await db.update(serviceAttributes).set(updates).where(eq(serviceAttributes.id, input.attrId));
  for (const r of logRows) {
    await logServiceChange({
      serviceId: current.serviceId,
      attributeId: current.id,
      entity: "attribute",
      changedBy: input.changedBy,
      note: null,
      ...r,
    });
  }

  const [updated] = await db
    .select()
    .from(serviceAttributes)
    .where(eq(serviceAttributes.id, input.attrId));
  return updated;
}
