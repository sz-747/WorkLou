# Backend readiness audit

Date: 2026-09-06

## Verdict

**Not ready for the stated goal yet.** Base44 implemented most of the intended backend surface, and a library-level version of the nominal five-step workflow completes against real Postgres and the configured OpenRouter model. However, the current branch can silently alter an approved case note, misreads the exact 226-row mock spreadsheet, implements the wrong follow-up state and schedule, does not perform the promised machine-resolution work in Verify, has no manual path when core LLM stages fail, and cannot pass a production type check.

This is a strong feature-complete prototype, not a dependable end-to-end backend yet.

## Scope and authority

- Reviewed `origin/main...project-status-overview` at `f4fde10` (17 branch commits, 58 changed files).
- Product authority: `docs/product-direction.md`, `docs/design-direction.md`, `docs/ui-flow.md`, `docs/decision-surfaces.md`, and `docs/research/granola-referral-process-notes.md` copied from the parent workspace into this worktree.
- Existing status documents were preserved: `docs/product.md`, `docs/build_plan.md`, `docs/implementation_plan.md`, and `docs/implementation_logs.md`.
- UI polish was intentionally excluded. The review focused on backend correctness, data integrity, workflow completion, failure behavior, deployment readiness, and measured latency.

## What is verified working

- Fresh Postgres 16 schema creation and synthetic seed completed.
- All 12 database suites passed sequentially: **249 passed, 0 failed**.
- One synthetic live-model library smoke completed through context extraction, deterministic matching, provider verification, referral drafting, follow-up/outcome, and case-note drafting/approval. It did not exercise HTTP forms or server actions end to end.
- The live model was `google/gemini-2.5-flash` through the configured OpenRouter endpoint.
- Matching took 21 ms and the provider-confirmation write took 6 ms in the live smoke test.
- LLM calls completed in 1.636 to 3.264 seconds each. Total LLM wait across the synthetic loop was 10.009 seconds.
- The synthetic audit case and service were deleted after the run; a database check returned zero remaining audit rows.
- Main routes returned HTTP 200, and the CSV export opened successfully.

## Findings

### P1: approved case notes are mutated even though the operation reports failure

**Evidence:** `saveDocumentDraftText` updates by document ID without a `status='draft'` condition, then checks the returned status after the update (`src/lib/document.ts:231-240`). The live probe approved a note, attempted an edit, received `false`, and then read back the changed text `MUTATION PROBE` from the approved row.

The existing test says the guard works but only checks the false return value. Its later assertion checks the old row's status, not that its text stayed unchanged (`src/db/test-document.ts:210-218`).

**Impact:** finalized case documentation can be silently corrupted while the UI tells the worker the edit was rejected.

**Required fix:** put `status='draft'` in the update predicate and add a regression assertion that the approved text remains byte-for-byte unchanged.

**Confidence:** high, reproduced against Postgres.

### P1: the exact 226-row mock spreadsheet is incompatible with the importer

**Evidence:** the importer aliases both `name` and `provider` to canonical `name`, and later non-empty columns overwrite earlier ones (`src/lib/spreadsheet.ts:48-52`, `src/lib/spreadsheet.ts:180-185`). The mock file has both columns in that order. A direct parser probe mapped `Correct Service Name` to `Provider Organisation`.

Across the actual file:

- 226 unique service or program names become only 128 provider names.
- 217 of 226 rows have a service name different from the provider that would replace it.
- 135 rows belong to a provider used by multiple programs; one provider has 16 rows.
- The file has no `needs` header, so all 226 rows stage with zero need facts under the current mapping.
- Eligibility, capacity, referral method, source URLs, and most other useful fields remain only in `raw_values`; matching and updating do not use them.

**Impact:** importing the mock data would lose program identity, create duplicate provider-named services, and leave those services unable to match case needs. This defeats the intended Excel-to-Postgres interaction.

**Required fix:** add an explicit adapter for this 67-column schema. Map `name` to service/program name, `provider` to organisation, convert service/discovery/population fields through a reviewed taxonomy mapping, and preserve structured eligibility/capacity/source data in canonical attributes. Validate the full file before enabling import.

**Confidence:** high, measured on the exact CSV and reproduced through the repository mapper.

### P1: the follow-up behavior contradicts the current product direction

**Evidence:** routine referrals require a five-day default (`docs/product-direction.md:36`, `docs/ui-flow.md:111`). Crisis accommodation requires a direct-call action and daily retry, while routine referrals retain the five-day path (`docs/decision-surfaces.md:14-18`; research evidence at `docs/research/granola-referral-process-notes.md:25-26`).

