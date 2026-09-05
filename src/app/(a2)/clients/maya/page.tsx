import Link from "next/link";
import { Sheet } from "../../../../components/a2/Sheet";
import { ClientBar } from "../../../../components/a2/ClientBar";
import { QuickExit } from "../../../../components/a2/QuickExit";
import { MAYA } from "../../../../lib/a2-mock";

/** A2 / Profile · Maya (136:217) with quick exit (153:45). */
export default function Profile() {
  return (
    <>
      <div className="a2s-profile-head">
        <span className="a2s-avatar">{MAYA.initials}</span>
        <div>
          <h1>{MAYA.name}</h1>
          <p className="a2s-sub" style={{ fontSize: 14, margin: "4px 0 0" }}>
            {MAYA.subline}
          </p>
        </div>
      </div>

      <div className="a2s-chips" style={{ marginBottom: 14 }}>
        {MAYA.chips.map((chip) => (
          <span className="a2s-chip" key={chip}>
            {chip}
          </span>
        ))}
      </div>

      <div className="a2s-btn-row" style={{ marginBottom: 8 }}>
        <QuickExit />
        {MAYA.actions.map((action) => (
          <button type="button" className="a2s-matte a2s-btn" key={action}>
            {action}
          </button>
        ))}
        <button type="button" className="a2s-matte a2s-btn a2s-btn-sm">
          {MAYA.secondaryAction}
        </button>
      </div>
      <p className="a2s-dim" style={{ marginBottom: 24 }}>
        {MAYA.quickExitNote}
      </p>

      <div className="a2s-grid">
        <div>
          <Sheet title={MAYA.summary.title} note={MAYA.summary.note}>
            <p className="a2s-body">{MAYA.summary.body}</p>
            <p className="a2s-dim">{MAYA.summary.checked}</p>
            <div className="a2s-btn-row" style={{ marginTop: 12 }}>
              {MAYA.summary.actions.map((action) => (
                <button type="button" className="a2s-matte a2s-btn a2s-btn-sm" key={action}>
                  {action}
                </button>
              ))}
            </div>
          </Sheet>

          <Sheet
            title={MAYA.plan.title}
            action={
              <Link className="a2s-link" href="/plans">
                {MAYA.plan.action}
              </Link>
            }
          >
            <p className="a2s-spotlight-label">{MAYA.plan.nextLabel}</p>
            {MAYA.plan.next.map((item) => (
              <p className="a2s-body" key={item} style={{ margin: "0 0 4px" }}>
                {item}
              </p>
            ))}
          </Sheet>

          <Sheet title={MAYA.files.title} note={MAYA.files.note}>
            <ul className="a2s-rail-rows">
              {MAYA.files.items.map((file) => (
                <li key={file.name}>
                  <span className="a2s-rail-top">
                    <span className="a2s-rail-name" style={{ fontSize: 15 }}>
                      {file.name}
                    </span>
                    <button type="button" className="a2s-linkish">
                      {MAYA.files.action}
                    </button>
                  </span>
                  <span className="a2s-dim">{file.detail}</span>
                </li>
              ))}
            </ul>
          </Sheet>

          <Sheet
            title={MAYA.recentContact.title}
            action={<span className="a2s-link">{MAYA.recentContact.link}</span>}
          >
            <ul className="a2s-timeline">
              {MAYA.recentContact.items.map((item) => (
                <li key={item.when}>
                  <span className="a2s-when">{item.when}</span>
                  <span className="a2s-what">{item.what}</span>
                </li>
              ))}
            </ul>
          </Sheet>
        </div>

        <div className="a2s-rail">
          <Sheet title={MAYA.referrals.title}>
            <ul className="a2s-rail-rows">
              {MAYA.referrals.items.map((item) => (
                <li key={`${item.name}${item.detail}`}>
                  <span className="a2s-rail-top">
                    <span className="a2s-rail-name" style={{ fontSize: 15 }}>
                      {item.name}
                    </span>
                  </span>
                  <span className="a2s-dim">{item.detail}</span>
                </li>
              ))}
            </ul>
          </Sheet>

          <Sheet title={MAYA.attention.title}>
            <ul className="a2s-rail-rows">
              {MAYA.attention.items.map((item) => (
                <li key={item.name}>
                  <span className="a2s-rail-top">
                    <span className="a2s-rail-name" style={{ fontSize: 14 }}>
                      {item.name}
                    </span>
                  </span>
                  <span className="a2s-dim">{item.detail}</span>
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
