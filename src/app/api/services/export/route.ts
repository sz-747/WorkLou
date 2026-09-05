/**
 * Phase 8 — Excel migration: export the current canonical service
 * directory as CSV (opens/round-trips in Excel). Always reflects the
 * canonical services table, never the staging layer.
 */
import { exportServicesCsv } from "../../../../lib/spreadsheet";

export const dynamic = "force-dynamic";

export async function GET() {
  const csv = await exportServicesCsv();
  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lous-place-services-${today}.csv"`,
    },
  });
}
