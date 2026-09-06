import { eq } from "drizzle-orm";
import { db } from "../../db";
import { caseworkerSettings } from "../../db/schema";

export const DEFAULT_CASEWORKER_ID = "hannah-lee";

export type CaseworkerSettings = {
  id: string;
  name: string;
  email: string;
};

export async function getCaseworkerSettings(): Promise<CaseworkerSettings> {
  const [row] = await db
    .select()
    .from(caseworkerSettings)
    .where(eq(caseworkerSettings.id, DEFAULT_CASEWORKER_ID))
    .limit(1);

  return row ?? {
    id: DEFAULT_CASEWORKER_ID,
    name: "Hannah Lee",
    email: "",
  };
}

export async function saveCaseworkerEmail(email: string): Promise<void> {
  await db
    .insert(caseworkerSettings)
    .values({
      id: DEFAULT_CASEWORKER_ID,
      name: "Hannah Lee",
      email,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: caseworkerSettings.id,
      set: { email, updatedAt: new Date() },
    });
}
