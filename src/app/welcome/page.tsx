import type { Metadata } from "next";
import { BackgroundPaths } from "@/components/ui/background-paths";

export const metadata: Metadata = {
  title: "Welcome | Lou's Place",
  description: "Welcome to Lou's Place.",
};

export default function WelcomePage() {
  return <BackgroundPaths title="No More Admin" />;
}
