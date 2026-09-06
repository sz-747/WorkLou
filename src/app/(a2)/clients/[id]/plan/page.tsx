import { notFound } from "next/navigation";
import { ClientBar } from "../../../../../components/a2/ClientBar";
import { PlanWorkspace } from "../../../../../components/a2/plan/PlanWorkspace";
import { loadPlan } from "../../../../../lib/a2/plan";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await loadPlan(id);
  if (!plan) notFound();

  return (
    <>
      <header className="a2s-head">
        <h1>{plan.name}&rsquo;s top referrals</h1>
        <p className="a2s-sub">Her extracted profile and the three strongest community-service matches.</p>
      </header>

      <PlanWorkspace plan={plan} />
      <ClientBar name={plan.name} />
    </>
  );
}
