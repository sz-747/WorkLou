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
