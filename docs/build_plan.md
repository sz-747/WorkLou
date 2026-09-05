# Build Plan — Lou's Place Casework Workflow Tool

Stack: **Next.js fullstack** (React + API routes) + **Postgres via Drizzle**, run in Docker compose in the dev environment.

One phase per workflow step. Each phase gets its own branch from latest `main`, per `AGENTS.md`. Status: **NOT STARTED / IN PROGRESS / COMPLETE**. A phase is COMPLETE only after the user has manually tested it and merged the branch.

| # | Phase | Scope | Acceptance criteria | Status |
|---|-------|-------|---------------------|--------|
| 0 | Docs scaffolding | `docs/` structure + `AGENTS.md` session rules | Files exist; rules recorded | COMPLETE |
| 1 | Foundation | Next.js app boots; Postgres up in compose; schema migrated; synthetic seed data (services, service attributes with provenance, cases) | App runs; DB migrated; a minimal screen lists seeded services with their freshness/source | IN PROGRESS — built and automated-tested; awaiting user manual test + merge |
| 2 | Context | Rough notes → LLM extraction → lightweight structured case context → worker reviews/edits/approves | Notes entered produce a draft context; worker approves; approved context stored (versioned, linked to notes) | NOT STARTED |
| 3 | Find support | Deterministic structured query of service database using approved context; results with evidence + freshness | Approved context returns suitable services; each result shows which criteria matched, the source, and last-verified date; no LLM in the match path | NOT STARTED |
| 4 | Verify | Auto-resolve everything available from machine-accessible sources; flag only facts that genuinely need provider confirmation; record provider confirmations | Verification run updates fact freshness/status with timestamps; only genuinely-needs-human items are flagged; human confirmations are stored with who/when | NOT STARTED |
| 5 | Refer | Generate factual referral draft from approved context + chosen service; worker reviews/edits; worker marks it sent | Referral draft generated from approved data only; worker edits and marks sent; referral status history stored; no autonomous sending | NOT STARTED |
| 6 | Follow up + document | Track referral response/outcome; draft case documentation from original notes + referral activity; worker reviews/approves | Outcome recorded per referral; documentation draft produced and approvable; drafts traceable to source notes/activity | NOT STARTED |
| 7 | Service-data process stubs | A: existing-service updater (refresh known services from machine-accessible sources). B: new-service discovery (find, dedupe, extract candidate structured data, queue for review) | Both runnable on demand; updater refreshes fact freshness; discovery queues deduplicated candidates for human review; nothing auto-applied without review | NOT STARTED |

## Phase rules

- Per `AGENTS.md`: start from latest main, read all four docs, work only the requested phase, do not start the next phase.
- At session end: test, update docs, give the user short manual test steps.
- Phase status changes to IN PROGRESS when its branch starts, COMPLETE only after user testing + merge.
