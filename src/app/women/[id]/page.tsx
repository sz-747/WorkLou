import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  caseContexts,
  caseDocuments,
  cases,
} from "../../../db/schema";
import { ContextStage } from "./ContextStage";
import { FindSupportStage } from "./FindSupportStage";
import { ReferStage } from "./ReferStage";
import { VerifyStage } from "./VerifyStage";
import { getLatestApprovedContext, getMatchCandidates, matchServices } from "../../../lib/matching";
import { getServiceForVerify } from "../../../lib/verify";
import { getReferralsForCase } from "../../../lib/refer";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-AU") : "—";

export default async function CaseWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    extractError?: string;
    verify?: string;
    verifyError?: string;
    referError?: string;
  }>;
}) {
  const { id } = await params;
  const { extractError, verify, verifyError, referError } = await searchParams;

  const [caseRow] = await db.select().from(cases).where(eq(cases.id, id));
  if (!caseRow) notFound();

  const [latestContext] = await db
    .select()
    .from(caseContexts)
    .where(eq(caseContexts.caseId, id))
    .orderBy(desc(caseContexts.version))
    .limit(1);

  const referralRows = await getReferralsForCase(id);

  const docCount = (await db.select().from(caseDocuments).where(eq(caseDocuments.caseId, id))).length;

  const approvedContext = await getLatestApprovedContext(id);
  const matchResults = approvedContext
    ? matchServices(approvedContext.context, await getMatchCandidates())
    : null;

  const suitable = (matchResults ?? []).filter((r) => r.suitable);
  const verifyServiceId = verify && suitable.some((r) => r.service.id === verify) ? verify : null;
  const selectedService = verifyServiceId ? await getServiceForVerify(verifyServiceId) : null;

  const stages = [
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
      <section style={{ border: "1px solid #eee", padding: "0.5rem 1rem", margin: "0.5rem 0" }}>
        <h3 style={{ margin: "0.25rem 0" }}>2. Find support</h3>
        <FindSupportStage approved={approvedContext} results={matchResults} />
      </section>
      <section style={{ border: "1px solid #eee", padding: "0.5rem 1rem", margin: "0.5rem 0" }}>
        <h3 style={{ margin: "0.25rem 0" }}>3. Verify</h3>
        <VerifyStage
          caseId={id}
          suitable={suitable.map((r) => ({ id: r.service.id, name: r.service.name }))}
          selected={selectedService}
          context={approvedContext?.context ?? null}
          verifyError={verifyError}
        />
      </section>
      <section style={{ border: "1px solid #eee", padding: "0.5rem 1rem", margin: "0.5rem 0" }}>
        <h3 style={{ margin: "0.25rem 0" }}>4. Refer</h3>
        <ReferStage
          caseId={id}
          suitable={suitable.map((r) => ({ id: r.service.id, name: r.service.name }))}
          approvedContext={
            approvedContext ? { id: approvedContext.id, context: approvedContext.context } : null
          }
          referrals={referralRows}
          referError={referError}
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
