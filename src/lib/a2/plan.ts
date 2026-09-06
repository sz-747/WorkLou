/** Ranked case plan built from approved Postgres context and stored service facts. */
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { caseContexts, cases } from "../../db/schema";
import { CONTEXT_FIELDS, fieldHasValue, fieldValuePreview } from "../context-fields";
import { getLatestApprovedContext, getMatchCandidates, matchServices } from "../matching";
import { buildReferralDraftInput, fallbackReferralText, getReferralsForCase } from "../refer";
import { displayName, firstNameOf, humanise, joinParts } from "./format";
import { getCaseworkerSettings } from "./caseworker-settings";

export type PlanAction = {
  key: "needs" | "matches" | "confirm" | "referral" | "followthrough";
  title: string;
  state: "done" | "waiting" | "next";
};

export type PlanCriterion = {
  key: string;
  label: string;
  detail: string;
  status: "matched" | "stale" | "needs_provider_confirmation" | "not_recorded" | "mismatch";
};

export type PlanServiceOption = {
  id: string;
  rank: number;
  score: number;
  name: string;
  organisation: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  catchment: string | null;
  suitable: boolean;
  reason: string | null;
  criteria: PlanCriterion[];
  emailSubject: string;
  emailBody: string;
  referralStatus: string | null;
};

export type Plan = {
  caseId: string;
  name: string;
  firstName: string;
  ref: string;
  location: string;
  summary: string | null;
  critical: { key: string; label: string; value: string }[];
  searchedCount: number;
  services: PlanServiceOption[];
  actions: PlanAction[];
  urgency: string | null;
  sender: { name: string; email: string };
};

function criterionLabel(criterion: string): string {
  if (criterion.startsWith("need:")) return humanise(criterion.slice(5).trim());
  return humanise(criterion);
}

const CRITICAL_FIELD_ORDER = [
  "income",
  "languages",
  "children",
  "pets",
  "urgency",
  "needs",
  "visa",
  "safe_contact_method",
  "safety_preferences",
];

export async function loadPlan(caseId: string, _serviceId?: string): Promise<Plan | null> {
  const [caseRow] = await db.select().from(cases).where(eq(cases.id, caseId));
  if (!caseRow) return null;

  const [approved, referralRows, candidates, sender] = await Promise.all([
    getLatestApprovedContext(caseId),
    getReferralsForCase(caseId),
    getMatchCandidates(),
    getCaseworkerSettings(),
  ]);
  const context = approved?.context ?? null;
  const results = context ? matchServices(context, candidates) : [];
  const referralByService = new Map(referralRows.map((row) => [row.serviceId, row]));

  const critical = context
    ? CONTEXT_FIELDS.filter(
        (field) => !["summary", "suburb", "catchment"].includes(field.key) && fieldHasValue(field.key, context),
      )
        .sort((a, b) => {
          const aIndex = CRITICAL_FIELD_ORDER.indexOf(a.key);
          const bIndex = CRITICAL_FIELD_ORDER.indexOf(b.key);
          return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
        })
        .map((field) => ({
          key: field.key,
          label: field.label,
          value: fieldValuePreview(field.key, context)!,
        }))
    : [];

  const services: PlanServiceOption[] = results.slice(0, 3).map((result, index) => {
    const input = context
      ? buildReferralDraftInput(
          context,
          CONTEXT_FIELDS.map((field) => field.key),
          {
            name: result.service.name,
            organisation: result.service.organisation,
            phone: result.service.phone,
            catchment: result.service.catchment,
          },
          result.service.attributes,
        )
      : null;
    const existing = referralByService.get(result.service.id);

    return {
      id: result.service.id,
      rank: index + 1,
      score: result.score ?? 0,
      name: result.service.name,
      organisation: result.service.organisation,
      website: result.service.website ?? null,
      phone: result.service.phone,
      email: result.service.email ?? null,
      catchment: result.service.catchment,
      suitable: result.suitable,
      reason: result.reason,
      criteria: result.criteria.map((criterion, criterionIndex) => ({
        key: `${criterion.criterion}:${criterionIndex}`,
        label: criterionLabel(criterion.criterion),
        detail: criterion.detail,
        status: criterion.status,
      })),
      emailSubject: `Referral enquiry · ${joinParts([
        (context?.needs ?? []).map(humanise).join(", ") || "support",
        context?.suburb,
      ])} · ${caseRow.clientRef}`,
      emailBody: input
        ? `${fallbackReferralText(input)}\n\n${[
            "Kind regards,",
            sender.name,
            sender.email,
          ].filter(Boolean).join("\n")}`
        : "",
      referralStatus: existing?.status ?? null,
    };
  });

  const hasReferral = referralRows.some((row) => row.status !== "draft");
  return {
    caseId: caseRow.id,
    name: displayName(caseRow),
    firstName: firstNameOf(caseRow),
    ref: caseRow.clientRef,
    location: context?.suburb ?? context?.catchment ?? "Location not recorded",
    summary: context?.summary ?? null,
    critical,
    searchedCount: results.length,
    services,
    urgency: context?.urgency ?? null,
    sender: { name: sender.name, email: sender.email },
    actions: [
      { key: "needs", title: "Understand her needs", state: approved ? "done" : "next" },
      { key: "matches", title: "Find suitable support", state: services.length ? "done" : "waiting" },
      { key: "confirm", title: "Confirm important details", state: hasReferral ? "done" : "next" },
      { key: "referral", title: "Make the referral", state: hasReferral ? "done" : "waiting" },
      {
        key: "followthrough",
        title: "Follow through and document",
        state: hasReferral ? "next" : "waiting",
      },
    ],
  };
}

/** Most recently approved open case, used when the shared Services tab has no case in its URL. */
export async function loadLatestPlan(): Promise<Plan | null> {
  const [row] = await db
    .select({ caseId: cases.id })
    .from(caseContexts)
    .innerJoin(cases, eq(caseContexts.caseId, cases.id))
    .where(eq(caseContexts.status, "approved"))
    .orderBy(desc(caseContexts.approvedAt), desc(cases.createdAt))
    .limit(1);

  return row ? loadPlan(row.caseId) : null;
}
