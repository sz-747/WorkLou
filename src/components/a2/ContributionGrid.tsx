import type { ContributionDay } from "../../lib/a2/contributions";

export function ContributionGrid({ days }: { days: ContributionDay[] }) {
  const firstDayOffset = new Date(`${days[0]?.date ?? "2026-01-01"}T12:00:00Z`).getUTCDay();

  return (
    <div className="a2s-contribution-chart" aria-label="Contribution activity for the last 365 days">
      <div className="a2s-contribution-months" aria-hidden="true">
        <span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span><span>Jan</span><span>Feb</span>
        <span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span>
      </div>
      <div className="a2s-contribution-grid-wrap">
        <div className="a2s-contribution-weekdays" aria-hidden="true">
          <span>Mon</span><span>Wed</span><span>Fri</span>
        </div>
        <div className="a2s-contribution-grid">
          {Array.from({ length: firstDayOffset }).map((_, index) => (
            <span className="a2s-contribution-blank" key={`blank-${index}`} />
          ))}
          {days.map((day) => (
            <span
              className={`a2s-contribution-day is-level-${day.level}`}
              key={day.date}
              aria-label={`${day.label}: ${day.detail}`}
              title={`${day.label}: ${day.detail}`}
              tabIndex={day.count > 0 ? 0 : -1}
            >
              <span className="a2s-contribution-tooltip" role="tooltip">
                <b>{day.label}</b>
                <strong>{day.count} {day.count === 1 ? "woman" : "women"} helped</strong>
                <small>{day.detail.split(" · ").slice(1).join(" · ") || day.detail}</small>
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="a2s-contribution-legend">
        <span>Quiet</span>
        {[0, 1, 2, 3, 4].map((level) => <i className={`is-level-${level}`} key={level} />)}
        <span>More women helped</span>
      </div>
    </div>
  );
}
