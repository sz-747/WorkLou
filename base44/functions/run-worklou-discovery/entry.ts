import { runWorkLouJob } from "../../shared/run-worklou-job.ts";

export default async function (): Promise<Response> {
  return runWorkLouJob("discovery");
}
