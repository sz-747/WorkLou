import Link from "next/link";

export function Nav() {
  return (
    <nav style={{ display: "flex", gap: "1.25rem", borderBottom: "1px solid #ddd", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
      <Link href="/">My Work</Link>
      <Link href="/women">Women</Link>
      <Link href="/data">Data check</Link>
      <Link href="/admin">Admin</Link>
    </nav>
  );
}
