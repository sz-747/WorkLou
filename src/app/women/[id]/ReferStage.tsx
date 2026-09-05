/**
 * Phase 5 — Refer stage.
 * Worker picks a Find-support-suitable service, chooses which approved-context
 * items to share (minimal core set pre-selected), generates a draft, reviews
 * and edits it, then marks it sent — demo only, nothing is transmitted.
 * Woman-stated information and worker observations stay visibly separate.
 */
import type { CaseContext } from "../../../db/schema";
import {
  CONTEXT_FIELDS,
  fieldSourceOf,
  fieldValuePreview,
  type ContextFieldDef,
} from "../../../lib/context-fields";
import { defaultFollowUpDate } from "../../../lib/refer";
import { generateReferralDraft, markSent, saveReferralDraft } from "./refer-actions";

export type ReferralRow = {
  id: string;
  serviceId: string;
  serviceName: string;
  status: string;
  draftText: string | null;
  sentAt: Date | string | null;
  followUpDue: string | null;
  sharedFields: string[] | null;
  outcome: string | null;
  outcomeAt: Date | string | null;
  createdAt: Date | string;
};

const fmtDateTime = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("en-AU") : "—";

function ShareRow({ field, ctx }: { field: ContextFieldDef; ctx: CaseContext }) {
  const preview = fieldValuePreview(field.key, ctx);
  return (
    <label style={{ display: "block", fontSize: "0.85rem", margin: "0.15rem 0" }}>
      <input type="checkbox" name="share" value={field.key} defaultChecked={field.core} disabled={!preview} />{" "}
      <strong>{field.label}</strong>{" "}
      {preview ? (
        <span>— {preview}</span>
      ) : (
        <span style={{ color: "#888" }}>(nothing recorded)</span>
      )}
    </label>
  );
}

function ReferralCard({
  caseId,
  referral,
  urgency,
}: {
  caseId: string;
  referral: ReferralRow;
  urgency: string | null;
}) {
  return (
    <div className="support-card">
      <h4 style={{ margin: "0.25rem 0" }}>
        {referral.serviceName}{" "}
        <span className={`pill ${referral.status === "sent" ? "sent" : "draft"}`}>
          {referral.status}
        </span>
      </h4>
      <details className="technical-details">
        <summary>Information included in this referral</summary>
        <p>{referral.sharedFields?.join(", ") || "No fields recorded"}</p>
      </details>

      {referral.status === "draft" ? (
        <>
          <form action={saveReferralDraft}>
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="referralId" value={referral.id} />
            <textarea
              name="draftText"
              rows={10}
              defaultValue={referral.draftText ?? ""}
              style={{ width: "100%", padding: "0.3rem", fontFamily: "inherit", fontSize: "0.9rem" }}
            />
            <button type="submit">Save changes</button>
            <span className="muted" style={{ marginLeft: "0.5rem" }}>Check the wording before marking it sent.</span>
          </form>
          <form action={markSent} style={{ marginTop: "0.5rem" }}>
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="referralId" value={referral.id} />
            <label style={{ fontSize: "0.85rem" }}>
              Next follow-up due{" "}
              <input
                type="date"
                name="followUpDue"
                defaultValue={defaultFollowUpDate(new Date(), urgency)}
                style={{ padding: "0.2rem", marginLeft: "0.3rem" }}
              />
            </label>{" "}
            <button type="submit">Mark as sent</button>
            <p className="action-note">This demo records that you sent the referral. It does not email the provider.</p>
          </form>
        </>
      ) : (
        <>
          <p style={{ fontSize: "0.8rem", margin: "0.25rem 0" }}>
            Sent {fmtDateTime(referral.sentAt)} · Follow-up due {referral.followUpDue ?? "—"}
          </p>
          <details className="technical-details">
            <summary>View the sent referral</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>{referral.draftText}</pre>
          </details>
        </>
      )}
    </div>
  );
}

export function ReferStage({
  caseId,
  suitable,
  approvedContext,
  referrals,
  referError,
}: {
  caseId: string;
  suitable: { id: string; name: string }[];
  approvedContext: { id: string; context: CaseContext } | null;
  referrals: ReferralRow[];
  referError?: string;
}) {
  if (!approvedContext || suitable.length === 0) {
    return (
      <p style={{ fontSize: "0.85rem" }}>
        No suitable services to refer to yet — approve a context and find support first (stage 2).
      </p>
    );
  }

  const ctx = approvedContext.context;
  const womanStated = CONTEXT_FIELDS.filter((f) => fieldSourceOf(ctx, f.key) === "woman_stated");
  const workerObservations = CONTEXT_FIELDS.filter(
    (f) => fieldSourceOf(ctx, f.key) === "worker_observation",
  );
  const coreWomanStated = womanStated.filter((field) => field.core);
  const additionalWomanStated = womanStated.filter((field) => !field.core);

  return (
    <>
      {referError && (
        <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>Referral error: {referError}</p>
      )}

      <form action={generateReferralDraft} style={{ margin: "0.5rem 0" }}>
        <input type="hidden" name="caseId" value={caseId} />
        <label style={{ fontSize: "0.85rem", display: "block", margin: "0.3rem 0" }}>
          <strong>Refer to</strong>{" "}
          <select name="serviceId" style={{ padding: "0.25rem", marginLeft: "0.3rem" }}>
            {suitable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <h4 style={{ margin: "0.8rem 0 0.2rem", fontSize: "0.9rem" }}>Information she has agreed to share</h4>
        {coreWomanStated.map((f) => (
          <ShareRow key={f.key} field={f} ctx={ctx} />
        ))}
        <details className="technical-details">
          <summary>Additional details you may choose to share</summary>
          {additionalWomanStated.map((f) => <ShareRow key={f.key} field={f} ctx={ctx} />)}
        </details>
        <details className="technical-details">
          <summary>Your observations</summary>
          <p className="muted">These stay separate from what the woman said.</p>
          {workerObservations.map((f) => <ShareRow key={f.key} field={f} ctx={ctx} />)}
        </details>
        <p className="muted">Untick anything she does not want shared.</p>
        <button type="submit">Create referral draft</button>
      </form>

      <h4 style={{ margin: "0.75rem 0 0.25rem" }}>Referrals</h4>
      {referrals.length === 0 && <p style={{ fontSize: "0.85rem" }}>No referrals yet.</p>}
      {referrals.map((r) => (
        <ReferralCard key={r.id} caseId={caseId} referral={r} urgency={ctx.urgency} />
      ))}
    </>
  );
}
