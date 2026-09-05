/**
 * Phase 7 admin — one service's knowledge detail: core fields (editable),
 * every structured fact with its source/provenance, freshness, and
 * provider confirmations (each fact correctable in place), and the
 * append-only change history. Corrections are logged with who/when.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChangeHistory, getServiceForAdmin } from "../../../../lib/admin";
import { correctFact, saveService } from "./actions";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }) : "—";

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

function SourcePill({ sourceType }: { sourceType: string }) {
  const cls =
    sourceType === "machine" ? "machine" : sourceType === "excel_import" ? "excel" : sourceType === "provider_confirmed" ? "provider" : "manual";
  return <span className={`pill ${cls}`}>{sourceType.replace("_", " ")}</span>;
}

const inputStyle = { padding: "0.25rem", fontSize: "0.85rem" } as const;

export default async function AdminServiceDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ adminError?: string; adminSaved?: string }>;
}) {
  const { id } = await params;
  const { adminError, adminSaved } = await searchParams;
  const detail = await getServiceForAdmin(id);
  if (!detail) notFound();
  const { service, facts } = detail;
  const history = await getChangeHistory(id);

  return (
    <main>
      <p style={{ fontSize: "0.85rem" }}>
        <Link href="/admin">← All services</Link>
      </p>
      <h1>
        {service.name} <span className="pill">{service.status}</span>
      </h1>
      <p style={{ fontSize: "0.85rem" }}>
        {service.organisation ?? "—"} · Source: <SourcePill sourceType={service.sourceType ?? "manual"} />{" "}
        {service.sourceName ?? "—"}
        {service.sourceUrl ? (
          <>
            {" "}
            · <a href={service.sourceUrl} target="_blank" rel="noreferrer">{service.sourceUrl}</a>
          </>
        ) : null}
        {service.updatedAt ? <> · record updated {fmtDate(service.updatedAt)}</> : null}
      </p>

      {adminError && <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>Error: {adminError}</p>}
      {adminSaved && (
        <p style={{ color: "#15803d", fontSize: "0.85rem" }}>
          Saved — {adminSaved} field{adminSaved === "1" ? "" : "s"} corrected.
        </p>
      )}

      {/* --- service core fields: edit / correct --- */}
      <h2>Service details</h2>
      <form action={saveService} style={{ display: "grid", gap: "0.4rem", maxWidth: "34rem" }}>
        <input type="hidden" name="serviceId" value={service.id} />
        <label style={{ fontSize: "0.8rem" }}>
          name <input name="name" defaultValue={service.name ?? ""} style={inputStyle} required />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          organisation <input name="organisation" defaultValue={service.organisation ?? ""} style={inputStyle} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          description{" "}
          <textarea name="description" defaultValue={service.description ?? ""} rows={3} style={inputStyle} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          status{" "}
          <select name="status" defaultValue={service.status} style={inputStyle}>
            <option value="active">active</option>
            <option value="needs_review">needs_review</option>
            <option value="inactive">inactive</option>
          </select>
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          website <input name="website" defaultValue={service.website ?? ""} style={inputStyle} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          phone <input name="phone" defaultValue={service.phone ?? ""} style={inputStyle} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          email <input name="email" defaultValue={service.email ?? ""} style={inputStyle} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          address <input name="address" defaultValue={service.address ?? ""} style={inputStyle} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          catchment <input name="catchment" defaultValue={service.catchment ?? ""} style={inputStyle} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          source name <input name="sourceName" defaultValue={service.sourceName ?? ""} style={inputStyle} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          source url <input name="sourceUrl" defaultValue={service.sourceUrl ?? ""} style={inputStyle} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          corrected by{" "}
          <input name="changedBy" placeholder="who is correcting this (name/initials)" style={inputStyle} required />
        </label>
        <button type="submit">Save corrections</button>
      </form>

      {/* --- structured facts: provenance + freshness + correction --- */}
      <h2>
        Structured facts ({facts.length}) — eligibility / criteria / delivery
      </h2>
      {facts.length === 0 && <p style={{ fontSize: "0.85rem" }}>No structured facts recorded.</p>}
      {facts.map((f) => (
        <details key={f.id} style={{ border: "1px solid #e5e7eb", padding: "0.4rem 0.75rem", margin: "0.4rem 0" }}>
          <summary style={{ fontSize: "0.9rem" }}>
            <strong>
              {f.attrType} · {f.key}
            </strong>{" "}
            = {f.value} <StatusPill status={f.verificationStatus} />{" "}
            <span style={{ color: "#666", fontSize: "0.75rem" }}>
              {f.confirmedAt
                ? `confirmed by ${f.confirmedBy ?? "provider"} on ${fmtDate(f.confirmedAt)}`
                : `retrieved ${fmtDate(f.retrievedAt)}`}
            </span>
          </summary>
          <p style={{ fontSize: "0.8rem", margin: "0.4rem 0 0.2rem" }}>
            <strong>Source:</strong> <SourcePill sourceType={f.sourceType} /> {f.sourceName ?? "—"}
            {f.sourceUrl ? (
              <>
                {" "}
                · <a href={f.sourceUrl} target="_blank" rel="noreferrer">{f.sourceUrl}</a>
              </>
            ) : null}
          </p>
          <p style={{ fontSize: "0.8rem", margin: "0.1rem 0" }}>
            <strong>Freshness:</strong> retrieved {fmtDate(f.retrievedAt)}
            {f.confirmedAt ? ` · confirmed by ${f.confirmedBy ?? "provider"} on ${fmtDate(f.confirmedAt)}` : ""}
          </p>
          {f.notes && (
            <p style={{ fontSize: "0.8rem", margin: "0.1rem 0" }}>
              <strong>Notes:</strong> {f.notes}
            </p>
          )}
          <form action={correctFact} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.4rem 0 0.2rem" }}>
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="hidden" name="attrId" value={f.id} />
            <label style={{ fontSize: "0.75rem" }}>
              corrected value
              <input name="value" defaultValue={f.value} style={inputStyle} required />
            </label>
            <label style={{ fontSize: "0.75rem", flex: 1, minWidth: "10rem" }}>
              notes
              <input name="notes" defaultValue={f.notes ?? ""} style={inputStyle} />
            </label>
            <label style={{ fontSize: "0.75rem" }}>
              corrected by
              <input name="changedBy" placeholder="who is correcting this" style={inputStyle} required />
            </label>
            <button type="submit" style={{ alignSelf: "flex-end" }}>
              Correct this fact
            </button>
          </form>
        </details>
      ))}

      {/* --- append-only change history --- */}
      <h2>Change history ({history.length})</h2>
      <p style={{ fontSize: "0.8rem" }}>
        Append-only: every correction keeps the prior value and prior provenance.
      </p>
      {history.length === 0 ? (
        <p style={{ fontSize: "0.85rem" }}>No corrections recorded for this service yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th>Field</th>
              <th>Was</th>
              <th>Now</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(h.createdAt)}</td>
                <td>{h.entity === "attribute" ? "fact correction" : "service correction"}</td>
                <td>{h.field}</td>
                <td>{h.oldValue ?? "—"}</td>
                <td>{h.newValue ?? "—"}</td>
                <td>{h.changedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
