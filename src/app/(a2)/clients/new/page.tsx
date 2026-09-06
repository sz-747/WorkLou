import Link from "next/link";
import { Sheet } from "../../../../components/a2/Sheet";
import { addPerson } from "./actions";

/**
 * A2 / Add new person — notes first. The worker types while she is on the call;
 * submitting reads the notes into the structured context fields (children,
 * income, language, visa, suburb, urgency) for review, then on to finding
 * services that can help.
 */
export const dynamic = "force-dynamic";

export default async function NewPerson({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <header className="a2s-head">
        <h1>Add new person</h1>
        <p className="a2s-sub">
          Type what she tells you. We read it into her details, then find services that fit.
        </p>
      </header>

      <div className="a2s-btn-row" style={{ marginBottom: 20 }}>
        <Link className="a2s-matte a2s-btn a2s-btn-sm" href="/clients">
          Back to people
        </Link>
      </div>

      <Sheet note="Nothing is final: you review every extracted detail before it is used.">
        <form action={addPerson} className="a2s-form">
          {error && <p className="a2s-form-error">{error}</p>}

          <label className="a2s-form-row">
            <span className="a2s-spotlight-label">Her name</span>
            <input
              className="a2s-field"
              name="name"
              required
              autoComplete="off"
              placeholder="First name is enough"
            />
          </label>

          <label className="a2s-form-row">
            <span className="a2s-spotlight-label">Call notes</span>
            <textarea
              className="a2s-field"
              name="notes"
              rows={12}
              required
              placeholder="What she said, in your words. Where she is, who is with her, children, pets, income, visa, languages, how it is safe to contact her."
            />
          </label>

          <div className="a2s-btn-row">
            <button type="submit" className="a2s-btn-primary a2s-matte">
              Read notes into her details
            </button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
