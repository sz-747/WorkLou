/**
 * Phase 1 synthetic seed. Idempotent: exits if data already present.
 * Provenance rules (docs/implementation_plan.md): every service fact carries
 * source + freshness; machine facts vs provider-only facts are distinguished.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import {
  cases,
  caseContexts,
  caseworkerSettings,
  referrals,
  serviceAttributes,
  serviceChangeLog,
  services,
} from "./schema";

const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

const sydneyDate = (date: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

/** Keep one realistic, idempotent follow-up visible on My Work. */
async function ensureDemoFollowUp() {
  const [caseRow] = await db
    .select({ id: cases.id, clientName: cases.clientName, clientEmail: cases.clientEmail })
    .from(cases)
    .where(eq(cases.clientRef, "CASE-2026-001"))
    .limit(1);
  const [serviceRow] = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.name, "Watershed Women's Crisis Accommodation"))
    .limit(1);
  if (!caseRow || !serviceRow) return;

  if (!caseRow.clientName) {
    await db.update(cases).set({ clientName: "Amira" }).where(eq(cases.id, caseRow.id));
  }
  if (!caseRow.clientEmail) {
    await db.update(cases).set({ clientEmail: "amira@example.org" }).where(eq(cases.id, caseRow.id));
  }

  const [existing] = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(and(eq(referrals.caseId, caseRow.id), eq(referrals.serviceId, serviceRow.id)))
    .limit(1);
  if (existing) return;

  const [contextRow] = await db
    .select({ id: caseContexts.id, status: caseContexts.status })
    .from(caseContexts)
    .where(eq(caseContexts.caseId, caseRow.id))
    .orderBy(desc(caseContexts.version))
    .limit(1);
  if (!contextRow) return;

  if (contextRow.status !== "approved") {
    await db
      .update(caseContexts)
      .set({ status: "approved", approvedAt: new Date() })
      .where(eq(caseContexts.id, contextRow.id));
  }

  await db.insert(referrals).values({
    caseId: caseRow.id,
    contextId: contextRow.id,
    serviceId: serviceRow.id,
    status: "sent",
    sentAt: daysAgo(2),
    followUpDue: sydneyDate(),
    sharedFields: ["needs", "suburb", "children", "pets", "income", "visa", "languages", "summary"],
    draftText:
      "Hello Watershed team,\n\nI am following up on an urgent crisis accommodation referral for CASE-2026-001. Amira needs a safe placement with her two children and dog. Could you please confirm whether an intake call or placement is available today?\n\nKind regards,\nHannah Lee\nCaseworker, Lou's Place",
  });
}

/** Keep the Today service-activity panel populated with idempotent demo history. */
async function ensureServiceActivityDemo() {
  const [southside] = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.name, "Southside DFV Legal Centre"))
    .limit(1);
  if (southside) {
    await db
      .update(services)
      .set({ email: "intake@southsidedfv.example.org" })
      .where(eq(services.id, southside.id));
    const [existingHoursChange] = await db
      .select({ id: serviceChangeLog.id })
      .from(serviceChangeLog)
      .where(and(eq(serviceChangeLog.serviceId, southside.id), eq(serviceChangeLog.field, "opening hours")))
      .limit(1);
    if (!existingHoursChange) {
      await db.insert(serviceChangeLog).values({
        serviceId: southside.id,
        entity: "service",
        field: "opening hours",
        oldValue: "Closes at 8 pm",
        newValue: "Closes at 9 pm",
        changedBy: "Bright Data updater (demo)",
        note: "Synthetic updater activity for the dashboard demonstration.",
      });
    }
  }

  const [brightPath] = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.name, "Bright Path Financial Counselling"))
    .limit(1);
  if (brightPath) {
    await db
      .update(services)
      .set({ email: "referrals@brightpath.example.org" })
      .where(eq(services.id, brightPath.id));
  }

  const [existingDiscovery] = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.name, "NSW Domestic Violence Line"))
    .limit(1);
  if (existingDiscovery) return;

  const [discovered] = await db
    .insert(services)
    .values({
      name: "NSW Domestic Violence Line",
      organisation: "NSW Government",
      description: "24/7 counselling and referrals for women experiencing domestic violence.",
      status: "active",
      website: "https://www.nsw.gov.au/community-services/domestic-and-family-support",
      phone: "1800 656 463",
      catchment: "NSW",
      sourceType: "discovery_review",
      sourceName: "NSW Government website · Bright Data discovery demo",
      sourceUrl: "https://www.nsw.gov.au/community-services/domestic-and-family-support",
    })
    .returning();

  await db.insert(serviceAttributes).values([
    {
      serviceId: discovered.id,
      attrType: "need",
      key: "need",
      value: "dfv_safety",
      sourceType: "machine",
      sourceName: "NSW Government website · Bright Data discovery demo",
      sourceUrl: discovered.sourceUrl,
      retrievedAt: new Date(),
      verificationStatus: "verified_machine",
    },
    {
      serviceId: discovered.id,
      attrType: "access",
      key: "availability",
      value: "24_7",
      sourceType: "machine",
      sourceName: "NSW Government website · Bright Data discovery demo",
      sourceUrl: discovered.sourceUrl,
      retrievedAt: new Date(),
      verificationStatus: "verified_machine",
    },
  ]);

  await db.insert(serviceChangeLog).values({
    serviceId: discovered.id,
    entity: "service",
    field: "created",
    oldValue: null,
    newValue: discovered.name,
    changedBy: "Bright Data discovery (demo)",
    note: "Added to the community-service database after discovery review.",
  });
}

