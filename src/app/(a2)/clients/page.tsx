import Link from "next/link";
import { Sheet } from "../../../components/a2/Sheet";
import { MY_CLIENTS } from "../../../lib/a2-mock";
import { Filters } from "../../../components/a2/Filters";

/** A2 / My clients (136:279). */
export default function MyClients() {
  return (
    <>
      <header className="a2s-head">
        <h1>{MY_CLIENTS.title}</h1>
        <p className="a2s-sub">{MY_CLIENTS.subline}</p>
      </header>

      <Filters options={MY_CLIENTS.filters} />

      <div className="a2s-grid">
        <Sheet>
          <table className="a2s-table">
            <thead>
              <tr>
                {MY_CLIENTS.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MY_CLIENTS.rows.map((row) => (
                <tr key={row.name}>
                  <td className="is-name">
                    <Link href="/clients/maya">{row.name}</Link>
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
                  <td>{row.assistant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sheet>

        <div className="a2s-rail">
          <Sheet title={MY_CLIENTS.runningNow.title}>
            <ul className="a2s-rail-rows">
              {MY_CLIENTS.runningNow.items.map((item) => (
                <li key={item.name}>
                  <span className="a2s-rail-top">
                    <span className="a2s-rail-name">{item.name}</span>
                    <Link className="a2s-rail-meta" href="/working">
                      {MY_CLIENTS.runningNow.action}
                    </Link>
                  </span>
                  <span className="a2s-rail-detail">{item.detail}</span>
                </li>
              ))}
            </ul>
          </Sheet>

          <Sheet title={MY_CLIENTS.waiting.title}>
            <ul className="a2s-rail-rows">
              {MY_CLIENTS.waiting.items.map((item) => (
                <li key={item.name}>
                  <span className="a2s-rail-top">
                    <span className="a2s-rail-name">{item.name}</span>
                    <button type="button" className="a2s-linkish">
                      {MY_CLIENTS.waiting.action}
                    </button>
                  </span>
                  <span className="a2s-rail-detail">{item.detail}</span>
                </li>
              ))}
            </ul>
          </Sheet>
        </div>
      </div>
    </>
  );
}
