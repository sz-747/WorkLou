"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createPersonFromNotes } from "../../../../lib/a2/intake";

/**
 * Take the call notes, create her case, extract the draft context, then land
 * the worker on stage 1 where the extracted pills are reviewed and approved —
 * and stage 2 searches the services database against them.
 */
export async function addPerson(fd: FormData): Promise<void> {
  const name = String(fd.get("name") ?? "");
  const notes = String(fd.get("notes") ?? "");

  let caseId: string;
  try {
    caseId = await createPersonFromNotes({ name, notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add her.";
    redirect(`/clients/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/clients");
  redirect(`/clients/${caseId}/workflow`);
}
