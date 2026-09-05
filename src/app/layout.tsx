import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import "./caseworker.css";
import { Nav } from "../components/nav";

/** A2 display/body face. Exposed as a variable; only .a2 rules consume it. */
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument-sans",
});

export const metadata: Metadata = {
  title: "Lou's Place Casework Tool",
  description: "Referral navigation + documentation for caseworkers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={instrumentSans.variable}>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
