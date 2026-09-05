import Link from "next/link";
import { AskBar } from "../../../components/a2/AskBar";
import { RailRow, Row, Sheet } from "../../../components/a2/Sheet";
import { Empty } from "../../../components/a2/Empty";
import { getTodayView } from "../../../lib/a2/today";
import { SHELTER_BEDS, SHELTER_BEDS_NOTE } from "../../../lib/a2-mock";

/**
 * A2 / Today (136:139). Needs attention, follow-ups and letters come from the
 * casework tables. Shelter bed capacity has no backend yet, so that rail is
 * still demo content.
 */
export const dynamic = "force-dynamic";

export default async function Today() {
  const today = await getTodayView();

  return (
    <>
      <header className="a2s-head">
        <h1>Today at Lou&apos;s</h1>
        <p className="a2s-sub">{today.subline}</p>
      </header>

      <AskBar />

      <div className="a2s-grid">
        <Sheet title={`Needs attention · ${today.needsAttention.length}`}>
          {today.needsAttention.length === 0 ? (
            <Empty>Nothing needs attention.</Empty>
          ) : (
            <ul className="a2s-rows">
              {today.needsAttention.map((row) => (
                <Row
                  key={row.key}
                  title={row.name}
                  detail={row.detail}
                  meta={row.meta}
                  metaTone={row.overdue ? "overdue" : "muted"}
                />
              ))}
            </ul>
          )}

          <p className="a2s-group-label">Follow-ups due</p>
          {today.followUps.length === 0 ? (
            <Empty>No follow-ups due today.</Empty>
          ) : (
            <ul className="a2s-rows">
              {today.followUps.map((row) => (
                <Row
                  key={row.key}
                  title={row.name}
                  detail={row.detail}
                  meta={row.meta}
                  metaTone={row.overdue ? "overdue" : "ink"}
                />
              ))}
            </ul>
          )}
        </Sheet>

        <div className="a2s-rail">
          <Sheet
            title="Shelter beds today"
            note={SHELTER_BEDS_NOTE}
            foot={
              <Link className="a2s-link" href="/shelters">
                All services
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
            title={`Letters · ${today.letters.length}`}
            foot={
              <Link className="a2s-link" href="/letters">
                All letters
              </Link>
            }
          >
            {today.letters.length === 0 ? (
              <Empty>No letters yet.</Empty>
            ) : (
              <ul className="a2s-rail-rows">
                {today.letters.slice(0, 4).map((letter) => (
                  <RailRow
                    key={letter.key}
                    name={letter.name}
                    meta={letter.meta}
                    detail={letter.detail}
                  />
                ))}
              </ul>
            )}
          </Sheet>
        </div>
      </div>
    </>
  );
}
