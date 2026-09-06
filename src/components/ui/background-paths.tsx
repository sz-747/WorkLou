import Image from "next/image";
import { Instrument_Sans } from "next/font/google";
import { DotMorphTitle } from "./dot-morph-title";
import styles from "./background-paths.module.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument-sans",
});

type ButterflyPalette = {
  upper: string;
  upperInset: string;
  lower: string;
  lowerEdge: string;
  spot: string;
};

const PALETTES: Record<string, ButterflyPalette> = {
  mural: {
    upper: "#f6f3df",
    upperInset: "#d8cf37",
    lower: "#e47736",
    lowerEdge: "#9f2951",
    spot: "#d9e5ed",
  },
  aqua: {
    upper: "#f4efd8",
    upperInset: "#39b9ad",
    lower: "#f0c93f",
    lowerEdge: "#d65946",
    spot: "#f7f3df",
  },
  coral: {
    upper: "#ef8d79",
    upperInset: "#c84d78",
    lower: "#f3c84e",
    lowerEdge: "#a53459",
    spot: "#f7edd4",
  },
};

function Butterfly({ palette }: { palette: ButterflyPalette }) {
  return (
    <svg
      aria-hidden="true"
      className={styles.butterflyArt}
      viewBox="0 0 170 132"
    >
      <g className={`${styles.wing} ${styles.leftWing}`}>
        <path
          d="M79 61C62 22 25 10 12 35C-1 61 22 87 76 70Z"
          fill={palette.upper}
          stroke="#e7eadf"
          strokeWidth="4"
        />
        <path
          d="M69 59C54 34 31 26 23 41C16 57 33 72 67 66Z"
          fill={palette.upperInset}
        />
        <circle cx="39" cy="45" r="8" fill={palette.spot} />
        <path
          d="M76 70C49 72 23 89 25 108C43 109 67 93 83 74Z"
          fill={palette.lower}
          stroke={palette.lowerEdge}
          strokeWidth="4"
        />
      </g>
      <g className={`${styles.wing} ${styles.rightWing}`}>
        <path
          d="M88 61C108 29 148 25 157 52C166 78 134 94 91 70Z"
          fill={palette.upper}
          stroke="#e7eadf"
          strokeWidth="4"
        />
        <path
          d="M97 61C114 42 139 40 145 56C150 70 128 80 99 68Z"
          fill={palette.upperInset}
        />
        <circle cx="129" cy="54" r="8" fill={palette.spot} />
        <path
          d="M91 70C119 76 137 94 128 116C108 108 94 89 85 75Z"
          fill={palette.lower}
          stroke={palette.lowerEdge}
          strokeWidth="4"
        />
      </g>
      <path d="M80 56C88 51 96 55 96 67C96 87 85 106 75 112C72 91 74 71 80 56Z" fill="#17212d" />
      <path d="M84 57C80 39 70 28 65 21" fill="none" stroke="#17212d" strokeLinecap="round" strokeWidth="3" />
      <path d="M91 57C100 41 113 34 124 27" fill="none" stroke="#17212d" strokeLinecap="round" strokeWidth="3" />
      <circle cx="64" cy="19" r="3" fill="#17212d" />
      <circle cx="126" cy="26" r="3" fill="#17212d" />
    </svg>
  );
}

const FLIGHTS = [
  { route: styles.routeOne, palette: PALETTES.mural },
  { route: styles.routeTwo, palette: PALETTES.aqua },
  { route: styles.routeThree, palette: PALETTES.coral },
  { route: styles.routeFour, palette: PALETTES.mural },
  { route: styles.routeFive, palette: PALETTES.aqua },
];

export function BackgroundPaths({ title = "No More Admin" }: { title?: string }) {
  return (
    <main className={`${styles.welcomePage} ${instrumentSans.variable}`}>
      <Image
        alt="Lou's Place"
        className={styles.logo}
        height={1038}
        priority
        src="/lous-place-logo-transparent.png"
        width={1516}
      />

      <div aria-hidden="true" className={styles.sky}>
        {FLIGHTS.map(({ route, palette }) => (
          <div className={`${styles.flight} ${route}`} key={route}>
            <div className={styles.float}>
              <Butterfly palette={palette} />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.hero}>
        <DotMorphTitle destination="/welcome/complete" title={title} />
      </div>
    </main>
  );
}
