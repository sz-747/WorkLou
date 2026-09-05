/**
 * Phase 4 — Verify stage.
 * Shows, for a service the worker chose in Find support, what is already
 * known from machine-accessible sources (with source + freshness) and only
 * the genuinely provider-only unknowns. The worker records provider
 * confirmations there; volatile facts can be marked stale without losing
 * history. The worker never re-checks digital facts manually.
 */
import Link from "next/link";
import type { CaseContext } from "../../../db/schema";
import type { FactRow } from "../../../lib/matching";
import { factLabel, groupFacts } from "../../../lib/verify";
import { markStale, recordConfirmation } from "./verify-actions";

type SelectedService = {
  id: string;
  name: string;
  phone: string | null;
  facts: FactRow[];
};

const inputStyle = { padding: "0.25rem", fontSize: "0.85rem" } as const;

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "needs_provider_confirmation"
      ? "needs"
      : status === "stale"
        ? "stale"
        : status === "provider_confirmed"
          ? "provider"
          : "verified";
  return <span className={`pill ${cls}`}>{status.replace(/_/g, " ")}</span>;
}

function freshness(fact: FactRow): string {
  const d = (x: Date | string | null) => (x ? new Date(x).toLocaleDateString("en-AU") : "—");
  if (fact.confirmedAt) {
    return `${fact.confirmedBy ?? "provider"} on ${d(fact.confirmedAt)} (${fact.sourceName ?? fact.sourceType})`;
  }
  return `${fact.sourceName ?? fact.sourceType} — retrieved ${d(fact.retrievedAt)}`;
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
    return (
      <p style={{ fontSize: "0.85rem" }}>
        No suitable services to verify yet — approve a context and find support first (stage 2).
      </p>
    );
  }

  const group = selected ? groupFacts(context, selected.facts) : null;

  return (
    <>
      {verifyError && (
        <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>Verification error: {verifyError}</p>
      )}

      <p style={{ fontSize: "0.8rem", margin: "0.25rem 0" }}>Select a service from your Find support results:</p>
      <p style={{ margin: "0.25rem 0" }}>
        {suitable.map((s) => (
          <span key={s.id} style={{ marginRight: "0.75rem" }}>
            {selected && selected.id === s.id ? (
              <strong>{s.name}</strong>
            ) : (
              <Link href={`/women/${caseId}?verify=${s.id}`}>{s.name}</Link>
            )}
          </span>
        ))}
      </p>

      {selected && group && (
        <>
          <h4 style={{ margin: "0.5rem 0 0.25rem" }}>
            {selected.name}
            {selected.phone ? (
              <span style={{ fontSize: "0.75rem", color: "#888" }}> · {selected.phone}</span>
            ) : null}
          </h4>

          {/* (a) already known — the worker never re-checks these manually */}
          <h4 style={{ margin: "0.5rem 0 0.25rem", fontSize: "0.9rem" }}>
            Already known from machine-accessible sources ({group.known.length})
          </h4>
          {group.known.length === 0 && <p style={{ fontSize: "0.8rem" }}>Nothing known yet.</p>}
          <ul style={{ margin: "0.25rem 0", paddingLeft: "1.25rem" }}>
            {group.known.map((f) => (
              <li key={f.id} style={{ fontSize: "0.85rem", margin: "0.2rem 0" }}>
                <strong>{factLabel(f.key)}:</strong> {f.value} <StatusPill status={f.verificationStatus} />{" "}
                <span style={{ color: "#666", fontSize: "0.75rem" }}>({freshness(f)})</span>{" "}
                <form action={markStale} style={{ display: "inline" }}>
                  <input type="hidden" name="caseId" value={caseId} />
                  <input type="hidden" name="serviceId" value={selected.id} />
                  <input type="hidden" name="attrId" value={f.id} />
                  <button
                    type="submit"
                    style={{ fontSize: "0.7rem", padding: "0.05rem 0.4rem" }}
                    title="Volatile fact — mark stale; history is kept"
                  >
                    mark stale
                  </button>
                </form>
              </li>
            ))}
          </ul>

          {/* (b) genuinely provider-only — the only things the worker checks */}
          <h4 style={{ margin: "0.5rem 0 0.25rem", fontSize: "0.9rem" }}>
            Needs provider confirmation ({group.needsConfirmation.length})
          </h4>
          {group.needsConfirmation.length === 0 && (
            <p style={{ fontSize: "0.8rem" }}>Nothing left to confirm — everything is known.</p>
          )}
          {group.needsConfirmation.map((item) => (
            <form
              key={item.key + (item.fact?.id ?? "missing")}
              action={recordConfirmation}
              style={{ border: "1px dashed #f59e0b", padding: "0.4rem 0.75rem", margin: "0.4rem 0" }}
            >
              <input type="hidden" name="caseId" value={caseId} />
              <input type="hidden" name="serviceId" value={selected.id} />
              <input type="hidden" name="attrId" value={item.fact?.id ?? ""} />
              <input type="hidden" name="attrType" value={item.attrType} />
              <input type="hidden" name="key" value={item.key} />
              <p style={{ margin: "0.1rem 0", fontSize: "0.85rem" }}>
                <strong>{item.label}</strong>{" "}
                {item.fact ? (
                  <StatusPill status={item.fact.verificationStatus} />
                ) : (
                  <span className="pill">not recorded</span>
                )}{" "}
                <span style={{ color: "#666", fontSize: "0.75rem" }}>{item.hint}</span>
              </p>
              {item.history && (
                <p style={{ margin: "0.1rem 0", fontSize: "0.75rem", color: "#888" }}>
                  History kept: {item.history}
                </p>
              )}
              <span style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                <label style={{ fontSize: "0.75rem" }}>
                  value
                  <input name="value" style={inputStyle} placeholder="e.g. welcome" />
                </label>
                <label style={{ fontSize: "0.75rem" }}>
                  confirmed by
                  <input name="confirmedBy" style={inputStyle} placeholder="e.g. Caseworker — phone" />
                </label>
                <label style={{ fontSize: "0.75rem" }}>
                  when
                  <input
                    name="confirmedAt"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    style={inputStyle}
                  />
                </label>
                <label style={{ fontSize: "0.75rem", flex: 1, minWidth: "10rem" }}>
                  notes
                  <input name="notes" style={inputStyle} />
                </label>
              </span>
              <button type="submit" style={{ marginTop: "0.3rem" }}>
                Save confirmation
              </button>
            </form>
          ))}
        </>
      )}
    </>
  );
}