The implementation always returns seven days (`src/lib/refer.ts:122-126`), and the test explicitly locks in “one week” (`src/db/test-refer.ts:160-166`). No crisis-specific call/daily-retry branch exists. The live smoke test confirmed a seven-day default.

**Impact:** the loop works mechanically but implements the wrong operational cadence for both routine and urgent accommodation referrals.

**Required fix:** use five days for routine referrals and model crisis accommodation as direct call plus daily retry. Keep both editable by the worker.

**Confidence:** high.

### P1: accepted referrals close before support is received

**Evidence:** `accepted` is marked final, and every final outcome immediately changes the referral to `closed` (`src/lib/followup.ts:14-20`, `src/lib/followup.ts:89-116`). A closed referral cannot later record `support_received`. The current flow treats Accepted, Support received, and Closed as distinct states and also includes Further information requested plus decline reasons (`docs/ui-flow.md:119-143`). Those additional states are absent from the database constraint (`src/db/schema.ts:330-338`).

**Impact:** the product cannot represent the real interval between a provider accepting a referral and the woman actually receiving support, even though that distinction is a core success measure.

**Required fix:** model referral status separately from outcome, keep accepted referrals open until support is received or otherwise closed, and add the missing response/decline states with transition tests.

**Confidence:** high that the transition is blocked; medium on the final state vocabulary pending Lou's confirmation.

### P1: Verify does not perform the promised machine-resolution step

**Evidence:** product authority says the backend resolves everything reasonably available from machine sources and workers see only provider-only questions (`docs/product-direction.md:30-31`, `docs/design-direction.md:88-89`). The Verify module explicitly performs no refetch and sends stale or missing relevant facts to provider confirmation (`src/lib/verify.ts:7-10`, `src/lib/verify.ts:86-123`).

Matching and Verify also trust the stored `verificationStatus` without deriving staleness from `retrievedAt` (`src/lib/matching.ts:78-81`, `src/lib/verify.ts:55-62`). When updater refresh fails, the old fact remains unchanged and can still appear known indefinitely (`src/lib/updater.ts:262-276`).

**Impact:** workers can be asked to phone providers for machine-accessible information, while old facts continue to look current after failed refreshes.

**Required fix:** define expiry rules by fact type, automatically mark overdue/failed facts stale, run machine resolution before the worker's Verify list is finalized, and route only genuinely provider-only gaps to a human.

**Confidence:** high.

### P1: source notes and business dates are not modeled safely

**Evidence:** a case has only one `original_notes` value (`src/db/schema.ts:279-285`). Every context extraction overwrites it before the LLM succeeds (`src/app/women/[id]/actions.ts:18-34`). Old contexts/referrals remain, but documentation later combines all activity with the latest overwritten notes (`src/app/women/[id]/document-actions.ts:39-55`).

Business dates are produced with UTC `toISOString().slice(0, 10)` in referral, follow-up, document, and verification code (`src/lib/refer.ts:122-126`, `src/lib/followup.ts:150-171`, `src/lib/document.ts:101-102`, `src/app/women/[id]/VerifyStage.tsx:162-169`). In the live run at 01:25 on 2026-09-06 Sydney time, generated records showed 2026-09-05. Case-note `appointmentDate` is also derived from case creation time, not an appointment/note timestamp (`src/lib/document.ts:110-140`).

**Impact:** re-extraction or a failed AI call can destroy the earlier raw record, later documentation can combine the wrong source note with historic activity, and due/appointment dates can be one calendar day wrong.

**Required fix:** version source-note/appointment records with their own timestamps and context links. Convert instants to `Australia/Sydney` explicitly for business dates and test around midnight and daylight-saving boundaries.

**Confidence:** high, including a fixed-time reproduction.

### P1: case documentation can misattribute shared provider confirmations

**Evidence:** `getProviderConfirmationsForCase` first finds referred service IDs, then returns every confirmed fact currently attached to those services, with no case/referral linkage (`src/lib/document.ts:43-78`; service attributes at `src/db/schema.ts:69-94`). `buildCaseNoteInput` sends all of them to the case-note model as provider confirmations/actions (`src/lib/document.ts:152-184`). A confirmation recorded while working another case therefore appears to be an action for this case.

Re-confirming a provider fact also overwrites the same service-attribute row's value, source, person, timestamp, and notes without appending confirmation history (`src/lib/verify.ts:147-181`), contrary to the required verification history (`docs/product-direction.md:30-31`, `docs/product-direction.md:55-61`).

**Impact:** a finalized case note can claim work that was done for a different case, while prior shared confirmation evidence disappears.

**Required fix:** keep reusable current provider facts and append-only confirmation events separately. Link the event to the case/referral when one triggered it, and build case documentation from case-linked events only.

