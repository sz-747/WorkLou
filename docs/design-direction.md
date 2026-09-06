# Lou's Place Casework Tool — Design

## Design objective
Design for a caseworker who has just finished a difficult conversation and is thinking: **What does this woman need, and what do I need to do next?**

## Core rule
**One screen = one primary task or decision.**

The product is a workflow tool, not an analytics dashboard.

## User context
Caseworkers' expertise is listening, empathy, complex-case understanding, professional judgement and relationships. The product should require almost no technical understanding of databases, AI, matching engines or background jobs.

## Cognitive-load rules
1. Show only what is needed for the current task.
2. Give each screen one obvious primary action.
3. Prefer progressive disclosure.
4. Keep navigation predictable.
5. Never make workers re-enter information already captured.
6. Explain uncertainty without exposing backend complexity.
7. Use plain casework language.
8. Make safety/privacy choices explicit.
9. Allow moving backwards; casework is not perfectly linear.
10. Remove components that do not help the current decision.

## Information architecture

### Level 1 — My Work
Answers: **What needs my attention?**

Keep sparse:
- follow-ups due
- draft notes awaiting review
- recent women/cases
- new support request

Avoid organisation-wide metrics, decorative analytics and system-health information.

### Level 2 — Woman/case workspace
Answers: **What am I doing for this woman?**

Quiet case navigation:
**Context → Find support → Referral → Follow-up → Documentation**

Verification is a sub-step of Find support.

## Visual direction
Current direction (2026-09-06): preserve the existing glossy UI and align its layout, hierarchy and interactions with the Figma Claude page. Use Instrument Sans, translucent rounded surfaces, warm/cool pale gradients and clear orange focus/status cues. Keep primary and secondary actions distinguishable, readable contrast and reduced-motion support.

This supersedes the earlier forest/olive palette and prohibition on glassmorphism. The casework, evidence and cognitive-load principles in this document still apply. See the [Claude UI/UX audit](audits/figma-claude-ui-review.md) for frame coverage, functional gaps and decisions pending user review.

## Screen hierarchy
Every case screen should make these obvious:
1. Whose case?
2. What am I doing now?
3. What information matters?
4. What is known vs unknown?
5. What do I do next?

## Primary actions
- Context → **Find support**
- Service → **Check details**
- Verification → **Prepare referral**
- Referral → **Mark as sent**
- Follow-up → **Record response**
- Documentation → **Approve note**

Secondary actions visually recede.

## Context
Do not use a giant intake form. Show original notes and extracted structured context with review/edit controls. Allow correction of both facts and `woman_stated` vs `worker_observation` tags.

## Find support
Do not default to a dense comparison table. Show a short shortlist; each result answers: what is it, why might it fit, what is uncertain/incompatible, and what is the next action.

## Evidence/freshness
Translate backend evidence into useful language such as:
- Current from provider website
- Provider confirmed
- Last checked recently
- Needs provider confirmation
- Information may be stale

Unknown is a legitimate state.

## Verify
Show what is already confirmed and only the remaining provider-only questions. Do not ask workers to manually verify machine-accessible information.

## Referral
Clearly show destination, proposed shared information, woman-stated vs worker-observation distinction, referral draft and follow-up date. Sharing is minimal by default; internal observations are not pre-selected.

## Follow-up
Focus on one case/referral at a time: concise timeline, current status, next action, due date and optional follow-up draft.

## Documentation
Keep original notes visible or one click away. Generated text is visibly a draft requiring worker review and preserves Woman said / Worker observations separately.

## Backend invisibility
Workers should not need to see Postgres, Bright Data, cron jobs, LLM calls, extraction traces or raw scraper output. They should experience fresher information, better matching, explicit uncertainty and less repeated work.

## Reliability
Prefer deterministic UI and structured queries. AI should only be used where it materially removes manual work; if AI fails, the worker should still be able to continue manually.

## Instruction for Codex + Paper
Do not optimise for filling canvas space. Start from the worker's current decision and remove anything that does not help it.

For every component ask:
**If this disappeared, would the worker be less able to help the woman or complete the current task?**
If not, remove or defer it.
