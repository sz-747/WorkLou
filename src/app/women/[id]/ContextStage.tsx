/**
 * Phase 2 — Context stage.
 * Notes form → LLM extraction → editable DRAFT review form → approve.
 * Drafts are clearly marked; approved rows are read-only here.
 */
import type { CaseContext } from "../../../db/schema";
import { CONTEXT_FIELDS, fieldSourceOf } from "../../../lib/context-fields";
import { approveContext, extractDraftContext, saveDraftContext } from "./actions";

type ContextRow = {
  id: string;
  version: number;
  context: CaseContext;
  status: string;
  extractionModel: string | null;
  approvedAt: Date | string | null;
};

const inputStyle = { width: "100%", padding: "0.3rem" } as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", margin: "0.4rem 0" }}>
      <span style={{ fontSize: "0.8rem", display: "block" }}>{label}</span>
      {children}
    </label>
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
  const ctx: CaseContext | null = latest?.context ?? null;

  return (
    <>
      {extractError && (
        <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>Extraction error: {extractError}</p>
      )}

      {/* Notes + extraction — always creates a NEW draft version */}
      <form action={extractDraftContext} style={{ margin: "0.5rem 0" }}>
        <input type="hidden" name="caseId" value={caseId} />
        <span style={{ fontSize: "0.8rem", display: "block" }}>Rough notes</span>
        <textarea
          name="notes"
          rows={5}
          defaultValue={originalNotes}
          style={{ width: "100%", padding: "0.3rem" }}
        />
        <button type="submit">Extract draft context</button>
        <p style={{ fontSize: "0.75rem", color: "#888", margin: "0.25rem 0" }}>
          Saves the notes on the case and creates a new draft context version. Existing versions
          (approved or draft) are never overwritten.
        </p>
      </form>

      {/* Draft review — editable, clearly marked as unapproved */}
      {draft && ctx && (
        <form action={saveDraftContext} style={{ border: "1px dashed #f59e0b", padding: "0.5rem 1rem", margin: "0.75rem 0" }}>
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="contextId" value={draft.id} />
          <h4 style={{ margin: "0.25rem 0" }}>
            Draft v{draft.version} — not approved{" "}
            <span className="pill draft">draft</span>
            <span style={{ fontSize: "0.7rem", color: "#888" }}>
              {" "}
              (extracted by {draft.extractionModel ?? "unknown model"})
            </span>
          </h4>
          <Field label="Needs (comma-separated)">
            <input name="needs" defaultValue={ctx.needs.join(", ")} style={inputStyle} />
          </Field>
          <Field label="Suburb">
            <input name="suburb" defaultValue={ctx.suburb ?? ""} style={inputStyle} />
          </Field>
          <Field label="Catchment">
            <input name="catchment" defaultValue={ctx.catchment ?? ""} style={inputStyle} />
          </Field>
          <Field label="Number of children">
            <input
              name="childrenCount"
              type="number"
              min={0}
              defaultValue={ctx.children?.count ?? ""}
              style={inputStyle}
            />
          </Field>
          <Field label="Pets (yes / no / blank)">
            <select
              name="petHas"
              defaultValue={ctx.pets ? (ctx.pets.has_pet ? "yes" : "no") : ""}
              style={inputStyle}
            >
              <option value=""></option>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </Field>
          <Field label="Pet details">
            <input name="petDetails" defaultValue={ctx.pets?.details ?? ""} style={inputStyle} />
          </Field>
          <Field label="Income status">
            <input name="incomeStatus" defaultValue={ctx.income?.status ?? ""} style={inputStyle} />
          </Field>
          <Field label="Income source">
            <input name="incomeSource" defaultValue={ctx.income?.source ?? ""} style={inputStyle} />
          </Field>
          <Field label="Visa">
            <input name="visa" defaultValue={ctx.visa ?? ""} style={inputStyle} />
          </Field>
          <Field label="Languages (comma-separated)">
            <input name="languages" defaultValue={ctx.languages.join(", ")} style={inputStyle} />
          </Field>
          <Field label="Urgency">
            <select name="urgency" defaultValue={ctx.urgency ?? ""} style={inputStyle}>
              <option value=""></option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </Field>
          <Field label="Safety preferences">
            <input
              name="safetyPreferences"
              defaultValue={ctx.safety_preferences ?? ""}
              style={inputStyle}
            />
          </Field>
          <Field label="Safe contact method">
            <input
              name="safeContactMethod"
              defaultValue={ctx.safe_contact_method ?? ""}
              style={inputStyle}
            />
          </Field>
          <Field label="Summary">
            <textarea name="summary" rows={2} defaultValue={ctx.summary ?? ""} style={inputStyle} />
          </Field>
          {/* Phase 5: who stated each field — used by Refer to keep
              woman-stated information separate from worker observations */}
          <p style={{ fontSize: "0.8rem", margin: "0.5rem 0 0.2rem" }}>
            Who stated each item (editable — the referral draft keeps these separate):
          </p>
          {CONTEXT_FIELDS.map((f) => (
            <label
              key={f.key}
              style={{ display: "inline-block", marginRight: "0.9rem", marginBottom: "0.3rem", fontSize: "0.75rem" }}
            >
              {f.label}{" "}
              <select
                name={`source_${f.key}`}
                defaultValue={fieldSourceOf(ctx, f.key)}
                style={{ padding: "0.15rem", fontSize: "0.75rem" }}
              >
                <option value="woman_stated">woman-stated</option>
                <option value="worker_observation">worker observation</option>
              </select>
            </label>
          ))}
          <button type="submit">Save changes</button>
        </form>
      )}

      {/* Approve — only drafts */}
      {draft && (
        <form action={approveContext} style={{ margin: "0.5rem 0" }}>
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="contextId" value={draft.id} />
          <button type="submit">Approve v{draft.version}</button>
        </form>
      )}

      {/* Approved / read-only view */}
      {latest && !draft && (
        <div style={{ margin: "0.75rem 0" }}>
          <h4 style={{ margin: "0.25rem 0" }}>
            Context v{latest.version}{" "}
            <span className="pill approved">approved</span>{" "}
            <span style={{ fontSize: "0.7rem", color: "#888" }}>
              approved {latest.approvedAt ? new Date(latest.approvedAt).toLocaleString("en-AU") : ""}
            </span>
          </h4>
          <table>
            <tbody>
              {ctx &&
                Object.entries(ctx)
                  .filter(([k]) => k !== "field_sources")
                  .map(([k, v]) => (
                    <tr key={k}>
                      <th>{k}</th>
                      <td>
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}{" "}
                        <span style={{ color: "#888", fontSize: "0.7rem" }}>
                          ({fieldSourceOf(ctx, k).replace(/_/g, " ")})
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {!latest && <p style={{ fontSize: "0.85rem" }}>No context yet — extract a draft above.</p>}
    </>
  );
}
