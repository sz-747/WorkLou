"use server";

/**
 * Phase 4 — Verify server actions.
 * recordConfirmation: worker records what the provider told them —
 * updates the existing fact row in place (or inserts the missing one)
 * with source_type provider_confirmed, who, when, notes.
 * markStale: a volatile fact expires — only verification_status changes;
 * history (source, confirmed_by/confirmed_at, notes) is never deleted.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { markFactStale, recordProviderConfirmation } from "../../../lib/verify";
import { runUpdater } from "../../../lib/updater";

function fdStr(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function recordConfirmation(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const serviceId = String(fd.get("serviceId"));
  const attrId = fdStr(fd, "attrId");
  const attrType = String(fd.get("attrType"));
  const key = String(fd.get("key"));
  const value = fdStr(fd, "value");
  const confirmedBy = fdStr(fd, "confirmedBy");
  const notes = fdStr(fd, "notes");
  const dateStr = fdStr(fd, "confirmedAt");

  const back = (msg: string): never =>
    redirect(`/women/${caseId}?verify=${serviceId}&verifyError=${encodeURIComponent(msg)}`);
  if (!serviceId || !attrType || !key) back("Invalid verification request.");
  if (!value) back("Confirmed value is required.");
  if (!confirmedBy) back("Who confirmed this (e.g. 'Caseworker — phone') is required.");

  const confirmedAt = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();

  await recordProviderConfirmation({
    caseId,
    attrId: attrId || null,
    serviceId,
    attrType,
    key,
    value: value!,
    confirmedBy: confirmedBy!,
    confirmedAt,
    notes,
  });

  revalidatePath(`/women/${caseId}`);
}

export async function markStale(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const serviceId = String(fd.get("serviceId"));
  const attrId = String(fd.get("attrId"));
  if (attrId) await markFactStale(attrId);
  revalidatePath(`/women/${caseId}`);
  redirect(`/women/${caseId}?verify=${serviceId}`);
}

/** Re-check this service's configured machine source before provider calls. */
export async function refreshMachineFacts(fd: FormData): Promise<void> {
  const caseId = String(fd.get("caseId"));
  const serviceId = String(fd.get("serviceId"));
  if (serviceId) await runUpdater({ trigger: "manual", only: [serviceId] });
  revalidatePath(`/women/${caseId}`);
  redirect(`/women/${caseId}?verify=${serviceId}`);
}
