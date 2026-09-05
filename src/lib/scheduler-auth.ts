export type SchedulerAuthorization =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

/** Protects machine-triggered HTTP routes with a shared bearer token. */
export function authorizeSchedulerRequest(
  request: Request,
  configuredSecret = process.env.SCHEDULER_SECRET,
): SchedulerAuthorization {
  const secret = configuredSecret?.trim();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "Scheduler secret is not configured.",
    };
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }

  return { ok: true };
}
