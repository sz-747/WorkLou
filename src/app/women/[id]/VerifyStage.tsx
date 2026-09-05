import Link from "next/link";
import type { CaseContext } from "../../../db/schema";
import { sydneyDate } from "../../../lib/dates";
import type { FactRow } from "../../../lib/matching";
import { factLabel, groupFacts } from "../../../lib/verify";
import { markStale, recordConfirmation, refreshMachineFacts } from "./verify-actions";

type SelectedService = {
  id: string;
  name: string;
  phone: string | null;
  facts: FactRow[];
};

const inputStyle = { padding: "0.4rem", width: "100%" } as const;

function freshness(fact: FactRow): string {
  const date = (value: Date | string | null) => value ? new Date(value).toLocaleDateString("en-AU") : "date unavailable";
  if (fact.confirmedAt) return `${fact.confirmedBy ?? "Provider"} confirmed this on ${date(fact.confirmedAt)}`;
  return `${fact.sourceName ?? fact.sourceType}, checked ${date(fact.retrievedAt)}`;
}

export function VerifyStage({
  caseId,
  suitable,
  selected,
  context,
  verifyError,
}: {
  caseId: string;
  suitable: { id: string; name: string }[];
  selected: SelectedService | null;
  context: CaseContext | null;
  verifyError?: string;
}) {
  if (!context || suitable.length === 0) {
    return <p className="muted">Suitable services will appear here after the summary and shortlist are ready.</p>;
  }

  const facts = selected ? groupFacts(context, selected.facts) : null;

  return (
    <>
      {verifyError ? <p className="error-message">That confirmation was not saved. Please check the answer and try again.</p> : null}

      <strong>Which service are you checking?</strong>
      <div className="service-choice-list">
        {suitable.map((service) => (
          selected?.id === service.id ? (
            <span key={service.id} className="service-choice selected">{service.name}</span>
          ) : (
            <Link key={service.id} className="service-choice" href={`/women/${caseId}?verify=${service.id}`}>{service.name}</Link>
          )
        ))}
      </div>

      {!selected ? <p className="action-note">Choose a service to see the few questions that still need an answer.</p> : null}

      {selected && facts ? (
        <>
          <div className="selected-service">
            <div>
              <p className="eyebrow">Checking now</p>
              <h4>{selected.name}</h4>
            </div>
            {selected.phone ? <a className="call-link" href={`tel:${selected.phone}`}>Call {selected.phone}</a> : null}
          </div>

          {facts.needsConfirmation.length === 0 ? (
            <p className="success-message">No current provider call is needed. You can prepare the referral.</p>
          ) : (
            <p>Ask the provider these {facts.needsConfirmation.length} question{facts.needsConfirmation.length === 1 ? "" : "s"}:</p>
          )}

          {facts.needsConfirmation.map((item) => (
            <form key={item.key + (item.fact?.id ?? "missing")} action={recordConfirmation} className="confirmation-card">
              <input type="hidden" name="caseId" value={caseId} />
              <input type="hidden" name="serviceId" value={selected.id} />
              <input type="hidden" name="attrId" value={item.fact?.id ?? ""} />
              <input type="hidden" name="attrType" value={item.attrType} />
              <input type="hidden" name="key" value={item.key} />
              <h4>Ask about {item.label.toLowerCase()}</h4>
              <p className="muted">{item.hint}</p>
              {item.history ? (
                <details className="technical-details">
                  <summary>Previous answer</summary>
                  <p>{item.history}</p>
                </details>
              ) : null}
              <div className="form-grid">
                <label>Provider&apos;s answer<input name="value" style={inputStyle} required /></label>
                <label>Your name or initials<input name="confirmedBy" style={inputStyle} required /></label>
                <label>Date<input name="confirmedAt" type="date" defaultValue={sydneyDate(new Date())} style={inputStyle} required /></label>
                <label>Notes, if useful<input name="notes" style={inputStyle} /></label>
              </div>
              <button type="submit">Save answer</button>
            </form>
          ))}

          <details className="technical-details">
            <summary>Information already checked ({facts.known.length})</summary>
            <p className="muted">You do not need to ask these questions again unless something looks wrong.</p>
            <form action={refreshMachineFacts}>
              <input type="hidden" name="caseId" value={caseId} />
              <input type="hidden" name="serviceId" value={selected.id} />
              <button type="submit" className="secondary-button">Check online information again</button>
            </form>
            {facts.known.length === 0 ? <p className="muted">Nothing has been checked yet.</p> : null}
            <ul className="plain-list">
              {facts.known.map((fact) => (
                <li key={fact.id ?? `${fact.attrType}-${fact.key}-${fact.value}`}>
                  <strong>{factLabel(fact.key)}:</strong> {fact.value} <span className="muted">({freshness(fact)})</span>{" "}
                  <form action={markStale} style={{ display: "inline" }}>
                    <input type="hidden" name="caseId" value={caseId} />
                    <input type="hidden" name="serviceId" value={selected.id} />
                    <input type="hidden" name="attrId" value={fact.id ?? ""} />
                    <button type="submit" className="text-button" disabled={!fact.id}>Looks out of date</button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </>
  );
}
