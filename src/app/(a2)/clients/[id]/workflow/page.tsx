import { redirect } from "next/navigation";

/**
 * @deprecated The old vertical workflow is stale. Existing links continue in the current plan.
 */
export default async function StaleWorkflowRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/clients/${id}/plan`);
}
