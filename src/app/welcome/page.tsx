import type { Metadata } from "next";
import { BackgroundPaths } from "@/components/ui/background-paths";

export const metadata: Metadata = {
  title: "Welcome | Lou's Place",
  description: "Welcome to Lou's Place.",
};

export default function WelcomePage() {
  const stats = [
    { value: "25", label: "years operating" },
    { value: "175,000+", label: "women helped" },
  ];

  return <BackgroundPaths autoStart title="No More Admin" stats={stats} />;
}
