# Demo Walkthrough — One Caseworker End-to-End Scenario

The clean synthetic demo scenario: **CASE-2026-001 — "Amira" (synthetic)**, a woman
escaping DFV who needs crisis accommodation. It exercises the entire caseworker
workflow end to end. The current database holds the **completed** run described
below; to re-run from scratch, reset first (see the end of this file).

Seed facts used: the original notes on the case, and the seeded service database
(5 services, 21 `service_attributes` rows with provenance/freshness).

## The workflow, step by step — with expected database changes

All steps happen on the case workspace: **Women → CASE-2026-001**. Nothing is ever
transmitted to a provider by the tool — drafts are for the worker to review and send.

### 1. Context — notes → draft → review → approve
1. Stage 1 "Context": the rough notes are pre-filled. Click **Extract draft context**
   (live LLM extraction).
   - *DB:* `cases.original_notes` re-saved; **new `case_contexts` row** (always a new
     version — existing versions are never overwritten) with `status='draft'` and
     the extraction model recorded in `extraction_model`.
2. In the yellow draft form, correct anything (e.g. suburb) and set who stated each
   item (e.g. *urgency* and *safe contact method* → **worker observation**).
   Click **Save changes**.
   - *DB:* the draft row's `context` jsonb is updated, **including the
     `field_sources` tags** (woman-stated vs worker-observation per field).
3. Click **Approve v1**.
   - *DB:* that context row becomes `status='approved'` with `approved_at` stamped.
     Stages 2–4 only ever use the latest APPROVED context.

### 2. Find support — deterministic matching
1. Stage 2 "Find support" now lists suitable services with per-criterion evidence,
   source and freshness: **Watershed** (2 needs matched) and **Southside** (1),
   with Watershed's *pets* fact shown as **needs provider confirmation** and its
   cost/wait facts flagged stale. "Not suitable" services are listed with reasons.
   - *DB:* no changes — matching is a read-only deterministic SQL query (no LLM).

### 3. Verify — provider-only unknowns
1. Stage 3 "Verify": click **Watershed**. Known-from-machine facts are listed
   (source + retrieved date); only genuinely provider-only unknowns need a human.
2. In the *pets* form enter value **welcome**, confirmed by **Caseworker — phone**,
   click **Save confirmation**.
   - *DB:* the EXISTING `service_attributes` row is updated in place —
     `value='welcome'`, `source_type='provider_confirmed'`, `confirmed_by`,
     `confirmed_at`, `retrieved_at`. **No duplicate fact row is created**; the
     confirmation is shared knowledge visible to every future case. Find support
     immediately shows "pets: matched — Caseworker confirmed".
   - Trying to generate a second referral while one is open is blocked (see step 4).

### 4. Refer — draft → worker review → mark sent
1. Stage 4 "Refer": pick **Watershed**, keep the pre-checked minimal share set,
   click **Generate referral draft** (live LLM, only the ticked items + stored
   service facts enter the draft).
   - *DB:* **new `referrals` row** — `status='draft'`, `draft_text`,
     `shared_fields` (the ticked keys), linked to the approved context and service.
   - Duplicate guard: generating another draft for the same service while the
     referral is open (draft/sent/responded) is **rejected with an error**; a new
     referral to that service is only possible after a final outcome closes the old one.
2. Edit the draft text, **Save changes** → *DB: `draft_text` updated (draft-only)*.
3. **Mark as sent** (follow-up due pre-filled one week out).
   - *DB:* `status='sent'`, `sent_at` stamped, `follow_up_due` set. Nothing is
     transmitted — this is a DB-only state change.

### 5. Follow up — response → outcome
1. Stage 5 "Follow up": record the provider's reply ("Save response").
   - *DB:* `referrals.status` → `responded`; **new `referral_events` row**
     (`kind='provider_response'`) on the referral timeline.
2. **Draft follow-up message** (live LLM, stored data only) — shown for review;
   nothing is sent automatically.
   - *DB:* **new `referral_events` row** (`kind='follow_up_draft'`).
