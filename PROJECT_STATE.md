# PROJECT_STATE.md

Project memory for **Lou's Place Referral Navigator**. Read this before starting work in any new
chat; treat the code, `db/init.sql`, and this file as the source of truth.

## Current product goal

A caseworker at Lou's Place types what a woman needs (in plain words, plus free-text notes taken
during the call); the tool parses that into structured criteria, ranks real community services
against them, shows why each service matched and where information is stale, and lets the caseworker
pick one. The caseworker always makes the final decision — the tool only suggests.

## Architecture

- **Next.js 15 (App Router) + TypeScript**, runs via `docker compose -f docker-compose.base44.yml up -d`.
- Services: `web` (node:22-alpine, `next dev`, port 3000, source bind-mounted), `db`
  (postgres:16-alpine, volume), `scheduler` (alpine:3.20 — every 6h POSTs to verification + eval
  endpoints). See `AGENTS.md` for env details.
- LLM: OpenAI-compatible API via `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` (platform secrets →
  `/run/base44/app.env`). ⚠️ Current `LLM_MODEL` id is invalid — everything falls back to the local
  keyword parser / extractor; fixing the model id re-enables smart parsing.

## Database (postgres:16, db/init.sql; DB name/user `referrals`)

- `services` — the directory: name, suburb, service_type, phone, hours, walk_in/appointment/referral
  flags, children_allowed, source_url, last_verified_at, verification_status.
- `source_fixtures` — saved source HTML/JSON per service for verification re-runs.
- `verification_runs` / `verification_changes` — nightly-ish re-checks: extracted values vs DB,
  changes land as `needs_review` until approved in the admin UI.
- `referral_searches` — query + **caseworker_notes** + parsed/corrected criteria + result ids +
  selected service + selection latency (audit trail / eval fodder).
- `eval_results` — automated eval runs (search + verification kinds).
- `import_runs` — CSV import history.

## Major files

| Path | Role |
|---|---|
| `app/page.tsx` | Main workspace: sticky **notes sideboard** (localStorage `call-notes`) + search UI; sends query + notes to `/api/search` |
| `app/api/search/route.ts` | Combines query + notes → parse → rank → logs to `referral_searches` |
| `app/api/search/select/route.ts` | Records chosen service + elapsed ms |
| `lib/parse.ts` | Query+notes → `Criteria` (LLM first, local keyword fallback) |
| `lib/search.ts` | Ranker: full vs partial matches with reasons + unknowns |
| `lib/llm.ts`, `lib/extract.ts`, `lib/verify.ts` | OpenAI-compatible client, page extraction, diff vs DB |
| `app/api/verification/*` | Trigger run, list/approve changes |
| `app/admin/verification`, `app/admin/services`, `app/admin/evaluation` | Admin UIs (review changes, manage services, view evals) |
| `app/services/[id]` | Public-ish service detail page |
| `lib/eval.ts` + `app/api/eval/*` | Offline evals of search + verification quality |
| `db/init.sql` | Schema + seed (26 services, sub-locality coverage, SUBURBS coords in `lib/types.ts`) |

## Completed modules

1. Search + criteria parsing (LLM w/ local fallback) + ranking with match reasons & freshness badges.
2. Service detail pages + admin service list.
3. Verification loop: scheduled re-extract from source URLs → change queue → review/approve.
4. Automated evals (search + verification) run by the scheduler every 6h.
5. CSV import pipeline (`app/api/import`).
6. **Notes sideboard**: first screen is a call-notes canvas; notes feed the parser/ranker alongside
   the query and are persisted on each search record (`caseworker_notes` column added).
7. Real-services research: `docs/community-services-research.md` — verified real Sydney services
   (WAGEC, BDVS, OzHarvest, Redfern Legal Centre, etc.) mapped row-by-row to the 26 mock seeds,
   ready to replace them when Lou's Place's real spreadsheet arrives.

## Key decisions & why

- **Local parser fallback** so the app fully works without a valid LLM model id.
- **Notes joined into the parse text** (not a separate field) — one code path for word matching.
- **Verification changes require review** — never auto-overwrite the directory; caseworker trust first.
- **Searches logged with notes + selection** — enables evals and later relevance tuning.
- Refuges keep confidential intake lines (DV Line 1800 65 64 63 / Link2home) — do NOT record refuge street addresses.

## Constraints

- Don't remove the "caseworker decides" disclaimer or the freshness/unknowns surfacing.
- Manual criteria edits must override the parser (kept in `corrected_criteria`).
- Keep services reachable on port 3000 via `docker-compose.base44.yml` (dev mode, source-mounted).
- `docs/community-services-research.md` is the reference for real service data; don't invent fake orgs.

## Known bugs / unfinished

- `LLM_MODEL` secret points to an invalid model id → smart parsing/extraction currently falls back
  to keyword-only. Fix: user sets a valid id (e.g. `google/gemini-2.5-flash`).
- Seed data is still the 26 **mock** services — replacing them with the real services from
  `docs/community-services-research.md` is not yet done.

## Next logical module

**Re-seed the directory from the real services** in `docs/community-services-research.md`
(update `db/init.sql` seed + a seed script; honour the mapping table and its caveats: confidential
addresses, phone-advice-only services, children policies). After that: hook up CSV import to
Lou's Place's real spreadsheet.
