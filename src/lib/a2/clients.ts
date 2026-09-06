/**
 * Clients view models (list + profile). Everything comes from the casework
 * tables: cases, note revisions, approved/draft contexts, referrals and case
 * documents. Nothing here writes.
 */
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  caseContexts,
  caseDocuments,
  caseNoteRevisions,
  cases,
  referrals,
  services,
  type CaseContext,
} from "../../db/schema";
import { getReferralsForCase } from "../refer";
import { getCaseDocuments } from "../document";
import { getReferralEventsForCase, outcomeLabel } from "../followup";
import {
  contactLabel,
  displayName,
  firstNameOf,
  daysOverdue,
  dueLabel,
  humanise,
  initialsOf,
  joinParts,
  shortDate,
} from "./format";

export type ClientRow = {
  id: string;
  /** Her name — what every screen shows. */
  name: string;
  /** The de-identified data label (client_ref), kept for exports and referrals. */
  ref: string;
  focus: string;
  stage: string;
  last: string;
  next: string;
  nextOverdue: boolean;
  attention: string;
};

/** Latest context per case — approved wins over a newer draft. */
function pickContext<T extends { status: string; version: number }>(rows: T[]): T | undefined {
  const approved = rows.filter((r) => r.status === "approved").sort((a, b) => b.version - a.version);
  if (approved.length > 0) return approved[0];
  return [...rows].sort((a, b) => b.version - a.version)[0];
}

function focusOf(context: CaseContext | undefined): string {
  if (!context) return "–";
  const needs = (context.needs ?? []).map(humanise);
  return joinParts([needs.join(", ") || null, context.suburb]) || "–";
}

/** Where the case has got to, derived from its referrals. */
function stageOf(
  caseRow: { status: string },
  caseReferrals: { status: string; serviceName: string }[],
): string {
  const sent = caseReferrals.find((r) => r.status === "sent" || r.status === "responded");
  if (sent) return `Referral ${sent.status} · ${sent.serviceName}`;
  const draft = caseReferrals.find((r) => r.status === "draft" || r.status === "approved");
  if (draft) return `Referral draft · ${draft.serviceName}`;
  return caseRow.status === "open" ? "Intake" : caseRow.status;
}

export async function getClientRows(now: Date = new Date()): Promise<ClientRow[]> {
  const [caseRows, contextRows, noteRows, referralRows] = await Promise.all([
    db.select().from(cases).orderBy(desc(cases.createdAt)),
    db
      .select({
        caseId: caseContexts.caseId,
        status: caseContexts.status,
        version: caseContexts.version,
        context: caseContexts.context,
      })
      .from(caseContexts),
    db
      .select({ caseId: caseNoteRevisions.caseId, recordedAt: caseNoteRevisions.recordedAt })
      .from(caseNoteRevisions)
      .orderBy(desc(caseNoteRevisions.recordedAt)),
    db
      .select({
        caseId: referrals.caseId,
        status: referrals.status,
        followUpDue: referrals.followUpDue,
        serviceName: services.name,
      })
      .from(referrals)
      .innerJoin(services, eq(referrals.serviceId, services.id))
      .orderBy(asc(referrals.followUpDue)),
  ]);

  return caseRows.map((caseRow) => {
    const context = pickContext(contextRows.filter((c) => c.caseId === caseRow.id))?.context;
    const caseReferrals = referralRows.filter((r) => r.caseId === caseRow.id);
    const open = caseReferrals.filter((r) => r.status === "sent" || r.status === "responded");
    const nextDue = open.map((r) => r.followUpDue).filter((d): d is string => !!d)[0] ?? null;
    const overdueCount = open.filter(
      (r) => r.followUpDue && daysOverdue(r.followUpDue, now) > 0,
    ).length;
    const lastNote = noteRows.find((n) => n.caseId === caseRow.id);

    return {
      id: caseRow.id,
      name: displayName(caseRow),
      ref: caseRow.clientRef,
      focus: focusOf(context),
      stage: stageOf(caseRow, caseReferrals),
      last: contactLabel(lastNote?.recordedAt ?? caseRow.createdAt, now),
      next: dueLabel(nextDue, now),
      nextOverdue: !!nextDue && daysOverdue(nextDue, now) > 0,
      attention: overdueCount > 0 ? String(overdueCount) : "–",
    };
  });
}

export type ProfileFile = { name: string; detail: string };
export type ProfileTimelineItem = { key: string; when: string; what: string };

