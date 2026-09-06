/**
 * Follow-ups view model. This is the post-referral workspace: upcoming contact
 * is shown first, then each person's sent emails, contacted services, recorded
 * result and next follow-up. All information is read from referral records;
 * nothing here sends email or changes an outcome.
 */
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "../../db";
import { caseContexts, cases, referrals, services } from "../../db/schema";
import { getDueFollowUps, outcomeLabel } from "../followup";
import type { CaseContext } from "../../db/schema";
import { contactLabel, displayName, dueLabel, humanise, joinParts } from "./format";
import type { FollowUpProfile } from "../../components/a2/FollowUpProfiles";

export type FollowUpRow = { key: string; name: string; detail: string; meta: string; overdue: boolean };
export type WaitingRow = { key: string; name: string; detail: string };

/** Sent/responded referrals whose follow-up date has arrived or passed. */
export async function getFollowUpRows(now: Date = new Date()): Promise<FollowUpRow[]> {
  const rows = await getDueFollowUps();
  return rows.map((row) => {
    const meta = dueLabel(row.followUpDue, now);
    return { key: row.referralId, name: displayName(row), detail: joinParts([row.serviceName, row.sentAt ? `sent ${contactLabel(row.sentAt, now)}` : null, row.outcome ? outcomeLabel(row.outcome) : "awaiting reply"]), meta: meta.startsWith("Overdue") ? meta : "follow up today", overdue: meta.startsWith("Overdue") };
  });
}

/** Open referrals out with a provider, whether or not a follow-up is due yet. */
export async function getWaitingRows(now: Date = new Date()): Promise<WaitingRow[]> {
  const rows = await db.select({ id: referrals.id, clientRef: cases.clientRef, clientName: cases.clientName, serviceName: services.name, sentAt: referrals.sentAt, followUpDue: referrals.followUpDue, outcome: referrals.outcome }).from(referrals).innerJoin(cases, eq(referrals.caseId, cases.id)).innerJoin(services, eq(referrals.serviceId, services.id)).where(and(inArray(referrals.status, ["sent", "responded"]), isNotNull(referrals.sentAt))).orderBy(asc(referrals.followUpDue));
  return rows.map((row) => ({ key: row.id, name: displayName(row), detail: joinParts([row.serviceName, row.sentAt ? `sent ${contactLabel(row.sentAt, now)}` : null, row.outcome ? outcomeLabel(row.outcome) : "no reply yet", row.followUpDue ? `follow-up ${dueLabel(row.followUpDue, now)}` : null]) }));
}

function latestContext(rows: { caseId: string; status: string; version: number; context: CaseContext }[], caseId: string) {
  const matches = rows.filter((row) => row.caseId === caseId);
  return [...matches].sort((a, b) => (b.status === "approved" ? 1 : 0) - (a.status === "approved" ? 1 : 0) || b.version - a.version)[0]?.context;
}
function profilePills(context: CaseContext | undefined): string[] {
  if (!context) return [];
  return [
    context.languages?.length ? `Language · ${context.languages.map(humanise).join(", ")}` : null,
    context.children?.count != null ? `Children · ${context.children.count}` : null,
    context.income?.status ? `Income · ${humanise(context.income.status)}` : null,
    context.suburb ? context.suburb : null,
    context.visa ? `Visa · ${humanise(context.visa)}` : null,
  ].filter((value): value is string => !!value);
}

/** All people with outreach history, grouped so a caseworker can see each contact trail at a glance. */
export async function getFollowUpProfiles(now: Date = new Date()): Promise<FollowUpProfile[]> {
  const [outreach, contexts] = await Promise.all([
    db.select({ referralId: referrals.id, caseId: cases.id, clientRef: cases.clientRef, clientName: cases.clientName, service: services.name, email: referrals.draftText, sentAt: referrals.sentAt, followUpDue: referrals.followUpDue, outcome: referrals.outcome, status: referrals.status }).from(referrals).innerJoin(cases, eq(referrals.caseId, cases.id)).innerJoin(services, eq(referrals.serviceId, services.id)).where(isNotNull(referrals.sentAt)).orderBy(desc(referrals.sentAt)),
    db.select({ caseId: caseContexts.caseId, status: caseContexts.status, version: caseContexts.version, context: caseContexts.context }).from(caseContexts),
  ]);
  const byCase = new Map<string, typeof outreach>();
  outreach.forEach((row) => byCase.set(row.caseId, [...(byCase.get(row.caseId) ?? []), row]));
  return [...byCase.entries()].map(([id, rows]) => ({
    id, name: displayName(rows[0]), ref: rows[0].clientRef, pills: profilePills(latestContext(contexts, id)),
    referrals: rows.map((row) => { const due = row.followUpDue ? dueLabel(row.followUpDue, now) : "no follow-up scheduled"; const overdue = due.startsWith("Overdue"); return { id: row.referralId, service: row.service, email: row.email, sent: row.sentAt ? `sent ${contactLabel(row.sentAt, now)}` : "not sent", result: row.outcome ? outcomeLabel(row.outcome) : row.status === "responded" ? "Response recorded — outcome pending" : "Awaiting reply", followUp: overdue ? due : `Follow up ${due}`, overdue }; }),
  }));
}
