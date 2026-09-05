import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../db";
import { caseContexts, cases } from "../../../db/schema";
import { ContextStage } from "./ContextStage";
import { FindSupportStage } from "./FindSupportStage";
import { ReferStage } from "./ReferStage";
import { VerifyStage } from "./VerifyStage";
import { FollowUpStage } from "./FollowUpStage";
import { getLatestApprovedContext, getMatchCandidates, matchServices } from "../../../lib/matching";
import { getServiceForVerify } from "../../../lib/verify";
import { getReferralsForCase } from "../../../lib/refer";
import { getReferralEventsForCase } from "../../../lib/followup";
import { getCaseDocuments } from "../../../lib/document";
import { DocumentStage } from "./DocumentStage";
import { WorkflowStage } from "./WorkflowStage";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-AU") : "—";

export default async function CaseWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    extractError?: string;
    verify?: string;
    verifyError?: string;
    referError?: string;
    followUpError?: string;
    documentError?: string;
  }>;
}) {
  const { id } = await params;
  const { extractError, verify, verifyError, referError, followUpError, documentError } =
    await searchParams;

  const [caseRows, latestContexts, referralRows, referralEvents, documents, approvedContext] = await Promise.all([
    db.select().from(cases).where(eq(cases.id, id)),
    db.select().from(caseContexts).where(eq(caseContexts.caseId, id)).orderBy(desc(caseContexts.version)).limit(1),
    getReferralsForCase(id),
    getReferralEventsForCase(id),
    getCaseDocuments(id),
    getLatestApprovedContext(id),
  ]);
  const [caseRow] = caseRows;
  if (!caseRow) notFound();
  const [latestContext] = latestContexts;
  const docCount = documents.filter((d) => d.status === "draft").length;

  const matchResults = approvedContext
    ? matchServices(approvedContext.context, await getMatchCandidates())
    : null;

  const suitable = (matchResults ?? []).filter((r) => r.suitable);
  const verifyServiceId = verify && suitable.some((r) => r.service.id === verify) ? verify : null;
  const selectedService = verifyServiceId ? await getServiceForVerify(verifyServiceId) : null;

  const hasApprovedDocument = documents.some((document) => document.status === "approved");
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
  const finalStageStatus = hasApprovedDocument
    ? "Case note complete"
    : docCount > 0
      ? "Case note needs review"
      : hasSentReferral
        ? "Follow-up in progress"
        : "Waiting for referral";

  return (
    <main>
      <header className="case-header">
        <div>
          <p className="eyebrow">Case workspace</p>
          <h1>{caseRow.clientRef}</h1>
          <p>Created {fmtDate(caseRow.createdAt)}</p>
        </div>
        <span className="case-status">{caseRow.status}</span>
      </header>

      <div className="workflow-intro">
        <div>
          <p className="eyebrow">Recommended next step</p>
          <h2>Stage {currentStage} of 5</h2>
        </div>
        <p>Open any stage when the situation changes. Nothing becomes final without your approval.</p>
      </div>

      <section className="workflow-list" aria-label="Casework stages">
        <WorkflowStage
          number={1}
          title="Understand her needs"
          description="Turn your call notes into a clear summary."
          status={latestContext ? (latestContext.status === "approved" ? "Summary approved" : "Needs your review") : "Start here"}
          open={currentStage === 1}
        >
        <ContextStage
          caseId={id}
          originalNotes={caseRow.originalNotes}
          latest={latestContext}
          extractError={extractError}
        />
        </WorkflowStage>
        <WorkflowStage
          number={2}
          title="Find suitable support"
          description="Review services that fit what she needs now."
          status={approvedContext ? `${suitable.length} suitable option${suitable.length === 1 ? "" : "s"}` : "Waiting for summary"}
          open={currentStage === 2}
        >
        <FindSupportStage approved={approvedContext} results={matchResults} />
        </WorkflowStage>
        <WorkflowStage
          number={3}
          title="Confirm important details"
          description="Ask only what could change whether the service can help."
          status={selectedService ? selectedService.name : suitable.length ? "Choose a service" : "Waiting for matches"}
          open={currentStage === 3}
        >
        <VerifyStage
          caseId={id}
          suitable={suitable.map((r) => ({ id: r.service.id, name: r.service.name }))}
          selected={selectedService}
          context={approvedContext?.context ?? null}
          verifyError={verifyError}
        />
        </WorkflowStage>
        <WorkflowStage
          number={4}
          title="Make the referral"
          description="Choose what to share, review the message and record it as sent."
          status={hasDraftReferral ? "Draft ready" : hasSentReferral ? "Referral sent" : "Not started"}
          open={currentStage === 4}
        >
        <ReferStage
          caseId={id}
          suitable={suitable.map((r) => ({ id: r.service.id, name: r.service.name }))}
          approvedContext={
            approvedContext ? { id: approvedContext.id, context: approvedContext.context } : null
          }
          referrals={referralRows}
          referError={referError}
        />
        </WorkflowStage>
        <WorkflowStage
          number={5}
          title="Follow through and document"
          description="Track replies until support starts, then finish the case note."
          status={finalStageStatus}
          open={currentStage === 5}
        >
        <FollowUpStage
          caseId={id}
          referrals={referralRows}
          events={referralEvents}
          followUpError={followUpError}
        />
        <hr className="stage-divider" />
        <h3>Case note</h3>
        <DocumentStage
          caseId={id}
          originalNotes={caseRow.originalNotes}
          documents={documents}
          documentError={documentError}
        />
        </WorkflowStage>
      </section>

      <p>
        <Link href="/women">← All women</Link>
      </p>
    </main>
  );
}
