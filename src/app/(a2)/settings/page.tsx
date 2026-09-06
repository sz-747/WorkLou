import { Sheet } from "../../../components/a2/Sheet";
import { getCaseworkerSettings } from "../../../lib/a2/caseworker-settings";
import { updateCaseworkerEmail } from "./actions";

export const dynamic = "force-dynamic";

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [{ saved, error }, settings] = await Promise.all([
    searchParams,
    getCaseworkerSettings(),
  ]);

  return (
    <>
      <header className="a2s-head">
        <h1>Settings</h1>
        <p className="a2s-sub">Email identity for Hannah Lee · Caseworker</p>
      </header>

      <div className="a2s-settings-wrap">
        <Sheet note="When Gmail is connected, the connected Gmail account performs delivery. This address appears in the referral review and signature.">
          <form action={updateCaseworkerEmail} className="a2s-form">
            <label className="a2s-form-row">
              <span className="a2s-spotlight-label">Caseworker email</span>
              <input
                className="a2s-field"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="hannah@lousplace.org.au"
                defaultValue={settings.email}
              />
            </label>
            {saved && <p className="a2s-settings-success">Email saved.</p>}
            {error && <p className="a2s-form-error">{error}</p>}
            <div className="a2s-btn-row">
              <button className="a2s-btn-primary a2s-matte" type="submit">Save email</button>
            </div>
          </form>
        </Sheet>
      </div>
    </>
  );
}
