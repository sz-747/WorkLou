import { CLIENT_BAR } from "../../lib/a2-mock";

/** Client context bar shown at the foot of client-scoped A2 frames. */
export function ClientBar() {
  return (
    <div className="a2s-clientbar a2s-matte">
      <b>{CLIENT_BAR.name}</b>
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
