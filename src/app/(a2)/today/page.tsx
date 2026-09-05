import Link from "next/link";
import { AskBar } from "../../../components/a2/AskBar";
import { RailRow, Row, Sheet } from "../../../components/a2/Sheet";
import {
  FOLLOW_UPS_DUE,
  LETTERS_TO_WRITE,
  NEEDS_ATTENTION,
  RUNNING_TASK,
  SHELTER_BEDS,
  SHELTER_BEDS_NOTE,
  TODAY_SUBLINE,
} from "../../../lib/a2-mock";

/** A2 / Today (136:139). */
export default function Today() {
  return (
    <>
      <header className="a2s-head">
        <h1>Today at Lou&apos;s</h1>
        <p className="a2s-sub">{TODAY_SUBLINE}</p>
      </header>

      <AskBar />

      <div className="a2s-grid">
        <Sheet title={`Needs attention · ${NEEDS_ATTENTION.length}`}>
          <ul className="a2s-rows">
            {NEEDS_ATTENTION.map((row) => (
              <Row
                key={row.name}
                title={row.name}
                detail={row.detail}
                meta={row.meta}
                metaTone={row.overdue ? "overdue" : "muted"}
              />
            ))}
          </ul>

          <div className="a2s-running a2s-matte">
            <span className="a2s-spinner" aria-hidden="true" />
            <span className="a2s-running-label">{RUNNING_TASK.label}</span>
            <span className="a2s-running-time">{RUNNING_TASK.elapsed}</span>
            <Link className="a2s-running-open" href="/working">
              {RUNNING_TASK.action}
            </Link>
          </div>

          <p className="a2s-group-label">Follow-ups due</p>
          <ul className="a2s-rows">
            {FOLLOW_UPS_DUE.map((row) => (
              <Row
                key={row.name}
                title={row.name}
                detail={row.detail}
                meta={row.meta}
                metaTone={row.overdue ? "overdue" : "ink"}
              />
            ))}
          </ul>
        </Sheet>

        <div className="a2s-rail">
          <Sheet
            title="Shelter beds today"
            note={SHELTER_BEDS_NOTE}
            foot={
              <Link className="a2s-link" href="/shelters">
                All shelters
              </Link>
            }
          >
            <ul className="a2s-rail-rows">
              {SHELTER_BEDS.map((shelter) => (
                <RailRow
                  key={shelter.name}
                  name={shelter.name}
                  meta={shelter.beds}
                  detail={shelter.detail}
                  unknown={shelter.unknown}
                />
              ))}
            </ul>
          </Sheet>

          <Sheet
            title={`Letters to write · ${LETTERS_TO_WRITE.length}`}
            foot={
              <Link className="a2s-link" href="/letters">
                All letters
              </Link>
            }
          >
            <ul className="a2s-rail-rows">
              {LETTERS_TO_WRITE.map((letter) => (
                <RailRow
                  key={letter.name}
                  name={letter.name}
                  meta={letter.meta}
                  detail={letter.detail}
                />
              ))}
            </ul>
          </Sheet>
        </div>
      </div>
    </>
  );
}
