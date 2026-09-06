"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveCaseworkerEmail } from "../../../lib/a2/caseworker-settings";

export async function updateCaseworkerEmail(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/settings?error=Enter%20a%20valid%20email%20address.");
  }

  await saveCaseworkerEmail(email);
  revalidatePath("/settings");
  revalidatePath("/shelters");
  redirect("/settings?saved=1");
}
