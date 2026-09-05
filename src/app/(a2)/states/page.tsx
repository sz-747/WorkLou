import { Sheet } from "../../../components/a2/Sheet";
import { CASEWORKER, STATES } from "../../../lib/a2-mock";

const STATE_CLASS: Record<string, string> = {
  Rest: "",
  Hover: "is-hover",
  Pressed: "is-press",
  Focus: "is-focus",
  Disabled: "is-disabled",
};

/** A2 / States (154:3) — the matte recipe across every control. */
export default function States() {
  return (
    <>
      <header className="a2s-head">
        <h1 style={{ fontSize: 28 }}>{STATES.title}</h1>
        <p className="a2s-sub" style={{ fontSize: 14 }}>
          {STATES.note}
        </p>
      </header>

      <Sheet>
        <table className="a2s-table a2s-states">
          <thead>
            <tr>
              <th />
              {STATES.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STATES.rows.map((row) => (
              <tr key={row}>
                <td>{row}</td>
                {STATES.columns.map((column) => (
                  <td key={column}>
                    <span className={`a2s-matte a2s-state-demo ${STATE_CLASS[column]}`}>
                      {row === "Nav link" && "Today"}
                      {row === "Alerts pill" && (
                        <>
                          Alerts <span className="a2s-badge">3</span>
                        </>
                      )}
                      {row === "Identity chip" && (
                        <>
                          <span className="a2s-avatar" style={{ height: 22, width: 22, fontSize: 10 }}>
                            {CASEWORKER.initials}
                          </span>{" "}
                          {CASEWORKER.name}
                        </>
                      )}
                      {row === "Spotlight bar" && "Search a client"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Sheet>
    </>
  );
}
