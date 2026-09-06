"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../../../../db";
import { cases } from "../../../../db/schema";

export async function closeProfile(formData: FormData): Promise<void> {
  const caseId = String(formData.get("caseId") ?? "");
  if (!caseId) redirect("/clients");

  await db.update(cases).set({ status: "closed" }).where(eq(cases.id, caseId));
  revalidatePath("/clients");
  revalidatePath(`/clients/${caseId}`);
  redirect("/clients");
}
