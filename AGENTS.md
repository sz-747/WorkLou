# AGENTS.md — Branch/Session Rules

These rules apply to every new branch/session on this repository. Follow them exactly.

## Session start

1. **Start from the latest main.** Every new branch is cut from the current `main`. Do not continue stale work from an old branch.
2. **Do not rebuild from memory or chat history.** The docs are the source of truth, not what you remember.
3. **Read these files before doing any work:**
   - `docs/product.md` — what the product is
   - `docs/build_plan.md` — the phases and their scope
   - `docs/implementation_plan.md` — technical detail for the current phase
   - `docs/implementation_logs.md` — what has been built so far, and how it was verified

## During the session

4. **Work only on the requested phase.** Do not start the next phase, even if it seems trivial or obviously follows.
5. **Keep changes minimal.** Change only what the requested phase requires.

## Session end

6. **Test what you built.** Verify the work end-to-end before reporting done.
7. **Update the docs.** Record what was built and any decisions made (implementation logs, plan status).
8. **Provide short manual test steps.** The user will test personally before merging the branch to main.

## Project commands (Lou's Place casework tool)

- Start stack: `docker compose -f docker-compose.base44.yml up -d` (db + one-shot setup [npm install → drizzle-kit push → seed, idempotent] + web on port 3000)
- DB tests: `docker compose -f docker-compose.base44.yml exec -T web npm run db:test` (creates + cleans up its own rows). Suites under `src/db/test*.ts` share one database — always run them sequentially, never in parallel (a parallel run once raced and left stray rows + FK errors).
- Fresh seed: `docker compose -f docker-compose.base44.yml exec -T web npm run db:seed` (skips if already seeded)
- Direct DB: `docker compose -f docker-compose.base44.yml exec db psql -U lou -d lousplace`; Postgres is also exposed on host port 5432 (dev-only creds: lou / lou_dev_only, db lousplace)
- `drizzle-kit push` (not generate/migrate) keeps the DB in sync — schema source of truth is `src/db/schema.ts`
- Updater (Phase 7A): run on demand with `curl -X POST "http://localhost:3000/api/updater/run?trigger=manual"` (or the Admin button); an hourly `updater-cron` compose sidecar calls the same endpoint with `trigger=scheduled`. Runs are idempotent — safe to trigger repeatedly. Bright Data scraping needs `BRIGHT_DATA_API_KEY`/`BRIGHT_DATA_DATASET_ID` env (optional; fixtures/direct sources work without).
- Source-of-truth docs live in `docs/` — read all four before any work (see Session start rules)

## Verification checklist (before reporting done)

- [ ] Branched from latest main
- [ ] Read all four docs files before starting
- [ ] Only the requested phase was touched
- [ ] Work was tested
- [ ] Docs updated
- [ ] Manual test steps written out for the user
