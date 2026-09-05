/**
 * Phase 7 admin — service-knowledge overview.
 * Sparse inspection view: every service with its provenance, fact
 * freshness summary, provider-confirmed facts, update candidates (stale /
 * needs-confirmation / unknown facts), and the discovery queue (Phase 7B).
 * No analytics, no dashboards.
 */
import Link from "next/link";
import { getDiscoveryCandidates, getServicesOverview } from "../../lib/admin";
import { getUpdateCandidates, getUpdaterRuns } from "../../lib/updater";
import { approveCandidate, rejectCandidate, runDiscoveryAction, runUpdaterAction } from "./actions";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-AU") : "—";

const fmtDateTime = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }) : "—";

const inputStyle = { padding: "0.25rem", fontSize: "0.85rem" } as const;

function UpdateCandidateRow({
  c,
  serviceName,
  pending,
}: {
  c: {
    id: string;
    scope: string;
    attrType: string | null;
    key: string;
    currentValue: string | null;
    newValue: string;
    sourceName: string | null;
    sourceUrl: string | null;
    evidenceType: string;
    retrievedAt: Date | string | null;
    status: string;
    reason: string | null;
    decidedBy: string | null;
    decidedAt: Date | string | null;
  };
  serviceName: string;
  pending: boolean;
}) {
  return (
    <tr>
      <td>{serviceName}</td>
      <td>
        {c.scope === "service_field" ? `service field: ${c.key}` : `${c.attrType} · ${c.key}`}
      </td>
      <td>
        {c.currentValue ?? <em>not recorded</em>} → <strong>{c.newValue}</strong>
      </td>
      <td style={{ fontSize: "0.75rem" }}>
        <span className="pill">{c.evidenceType.replace(/_/g, " ")}</span> {c.sourceName ?? ""}
        {c.sourceUrl ? (
          <>
            {" "}
            · <a href={c.sourceUrl} target="_blank" rel="noreferrer">{c.sourceUrl}</a>
          </>
        ) : null}
        <br />
        retrieved {fmtDate(c.retrievedAt)}
      </td>
      <td style={{ fontSize: "0.75rem" }}>{c.reason}</td>
      <td>
        <span className="pill">{c.status.replace(/_/g, " ")}</span>
        {!pending && c.decidedBy ? (
          <span style={{ fontSize: "0.75rem", color: "#666" }}> by {c.decidedBy} {fmtDateTime(c.decidedAt)}</span>
        ) : null}
      </td>
      {pending && (
        <td>
          <form action={approveCandidate} style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
            <input type="hidden" name="candidateId" value={c.id} />
            <input name="decidedBy" placeholder="your name" style={{ ...inputStyle, width: "6.5rem" }} required />
            <button type="submit" title="Apply to canonical service data (change history logged)">Approve</button>
          </form>
          <form action={rejectCandidate} style={{ display: "flex", gap: "0.3rem", alignItems: "center", marginTop: "0.25rem" }}>
            <input type="hidden" name="candidateId" value={c.id} />
            <input name="decidedBy" placeholder="your name" style={{ ...inputStyle, width: "6.5rem" }} required />
            <input name="reason" placeholder="why (optional)" style={{ ...inputStyle, width: "7rem" }} />
            <button type="submit">Reject</button>
          </form>
        </td>
      )}
    </tr>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "needs_provider_confirmation"
      ? "needs"
      : status === "stale"
        ? "stale"
        : status === "provider_confirmed"
          ? "provider"
          : status === "admin_corrected"
            ? "admin"
            : "verified";
  return <span className={`pill ${cls}`}>{status.replace(/_/g, " ")}</span>;
}

function SourcePill({ sourceType }: { sourceType: string | null }) {
  if (!sourceType) return null;
  const cls =
    sourceType === "machine" ? "machine" : sourceType === "excel_import" ? "excel" : sourceType === "provider_confirmed" ? "provider" : "manual";
  return <span className={`pill ${cls}`}>{sourceType.replace("_", " ")}</span>;
}

export default async function AdminServices({
  searchParams,
}: {
  searchParams: Promise<{
    updaterMsg?: string;
    updaterError?: string;
    discoveryMsg?: string;
    discoveryError?: string;
  }>;
}) {
  const { updaterMsg, updaterError, discoveryMsg, discoveryError } = await searchParams;
  const [overview, candidates, runs, updateCands] = await Promise.all([
    getServicesOverview(),
    getDiscoveryCandidates(),
    getUpdaterRuns(),
    getUpdateCandidates(),
  ]);

  return (
    <main>
      <h1>Service knowledge (admin)</h1>
      <p style={{ fontSize: "0.85rem" }}>
        {overview.length} services. Inspect provenance, freshness, and history; correct
        anything that is wrong. Corrections update the shared data caseworker queries use.
      </p>

      {updaterMsg && <p style={{ color: "#15803d", fontSize: "0.85rem" }}>{updaterMsg}</p>}
      {updaterError && <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>Updater error: {updaterError}</p>}
      {discoveryMsg && <p style={{ color: "#15803d", fontSize: "0.85rem" }}>{discoveryMsg}</p>}
      {discoveryError && <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>Discovery error: {discoveryError}</p>}

      {/* --- Phase 7A: existing-service updater --- */}
      <h2>Existing-service updater</h2>
      <p style={{ fontSize: "0.8rem" }}>
        Refreshes known services from machine-accessible sources (fixtures now; Bright
        Data / direct fetch when configured). Value changes become update candidates for
        review — nothing is auto-applied. Runs hourly on the schedule and on demand:
      </p>
      <form action={runUpdaterAction} style={{ margin: "0.4rem 0" }}>
        <button type="submit">Run updater now</button>
      </form>
      {runs.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Started</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Sources</th>
              <th>Candidates</th>
              <th>Refreshed</th>
              <th>Run log</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(r.startedAt)}</td>
                <td>{r.trigger}</td>
                <td>
                  <span className="pill">{r.status}</span>
                </td>
                <td>
                  {r.sourcesOk} ok / {r.sourcesFailed} failed
                </td>
                <td>
                  {r.candidatesCreated} new / {r.candidatesUpdated} updated / {r.candidatesSkipped} deduped
                </td>
                <td>{r.refreshed}</td>
                <td>
                  <details>
                    <summary style={{ fontSize: "0.75rem" }}>{(r.log ?? []).length} entries{r.error ? " · error" : ""}</summary>
                    <ul style={{ fontSize: "0.7rem", paddingLeft: "1rem", margin: "0.2rem 0" }}>
                      {r.error && <li style={{ color: "#b91c1c" }}>{r.error}</li>}
                      {(r.log ?? []).map((e, i) => (
                        <li key={i}>{e.message}</li>
                      ))}
                    </ul>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* --- update candidates (admin review) --- */}
      <h2>Update candidates — pending review ({updateCands.pending.length})</h2>
      {updateCands.pending.length === 0 ? (
        <p style={{ fontSize: "0.85rem" }}>No pending candidates. Run the updater to check sources.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>What</th>
              <th>Change</th>
              <th>Evidence</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Decide</th>
            </tr>
          </thead>
          <tbody>
            {updateCands.pending.map(({ candidate: c, serviceName }) => (
              <UpdateCandidateRow key={c.id} c={c} serviceName={serviceName} pending />
            ))}
          </tbody>
        </table>
      )}
      {updateCands.applied.length + updateCands.rejected.length > 0 && (
        <>
          <h3 style={{ fontSize: "0.9rem" }}>Recent decisions</h3>
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>What</th>
                <th>Change</th>
                <th>Evidence</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...updateCands.applied, ...updateCands.rejected].map(({ candidate: c, serviceName }) => (
                <UpdateCandidateRow key={c.id} c={c} serviceName={serviceName} pending={false} />
              ))}
            </tbody>
          </table>
        </>
      )}

      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Status</th>
            <th>Source</th>
            <th>Facts</th>
            <th>Provider-confirmed</th>
            <th>Update candidates</th>
            <th>Last checked</th>
          </tr>
        </thead>
        <tbody>
          {overview.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`/admin/services/${s.id}`}>{s.name}</Link>
              </td>
              <td>
                <span className="pill">{s.status}</span>
              </td>
              <td>
                <SourcePill sourceType={s.sourceType} /> {s.sourceName ?? "—"}
              </td>
              <td>{s.factCount}</td>
              <td>{s.providerConfirmed > 0 ? s.providerConfirmed : "—"}</td>
              <td>
                {s.needsAttention > 0 ? (
                  <span className="pill needs">{s.needsAttention} to check</span>
                ) : (
                  "—"
                )}
              </td>
              <td>{fmtDate(s.lastChecked)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Discovery candidates (queue for review)</h2>
      <p style={{ fontSize: "0.85rem" }}>
        New-service candidates found by the discovery process: SERP API (Bright Data) → provider
        URLs → direct fetch / Web Unlocker → normalise → dedupe → this review queue. Review/merge
        actions arrive with the rest of Phase 7B — for now the queue is inspectable here. Nothing
        is auto-merged into the service list.
      </p>
      <form action={runDiscoveryAction} style={{ margin: "0.4rem 0" }}>
        <button type="submit">Run discovery now</button>
      </form>
      {candidates.length === 0 ? (
        <p style={{ fontSize: "0.85rem" }}>No candidates queued yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Found at</th>
              <th>Source</th>
              <th>Retrieved</th>
              <th>Evidence</th>
              <th>Status</th>
              <th>Extracted data</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  {c.sourceUrl ? (
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                      {c.sourceUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{c.sourceName ?? "—"}</td>
                <td>{fmtDate(c.retrievedAt)}</td>
                <td>
                  {c.evidenceType ? <span className="pill">{c.evidenceType.replace(/_/g, " ")}</span> : "—"}
                </td>
                <td>
                  <span className="pill">{c.status.replace(/_/g, " ")}</span>
                </td>
                <td style={{ fontSize: "0.75rem", maxWidth: "24rem" }}>
                  {c.extractedData ? JSON.stringify(c.extractedData) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
