# Demo Backend Readiness and Evaluation Plan

Date: 2026-09-06

## Summary

The demo does not need a production-perfect backend. It needs one honest, repeatable story:

```text
fragmented mock notes
        |
        v
structured case context -> worker approval
        |
        v
deterministic database match -> sourced real services
        |
        v
verify unknowns -> referral draft -> follow-up -> case note

daily updater ---------> current service facts + run receipt
daily discovery -------> review candidates + run receipt

Bright Data scrape ----> updater retrieval (background only)
Bright Data search ----> discovery retrieval (background only)

eval runner -----------> accuracy, determinism, latency, and completion evidence
```

The LLM may turn fragmented notes into a proposed structure and draft prose. It must not interpret service categories during matching. After worker approval, the recommendation path is schema validation plus ordinary code and Postgres queries.

## Demo success definition

A successful demo proves all of the following with mock cases and source-backed public service data:

1. Fragmented notes become valid structured context that a worker can review and correct.
2. Approved context returns appropriate services through deterministic rules, with reasons and source evidence.
3. The full workflow completes through referral, follow-up, outcome, and documentation.
4. Updater and discovery run once daily on Base44 and leave timestamped receipts.
5. A repeatable evaluation command produces the statistics shown to judges.

It does **not** claim that WorkLou has already improved real client outcomes, measured caseworker time saved, or achieved field-validated referral accuracy.

## Current state

Verified in `docs/audits/backend-readiness-audit-2026-09-06.md`:

- All 12 database suites pass: 249 assertions.
- A library-level live-model smoke completed against Postgres and `google/gemini-2.5-flash` through OpenRouter.
- Deterministic matching took 21 ms in that one small run.
- Context extraction took 2.749 seconds; the other three LLM drafts took 1.636 to 3.264 seconds each.
- The exact 226-row public/mock CSV is not compatible with the current importer.
- TypeScript has 43 errors and there is no production build path.
- Several core state, date, immutability, verification, and failure-path defects remain.
- Docker sidecars are configured hourly and six-hourly, not as deployed Base44 daily automations.
- The branch currently uses Bright Data's REST endpoint only for discovery SERP. The updater still fetches source URLs directly and explicitly has no Bright Data fallback, so it does not yet match Steve's intended use of Bright Data for both services.

Current official Base44 documentation confirms that scheduled automations can use cron, are defined with backend functions and `function.jsonc`, are deployed with the function, and have dashboard execution history. Backend functions run in Deno and currently have a five-minute maximum execution time. Steve has confirmed that the linked app is on the Builder plan with 10,000 Base44 integration credits, so Base44 plan access and credits are not the constraint:

- https://docs.base44.com/developers/backend/resources/backend-functions/automations
- https://docs.base44.com/developers/backend/resources/backend-functions/overview

Bright Data's official CLI exposes both `search` through SERP and `scrape` through Web Unlocker, and its `--timing` flag is useful for local benchmarks. The CLI requires Node.js 20 or later. Because the deployed Base44 runtime is Deno serverless, the hosted functions should call Bright Data's documented REST APIs directly rather than assuming the Node CLI binary exists. The CLI and hosted adapter must be tested with equivalent query, country, language, zone, and output settings:

- https://docs.brightdata.com/products/cli/commands
- https://docs.brightdata.com/api-reference/rest-api/serp/serp-api
- https://docs.brightdata.com/api-reference/rest-api/unlocker/unlock-website

## Scope

### Included

- Mock case notes only.
- The 226-row source-backed service snapshot, with a smaller reviewed subset allowed to drive recommendations.
- Clear canonical vocabularies and validation.
- Deterministic matching and a reproducible evaluation harness.
- Full workflow correctness for the demonstrated path.
- Two daily Base44 automations with durable run receipts.
- Production-like build and latency checks sufficient for demo reliability.

### Deferred

