# Implementation Plan — Lou's Place Casework Workflow Tool

## Stack

- Next.js fullstack (App Router, React, API routes) — one app to run and demo.
- Postgres via **Drizzle** (decided — lighter, closer to SQL, enough for this hackathon).
- Docker compose in the dev environment: app + postgres.
- LLM via existing secrets `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`.

## Proposed Postgres schema (simplest that supports the demo and future migration)

> **Status: IMPLEMENTED in Phase 1** — Drizzle schema in `src/db/schema.ts`, pushed via `drizzle-kit push`, seeded by `src/db/seed.ts`, tested by `src/db/test.ts` (21/21 pass).

Core idea: `services` + `service_attributes` (structured facts, each carrying provenance/freshness) keep service knowledge; `cases` + `case_contexts` keep lightweight case context; `referrals` + `case_documents` keep activity and outputs; `discovery_candidates` supports process B.

### services
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | |
| organisation | text | |
| description | text | summary |
| status | text check | active / needs_review / inactive |
| website | text | |
| phone | text | |
| email | text | |
| address | text | |
| catchment | text | area served |
| source_type | text | excel_import / catalogue / discovery_review / manual |
| source_name | text | e.g. "Lous Place Excel v3" |
| source_url | text | |
| created_at / updated_at | timestamptz | |

### service_attributes — structured, deterministic-matchable facts, each with provenance + freshness
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| service_id | uuid fk → services | |
| attr_type | text check | need / eligibility / delivery / cost / wait_time / language / access |
| key | text | e.g. `min_age`, `gender`, `need`, `format` |
| value | text | structured scalar or short token (e.g. `16`, `female`, `housing`, `in_person`) |
| source_type | text | machine (website / registry) / excel_import / provider_confirmed / manual |
| source_name / source_url | text | provenance |
| retrieved_at | timestamptz | when the machine got it |
| verification_status | text check | verified_machine / needs_provider_confirmation / stale |
| confirmed_by / confirmed_at | text / timestamptz | provider confirmation, when human |
| notes | text | |

Matching (Phase 3) is plain SQL over typed rows: e.g. `attr_type='need' AND value='housing'`, `key='visa' AND value = context->>'visa'`. No LLM in this path.

### cases
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| client_ref | text | pseudonymous reference, no PII |
| original_notes | text | rough notes as entered |
| status | text | open / closed |
| created_at | timestamptz | |

### case_contexts — lightweight structured context, versioned
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| case_id | uuid fk → cases | |
| version | int | supersede rather than mutate |
| context | jsonb | needs[], suburb/catchment, children, pets, income, visa, languages[], urgency, safety/preferences, safe_contact_method, short summary (gender dropped for now; refine with Lou's actual list later) |
| status | text check | draft / approved |
| extraction_model | text | provenance of the extraction |
| approved_at | timestamptz | set when worker approves |

### referrals
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| case_id | uuid fk → cases | |
| context_id | uuid fk → case_contexts | the approved context used |
| service_id | uuid fk → services | |
| draft_text | text | generated, then worker-edited |
| status | text check | draft / approved / sent / responded / closed |
| sent_at | timestamptz | worker marks sent — never automatic |
| follow_up_due | date | |
| outcome | text | accepted / declined / no_response / other |
| outcome_notes | text / timestamptz | response/outcome recorded in step 5 |

### case_documents
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| case_id | uuid fk → cases | |
| draft_text | text | drafted from original notes + referral activity |
| status | text check | draft / approved |
| created_at / approved_at | timestamptz | |

### discovery_candidates — process B queue (Phase 7)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name / source_url / source_name | text | where found |
| dedup_key | text | normalised name+location hash |
| extracted_data | jsonb | candidate structured data |
| status | text check | pending_review / merged / rejected |

The updater (process A) writes new rows or refreshes `service_attributes` with `source_type=machine`, `retrieved_at`, and `verification_status` — it never deletes history a human has confirmed.

## Data flow

1. **Notes → Context (Phase 2):** worker enters rough notes → LLM extracts structured context (draft) → worker reviews/edits → approved `case_contexts` row (versioned).
2. **Context → Find support (Phase 3):** approved context is turned into a deterministic SQL query over `service_attributes` → matches ranked with per-fact evidence (source, retrieved_at / confirmed_at).
3. **Find → Verify (Phase 4):** for shortlisted services, machine-accessible sources are re-fetched → `service_attributes` refreshed (freshness updated) → facts that genuinely require the provider are flagged `needs_provider_confirmation` → worker's provider confirmation is recorded (confirmed_by/confirmed_at) or the worker marks them unconfirmed.
4. **Verify → Refer (Phase 5):** approved context + chosen service + verified facts → LLM drafts referral text using **only** stored facts → worker edits → worker marks `sent` (never automatic).
5. **Refer → Follow up + document (Phase 6):** referral response/outcome recorded on `referrals` → LLM drafts case documentation from original notes + referral activity → worker reviews/approves `case_documents`.
6. **Updater (Phase 7A):** re-fetch machine-accessible sources for known services → refresh facts + freshness; staleness visible in Find results.
7. **Discovery (Phase 7B):** find new candidate services → dedupe (`dedup_key` against `services` + existing candidates) → extract candidate structured data → queue in `discovery_candidates` → human review → on approval, insert `services` + `service_attributes`.

## Principles baked into the schema

- Never invent service facts: only `service_attributes` rows (each with provenance) feed drafts and displays.
- Future migration: the `services` + `service_attributes` design is Lou's future canonical service database; the Excel import is just one `source_type`.
- Avoid overengineering: no multi-tenancy, no auth for the hackathon, JSONB only for case context and candidate extraction output.

## Decisions (all decided 2026-09-05)

1. **ORM: Drizzle** — lighter, closer to SQL, enough for this hackathon.
2. **Sources:** build data from real Lou's Excel + public service pages, but snapshot them into deterministic fixtures for the demo — live websites can't break it.
3. **Needs taxonomy (initial, refine later with Lou's actual list):** housing/accommodation, DFV/safety, mental health/counselling, financial, legal, AOD, immigration/visa, children/family, health, employment, food/basic needs.
4. **Case-context fields:** needs, suburb/catchment, children, pets, income, visa, languages, urgency, safety/preferences, safe-contact method, short summary. Gender dropped for now.
5. **Auth:** none — single caseworker for the hackathon.
