import { ContributionGrid } from "../../../components/a2/ContributionGrid";
import { ContributionBadges } from "../../../components/a2/ContributionBadges";
import { Sheet } from "../../../components/a2/Sheet";
import { getContributionsView } from "../../../lib/a2/contributions";

export const dynamic = "force-dynamic";

export default function ContributionsPage() {
  const contributions = getContributionsView();

  return (
    <>
      <header className="a2s-head">
        <h1>Your contributions</h1>
        <p className="a2s-sub">A quiet record of the people Hannah has supported through Lou&apos;s Place.</p>
      </header>

      <div className="a2s-contribution-stats">
        <Sheet><strong>{contributions.today}</strong><span>Women helped today</span></Sheet>
        <Sheet><strong>{contributions.thisMonth}</strong><span>Women helped this month</span></Sheet>
        <Sheet><strong>{contributions.lastYear}</strong><span>Women helped this year</span></Sheet>
        <Sheet><strong>{contributions.activeDays}</strong><span>Days you made a difference</span></Sheet>
      </div>

      <Sheet title="A year of support" note="Local demo activity · hover over any square for the day">
        <ContributionGrid days={contributions.days} />
      </Sheet>

      <Sheet className="a2s-badges-sheet">
        <ContributionBadges />
      </Sheet>
    </>
  );
}