- UI redesign or visual polish.
- Real client data.
- Autonomous email sending.
- Authentication beyond the minimum secret needed to protect scheduled-job endpoints.
- High-scale production operation.
- Claims about real-world referral outcomes or caseworker minutes saved.
- Complete eligibility research for all 226 services.

## Demo acceptance gates

| Area | Gate shown to judges |
|---|---|
| Structured notes | 100% of critical stated facts captured across the frozen demo set; zero unsupported critical facts; all outputs pass schema validation |
| Deterministic match | Same ordered result and reason on every repeated run; zero explicit hard exclusions recommended; at least one pre-declared suitable service in the top three for every evaluable case |
| Match speed | Postgres matching p95 at or below 100 ms over 226 loaded services after warm-up |
| Notes to shortlist | p95 at or below 5 seconds, including LLM extraction, validation, and deterministic matching |
| Bright Data discovery quality | On a frozen search-query set: Precision@5 at or above 0.80, every pre-declared discoverable service found in the first two result pages, and duplicate/junk URLs at or below 10% |
| Bright Data retrieval | At least 95% successful retrieval across the frozen known-URL set; failures are retried within a bounded budget and recorded without changing existing approved facts |
| Draft safety | 100% of forbidden/unselected case fields absent; zero unsupported factual claims in the human-reviewed demo corpus |
| Full loop | 10 of 10 clean runs complete from notes through approved case note with expected database transitions |
| Daily jobs | Seven consecutive scheduled receipts for updater and discovery before demo day; every run starts, finishes, targets four minutes or less to leave margin below Base44's five-minute limit, and records item-level failures |
| Build | TypeScript clean, production build succeeds, and the demo starts from a clean environment without a manual schema push |

The thresholds above are demo engineering gates. They are not clinical or field-validation claims.

## Evaluation design

### Frozen benchmark

- Create 20 synthetic fragmented-note cases before changing matching behavior.
- Select about 25 public service/program records from the 226-row file whose relevant facts can be supported by the stored source URLs.
- Cover crisis accommodation, routine accommodation, DFV, legal, financial, children, pets, visa, language, geography, urgency, contradictory statements, and missing information.
- For each case, record expected structured fields, acceptable services, explicit exclusions, unresolved unknowns, and the fact/rule supporting each expectation.
- Freeze the fixtures and expected results before tuning the implementation. This prevents changing the answer key to fit the code.

### Metrics

**Context extraction**

- Exact match per scalar field.
- Precision, recall, and F1 for list fields such as needs and languages.
- Critical-field recall for need, urgency, location, children, pets, and safe-contact constraints.
- Unsupported-field rate: structured values not stated in the notes.
- Schema-validation rate.
- Latency per call and p50/p95 across the benchmark.

**Deterministic matching**

- Rule-conformance rate against the frozen expected set.
- Hard-exclusion violation count.
- Top-three suitable-service coverage.
- Unknown-as-known violation count.
- Repeatability: output IDs, order, reasons, and evidence hashes remain identical over repeated runs.
- Query p50/p95 and maximum latency over the complete 226-service load.

**Referral, follow-up, and documentation**

- Required sections present.
- Only worker-selected case fields enter referral input.
- Woman-stated facts, worker observations, and provider confirmations remain separate.
- No unsupported factual claim in the reviewed benchmark outputs.
- Correct state transitions from sent, response, accepted/declined, support received, and closed.
- Draft and approved-record immutability checks.

**Background jobs**

- Scheduled-run completion rate.
- End-to-end duration plus separate Bright Data request duration, extraction duration, and database-write duration.
- Services checked or URLs considered.
- Sources succeeded/failed.
- Candidates created, updated, skipped, or deduplicated.
- Idempotency on repeated evidence.
- Seven-day streak for each job.

**Bright Data search and retrieval**

