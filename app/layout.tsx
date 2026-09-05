import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: "Lou's Place Referral Navigator",
  description: 'Find and refer women to community services — caseworkers stay in charge.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="top">
          <div className="inner">
            <Link href="/" className="brand">Lou&apos;s Place · Referral Navigator</Link>
            <div className="links">
              <Link href="/">Find services</Link>
              <Link href="/admin/verification">Verification</Link>
              <Link href="/admin/services">Services</Link>
              <Link href="/admin/evaluation">Evaluation</Link>
            </div>
          </div>
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
