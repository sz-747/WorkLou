import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  caseContexts,
  cases,
  referrals,
  serviceAttributes,
  services,
} from "../db/schema";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";

function SourcePill({ sourceType }: { sourceType: string }) {
  const cls =
    sourceType === "machine" ? "machine" : sourceType === "excel_import" ? "excel" : sourceType === "provider_confirmed" ? "provider" : "manual";
  return <span className={`pill ${cls}`}>{sourceType.replace("_", " ")}</span>;
}

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

export default async function Home() {
  const allServices = await db.select().from(services).orderBy(services.name);
  const attributes = await db.select().from(serviceAttributes);
  const [caseRow] = await db.select().from(cases).limit(1);
  const contexts = caseRow
    ? await db.select().from(caseContexts).where(eq(caseContexts.caseId, caseRow.id))
    : [];
  const referralRows = caseRow
    ? await db.select().from(referrals).where(eq(referrals.caseId, caseRow.id))
    : [];

  const attrsByService = new Map<string, typeof attributes>();
  for (const a of attributes) {
    const list = attrsByService.get(a.serviceId) ?? [];
    list.push(a);
    attrsByService.set(a.serviceId, list);
  }

  return (
    <main>
      <h1>Lou&apos;s Place Casework Tool — Phase 1: Data Verification</h1>
      <p>
        Minimal screen to verify the database foundation. {allServices.length} services,{" "}
        {attributes.length} service facts, {contexts.length} case context(s),{" "}
        {referralRows.length} referral(s).
      </p>

      {allServices.map((s) => (
        <section key={s.id}>
          <h2>
            {s.name} <SourcePill sourceType={s.sourceType ?? "manual"} />
          </h2>
          <p style={{ fontSize: "0.85rem", margin: 0 }}>
            {s.description} · Catchment: {s.catchment ?? "—"} · Source: {s.sourceName}
          </p>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Key</th>
                <th>Value</th>
                <th>Source</th>
                <th>Retrieved</th>
                <th>Status</th>
                <th>Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {(attrsByService.get(s.id) ?? []).map((a) => (
                <tr key={a.id}>
                  <td>{a.attrType}</td>
                  <td>{a.key}</td>
                  <td>{a.value}</td>
                  <td>
                    <SourcePill sourceType={a.sourceType} />
                  </td>
                  <td>{fmtDate(a.retrievedAt)}</td>
                  <td>
                    <StatusPill status={a.verificationStatus} />
                  </td>
                  <td>{a.confirmedAt ? `${a.confirmedBy} (${fmtDate(a.confirmedAt)})` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {caseRow && (
        <section>
          <h2>Case {caseRow.clientRef}</h2>
          <p style={{ fontSize: "0.85rem" }}>{caseRow.originalNotes}</p>
          {contexts.map((c) => (
            <div key={c.id}>
              <h2>
                Context v{c.version} <span className={`pill ${c.status}`}>{c.status}</span>
              </h2>
              <table>
                <tbody>
                  {Object.entries(c.context).map(([k, v]) => (
                    <tr key={k}>
                      <th>{k}</th>
                      <td>{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