- Freeze 10 to 20 discovery queries covering service type, geography, population, and urgency before tuning query templates.
- Human-label relevant and junk results independently of the current code.
- Report Precision@5, pre-declared service recall within two pages, duplicate/junk rate, known-URL retrieval success, structured-fact yield, and p50/p95 provider latency.
- Run the same inputs through the local CLI and hosted REST adapter with equivalent settings, then compare normalized result URLs and payloads. Treat material differences as a configuration defect, not model variance.
- Keep these numbers separate from Postgres match latency. Caseworker recommendations must read already-ingested Postgres data and must never wait for a live Bright Data search or scrape.

### Evaluation outputs

Add one command, `npm run eval:demo`, that writes:

- `artifacts/evals/latest.json`: machine-readable metrics and environment/model provenance.
- `artifacts/evals/latest.md`: a short judge-readable scorecard.
- `artifacts/evals/runs/<timestamp>.json`: immutable run receipt.

The scorecard must label the corpus as synthetic cases plus source-backed public service data. It must state the sample size and avoid extrapolating to real casework outcomes.

## Dependency-ordered implementation units

### Unit 0: Freeze the demo truth set

**Goal:** create a non-circular answer key for extraction and matching.

**Dependencies:** access to the 226-row CSV and its source URLs.

**Files:** new `evals/fixtures/`, `evals/README.md`, and a mapping manifest under `docs/data/`.

**Approach:** choose 20 mock cases and about 25 sufficiently evidenced public service records. Write expected contexts, suitable/excluded services, unknowns, and reason/evidence links before matcher changes. Steve owns the demo truth; Lou's Place review remains future field validation.

**Verification:** every expected result cites a specific fixture fact and deterministic rule; no expectation depends on current matcher output.

This is the highest-risk spike. If the public records cannot support a credible expected result set without guessing, stop and curate stronger source evidence before building the eval.

### Unit 0A: Prove the Bright Data boundary and baseline quality

**Goal:** prove that both background services can use Bright Data without placing external search latency in the caseworker path.

**Dependencies:** Unit 0's frozen known URLs and discovery queries.

**Files:** `src/lib/brightdata.ts`, a Bright Data benchmark fixture/config, and eval receipt output. Do not change production behavior during the spike.

**Approach:** use the Bright Data CLI locally for `search`, `scrape`, and timing. Run equivalent SERP and Web Unlocker REST requests using the exact settings that can be deployed in Base44. Compare normalized outputs, measure p50/p95 over repeated frozen inputs, and confirm Base44 can read its secrets and finish a bounded REST call. Keep credentials out of fixtures and logs.

**Verification:** discovery and updater each complete one real Bright Data request locally and one from a deployed Base44 test function; CLI and REST return materially equivalent normalized results; the quality metrics can be calculated from frozen labels; timeouts, 429 responses, malformed output, and one unreachable URL produce explicit receipts without changing service facts.

This is a load-bearing deployment spike. Do not build the scheduled jobs around shelling out to `brightdata`; Base44 documents a Deno serverless runtime, while Bright Data documents the CLI as a Node.js 20+ package. Use the REST API in Base44 unless a real deployed test proves a supported CLI execution boundary.

### Unit 1: Establish one canonical vocabulary

**Goal:** make all stored and queried meanings explicit.

**Dependencies:** Unit 0.

**Files:** `src/lib/extraction.ts`, `src/lib/page-extraction.ts`, `src/lib/spreadsheet.ts`, `src/lib/matching.ts`, `src/db/schema.ts`, a new domain vocabulary module, and a versioned database migration.

**Approach:** define allowed values for needs, service capability, geography, urgency, referral method, children, pets, visa, income, language, accessibility, capacity, and freshness. Eligibility values use accepted, excluded, conditional, or unknown. Every ingestion boundary either maps to a valid value or records unknown/review-needed. No arbitrary new token enters matching.

**Verification:** contract tests send every accepted alias and malformed/unknown value through LLM parsing, page extraction, CSV mapping, admin correction, and matching. All boundaries produce the same canonical tokens; malformed values cannot become recommendations or exclusions.

### Unit 2: Build the exact 67-column spreadsheet adapter

**Goal:** load the real public snapshot without losing program identity or inventing certainty.

**Dependencies:** Unit 1.

