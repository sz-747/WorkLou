"use client";

import Link from "next/link";
import type { AlertsView } from "../../lib/a2/alerts";
import { ALERTS } from "../../lib/a2-mock";

/**
 * Alerts button + popover in the nav island. Each row is a link straight to
 * where the alert gets resolved (her profile), and the state — Overdue, Reply,
 * Needs context — is a chip of its own rather than a dot-separated fragment,
 * so the state never reads as part of the woman's name.
 */
export function AlertsMenu({
  alerts,
  open,
  onToggle,
  onNavigate,
}: {
  alerts: AlertsView;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <span className="a2s-pop-wrap">
      <button
        type="button"
        className="a2s-island-btn"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="a2s-island-label">Alerts</span>
        <span className="a2s-badge">{alerts.count}</span>
      </button>

      {open && (
        <div className="a2s-pop a2s-alerts" role="dialog" aria-label="Alerts">
          <h3>{ALERTS.title}</h3>
          {alerts.rows.length === 0 ? (
            <p className="a2s-pop-line">Nothing waiting on you.</p>
          ) : (
            <ul className="a2s-alert-list">
              {alerts.rows.map((row) => (
                <li key={row.key}>
                  <Link className="a2s-alert" href={row.href} onClick={onNavigate}>
                    <span
                      className="a2s-alert-kind"
                      data-kind={row.kind.toLowerCase().replace(/\s+/g, "-")}
                    >
                      {row.kind}
                    </span>
                    <span className="a2s-alert-body">
                      <span className="a2s-alert-person">{row.person}</span>
                      <span className="a2s-alert-detail">{row.detail}</span>
                    </span>
                    <span className="a2s-alert-when">{row.when}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="a2s-pop-foot">{ALERTS.markAll}</p>
        </div>
      )}
    </span>
  );
}
