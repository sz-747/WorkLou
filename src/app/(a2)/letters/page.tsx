import { RailRow, Sheet } from "../../../components/a2/Sheet";
import { Empty } from "../../../components/a2/Empty";
import { getLetterRows } from "../../../lib/a2/letters";

/**
 * Letters. The Figma canvas has no dedicated Letters frame, so this is the
 * Today rail's "Letters to write" sheet on its own page, using the same
 * sheet/row recipe rather than inventing new design language.
 * Data: Phase 6 case documents (drafts and approved letters).
 */
export const dynamic = "force-dynamic";

export default async function Letters() {
  const letters = await getLetterRows();
  const drafts = letters.filter((letter) => letter.meta === "Draft");

  return (
    <>
      <header className="a2s-head">
        <h1>Letters</h1>
        <p className="a2s-sub">
          {letters.length} letter{letters.length === 1 ? "" : "s"} · {drafts.length} draft
          {drafts.length === 1 ? "" : "s"} waiting
        </p>
      </header>

      <div className="a2s-grid">
        <Sheet title={`Letters · ${letters.length}`}>
          {letters.length === 0 ? (
            <Empty>No letters yet. Drafting one from a case adds it here.</Empty>
          ) : (
            <ul className="a2s-rail-rows">
              {letters.map((letter) => (
                <RailRow
                  key={letter.key}
                  name={letter.name}
                  meta={letter.meta}
                  detail={letter.detail}
                />
              ))}
            </ul>
          )}
        </Sheet>
      </div>
    </>
  );
}
