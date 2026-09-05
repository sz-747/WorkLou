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
  return <span className={`pill ${cls}`}>{status.replace(/_/g, " ")}</span>;
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
      <p style={{ fontSize: "0.85rem" }}>
        No approved context yet — approve a context in stage 1 first. Matching never runs against
        drafts.
      </p>
    );
  }

  const ctx = approved.context;
  const suitable = (results ?? []).filter((r) => r.suitable);
  const notSuitable = (results ?? []).filter((r) => !r.suitable);

  return (
    <>
      <p style={{ fontSize: "0.85rem", margin: "0.25rem 0" }}>
        Matched from approved Context v{approved.version} (approved{" "}
        {approved.approvedAt ? new Date(approved.approvedAt).toLocaleDateString("en-AU") : "—"}) —
        deterministic query, no AI ranking. Client needs:{" "}
        <strong>{ctx.needs.join(", ")}</strong>
        {ctx.children?.count ? `, ${ctx.children.count} child(ren)` : ""}
        {ctx.pets?.has_pet ? ", pet" : ""}
        {ctx.visa ? `, visa: ${ctx.visa}` : ""}
        {ctx.languages.length ? `, languages: ${ctx.languages.join(", ")}` : ""}.
      </p>

      {suitable.length === 0 && (
        <p style={{ fontSize: "0.85rem" }}>No suitable services found for this context.</p>
      )}

      {suitable.map((r) => (
        <div key={r.service.id} style={{ border: "1px solid #ddd", padding: "0.5rem 1rem", margin: "0.5rem 0" }}>
          <h4 style={{ margin: "0.25rem 0" }}>
            {r.service.name}{" "}
            <span style={{ fontSize: "0.75rem", color: "#888" }}>
              · {r.matchedNeeds.length} need(s) matched · {r.service.organisation ?? ""}
              {r.service.phone ? ` · ${r.service.phone}` : ""}
              {r.service.catchment ? ` · catchment: ${r.service.catchment}` : ""}
            </span>
          </h4>
          <ul style={{ margin: "0.25rem 0", paddingLeft: "1.25rem" }}>
            {r.criteria.map((c) => (
              <CriterionRow key={c.criterion} c={c} />
            ))}
          </ul>
        </div>
      ))}

      {notSuitable.length > 0 && (
        <details style={{ margin: "0.5rem 0" }}>
          <summary style={{ fontSize: "0.85rem", cursor: "pointer" }}>
            Not suitable ({notSuitable.length})
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
