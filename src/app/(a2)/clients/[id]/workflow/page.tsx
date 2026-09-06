import Link from "next/link";
import { notFound } from "next/navigation";
import { StageSheet } from "../../../../../components/a2/StageSheet";
import { ClientBar } from "../../../../../components/a2/ClientBar";
import { ContextStage } from "../../../../women/[id]/ContextStage";
import { FindSupportStage } from "../../../../women/[id]/FindSupportStage";
import { VerifyStage } from "../../../../women/[id]/VerifyStage";
import { ReferStage } from "../../../../women/[id]/ReferStage";
import { FollowUpStage } from "../../../../women/[id]/FollowUpStage";
import { DocumentStage } from "../../../../women/[id]/DocumentStage";
import { loadWorkflow } from "../../../../../lib/a2/workflow";

/**
 * The five-stage casework workflow in the A2 visual language. The stage
 * components and their server actions are the existing ones, unchanged —
 * only the surrounding chrome is A2 (sheets, stage rings, typography).
 */
export const dynamic = "force-dynamic";

export default async function Workflow({
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

  const w = await loadWorkflow(id, verify);
  if (!w) notFound();

  const suitableIds = w.suitable.map((r) => ({ id: r.service.id, name: r.service.name }));

  return (
    <>
      <header className="a2s-head">
        <h1>Casework · {w.caseRow.clientRef}</h1>
        <p className="a2s-sub">
          Stage {w.currentStage} of 5 · nothing becomes final without your approval
        </p>
      </header>

      <div className="a2s-btn-row" style={{ marginBottom: 20 }}>
        <Link className="a2s-matte a2s-btn a2s-btn-sm" href={`/clients/${id}`}>
          Back to profile
        </Link>
      </div>

      <StageSheet
        number={1}
        title="Understand her needs"
        description="Turn your call notes into a clear summary."
        status={w.statuses[0]}
        open={w.currentStage === 1}
      >
        <ContextStage
          caseId={id}
          originalNotes={w.caseRow.originalNotes}
          latest={w.latestContext}
          extractError={extractError}
        />
      </StageSheet>

      <StageSheet
        number={2}
        title="Find suitable support"
        description="Review services that fit what she needs now."
        status={w.statuses[1]}
        open={w.currentStage === 2}
      >
        <FindSupportStage approved={w.approvedContext} results={w.matchResults} />
      </StageSheet>

      <StageSheet
        number={3}
        title="Confirm important details"
        description="Ask only what could change whether the service can help."
        status={w.statuses[2]}
        open={w.currentStage === 3}
      >
        <VerifyStage
          caseId={id}
          suitable={suitableIds}
          selected={w.selectedService}
          context={w.approvedContext?.context ?? null}
          verifyError={verifyError}
        />
      </StageSheet>

      <StageSheet
        number={4}
        title="Make the referral"
        description="Choose what to share, review the message and record it as sent."
        status={w.statuses[3]}
        open={w.currentStage === 4}
      >
        <ReferStage
          caseId={id}
          suitable={suitableIds}
          approvedContext={
            w.approvedContext
              ? { id: w.approvedContext.id, context: w.approvedContext.context }
              : null
          }
          referrals={w.referralRows}
          referError={referError}
        />
      </StageSheet>

      <StageSheet
        number={5}
        title="Follow through and document"
        description="Track replies until support starts, then finish the case note."
        status={w.statuses[4]}
        open={w.currentStage === 5}
      >
        <FollowUpStage
          caseId={id}
          referrals={w.referralRows}
          events={w.referralEvents}
          followUpError={followUpError}
        />
        <hr className="a2s-stage-divider" />
        <h3>Case note</h3>
        <DocumentStage
          caseId={id}
          originalNotes={w.caseRow.originalNotes}
          documents={w.documents}
          documentError={documentError}
        />
      </StageSheet>

      <ClientBar />
    </>
  );
}
