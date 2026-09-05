import { Row, Sheet } from "../../../components/a2/Sheet";
import { FOLLOW_UPS_DUE, MY_CLIENTS } from "../../../lib/a2-mock";

/**
 * Follow-ups. No dedicated Figma frame exists for this nav item, so it reuses
 * Today's "Follow-ups due" rows and My clients' "Waiting on a service" sheet.
 */
export default function FollowUps() {
  return (
    <>
      <header className="a2s-head">
        <h1>Follow-ups</h1>
        <p className="a2s-sub">
          {FOLLOW_UPS_DUE.length} due · {MY_CLIENTS.waiting.items.length} waiting on a service
        </p>
      </header>

      <div className="a2s-grid">
        <Sheet title="Follow-ups due">
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
