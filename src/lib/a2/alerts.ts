/**
 * Alerts view model for the nav island. Every alert is a real row from the
 * casework tables and carries the destination that resolves it, so clicking an
 * alert lands on that woman's profile (or the follow-ups desk) instead of
 * making the worker go looking. Nothing here writes.
 */
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "../../db";
import { cases, referrals, services } from "../../db/schema";
import { getDueFollowUps, outcomeLabel } from "../followup";
import { getClientRows } from "./clients";
import { contactLabel, displayName, dueLabel } from "./format";

/** The state of an alert — rendered as its own chip, never inline with names. */
export type AlertKind = "Overdue" | "Reply" | "Needs context";

export type AlertRow = {
  key: string;
  kind: AlertKind;
  /** Who it is about — the headline of the row. */
  person: string;
  /** What is actually waiting, in her words not ours. */
  detail: string;
  /** When it happened or when it was due. */
  when: string;
  /** Where clicking resolves it. */
  href: string;
};

export type AlertsView = { count: number; rows: AlertRow[] };

export async function getAlerts(now: Date = new Date()): Promise<AlertsView> {
  const [due, replies, clients] = await Promise.all([
    getDueFollowUps(),
    db
      .select({
        id: referrals.id,
        caseId: cases.id,
        clientRef: cases.clientRef,
        clientName: cases.clientName,
        serviceName: services.name,
        outcome: referrals.outcome,
        outcomeAt: referrals.outcomeAt,
      })
      .from(referrals)
      .innerJoin(cases, eq(referrals.caseId, cases.id))
      .innerJoin(services, eq(referrals.serviceId, services.id))
      .where(and(eq(referrals.status, "responded"), isNotNull(referrals.outcomeAt)))
      .orderBy(desc(referrals.outcomeAt))
      .limit(5),
    getClientRows(now),
  ]);

  const overdue: AlertRow[] = due
    .filter((row) => dueLabel(row.followUpDue, now).startsWith("Overdue"))
    .map((row) => ({
      key: `overdue-${row.referralId}`,
      kind: "Overdue" as const,
      person: displayName(row),
      detail: `${row.serviceName} follow-up`,
      when: dueLabel(row.followUpDue, now),
      href: `/clients/${row.caseId}`,
    }));

  const answered: AlertRow[] = replies.map((row) => ({
    key: `reply-${row.id}`,
    kind: "Reply" as const,
    person: displayName(row),
    detail: `${row.serviceName} · ${row.outcome ? outcomeLabel(row.outcome) : "answered"}`,
    when: contactLabel(row.outcomeAt, now),
    href: `/clients/${row.caseId}`,
  }));

  const missingContext: AlertRow[] = clients
    .filter((client) => client.focus === "–")
    .map((client) => ({
      key: `context-${client.id}`,
      kind: "Needs context" as const,
      person: client.name,
      detail: "her story has not been read into a context yet",
      when: `last contact ${client.last}`,
      href: `/clients/${client.id}`,
    }));

  const rows = [...overdue, ...answered, ...missingContext];
  return { count: rows.length, rows };
}
