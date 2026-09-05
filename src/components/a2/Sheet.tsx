import type { ReactNode } from "react";

/** Sheet / … — white 40%, radius 20, hairline stroke, 32 background blur. */
export function Sheet({
  title,
  action,
  children,
  note,
  foot,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  note?: string;
  foot?: ReactNode;
}) {
  return (
    <section className="a2s-sheet">
      {(title || action) && (
        <div className="a2s-sheet-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
      {foot && <div className="a2s-sheet-foot">{foot}</div>}
      {note && <p className="a2s-sheet-note">{note}</p>}
    </section>
  );
}

/** Row / … — hollow ring, title + detail, right-aligned meta. */
export function Row({
  title,
  detail,
  meta,
  metaTone,
}: {
  title: string;
  detail?: string;
  meta?: string;
  metaTone?: "muted" | "ink" | "overdue";
}) {
  return (
    <li>
      <span className="a2s-row-left">
        <span className="a2s-ring" aria-hidden="true" />
        <span className="a2s-row-text">
          <span className="a2s-row-title">{title}</span>
          {detail && <span className="a2s-row-detail">{detail}</span>}
        </span>
      </span>
      {meta && (
        <span
          className={`a2s-row-meta${
            metaTone === "overdue" ? " is-overdue" : metaTone === "ink" ? " is-ink" : ""
          }`}
        >
          {meta}
        </span>
      )}
    </li>
  );
}

/** Compact rail row (Shelter beds / Letters): name + meta on one line. */
export function RailRow({
  name,
  meta,
  detail,
  unknown,
}: {
  name: string;
  meta: string;
  detail: string;
  unknown?: boolean;
}) {
  return (
    <li>
      <span className="a2s-rail-top">
        <span className="a2s-rail-name">{name}</span>
        <span className={`a2s-rail-meta${unknown ? " is-unknown" : ""}`}>{meta}</span>
      </span>
      <span className="a2s-rail-detail">{detail}</span>
    </li>
  );
}
