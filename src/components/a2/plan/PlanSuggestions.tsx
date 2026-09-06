import { Sheet } from "../Sheet";
import { Empty } from "../Empty";
import type { PlanSuggestion } from "../../../lib/a2/plan";

/** Step 1 — what her notes suggest she needs. Suggestions, not the plan. */
export function PlanSuggestions({
  firstName,
  suggestions,
}: {
  firstName: string;
  suggestions: PlanSuggestion[];
}) {
  return (
    <Sheet title="1 · Suggestions" note={`Suggestions, not the plan. ${firstName} decides.`}>
      {suggestions.length === 0 ? (
        <Empty>No approved summary yet, so there is nothing to suggest.</Empty>
      ) : (
        <ul className="a2s-rows">
          {suggestions.map((suggestion) => (
            <li key={suggestion.key}>
              <span className="a2s-row-left">
                <span className="a2s-ring" aria-hidden="true" />
                <span className="a2s-row-text">
                  <span className="a2s-row-title" style={{ fontSize: 15 }}>
                    {suggestion.label}
                  </span>
                  {suggestion.detail && (
                    <span className="a2s-row-detail">{suggestion.detail}</span>
                  )}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
