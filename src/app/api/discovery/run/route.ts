/**
 * Phase 7B (discovery side) — HTTP entry point. POSTing this route runs the
 * new-service discovery once: SERP API → provider URLs → direct fetch →
 * normalise → dedupe → review queue. Never merges anything
 * into the canonical database — review/merge is a human decision.
 */
import { runDiscovery } from "../../../../lib/discovery";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? limitParam : undefined;
  const trigger = url.searchParams.get("trigger") === "scheduled" ? "scheduled" : "manual";
  const summary = await runDiscovery(limit ? { limitPerQuery: limit } : {});
  return Response.json({ trigger, ...summary });
}
