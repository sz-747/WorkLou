/**
 * Phase 7A — updater HTTP entry point. POSTing this route runs the
 * existing-service updater once; used by the compose cron sidecar for the
 * recurring schedule and by manual API calls. Idempotent: repeated runs create no duplicate
 * candidates.
 */
import { runUpdater } from "../../../../lib/updater";
import { authorizeSchedulerRequest } from "../../../../lib/scheduler-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = authorizeSchedulerRequest(request);
  if (!authorization.ok) {
    return Response.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  const url = new URL(request.url);
  const trigger = url.searchParams.get("trigger") === "scheduled" ? "scheduled" : "manual";
  const summary = await runUpdater({ trigger });
  return Response.json(summary);
}
