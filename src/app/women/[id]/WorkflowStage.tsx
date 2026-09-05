import type { ReactNode } from "react";

export function WorkflowStage({
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
    <details className="workflow-stage" open={open}>
      <summary>
        <span className="stage-number" aria-hidden="true">
          {number}
        </span>
        <span className="stage-heading">
          <strong>{title}</strong>
          <span>{description}</span>
        </span>
        <span className="stage-status">{status}</span>
      </summary>
      <div className="stage-content">{children}</div>
    </details>
  );
}
