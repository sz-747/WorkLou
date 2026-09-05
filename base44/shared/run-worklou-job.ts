import { secrets } from "base44:runtime";

export type WorkLouJob = "updater" | "discovery";

const JOB_PATHS: Record<WorkLouJob, string> = {
  updater: "/api/updater/run?trigger=scheduled",
  discovery: "/api/discovery/run?trigger=scheduled&limit=1",
};

function requiredSecret(name: string): string {
  const value = secrets.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function buildTargetUrl(baseUrl: string, path: string): URL {
  const target = new URL(path, `${baseUrl.replace(/\/$/, "")}/`);
  const localDevelopment =
    target.protocol === "http:" &&
    (target.hostname === "localhost" || target.hostname === "127.0.0.1");

  if (target.protocol !== "https:" && !localDevelopment) {
    throw new Error("WORKLOU_APP_BASE_URL must use HTTPS.");
  }

  return target;
}

export async function runWorkLouJob(job: WorkLouJob): Promise<Response> {
  const startedAt = Date.now();

  try {
    const baseUrl = requiredSecret("WORKLOU_APP_BASE_URL");
    const schedulerSecret = requiredSecret("SCHEDULER_SECRET");
    const target = buildTargetUrl(baseUrl, JOB_PATHS[job]);
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        authorization: `Bearer ${schedulerSecret}`,
        "content-type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(240_000),
    });
    const responseText = await upstream.text();
    const durationMs = Date.now() - startedAt;

    if (!upstream.ok) {
      console.error("WorkLou scheduled job failed", {
        job,
        upstreamStatus: upstream.status,
        durationMs,
      });
      return Response.json(
        { ok: false, job, upstreamStatus: upstream.status, durationMs },
        { status: 502 },
      );
    }

    console.log("WorkLou scheduled job completed", {
      job,
      upstreamStatus: upstream.status,
      durationMs,
    });

    return new Response(responseText, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error("WorkLou scheduled job could not run", {
      job,
      durationMs,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      {
        ok: false,
        job,
        durationMs,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
