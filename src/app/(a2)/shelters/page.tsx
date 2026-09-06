import { Sheet } from "../../../components/a2/Sheet";
import { Filters } from "../../../components/a2/Filters";
import { ShelterAsk } from "../../../components/a2/ShelterAsk";
import { ClientBar } from "../../../components/a2/ClientBar";
import { Empty } from "../../../components/a2/Empty";
import { getSheltersView } from "../../../lib/a2/shelters";

/**
 * A2 / Shelters (136:2) with the ask panel from A2 / Shelters · ask (146:47).
 * Data: canonical services + their stored facts, with freshness provenance.
 * The import carries wait times, not beds or capacity, so the design's "Beds"
 * column is replaced by contact + last-checked, which we can actually evidence.
 */
export const dynamic = "force-dynamic";

const COLUMNS = ["Service", "Area", "Helps with", "Who it takes", "Contact", "Last checked"];

export default async function Shelters() {
  const view = await getSheltersView();

  return (
    <>
      <header className="a2s-head">
        <h1>Services directory</h1>
        <p className="a2s-sub">
          {view.rows.length} active service{view.rows.length === 1 ? "" : "s"} ·{" "}
          {view.confirmedCount} with provider-confirmed facts
        </p>
      </header>

      <Filters options={view.needFilters} />

      <div className="a2s-grid">
        <div>
          <ShelterAsk />

          <Sheet note="Facts are what the provider told us, when they told us. Capacity is not tracked — call to confirm availability.">
            {view.rows.length === 0 ? (
              <Empty>No active services in the database.</Empty>
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
                  {view.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="is-name">{row.name}</td>
                      <td>{row.area}</td>
                      <td>{row.needs}</td>
                      <td>{row.takes}</td>
                      <td>{row.contact}</td>
                      <td className={row.confirmed ? "is-name" : undefined}>{row.lastChecked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Sheet>
        </div>

        <div className="a2s-rail">
          <Sheet title="Last checked">
            {view.lastChecked.length === 0 ? (
              <Empty>No facts have been checked yet.</Empty>
            ) : (
              <ul className="a2s-rail-rows">
                {view.lastChecked.map((item) => (
                  <li key={item.key}>
                    <span className="a2s-rail-detail" style={{ marginTop: 0 }}>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Sheet>
        </div>
      </div>

      <ClientBar />
    </>
  );
}
