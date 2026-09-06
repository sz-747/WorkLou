import { redirect } from "next/navigation";

/** @deprecated The legacy people list is stale. */
export default function StalePeopleRedirect() {
  redirect("/clients");
}
