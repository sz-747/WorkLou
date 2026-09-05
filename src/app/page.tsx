import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "../db";
import { cases } from "../db/schema";
import { getDueFollowUps, outcomeLabel } from "../lib/followup";

export const dynamic = "force-dynamic";

export default async function MyWork() {
  const myCases = await db.select().from(cases).orderBy(desc(cases.createdAt));
  const dueFollowUps = await getDueFollowUps();

  return (
    <main className="a2">
      <header className="a2-page-head">
        <h1>My Work</h1>
        <p className="a2-sub">
          {dueFollowUps.length} follow-up{dueFollowUps.length === 1 ? "" : "s"} due ·{" "}
          {myCases.length} case{myCases.length === 1 ? "" : "s"}
        </p>
      </header>

      <div className="a2-columns">
      <section className="a2-card">
        <h2>Follow-ups due</h2>
        <ul className="a2-rows">
          {dueFollowUps.map((f) => (
            <li key={f.referralId}>
              <span className="a2-mark" aria-hidden="true" />
              <span className="a2-row-main">
                <Link href={`/women/${f.caseId}`}>{f.clientRef}</Link>
                <span className="a2-row-detail">
                  {f.serviceName} · {f.status}
                  {f.outcome ? ` · ${outcomeLabel(f.outcome)}` : ""}
                </span>
              </span>
              <span className="a2-row-meta is-due">due {f.followUpDue}</span>
            </li>
          ))}
          {dueFollowUps.length === 0 && (
            <li className="a2-row-empty">No follow-ups due.</li>
          )}
        </ul>
      </section>

      <section className="a2-card">
        <h2>My cases</h2>
        <ul className="a2-rows">
          {myCases.map((c) => (
            <li key={c.id}>
              <span className="a2-mark" aria-hidden="true" />
              <span className="a2-row-main">
                <Link href={`/women/${c.id}`}>{c.clientRef}</Link>
              </span>
              <span className="a2-row-meta">{c.status}</span>
            </li>
          ))}
          {myCases.length === 0 && <li className="a2-row-empty">No cases yet.</li>}
        </ul>
        <p className="a2-card-foot">
          <Link href="/women">All women →</Link>
        </p>
      </section>
      </div>
    </main>
  );
}
