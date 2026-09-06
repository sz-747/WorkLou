# Product — Lou's Place Casework Workflow Tool

## What this is

A workflow tool for caseworkers at Lou's Place with two connected functions:

1. **Referral navigation** — find the right support service for a client, with trustworthy, current information.
2. **Documentation** — produce case documentation with minimal duplicated effort.

## Who it's for

Lou's Place caseworkers. The tool assists the worker at every step; it never acts on its own.

## Core five-step workflow

1. **Context** — Caseworker enters rough case notes. The system extracts a lightweight structured case context. The worker reviews and approves it.
2. **Find support** — The approved context is used to query the structured service database (deterministic query, not LLM-driven). Results return suitable services with evidence and freshness.
3. **Verify** — Everything resolvable from machine-accessible sources is resolved automatically. A human only contacts the provider when the fact genuinely requires direct provider confirmation.
4. **Refer** — The system generates a factual referral draft from the approved context. The worker reviews it and marks it sent.
5. **Follow up + document** — Track response/outcome, and draft case documentation from the original notes plus referral activity, for worker review.

## Scope (hackathon version)

- Full five-step workflow with minimal functional screens (UX is not a focus yet).
- Postgres as the service database, sitting between Lou's existing Excel file and the app.
- Synthetic case data for the demo.
- Service-data processes stubbed and queueable (see below), not productionised.

## Non-goals

- No autonomous referrals or messages — the worker always sends/approves.
- No LLM-driven matching — matching/querying is deterministic and structured.
- The LLM never invents service facts — it only extracts, normalises, and drafts text for human review.
- No client-facing features, no full case management system, no auth/user management for the hackathon.

## Data principles

- Postgres is designed as Lou's **future canonical service database**, even though the hackathon version sits between their Excel file and the app.
- Keep: structured eligibility/service data, source/provenance, freshness, provider confirmations, referral status/outcomes, and lightweight case context.
- Every service fact carries source/provenance and freshness information.

## Human-vs-automation boundary

| Done by machine | Done by human |
|---|---|
| Extract structured context from notes (suggested, for review) | Approve the case context |
| Query/match services deterministically | Choose which service(s) to pursue |
| Refresh facts from machine-accessible sources | Contact a provider only when a fact genuinely requires direct confirmation |
| Draft referral and documentation text | Review, edit, and mark referrals sent; approve documentation |

## Long-term service-data processes (beyond hackathon scope, designed for now)

- **A. Existing-service updater** — refresh known service information from machine-accessible sources.
- **B. New-service discovery** — find potentially relevant new services, deduplicate them, extract candidate structured data, and queue them for review.

## Long-term institutional-memory benefit

As caseworkers use the tool, the service database accumulates verified, fresh, provenance-tagged service knowledge, and referrals accumulate outcomes. When a caseworker leaves, their knowledge of which services work, for whom, and when — stays. The tool becomes Lou's institutional memory rather than a set of individual workarounds.

## Status

- **Complete**: all phases built and verified — see `docs/build_plan.md` (all phases COMPLETE, plus known limitations and recommended next steps).
- **How to run the demo**: `docs/demo_walkthrough.md` (caseworker five-step flow on the synthetic case).
- **Schema + workflow detail**: `docs/implementation_plan.md`.

## Known limitations (hackathon build)

No caseworker sign-in or roles yet; minimal (functional) UX; synthetic demo data; no service-maintenance interface; updater runs on fixture snapshots for seeded services (direct-fetch only otherwise); discovery hits the live web and queues candidates, but those candidates cannot be reviewed in the app; the protected Base44 scheduling wrappers are prepared but must still be deployed and activated in Base44; nothing is ever transmitted to providers; matching taxonomy needs alignment with Lou's actual service list before real data entry. See `docs/build_plan.md` for the full list and recommended next steps.
