"use server";

/**
 * Phase 7 admin server actions: save service corrections and fact
 * corrections. Errors are surfaced via redirect params (same pattern as
 * the worker stages); nothing persists when validation fails.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  correctServiceAttribute,
  updateServiceAdmin,
  type ServicePatch,
} from "../../../../lib/admin";

function fdStr(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : null;
}

export async function saveService(fd: FormData): Promise<void> {
  const serviceId = String(fd.get("serviceId"));
  const changedBy = fdStr(fd, "changedBy");
  const back = (msg: string): never =>
    redirect(`/admin/services/${serviceId}?adminError=${encodeURIComponent(msg)}`);
  if (!changedBy) back("Your name/initials are required (who made the correction).");

  const patch: ServicePatch = {};
  for (const key of [
    "name",
    "organisation",
    "description",
    "status",
    "website",
    "phone",
    "email",
    "address",
    "catchment",
    "sourceName",
    "sourceUrl",
  ] as const) {
    const v = fdStr(fd, key);
    patch[key] = v === "" ? null : v;
  }
  if (!patch.name) back("Service name is required.");

  const changed = await updateServiceAdmin({ serviceId, patch, changedBy: changedBy! });
  if (changed === 0) back("Nothing changed — the values submitted match the stored ones.");
  revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin");
  redirect(`/admin/services/${serviceId}?adminSaved=${changed}`);
}

export async function correctFact(fd: FormData): Promise<void> {
  const serviceId = String(fd.get("serviceId"));
  const attrId = String(fd.get("attrId"));
  const value = fdStr(fd, "value");
  const changedBy = fdStr(fd, "changedBy");
  const notes = fdStr(fd, "notes");
  const back = (msg: string): never =>
    redirect(`/admin/services/${serviceId}?adminError=${encodeURIComponent(msg)}`);
  if (!value) back("A corrected value is required.");
  if (!changedBy) back("Your name/initials are required (who made the correction).");

  const updated = await correctServiceAttribute({ attrId, value: value!, notes, changedBy: changedBy! });
  if (!updated) back("That fact no longer exists.");
  revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin");
  redirect(`/admin/services/${serviceId}`);
}
