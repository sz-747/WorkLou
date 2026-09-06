"use client";

/**
 * Persistent shell footer. Exit app leaves immediately and replaces the
 * browser history entry, so the Back button does not return here.
 */
export function ShellFooter() {
  return (
    <footer className="a2s-shell-foot">
      <span className="a2s-dim">Lou&apos;s Place · Casework console</span>
      <button
        className="a2s-matte a2s-shell-exit"
        type="button"
        onClick={() => window.location.replace("https://www.google.com")}
      >
        Exit app
      </button>
    </footer>
  );
}
