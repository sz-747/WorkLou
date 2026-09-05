"use server";

/**
 * Phase 8 — Excel migration: spreadsheet upload → staging, staged-row
 * import/discard, and CSV export. Upload parses the file and stages rows
 * verbatim; nothing touches canonical services until a row is imported.
 * Errors via redirect params (same pattern as the other admin actions).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  discardStagedRow,
  importSpreadsheetText,
  importStagedRow,
} from "../../lib/spreadsheet";

function fdStr(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : null;
}

const back = (msg: string) => redirect(`/admin?spreadsheetError=${encodeURIComponent(msg)}`);

export async function uploadSpreadsheetAction(fd: FormData): Promise<void> {
  const importedBy = fdStr(fd, "importedBy");
  const file = fd.get("file");
  if (!importedBy) return back("your name is required");
  if (!(file instanceof File) || file.size === 0) return back("choose a CSV file to upload");

  let text: string;
  try {
    text = await file.text();
  } catch {
    return back("could not read the file");
  }
  if (/^\s*<\?xml|PK\u0003\u0004/.test(text.slice(0, 100))) {
    return back(
      "that looks like a native Excel file — save it as CSV first (File → Save as → CSV)",
    );
  }

  let summary;
  try {
    summary = await importSpreadsheetText({
      text,
      filename: file.name,
      importedBy,
    });
  } catch (err) {
    return back(err instanceof Error ? err.message : "import failed");
  }

  revalidatePath("/admin");
  redirect(
    `/admin?spreadsheetMsg=${encodeURIComponent(
      `Staged ${summary.rows} rows from ${file.name}: ${summary.newRows} new services, ${summary.matchedRows} matched existing. Review and import below — nothing canonical changed yet.`,
    )}`,
  );
}

export async function importStagedAction(fd: FormData): Promise<void> {
  const stagedId = fdStr(fd, "stagedId");
  const importedBy = fdStr(fd, "importedBy");
  if (!stagedId || !importedBy) return back("your name is required");

  const outcome = await importStagedRow(stagedId, importedBy);
  if (!outcome) return back("row not found or already decided");

  revalidatePath("/admin");
  const detail =
    outcome.mode === "created"
      ? `created the service with ${outcome.addedNeeds.length} need fact(s) (needs provider confirmation)`
      : `${outcome.filled.length} empty field(s) filled, ${outcome.addedNeeds.length} need fact(s) added, ${outcome.skipped.length} existing value(s) kept (not overwritten)`;
  redirect(
    `/admin?spreadsheetMsg=${encodeURIComponent(`Imported: ${detail}.`)}`,
  );
}

export async function discardStagedAction(fd: FormData): Promise<void> {
  const stagedId = fdStr(fd, "stagedId");
  const decidedBy = fdStr(fd, "importedBy");
  if (!stagedId || !decidedBy) return back("your name is required");

  const ok = await discardStagedRow(stagedId, decidedBy);
  if (!ok) return back("row not found or already decided");

  revalidatePath("/admin");
  redirect(`/admin?spreadsheetMsg=${encodeURIComponent("Row discarded — canonical data untouched.")}`);
}
