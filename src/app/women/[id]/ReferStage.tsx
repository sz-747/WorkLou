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

function ReferralCard({ caseId, referral }: { caseId: string; referral: ReferralRow }) {
  return (
    <div style={{ border: "1px solid #eee", padding: "0.5rem 1rem", margin: "0.5rem 0" }}>
      <h4 style={{ margin: "0.25rem 0" }}>
        {referral.serviceName}{" "}
        <span className={`pill ${referral.status === "sent" ? "sent" : "draft"}`}>
          {referral.status}
        </span>
      </h4>
      <p style={{ fontSize: "0.75rem", color: "#888", margin: "0.1rem 0" }}>
        shared: {referral.sharedFields?.join(", ") || "—"}
      </p>

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
            <span style={{ fontSize: "0.7rem", color: "#888", marginLeft: "0.5rem" }}>
              Draft — review and edit before marking sent.
            </span>
          </form>
          <form action={markSent} style={{ marginTop: "0.5rem" }}>
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="referralId" value={referral.id} />
            <label style={{ fontSize: "0.85rem" }}>
              Next follow-up due{" "}
              <input
                type="date"
                name="followUpDue"
                defaultValue={defaultFollowUpDate()}
                style={{ padding: "0.2rem", marginLeft: "0.3rem" }}
              />
            </label>{" "}
            <button type="submit">Mark as sent</button>
            <p style={{ fontSize: "0.7rem", color: "#888", margin: "0.25rem 0" }}>
              Demo only — nothing is transmitted. Records the referral as sent with the follow-up
              date.
            </p>
          </form>
        </>
      ) : (
        <>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", margin: "0.5rem 0" }}>
            {referral.draftText}
          </pre>
          <p style={{ fontSize: "0.8rem", margin: "0.25rem 0" }}>
            Sent {fmtDateTime(referral.sentAt)} · Follow-up due {referral.followUpDue ?? "—"}
          </p>
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

  return (
    <>
      {referError && (
        <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>Referral error: {referError}</p>
      )}

      <form action={generateReferralDraft} style={{ margin: "0.5rem 0" }}>
        <input type="hidden" name="caseId" value={caseId} />
        <label style={{ fontSize: "0.85rem", display: "block", margin: "0.3rem 0" }}>
          Refer to{" "}
          <select name="serviceId" style={{ padding: "0.25rem", marginLeft: "0.3rem" }}>
            {suitable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <p style={{ fontSize: "0.75rem", color: "#888", margin: "0.2rem 0" }}>
          Only services suitable in Find support (stage 2) are offered.
        </p>

        <h4 style={{ margin: "0.5rem 0 0.2rem", fontSize: "0.9rem" }}>
          Information to share — woman-stated
        </h4>
        {womanStated.map((f) => (
          <ShareRow key={f.key} field={f} ctx={ctx} />
        ))}

        <h4 style={{ margin: "0.5rem 0 0.2rem", fontSize: "0.9rem" }}>Worker observations</h4>
        {workerObservations.map((f) => (
          <ShareRow key={f.key} field={f} ctx={ctx} />
        ))}

        <p style={{ fontSize: "0.75rem", color: "#888", margin: "0.3rem 0" }}>
          The minimal set is pre-selected; untick anything the woman does not want shared. The draft
          is built only from the ticked items and stored service facts.
        </p>
        <button type="submit">Generate referral draft</button>
      </form>

      <h4 style={{ margin: "0.75rem 0 0.25rem" }}>Referrals</h4>
      {referrals.length === 0 && <p style={{ fontSize: "0.85rem" }}>No referrals yet.</p>}
      {referrals.map((r) => (
        <ReferralCard key={r.id} caseId={caseId} referral={r} />
      ))}
    </>
  );
}
