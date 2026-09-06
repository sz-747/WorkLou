/**
 * Five-stage casework workflow, loaded for the A2 presentation.
 * Read-only: it loads exactly what /women/[id] loads, through the same
 * helpers, and derives the same stage/status labels. No backend behaviour
 * changes here — the A2 stage sheets call the existing server actions.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { caseContexts, cases } from "../../db/schema";
import { getLatestApprovedContext, getMatchCandidates, matchServices } from "../matching";
import { getReferralsForCase } from "../refer";
import { getReferralEventsForCase } from "../followup";
import { getCaseDocuments } from "../document";
import { getServiceForVerify } from "../verify";

export async function loadWorkflow(caseId: string, verify?: string) {
  const [caseRows, latestContexts, referralRows, referralEvents, documents, approvedContext] =
    await Promise.all([
      db.select().from(cases).where(eq(cases.id, caseId)),
      db
        .select()
        .from(caseContexts)
        .where(eq(caseContexts.caseId, caseId))
        .orderBy(desc(caseContexts.version))
        .limit(1),
      getReferralsForCase(caseId),
      getReferralEventsForCase(caseId),
      getCaseDocuments(caseId),
      getLatestApprovedContext(caseId),
    ]);

  const [caseRow] = caseRows;
  if (!caseRow) return null;
  const [latestContext] = latestContexts;

  const matchResults = approvedContext
    ? matchServices(approvedContext.context, await getMatchCandidates())
    : null;
  const suitable = (matchResults ?? []).filter((r) => r.suitable);

  const verifyServiceId = verify && suitable.some((r) => r.service.id === verify) ? verify : null;
  const selectedService = verifyServiceId ? await getServiceForVerify(verifyServiceId) : null;

  const draftDocuments = documents.filter((d) => d.status === "draft").length;
  const hasApprovedDocument = documents.some((d) => d.status === "approved");
  const hasSentReferral = referralRows.some((r) => r.status !== "draft");
  const hasDraftReferral = referralRows.some((r) => r.status === "draft");

  const currentStage = !approvedContext
    ? 1
    : hasSentReferral
      ? 5
      : hasDraftReferral
        ? 4
        : suitable.length > 0
          ? 3
          : 2;

  const statuses = [
    latestContext
      ? latestContext.status === "approved"
        ? "Summary approved"
        : "Needs your review"
      : "Start here",
    approvedContext
      ? `${suitable.length} suitable option${suitable.length === 1 ? "" : "s"}`
      : "Waiting for summary",
    selectedService
      ? selectedService.name
      : suitable.length
        ? "Choose a service"
        : "Waiting for matches",
    hasDraftReferral ? "Draft ready" : hasSentReferral ? "Referral sent" : "Not started",
    hasApprovedDocument
      ? "Case note complete"
      : draftDocuments > 0
        ? "Case note needs review"
        : hasSentReferral
          ? "Follow-up in progress"
          : "Waiting for referral",
  ];

  return {
    caseRow,
    latestContext: latestContext ?? null,
    approvedContext,
    matchResults,
    suitable,
    selectedService,
    referralRows,
    referralEvents,
    documents,
    currentStage,
    statuses,
  };
}
