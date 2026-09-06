/** Read models for referral communication history. Follow-ups never start a case workflow. */
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "../../db";
import { caseContexts, cases, referrals, services, type CaseContext } from "../../db/schema";
import { getDueFollowUps, outcomeLabel } from "../followup";
import { contactLabel, displayName, dueLabel, humanise, joinParts } from "./format";

export type FollowUpRow = {
  key: string;
  caseId: string;
  name: string;
  detail: string;
  meta: string;
  overdue: boolean;
};

export type WaitingRow = { key: string; caseId: string; name: string; detail: string };

export type FollowUpProfile = {
  id: string;
  name: string;
  ref: string;
  pills: string[];
  referrals: {
    id: string;
    service: string;
    phone: string | null;
    email: string | null;
    status: string;
    sent: string;
    result: string;
    followUp: string;
    overdue: boolean;
  }[];
};

/** Sent or responded referrals whose follow-up date has arrived or passed. */
export async function getFollowUpRows(now: Date = new Date()): Promise<FollowUpRow[]> {
  const rows = await getDueFollowUps();
  return rows.map((row) => {
    const due = dueLabel(row.followUpDue, now);
    return {
      key: row.referralId,
      caseId: row.caseId,
      name: displayName(row),
      detail: joinParts([
        row.serviceName,
        row.sentAt ? `sent ${contactLabel(row.sentAt, now)}` : null,
        row.outcome ? outcomeLabel(row.outcome) : "awaiting reply",
      ]),
      meta: due.startsWith("Overdue") ? due : "follow up today",
      overdue: due.startsWith("Overdue"),
    };
  });
}

/** Open referrals out with a provider, whether or not a follow-up is due yet. */
export async function getWaitingRows(now: Date = new Date()): Promise<WaitingRow[]> {
  const rows = await db
    .select({
      id: referrals.id,
      caseId: cases.id,
      clientRef: cases.clientRef,
      clientName: cases.clientName,
      serviceName: services.name,
      sentAt: referrals.sentAt,
      followUpDue: referrals.followUpDue,
      outcome: referrals.outcome,
    })
    .from(referrals)
    .innerJoin(cases, eq(referrals.caseId, cases.id))
    .innerJoin(services, eq(referrals.serviceId, services.id))
    .where(and(inArray(referrals.status, ["sent", "responded"]), isNotNull(referrals.sentAt)))
    .orderBy(asc(referrals.followUpDue));

  return rows.map((row) => ({
    key: row.id,
    caseId: row.caseId,
    name: displayName(row),
    detail: joinParts([
      row.serviceName,
      row.sentAt ? `sent ${contactLabel(row.sentAt, now)}` : null,
      row.outcome ? outcomeLabel(row.outcome) : "no reply yet",
      row.followUpDue ? `follow-up ${dueLabel(row.followUpDue, now)}` : null,
    ]),
  }));
}

function latestContext(
  rows: { caseId: string; status: string; version: number; context: CaseContext }[],
  caseId: string,
) {
  const matches = rows.filter((row) => row.caseId === caseId);
  return [...matches].sort(
    (a, b) =>
      (b.status === "approved" ? 1 : 0) - (a.status === "approved" ? 1 : 0) ||
      b.version - a.version,
  )[0]?.context;
}

function profilePills(context: CaseContext | undefined): string[] {
  if (!context) return [];
  return [
    context.languages?.length ? `Language · ${context.languages.map(humanise).join(", ")}` : null,
    context.children?.count != null ? `Children · ${context.children.count}` : null,
    context.pets?.has_pet ? `Pets · ${context.pets.details || "Yes"}` : null,
    context.income?.status ? `Income · ${humanise(context.income.status)}` : null,
    context.suburb ? `Location · ${context.suburb}` : null,
    context.visa ? `Visa · ${humanise(context.visa)}` : null,
  ].filter((value): value is string => Boolean(value));
}

/** Communication history grouped by person, with searchable Postgres context fields. */
export async function getFollowUpProfiles(now: Date = new Date()): Promise<FollowUpProfile[]> {
  const [outreach, contexts] = await Promise.all([
    db
      .select({
        referralId: referrals.id,
        caseId: cases.id,
        clientRef: cases.clientRef,
        clientName: cases.clientName,
        service: services.name,
        phone: services.phone,
        email: referrals.draftText,
        sentAt: referrals.sentAt,
        followUpDue: referrals.followUpDue,
        outcome: referrals.outcome,
        status: referrals.status,
      })
      .from(referrals)
      .innerJoin(cases, eq(referrals.caseId, cases.id))
      .innerJoin(services, eq(referrals.serviceId, services.id))
      .where(isNotNull(referrals.sentAt))
      .orderBy(desc(referrals.sentAt)),
    db
      .select({
        caseId: caseContexts.caseId,
        status: caseContexts.status,
        version: caseContexts.version,
        context: caseContexts.context,
      })
      .from(caseContexts),
  ]);

  const byCase = new Map<string, typeof outreach>();
  outreach.forEach((row) => byCase.set(row.caseId, [...(byCase.get(row.caseId) ?? []), row]));

  return [...byCase.entries()].map(([id, rows]) => ({
    id,
    name: displayName(rows[0]),
    ref: rows[0].clientRef,
    pills: profilePills(latestContext(contexts, id)),
    referrals: rows.map((row) => {
      const due = row.followUpDue ? dueLabel(row.followUpDue, now) : "No follow-up scheduled";
      const overdue = due.startsWith("Overdue");
      return {
        id: row.referralId,
        service: row.service,
        phone: row.phone,
        email: row.email,
        status: humanise(row.status),
        sent: row.sentAt ? `Sent ${contactLabel(row.sentAt, now)}` : "Not sent",
        result: row.outcome
          ? outcomeLabel(row.outcome)
          : row.status === "responded"
            ? "Response recorded, outcome pending"
            : "Awaiting reply",
        followUp: overdue ? due : `Follow up ${due.toLowerCase()}`,
        overdue,
      };
    }),
  }));
}

export async function getFollowUpProfile(
  caseId: string,
  now: Date = new Date(),
): Promise<FollowUpProfile | null> {
  const profiles = await getFollowUpProfiles(now);
  return profiles.find((profile) => profile.id === caseId) ?? null;
}
