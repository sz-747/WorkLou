# Lou's Place Casework Tool — Product

## Product
A lightweight casework workflow system with two connected functions: **referral navigation** and **documentation**. It reduces repeated admin without replacing caseworker judgement or the human relationship with the woman.

## Current problem
Caseworkers currently take rough notes and later rewrite formal records; find services through an outdated Excel list, Google, websites, word of mouth and staff knowledge; deal with changing eligibility/capacity; make repeated referrals; and manually chase referrals over email.

## Five-step workflow

### 1. Context
Worker pastes/types rough appointment notes. The system extracts a lightweight structured case context, each item tagged `woman_stated` or `worker_observation`; the worker edits and approves it.

Initial context fields:
- needs
- suburb/catchment
- children
- pets
- income
- visa
- languages
- urgency
- safety/preferences
- safe contact method
- short summary

### 2. Find support
Approved context queries the structured service database. Matching is primarily deterministic/schema-based, showing why a service fits, incompatibilities, provenance/freshness and genuine unknowns; no fake percentage scores.

### 3. Verify
The backend resolves everything reasonably obtainable from machine-accessible sources. A human only intervenes when information genuinely requires direct provider confirmation; those confirmations are stored separately from machine-verified facts with source, timestamp and history.

### 4. Refer
Generate a factual referral draft from approved context. Sharing is **minimal by default**; sensitive/contextual fields are opt-in, woman-stated information stays separate from worker observations, and the worker reviews everything before marking it sent.

When marked sent, the worker chooses the next follow-up date with a sensible default of **5 days**.

### 5. Follow up + document
Track referral state through awaiting reply, follow-up, provider response, accepted/declined/referred elsewhere and **support received**. Draft follow-ups and case documentation are worker-reviewed; documentation uses original notes, approved context, referral activity, confirmations and outcomes.

Case-note sections:
- Woman said
- Current concerns
- Actions taken
- Referrals
- Worker observations
- Next steps

## Data architecture
Postgres is the hackathon's structured layer between Lou's Excel spreadsheet and the app, but should be designed as Lou's potential future canonical service database.

The schema should support:
- providers/services
- categories
- eligibility criteria
- catchments/locations
- contacts/referral methods
- source/provenance
- freshness/retrieval timestamps
- provider confirmations
- verification/change history
- lightweight case context
- referrals/follow-ups/outcomes
- case-note drafts
- update/discovery candidates

Machine-verified and provider-confirmed facts must remain distinct evidence types.

## Excel migration
Import Lou's existing spreadsheet through staging/normalisation. Initially Excel and Postgres can coexist; long term Postgres becomes the source of truth while Excel remains available for import/export.

## Background processes

### Existing-service updater
Base44 scheduler → backend function → direct official-source fetch where sufficient, or Bright Data API when broader scraping/search coverage is needed → compare against canonical facts → create update candidates → preserve provenance/history → apply safe changes or queue uncertain/high-impact changes for review.

### New-service discovery
Base44 scheduler → backend function → Bright Data API → discover relevant new community services → extract structured candidates → deduplicate → preserve provenance → admin review → approved candidates become canonical services.

Do not depend on running the Bright Data CLI inside Base44; call the API directly.

## Human/automation boundary
Automate retrieval, monitoring, discovery, structured matching, extraction/normalisation, drafting and reminders. Keep humans in control of case-context approval, source tagging corrections, provider-only verification, sensitive sharing, referral review, professional judgement and documentation approval.

## Long-term institutional memory
Woman-specific information stays with her case. Reusable provider facts, eligibility nuances, confirmations, service changes and referral outcomes become shared service knowledge with provenance/freshness so future workers do not repeatedly rediscover the same information.

## Hackathon scope
Use synthetic case data and a small realistic service dataset. No auth is required; assume one caseworker. Do not build a full CRM, automate professional judgement, autonomously contact providers, pretend unknown facts are known, or over-engineer analytics.

## Immediate value
Reduce repeated documentation, referral research, unsuitable referrals, duplicated context entry and manual follow-up so caseworkers can spend more attention supporting women.
