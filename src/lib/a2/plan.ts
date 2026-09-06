/**
 * Plan view model — the three steps a worker actually walks through for one
 * woman: what we suggest, what is being done, and an email to an alternative
 * community service when the first options do not work out.
 *
 * Read-only. Everything comes from her approved context, the services table
 * (loaded from the service CSV/discovery) and her existing referrals. The
 * email body is built with the SAME deterministic builder Refer uses, so no
 * service fact and no context field is invented here.
 */
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { cases, type CaseContext } from "../../db/schema";
import { CONTEXT_FIELDS, fieldHasValue, fieldValuePreview } from "../context-fields";
import { getLatestApprovedContext, getMatchCandidates, matchServices } from "../matching";
import { buildReferralDraftInput, fallbackReferralText, getServiceForRefer } from "../refer";
import { getReferralsForCase } from "../refer";
import { contactLabel, displayName, dueLabel, firstNameOf, humanise, joinParts } from "./format";

export type PlanSuggestion = { key: string; label: string; detail: string; need: string };

export type PlanAction = {
  key: string;
  title: string;
  detail: string;
  state: "done" | "waiting" | "next";
};

export type PlanServiceOption = {
  id: string;
  name: string;
  organisation: string | null;
  detail: string;
  suitable: boolean;
  /** already referred to for this woman */
  alreadyReferred: boolean;
};

export type Plan = {
  caseId: string;
  name: string;
  firstName: string;
  ref: string;
  subline: string;
  needs: string[];
  suggestions: PlanSuggestion[];
  actions: PlanAction[];
  services: PlanServiceOption[];
  /** the service the email is being written to, when one is chosen */
  selected: PlanServiceOption | null;
  emailSubject: string;
  emailBody: string;
  /** context fields the body draws on — shown so the worker sees the basis */
  known: { label: string; value: string }[];
};

/** Suggestions come from her approved context — never from a wish list. */
function suggestionsOf(context: CaseContext | null): PlanSuggestion[] {
  if (!context) return [];
  const out: PlanSuggestion[] = (context.needs ?? []).map((need) => ({
    key: `need:${need}`,
    label: humanise(need),
    detail: joinParts([context.suburb, context.urgency ? humanise(context.urgency) : null]),
    need,
  }));
  if (context.pets?.has_pet) {
    out.push({
      key: "pet",
      label: "Pet-friendly placement",
      detail: context.pets.details ?? "she will not leave her pet",
      need: "pet_friendly",
    });
  }
  if (context.children?.count) {
    out.push({
      key: "children",
      label: "Room for her children",
      detail: `${context.children.count} children`,
      need: "children",
    });
  }
  if (context.visa) {
    out.push({
      key: "visa",
      label: "Visa-aware support",
      detail: humanise(context.visa),
      need: "visa",
    });
  }
  if (context.languages?.length) {
    out.push({
      key: "language",
      label: "Interpreter",
      detail: context.languages.join(", "),
      need: "interpreter",
    });
  }
  return out;
}

export async function loadPlan(
  caseId: string,
  serviceId?: string,
  now: Date = new Date(),
): Promise<Plan | null> {
  const [caseRow] = await db.select().from(cases).where(eq(cases.id, caseId));
  if (!caseRow) return null;

  const [approved, referralRows, candidates] = await Promise.all([
    getLatestApprovedContext(caseId),
    getReferralsForCase(caseId),
    getMatchCandidates(),
  ]);

  const context = approved?.context ?? null;
  const results = context ? matchServices(context, candidates, now) : [];
  const referredIds = new Set(referralRows.map((r) => r.serviceId));

  const services: PlanServiceOption[] = results.map((result) => ({
    id: result.service.id,
    name: result.service.name,
    organisation: result.service.organisation,
    detail: result.suitable
      ? joinParts([
          result.matchedNeeds.map(humanise).join(", ") || null,
          result.service.catchment,
        ]) || "matches what she needs"
      : (result.reason ?? "not a match"),
    suitable: result.suitable,
    alreadyReferred: referredIds.has(result.service.id),
  }));

  const actions: PlanAction[] = [
    {
      key: "context",
      title: "Summary approved with her",
      detail: approved ? `version ${approved.version}` : "not approved yet",
      state: approved ? "done" : "next",
    },
    {
      key: "search",
      title: "Search community services",
      detail: approved
        ? `${services.filter((s) => s.suitable).length} suitable of ${services.length} searched`
        : "waiting for the approved summary",
      state: approved ? (services.some((s) => s.suitable) ? "done" : "next") : "waiting",
    },
    ...referralRows.map((referral) => ({
      key: referral.id,
      title: `${referral.serviceName} referral`,
      detail: joinParts([
        referral.status === "draft" ? "draft kept" : referral.status,
        referral.sentAt ? `sent ${contactLabel(referral.sentAt, now)}` : null,
        referral.followUpDue ? `follow-up ${dueLabel(referral.followUpDue, now)}` : null,
      ]),
      state:
        referral.outcome === "accepted"
          ? ("done" as const)
          : referral.status === "draft"
            ? ("next" as const)
            : ("waiting" as const),
    })),
  ];

  const known = context
    ? CONTEXT_FIELDS.filter((field) => fieldHasValue(field.key, context)).map((field) => ({
        label: field.label,
        value: fieldValuePreview(field.key, context)!,
      }))
    : [];

  const selected = services.find((service) => service.id === serviceId) ?? null;
  let emailBody = "";
  let emailSubject = "";
  if (selected && context) {
    const stored = await getServiceForRefer(selected.id);
    if (stored) {
      const input = buildReferralDraftInput(
        context,
        CONTEXT_FIELDS.map((field) => field.key),
        {
          name: stored.service.name,
          organisation: stored.service.organisation,
          phone: stored.service.phone,
          catchment: stored.service.catchment,
        },
        stored.facts,
      );
      emailBody = fallbackReferralText(input);
      emailSubject = `Referral enquiry · ${joinParts([
        (context.needs ?? []).map(humanise).join(", ") || "support",
        context.suburb,
      ])} · ${caseRow.clientRef}`;
    }
  }

  return {
    caseId: caseRow.id,
    name: displayName(caseRow),
    firstName: firstNameOf(caseRow),
    ref: caseRow.clientRef,
    subline: joinParts([
      context ? "from her approved summary" : "no approved summary yet",
      `${services.filter((s) => s.suitable).length} services shortlisted`,
      `${referralRows.length} referrals`,
    ]),
    needs: (context?.needs ?? []).map(humanise),
    suggestions: suggestionsOf(context),
    actions,
    services,
    selected,
    emailSubject,
    emailBody,
    known,
  };
}
