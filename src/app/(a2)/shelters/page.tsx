import { Sheet } from "../../../components/a2/Sheet";
import { Filters } from "../../../components/a2/Filters";
import { ShelterAsk } from "../../../components/a2/ShelterAsk";
import { ClientBar } from "../../../components/a2/ClientBar";
import { SHELTERS } from "../../../lib/a2-mock";

/** A2 / Shelters (136:2) with the ask panel from A2 / Shelters · ask (146:47). */
export default function Shelters() {
  return (
    <>
      <header className="a2s-head">
        <h1>{SHELTERS.title}</h1>
        <p className="a2s-sub">{SHELTERS.subline}</p>
      </header>

      <Filters options={SHELTERS.filters} />

      <div className="a2s-grid">
        <div>
          <ShelterAsk />

          <Sheet
            note={SHELTERS.showAllNote}
            foot={
              <button type="button" className="a2s-matte a2s-btn a2s-btn-sm">
                {SHELTERS.showAll}
              </button>
            }
          >
            <table className="a2s-table">
              <thead>
                <tr>
                  {SHELTERS.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SHELTERS.rows.map((row) => (
                  <tr key={row.name}>
                    <td className="is-name">{row.name}</td>
                    <td>{row.area}</td>
                    <td>{row.takes}</td>
                    <td>{row.beds}</td>
                    <td className={row.eligible ? "is-name" : undefined}>{row.forMaya}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sheet>
        </div>

        <div className="a2s-rail">
          <Sheet title={SHELTERS.newService.title} note={SHELTERS.newService.note}>
            <input
              className="a2s-field"
              placeholder={SHELTERS.newService.placeholder}
              aria-label={SHELTERS.newService.title}
            />
          </Sheet>

          <Sheet title={SHELTERS.lastChecked.title}>
            <ul className="a2s-rail-rows">
              {SHELTERS.lastChecked.items.map((item) => (
                <li key={item}>
                  <span className="a2s-rail-detail" style={{ marginTop: 0 }}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </Sheet>

          <Sheet title={SHELTERS.callList.title}>
            <ul className="a2s-rail-rows">
              {SHELTERS.callList.items.map((item) => (
                <li key={item.name}>
                  <span className="a2s-rail-top">
                    <span className="a2s-rail-name" style={{ fontSize: 14 }}>
                      {item.name}
                    </span>
                  </span>
                  <span className="a2s-rail-detail">{item.detail}</span>
                </li>
              ))}
            </ul>
          </Sheet>
        </div>
      </div>

      <ClientBar />
    </>
  );
}
