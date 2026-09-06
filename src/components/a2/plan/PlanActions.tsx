import Link from "next/link";
import { Sheet } from "../Sheet";
import { Empty } from "../Empty";
import type { PlanAction, PlanServiceOption } from "../../../lib/a2/plan";

const STATE_LABEL: Record<PlanAction["state"], string> = {
  done: "done",
  waiting: "waiting",
  next: "next",
};

/**
 * Step 2 — what is being done, and the services the search found. Each found
 * service bridges straight into the need it answers: choosing one writes the
 * email in step 3.
 */
export function PlanActions({
  caseId,
  needLabel,
  actions,
  services,
  selectedId,
}: {
  caseId: string;
  needLabel: string;
  actions: PlanAction[];
  services: PlanServiceOption[];
  selectedId: string | null;
}) {
  const shortlist = services.filter((service) => service.suitable);
  const rest = services.filter((service) => !service.suitable);

  return (
    <>
      <Sheet
        title="2 · Actions"
        action={
          <Link className="a2s-link" href={`/clients/${caseId}/workflow`}>
            Casework stages
          </Link>
        }
      >
        <ul className="a2s-rows">
          {actions.map((action) => (
            <li key={action.key}>
              <span className="a2s-row-left">
                <span className="a2s-ring" aria-hidden="true" />
                <span className="a2s-row-text">
                  <span className="a2s-row-title" style={{ fontSize: 15 }}>
                    {action.title}
                  </span>
                  <span className="a2s-row-detail">{action.detail}</span>
                </span>
              </span>
              <span className={`a2s-tag${action.state === "next" ? " is-accent" : ""}`}>
                {STATE_LABEL[action.state]}
              </span>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        title="Community services we found"
        note={`Searched our service database for ${needLabel}.`}
      >
        {services.length === 0 ? (
          <Empty>Nothing searched yet — an approved summary starts the search.</Empty>
        ) : (
          <ul className="a2s-rows">
            {[...shortlist, ...rest].map((service) => (
              <li key={service.id}>
                <span className="a2s-row-left">
                  <span className="a2s-ring" aria-hidden="true" />
                  <span className="a2s-row-text">
                    <span className="a2s-row-title" style={{ fontSize: 15 }}>
                      {service.name}
                    </span>
                    <span className="a2s-row-detail">
                      {[service.organisation, service.detail].filter(Boolean).join(" · ")}
                      {service.alreadyReferred ? " · already referred" : ""}
                    </span>
                  </span>
                </span>
                {service.id === selectedId ? (
                  <span className="a2s-tag is-accent">writing the email</span>
                ) : (
                  <Link
                    className="a2s-matte a2s-btn a2s-btn-sm"
                    href={`/clients/${caseId}/plan?service=${service.id}#email`}
                  >
                    Draft email for this need
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
