import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  caseContexts,
  caseDocuments,
  cases,
  referrals,
  services,
} from "../../../db/schema";
import { ContextStage } from "./ContextStage";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-AU") : "—";

export default async function CaseWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ extractError?: string }>;
}) {
  const { id } = await params;
  const { extractError } = await searchParams;

  const [caseRow] = await db.select().from(cases).where(eq(cases.id, id));
  if (!caseRow) notFound();

  const [latestContext] = await db
    .select()
    .from(caseContexts)
    .where(eq(caseContexts.caseId, id))
    .orderBy(desc(caseContexts.version))
    .limit(1);

  const referralRows = await db
    .select({
      id: referrals.id,
      status: referrals.status,
      serviceName: services.name,
      outcome: referrals.outcome,
    })
    .from(referrals)
    .innerJoin(services, eq(referrals.serviceId, services.id))
    .where(eq(referrals.caseId, id));

  const docCount = (await db.select().from(caseDocuments).where(eq(caseDocuments.caseId, id))).length;

  const stages = [
    {
      n: 2,
      name: "Find support",
      state: "Not built yet.",
      placeholder: "Deterministic service matching from approved context. (Phase 3)",
    },
    {
      n: 3,
      name: "Verify",
      state: "Not built yet.",
      placeholder: "Auto-resolve machine-accessible facts; flag provider-only facts. (Phase 4)",
    },
    {
      n: 4,
      name: "Refer",
      state:
        referralRows.length > 0
          ? `${referralRows.length} referral(s): ${referralRows
              .map((r) => `${r.serviceName} (${r.status})`)
              .join(", ")}`
          : "No referrals yet.",
      placeholder: "Draft referral from approved context → review → mark sent. (Phase 5)",
    },
    {
      n: 5,
      name: "Follow up + document",
      state: `${referralRows.filter((r) => r.outcome).length} outcome(s) recorded, ${docCount} document draft(s).`,
      placeholder: "Track outcomes; draft case documentation for review. (Phase 6)",
    },
  ];

  return (
    <main>
      <h1>
        {caseRow.clientRef} <span className="pill draft">{caseRow.status}</span>
      </h1>
      <p style={{ fontSize: "0.85rem" }}>Created {fmtDate(caseRow.createdAt)}</p>

      <h2>Workflow</h2>
      <section style={{ border: "1px solid #eee", padding: "0.5rem 1rem", margin: "0.5rem 0" }}>
        <h3 style={{ margin: "0.25rem 0" }}>1. Context</h3>
        <ContextStage
          caseId={id}
          originalNotes={caseRow.originalNotes}
          latest={latestContext}
          extractError={extractError}
        />
      </section>
      {stages.map((s) => (
        <section key={s.n} style={{ border: "1px solid #eee", padding: "0.5rem 1rem", margin: "0.5rem 0" }}>
          <h3 style={{ margin: "0.25rem 0" }}>
            {s.n}. {s.name}
          </h3>
          <p style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>{s.state}</p>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#888" }}>{s.placeholder}</p>
        </section>
      ))}

      <p>
        <Link href="/women">← All women</Link>
      </p>
    </main>
  );
}
