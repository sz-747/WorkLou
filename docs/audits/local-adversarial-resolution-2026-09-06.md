# Local adversarial resolution

Date: 2026-09-06

## Verdict

**Resolved for the local, synthetic-data demo boundary.** The ten isolated workflows pass against the exact 226-row, 67-column prototype CSV and local Postgres. The production build, TypeScript check, regression suites, and representative HTTP routes are green.

This verdict does not cover Base44 deployment state, scheduled-job receipts, live Bright Data availability, or a live OpenRouter call.

## Ten-workflow evaluation

Command: `npm run eval:workflows`

- Source: `D:\WorkLou\NSW-shelter-prototype-data\base44_services_import.csv`
- Input: 226 rows, 67 columns, six controlled demo services
- Result: 10 of 10 workflows passed, 266 checks
- Deterministic match latency: 0.255 ms median, 11.216 ms maximum (first/cold case)
- Full database workflow time: 631.4 to 955.0 ms per workflow
- Isolation: every workflow stages all 226 rows, imports a fresh copy of the six demo services, completes its own case lifecycle, and cleans up afterward

The workflows cover crisis accommodation, family and pet constraints, temporary visa and nil-income uncertainty, geography, child exclusions, referral-only gateways, rehabilitation, language confirmation, and provider-only pet-policy confirmation.

Each run covers raw-note revision, structured context draft/edit/approval, deterministic matching, provider confirmation, referral draft/edit/sent, provider response, accepted-versus-support-received handling, and case-document draft/edit/approval. The structured context and draft prose use deterministic fixtures/fallbacks; the evaluator deliberately does not call a live LLM.

## Regression and runtime evidence

- Twelve database/domain suites: 270 passed, 0 failed
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Production build: `npm run build` passed
- Compose validation: `docker compose -f docker-compose.base44.yml config --quiet` passed; the unset optional host suffix produced only a warning
- Production HTTP smoke: `/`, `/women`, `/admin`, and `/api/services/export` returned HTTP 200
- Cleanup receipt: zero `DEMO %` services, zero `EVAL-%` cases, and zero `TEST %` services remained in Postgres
- Independent fresh-context adversarial re-review: `RESOLVED`

## Resolved blockers from the original audit

- Approved contexts and documents are immutable; raw notes are versioned and linked to the exact context.
- The CSV preserves program name separately from provider organisation and maps structured eligibility, delivery, geography, source, and capacity fields.
- Routine follow-up defaults to five Sydney calendar days; urgent/crisis work defaults to the next Sydney calendar day.
- Accepted referrals remain open until support is actually received.
- Provider confirmation history is append-only and case-linked; volatile facts expire and cannot be presented as current.
- LLM calls have a bounded timeout and deterministic/manual fallback paths.
- Matching handles exact geography, delivery mode, children, visa, income, language, and expired capacity deterministically.
- Provider response/outcome writes and their timeline records are transactional.
- A production build/start path exists, and the Base44 environment-file mount is optional for local Compose use.

## Remaining external checks

1. Deploy or sync these local changes to Base44, then repeat the HTTP workflow there.
2. Trigger both Base44 background schedules and retain dated run logs for the demo.
3. Run a small live OpenRouter smoke to prove the timeout/fallback boundary with the configured Gemini model.
4. Run Bright Data SERP and page-fetch smoke checks with the deployed credentials.
5. Add authentication and scheduler protection before any public deployment or use of real Lou's Place data.
