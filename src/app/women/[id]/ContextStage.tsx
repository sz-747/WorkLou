import type { ReactNode } from "react";
import type { CaseContext } from "../../../db/schema";
import { CONTEXT_FIELDS, fieldSourceOf, fieldValuePreview } from "../../../lib/context-fields";
import { approveContext, extractDraftContext, saveDraftContext } from "./actions";

type ContextRow = {
  id: string;
  version: number;
  context: CaseContext;
  status: string;
  extractionModel: string | null;
  approvedAt: Date | string | null;
};

const inputStyle = { width: "100%", padding: "0.45rem" } as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "block", margin: "0.55rem 0" }}>
      <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 650 }}>{label}</span>
      {children}
    </label>
  );
}

function SourceControls({ context }: { context: CaseContext }) {
  return (
    <details className="technical-details">
      <summary>Who provided each detail</summary>
      <p className="muted">Keep the woman&apos;s words separate from your observations.</p>
      {CONTEXT_FIELDS.map((field) => (
        <label key={field.key} className="source-control">
          {field.label}{" "}
          <select name={`source_${field.key}`} defaultValue={fieldSourceOf(context, field.key)}>
            <option value="woman_stated">Woman said</option>
            <option value="worker_observation">Worker observation</option>
          </select>
        </label>
      ))}
    </details>
  );
}

export function ContextStage({
  caseId,
  originalNotes,
  latest,
  extractError,
}: {
  caseId: string;
  originalNotes: string;
  latest: ContextRow | null;
  extractError?: string;
}) {
  const draft = latest?.status === "draft" ? latest : null;
  const context = latest?.context ?? null;

  return (
    <>
      {extractError ? <p className="error-message">We could not create the summary. Your notes are safe, so you can try again or fill it in yourself.</p> : null}

      <form action={extractDraftContext}>
        <input type="hidden" name="caseId" value={caseId} />
        <strong>Call notes</strong>
        <p className="muted">Add the fragments you captured during the conversation. You will check the summary before using it.</p>
        <textarea name="notes" rows={5} defaultValue={originalNotes} style={inputStyle} />
        <button type="submit">Create a summary</button>
      </form>

      {draft && context ? (
        <form action={saveDraftContext} className="review-panel">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="contextId" value={draft.id} />
          <h4>Check the summary <span className="pill draft">needs review</span></h4>
          <Field label="Short summary">
            <textarea name="summary" rows={3} defaultValue={context.summary ?? ""} style={inputStyle} />
          </Field>
          <Field label="What support does she need?">
            <input name="needs" defaultValue={context.needs.join(", ")} style={inputStyle} />
          </Field>
          <Field label="Suburb">
            <input name="suburb" defaultValue={context.suburb ?? ""} style={inputStyle} />
          </Field>
          <Field label="Languages">
            <input name="languages" defaultValue={context.languages.join(", ")} style={inputStyle} />
          </Field>
          <Field label="Urgency">
            <select name="urgency" defaultValue={context.urgency ?? ""} style={inputStyle}>
              <option value="">Not recorded</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </Field>
          <Field label="Safety preferences">
            <input name="safetyPreferences" defaultValue={context.safety_preferences ?? ""} style={inputStyle} />
          </Field>
          <Field label="Safest way to contact her">
            <input name="safeContactMethod" defaultValue={context.safe_contact_method ?? ""} style={inputStyle} />
          </Field>

          <details className="technical-details">
            <summary>Household and eligibility details</summary>
            <Field label="Catchment"><input name="catchment" defaultValue={context.catchment ?? ""} style={inputStyle} /></Field>
            <Field label="Number of children"><input name="childrenCount" type="number" min={0} defaultValue={context.children?.count ?? ""} style={inputStyle} /></Field>
            <Field label="Pets">
              <select name="petHas" defaultValue={context.pets ? (context.pets.has_pet ? "yes" : "no") : ""} style={inputStyle}>
                <option value="">Not recorded</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </Field>
            <Field label="Pet details"><input name="petDetails" defaultValue={context.pets?.details ?? ""} style={inputStyle} /></Field>
            <Field label="Income status"><input name="incomeStatus" defaultValue={context.income?.status ?? ""} style={inputStyle} /></Field>
            <Field label="Income source"><input name="incomeSource" defaultValue={context.income?.source ?? ""} style={inputStyle} /></Field>
            <Field label="Visa"><input name="visa" defaultValue={context.visa ?? ""} style={inputStyle} /></Field>
          </details>
          <SourceControls context={context} />
          <button type="submit">Save changes</button>
        </form>
      ) : null}

      {draft ? (
        <form action={approveContext} className="approval-row">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="contextId" value={draft.id} />
          <button type="submit">Approve summary</button>
          <span className="muted">This unlocks service matching.</span>
        </form>
      ) : null}

      {latest && !draft && context ? (
        <div>
          <h4>Approved summary <span className="pill approved">ready to use</span></h4>
          {context.summary ? <p>{context.summary}</p> : null}
          <div className="summary-grid">
            <p><strong>Needs</strong><span>{context.needs.join(", ") || "Not recorded"}</span></p>
            <p><strong>Location</strong><span>{context.suburb ?? "Not recorded"}</span></p>
            <p><strong>Urgency</strong><span>{context.urgency ?? "Not recorded"}</span></p>
            <p><strong>Safe contact</strong><span>{context.safe_contact_method ?? "Not recorded"}</span></p>
          </div>
          <details className="technical-details">
            <summary>View all details and who provided them</summary>
            <ul className="plain-list">
              {CONTEXT_FIELDS.map((field) => ({ field, value: fieldValuePreview(field.key, context) }))
                .filter(({ value }) => value)
                .map(({ field, value }) => (
                  <li key={field.key}>
                    <strong>{field.label}:</strong> {value}{" "}
                    <span className="muted">({fieldSourceOf(context, field.key) === "woman_stated" ? "Woman said" : "Worker observation"})</span>
                  </li>
                ))}
            </ul>
            <p className="muted">Summary version {latest.version}, approved {latest.approvedAt ? new Date(latest.approvedAt).toLocaleString("en-AU") : "date unavailable"}.</p>
          </details>
        </div>
      ) : null}

      {!latest ? <p className="muted">Create a summary when your notes are ready.</p> : null}
    </>
  );
}
