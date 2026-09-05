/**
 * Phase 6 — Document stage (step 5B).
 * Drafts a case note from stored case/referral data for worker review.
 * The worker edits and approves; approving is the only way a note becomes
 * final. The original appointment notes are shown beside the draft,
 * unchanged — they are never modified.
 */
import type { CaseDocumentRow } from "../../../lib/document";
import { approveDocumentAction, draftDocument, saveDocumentDraft } from "./document-actions";

const fmtDateTime = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("en-AU") : "—";

function DocumentCard({
  caseId,
  doc,
}: {
  caseId: string;
  doc: CaseDocumentRow;
}) {
  return (
    <div className="support-card">
      <h4 style={{ margin: "0.25rem 0" }}>
        Case note <span className={`pill ${doc.status === "approved" ? "approved" : "draft"}`}>{doc.status}</span>
      </h4>

      {doc.status === "draft" ? (
        <form action={saveDocumentDraft} style={{ margin: "0.25rem 0" }}>
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="documentId" value={doc.id} />
          <textarea
            name="draftText"
            rows={14}
            defaultValue={doc.draftText}
            style={{ width: "100%", padding: "0.3rem", fontSize: "0.85rem" }}
          />
          <button type="submit">Save edits</button>
          <span className="muted" style={{ marginLeft: "0.5rem" }}>Check it against your original notes.</span>
        </form>
      ) : (
        <details className="technical-details">
          <summary>View final case note</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>{doc.draftText}</pre>
        </details>
      )}

      {doc.status === "draft" && (
        <form action={approveDocumentAction} style={{ margin: "0.25rem 0" }}>
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="documentId" value={doc.id} />
          <button type="submit">Approve as final</button>
          <span className="muted" style={{ marginLeft: "0.5rem" }}>This makes the note final and read-only.</span>
        </form>
      )}
      <details className="technical-details">
        <summary>Dates and record details</summary>
        <p className="muted">Drafted {fmtDateTime(doc.createdAt)}{doc.approvedAt ? ` · Approved ${fmtDateTime(doc.approvedAt)}` : ""}</p>
      </details>
    </div>
  );
}

export function DocumentStage({
  caseId,
  originalNotes,
  documents,
  documentError,
}: {
  caseId: string;
  originalNotes: string;
  documents: CaseDocumentRow[];
  documentError?: string;
}) {
  return (
    <>
      {documentError && (
        <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>Document error: {documentError}</p>
      )}

      <div>
        <form action={draftDocument}>
          <input type="hidden" name="caseId" value={caseId} />
          <button type="submit">Draft case note</button>
          <span className="muted" style={{ marginLeft: "0.5rem" }}>Review it before anything becomes final.</span>
        </form>
        <details className="technical-details">
          <summary>Original call notes</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", margin: 0, color: "#444" }}>
            {originalNotes}
          </pre>
        </details>
      </div>

      {documents.length === 0 && (
        <p className="muted">Draft the case note when the referral outcome is clear.</p>
      )}
      {documents.map((d) => (
        <DocumentCard key={d.id} caseId={caseId} doc={d} />
      ))}
    </>
  );
}