export type ClientProfile = {
  id: string;
  name: string;
  firstName: string;
  ref: string;
  initials: string;
  subline: string;
  chips: string[];
  summary: { body: string | null; checked: string };
  files: ProfileFile[];
  recentContact: ProfileTimelineItem[];
  referrals: { key: string; name: string; detail: string }[];
  attention: { key: string; name: string; detail: string }[];
};

/** Context fields the design shows as chips on the profile head. */
function chipsOf(context: CaseContext | undefined): string[] {
  if (!context) return [];
  const chips: string[] = [];
  if (context.suburb) chips.push(context.suburb);
  if (context.pets?.has_pet) chips.push(joinParts(["Pet", context.pets.details]));
  if (context.children?.count) chips.push(`Children · ${context.children.count}`);
  if (context.income?.status) chips.push(`Income · ${humanise(context.income.status)}`);
  if (context.visa) chips.push(`Visa · ${humanise(context.visa)}`);
  if (context.languages?.length) chips.push(`Language · ${context.languages.join(", ")}`);
  if (context.urgency) chips.push(`Urgency · ${humanise(context.urgency)}`);
  if (context.safe_contact_method)
    chips.push(`Safe contact · ${humanise(context.safe_contact_method)}`);
  return chips;
}

export async function getClientProfile(
  caseId: string,
  now: Date = new Date(),
): Promise<ClientProfile | null> {
  const [caseRow] = await db.select().from(cases).where(eq(cases.id, caseId));
  if (!caseRow) return null;

  const [contextRows, noteRows, referralRows, documents, events] = await Promise.all([
    db.select().from(caseContexts).where(eq(caseContexts.caseId, caseId)),
    db
      .select()
      .from(caseNoteRevisions)
      .where(eq(caseNoteRevisions.caseId, caseId))
      .orderBy(desc(caseNoteRevisions.recordedAt)),
    getReferralsForCase(caseId),
    getCaseDocuments(caseId),
    getReferralEventsForCase(caseId),
  ]);

  const latest = pickContext(contextRows);
  const context = latest?.context;
  const open = referralRows.filter((r) => r.status === "sent" || r.status === "responded");

  const files: ProfileFile[] = [
    {
      name: `Contact notes (${noteRows.length})`,
      detail: noteRows[0] ? `latest ${contactLabel(noteRows[0].recordedAt, now)}` : "none yet",
    },
    {
      name: "Context",
      detail: latest
        ? `v${latest.version} · ${latest.status}${
            latest.approvedAt ? ` ${shortDate(latest.approvedAt)}` : ""
          }`
        : "not extracted yet",
    },
    {
      name: `Letters (${documents.length})`,
      detail: documents[0]
        ? `${documents[0].status} · ${contactLabel(documents[0].createdAt, now)}`
        : "none yet",
    },
    {
      name: `Referrals (${referralRows.length})`,
      detail: open.length > 0 ? `${open.length} in flight` : "none in flight",
    },
  ];

  return {
    id: caseRow.id,
    name: displayName(caseRow),
    firstName: firstNameOf(caseRow),
    ref: caseRow.clientRef,
    initials: initialsOf(displayName(caseRow)),
    subline: joinParts([
      caseRow.clientRef,
      `opened ${shortDate(caseRow.createdAt)}`,
      `last contact ${contactLabel(noteRows[0]?.recordedAt ?? caseRow.createdAt, now)}`,
    ]),
    chips: chipsOf(context),
    summary: {
      body: context?.summary ?? null,
      checked: latest?.approvedAt
        ? `Approved context · ${shortDate(latest.approvedAt)}`
        : "No approved context yet",
    },
    files,
    recentContact: [
      ...noteRows.slice(0, 3).map((note) => ({
        key: note.id,
        when: contactLabel(note.recordedAt, now),
        what: "Case note recorded",
      })),
      ...events.slice(-3).map((event) => ({
        key: event.id,
        when: contactLabel(event.occurredAt, now),
        what: `${humanise(event.kind)} · ${event.note}`,
      })),
    ],
    referrals: referralRows.map((referral) => ({
      key: referral.id,
      name: referral.serviceName,
      detail: joinParts([
        referral.status,
        referral.sentAt ? `sent ${contactLabel(referral.sentAt, now)}` : null,
        referral.followUpDue ? `follow-up ${dueLabel(referral.followUpDue, now)}` : null,
        referral.outcome ? outcomeLabel(referral.outcome) : null,
      ]),
    })),
    attention: open
      .filter((r) => r.followUpDue && daysOverdue(r.followUpDue, now) > 0)
      .map((referral) => ({
        key: referral.id,
        name: `${referral.serviceName} follow-up`,
        detail: dueLabel(referral.followUpDue, now).toLowerCase(),
      })),
  };
}
