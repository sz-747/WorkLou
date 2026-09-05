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
| 5 | Refer | Generate factual referral draft from approved context + chosen service; worker reviews/edits; worker marks it sent | Referral draft generated from approved data only; worker edits and marks sent; referral status history stored; no autonomous sending | IN PROGRESS |
| 6 | Follow up + document | Track referral response/outcome; draft case documentation from original notes + referral activity; worker reviews/approves | Outcome recorded per referral; documentation draft produced and approvable; drafts traceable to source notes/activity | IN PROGRESS (step 5A follow-up done: status/follow-up date/timeline, provider responses, outcomes incl. support received distinguishable, follow-up drafts for review, due follow-ups in My Work; step 5B documentation done: case note drafted from stored notes/context/referrals/confirmations/follow-up activity with Woman said / Current concerns / Actions taken / Referrals / Worker observations / Next steps sections, worker edits + approves, original notes preserved beside drafts; awaiting user manual test) |
| 6b | Caseworker end-to-end integration | Run the full workflow end to end on one clean synthetic demo scenario; fix broken state transitions, duplicate data, navigation errors, persistence issues; document exact demo steps + expected DB changes (`docs/demo_walkthrough.md`) | Full workflow runs Context → Find support → Verify → Refer → Follow up + document on one clean scenario; all state DB-backed and persistent; duplicate referrals blocked; demo steps + expected DB changes documented | IN PROGRESS (hardening done: field_sources tags no longer dropped on draft save — dead-code persistence bug fixed; duplicate-referral guard added; silent no-op errors surfaced on referral edit/mark-sent; clean demo scenario run end to end, demo state in DB, walkthrough documented; awaiting user manual test) |
| 7 | Service-data process stubs | A: existing-service updater (refresh known services from machine-accessible sources). B: new-service discovery (find, dedupe, extract candidate structured data, queue for review) | Both runnable on demand; updater refreshes fact freshness; discovery queues deduplicated candidates for human review; nothing auto-applied without review | NOT STARTED |

## Phase rules

- Per `AGENTS.md`: start from latest main, read all four docs, work only the requested phase, do not start the next phase.
- At session end: test, update docs, give the user short manual test steps.
- Phase status changes to IN PROGRESS when its branch starts, COMPLETE only after user testing + merge.
