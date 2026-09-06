import Link from "next/link";
import { ClientBar } from "../../../components/a2/ClientBar";
import { Empty } from "../../../components/a2/Empty";
import { PlanWorkspace } from "../../../components/a2/plan/PlanWorkspace";
import { Sheet } from "../../../components/a2/Sheet";
import { loadLatestPlan, loadPlan } from "../../../lib/a2/plan";

export const dynamic = "force-dynamic";

/**
 * The Services tab is a decision workspace for one person. It shows ranked
 * matches from her approved structured context instead of the raw directory.
 */
export default async function Shelters({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string }>;
}) {
  const { caseId } = await searchParams;
  const plan = caseId ? await loadPlan(caseId) : await loadLatestPlan();

  return (
    <>
      <header className="a2s-head">
        <h1>Community service matches</h1>
        <p className="a2s-sub">
          Structured case information ranked against the services database
        </p>
      </header>

      {plan ? (
        <>
          <div className="a2s-call-banner">
            <span aria-hidden="true">☎</span>
            <p>
              <b>Need current or missing information?</b>
              Call the service directly using the number on its card. Email is shown whenever it is available.
            </p>
          </div>
          <PlanWorkspace plan={plan} />
          <ClientBar name={plan.name} />
        </>
      ) : (
        <Sheet>
          <Empty>Extract and approve a person&apos;s notes before ranking community services.</Empty>
          <div className="a2s-btn-row" style={{ marginTop: 14 }}>
            <Link className="a2s-matte a2s-btn" href="/clients/new">Create a new note</Link>
          </div>
        </Sheet>
      )}
    </>
  );
}