**Files:** `src/lib/spreadsheet.ts`, `src/db/schema.ts`, spreadsheet tests, and a mapping manifest.

**Approach:** map `name` to service/program name and `provider` to organisation. Map region, catchment, population, delivery, eligibility, referral, capacity, and source fields through explicit converters. Keep original cells verbatim. Preserve stable `service_id`. Unknown and vague source fields remain unknown. The reviewed subset becomes recommendation-eligible; the rest remains searchable/reviewable.

**Verification:** all 226 rows stage; all 226 stable IDs remain unique; program names remain unique where the input is unique; no program collapses into a provider name; curated rows produce expected typed facts; unmapped cells remain byte-for-byte available; repeated import is idempotent.

### Unit 3: Make matching deterministic, explainable, and measured

**Goal:** guarantee that approved structured input produces the same sourced results without an LLM.

**Dependencies:** Units 1 and 2.

**Files:** `src/lib/matching.ts`, matching tests, and the new eval runner.

**Approach:** hard-exclude only an explicit excluded fact. Unknown never means yes or no. Require at least one capability match. Rank by a fixed tuple such as matched needs, crisis/delivery fit, geography, evidence freshness, then stable service ID. Return the fact IDs and rules used for every match/exclusion reason. Do not expose a fake confidence score.

**Verification:** run every frozen case against all 226 services, assert the matching gates, then repeat at least 100 times and compare ordered output/evidence hashes. Measure warm p50/p95 with `performance.now()` around the matching boundary, excluding fixture setup and LLM time.

### Unit 4: Bound and evaluate note extraction

**Goal:** turn fragmented mock notes into a valid proposal quickly, while preserving ambiguity.

**Dependencies:** Unit 1 and the Unit 0 gold contexts.

**Files:** `src/lib/extraction.ts`, context actions/forms, extraction tests, and eval fixtures.

**Approach:** require JSON matching the canonical schema, use temperature zero, set an output limit, add an eight-to-ten-second timeout and at most one bounded retry, and reject unsupported tokens. Missing or vague facts become unknown. Keep worker review mandatory. Add a manual structured-context path when the model fails.

**Verification:** run the frozen notes through the configured model, calculate extraction metrics, test malformed/empty/hanging model responses, and confirm a worker can finish Context with the LLM disabled. Measure full notes-to-shortlist p50/p95.

An LLM call cannot be guaranteed to return identical text every time. The guarantee begins after validated worker approval. The eval should report extraction variance honestly rather than calling it deterministic.

### Unit 5: Repair the demonstrated workflow

**Goal:** make the complete five-step state machine truthful and repeatable.

**Dependencies:** Units 1 through 4.

**Files:** case/context schema and actions, `src/lib/verify.ts`, `src/lib/refer.ts`, `src/lib/followup.ts`, `src/lib/document.ts`, related server actions, and tests.

**Approach:**

- Guard approved-document edits in the database predicate.
- Version source notes/appointments instead of overwriting one case field.
- Use Sydney business dates and a real appointment timestamp.
- Keep accepted open until support received or explicit closure.
- Use five-day routine follow-up and daily crisis retry.
- Resolve machine-accessible verification facts before showing provider-only questions.
- Store reusable current provider facts separately from append-only, case-linked confirmation events.
- Preserve manual paths for referral and case-note drafting if AI is unavailable.

**Verification:** add regression tests for every audit defect. Then drive the real forms/server actions from notes through approved case note ten times on a clean fixture. Assert database transitions and rendered state at every stage. Include LLM timeout, repeated submission, stale fact, unknown eligibility, accepted-then-support-received, Sydney-midnight, and approved-record mutation cases.

### Unit 6: Create a stable demo build

**Goal:** run the same artifact locally and in the hosted demo without development compilation delays.

**Dependencies:** Unit 5.

**Files:** `package.json`, Compose/Base44 configuration, environment documentation, and versioned migrations.

