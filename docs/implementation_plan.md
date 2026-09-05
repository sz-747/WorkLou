# Implementation Plan — Lou's Place Casework Workflow Tool

## Stack

- Next.js fullstack (App Router, React, API routes) — one app to run and demo.
- Postgres via **Drizzle** (decided — lighter, closer to SQL, enough for this hackathon).
- Docker compose in the dev environment: app + postgres.
- LLM via existing secrets `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`.

## Proposed Postgres schema (simplest that supports the demo and future migration)

> **Status: IMPLEMENTED in Phase 1, unchanged through final hardening** — Drizzle schema in `src/db/schema.ts`, pushed via `drizzle-kit push`, seeded by `src/db/seed.ts`, tested by `src/db/test.ts` (22/22; all 12 suites / 273 assertions green as of 2026-09-06).

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
| context | jsonb | needs[], suburb/catchment, children, pets, income, visa, languages[], urgency, safety/preferences, safe_contact_method, short summary (gender dropped for now; refine with Lou's actual list later) + `field_sources` map (Phase 5): woman_stated / worker_observation per field, tagged at extraction, worker-editable at review |
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
| shared_fields | jsonb (string[]) | which approved-context fields the worker chose to share (Phase 5) |
| status | text check | draft / approved / sent / responded / closed |
| sent_at | timestamptz | worker marks sent — never automatic |
| follow_up_due | date | |
| outcome | text check | awaiting_reply / accepted / declined / referred_elsewhere / support_received / other — support_received means support was actually delivered, distinct from merely sent/accepted (Phase 6) |
| outcome_notes | text / timestamptz | response/outcome recorded in step 5 |

### referral_events — follow-up timeline (Phase 6, step 5A)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| referral_id | uuid fk → referrals | cascade |
| kind | text check | provider_response / outcome / follow_up_draft |
| note | text | what the provider said / the outcome / the draft text for worker review |
| occurred_at / created_at | timestamptz | append-only history; nothing is ever transmitted |

### case_documents
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| case_id | uuid fk → cases | |
| draft_text | text | drafted from original notes + referral activity |
| status | text check | draft / approved |
| created_at / approved_at | timestamptz | |

### service_change_log — append-only change history (Phase 7 admin view)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| service_id | uuid fk → services (cascade) | |
| attribute_id | uuid | the fact row concerned, when entity='attribute' (plain reference — the row itself is corrected in place) |
| entity | text check | service / attribute |
| field | text | which field changed (value, source_type, status, phone, …) |
| old_value / new_value | text | prior → new; prior provenance is preserved here when a correction replaces it |
| changed_by | text | who made the correction (no auth — entered on the form) |
| note | text | |
| created_at | timestamptz | |

Admin corrections update the shared `services` / `service_attributes` rows in place (caseworker queries use the corrected data immediately) and append log rows — nothing is deleted. A corrected fact gets `verification_status='admin_corrected'` (added to the check; ranked with `provider_confirmed` in matching, counted as known in Verify).

### discovery_candidates — process B queue (Phase 7)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name / source_url / source_name | text | where found |
| dedup_key | text | normalised name+location hash |
| extracted_data | jsonb | candidate structured data |
| status | text check | pending_review / merged / rejected |

The updater (process A) writes new rows or refreshes `service_attributes` with `source_type=machine`, `retrieved_at`, and `verification_status` — it never deletes history a human has confirmed.

### spreadsheet_imports / staged_services — Excel migration staging (Phase 8)
| table | columns | notes |
|---|---|---|
| spreadsheet_imports | id, filename, imported_by, imported_at, row_count | one uploaded CSV batch |
| staged_services | id, import_id (cascade), row_number, raw_values (jsonb — every original cell verbatim, incl. unmapped columns), name, organisation, description, website, phone, email, address, catchment, needs (jsonb tokens), match_status (new/matched — matched by normalised name against canonical services at staging time), matched_service_id (plain reference — survives canonical deletion), status (staged/imported/discarded), outcome (jsonb: mode created/merged, filled[], skipped[{field,current}], addedNeeds[]), decided_by, decided_at, created_at | staged rows only; canonical data is untouched until a human imports a row |

Upload → parse (RFC4180-ish CSV parser: quoted fields, doubled quotes, embedded commas/newlines, CRLF/LF) → map headers via alias table + needs via plain-language aliases → stage verbatim. Import is the human decision and **non-destructive by design**: `new` rows create a service (`source_type='excel_import'`); `matched` rows only FILL empty core fields and add MISSING need facts — existing canonical values are never overwritten, so better-verified data (machine, provider-confirmed, admin-corrected) always survives. Added need facts land as `needs_provider_confirmation` (spreadsheet data is not verified). Every change appends to `service_change_log`. Discard records the decision and touches nothing canonical. The canonical directory exports back to CSV (`GET /api/services/export`, same column order every time).

## Data flow

1. **Notes → Context (Phase 2):** worker enters rough notes → LLM extracts structured context (draft) → worker reviews/edits → approved `case_contexts` row (versioned).
2. **Context → Find support (Phase 3):** approved context is turned into a deterministic SQL query over `service_attributes` → matches ranked with per-fact evidence (source, retrieved_at / confirmed_at).
3. **Find → Verify (Phase 4):** the scheduled updater owns durable provider-profile facts such as pets, languages, visa rules and costs. The caseworker call list is limited to volatile operational facts: current wait time for every shortlisted service, plus current capacity for accommodation. Answers update shared `service_attributes` with `confirmed_by` / `confirmed_at`, so later cases reuse them until their short expiry.
4. **Verify → Refer (Phase 5):** approved context + chosen service + verified facts → LLM drafts referral text using **only** stored facts → worker edits → worker marks `sent` (never automatic).
5. **Refer → Follow up + document (Phase 6):** referral response/outcome recorded on `referrals` → LLM drafts case documentation from original notes + referral activity → worker reviews/approves `case_documents`.
6. **Updater (Phase 7A — built 2026-09-05):** `runUpdater()` iterates active services; adapters (see below) normalise each machine-accessible source into a structured snapshot → compared with canonical facts → unchanged values refresh freshness in place (stale → verified_machine; provider-confirmed/admin-corrected keep human status); every value change or new fact becomes an `update_candidates` row with source URL, evidence type, retrieval time, and reason — nothing auto-applied (per build plan). Admin approves (applies to canonical data in place + append-only change log; new-fact approvals insert the fact) or rejects (canonical untouched). Idempotent: same-value pending candidates dedupe; changed evidence updates the pending candidate in place; rejected values are not re-proposed from the same source. Triggers: Admin "Run updater now" button, `POST /api/updater/run?trigger=manual|scheduled`, and an hourly compose cron sidecar (`updater-cron`) for the schedule (Base44's scheduler can target the same URL once the app is published). Source adapters by `services.source_url` (re-architected 2026-09-05 — the Web Scraper Dataset API / `BRIGHT_DATA_DATASET_ID` dependency was removed): URL in `FIXTURES` (`src/lib/sources.ts`, deterministic demo snapshots per decision #2) → fixture adapter; `https://…` → **direct fetch only** (a failed fetch — network error / non-200, e.g. a provider site blocking plain fetching — is recorded as a source failure; the Bright Data Web Unlocker fallback was removed on 2026-09-05 as a production-only concern). Adapter failures are logged as source failures and never corrupt data. Run log: `updater_runs` rows with counts + structured per-source log (fetches ok/failed, candidates created/updated/deduped, refreshes).
7. **Discovery (Phase 7B — COMPLETE 2026-09-05):** `runDiscovery()` (`src/lib/discovery.ts`, `POST /api/discovery/run?trigger=manual|scheduled` + Admin "Run discovery now" button) → **SERP API** (Bright Data, `{zone: BRIGHT_DATA_SERP_ZONE, url: google search, data_format: "parsed_light"}` → parsed organic results) for queries from the needs taxonomy → discovered provider URLs (social/profile pages filtered) → direct fetch → LLM normalise → dedupe (URL already a canonical `services.source_url`, already queued in `discovery_candidates` any status, or same normalised name @ same site) → insert `discovery_candidates` rows with provenance (source URL, SERP query source name, retrieval timestamp, evidence type) for human review. **Review/merge (the human half, same file):** approving a pending candidate (`approveDiscoveryCandidate` — admin queue form / server action) creates the canonical service from the candidate's stored evidence — extracted service fields → `services` columns (`source_type='discovery_review'`, decision appended to the service change log), attribute facts → `service_attributes` rows with machine provenance and the candidate's retrieval time; rejecting (`rejectDiscoveryCandidate`) records who/when and leaves canonical data untouched. Only pending candidates are decidable, and decided rows are never re-queued. **Scheduling:** a 6-hourly compose cron sidecar (`discovery-cron`) hits the scheduled endpoint (Base44's scheduler can target the same URL once the app is published). Idempotent: repeated runs queue nothing new.
8. **Spreadsheet migration (Phase 8 — built 2026-09-05):** Lou's existing service list (Excel saved as CSV) is uploaded via the Admin page (`src/lib/spreadsheet.ts`) → parsed and staged verbatim in `staged_services` (matched against canonical services by normalised name) → human per-row review: import (new → create service with `excel_import` provenance; matched → fill empty fields / add missing need facts only, existing values never overwritten, change log appended) or discard — nothing canonical changes until a row is imported, and decided rows are never re-decided. Round-trip: `GET /api/services/export` returns the current canonical directory as CSV for Excel. This is the compatibility bridge until Lou's spreadsheet fully retires (the canonical schema stays the single source of truth the caseworker workflow queries).

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
6. **Bright Data integration (decided 2026-09-05, replacing the same-day original choice):** one small replaceable adapter (`src/lib/brightdata.ts`) over Bright Data's unified `POST api.brightdata.com/request` endpoint with Bearer auth — SERP API for discovering new services. **Updated 2026-09-05:** the Web Unlocker fallback for fetching blocked provider pages was removed from the demo environment (production-only concern; failed direct fetches are recorded as source failures). No Web Scraper Dataset API / `BRIGHT_DATA_DATASET_ID` dependency. Required env: `BRIGHT_DATA_API_KEY`, `BRIGHT_DATA_SERP_ZONE`.

## Final state (hardening pass, 2026-09-06)

- **Full five-step flow re-run live from fresh state** (context → find support → verify → refer → follow up → document) with DB writes inspected in Postgres at every stage. The later Verify simplification reconciled Watershed pets to the synthetic spreadsheet (`negotiable`) and moved the human call to current wait time plus capacity; referral, follow-up and documentation state remain intact. Stage 6 of the original run was driven through the exact lib functions the server action wraps (same code path).
- **All 12 regression suites green — 273 assertions** (`npm run db:test*`, run sequentially). Suites are robust against the live demo state: `src/db/test.ts` now creates its own case/context instead of assuming a fixed demo-case version, and the Verify suite covers duplicate operational rows plus current-answer-wins behavior.
- **Admin corrections → caseworker propagation verified live** (provider confirmation of Watershed pets immediately surfaces in Find support as "Caseworker — phone confirmed …").
- **Updater + discovery demo paths verified live 2026-09-06** (idempotent; failures logged, never corrupt data). Excel import path green (34/34) with the demo batch staged (2 imported / 3 discarded).
- **Audits:** no transmission code anywhere (no email/SMS/HTTP-to-provider); LLM only extracts/drafts for human review from stored facts; all fixtures synthetic (`example.org`).
- **Dead code removed:** `src/db/backfill-field-sources.ts` (one-time backfill, long done), `src/db/demo-followup.ts` (superseded by the real flow), `db:backfill-sources` npm script.
