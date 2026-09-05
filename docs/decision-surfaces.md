# WorkLou Decision Surfaces

## DS-001: Where should a caseworker begin?

- **Question:** Should WorkLou open with the next task, the woman, or a guided support session?
- **Why it matters:** This choice shapes the main navigation and the amount of thinking required before useful work begins.
- **Status:** Unresolved
- **Current behavior:** Prototype all three starting models in Paper using the same calm visual system, then compare them with caseworkers.
- **Owner:** Steve and Lou's Place staff
- **Evidence:** Staff work under pressure, finding support is the largest time drain, and the product must map onto current work.

## DS-002: How should urgent accommodation differ from routine referrals?

- **Question:** Should crisis accommodation follow the standard email and five-day follow-up path?
- **Why it matters:** Treating urgent beds like routine referrals could hide the action that matters now.
- **Status:** Decided
- **Current behavior:** Crisis accommodation shows a direct-call action and daily retry. Routine referrals retain an email trail and a five-day follow-up default.
- **Evidence:** Interview notes report direct calls, often daily, for crisis beds and email follow-up for other referrals.

## DS-003: Is the workflow compulsory and linear?

- **Question:** Must workers complete every stage in order before moving on?
- **Why it matters:** Real casework can change direction and women may decline or revisit options.
- **Status:** Decided
- **Current behavior:** Show a clear recommended next step while allowing workers to go back, revise, skip irrelevant checks, and return later.
- **Evidence:** Lou's Place uses a woman-led approach, and the research says there is no single compulsory progression through support.

## DS-004: Whose account does a generated summary represent?

- **Question:** Can the woman's statements, worker observations, and provider confirmations be merged into one narrative?
- **Why it matters:** Merging them could turn an interpretation into an apparent fact and make a warm referral inaccurate.
- **Status:** Decided
- **Current behavior:** Keep the three evidence types visibly separate through context review, referral preparation, and documentation.
- **Evidence:** Interview notes warn that workers sometimes add interpretations. The product direction already distinguishes these sources.

## DS-005: What should WorkLou feel like before the workflow is expanded?

- **Question:** Which visual language gives caseworkers calm confidence without looking like a generic hackathon dashboard?
- **Why it matters:** Typography, density, navigation, and spatial rhythm will shape every later workflow screen. Extending an untested direction across all five stages would create avoidable rework.
- **Status:** Decided
- **Current behavior:** Make the existing case workspace calm and action-first now. Show the recommended next action and the small amount of information needed to take it. Put provenance, freshness, history, raw records, system wording, and secondary options inside plain-language expandable sections. Keep the full data available without forcing the worker to scan it. Combine follow-up and documentation as the fifth visible stage.
- **Evidence:** Steve clarified that workers will be focused on helping the woman immediately after a call, so random observability and implementation detail must not compete with the next useful action. A separate UI direction can still replace the visual styling later without changing this information hierarchy.

## DS-006: What can the demo claim as measured value?

- **Question:** Without real case outcomes or time-and-motion data, what counts as honest evidence that WorkLou adds value?
- **Why it matters:** A benchmark can prove system behavior, but it cannot prove real-world referral success or minutes saved by caseworkers.
- **Status:** Decided
- **Current behavior:** Report measured note-to-shortlist latency, deterministic match latency, agreement with a frozen human-authored expected-result set, factual-draft checks, complete workflow runs, and scheduled-job receipts. Label these as demo benchmark results, not field outcomes.
- **Evidence:** The demo uses mock cases and public service data, and Steve wants statistics that can be reproduced in front of judges.

## DS-007: What service data is trusted enough to drive recommendations?

- **Question:** Should every imported public record be eligible for automatic matching, even when its fields are vague or unconfirmed?
- **Why it matters:** Turning vague text into a hard eligibility decision would make a fast result look more certain than the source supports.
- **Status:** Decided
- **Current behavior:** Keep the complete public snapshot, but allow deterministic recommendation only from a curated demo subset whose required fields map cleanly to the canonical vocabulary and carry source evidence. Unknown or ambiguous values remain unknown and enter verification; they never become an inferred match or exclusion.
- **Evidence:** The 226-row mock file is real public-source data, but the backend audit found that most of its useful fields are not currently mapped into matching facts.

## DS-008: Where does AI stop and deterministic behavior begin?

- **Question:** May an LLM reinterpret vague case or service words during matching?
- **Why it matters:** If matching asks an LLM what two vague labels mean, speed and repeatability cannot be guaranteed.
- **Status:** Decided
- **Current behavior:** AI may propose structured context from fragmented mock notes and draft prose. A schema validator plus worker approval creates the matching input. Service ingestion uses explicit reviewed mappings. Matching, exclusions, ranking, latency measurement, and metric calculation use code and database queries only. Ambiguity becomes `unknown` or a validation error.
- **Evidence:** Steve requires fast, accurate, repeatable matching without an LLM call in the query path.

## DS-009: What proves the two background jobs are genuinely running?

- **Question:** Is a configured schedule enough, or must the demo show completed executions over time?
- **Why it matters:** A cron expression proves intent; timestamped run records prove that the deployed system actually executed.
- **Status:** Decided
- **Current behavior:** Run updater and discovery once daily in Base44. Keep the platform execution history and a Postgres run receipt with job name, scheduled/manual trigger, start, finish, duration, status, counts, and errors. The demo evidence gate is seven consecutive daily receipts for each job before judging day.
- **Evidence:** Steve wants judges to be able to see that both jobs have actually run every day, not only hear that they were configured.

## DS-010: Where should Bright Data execute?

- **Question:** Should deployed Base44 jobs invoke the Bright Data CLI, or call the Bright Data APIs that the CLI wraps?
- **Why it matters:** The CLI is convenient for local testing, but making it a hosted dependency would add runtime and installation risk to two scheduled jobs.
- **Status:** Decided
- **Current behavior:** Use Bright Data CLI locally to run, time, and reproduce both `search` and `scrape`. In Base44's Deno serverless functions, call the corresponding SERP and Web Unlocker REST APIs directly with equivalent settings. Bright Data never runs in the caseworker recommendation request path.
- **Evidence:** Bright Data documents the CLI as a Node.js 20+ package and exposes `search` and `scrape`; Base44 documents its backend functions as Deno-powered serverless functions intended to call third-party APIs.

## DS-011: How is Bright Data search quality judged?

- **Question:** Is a plausible-looking result list enough to accept discovery quality?
- **Why it matters:** Search ranking can look reasonable while missing known relevant services or returning duplicate and irrelevant pages.
- **Status:** Decided
- **Current behavior:** Freeze human-labeled discovery queries and known source URLs before tuning. Measure Precision@5, known-service recall within two pages, duplicate/junk rate, retrieval success, structured-fact yield, and p50/p95 external latency. Keep these results separate from deterministic Postgres matching metrics.
- **Evidence:** Steve identified search speed and result quality as the constraints, while confirming that Base44 credits are available for repeated testing.
