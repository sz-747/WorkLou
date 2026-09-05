# Implementation Logs — Lou's Place Casework Workflow Tool

Append-only. New entries at the TOP (below this header block). Never edit or delete past entries.

## Entry format

```
## YYYY-MM-DD — Phase N: <name>
- Branch: <branch name>
- Changes: <what changed>
- DB changes: <migrations / seed changes / none>
- Tests run: <what was tested and how>
- Result: <pass / pass with notes / fail>
- Known issues: <anything outstanding>
- Next phase: <what comes next>
```

---

## 2026-09-05 — Phase 2 fix: Server Actions origin guard (correct config path) + full browser verification

- Branch: `setup-branching-rules`
- Changes: the earlier origin fix was in the wrong config location — `experimental.allowedOrigins` is ignored by the action CSRF check; the correct path is `experimental.serverActions.allowedOrigins` (read from `node_modules/next/dist/server/app-render/action-handler.js` + `csrf-protection.js`: single `*` matches exactly one subdomain label, so both `*.base44-preview.app` and `*.imported.base44-preview.app` are listed)
- DB changes: none
- Tests run: full live-preview walkthrough — rough notes entered → "Extract draft context" → **Draft v2 — not approved (extracted by google/gemini-2.5-flash)** rendered editable (Ashfield / housing_accommodation / 1 child / high / email / student visa all correctly extracted); worker edited suburb and saved (persisted); clicked Approve; hard reload shows **Context v2 approved** with timestamp; Postgres shows v2 approved with the edited value and the seeded v1 draft untouched; 0 console errors; `db:test` and `db:test:context` suites remain green (21/21, 24/24)
- Result: pass — all Phase 2 acceptance criteria verified in the browser and DB
- Known issues: none outstanding for Phase 2
- Next phase: awaiting user manual test of Phase 2; then Phase 3 — Find support

## 2026-09-05 — Phase 2: Context (notes → draft → review → approve)

- Branch: `setup-branching-rules`
- Changes: Context stage built out in the case workspace (`src/app/women/[id]/ContextStage.tsx` + server actions `src/app/women/[id]/actions.ts`): notes form saves raw notes on the case and runs LLM extraction (`src/lib/extraction.ts` — OpenAI-compatible chat call via LLM_BASE_URL/LLM_API_KEY/LLM_MODEL, `parseExtraction` pure normaliser mapping to the CaseContext jsonb shape with needs-taxonomy tokens); extraction ALWAYS inserts a new draft version (max+1) with extraction_model provenance; draft review form is editable and clearly marked "Draft — not approved"; Save changes updates only the draft row; Approve flips draft → approved with approved_at (draft-only guard — approved rows are never modified); approved state renders read-only; extraction failures show a page error and insert nothing. Also: `next.config.ts` gained `experimental.allowedOrigins` for the Base44 preview proxy (dev-mode Server Actions guard aborts action POSTs whose origin ≠ x-forwarded-host — proxy-origin mismatch, not app logic); LLM_MODEL secret corrected to OpenRouter model ID `google/gemini-2.5-flash` (was display name "Gemini 2.5 Flash" → HTTP 400); standalone latest-context table on the case page folded into the Context stage
- DB changes: none (no schema changes; existing cases.original_notes + versioned case_contexts reused as designed)
- Tests run: `npm run db:test:context` — 24/24 passed (parseExtraction normalisation incl. fenced/prose JSON, taxonomy tokens, unknown-needs kept; DB flow: notes persist → draft v1 → in-place edit → approve with timestamp → draft-only guard leaves approved row untouched → re-extract creates v2 draft, v1 intact → reload shows latest with correct status; cleanup); `npm run db:test` re-run 21/21; live LLM smoke test via `extractContextFromNotes` returned correctly structured context (model google/gemini-2.5-flash)
- Result: pass with notes — automated + live-LLM verified; browser click-through of the form flow NOT yet re-verified after the Server Actions origin fix (first two attempts were blocked by stale action bindings after a service restart, then by the origin guard itself) — left as the user manual test
- Known issues: preview proxy origin differs from sandbox host, so Server Actions in dev need `experimental.allowedOrigins` (done; delete if deploying behind a same-origin host); seeded v1 draft is a placeholder until the user runs a real extraction
- Next phase: awaiting user manual test of Phase 2 (click-through steps provided); then Phase 3 — Find support — NOT started

## 2026-09-05 — Phase 1b: Minimal caseworker shell

