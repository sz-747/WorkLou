/**
 * Phase 5 one-time backfill: tag existing case contexts with default field
 * sources (woman-stated vs worker-observation) so stored data is
 * self-describing. Contexts that already carry field_sources are skipped.
 *
 * Default rule (mirrors src/lib/context-fields.ts legacy defaults):
 * everything is woman-stated; urgency is the caseworker's assessment.
 * Run once: npm run db:backfill-sources
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import { caseContexts, type FieldSource } from "./schema";
import { CONTEXT_FIELDS, fieldHasValue, fieldSourceOf } from "../lib/context-fields";

async function main() {
  const rows = await db.select().from(caseContexts);
  let updated = 0;
  for (const row of rows) {
    if (row.context.field_sources) continue;
    const field_sources: Record<string, FieldSource> = {};
    for (const f of CONTEXT_FIELDS) {
      if (fieldHasValue(f.key, row.context)) {
        field_sources[f.key] = fieldSourceOf(row.context, f.key);
      }
    }
    await db
      .update(caseContexts)
      .set({ context: { ...row.context, field_sources } })
      .where(eq(caseContexts.id, row.id));
    updated++;
  }
  console.log(`Backfill complete: ${updated} context(s) tagged, ${rows.length - updated} already tagged.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
