import Link from "next/link";

export function Nav() {
  return (
    <nav className="main-nav" aria-label="Main navigation">
      <div className="caseworker-nav">
        <Link href="/">My Work</Link>
        <Link href="/women">Women</Link>
      </div>
      <details className="tools-menu">
        <summary>System tools</summary>
        <div>
          <Link href="/data">Data check</Link>
        </div>
      </details>
    </nav>
  );
}
