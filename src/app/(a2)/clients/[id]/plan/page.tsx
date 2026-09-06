import { notFound } from "next/navigation";
import { ClientBar } from "../../../../../components/a2/ClientBar";
import { PlanSuggestions } from "../../../../../components/a2/plan/PlanSuggestions";
import { PlanActions } from "../../../../../components/a2/plan/PlanActions";
import { AltServiceEmail } from "../../../../../components/a2/plan/AltServiceEmail";
import { loadPlan } from "../../../../../lib/a2/plan";

/**
 * A2 / Plan · <her name> — one workflow, top to bottom: suggestions →
 * actions and the services we found → the email to an alternative service.
 */
export const dynamic = "force-dynamic";

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const [{ id }, { service }] = await Promise.all([params, searchParams]);
  const plan = await loadPlan(id, service);
  if (!plan) notFound();

  return (
    <>
      <header className="a2s-head">
        <h1>{plan.name}&rsquo;s plan</h1>
        <p className="a2s-sub">{plan.subline}</p>
      </header>

      <div className="a2s-plan-flow">
        <PlanSuggestions firstName={plan.firstName} suggestions={plan.suggestions} />

        <PlanActions
          caseId={plan.caseId}
          needLabel={plan.needs.join(", ") || "her recorded needs"}
          actions={plan.actions}
          services={plan.services}
          selectedId={plan.selected?.id ?? null}
        />

        <div id="email">
          <AltServiceEmail
            key={plan.selected?.id ?? "none"}
            caseId={plan.caseId}
            serviceId={plan.selected?.id ?? null}
            serviceName={plan.selected?.name ?? null}
            subject={plan.emailSubject}
            body={plan.emailBody}
            known={plan.known}
            firstName={plan.firstName}
          />
        </div>
      </div>

      <ClientBar name={plan.name} caseRef={plan.ref} />
    </>
  );
}
