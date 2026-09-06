/**
 * Accommodation availability — what we actually know about capacity.
 *
 * The service import (synthetic CSV and the real spreadsheets it mirrors)
 * carries WAIT TIMES, not beds or capacity. So this view never states a bed
 * count and never infers capacity from a wait time: capacity is only reported
 * when a provider-confirmed `delivery/capacity` fact exists, and it goes stale
 * four hours after it was confirmed (the same TTL Verify records).
 * Synthetic demonstration services are labelled so nobody mistakes a seeded
 * status for a real one.
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db";
import { serviceAttributes, services } from "../../db/schema";
import { humanise, timeLabel } from "./format";

/** Provider-confirmed capacity is trusted for four hours. */
export const CAPACITY_TTL_HOURS = 4;

export const CAPACITY_UNKNOWN = "Current capacity unknown — call to confirm.";

export type AvailabilityRow = {
  id: string;
  name: string;
  /** short status shown beside the name: the recorded status, or "unknown" */
  status: string;
  /** last-checked line, or the call-to-confirm sentence when nothing is known */
  detail: string;
  /** no provider-confirmed capacity on record */
  unknown: boolean;
  /** confirmed more than four hours ago */
  stale: boolean;
  /** seeded demonstration data, not a real provider report */
  demo: boolean;
};

/** Seeded demonstration rows are named as such by the seed/import. */
function isDemo(name: string, sourceName: string | null): boolean {
  const haystack = `${name} ${sourceName ?? ""}`.toLowerCase();
  return haystack.includes("demo") || haystack.includes("synthetic");
}

/**
 * Accommodation services with the capacity we can evidence.
 * Unknown-capacity services come last: they need a phone call, not a glance.
 */
export async function getAccommodationAvailability(
  now: Date = new Date(),
  limit = 4,
): Promise<AvailabilityRow[]> {
  const needRows = await db
    .select({ serviceId: serviceAttributes.serviceId, value: serviceAttributes.value })
    .from(serviceAttributes)
    .where(eq(serviceAttributes.attrType, "need"));

  const accommodationIds = new Set(
    needRows
      .filter((row) => /housing|accommodation|refuge|shelter/.test(row.value.toLowerCase()))
      .map((row) => row.serviceId),
  );
  if (accommodationIds.size === 0) return [];

  const [serviceRows, capacityRows] = await Promise.all([
    db.select().from(services).where(eq(services.status, "active")).orderBy(asc(services.name)),
    db
      .select()
      .from(serviceAttributes)
      .where(and(eq(serviceAttributes.attrType, "delivery"), eq(serviceAttributes.key, "capacity"))),
  ]);

  const capacityByService = new Map(capacityRows.map((row) => [row.serviceId, row]));

  const rows: AvailabilityRow[] = serviceRows
    .filter((service) => accommodationIds.has(service.id))
    .map((service) => {
      const demo = isDemo(service.name, service.sourceName);
      const capacity = capacityByService.get(service.id);
      const confirmedAt =
        capacity && capacity.sourceType === "provider_confirmed" ? capacity.confirmedAt : null;

      if (!capacity || !confirmedAt) {
        return {
          id: service.id,
          name: service.name,
          status: "unknown",
          detail: CAPACITY_UNKNOWN,
          unknown: true,
          stale: false,
          demo,
        };
      }

      const ageHours = (now.getTime() - confirmedAt.getTime()) / 3_600_000;
      const stale = ageHours > CAPACITY_TTL_HOURS;
      return {
        id: service.id,
        name: service.name,
        status: humanise(capacity.value),
        detail: [
          `last checked ${timeLabel(confirmedAt)}`,
          stale ? "over four hours ago — call to confirm" : null,
          demo ? "Demo status." : null,
        ]
          .filter(Boolean)
          .join(" · "),
        unknown: false,
        stale,
        demo,
      };
    });

  return [...rows.filter((row) => !row.unknown), ...rows.filter((row) => row.unknown)].slice(
    0,
    limit,
  );
}
