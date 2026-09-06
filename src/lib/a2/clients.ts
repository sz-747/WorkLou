/**
 * Clients view models (list + profile). Everything comes from the casework
 * tables: cases, note revisions, approved/draft contexts, referrals and case
 * documents. Nothing here writes.
 */
import { desc, eq } from "drizzle-orm";
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
  clientLastContactLabel,
  clientNextFollowUpLabel,
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
  /** How many of her open referrals are overdue — the People list badge. */
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

/** The People list reflects the newest extraction, including a draft awaiting review. */
function pickNewestContext<T extends { version: number }>(rows: T[]): T | undefined {
  return [...rows].sort((a, b) => b.version - a.version)[0];
}

/** The most advanced state wins; rows arrive newest-first within each state. */
function currentStageOf(
  caseRow: { status: string },
  caseReferrals: { status: string; serviceName: string }[],
): string {
  if (caseRow.status === "closed") return "Closed";
  const responded = caseReferrals.find((referral) => referral.status === "responded");
  if (responded) return `Service responded · ${responded.serviceName}`;
  const sent = caseReferrals.find((referral) => referral.status === "sent");
  if (sent) return `Referral sent · ${sent.serviceName}`;
  const ready = caseReferrals.find(
    (referral) => referral.status === "draft" || referral.status === "approved",
  );
  if (ready) return `Referral ready · ${ready.serviceName}`;
  const completed = caseReferrals.find((referral) => referral.status === "closed");
  if (completed) return `Referral closed · ${completed.serviceName}`;
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
      .orderBy(desc(referrals.createdAt)),
  ]);

  return caseRows.map((caseRow) => {
    const context = pickNewestContext(contextRows.filter((c) => c.caseId === caseRow.id))?.context;
    const caseReferrals = referralRows.filter((r) => r.caseId === caseRow.id);
    const open = caseReferrals.filter((r) => r.status === "sent" || r.status === "responded");
    const nextDue = open
      .map((r) => r.followUpDue)
      .filter((d): d is string => !!d)
      .sort()[0] ?? null;
    const overdueCount = open.filter(
      (r) => r.followUpDue && daysOverdue(r.followUpDue, now) > 0,
    ).length;
    const lastNote = noteRows.find((n) => n.caseId === caseRow.id);

    return {
      id: caseRow.id,
      name: displayName(caseRow),
      ref: caseRow.clientRef,
      focus: focusOf(context),
      stage: currentStageOf(caseRow, caseReferrals),
      last: clientLastContactLabel(lastNote?.recordedAt ?? caseRow.createdAt, now),
      next: clientNextFollowUpLabel(nextDue, now),
      nextOverdue: !!nextDue && daysOverdue(nextDue, now) > 0,
      attention: overdueCount > 0 ? String(overdueCount) : "–",
    };
  });
}

export type ProfileFile = { name: string; detail: string; href?: string };
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
  journey: { currentStage: number; statuses: string[] };
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
  const contextApproved = latest?.status === "approved";
  const hasSentReferral = referralRows.some((r) => r.status === "sent" || r.status === "responded");
  const hasDraftReferral = referralRows.some((r) => r.status === "draft" || r.status === "approved");
  const hasApprovedDocument = documents.some((document) => document.status === "approved");
  const currentStage = !contextApproved
    ? 1
    : hasSentReferral
      ? 5
      : hasDraftReferral
        ? 4
        : 2;

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
    ...(caseRow.clientRef === "CASE-2026-001"
      ? [{
          name: "Support referral letter.pdf",
          detail: "Local demo PDF · opens in a new tab",
          href: "/demo/amira-support-referral-letter.pdf",
        }]
      : [{
          name: `Letters (${documents.length})`,
          detail: documents[0]
            ? `${documents[0].status} · ${contactLabel(documents[0].createdAt, now)}`
            : "none yet",
        }]),
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
    chips: [
      ...(caseRow.clientEmail ? [`Email · ${caseRow.clientEmail}`] : []),
      ...chipsOf(context),
    ],
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
    journey: {
      currentStage,
      statuses: [
        contextApproved ? "Summary approved" : latest ? "Needs your review" : "Start here",
        contextApproved ? "Ready to review ranked services" : "Waiting for summary",
        hasDraftReferral || hasSentReferral
          ? "Important details reviewed"
          : contextApproved
            ? "Review service trade-offs"
            : "Waiting for matches",
        hasSentReferral ? "Referral sent" : hasDraftReferral ? "Draft ready" : "Not started",
        hasApprovedDocument
          ? "Case note complete"
          : hasSentReferral
            ? "Follow-up in progress"
            : "Waiting for referral",
      ],
    },
  };
}
