import Link from "next/link";
import { notFound } from "next/navigation";
import { Sheet } from "../../../../components/a2/Sheet";
import { ClientBar } from "../../../../components/a2/ClientBar";
import { QuickExit } from "../../../../components/a2/QuickExit";
import { Empty } from "../../../../components/a2/Empty";
import { getClientProfile } from "../../../../lib/a2/clients";

/**
 * A2 / Profile · <her name> (136:217) with quick exit (153:45), driven by real
 * case data. She is named on screen; the case reference is only the data label.
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
          <p className="a2s-dim" style={{ margin: "10px 0 0" }}>
            Quick exit opens her escape plan in one click.
          </p>
        </div>
        <div className="a2s-profile-actions">
          <div className="a2s-btn-row">
            <QuickExit />
            <Link className="a2s-matte a2s-btn" href={`/clients/${profile.id}/workflow`}>
              Casework stages
            </Link>
          </div>
          <div className="a2s-btn-row">
            <Link className="a2s-matte a2s-btn a2s-btn-sm" href={`/clients/${profile.id}/workflow`}>
              New case note
            </Link>
            <Link className="a2s-matte a2s-btn a2s-btn-sm" href="/letters">
              Support letter
            </Link>
          </div>
        </div>
      </div>

      <div className="a2s-grid">
        <div>
          <Sheet title="Summary profile" note={profile.summary.checked}>
            {profile.summary.body ? (
              <p className="a2s-body">{profile.summary.body}</p>
            ) : (
              <Empty>No summary yet. Create one from her call notes in the casework stages.</Empty>
            )}
          </Sheet>

          <Sheet
            title="Recent contact"
            action={
              <Link className="a2s-link" href={`/clients/${profile.id}/workflow`}>
                All contact notes
              </Link>
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
                  <span className="a2s-rail-top">
                    <span className="a2s-rail-name" style={{ fontSize: 15 }}>
                      {file.name}
                    </span>
                    <Link className="a2s-rail-meta" href={`/clients/${profile.id}/workflow`}>
                      Open
                    </Link>
                  </span>
                  <span className="a2s-dim">{file.detail}</span>
                </li>
              ))}
            </ul>
          </Sheet>

          <Sheet
            title="Plan"
            action={
              <Link className="a2s-link" href={`/clients/${profile.id}/workflow`}>
                Open plan
              </Link>
            }
          >
            <Empty>Plans are not in the database yet.</Empty>
          </Sheet>
        </div>
      </div>

      <ClientBar name={profile.name} caseRef={profile.ref} />
    </>
  );
}
