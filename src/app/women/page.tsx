import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "../../db";
import { caseContexts, cases } from "../../db/schema";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-AU") : "—";

export default async function Women() {
  const women = await db.select().from(cases).orderBy(desc(cases.createdAt));
  const contexts = await db.select().from(caseContexts);

  return (
    <main className="a2">
      <header className="a2-page-head">
        <h1>Women</h1>
        <p className="a2-sub">
          {women.length} case{women.length === 1 ? "" : "s"} in the database
        </p>
      </header>

      <div className="a2-table-card">
        <table>
          <thead>
            <tr>
              <th>Case</th>
              <th>Status</th>
              <th>Latest context</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {women.map((w) => {
              const latest = contexts
                .filter((c) => c.caseId === w.id)
                .sort((a, b) => b.version - a.version)[0];
              return (
                <tr key={w.id}>
                  <td>
                    <Link href={`/women/${w.id}`}>{w.clientRef}</Link>
                  </td>
                  <td>{w.status}</td>
                  <td>
                    {latest ? `v${latest.version} (${latest.status})` : "none"}
                  </td>
                  <td>{fmtDate(w.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {women.length === 0 && <p className="a2-row-empty">No women/cases in the database.</p>}
    </main>
  );
}
