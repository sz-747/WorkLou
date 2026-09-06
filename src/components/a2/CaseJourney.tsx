const STEPS = [
  "Understand her needs",
  "Find suitable support",
  "Confirm important details",
  "Make the referral",
  "Follow through and document",
];

/** The five-step journey shown on every person's profile. */
export function CaseJourney({
  currentStage,
  statuses,
}: {
  currentStage: number;
  statuses: string[];
}) {
  return (
    <section className="a2s-sheet a2s-case-journey" aria-labelledby="case-journey-title">
      <div className="a2s-case-journey-head">
        <div>
          <span className="a2s-plan-eyebrow">Five-step referral process</span>
          <h2 id="case-journey-title">Her journey</h2>
        </div>
      </div>

      <ol className="a2s-case-steps">
        {STEPS.map((title, index) => {
          const number = index + 1;
          const state = number < currentStage ? "done" : number === currentStage ? "current" : "upcoming";
          return (
            <li className={`is-${state}`} key={title}>
              <span className="a2s-case-step-number">{state === "done" ? "✓" : number}</span>
              <span className="a2s-case-step-copy">
                <b>{title}</b>
                <small>{statuses[index]}</small>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
