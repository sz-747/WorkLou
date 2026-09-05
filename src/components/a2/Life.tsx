/** Backdrop / Life (136:139): sky sparkles and soft dots over the bands. */

const SPARKLES = [
  { left: "63%", top: "14%", size: 24 },
  { left: "94%", top: "26%", size: 16 },
  { left: "6%", top: "58%", size: 12 },
  { left: "5%", top: "88%", size: 16 },
];

const DOTS = [
  { left: "8%", top: "22%", size: 5, sky: false },
  { left: "27%", top: "9%", size: 4, sky: true },
  { left: "45%", top: "78%", size: 6, sky: false },
  { left: "69%", top: "66%", size: 4, sky: true },
  { left: "82%", top: "44%", size: 5, sky: false },
  { left: "91%", top: "72%", size: 4, sky: true },
  { left: "14%", top: "70%", size: 6, sky: false },
  { left: "36%", top: "92%", size: 4, sky: true },
  { left: "58%", top: "36%", size: 5, sky: false },
  { left: "76%", top: "18%", size: 4, sky: true },
];

function Sparkle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 0c.7 6.4 4.9 10.6 12 12-7.1 1.4-11.3 5.6-12 12-.7-6.4-4.9-10.6-12-12C7.1 10.6 11.3 6.4 12 0Z"
        fill="#bfe3f5"
      />
    </svg>
  );
}

export function Life() {
  return (
    <div className="a2s-life" aria-hidden="true">
      {SPARKLES.map((s) => (
        <span key={`${s.left}${s.top}`} style={{ position: "absolute", left: s.left, top: s.top }}>
          <Sparkle size={s.size} />
        </span>
      ))}
      {DOTS.map((d) => (
        <span
          key={`${d.left}${d.top}`}
          className="a2s-dot"
          style={{
            left: d.left,
            top: d.top,
            height: d.size,
            width: d.size,
            background: d.sky ? "rgb(191 227 245 / 40%)" : "rgb(255 255 255 / 60%)",
          }}
        />
      ))}
    </div>
  );
}