**Confidence:** high from schema/query shape.

### P1: LLM failure blocks core workflow stages and requests have no timeout

**Evidence:** the product direction requires workers to continue manually if AI fails (`docs/design-direction.md:104`). Context creates a draft only after successful extraction (`src/app/women/[id]/actions.ts:29-48`). Referral and documentation drafts are also inserted only after successful LLM calls (`src/app/women/[id]/refer-actions.ts:72-86`, `src/app/women/[id]/document-actions.ts:59-68`). There is no blank/manual draft creation path.

The LLM fetches in context, referral, follow-up, document, and provider-page extraction do not pass an abort signal (`src/lib/extraction.ts:164-178`, `src/lib/refer.ts:95-109`, `src/lib/followup.ts:235-249`, `src/lib/document.ts:195-209`, `src/lib/page-extraction.ts:42-53`).

Provider responses and outcomes can still be recorded without AI, and raw notes persist before context extraction fails. The blocking scope is Context, Referral, and Documentation; follow-up drafting is optional.

**Impact:** a missing key, provider outage, or hanging request can stop core stages indefinitely instead of degrading to a manual workflow.

**Required fix:** centralize LLM calls behind a bounded client with timeout, clear retry policy, and safe error handling. Add manual context, referral, follow-up, and case-note draft paths that persist worker input without AI.

**Confidence:** high from the reachable action paths and fetch configuration.

### P1: the branch is not build or deployment ready

**Evidence:** `npx tsc --noEmit` returned **43 TypeScript errors**, including errors in caseworker and admin production paths. `package.json` has no `build` or production `start` script. Compose runs `next dev`, reinstalls dependencies at every setup, and runs `drizzle-kit push --force` at boot (`package.json:5-19`, `docker-compose.base44.yml:18-48`).

The checked-in Compose file expects `/run/base44/app.env`, so it could not consume the local ignored `.env.local` without an audit-only override. First setup spent about eight minutes in `npm install`; the dev server reported 98.8 seconds before ready.

Using forced schema push at boot is also unsafe for a future canonical database because schema changes are not represented as reviewed, reversible migrations.

**Impact:** a clean local checkout does not start with the provided secret file as expected, there is no production artifact to benchmark or deploy, and future real data could be exposed to automatic schema changes.

**Required fix:** make type checking green, add a production build/start path, use locked dependency installation, separate local/Base44 environment loading, and replace boot-time `push --force` with versioned migrations plus backup/rollback procedures.

**Confidence:** high, directly executed.

### P1: matching and ingestion do not share one enforced vocabulary

**Evidence:** the canonical context taxonomy uses `mental_health_counselling` and `immigration_visa` (`src/lib/extraction.ts:15-27`), while provider-page extraction instructs the model to emit `mental_health` and `immigration` (`src/lib/page-extraction.ts:21-25`). Spreadsheet normalization intentionally accepts unknown labels as new arbitrary tokens instead of rejecting or staging them for mapping (`src/lib/spreadsheet.ts:116-120` and the passing test that asserts this behavior).

Visa matching treats only `no_restrictions` as allowed; every other recorded value is a hard exclusion, even a value that could explicitly match the client's visa (`src/lib/matching.ts:165-184`).

**Impact:** valid services can disappear from results due to spelling or vocabulary differences, and eligibility can be interpreted as exclusion without a validated domain meaning.

**Required fix:** define one versioned vocabulary and parser at every ingestion boundary. Unknown values should enter a review queue, not matching. Model eligibility as explicit allowed, excluded, unknown, or conditional rules, then add positive and negative tests from the actual spreadsheet.

**Confidence:** high for the contract mismatch; the real-world impact requires Lou's final category review.

### P2: multi-step writes are not atomic

**Evidence:** referral duplicate checking and insertion are separate operations with no database uniqueness constraint (`src/app/women/[id]/refer-actions.ts:56-86`; `src/db/schema.ts:306-341`). Provider response/outcome updates and timeline inserts are separate operations (`src/lib/followup.ts:62-116`). Spreadsheet import reads staged status, performs several writes, then marks the row imported, without a transaction or conditional decision update (`src/lib/spreadsheet.ts:316-404`).

**Impact:** retries or concurrent workers can create duplicate referrals/imports or leave state without its audit event. This is lower risk under the current single-worker hackathon assumption, but incompatible with a dependable shared backend.

**Required fix:** use transactions, row/status guards in the write predicates, and database uniqueness constraints for invariants.

**Confidence:** high from code inspection; concurrency was not load-tested.

### P2: public deployment is intentionally unsecured

