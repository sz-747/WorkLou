# Product Definition — Lou's Place Referral Navigator

## What this is

A referral lookup tool for Lou's Place caseworkers. After a caseworker has spoken with a woman and understands what support is needed, the tool helps them quickly find accurate, current information about external community services (housing, food, legal, health, Centrelink, DFV, financial assistance).

## What this is NOT

- Not a caseworker replacement. AI never decides what a woman needs, whether she should be referred, or which service is "best."
- No conversation analysis, no crisis decision-making, no case management, no autonomous agents.
- Not a replacement for Lou's existing spreadsheet — a canonical middle layer maps data in from any source (Excel/CSV, CRM, database, API).

## Design principle

**Probabilistic at the edges, deterministic at the core.**

LLMs may:
- Parse a natural-language request into structured search fields
- Extract structured facts from official service webpages

LLMs may NOT:
- Decide what support is needed
- Make or rank referrals on subjective safety judgements
- Invent service information
- Act autonomously

## Core flow

1. Caseworker talks with the woman normally (outside the tool).
2. Caseworker types a short natural-language request, e.g. "Emergency accommodation tonight for a woman with two children near Redfern."
3. LLM converts it into structured parameters (service_type, urgency, children_allowed, location, walk-in/appointment/referral needs). Parameters are shown as editable chips — the worker can correct any misreading.
4. Deterministic logic searches the referral dataset using those parameters.
5. A small set of matching services is shown with: name, what it provides, eligibility, opening hours, location, children accepted, walk-in/appointment, referral requirements, phone, website, source, last verified date, verification status.
6. Match reasons are shown ("Matches: ✓ emergency accommodation ✓ accepts children ✓ open today ✓ near Redfern") and uncertainty is visible ("capacity unknown", "verified 21 days ago").
7. The CASEWORKER chooses the service. Final decision is always human.

## Data architecture

Canonical Service schema (middle layer): id, name, service_types, description, suburb, address, lat/lng, eligibility, min/max age, children_allowed, opening_hours, walk_in_allowed, appointment_required, referral_required, phone, email, website, source_url, source_type, last_verified_at, verification_due_at, verification_status, internal_notes, created_at, updated_at.

Unknown values stay unknown — never defaulted to false.

MVP data: 24–30 clearly labelled sample services (inner Sydney); CSV import so Lou's real spreadsheet can be mapped in. Search and verification logic is independent of the source format.

## Background verification system

The main technical problem: stale referral information.

Scheduled job (daily) plus a "Run verification now" button, sharing one code path:
1. Find services due for verification.
2. Fetch the authoritative source (official website / government directory).
3. Extract supported factual fields (hours, phone, address, eligibility, children, access requirements).
4. Compare extracted vs stored values (normalized).
5. Match → update last_verified_at.
6. Differ → flag the field for human review ("Possible change detected: stored 9am–5pm, source 9am–3pm — [Approve update] [Keep existing] [Open source]").
7. Never auto-overwrite important information without review. Failures stay visible and retry later.

For the hackathon: local source fixtures supplement real URLs so the demo is reproducible.

## Verification dashboard (admin)

Total services, verified, stale, awaiting review, last run, changes detected. Per flagged change: field, stored value, extracted value, source, timestamp, approve/reject/open-source.

## Caseworker UX

One screen. Large input: "What kind of service are you looking for?" → editable extracted filters → results in a few clicks. No dashboards in the frontline flow. A non-technical frontline worker must understand it immediately.

## Evaluation system (prove value, not just that it works)

Scenarios with known-valid services in the test dataset. Metrics calculated from actual runs — never fabricated:

Search: Valid Referral Rate, Invalid Referral Rate, Referral Coverage, Time to Valid Referral.
Verification: change-detection recall, false-positive rate, extraction accuracy, latency — via controlled changes (e.g. 30 services, 8 deliberately changed, how many of the 8 detected).

An eval page shows results with pass/fail details.

## Human-in-the-loop (high-trust environment, always visible in UI)

- Information has sources
- Verification timestamps shown
- Uncertain information labelled
- Flagged changes require human review
- Final referral decisions are always made by staff

## Out of scope for MVP

Autonomous caseworker agents, distressed-conversation analysis, continuous audio recording, crisis decision-making, full case management, complex documentation, generic AI email assistant.

## Future extensions (architecture stays open)

1. Shared inbox / referral communications — service replies ("we're at capacity today") extracted into operational status, complementing website verification.
2. Deliberately-activated live translation.
3. Multi-organisation support on the same canonical schema with org-specific notes.

## Stack (agreed)

Next.js + PostgreSQL, provider-neutral LLM adapter, docker compose. If the LLM is unavailable, workers can enter filters manually.

## Hackathon success criteria

1. Caseworker types a natural-language need → structured criteria.
2. Deterministic matching returns suitable services.
3. Every service shows source + verification info.
4. Scheduled verification detects stale information.
5. Staff review and approve detected changes.
6. Eval screen shows real measured accuracy.
7. Simple enough for a non-technical frontline worker to use immediately.
