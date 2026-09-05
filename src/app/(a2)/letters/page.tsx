import { RailRow, Sheet } from "../../../components/a2/Sheet";
import { LETTERS_TO_WRITE } from "../../../lib/a2-mock";

/**
 * Letters. The Figma canvas has no dedicated Letters frame, so this is the
 * Today rail's "Letters to write" sheet on its own page, using the same
 * sheet/row recipe rather than inventing new design language.
 */
export default function Letters() {
  return (
    <>
      <header className="a2s-head">
        <h1>Letters</h1>
        <p className="a2s-sub">{LETTERS_TO_WRITE.length} drafts waiting</p>
      </header>

      <div className="a2s-grid">
        <Sheet title={`Letters to write · ${LETTERS_TO_WRITE.length}`}>
          <ul className="a2s-rail-rows">
            {LETTERS_TO_WRITE.map((letter) => (
              <RailRow
                key={letter.name}
                name={letter.name}
                meta={letter.meta}
                detail={letter.detail}
              />
            ))}
          </ul>
        </Sheet>
      </div>
    </>
  );
}
