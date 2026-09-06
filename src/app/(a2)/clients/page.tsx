import Link from "next/link";
import { Sheet } from "../../../components/a2/Sheet";
import { Filters } from "../../../components/a2/Filters";
import { Empty } from "../../../components/a2/Empty";
import { getClientRows } from "../../../lib/a2/clients";
import { getWaitingRows } from "../../../lib/a2/follow-ups";

/** A2 / People — the caseworker's own list (136:279). Data: cases, contexts, notes and referrals. */
export const dynamic = "force-dynamic";

const COLUMNS = ["Client", "Focus", "Stage", "Last contact", "Next follow-up", "Attention"];
const FILTERS = ["All", "Overdue", "Waiting on service"];

export default async function MyClients() {
  const [rows, waiting] = await Promise.all([getClientRows(), getWaitingRows()]);
  const overdue = rows.filter((row) => row.nextOverdue).length;

  return (
    <>
      <header className="a2s-head">
        <h1>People</h1>
        <p className="a2s-sub">
          {rows.length} open · {overdue} overdue · {waiting.length} waiting on a service
        </p>
      </header>

      <div className="a2s-btn-row" style={{ marginBottom: 16 }}>
        <Link className="a2s-matte a2s-btn" href="/clients/new">
          Add New Person
        </Link>
      </div>

      <Filters options={FILTERS} />

      <div className="a2s-grid">
        <Sheet>
          {rows.length === 0 ? (
            <Empty>No women on your list yet.</Empty>
          ) : (
            <table className="a2s-table">
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="is-name">
                      <Link href={`/clients/${row.id}`}>{row.name}</Link>
                    </td>
                    <td>{row.focus}</td>
                    <td>{row.stage}</td>
                    <td>{row.last}</td>
                    <td className={row.nextOverdue ? "is-overdue" : undefined}>{row.next}</td>
                    <td>
                      {row.attention === "–" ? (
                        "–"
                      ) : (
                        <span className="a2s-count">{row.attention}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Sheet>

        <div className="a2s-rail">
          <Sheet title="Waiting on a service">
            {waiting.length === 0 ? (
              <Empty>No referrals are out with a provider.</Empty>
            ) : (
              <ul className="a2s-rail-rows">
                {waiting.map((item) => (
                  <li key={item.key}>
                    <span className="a2s-rail-top">
                      <span className="a2s-rail-name">{item.name}</span>
                      <Link className="a2s-rail-meta" href="/follow-ups">
                        Follow-ups
                      </Link>
                    </span>
                    <span className="a2s-rail-detail">{item.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </Sheet>
        </div>
      </div>
    </>
  );
}