3. Record the outcome: **Support received** + notes → the referral closes.
   - *DB:* `outcome='support_received'`, `outcome_notes`, `outcome_at`,
     `status='closed'`; **new `referral_events` row** (`kind='outcome'`).
     Closed referrals accept no further responses/outcomes. "Support received" is
     distinct from merely sent/accepted — support was actually delivered.
   - My Work: while open and due, the referral appeared under **Follow-ups due**;
     once closed it leaves that list.

### 6. Document — case note drafted from stored data
1. Stage 6 "Document": click **Draft case note** (live LLM) — drafted only from the
   stored notes, approved context (woman-stated vs worker-observed), referrals,
   provider confirmations and follow-up activity, with the original appointment
   notes shown unchanged beside it.
   - *DB:* **new `case_documents` row** `status='draft'`.
2. Review/edit against the original notes, **Save edits**, then **Approve as final**.
   - *DB:* `draft_text` updated; `status='approved'`, `approved_at` stamped.
     Approved notes are read-only forever; original notes are never modified.

## Current demo end-state (what the DB holds after the completed run)

| Table | State |
|---|---|
| `cases` | 1 case (CASE-2026-001), original notes unchanged |
| `case_contexts` | v1 approved, `field_sources` tags intact |
| `service_attributes` | Watershed `pets` = welcome, provider_confirmed (Caseworker — phone) |
| `referrals` | 1 referral: Watershed, closed, outcome support_received, sent 2026-09-05, follow-up due 2026-09-12 |
| `referral_events` | 3: provider_response, follow_up_draft, outcome |
| `case_documents` | 1 approved case note |

## Admin demo paths (verify after the case flow)

All on **Admin** (`/admin`). None of these touch the demo case's data.

1. **Service corrections** — open a service (e.g. Watershed), correct a fact with your
   name. The change applies in place, is append-only in `service_change_log`, and
   the caseworker Find-support results reflect it immediately (same shared rows).
2. **Updater** — click **Run updater now** (or `curl -X POST
   "http://localhost:3000/api/updater/run?trigger=manual"`). Fixture-backed seeded
   sources refresh freshness in place (stale → verified_machine); any value change
   becomes a pending update candidate for human review. Idempotent — rerunning
   creates nothing new (2026-09-06 live run: 7 checked, 3 sources ok, 0 failed,
   9 refreshes).
3. **Discovery** — click **Run discovery now** (or `curl -X POST
   "http://localhost:3000/api/discovery/run"`). SERP → candidate queue, deduped
   against known services and previous candidates. Idempotent (2026-09-06 live
   run: 20 results, 1 new candidate, 14 skipped as known/queued, 5 source
   failures logged — never canonical). Approve a pending candidate to create the
   canonical service from its evidence, or reject it.
4. **Excel migration** — upload the demo CSV (`docs/synthetic-lou-service-list.csv`)
   → rows stage verbatim with match status → import/discard per row. Importing a
   matched row only fills empty fields (never overwrites); a new row creates a
   service with `excel_import` provenance and needs flagged for provider
   confirmation. Decided rows never re-decide. **Export** canonical services back
   to CSV via `GET /api/services/export`.

## Re-running the demo from scratch

1. Reset the case's workflow data (keeps the case, notes and all service knowledge):
   ```sql
   delete from case_documents where case_id = '<case-id>';
   delete from referrals where case_id = '<case-id>';       -- cascades referral_events
   delete from case_contexts where case_id = '<case-id>';
   ```
   (Optionally also reset the Watershed pets fact to the seeded unknown:
   `update service_attributes set value='unknown', verification_status='needs_provider_confirmation',
   source_type='excel_import', confirmed_by=null, confirmed_at=null where key='pets';`)
2. Run the steps above in order. Expected row counts as you go: +1 context on
   extraction, +1 referral on draft, +1 event per response/follow-up-draft/outcome,
   +1 document on case-note draft.
