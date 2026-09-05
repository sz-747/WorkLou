import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "../db";
import { cases } from "../db/schema";

export const dynamic = "force-dynamic";

export default async function MyWork() {
  const myCases = await db.select().from(cases).orderBy(desc(cases.createdAt));

  return (
    <main>
      <h1>My Work</h1>
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
