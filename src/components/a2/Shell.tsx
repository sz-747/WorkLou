"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ALERTS, CASEWORKER, IDENTITY_MENU } from "../../lib/a2-mock";
import { SearchGlyph } from "./glyphs";
import { Spotlight } from "./Spotlight";

const NAV = [
  { label: "Today", href: "/today" },
  { label: "My clients", href: "/clients" },
  { label: "Shelters", href: "/shelters" },
  { label: "Plans", href: "/plans" },
  { label: "Letters", href: "/letters" },
  { label: "Follow-ups", href: "/follow-ups" },
];

/** Nav / Pill + Nav / Island from the A2 frames, with the alerts and identity
 *  popovers (A2 / Today · alerts) and the spotlight overlay (A2 / Spotlight). */
export function Shell() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState<"alerts" | "identity" | null>(null);
  const [spotlight, setSpotlight] = useState(false);

  return (
    <div className="a2s-shell">
      <div className="a2s-nav a2s-matte">
        <span className="a2s-logo" aria-label="Lou's Place">
          Lou&apos;s
        </span>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="a2s-island a2s-matte">
        <button
          type="button"
          className="a2s-island-btn"
          aria-label="Search"
          onClick={() => setSpotlight(true)}
        >
          <SearchGlyph />
        </button>

        <span className="a2s-pop-wrap">
          <button
            type="button"
            className="a2s-island-btn"
            aria-expanded={open === "alerts"}
            onClick={() => setOpen(open === "alerts" ? null : "alerts")}
          >
            <span className="a2s-island-label">Alerts</span>
            <span className="a2s-badge">{ALERTS.count}</span>
          </button>
          {open === "alerts" && (
            <div className="a2s-pop" role="dialog" aria-label="Alerts">
              <h3>{ALERTS.title}</h3>
              <ul>
                {ALERTS.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="a2s-pop-foot">{ALERTS.markAll}</p>
            </div>
          )}
        </span>

        <span className="a2s-pop-wrap">
          <button
            type="button"
            className="a2s-island-btn"
            aria-expanded={open === "identity"}
            onClick={() => setOpen(open === "identity" ? null : "identity")}
          >
            <span className="a2s-avatar">{CASEWORKER.initials}</span>
            <span className="a2s-identity">
              <b>{CASEWORKER.name}</b>
              <span>{CASEWORKER.role}</span>
            </span>
          </button>
          {open === "identity" && (
            <div className="a2s-pop" role="dialog" aria-label="Account">
              <p className="a2s-pop-line">{IDENTITY_MENU.line}</p>
              <ul>
                {IDENTITY_MENU.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="a2s-pop-foot">{IDENTITY_MENU.logout}</p>
            </div>
          )}
        </span>
      </div>

      {spotlight && <Spotlight onClose={() => setSpotlight(false)} />}
    </div>
  );
}
