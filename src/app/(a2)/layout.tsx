import "../a2.css";
import { Shell } from "../../components/a2/Shell";
import { Life } from "../../components/a2/Life";

/** Shared chrome for the A2 design screens: canvas, backdrop life, pill nav. */
export default function A2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="a2s">
      <div className="a2s-page">
        <Life />
        <Shell />
        {children}
      </div>
    </div>
  );
}
