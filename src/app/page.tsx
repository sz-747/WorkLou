import { redirect } from "next/navigation";

/** The active dashboard uses the warm A2 design system. */
export default function DashboardEntry() {
  redirect("/today");
}
