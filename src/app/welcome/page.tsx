import type { Metadata } from "next";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { getContributionsView } from "@/lib/a2/contributions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome | Lou's Place",
  description: "Welcome to Lou's Place.",
};

export default function WelcomePage() {
  const contributions = getContributionsView();
  const stats = [
    { value: contributions.today, label: "women helped today" },
    { value: contributions.thisMonth, label: "this month" },
    { value: contributions.lastYear, label: "this past year" },
  ];

  return <BackgroundPaths title="No More Admin" stats={stats} />;
}
