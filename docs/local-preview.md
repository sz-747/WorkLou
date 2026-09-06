# Local review workflow

The current review branch is `codex/local-preview`. It starts from main and includes `backend-skeleton-setup` through `cb89593`, including the existing glossy A2 interface and latest Today/Follow-ups changes. The older deployment-preparation branch is separate.

Run with Node 22 and PostgreSQL 16 installed:

```sh
npm ci
npm run local
```

Open http://localhost:3000/today for the current design. The root `/` remains the older My Work screen. Review Today → People → Amira → Plan/workflow, Follow-ups, Letters, and Shelters. Empty follow-ups and letters are expected in the initial synthetic seed.

The launcher creates a dedicated local database on loopback port 55433. Data and logs persist under ignored `.local/`; it never connects to Base44 or a production database. Startup applies the schema to this local database and runs the existing idempotent seed. PostgreSQL remains running when the preview stops. Stop it with `pg_ctl -D "$PWD/.local/postgres" stop` (or use the full PostgreSQL bin path).

Optional environment variables: `WORKLOU_PG_BIN` (PostgreSQL bin directory), `WORKLOU_DB_PORT` (database port), and `WORKLOU_PORT` (web port). Choose a different database port for a second simultaneous checkout. `npm run local:setup` prepares the database without starting the web server.

Live extraction/drafting needs `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` in ignored `.env.local`. Discovery also needs Bright Data configuration. The initial preview has synthetic data; missing integrations must not be represented as working live AI. No credentials are committed.

Review and development happen locally, then changes are pushed to a Git branch. Base44 hosting is deferred. After this review, create a separate Figma implementation branch, integrate this reviewed baseline if it is not yet merged to main, preserve the glass styling, and check page navigation and workflow behavior as each page changes. No Figma redesign is included in this setup.
