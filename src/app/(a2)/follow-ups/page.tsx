import { Row, Sheet } from "../../../components/a2/Sheet";
import { Empty } from "../../../components/a2/Empty";
import { FollowUpProfiles } from "../../../components/a2/FollowUpProfiles";
import { getFollowUpProfiles, getFollowUpRows } from "../../../lib/a2/follow-ups";

/**
 * Follow-ups is the post-referral workspace. Its top section answers the
 * immediate question — what needs contact now — while the profiles below hold
 * each person's email and service-contact trail.
 */
export const dynamic = "force-dynamic";

export default async function FollowUps() {
  const [due, profiles] = await Promise.all([getFollowUpRows(), getFollowUpProfiles()]);

  return (
    <>
      <header className="a2s-head">
        <h1>Follow-ups</h1>
        <p className="a2s-sub">{due.length} need attention now · {profiles.length} people with outreach in progress</p>
      </header>

      <Sheet title="What you should be following up on right now" note="These are sent referrals due today or overdue.">
        {due.length === 0 ? (
          <Empty>Nothing needs follow-up right now.</Empty>
        ) : (
          <ul className="a2s-rows">
            {due.map((row) => (
              <Row key={row.key} title={row.name} detail={row.detail} meta={row.meta} metaTone={row.overdue ? "overdue" : "ink"} />
            ))}
          </ul>
        )}
      </Sheet>

      <section className="a2s-followup-section">
        <h2>People you&apos;re following up with</h2>
        <p className="a2s-sub">See every service contacted, saved email, result and the next follow-up in one place.</p>
        <FollowUpProfiles profiles={profiles} />
      </section>
    </>
  );
}
