/**
 * Phase 3 — Find support stage.
 * Renders deterministic match results for the APPROVED case context.
 * Read-only: no forms, no LLM. Every fact shown comes from a
 * services / service_attributes DB row with its source and freshness;
 * unknowns are shown as unknown, never presented as known.
 */
import type { CaseContext } from "../../../db/schema";
import type { MatchResult } from "../../../lib/matching";

type ApprovedContext = {
  version: number;
  approvedAt: Date | string | null;
  context: CaseContext;
};

const daysAgo = (d: Date | string | null): number | null => {
  if (!d) return null;
  const ms = Date.now() - new Date(d).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
};

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "needs_provider_confirmation"
      ? "needs"
      : status === "stale"
        ? "stale"
        : status === "mismatch"
          ? "draft"
          : status === "provider_confirmed"
            ? "provider"
            : status === "not_recorded"
              ? ""
              : "verified";
  const label: Record<string, string> = {
    matched: "fits",
    needs_provider_confirmation: "ask provider",
    stale: "check again",
    mismatch: "may not fit",
    not_recorded: "not recorded",
  };
  return <span className={`pill ${cls}`}>{label[status] ?? status.replace(/_/g, " ")}</span>;
}

function freshnessLine(fact: NonNullable<MatchResult["criteria"][number]["fact"]>): string {
  const retrieved = daysAgo(fact.retrievedAt);
  if (fact.confirmedAt) {
    const c = daysAgo(fact.confirmedAt);
    return `${fact.confirmedBy ?? "provider"} confirmed ${c !== null ? `${c} day(s) ago` : ""}`;
  }
  return `source: ${fact.sourceName ?? fact.sourceType}${retrieved !== null ? ` — retrieved ${retrieved} day(s) ago` : ""}`;
}

function CriterionRow({ c }: { c: MatchResult["criteria"][number] }) {
  return (
    <li style={{ margin: "0.15rem 0", fontSize: "0.85rem" }}>
      <strong>{c.criterion}:</strong> <StatusPill status={c.status} /> {c.detail}
      {c.fact && (
        <span style={{ color: "#666", fontSize: "0.75rem" }}>
          {" "}
          ({freshnessLine(c.fact)}
          {c.fact.notes ? `; note: ${c.fact.notes}` : ""})
        </span>
      )}
    </li>
  );
}

export function FindSupportStage({
  approved,
  results,
}: {
  approved: ApprovedContext | null;
  results: MatchResult[] | null;
}) {
  if (!approved) {
    return (
      <p className="muted">Approve the case summary first. Suitable services will appear here.</p>
    );
  }

  const ctx = approved.context;
  const suitable = (results ?? []).filter((r) => r.suitable);
  const notSuitable = (results ?? []).filter((r) => !r.suitable);

  return (
    <>
      <p style={{ margin: "0.25rem 0" }}>
        Looking for <strong>{ctx.needs.join(", ")}</strong>
        {ctx.children?.count ? `, ${ctx.children.count} child(ren)` : ""}
        {ctx.pets?.has_pet ? ", pet" : ""}
        {ctx.languages.length ? `, ${ctx.languages.join(", ")}` : ""}.
      </p>
      <details className="technical-details">
        <summary>How this shortlist was made</summary>
        <p className="muted">
          It uses approved summary version {approved.version} and stored service facts. No AI ranks the services.
          {approved.approvedAt ? ` Summary approved ${new Date(approved.approvedAt).toLocaleDateString("en-AU")}.` : ""}
        </p>
      </details>

      {suitable.length === 0 && (
        <p style={{ fontSize: "0.85rem" }}>No suitable services found for this context.</p>
      )}

      {suitable.map((r) => (
        <div key={r.service.id} className="support-card">
          <h4>{r.service.name}</h4>
          <p>{r.service.organisation ?? "Provider organisation not recorded"}{r.service.phone ? ` · ${r.service.phone}` : ""}</p>
          <p><strong>Matches:</strong> {r.matchedNeeds.join(", ")}</p>
          {r.criteria.some((criterion) => criterion.status !== "matched") ? (
            <p className="action-note">There are {r.criteria.filter((criterion) => criterion.status !== "matched").length} details to notice or confirm.</p>
          ) : null}
          <details className="technical-details">
            <summary>Why it fits and what still needs checking</summary>
            <ul className="plain-list">
              {r.criteria.map((criterion) => <CriterionRow key={criterion.criterion} c={criterion} />)}
            </ul>
          </details>
        </div>
      ))}

      {notSuitable.length > 0 && (
        <details style={{ margin: "0.5rem 0" }}>
          <summary style={{ fontSize: "0.85rem", cursor: "pointer" }}>
            Other services ruled out ({notSuitable.length})
          </summary>
          <ul style={{ paddingLeft: "1.25rem" }}>
            {notSuitable.map((r) => (
              <li key={r.service.id} style={{ fontSize: "0.8rem", margin: "0.15rem 0" }}>
                <strong>{r.service.name}</strong> — {r.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
