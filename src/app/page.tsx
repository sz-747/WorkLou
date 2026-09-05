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
    <main>
      <h1>My Work</h1>
      <h2 style={{ marginTop: "1rem" }}>Follow-ups due</h2>
      <ul>
        {dueFollowUps.map((f) => (
          <li key={f.referralId}>
            <Link href={`/women/${f.caseId}`}>{f.clientRef}</Link> — {f.serviceName} · due{" "}
            {f.followUpDue} · {f.status}
            {f.outcome ? ` · ${outcomeLabel(f.outcome)}` : ""}
          </li>
        ))}
        {dueFollowUps.length === 0 && <li>No follow-ups due.</li>}
      </ul>
      <h2>My cases</h2>
      <ul>
        {myCases.map((c) => (
          <li key={c.id}>
            <Link href={`/women/${c.id}`}>{c.clientRef}</Link> — {c.status}
          </li>
        ))}
        {myCases.length === 0 && <li>No cases yet.</li>}
      </ul>
      <p>
        <Link href="/women">All women →</Link>
      </p>
    </main>
  );
}
