/**
 * Phase 7 admin — service-knowledge overview.
 * Sparse inspection view: every service with its provenance, fact
 * freshness summary, provider-confirmed facts, update candidates (stale /
 * needs-confirmation / unknown facts), and the discovery queue (Phase 7B).
 * No analytics, no dashboards.
 */
import Link from "next/link";
import { getDiscoveryCandidates, getServicesOverview } from "../../lib/admin";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-AU") : "—";

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

export default async function AdminServices() {
  const [overview, candidates] = await Promise.all([
    getServicesOverview(),
    getDiscoveryCandidates(),
  ]);

  return (
    <main>
      <h1>Service knowledge (admin)</h1>
      <p style={{ fontSize: "0.85rem" }}>
        {overview.length} services. Inspect provenance, freshness, and history; correct
        anything that is wrong. Corrections update the shared data caseworker queries use.
      </p>

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
        New-service candidates found by the discovery process (Phase 7B). Review/merge
        actions arrive with that phase — for now the queue is inspectable here.
      </p>
      {candidates.length === 0 ? (
        <p style={{ fontSize: "0.85rem" }}>No candidates queued yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Found at</th>
              <th>Source</th>
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
                <td>
                  {c.sourceName ?? "—"}
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