- Branch: `setup-branching-rules`
- Changes: sparse app shell with nav (My Work / Women / Data check); `/` = My Work (case list, no metrics dashboard); `/women` = women/case list from DB; `/women/[id]` = case workspace loading case header, original notes, latest context version, referrals, and the five workflow stages (Context → Find support → Verify → Refer → Follow up + document) as stub sections; Phase 1 verification page moved to `/data`; no workflow logic built
- DB changes: none (no schema changes)
- Tests run: all routes curl-tested — `/`, `/women`, `/data`, `/women/[seeded id]` return 200, unknown id 404s; preview click-through My Work → Women → case workspace verified (case loads with client ref, draft context pill, all five stage sections; 0 console errors)
- Result: pass — navigation, case loading, and DB-backed state proven; UI intentionally sparse
- Known issues: one dev-only fix mid-build (`women/page.tsx` import path); none outstanding
- Next phase: Phase 2 — Context (LLM extraction) — NOT started; awaiting user manual test of Phases 1/1b

## 2026-09-05 — Phase 1 fix: distinct provider-confirmed status

- Branch: `setup-branching-rules`
- Changes: added `provider_confirmed` as a distinct `service_attributes.verification_status` value (was conflated with `verified_machine`); schema check extended, seed's provider-confirmed facts (New Dawn, Harbour referral_required) now use the new status, confirmation-recording test asserts the distinct status, verification page shows distinct badges (green provider-confirmed vs blue machine-verified)
- DB changes: check constraint altered to include `provider_confirmed` (drizzle-kit push did not detect the check-constraint diff, so applied via SQL — known drizzle-kit limitation for this change type); 4 existing confirmed rows migrated `verified_machine` → `provider_confirmed`
- Tests run: full `npm run db:test` re-run — 21/21 passed
- Result: pass — page shows machine-verified (blue) and provider-confirmed (green) distinctly; 0 console errors
- Known issues: drizzle-kit push does not diff check-constraint changes; if a check is altered again, apply the `ALTER TABLE` manually
- Next phase: awaiting user manual test of Phase 1; Phase 2 not started

## 2026-09-05 — Phase 1: Database foundation

- Branch: `setup-branching-rules`
- Changes: Next.js fullstack skeleton (App Router) + Postgres 16 in `docker-compose.base44.yml`; Drizzle schema `src/db/schema.ts` (services, service_attributes, cases, case_contexts, referrals, case_documents, discovery_candidates — per approved plan, no redesign); idempotent seed `src/db/seed.ts` (5 services with mixed provenance — excel_import / machine / provider_confirmed, 20 service_attributes incl. needs_provider_confirmation + stale facts, 1 synthetic woman/case with draft context); minimal data-verification page `src/app/page.tsx`; relationship/query tests `src/db/test.ts`
- DB changes: initial schema via `drizzle-kit push` (check constraints + indexes per plan); synthetic seed
- Tests run: `npm run db:test` — 21/21 passed: create/read/update across service→attribute, case→context→referral joins, referral status progression (draft→approved→sent with sent_at), provider confirmation recording, outcome update, deterministic need query with provenance/freshness, jsonb context query, discovery dedup, cleanup with cascade check
- Result: pass — app serves on port 3000 under external preview host; preview renders seeded data with source/status badges, 0 console errors, 0 failed requests
- Known issues: seed provenance values are synthetic placeholders (real Excel/page snapshots not yet imported — by design for Phase 1); Postgres exposed on host port 5432 for external inspection (dev-only credentials)
- Next phase: Phase 2 — Context (LLM extraction) — NOT started; awaiting user manual test of Phase 1

## 2026-09-05 — Design decisions locked (pre-Phase 1)

- Branch: `setup-branching-rules`
- Changes: recorded the five design decisions in `docs/implementation_plan.md` (Drizzle ORM; real Excel/public-page data snapshot into deterministic fixtures; initial needs taxonomy; case-context fields with gender dropped; no auth / single caseworker)
- DB changes: none
- Tests run: reviewed plan for consistency (stack, context fields, matching examples)
- Result: pass
- Known issues: needs taxonomy is a placeholder until refined with Lou's actual list
- Next phase: Phase 1 — Foundation (Next.js + Postgres + Drizzle schema + snapshot-fixture seed)

## 2026-09-05 — Phase 0: Project memory

- Branch: `setup-branching-rules`
- Changes: Wrote project memory docs: product definition, phased build plan (phases 1–7, one per workflow step), implementation plan with proposed Postgres schema and data flow, and this log format.
- DB changes: none
- Tests run: verified all four docs render as valid Markdown; schema tables cross-checked against the five-step workflow and the two long-term service-data processes
- Result: pass with notes — schema, phase list, and open decisions presented to the user for review before any implementation
- Known issues: none
- Next phase: Phase 1 — Foundation (Next.js + Postgres + schema + synthetic seed) — awaiting user decisions on ORM, sources, needs taxonomy, context fields, and auth scope

## 2026-09-05 — Phase 0: Docs scaffolding

- Branch: `setup-branching-rules`
- Changes: Created `docs/` structure (product.md, build_plan.md, implementation_plan.md, implementation_logs.md) and `AGENTS.md` with the branch/session rules.
- DB changes: none
- Tests run: verified all five files exist and render as valid Markdown
- Result: pass
- Known issues: none
- Next phase: fill docs with real project content
