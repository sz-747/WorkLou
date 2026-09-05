/**
 * Phase 1 synthetic seed. Idempotent: exits if data already present.
 * Provenance rules (docs/implementation_plan.md): every service fact carries
 * source + freshness; machine facts vs provider-only facts are distinguished.
 */
import { sql } from "drizzle-orm";
import { db } from "./index";
import { cases, caseContexts, serviceAttributes, services } from "./schema";

const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

async function main() {
  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(services);
  if ((existing[0]?.count ?? 0) > 0) {
    console.log("Seed skipped: services already present.");
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

  console.log("Seed complete: 5 services, 20 service_attributes, 1 case, 1 draft context.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
