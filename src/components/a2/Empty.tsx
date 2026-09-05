/** Empty state inside a sheet — used when the database has no rows yet. */
export function Empty({ children }: { children: string }) {
  return <p className="a2s-dim">{children}</p>;
}