async function ensureCaseworkerSettings() {
  await db
    .insert(caseworkerSettings)
    .values({
      id: "hannah-lee",
      name: "Hannah Lee",
      email: "hannah.lee@example.org",
    })
    .onConflictDoNothing();
}

async function main() {
  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(services);
  if ((existing[0]?.count ?? 0) > 0) {
    await ensureDemoFollowUp();
    await ensureServiceActivityDemo();
    await ensureCaseworkerSettings();
    console.log("Seed skipped: core services already present; dashboard demo activity ensured.");
    return;
  }

  // --- Services (synthetic, snapshot-fixture provenance) ---

  const [watershed] = await db
    .insert(services)
    .values({
      name: "Watershed Women's Crisis Accommodation",
      organisation: "Watershed Community Services (synthetic)",
      description:
        "Crisis accommodation for women escaping domestic and family violence. Medium-term stays.",
      status: "active",
      phone: "(02) 9000 0001",
      email: "referrals@watershed.example.org",
      address: "12 Example St, Marrickville NSW 2204",
      catchment: "Inner West & South East Sydney",
      sourceType: "excel_import",
      sourceName: "Lous Place Service List (Excel) v3 — snapshot",
      sourceUrl: null,
    })
    .returning();

  const [southside] = await db
    .insert(services)
    .values({
      name: "Southside DFV Legal Centre",
      organisation: "Southside Legal (synthetic)",
      description: "Free legal advice and court advocacy for DFV matters.",
      status: "active",
      website: "https://southsidedfv.example.org",
      phone: "(02) 9000 0002",
      email: "intake@southsidedfv.example.org",
      catchment: "Greater Sydney",
      sourceType: "machine",
      sourceName: "Southside DFV Legal Centre website — snapshot",
      sourceUrl: "https://southsidedfv.example.org/services",
    })
    .returning();

  const [brightPath] = await db
    .insert(services)
    .values({
      name: "Bright Path Financial Counselling",
      organisation: "Bright Path Inc. (synthetic)",
      description: "Free financial counselling and hardship support.",
      status: "active",
      website: "https://brightpath.example.org",
      phone: "(02) 9000 0003",
      email: "referrals@brightpath.example.org",
      catchment: "NSW — phone and online",
      sourceType: "machine",
      sourceName: "Bright Path website — snapshot",
      sourceUrl: "https://brightpath.example.org/eligibility",
    })
    .returning();

  const [harbour] = await db
    .insert(services)
    .values({
      name: "Harbour Community Health — AOD & Counselling",
      organisation: "Harbour Community Health (synthetic)",
      description: "Alcohol and other drug support and general counselling.",
      status: "active",
      phone: "(02) 9000 0004",
      address: "3 Harbour Rd, Wolli Creek NSW 2205",
      catchment: "St George & Inner South Sydney",
      sourceType: "excel_import",
      sourceName: "Lous Place Service List (Excel) v3 — snapshot",
      sourceUrl: null,
    })
    .returning();

  const [newDawn] = await db
    .insert(services)
    .values({
      name: "New Dawn Employment Program for Women",
      organisation: "New Dawn Foundation (synthetic)",
      description: "Employment readiness and job placement support for women.",
      status: "active",
      phone: "(02) 9000 0005",
      catchment: "Sydney Metro",
      sourceType: "provider_confirmed",
      sourceName: "Phone confirmation by caseworker",
      sourceUrl: null,
    })
    .returning();

  // --- Service attributes (each with source + freshness) ---

  await db.insert(serviceAttributes).values([
    // Watershed: synthetic spreadsheet facts; availability stays time-sensitive.
    { serviceId: watershed.id, attrType: "need", key: "need", value: "housing_accommodation", sourceType: "excel_import", sourceName: "Lous Place Service List (Excel) v3", retrievedAt: daysAgo(45), verificationStatus: "verified_machine", notes: "Imported from Excel; confirm details directly when referring." },
    { serviceId: watershed.id, attrType: "need", key: "need", value: "dfv_safety", sourceType: "excel_import", sourceName: "Lous Place Service List (Excel) v3", retrievedAt: daysAgo(45), verificationStatus: "verified_machine" },
    { serviceId: watershed.id, attrType: "eligibility", key: "children", value: "welcome", sourceType: "excel_import", sourceName: "Lous Place Service List (Excel) v3", retrievedAt: daysAgo(45), verificationStatus: "verified_machine" },
    { serviceId: watershed.id, attrType: "eligibility", key: "pets", value: "negotiable", sourceType: "excel_import", sourceName: "Lous Place Service List (Excel) v3", retrievedAt: daysAgo(45), verificationStatus: "verified_machine", notes: "Synthetic spreadsheet states pets are considered case-by-case." },
    { serviceId: watershed.id, attrType: "cost", key: "cost", value: "free", sourceType: "excel_import", sourceName: "Lous Place Service List (Excel) v3", retrievedAt: daysAgo(120), verificationStatus: "stale" },
    { serviceId: watershed.id, attrType: "wait_time", key: "wait_time", value: "2-3 weeks", sourceType: "excel_import", sourceName: "Lous Place Service List (Excel) v3", retrievedAt: daysAgo(120), verificationStatus: "stale" },

    // Southside: machine-source facts, fresh
    { serviceId: southside.id, attrType: "need", key: "need", value: "legal", sourceType: "machine", sourceName: "Southside website — snapshot", sourceUrl: "https://southsidedfv.example.org/services", retrievedAt: daysAgo(3), verificationStatus: "verified_machine" },
    { serviceId: southside.id, attrType: "need", key: "need", value: "dfv_safety", sourceType: "machine", sourceName: "Southside website — snapshot", sourceUrl: "https://southsidedfv.example.org/services", retrievedAt: daysAgo(3), verificationStatus: "verified_machine" },
    { serviceId: southside.id, attrType: "eligibility", key: "visa", value: "no_restrictions", sourceType: "machine", sourceName: "Southside website — snapshot", sourceUrl: "https://southsidedfv.example.org/eligibility", retrievedAt: daysAgo(3), verificationStatus: "verified_machine" },
    { serviceId: southside.id, attrType: "cost", key: "cost", value: "free", sourceType: "machine", sourceName: "Southside website — snapshot", sourceUrl: "https://southsidedfv.example.org/eligibility", retrievedAt: daysAgo(3), verificationStatus: "verified_machine" },

    // Bright Path: machine-source facts
    { serviceId: brightPath.id, attrType: "need", key: "need", value: "financial", sourceType: "machine", sourceName: "Bright Path website — snapshot", sourceUrl: "https://brightpath.example.org/services", retrievedAt: daysAgo(7), verificationStatus: "verified_machine" },
    { serviceId: brightPath.id, attrType: "delivery", key: "format", value: "phone_online", sourceType: "machine", sourceName: "Bright Path website — snapshot", sourceUrl: "https://brightpath.example.org/services", retrievedAt: daysAgo(7), verificationStatus: "verified_machine" },
    { serviceId: brightPath.id, attrType: "eligibility", key: "income", value: "low", sourceType: "machine", sourceName: "Bright Path website — snapshot", sourceUrl: "https://brightpath.example.org/eligibility", retrievedAt: daysAgo(7), verificationStatus: "verified_machine" },
    { serviceId: brightPath.id, attrType: "eligibility", key: "languages", value: "english", sourceType: "machine", sourceName: "Bright Path website — snapshot", sourceUrl: "https://brightpath.example.org/languages", retrievedAt: daysAgo(7), verificationStatus: "verified_machine", notes: "Interpreters available on request — confirm language needs with provider." },

    // Harbour: excel import with stale + provider-confirmed mix
    { serviceId: harbour.id, attrType: "need", key: "need", value: "aod", sourceType: "excel_import", sourceName: "Lous Place Service List (Excel) v3", retrievedAt: daysAgo(60), verificationStatus: "verified_machine" },
    { serviceId: harbour.id, attrType: "need", key: "need", value: "mental_health_counselling", sourceType: "excel_import", sourceName: "Lous Place Service List (Excel) v3", retrievedAt: daysAgo(60), verificationStatus: "verified_machine" },
    { serviceId: harbour.id, attrType: "eligibility", key: "referral_required", value: "yes", sourceType: "provider_confirmed", sourceName: "Phone confirmation by caseworker", retrievedAt: daysAgo(20), confirmedBy: "Caseworker (phone)", confirmedAt: daysAgo(20), verificationStatus: "provider_confirmed", notes: "GP referral required — confirmed directly with provider." },
    { serviceId: harbour.id, attrType: "wait_time", key: "wait_time", value: "unknown", sourceType: "excel_import", sourceName: "Lous Place Service List (Excel) v3", retrievedAt: daysAgo(180), verificationStatus: "needs_provider_confirmation" },

    // New Dawn: provider-confirmed facts
    { serviceId: newDawn.id, attrType: "need", key: "need", value: "employment", sourceType: "provider_confirmed", sourceName: "Phone confirmation by caseworker", retrievedAt: daysAgo(10), confirmedBy: "Caseworker (phone)", confirmedAt: daysAgo(10), verificationStatus: "provider_confirmed" },
    { serviceId: newDawn.id, attrType: "eligibility", key: "children", value: "welcome", sourceType: "provider_confirmed", sourceName: "Phone confirmation by caseworker", retrievedAt: daysAgo(10), confirmedBy: "Caseworker (phone)", confirmedAt: daysAgo(10), verificationStatus: "provider_confirmed" },
    { serviceId: newDawn.id, attrType: "access", key: "intake", value: "self_referral", sourceType: "provider_confirmed", sourceName: "Phone confirmation by caseworker", retrievedAt: daysAgo(10), confirmedBy: "Caseworker (phone)", confirmedAt: daysAgo(10), verificationStatus: "provider_confirmed" },
  ]);

  // --- One synthetic woman / case with a draft context ---

  const [womanCase] = await db
    .insert(cases)
    .values({
      clientRef: "CASE-2026-001",
      clientName: "Amira",
      originalNotes:
        "Amira (synthetic) — escaping DFV, needs crisis accommodation urgently. Two kids (5 and 8), has a dog she won't leave behind. On bridging visa E, speaks Arabic and English. Casual part-time work, low income. Waterloo area. Only safe contact: SMS to second phone, do NOT call her main number.",
      status: "open",
    })
    .returning();

  await db.insert(caseContexts).values({
    caseId: womanCase.id,
    version: 1,
    context: {
      needs: ["housing_accommodation", "dfv_safety", "financial"],
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
      summary:
        "Woman escaping DFV needs urgent crisis accommodation; two children; dog; bridging visa E; low income; SMS-only safe contact.",
    },
    status: "draft",
    extractionModel: "manual-demo-seed (Phase 2 LLM extraction not built yet)",
  });

  await ensureDemoFollowUp();
  await ensureServiceActivityDemo();
  await ensureCaseworkerSettings();

  console.log("Seed complete: 5 services, 20 service_attributes, 1 case, 1 approved context, 1 follow-up.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
