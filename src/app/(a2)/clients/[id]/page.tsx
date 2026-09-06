import Link from "next/link";
import { notFound } from "next/navigation";
import { Sheet } from "../../../../components/a2/Sheet";
import { ClientBar } from "../../../../components/a2/ClientBar";
import { QuickExit } from "../../../../components/a2/QuickExit";
import { Empty } from "../../../../components/a2/Empty";
import { getClientProfile } from "../../../../lib/a2/clients";

/**
 * A2 / Profile · Maya (136:217) with quick exit (153:45), driven by real case
 * data. The plan sheet stays a placeholder until plans exist in the schema.
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
        <div>
          <h1>{profile.ref}</h1>
          <p className="a2s-sub" style={{ fontSize: 14, margin: "4px 0 0" }}>
            {profile.subline}
          </p>
        </div>
      </div>

      {profile.chips.length > 0 && (
        <div className="a2s-chips" style={{ marginBottom: 14 }}>
          {profile.chips.map((chip) => (
            <span className="a2s-chip" key={chip}>
              {chip}
            </span>
          ))}
        </div>
      )}

      <div className="a2s-btn-row" style={{ marginBottom: 8 }}>
        <QuickExit />
        <Link className="a2s-matte a2s-btn" href={`/clients/${profile.id}/workflow`}>
          Casework stages
        </Link>
        <Link className="a2s-matte a2s-btn a2s-btn-sm" href="/letters">
          Letters
        </Link>
      </div>
      <p className="a2s-dim" style={{ marginBottom: 24 }}>
        Quick exit opens her escape plan in one click.
      </p>

      <div className="a2s-grid">
        <div>
          <Sheet title="Summary profile" note={profile.summary.checked}>
            {profile.summary.body ? (
              <p className="a2s-body">{profile.summary.body}</p>
            ) : (
              <Empty>No context summary yet. Extract a context from the case notes.</Empty>
            )}
          </Sheet>

          <Sheet title="Plan">
            <Empty>Plans are not in the database yet.</Empty>
          </Sheet>

          <Sheet title="Files" note="by type · newest first">
            <ul className="a2s-rail-rows">
              {profile.files.map((file) => (
                <li key={file.name}>
                  <span className="a2s-rail-top">
                    <span className="a2s-rail-name" style={{ fontSize: 15 }}>
                      {file.name}
                    </span>
                  </span>
                  <span className="a2s-dim">{file.detail}</span>
                </li>
              ))}
            </ul>
          </Sheet>

          <Sheet title="Recent contact">
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
        </div>

        <div className="a2s-rail">
          <Sheet title="Referrals in flight">
            {profile.referrals.length === 0 ? (
              <Empty>No referrals for this case yet.</Empty>
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

          <Sheet title={`Needs attention · ${profile.ref}`}>
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
        </div>
      </div>

      <ClientBar />
    </>
  );
}
