"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CASEWORKER, IDENTITY_MENU } from "../../lib/a2-mock";
import type { AlertsView } from "../../lib/a2/alerts";
import { AlertsMenu } from "./AlertsMenu";
import { SearchGlyph } from "./glyphs";
import { Logo } from "./Logo";
import { NavActiveLoop } from "./NavActiveLoop";
import { Spotlight } from "./Spotlight";

const NAV = [
  { label: "Today", href: "/today" },
  { label: "People", href: "/clients" },
  { label: "Shelters", href: "/shelters" },
  { label: "Plans", href: "/plans" },
  { label: "Follow-ups", href: "/follow-ups" },
];

/** Nav / Pill + Nav / Island from the A2 frames, with the alerts and identity
 *  popovers (A2 / Today · alerts) and the spotlight overlay (A2 / Spotlight). */
export function Shell({
  alerts,
  overdueCount,
}: {
  alerts: AlertsView;
  /** Follow-ups past their due date — surfaced as a red count on that tab. */
  overdueCount: number;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [visiblePathname, setVisiblePathname] = useState(pathname);
  const [open, setOpen] = useState<"alerts" | "identity" | null>(null);
  const [spotlight, setSpotlight] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisiblePathname(pathname);
  }, [pathname]);

  useEffect(() => {
    NAV.forEach((item) => router.prefetch(item.href));
    router.prefetch("/clients/new");
    router.prefetch("/contributions");
  }, [router]);

  return (
    <div className="a2s-shell">
      <Logo />

      <div className="a2s-nav a2s-matte" ref={navRef}>
        <NavActiveLoop navRef={navRef} pathname={visiblePathname} />
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            aria-current={visiblePathname.startsWith(item.href) ? "page" : undefined}
            onClick={() => setVisiblePathname(item.href)}
          >
            {item.label}
            {item.href === "/follow-ups" && overdueCount > 0 && (
              <span
                className="a2s-nav-badge"
                aria-label={`${overdueCount} follow-up${overdueCount === 1 ? "" : "s"} overdue`}
              >
                {overdueCount}
              </span>
            )}
          </Link>
        ))}
      </div>

      <Link className="a2s-matte a2s-new-call" href="/clients/new" prefetch>
        <span aria-hidden="true">+</span>
        New call note
      </Link>

      <div className="a2s-island a2s-matte">
        <button
          type="button"
          className="a2s-island-btn"
          aria-label="Search"
          onClick={() => setSpotlight(true)}
        >
          <SearchGlyph />
        </button>

        <AlertsMenu
          alerts={alerts}
          open={open === "alerts"}
          onToggle={() => setOpen(open === "alerts" ? null : "alerts")}
          onNavigate={() => setOpen(null)}
        />

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
                <li><Link href="/today" onClick={() => setOpen(null)}>My day</Link></li>
                <li><Link href="/contributions" onClick={() => setOpen(null)}>Contributions</Link></li>
                <li><Link href="/settings" onClick={() => setOpen(null)}>Settings</Link></li>
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
