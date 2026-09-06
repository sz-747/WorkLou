import Link from "next/link";
import { redirect } from "next/navigation";
import { Sheet } from "../../../components/a2/Sheet";
import { Empty } from "../../../components/a2/Empty";
import { getClientRows } from "../../../lib/a2/clients";

/**
 * A2 / Plans — plans belong to a woman, so this is just the way in: one woman
 * goes straight to her plan, otherwise pick who you are working with.
 */
export const dynamic = "force-dynamic";

export default async function Plans() {
  const rows = await getClientRows();
  if (rows.length === 1) redirect(`/clients/${rows[0].id}/plan`);

  return (
    <>
      <header className="a2s-head">
        <h1>Plans</h1>
        <p className="a2s-sub">Whose plan are you working on?</p>
      </header>

      <Sheet>
        {rows.length === 0 ? (
          <Empty>No women on your list yet.</Empty>
        ) : (
          <ul className="a2s-rows">
            {rows.map((row) => (
              <li key={row.id}>
                <span className="a2s-row-left">
                  <span className="a2s-ring" aria-hidden="true" />
                  <span className="a2s-row-text">
                    <span className="a2s-row-title" style={{ fontSize: 15 }}>
                      {row.name}
                    </span>
                    <span className="a2s-row-detail">{row.focus}</span>
                  </span>
                </span>
                <Link className="a2s-matte a2s-btn a2s-btn-sm" href={`/clients/${row.id}/plan`}>
                  Open plan
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