**Evidence:** the hackathon scope explicitly says no authentication and one caseworker (`docs/product-direction.md:88-89`). Admin mutations and spreadsheet upload are therefore open to any visitor, updater/discovery POST endpoints have no authorization (`src/app/api/updater/run/route.ts:11-16`, `src/app/api/discovery/run/route.ts:11-18`), export is public, and Compose publishes Postgres on all interfaces with development credentials (`docker-compose.base44.yml:3-11`). Spreadsheet upload also has no size limit before `file.text()` (`src/app/admin/spreadsheet-actions.ts:24-35`).

**Impact:** acceptable only for isolated localhost/demo use with synthetic data. It blocks public hosting or use of Lou's real data because visitors could read/export data, alter canonical facts, trigger paid external work, or exhaust memory.

**Required fix:** before any public or real-data use, add identity/roles, protect scheduled endpoints with a secret or platform scheduler identity, rate and size limits, audit actor identity from the session, and keep Postgres on an internal network.

**Confidence:** high.

### P2: maintenance pipelines are serial and will not scale smoothly

**Evidence:** updater processes active services one at a time (`src/lib/updater.ts:257-317`). Discovery performs four searches sequentially and then fetches up to 20 candidate pages sequentially (`src/lib/discovery.ts:33-38`, `src/lib/discovery.ts:101-114`, `src/lib/discovery.ts:134-186`). Bright Data permits 90 seconds per search; direct page fetch permits 10 seconds, followed by an unbounded LLM call.

**Impact:** current fixture runs are small, but these synchronous HTTP jobs grow approximately with every service/source and can occupy one request for minutes. Throughput at 226 live sources is unverified, so no low-latency claim is currently supportable.

**Required fix:** move maintenance to bounded background jobs with controlled concurrency, per-item timeouts, resumable checkpoints, run locks, and measured throughput. Keep the caseworker request path independent.

**Confidence:** high for execution shape; production throughput remains unmeasured.

## Measured latency

These are development-mode Windows Docker measurements, not production benchmarks:

| Path or operation | Observed |
|---|---:|
| Dev server ready | 98.8 s |
| First `/` request | 87.27 s |
| Warm `/` | 0.32 to 0.36 s |
| First case workspace | 52.39 s |
| Warm case workspace | 0.71 to 0.86 s |
| Warm `/women` | 0.41 to 0.51 s |
| Warm `/admin` | 0.40 to 0.52 s |
| Warm CSV export | 0.25 to 0.31 s |
| Context LLM | 2.749 s |
| Referral LLM | 1.636 s |
| Follow-up LLM | 2.360 s |
| Case-note LLM | 3.264 s |

The deterministic backend operations were fast in the small fixture. Startup/cold behavior is poor, warm route behavior is moderate, and production latency cannot be established until a production build exists.

## Why the green suites are not enough

The 249 assertions provide useful coverage of intended state transitions and pure logic. They do not validate current product authority or the exact mock dataset. Two examples show the gap:

- The referral suite passes because it asserts a seven-day default, while the product now requires five days plus a crisis exception.
- The documentation suite reports that approved notes cannot be edited, while its assertion misses that the text was already mutated before the function returned `false`.

## Recommended fix order

1. Stop approved-document mutation and add the missing regression assertion.
2. Build and validate the exact 67-column spreadsheet adapter before importing or committing the 226-row data as an application fixture.
3. Implement the required follow-up schedule and state model, including accepted versus support received.
4. Make Verify resolve machine-accessible facts and enforce automatic freshness rules.
5. Add bounded LLM calls and manual fallback paths for every AI-assisted stage.
6. Make TypeScript green and create a production build, migration, and local environment path.
7. Unify taxonomies and make eligibility semantics explicit.
8. Version source notes, correct Sydney business dates, and separate case-linked confirmation events from shared current facts.
9. Add transactional invariants, then security controls and external-LLM privacy controls before public or real-data use.
10. Run production-mode load tests with all 226 services and controlled maintenance concurrency.

## Review exclusions and remaining risk

- No UI visual-quality review was performed.
- No real client data or real referral was used or transmitted. Before real data, de-identification plus explicit OpenRouter storage/retention/access governance is required because raw notes are sent to the external model (`src/lib/extraction.ts:164-177`, `src/lib/document.ts:168-207`; unresolved privacy questions at `docs/research/granola-referral-process-notes.md:62-66`).
- Bright Data was not called live because its credentials were not supplied and a live run can incur cost and write discovery candidates. Its offline adapter and pipeline suites passed.
- Base44's hosted runtime was not inspected directly; this audit covers the GitHub branch in the local worktree.
- The live workflow was a library-level smoke; server-action/form wiring was not re-executed end to end.
- Production performance remains unverified because the branch has no passing production build.
