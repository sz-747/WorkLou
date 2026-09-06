import "../a2.css";
import { Shell } from "../../components/a2/Shell";
import { ShellFooter } from "../../components/a2/ShellFooter";
import { Life } from "../../components/a2/Life";
import { getAlerts } from "../../lib/a2/alerts";

/** Shared chrome for the A2 design screens: canvas, backdrop life, pill nav.
 *  Alerts are read here so every screen shows the same live count. */
export const dynamic = "force-dynamic";

export default async function A2Layout({ children }: { children: React.ReactNode }) {
  const alerts = await getAlerts();
  const overdueCount = alerts.rows.filter((row) => row.kind === "Overdue").length;

  return (
    <div className="a2s">
      <div className="a2s-page">
        <Life />
        <Shell alerts={alerts} overdueCount={overdueCount} />
        {children}
        <ShellFooter />
      </div>
    </div>
  );
}
