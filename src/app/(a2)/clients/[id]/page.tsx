import Link from "next/link";
import { notFound } from "next/navigation";
import { Sheet } from "../../../../components/a2/Sheet";
import { ClientBar } from "../../../../components/a2/ClientBar";
import { CaseJourney } from "../../../../components/a2/CaseJourney";
import { Empty } from "../../../../components/a2/Empty";
import { getClientProfile } from "../../../../lib/a2/clients";
import { closeProfile } from "./actions";

/**
 * A2 / Profile · <her name> (136:217), driven by real case data.
 */
export const dynamic = "force-dynamic";

export default async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getClientProfile(id);
  if (!profile) notFound();

  return (
    <>
      <div className="a2s-profile-head">
        <span className="a2s-avatar">{profile.initials}</span>
        <div className="a2s-profile-id">
          <h1>{profile.name}</h1>
          <p className="a2s-sub" style={{ fontSize: 14, margin: "4px 0 0" }}>
            {profile.subline}
          </p>
          {profile.chips.length > 0 && (
            <div className="a2s-chips" style={{ marginTop: 10 }}>
              {profile.chips.map((chip) => (
                <span className="a2s-chip" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <CaseJourney
        currentStage={profile.journey.currentStage}
        statuses={profile.journey.statuses}
      />

      <div className="a2s-grid">
        <div>
          <Sheet title="Summary profile" note={profile.summary.checked}>
            {profile.summary.body ? (
              <p className="a2s-body">{profile.summary.body}</p>
            ) : (
              <Empty>No summary yet. Add call notes when creating the person.</Empty>
            )}
          </Sheet>

          <Sheet
            title="Recent contact"
            action={
              profile.referrals.length > 0 ? (
                <Link className="a2s-link" href={`/follow-ups/${profile.id}`}>
                  Communication history
                </Link>
              ) : null
            }
          >
            {profile.recentContact.length === 0 ? (
              <Empty>No contact recorded yet.</Empty>
            ) : (
              <ul className="a2s-timeline">
                {profile.recentContact.map((item) => (
                  <li key={item.key}>
                    <span className="a2s-when">{item.when}</span>
                    <span className="a2s-what">{item.what}</span>
                  </li>
                ))}
              </ul>
            )}
          </Sheet>

          <Sheet
            className="a2s-top-referrals"
            title="Top referrals"
            action={
              <Link className="a2s-btn-primary a2s-matte" href={`/clients/${profile.id}/plan`}>
                Open top referrals
              </Link>
            }
          >
            <p className="a2s-body">
              See the three highest-ranked community services, their fit scores and the trade-offs for {profile.firstName}.
            </p>
          </Sheet>

          <Sheet title="Referrals in flight">
            {profile.referrals.length === 0 ? (
              <Empty>{`No referrals for ${profile.firstName} yet.`}</Empty>
            ) : (
              <ul className="a2s-rail-rows">
                {profile.referrals.map((item) => (
                  <li key={item.key}>
                    <span className="a2s-rail-top">
                      <span className="a2s-rail-name" style={{ fontSize: 15 }}>
                        {item.name}
                      </span>
                    </span>
                    <span className="a2s-dim">{item.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </Sheet>
        </div>

        <div className="a2s-rail">
          <Sheet title={`Needs attention · for ${profile.firstName}`}>
            {profile.attention.length === 0 ? (
              <Empty>Nothing overdue.</Empty>
            ) : (
              <ul className="a2s-rail-rows">
                {profile.attention.map((item) => (
                  <li key={item.key}>
                    <span className="a2s-rail-top">
                      <span className="a2s-rail-name" style={{ fontSize: 14 }}>
                        {item.name}
                      </span>
                    </span>
                    <span className="a2s-dim">{item.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </Sheet>

          <Sheet title="Files" note="by type · newest first">
            <ul className="a2s-rail-rows">
              {profile.files.map((file) => (
                <li key={file.name}>
                  {file.href ? (
                    <a className="a2s-file-link" href={file.href} target="_blank" rel="noreferrer">
                      <span className="a2s-rail-name" style={{ fontSize: 15 }}>{file.name}</span>
                      <span className="a2s-dim">{file.detail}</span>
                    </a>
                  ) : (
                    <>
                      <span className="a2s-rail-top">
                        <span className="a2s-rail-name" style={{ fontSize: 15 }}>{file.name}</span>
                      </span>
                      <span className="a2s-dim">{file.detail}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Sheet>

          <Sheet title="Profile options">
            <div className="a2s-profile-options">
              <p className="a2s-body">Finished working with {profile.firstName}?</p>
              <form action={closeProfile}>
                <input type="hidden" name="caseId" value={profile.id} />
                <button className="a2s-matte a2s-btn a2s-btn-sm" type="submit">Close profile</button>
              </form>
            </div>
          </Sheet>
        </div>
      </div>

      <ClientBar name={profile.name} />
    </>
  );
}