**Approach:** clear all TypeScript errors, add production build/start scripts, use locked dependency installation, load local secrets from ignored `.env.local`, keep hosted secret injection separate, and replace boot-time `drizzle-kit push --force` with migrations. Add one health endpoint that checks the app and database without calling paid services.

**Verification:** from a clean checkout and empty database, install, migrate, seed, build, start, and pass health plus workflow smoke checks. Repeat with the existing demo database to prove migrations preserve receipts and fixture data.

### Unit 7: Deploy two real daily Base44 automations

**Goal:** show that updater and discovery actually ran each day.

**Dependencies:** Units 0A and 6. Builder-plan access and Base44 credit capacity are confirmed.

**Files:** Base44 backend function directories and `function.jsonc` files, protected job endpoints, run-receipt schema, and admin/log view.

**Approach:** first deploy one no-op scheduled-function spike and verify that its dashboard history appears. Then add thin updater and discovery functions using source-controlled schedules. Both call Bright Data over REST: discovery uses SERP and updater uses Web Unlocker. The local Bright Data CLI remains the reproducible test and diagnosis interface, not a deployed dependency. Protect the application job boundary with a dedicated secret. Each job writes a run row before work, updates it on completion/failure, holds a single-run lock, processes a bounded concurrent batch, caches/deduplicates URLs and content hashes, and targets four minutes or less to leave margin below Base44's five-minute function limit. Record timestamps in UTC and render them in Australia/Sydney.

Use once-daily schedules. Keep schedule configuration in `function.jsonc`, because official Base44 documentation says deployed configuration is the source of truth and dashboard edits can be overwritten.

**Verification:** manual Run now succeeds for both jobs, duplicate concurrent starts are rejected, item failures are recorded without losing the run receipt, and seven consecutive scheduled receipts agree with Base44 dashboard execution logs. Export or capture the final seven-day evidence without fabricating missing days.

### Unit 8: Produce the demo scorecard and rehearse

**Goal:** make every spoken claim reproducible in under a minute.

**Dependencies:** Units 0 through 7.

**Files:** eval runner, scorecard renderer, demo walkthrough, and generated evidence artifacts.

**Approach:** run the frozen extraction/matching/draft benchmark, the 10-run workflow check, production latency checks, and the seven-day job-receipt query. Produce one concise scorecard with sample sizes, p50/p95, pass counts, model ID, dataset version, commit, and timestamp.

**Verification:** on a clean demo machine/session, run one command and reproduce the displayed numbers. Then complete the full demo script twice without database repair, manual data patching, or hidden fallback steps.

## Judge-safe claims

If the gates pass, the demo can honestly say:

- “The service recommendation itself is deterministic and took **X ms p95** across 226 loaded service records.”
- “From fragmented notes to a sourced shortlist took **Y seconds p95** across 20 synthetic cases.”
- “The expected suitable service appeared in the top three for **N of N evaluable benchmark cases**.”
- “No explicitly excluded service was recommended in the benchmark.”
- “Updater and discovery completed on **seven consecutive scheduled days**, with the run receipts shown here.”

Do not say the system saves a proven number of caseworker minutes or improves real referral outcomes until those are measured with Lou's Place.

## Assumptions and open questions

- **Confirmed by Steve on 2026-09-06:** the linked Base44 app is on the Builder plan and has 10,000 integration credits. Treat credits as available for repeated tests; still record consumption per run.
- **Assumption:** the Bright Data account has active SERP and Web Unlocker zones plus enough Bright Data usage allowance for the repeated benchmark. Base44 integration credits do not establish Bright Data product access or budget.
- **Assumption:** at least about 25 records in the public snapshot have enough source-backed structure for a credible demo truth set. Unit 0 tests this before schema work depends on it.
- **Assumption:** at least seven calendar days remain before judging. If not, show every genuine scheduled day available plus clearly labeled manual runs; do not backfill fake receipts.
- **Open question:** who performs the final source/expected-result review before the benchmark is frozen? Steve can own demo truth, but Lou's Place staff should own any later field-validation claim.
