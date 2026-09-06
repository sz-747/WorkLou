import { redirect } from "next/navigation";

/** @deprecated The sage-green case screen is stale. */
export default async function StaleCaseRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/clients/${id}`);
}
