# Lou's Place Casework Tool — UI Flow

## Global shell
Minimal global navigation:
- **My Work**
- **Women**
- **Services**

Utilities:
- search
- caseworker identity
- new support request

Inside a case, use quiet navigation:
**Context → Find support → Referral → Follow-up → Documentation**

Verification is a sub-flow of Find support.

---

## Screen 1 — My Work
**Question:** What needs my attention right now?

Show:
- follow-ups due today
- draft notes awaiting review
- recent women/cases
- New support request

Do not show metrics-heavy dashboards, service counts, analytics, database health or background-job status.

Primary action: **Open next piece of work**

---

## Screen 2 — Context
**Question:** Have we captured what matters from today's conversation correctly?

Show:
- rough notes from today
- extracted structured context
- `woman_stated` / `worker_observation` classification
- simple edit/review controls

Extraction remains draft until approved.

Primary action: **Find support**

---

## Screen 3 — Find Support
**Question:** Which services are worth considering?

Backend queries the canonical service database using approved context.

Show:
- compact requirements summary
- 3–5 useful service options

Each service shows only:
- service/type
- why it may fit
- incompatibility if relevant
- genuine unknowns
- useful freshness/source indicator
- next action

Statuses:
- Likely suitable
- Needs checking
- Not suitable

No percentage match scores.

Primary action: **Check details**

If no provider-only unknown remains, allow direct progression to referral.

---

## Screen 4 — Check Details / Provider Verification
**Question:** Is there anything we still need to ask this provider directly?

Show:
- service overview
- Already known
- Need to check
- provider contact details
- concise previous provider confirmations where relevant

Only show questions that cannot reasonably be resolved automatically.

Worker records provider confirmation with contact, answer, timestamp and note; it becomes shared service knowledge with `provider_confirmed` provenance.

Primary action: **Prepare referral**

---

## Screen 5 — Referral
**Question:** Is this the right information to share?

Show:
- information-to-share controls
- minimal relevant core pre-selected
- sensitive/contextual information opt-in
- woman-stated vs worker-observation distinction
- destination
- editable referral draft
- next-follow-up date

Default follow-up: **5 days**, editable by worker.

Primary action: **Mark as sent**

For the hackathon, marking sent records state; external autonomous sending is not required.

---

## Screen 6 — Follow-up
**Question:** What happened, and what do I need to do next?

Show one case/referral:
- current status
- concise timeline
- next follow-up date
- next action
- provider response
- optional follow-up draft

Statuses/outcomes:
- Awaiting reply
- Further information requested
- Accepted
- Declined — eligibility
- Declined — capacity
- Referred elsewhere
- Support received
- Closed

Primary actions depend on state:
- **Draft follow-up**
- **Record response**
- **Close outcome**

Due follow-ups return to My Work.

---

## Screen 7 — Documentation
**Question:** Is this an accurate record of what happened?

Draft inputs:
- original appointment notes
- approved context
- referral activity
- provider confirmations
- follow-up/outcome activity

Show original notes beside or one click from the draft.

Draft sections:
- Woman said
- Current concerns
- Actions taken
- Referrals
- Worker observations
- Next steps

Optional document tabs:
- Case note
- Referral summary
- Support letter

Primary action: **Approve note**

---

# Admin / service-knowledge flow

Keep this separate from frontline casework.

## Services
Admin can inspect:
- canonical service details
- eligibility
- sources/provenance
- freshness
- machine-verified vs provider-confirmed facts
- change history

## Update review
Show candidate changes found by the existing-service updater. Admin can approve/reject uncertain or high-impact changes.

## Discovery review
Show new-service candidates found through Bright Data-backed discovery. Admin can inspect provenance, deduplication and approve/reject before canonical insertion.

The admin experience should also remain operational rather than analytics-heavy.

---

# Backend-to-UI relationship

The backend can be complex:
- Postgres canonical schema
- Excel import
- structured matching
- Base44 scheduled functions
- Bright Data API
- updater
- discovery
- provenance/freshness
- provider-confirmed knowledge

The caseworker UI should expose only the **decision-ready result**.

Conceptually:

`messy external data → structured canonical knowledge → case-specific query → distilled options → worker decision`

Do not design screens around the underlying database tables.

---

# Demo path for Paper

Design the screens around one synthetic case so the flow is visually continuous:

`My Work → Tayla/Amira Context → Find Support → Check Provider Details → Prepare Referral → Follow-up → Draft Case Note`

Prioritise this happy-path vertical slice first. Then design empty/error/unknown states after the core flow is coherent.

## Key design test
At every stage, the worker should be able to answer within seconds:

1. Where am I?
2. What do I know?
3. What still needs attention?
4. What is the next action?
