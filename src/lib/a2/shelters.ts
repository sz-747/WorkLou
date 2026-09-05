/**
 * Services directory view model (the A2 "Shelters and crisis beds" screen).
 * Reads canonical services + their stored facts with provenance. Bed capacity
 * is NOT in the schema yet, so this view deliberately shows what we do know:
 * who a service takes, how to reach it, and when each fact was last checked.
 */
import { asc, eq } from "drizzle-orm";
import { db } from "../../db";
import { serviceAttributes, services } from "../../db/schema";
import { factLabel } from "../verify";
import { contactLabel, humanise, joinParts, shortDate } from "./format";

export type ServiceRow = {
  id: string;
  name: string;
  area: string;
  needs: string;
  takes: string;
  contact: string;
  lastChecked: string;
  confirmed: boolean;
};

export type LastCheckedRow = { key: string; text: string };

export type SheltersView = {
  rows: ServiceRow[];
  needFilters: string[];
  lastChecked: LastCheckedRow[];
  confirmedCount: number;
};

export async function getSheltersView(now: Date = new Date()): Promise<SheltersView> {
  const [serviceRows, attrRows] = await Promise.all([
    db.select().from(services).where(eq(services.status, "active")).orderBy(asc(services.name)),
    db.select().from(serviceAttributes).orderBy(asc(serviceAttributes.key)),
  ]);

  const byService = new Map<string, typeof attrRows>();
  for (const attr of attrRows) {
    const list = byService.get(attr.serviceId) ?? [];
    list.push(attr);
    byService.set(attr.serviceId, list);
  }

  const needFilters = new Set<string>();
  const rows: ServiceRow[] = serviceRows.map((service) => {
    const attrs = byService.get(service.id) ?? [];
    const needs = attrs.filter((a) => a.attrType === "need").map((a) => humanise(a.value));
    needs.forEach((need) => needFilters.add(need));

    const takes = attrs
      .filter((a) => ["eligibility", "cost", "wait_time", "delivery", "access"].includes(a.attrType))
      .map((a) => `${factLabel(a.key)}: ${humanise(a.value)}`);

    const freshest = attrs
      .map((a) => a.confirmedAt ?? a.retrievedAt)
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      id: service.id,
      name: service.name,
      area: service.catchment ?? "–",
      needs: needs.join(" · ") || "–",
      takes: takes.join(" · ") || "–",
      contact: joinParts([service.phone, service.email]) || "–",
      lastChecked: freshest ? contactLabel(freshest, now) : "not checked",
      confirmed: attrs.some((a) => a.verificationStatus === "provider_confirmed"),
    };
  });

  const lastChecked: LastCheckedRow[] = attrRows
    .filter((a) => a.confirmedAt ?? a.retrievedAt)
    .sort((a, b) => {
      const at = (a.confirmedAt ?? a.retrievedAt)!.getTime();
      const bt = (b.confirmedAt ?? b.retrievedAt)!.getTime();
      return bt - at;
    })
    .slice(0, 6)
    .map((attr) => {
      const service = serviceRows.find((s) => s.id === attr.serviceId);
      const when = (attr.confirmedAt ?? attr.retrievedAt)!;
      return {
        key: attr.id,
        text: joinParts([
          service?.name ?? "Unknown service",
          factLabel(attr.key),
          shortDate(when),
          attr.confirmedAt ? "provider confirmed" : humanise(attr.verificationStatus),
        ]),
      };
    });

  return {
    rows,
    needFilters: [...needFilters].sort(),
    lastChecked,
    confirmedCount: rows.filter((r) => r.confirmed).length,
  };
}
