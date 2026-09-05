# AGENTS.md

**Read `PROJECT_STATE.md` first** — it is the persistent project memory (goal, architecture,
schema, completed modules, constraints, next module). Update it after completing each module.

## Rules — always apply

**`rules.md`** (repo root) contains a five-question pre-send checklist. Run it on EVERY answer before sending. Failing one question → fix it before sending.

## Skills — always auto-invoke

The skills in `skills/` are active project instructions. Do not wait to be asked — invoke them automatically whenever their trigger condition occurs:

- **`skills/decision-surfaces/`** — run automatically BEFORE finalizing the first plan for a non-trivial new project or major feature, and again only after a material scope change or newly discovered boundary. Record material surfaces in `docs/decision-surfaces.md` and ask the user only about choices they must own.
- **`skills/ce-plan/`** — use automatically whenever the user asks to plan, break down, or deepen a change. Produce the plan artifact and stop; do not start implementation automatically.
- **`skills/ljg-plain/`** — use automatically when the user asks for a plain-language explanation ('plain', 'grok', 'explain it simply', '白话', '说人话').
- **`skills/concise-chat/`** — ALWAYS active for every chat response: get to the point, short sentences, no narration, prefer doing over explaining, stop once the message is delivered.

Skill precedence: concise-chat governs all output style; the other three trigger on their conditions above. These skills apply to every session in this repo from now on.

## Project context

This repo hosts the Lou's Place Referral Navigator MVP (Next.js App Router + PostgreSQL, provider-neutral LLM adapter). Product definition lives in `product.md`.

## How to run

`docker compose -f docker-compose.base44.yml up -d` — starts Postgres (schema + demo seed in `db/init.sql`), Next.js dev server on port 3000, and a scheduler that triggers verification every 6h. No secrets required: without LLM keys a local keyword parser (`lib/parse.ts`) and rule-based extraction (`lib/extract.ts`) are used; `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL` switch those to an OpenAI-compatible provider.

## Verify it works

- `curl -X POST localhost:3000/api/search -H 'Content-Type: application/json' -d '{"query":"Emergency accommodation tonight for a woman with two children near Redfern."}'` — should parse criteria and return Redfern/Waterloo refuges.
- `curl -X POST localhost:3000/api/verification/run` — verifies services against fixtures; differences become pending changes.
- `curl -X POST localhost:3000/api/eval/search` and `.../api/eval/verification` — real measured metrics (never hard-coded).

## Quirks

- DB seed runs only on a fresh volume: `docker compose down -v` to re-seed after changing `db/init.sql`.
- Local source fixtures (`source_fixtures` table) stand in for official service pages so verification is deterministic; real `source_url`s are fetched only when no fixture exists.
- `normHeader` in `app/api/import/route.ts` strips ALL non-alphanumerics from CSV headers — HEADER_MAP keys must be lowercase-alphanumeric (no underscores/spaces).
