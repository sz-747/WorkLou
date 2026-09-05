---
name: decision-surfaces
description: Expose hidden product and behavior choices before an agent plans or builds a non-trivial new project or major feature. Use automatically at planning boundaries when undefined choices would make the agent or software guess; do not use as a background monitor or for routine, well-specified changes.
---

# Decision Surfaces

Find the places where the project must choose a behavior but the requirements have not made that choice visible. Run once at the planning boundary, record material surfaces, and stop. This is an event-triggered reasoning pass, not an always-running service.

## What counts

A decision surface is a behavioral fork that the agent or software must cross. Different reasonable choices would materially change the user experience, authority boundary, stored truth, output, or definition of success.

An ordinary unknown is not automatically a decision surface. Do not promote facts that can be discovered from the repository, documentation, deployed state, or a small experiment. Do not turn low-level implementation details into questions for the user when engineering can choose them safely.

Useful lenses include:

- who may start work and what inputs are accepted
- intended user, audience, outcome, and scope
- what counts as evidence and how conflicts are resolved
- required context and precedence when context disagrees
- what the agent may decide, change, delete, or publish
- when human judgment is required
- completion, blocked, failure, retry, and resume behavior
- source of truth, versioning, synchronization, and conflict ownership
- what may be learned from corrections and what needs approval
- how quality is judged and what evidence can reopen a decision

Use these as prompts for judgment, not as a questionnaire. Surface only choices that matter in this project.

## When to run

Run automatically:

- before finalizing the first plan for a non-trivial new project
- before finalizing a major feature whose behavior or authority boundaries are not already defined
- again only after a material scope change, architectural pivot, or newly discovered boundary invalidates the earlier scan

Skip routine fixes, narrow refactors, and work with explicit acceptance criteria. Do not reopen a decided surface merely because another plausible choice exists; require new evidence or changed scope.

The scan ends after the artifact and any necessary question are produced. It leaves no watcher, daemon, scheduled task, server, or resident process running.

## Workflow

1. Inspect the actual project state, current requirements, recent decisions, and relevant code before naming gaps.
2. Ask: where would the system still have to choose a materially different behavior without an explicit decision?
3. Resolve discoverable facts through research or a small check. Make low-risk, reversible engineering choices yourself and label them in the plan.
4. Create or update `docs/decision-surfaces.md` only when at least one material surface exists.
5. Ask the user only about strategy, priorities, protected authority, or trade-offs they must own. Ask one tight question at a time and include a recommendation.
6. Feed decided surfaces into requirements and plans. An unresolved surface blocks only the work that would otherwise encode that choice; unrelated safe work may continue.

## Artifact contract

Use one canonical project file: `docs/decision-surfaces.md`. Keep resolved entries so later agents do not reopen them accidentally. Give each surface a stable ID such as `DS-001`.

Each entry records:

- **Question:** the choice in plain language
- **Why it matters:** the materially different outcomes or the silent default that would otherwise be encoded
- **Status:** `Unresolved`, `Decided`, or `Deferred`
- **Current behavior:** the safe behavior until resolution, or the decision and its reason
- **Owner:** who must decide, when ownership is not obvious
- **Evidence:** relevant requirements, observations, or checks
- **Reopen trigger:** required for `Deferred`; optional for `Decided` when later evidence may invalidate it

Keep entries concise. A surface is a decision aid, not a mini-spec. Put implementation detail in the requirements or plan after the choice is made.

If no material surfaces exist, say so and do not create an empty file.

## Guardrails

- Never silently choose a plausible default for a material unresolved surface.
- Never dump every possible edge case into the artifact.
- Never make the user answer facts the agent can discover.
- Never treat `Deferred` as forgotten; name the event or evidence that reopens it.
- Never confuse runtime uncertainty, research evidence states, or a generic risk list with decision surfaces.
- Never leave anything running after the scan.
