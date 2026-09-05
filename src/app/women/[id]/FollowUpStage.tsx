/**
 * Phase 6 — Follow-up stage (step 5A, follow-up half).
 * For sent referrals: status, next follow-up date, a simple timeline,
 * provider-response recording, outcomes (support received distinguishable
 * from sent/accepted), and a follow-up draft for worker review. Nothing is
 * ever transmitted — the worker sends follow-ups themselves.
 */
import {
  OUTCOMES,
  isFinalOutcome,
  outcomeLabel,
  referralIsOpen,
  type ReferralEventRow,
} from "../../../lib/followup";
import { draftFollowUp, recordOutcomeAction, recordResponse } from "./followup-actions";
import type { ReferralRow } from "./ReferStage";

const EVENT_LABELS: Record<string, string> = {
  provider_response: "Provider response",
  outcome: "Outcome recorded",
  follow_up_draft: "Follow-up draft (for review — not sent)",
};

const fmtDateTime = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("en-AU") : "—";

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-AU") : "—";

function FollowUpCard({
  caseId,
  referral,
  events,
}: {
  caseId: string;
  referral: ReferralRow;
  events: ReferralEventRow[];
}) {
  const open = referralIsOpen(referral.status);
  const latestDraft = [...events].reverse().find((e) => e.kind === "follow_up_draft");

  return (
    <div style={{ border: "1px solid #eee", padding: "0.5rem 1rem", margin: "0.5rem 0" }}>
      <h4 style={{ margin: "0.25rem 0" }}>
        {referral.serviceName}{" "}
        <span className={`pill ${referral.status === "sent" ? "sent" : referral.status}`}>
          {referral.status}
        </span>
        {referral.outcome && (
          <span className={`pill ${isFinalOutcome(referral.outcome) ? "approved" : "draft"}`}>
            {outcomeLabel(referral.outcome)}
          </span>
        )}
      </h4>
      <p style={{ fontSize: "0.8rem", margin: "0.25rem 0" }}>
        Sent {fmtDateTime(referral.sentAt)} · Next follow-up due{" "}
        <strong>{referral.followUpDue ?? "—"}</strong>
        {referral.outcome === "support_received" && (
          <span style={{ color: "#166534" }}> · Support received — outcome reached</span>
        )}
      </p>

      <h5 style={{ margin: "0.5rem 0 0.2rem", fontSize: "0.85rem" }}>Timeline</h5>
      <ol style={{ margin: "0.2rem 0", paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
        <li>
          <strong>Referral sent</strong> — {fmtDateTime(referral.sentAt)}
        </li>
        {events.map((e) => (
          <li key={e.id}>
            <strong>{EVENT_LABELS[e.kind] ?? e.kind}</strong> — {fmtDateTime(e.occurredAt)}
            <div style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", color: "#444" }}>{e.note}</div>
          </li>
        ))}
      </ol>

      {open ? (
        <>
          <form action={recordResponse} style={{ margin: "0.5rem 0" }}>
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="referralId" value={referral.id} />
            <label style={{ fontSize: "0.85rem", display: "block" }}>
              Record provider response
              <textarea
                name="responseText"
                rows={2}
                placeholder="What the provider said, and when…"
                style={{ width: "100%", padding: "0.3rem", fontSize: "0.85rem" }}
              />
            </label>
            <button type="submit">Save response</button>
            <span style={{ fontSize: "0.7rem", color: "#888", marginLeft: "0.5rem" }}>
              Moves the referral to responded; appears on the timeline.
            </span>
          </form>

          <form action={recordOutcomeAction} style={{ margin: "0.5rem 0" }}>
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="referralId" value={referral.id} />
            <label style={{ fontSize: "0.85rem" }}>
              Outcome{" "}
              <select name="outcome" style={{ padding: "0.25rem", marginLeft: "0.3rem" }}>
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>{" "}
            <input
              type="text"
              name="outcomeNotes"
              placeholder="Notes (optional)"
              style={{ padding: "0.25rem", width: "16rem" }}
            />{" "}
            <button type="submit">Record outcome</button>
            <p style={{ fontSize: "0.7rem", color: "#888", margin: "0.25rem 0" }}>
              Awaiting reply keeps the referral open; the others close it. &quot;Support
              received&quot; marks support actually delivered — distinct from a referral merely
              sent or accepted.
            </p>
          </form>

          <form action={draftFollowUp} style={{ margin: "0.5rem 0" }}>
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="referralId" value={referral.id} />
            <button type="submit">Draft follow-up message</button>
            <span style={{ fontSize: "0.7rem", color: "#888", marginLeft: "0.5rem" }}>
              Drafts a follow-up for your review — nothing is sent automatically.
            </span>
          </form>
          {latestDraft && (
            <div style={{ background: "#f8fafc", padding: "0.5rem", margin: "0.25rem 0" }}>
              <p style={{ fontSize: "0.75rem", margin: "0.1rem 0", color: "#666" }}>
                Latest follow-up draft — review, copy, and send it yourself:
              </p>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", margin: 0 }}>
                {latestDraft.note}
              </pre>
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: "0.75rem", color: "#888" }}>
          Closed — outcome recorded {fmtDate(referral.outcomeAt)}. Timeline is read-only.
        </p>
      )}
    </div>
  );
}

export function FollowUpStage({
  caseId,
  referrals,
  events,
  followUpError,
}: {
  caseId: string;
  referrals: ReferralRow[];
  events: ReferralEventRow[];
  followUpError?: string;
}) {
  const sentReferrals = referrals.filter((r) => r.status !== "draft");

  return (
    <>
      {followUpError && (
        <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>Follow-up error: {followUpError}</p>
      )}
      {sentReferrals.length === 0 && (
        <p style={{ fontSize: "0.85rem" }}>
          No sent referrals to follow up yet — mark a referral as sent in stage 4.
        </p>
      )}
      {sentReferrals.map((r) => (
        <FollowUpCard
          key={r.id}
          caseId={caseId}
          referral={r}
          events={events.filter((e) => e.referralId === r.id)}
        />
      ))}
    </>
  );
}
