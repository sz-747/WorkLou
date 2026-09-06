import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientBar } from "../../../../components/a2/ClientBar";
import { Sheet } from "../../../../components/a2/Sheet";
import { getFollowUpProfile } from "../../../../lib/a2/follow-ups";

export const dynamic = "force-dynamic";

/** One person's historical referral communications, separate from their five-step case journey. */
export default async function FollowUpHistory({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getFollowUpProfile(id);
  if (!profile) notFound();

  return (
    <>
      <header className="a2s-head">
        <h1>Follow-up history for {profile.name}</h1>
        <p className="a2s-sub">{profile.ref} · emails sent and actions recorded</p>
      </header>

      <div className="a2s-btn-row a2s-followup-back">
        <Link className="a2s-matte a2s-btn a2s-btn-sm" href="/follow-ups">
          Back to follow-ups
        </Link>
        <Link className="a2s-matte a2s-btn a2s-btn-sm" href={`/clients/${profile.id}`}>
          View profile and five-step journey
        </Link>
      </div>

      <Sheet>
        <div className="a2s-followup-person">
          <div>
            <span className="a2s-plan-eyebrow">Person</span>
            <h2>{profile.name}</h2>
            <p>{profile.ref}</p>
          </div>
          {profile.pills.length > 0 && (
            <div className="a2s-plan-pills" aria-label="Case information">
              {profile.pills.map((pill) => (
                <span className="a2s-chip" key={pill}>{pill}</span>
              ))}
            </div>
          )}
        </div>
      </Sheet>

      <section className="a2s-followup-timeline" aria-labelledby="communication-history-title">
        <div className="a2s-followup-title">
          <span className="a2s-plan-eyebrow">Referral communications</span>
          <h2 id="communication-history-title">Emails and recorded actions</h2>
        </div>

        {profile.referrals.map((referral) => (
          <article className="a2s-sheet a2s-followup-entry" key={referral.id}>
            <div className="a2s-followup-entry-head">
              <div>
                <span className="a2s-plan-eyebrow">Community service</span>
                <h3>{referral.service}</h3>
              </div>
              <span className={referral.overdue ? "a2s-history-status is-overdue" : "a2s-history-status"}>
                {referral.followUp}
              </span>
            </div>

            <dl className="a2s-followup-facts">
              <div><dt>Status</dt><dd>{referral.status}</dd></div>
              <div><dt>Sent</dt><dd>{referral.sent}</dd></div>
              <div><dt>Recorded result</dt><dd>{referral.result}</dd></div>
              <div>
                <dt>Phone</dt>
                <dd>
                  {referral.phone ? (
                    <a href={`tel:${referral.phone.replace(/[^+\d]/g, "")}`}>{referral.phone}</a>
                  ) : (
                    "Not recorded"
                  )}
                </dd>
              </div>
            </dl>

            <details className="a2s-history-email">
              <summary>View sent email</summary>
              <p>{referral.email ?? "No saved email text."}</p>
            </details>
          </article>
        ))}
      </section>

      <ClientBar name={profile.name} />
    </>
  );
}
