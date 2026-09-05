"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Shared shell. Caseworker routes (/ and /women…) get the scoped A2 pill
 * styling; /admin and /data keep the original globals.css appearance.
 */
/** Routes that render the A2 design shell and supply their own chrome. */
const A2_ROUTES = [
  "/today",
  "/clients",
  "/shelters",
  "/plans",
  "/letters",
  "/follow-ups",
  "/working",
  "/done",
  "/states",
];

export function Nav() {
  const pathname = usePathname() ?? "/";
  const isCaseworker = pathname === "/" || pathname.startsWith("/women");

  if (A2_ROUTES.some((route) => pathname.startsWith(route))) return null;

  return (
    <nav
      className={`main-nav${isCaseworker ? " a2-nav" : ""}`}
      aria-label="Main navigation"
    >
      <div className="caseworker-nav">
        <Link href="/">My Work</Link>
        <Link href="/women">Women</Link>
      </div>
      <details className="tools-menu">
        <summary>System tools</summary>
        <div>
          <Link href="/data">Data check</Link>
          <Link href="/admin">Admin</Link>
        </div>
      </details>
    </nav>
  );
}
