import { db } from "../db";
import { serviceChangeLog } from "../db/schema";

/** Write one append-only service-data change record. */
export async function logServiceChange(entry: {
  serviceId: string;
  attributeId: string | null;
  entity: "service" | "attribute";
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  note: string | null;
}) {
  await db.insert(serviceChangeLog).values(entry);
}
