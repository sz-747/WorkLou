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
    <div style={{ border: "1px solid #eee", padding: "0.5rem 1rem", margin: "0.5rem 0" }}>
      <h4 style={{ margin: "0.25rem 0" }}>
        Case note <span className={`pill ${doc.status === "approved" ? "approved" : "draft"}`}>{doc.status}</span>
        <span style={{ fontSize: "0.75rem", color: "#888", marginLeft: "0.5rem" }}>
          drafted {fmtDateTime(doc.createdAt)}
          {doc.approvedAt && ` · approved ${fmtDateTime(doc.approvedAt)}`}
        </span>
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
          <span style={{ fontSize: "0.7rem", color: "#888", marginLeft: "0.5rem" }}>
            Review and edit against the original notes before approving.
          </span>
        </form>
      ) : (
        <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", margin: "0.25rem 0" }}>
          {doc.draftText}
        </pre>
      )}

      {doc.status === "draft" && (
        <form action={approveDocumentAction} style={{ margin: "0.25rem 0" }}>
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="documentId" value={doc.id} />
          <button type="submit">Approve as final</button>
          <span style={{ fontSize: "0.7rem", color: "#888", marginLeft: "0.5rem" }}>
            Approving marks this case note final. It stays stored and read-only.
          </span>
        </form>
      )}
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

      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        <form action={draftDocument}>
          <input type="hidden" name="caseId" value={caseId} />
          <button type="submit">Draft case note</button>
          <span style={{ fontSize: "0.7rem", color: "#888", marginLeft: "0.5rem" }}>
            From the stored notes, approved context, referrals, provider confirmations and
            follow-up activity — review, edit, then approve. Nothing is final until you approve.
          </span>
        </form>
        <div style={{ flex: "1 1 18rem", borderLeft: "3px solid #eee", paddingLeft: "0.75rem" }}>
          <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "#666" }}>
            Original appointment notes (unchanged, kept beside every draft):
          </p>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", margin: 0, color: "#444" }}>
            {originalNotes}
          </pre>
        </div>
      </div>

      {documents.length === 0 && (
        <p style={{ fontSize: "0.85rem" }}>No case notes drafted yet.</p>
      )}
      {documents.map((d) => (
        <DocumentCard key={d.id} caseId={caseId} doc={d} />
      ))}
    </>
  );
}
