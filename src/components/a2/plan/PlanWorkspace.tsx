"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { Plan, PlanServiceOption } from "../../../lib/a2/plan";
import {
  approveReferral,
  type ReferralActionState,
} from "../../../app/(a2)/clients/[id]/plan/actions";
import { Sheet } from "../Sheet";

const INITIAL_REFERRAL_STATE: ReferralActionState = {
  status: "idle",
  serviceId: null,
  message: null,
};

const STATUS_ICON: Record<PlanServiceOption["criteria"][number]["status"], string> = {
  matched: "✓",
  stale: "!",
  needs_provider_confirmation: "?",
  not_recorded: "?",
  mismatch: "×",
};

function MarkSentButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="a2s-btn-primary a2s-matte" disabled={pending || disabled}>
      {pending ? "Saving..." : "Mark as sent"}
    </button>
  );
}

function ReferralModal({
  plan,
  service,
  onClose,
  onComplete,
}: {
  plan: Plan;
  service: PlanServiceOption;
  onClose: () => void;
  onComplete: (serviceId: string) => void;
}) {
  const [body, setBody] = useState(service.emailBody);
  const [handoffMessage, setHandoffMessage] = useState<string | null>(null);
  const [state, formAction] = useActionState(approveReferral, INITIAL_REFERRAL_STATE);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setHandoffMessage("Email copied. Paste it into the Gmail message.");
    } catch {
      setHandoffMessage("Copy was blocked. Select the draft text and copy it manually.");
    }
  };

  const openGmail = () => {
    if (!service.email) return;
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: service.email,
      su: service.emailSubject,
    });
    const popup = window.open(
      `https://mail.google.com/mail/?${params.toString()}`,
      "worklou-gmail-compose",
      "popup=yes,width=900,height=720,resizable=yes,scrollbars=yes",
    );
    if (popup) {
      popup.focus();
      setHandoffMessage("Gmail opened with the recipient and subject filled in. Paste the copied email, then send it.");
    } else {
      setHandoffMessage("Your browser blocked the Gmail popup. Allow popups for WorkLou and try again.");
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (state.status === "success" && state.serviceId) onComplete(state.serviceId);
  }, [onComplete, state.serviceId, state.status]);

  return (
    <div className="a2s-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="a2s-referral-modal" role="dialog" aria-modal="true" aria-labelledby="referral-title">
        <div className="a2s-referral-modal-head">
          <div>
            <span className="a2s-plan-eyebrow">Prepared referral</span>
            <h2 id="referral-title">Email {service.name}</h2>
          </div>
          <button type="button" className="a2s-modal-close" onClick={onClose} aria-label="Close referral draft">
            ×
          </button>
        </div>

        <p className="a2s-referral-subject"><b>Subject</b> {service.emailSubject}</p>
        <dl className="a2s-referral-addresses">
          <div><dt>From</dt><dd>{plan.sender.email || "Set Hannah's email in Settings"}</dd></div>
          <div><dt>To</dt><dd>{service.email || "No email found · call this service"}</dd></div>
        </dl>
        <p className="a2s-demo-send-note">
          Review the draft, copy it, then open Gmail. Gmail sends from the account currently signed in. After sending,
          return here and mark it sent.
        </p>
        <form action={formAction}>
          <input type="hidden" name="caseId" value={plan.caseId} />
          <input type="hidden" name="serviceId" value={service.id} />
          <textarea
            className="a2s-field a2s-referral-body"
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            aria-label={`Referral email to ${service.name}`}
          />
          {handoffMessage && <p className="a2s-email-handoff-message" aria-live="polite">{handoffMessage}</p>}
          {state.status === "error" && <p className="a2s-form-error" role="alert">{state.message}</p>}
          <div className="a2s-referral-modal-actions">
            <div className="a2s-referral-handoff-actions">
              <button type="button" className="a2s-matte a2s-btn" onClick={copyEmail}>Copy email</button>
              <button type="button" className="a2s-matte a2s-btn" onClick={openGmail} disabled={!service.email}>
                Open Gmail
              </button>
            </div>
            <div className="a2s-referral-record-actions">
              <button type="button" className="a2s-matte a2s-btn" onClick={onClose}>Cancel</button>
              <MarkSentButton disabled={!service.email} />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function ServiceCard({
  service,
  completed,
  onDraft,
}: {
  service: PlanServiceOption;
  completed: boolean;
  onDraft: () => void;
}) {
  const strengths = service.criteria.filter((criterion) => criterion.status === "matched").slice(0, 4);
  const tradeoffs = service.criteria.filter((criterion) => criterion.status !== "matched").slice(0, 4);

  return (
    <article className={`a2s-ranked-service is-rank-${service.rank}`}>
      <div className="a2s-ranked-service-head">
        <span className="a2s-rank" aria-label={`Rank ${service.rank}`}>{service.rank}</span>
        <div className="a2s-ranked-service-name">
          <h3>{service.name}</h3>
          <p>{[service.organisation, service.catchment].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="a2s-fit-score" aria-label={`${service.score} percent fit score`}>
          <strong>{service.score}</strong><span>/100 fit</span>
        </div>
      </div>

      {service.reason && <p className="a2s-ranked-warning">Trade-off: {service.reason}</p>}

      <div className="a2s-service-contact">
        {service.email ? (
          <a href={`mailto:${service.email}`}><small>Email</small><b>{service.email}</b></a>
        ) : (
          <span className="is-missing"><small>Email</small><b>Not found · call directly</b></span>
        )}
        {service.phone ? (
          <a href={`tel:${service.phone.replace(/[^+\d]/g, "")}`}><small>Phone</small><b>{service.phone}</b></a>
        ) : (
          <span className="is-missing"><small>Phone</small><b>Not recorded</b></span>
        )}
      </div>

      <div className="a2s-service-fit-breakdown">
        <section>
          <h4>Why it fits her circumstances</h4>
          {strengths.length > 0 ? (
            <ul>
              {strengths.map((criterion) => (
                <li key={criterion.key}>
                  <span className="a2s-criterion-icon" aria-hidden="true">{STATUS_ICON[criterion.status]}</span>
                  <span><b>{criterion.label}</b><small>{criterion.detail}</small></span>
                </li>
              ))}
            </ul>
          ) : <p>No confirmed strengths recorded.</p>}
        </section>
        <section className="is-tradeoffs">
          <h4>Trade-offs to check</h4>
          {tradeoffs.length > 0 ? (
            <ul>
              {tradeoffs.map((criterion) => (
                <li className={`is-${criterion.status}`} key={criterion.key}>
                  <span className="a2s-criterion-icon" aria-hidden="true">{STATUS_ICON[criterion.status]}</span>
                  <span><b>{criterion.label}</b><small>{criterion.detail}</small></span>
                </li>
              ))}
            </ul>
          ) : <p>No recorded conflicts. Confirm current availability before referral.</p>}
        </section>
      </div>

      <div className="a2s-ranked-service-actions">
        {service.phone ? (
          <a className="a2s-matte a2s-btn" href={`tel:${service.phone.replace(/[^+\d]/g, "")}`}>
            Call {service.phone}
          </a>
        ) : (
          <span className="a2s-service-no-phone">Phone not recorded</span>
        )}
        <button type="button" className="a2s-btn-primary a2s-matte" onClick={onDraft} disabled={completed || !service.email}>
          {completed ? "Added to Follow-ups" : service.email ? "Draft referral email" : "Email unavailable"}
        </button>
      </div>
    </article>
  );
}

export function PlanWorkspace({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [selected, setSelected] = useState<PlanServiceOption | null>(null);
  const [completedIds, setCompletedIds] = useState(
    () => new Set(plan.services.filter((service) => service.referralStatus && service.referralStatus !== "draft").map((service) => service.id)),
  );

  const actions = useMemo(() => plan.actions.map((action) => {
    if (action.key === "confirm" && (selected || completedIds.size)) return { ...action, state: "done" as const };
    if (action.key === "referral" && completedIds.size) return { ...action, state: "done" as const };
    if (action.key === "followthrough" && completedIds.size) return { ...action, state: "next" as const };
    return action;
  }), [completedIds, plan.actions, selected]);

  const completeReferral = (serviceId: string) => {
    setCompletedIds((current) => new Set(current).add(serviceId));
    setSelected(null);
    router.refresh();
  };

  return (
    <>
      <div className="a2s-plan-layout">
        <main className="a2s-plan-main">
          <Sheet>
            <div className="a2s-plan-overview">
              <div>
                <span className="a2s-plan-eyebrow">Referral profile</span>
                <h2>{plan.name}</h2>
                <p>{plan.location} · {plan.ref}</p>
              </div>
              {plan.summary && <p className="a2s-plan-summary">{plan.summary}</p>}
            </div>
            {plan.critical.length > 0 && (
              <div className="a2s-plan-priorities">
                <h3>What matters for this search</h3>
                <div className="a2s-plan-pills" aria-label="Critical case information">
                  {plan.critical.map((item) => (
                    <span className="a2s-plan-pill" key={item.key}>
                      <small>{item.label}</small><b>{item.value}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Sheet>

          <section className="a2s-ranked-section" aria-labelledby="ranked-services-title">
            <div className="a2s-ranked-title-row">
              <div>
                <span className="a2s-plan-eyebrow">Community service ranking</span>
                <h2 id="ranked-services-title">Top 3 community referrals</h2>
              </div>
              <p>{plan.searchedCount} services checked against the approved case information.</p>
            </div>
            <p className="a2s-score-note">Fit score: needs 40%, eligibility 35%, location 15%, current evidence 10%.</p>

            <div className="a2s-ranked-list">
              {plan.services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  completed={completedIds.has(service.id)}
                  onDraft={() => setSelected(service)}
                />
              ))}
              {plan.services.length === 0 && (
                <div className="a2s-route-loading" role="status">
                  <span className="a2s-route-loading-dot" aria-hidden="true" />
                  <div><strong>Preparing ranked matches</strong><p>The approved details are being checked against community services.</p></div>
                </div>
              )}
            </div>
          </section>
        </main>

        <aside className="a2s-plan-actions">
          <Sheet>
            <span className="a2s-plan-eyebrow">Five-step referral process</span>
            <h2>Her journey</h2>
            <ol>
              {actions.map((action, index) => (
                <li className={`is-${action.state}`} key={action.key}>
                  <span>{action.state === "done" ? "✓" : index + 1}</span>
                  <p><b>{action.title}</b><small>{action.state === "done" ? "Complete" : action.state === "waiting" ? "Waiting" : "Next"}</small></p>
                </li>
              ))}
            </ol>
          </Sheet>
        </aside>
      </div>

      {selected && (
        <ReferralModal
          plan={plan}
          service={selected}
          onClose={() => setSelected(null)}
          onComplete={completeReferral}
        />
      )}
    </>
  );
}
