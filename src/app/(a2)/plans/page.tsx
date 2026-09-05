import { Sheet } from "../../../components/a2/Sheet";
import { ClientBar } from "../../../components/a2/ClientBar";
import { PlanAdd } from "../../../components/a2/PlanAdd";
import { PLAN } from "../../../lib/a2-mock";

/** A2 / Plan · Maya (136:341). */
export default function Plan() {
  return (
    <>
      <header className="a2s-head">
        <h1>{PLAN.title}</h1>
        <p className="a2s-sub">{PLAN.subline}</p>
      </header>

      <div className="a2s-grid">
        <div>
          <Sheet title={PLAN.suggestions.title} note={PLAN.suggestions.note}>
            <div className="a2s-chips">
              {PLAN.suggestions.chips.map((chip) => (
                <button type="button" className="a2s-chip a2s-chip-btn" key={chip}>
                  {chip}
                </button>
              ))}
            </div>
            <div className="a2s-btn-row" style={{ marginTop: 14 }}>
              <input
                className="a2s-field"
                placeholder={PLAN.suggestions.placeholder}
                aria-label={PLAN.suggestions.placeholder}
                style={{ maxWidth: 420 }}
              />
              <button type="button" className="a2s-matte a2s-btn a2s-btn-sm">
                {PLAN.suggestions.add}
              </button>
            </div>
          </Sheet>

          {PLAN.groups.map((group) => (
            <Sheet key={group.label}>
              <p className="a2s-spotlight-label">{group.label}</p>
              <ul className="a2s-rows">
                {group.items.map((item) => (
                  <li key={item.name}>
                    <span className="a2s-row-left">
                      <span className="a2s-ring" aria-hidden="true" />
                      <span className="a2s-row-text">
                        <span className="a2s-row-title" style={{ fontSize: 15 }}>
                          {item.name}
                        </span>
                        <span className="a2s-row-detail">{item.detail}</span>
                      </span>
                    </span>
                    {"badge" in item && item.badge && (
                      <span className="a2s-tag">{item.badge}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Sheet>
          ))}

          <PlanAdd />

          <Sheet>
            <div className="a2s-rail-top">
              <span className="a2s-rail-name" style={{ fontSize: 15 }}>
                {PLAN.letter.name}
              </span>
            </div>
            <span className="a2s-rail-detail">{PLAN.letter.detail}</span>
          </Sheet>
        </div>

        <div className="a2s-rail">
          <Sheet title={PLAN.actions.title}>
            <div className="a2s-btn-row" style={{ marginBottom: 12 }}>
              <button type="button" className="a2s-btn-primary">
                {PLAN.actions.quickExit}
              </button>
              <button type="button" className="a2s-matte a2s-btn a2s-btn-sm">
                {PLAN.actions.openPlan}
              </button>
            </div>
            <ul className="a2s-rail-rows">
              {PLAN.actions.items.map((item) => (
                <li key={item.name}>
                  <span className="a2s-rail-top">
                    <span className="a2s-rail-name" style={{ fontSize: 15 }}>
                      {item.name}
                    </span>
                  </span>
                  <span className="a2s-rail-detail">{item.detail}</span>
                </li>
              ))}
            </ul>
          </Sheet>

          <Sheet
            title={PLAN.reviewed.title}
            action={<span className="a2s-link">{PLAN.reviewed.action}</span>}
          >
            <ul className="a2s-timeline">
              {PLAN.reviewed.items.map((item) => (
                <li key={item.when}>
                  <span className="a2s-when">{item.when}</span>
                  <span className="a2s-what">{item.what}</span>
                </li>
              ))}
            </ul>
          </Sheet>

          <Sheet>
            <p className="a2s-spotlight-label">{PLAN.suggested.label}</p>
            <p className="a2s-rail-name" style={{ margin: 0 }}>
              {PLAN.suggested.name}
            </p>
            <span className="a2s-rail-detail">{PLAN.suggested.detail}</span>
            <div className="a2s-btn-row" style={{ marginTop: 12 }}>
              {PLAN.suggested.actions.map((action) => (
                <button type="button" className="a2s-matte a2s-btn a2s-btn-sm" key={action}>
                  {action}
                </button>
              ))}
            </div>
          </Sheet>
        </div>
      </div>

      <ClientBar />
    </>
  );
}
