# Build Plan — Lou's Place Casework Workflow Tool

Stack: **Next.js fullstack** (React + API routes) + **Postgres via Drizzle**, run in Docker compose in the dev environment.

One phase per workflow step. Each phase gets its own branch from latest `main`, per `AGENTS.md`. Status: **NOT STARTED / IN PROGRESS / COMPLETE**. A phase is COMPLETE only after the user has manually tested it and merged the branch.

| # | Phase | Scope | Acceptance criteria | Status |
|---|-------|-------|---------------------|--------|
| 0 | Docs scaffolding | `docs/` structure + `AGENTS.md` session rules | Files exist; rules recorded | COMPLETE |
| 1 | Foundation | Next.js app boots; Postgres up in compose; schema migrated; synthetic seed data (services, service attributes with provenance, cases) | App runs; DB migrated; a minimal screen lists seeded services with their freshness/source | COMPLETE |
| 1b | Caseworker shell | My Work (sparse home), Women list, case workspace with the five workflow stages as stubs; DB-backed case loading, no workflow logic | All routes load; Women lists the seeded case; opening it shows case header, latest context, and the five stage sections (Context → Find support → Verify → Refer → Follow up + document) | COMPLETE |
| 2 | Context | Rough notes → LLM extraction → lightweight structured case context → worker reviews/edits/approves | Notes entered produce a draft context; worker approves; approved context stored (versioned, linked to notes) | COMPLETE |
| 3 | Find support | Deterministic structured query of service database using approved context; results with evidence + freshness | Approved context returns suitable services; each result shows which criteria matched, the source, and last-verified date; no LLM in the match path | COMPLETE |
| 4 | Verify | Auto-resolve everything available from machine-accessible sources; flag only facts that genuinely need provider confirmation; record provider confirmations | Verification run updates fact freshness/status with timestamps; only genuinely-needs-human items are flagged; human confirmations are stored with who/when | COMPLETE |
| 5 | Refer | Generate factual referral draft from approved context + chosen service; worker reviews/edits; worker marks it sent | Referral draft generated from approved data only; worker edits and marks sent; referral status history stored; no autonomous sending | COMPLETE |
| 6 | Follow up + document | Track referral response/outcome; draft case documentation from original notes + referral activity; worker reviews/approves | Outcome recorded per referral; documentation draft produced and approvable; drafts traceable to source notes/activity | COMPLETE |
| 6b | Caseworker end-to-end integration | Run the full workflow end to end on one clean synthetic demo scenario; fix broken state transitions, duplicate data, navigation errors, persistence issues; document exact demo steps + expected DB changes (`docs/demo_walkthrough.md`) | Full workflow runs Context → Find support → Verify → Refer → Follow up + document on one clean scenario; all state DB-backed and persistent; duplicate referrals blocked; demo steps + expected DB changes documented | COMPLETE |
| 7 | Service-data process stubs | A: existing-service updater (refresh known services from machine-accessible sources). B: new-service discovery (find, dedupe, extract candidate structured data, queue for review) | Both runnable on demand; updater refreshes fact freshness; discovery queues deduplicated candidates for human review; nothing auto-applied without review | COMPLETE |
| 8 | Excel migration compatibility | Lou's existing service list (CSV from Excel) feeds the canonical schema without forced cutover: upload → staging (original values verbatim) → human per-row import/discard; non-destructive merge; canonical directory exports back to CSV | Upload stages rows with originals preserved and match status shown; matched rows only fill empty fields / add missing need facts (existing values never overwritten); new rows create services with excel provenance (needs flagged for provider confirmation); `GET /api/services/export` returns the canonical directory as CSV; decided rows never re-decided | COMPLETE |
| 9 | Final demo hardening | Integration + reliability only, no new product features: full five-step flow re-run from fresh state with DB-write inspection at every stage, admin-correction → caseworker propagation, updater/discovery/Excel demo paths, synthetic-data/no-transmission/no-invented-facts audit, failure/empty-state review, dead-code removal, docs brought to a "new chat can understand" state | All paths verified live or by green suites; dead demo-only code removed; all four docs state what is complete, schema, workflow, limitations, demo steps, next steps | COMPLETE |

**All original build phases were completed and verified. The Admin interface was removed on 2026-09-06.** The 11 remaining database suites pass with 260 checks, and the production build passes. Run database suites sequentially; see `AGENTS.md`.

## Known limitations (hackathon build)

- **No auth**: single caseworker, no user management.
- **No service-maintenance interface**: the `/admin` routes and Admin editing tools were removed. Updater and discovery runs can still queue changes, but the app cannot review or apply those candidates. Spreadsheet import/review also has no app screen; CSV export remains available.
- **Minimal UX** — functional screens only; the case workspace is one long page of stage sections.
- **Demo data is synthetic** — 7 canonical services (5 seeded synthetic + Women's Housing Company merged from a live discovery candidate + Riverstone from the Excel demo import); the case ("Amira", CASE-2026-001) is synthetic.
- **Updater sources are fixtures for the seeded services** (`src/lib/sources.ts`, example.org snapshots); non-fixture `https://` sources are direct-fetch only — a provider page that blocks fetching is logged as a source failure (no Web Unlocker in the demo).
- **Discovery hits the live web** (Bright Data SERP) — candidates queue for human review; nothing auto-applies. Results vary run to run.
- **Scheduling bridge prepared, not yet activated in Base44** — local compose sidecars remain available; two native Base44 wrapper functions and inactive daily automation configs are ready for the Base44 manual-run check. Both HTTP routes require `SCHEDULER_SECRET`.
- **Referral/follow-up "sent" is a DB state only** — the tool never transmits anything (by design; also a limitation if you expected integrations).
- **Matching needs a full taxonomy alignment pass with Lou's actual service list** before production data entry.

## Recommended next steps (post-hackathon)

1. **Auth + roles** before any real client-adjacent data.
2. **Real service data migration**: run the Excel import on Lou's actual list; reconcile needs taxonomy (`docs/product.md` decision #3) with Lou's categories.
3. **Updater on real sources**: keep blocked provider pages as logged source failures for the demo; schedule the existing updater and discovery processes via the platform scheduler once published.
4. **UX pass** on the case workspace (stage navigation and mobile).
5. **Outcome analytics**: referral outcomes accumulate — surface "which services actually deliver support" in Find support.
6. **Case-list ergonomics**: multiple concurrent cases, search, and closed-case handling.

## Phase rules

- Per `AGENTS.md`: start from latest main, read all four docs, work only the requested phase, do not start the next phase.
- At session end: test, update docs, give the user short manual test steps.
- Phase status changes to IN PROGRESS when its branch starts, COMPLETE only after user testing + merge.
