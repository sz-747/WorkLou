import { CLIENT_BAR } from "../../lib/a2-mock";

/**
 * Client context bar shown at the foot of client-scoped A2 frames. It is named
 * after the woman — the case reference stays beside it as the data label only.
 */
export function ClientBar({ name, caseRef }: { name?: string; caseRef?: string } = {}) {
  const label = name ? [name, caseRef].filter(Boolean).join(" · ") : CLIENT_BAR.name;

  return (
    <div className="a2s-clientbar a2s-matte">
      <b>{label}</b>
      <nav aria-label="Client sections">
        {CLIENT_BAR.links.map((link) => (
          <a href="#" key={link}>
            {link}
          </a>
        ))}
      </nav>
      <button type="button" className="a2s-matte a2s-btn a2s-btn-sm">
        {CLIENT_BAR.quickExit}
      </button>
    </div>
  );
}
