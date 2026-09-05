"use server";

/**
 * Phase 7 admin server actions: manual updater + discovery runs and update
 * candidate review (approve applies to canonical data with change-log
 * history; reject leaves canonical data untouched). Errors via redirect params.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runDiscovery } from "../../lib/discovery";
import {
  applyUpdateCandidate,
  rejectUpdateCandidate,
  runUpdater,
} from "../../lib/updater";

function fdStr(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : null;
}

const back = (msg: string) => redirect(`/admin?updaterError=${encodeURIComponent(msg)}`);

export async function runUpdaterAction(): Promise<void> {
  const summary = await runUpdater({ trigger: "manual" });
  revalidatePath("/admin");
  redirect(
    `/admin?updaterMsg=${encodeURIComponent(
      `Run completed: ${summary.servicesChecked} services checked, ${summary.sourcesOk} sources ok, ${summary.sourcesFailed} failed, ${summary.candidatesCreated} new candidates, ${summary.candidatesUpdated} updated, ${summary.refreshed} freshness refreshes.`,
    )}`,
  );
}

export async function runDiscoveryAction(): Promise<void> {
  const summary = await runDiscovery();
  revalidatePath("/admin");
  redirect(
    `/admin?discoveryMsg=${encodeURIComponent(
      `Discovery run: ${summary.resultsFound} provider URLs found across ${summary.queries.length} searches — ${summary.created} queued for review, ${summary.skipped} skipped (already known), ${summary.failed} failed.`,
    )}`,
  );
}

export async function approveCandidate(fd: FormData): Promise<void> {
  const candidateId = String(fd.get("candidateId"));
  const decidedBy = fdStr(fd, "decidedBy");
  if (!decidedBy) back("Your name/initials are required to approve an update.");
  const applied = await applyUpdateCandidate(candidateId, decidedBy);
  if (!applied) back("That candidate no longer exists or was already decided.");
  revalidatePath("/admin");
  redirect("/admin?updaterMsg=" + encodeURIComponent("Update applied to canonical service data (history logged)."));
}

export async function rejectCandidate(fd: FormData): Promise<void> {
  const candidateId = String(fd.get("candidateId"));
  const decidedBy = fdStr(fd, "decidedBy");
  const reason = fdStr(fd, "reason");
  if (!decidedBy) back("Your name/initials are required to reject an update.");
  const rejected = await rejectUpdateCandidate(candidateId, decidedBy, reason);
  if (!rejected) back("That candidate no longer exists or was already decided.");
  revalidatePath("/admin");
  redirect("/admin?updaterMsg=" + encodeURIComponent("Update rejected — canonical service data unchanged."));
}
