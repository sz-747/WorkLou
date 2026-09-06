import type { ReactNode } from "react";

/**
 * A casework stage in the A2 sheet language: numbered ring, title, right-aligned
 * status, and the stage's own controls inside the sheet body. Open/closed uses
 * the same <details> behaviour as the original workflow list.
 */
export function StageSheet({
  number,
  title,
  description,
  status,
  open,
  children,
}: {
  number: number;
  title: string;
  description: string;
  status: string;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <details className="a2s-sheet a2s-stage" open={open}>
      <summary className="a2s-stage-head">
        <span className="a2s-stage-number" aria-hidden="true">
          {number}
        </span>
        <span className="a2s-stage-text">
          <span className="a2s-row-title">{title}</span>
          <span className="a2s-row-detail">{description}</span>
        </span>
        <span className="a2s-row-meta is-ink">{status}</span>
      </summary>
      <div className="a2s-stage-body">{children}</div>
    </details>
  );
}
