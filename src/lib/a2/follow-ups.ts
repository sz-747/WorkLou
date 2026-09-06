/**
 * Follow-ups view model. Reads the Phase 6 follow-up data (referrals +
 * referral events) through the existing lib/followup helpers — no new
 * follow-up logic lives here.
 */
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "../../db";
import { cases, referrals, services } from "../../db/schema";
import { getDueFollowUps, outcomeLabel } from "../followup";
import { contactLabel, displayName, dueLabel, joinParts } from "./format";

export type FollowUpRow = {
  key: string;
  name: string;
  detail: string;
  meta: string;
  overdue: boolean;
};

export type WaitingRow = { key: string; name: string; detail: string };

/** Sent/responded referrals whose follow-up date has arrived or passed. */
export async function getFollowUpRows(now: Date = new Date()): Promise<FollowUpRow[]> {
  const rows = await getDueFollowUps();
  return rows.map((row) => {
    const meta = dueLabel(row.followUpDue, now);
    return {
      key: row.referralId,
      name: `${row.serviceName} referral · ${displayName(row)}`,
      detail: joinParts([
        row.outcome ? outcomeLabel(row.outcome) : "awaiting reply",
        `due ${row.followUpDue ?? "–"}`,
      ]),
      meta: meta.startsWith("Overdue") ? meta : "send follow-up",
      overdue: meta.startsWith("Overdue"),
    };
  });
}

/** Open referrals out with a provider, whether or not a follow-up is due yet. */
export async function getWaitingRows(now: Date = new Date()): Promise<WaitingRow[]> {
  const rows = await db
    .select({
      id: referrals.id,
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
    name: displayName(row),
    detail: joinParts([
      row.serviceName,
      row.sentAt ? `sent ${contactLabel(row.sentAt, now)}` : null,
      row.outcome ? outcomeLabel(row.outcome) : "no reply yet",
      row.followUpDue ? `follow-up ${dueLabel(row.followUpDue, now)}` : null,
    ]),
  }));
}
