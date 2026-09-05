---
name: ce-plan
description: "Create or revise an implementation plan for multi-step work. Use when the user asks to plan, break down, or deepen a change; do not use to implement the plan."
---

# Implementation planning

Produce a durable plan that another Codex session can execute without inventing scope, behavior, or verification.

Planning is read-only except for the requested plan document. Do not implement code, change configuration, create issues, commit, or push.

## Workflow

1. Resolve the planning target. Read the user's request and any named specification, issue, existing plan, `STRATEGY.md`, project instructions, and relevant project memory. Update a named plan in place unless the user asks for another.
2. Inspect current reality before choosing an approach. Read the relevant code, tests, configuration, schema, documentation, and recent history. Inspect deployed or external state when the plan depends on it and access is available.
3. Separate verified facts, derived conclusions, and assumptions. Label unresolved assumptions in the plan and give each a check or decision owner.
4. Apply `decision-surfaces` once when the global handbook requires it for a non-trivial new project or major feature. Do not reopen settled decisions without new evidence.
5. Resolve facts through inspection. Ask Steve only about priorities, constraints, and trade-offs he must own. Ask one focused question at a time and include a recommendation.
6. Identify the highest-risk assumption. Put a small real-world spike or verification step before units that depend on it.
7. Split the work into dependency-ordered implementation units. Each unit must be independently checkable and end green before the next dependent unit begins.
8. Attack the draft: look for missing behavior, imagined current state, hidden scope expansion, weak verification, unsafe sequencing, and unlabeled uncertainty. Correct those problems before writing.

Do not use subagents unless Steve explicitly requests delegation, parallel agents, or a deepening pass that uses them.

## Plan artifact

For repository work, write Markdown under the repository's established plan directory. If none exists, use `docs/plans/YYYY-MM-DD-<descriptive-name>-plan.md`. Use repo-relative paths throughout. For non-repository work or when Steve requests chat-only output, return the plan in chat.

Keep the plan proportional. Include:

- Summary and intended outcome
- Current state and evidence inspected
- Scope and explicit non-goals
- Requirements or acceptance criteria
- Decisions, assumptions, and rationale
- Dependency-ordered implementation units
- Material risks and unresolved questions

Each implementation unit includes:

- **Goal:** one meaningful outcome
- **Dependencies:** preceding units or external prerequisites
- **Files:** expected repo-relative paths, when knowable
- **Approach:** decisions and boundaries, not implementation code
- **Verification:** an observable behavior, test, command, or real seam check

Add specific test scenarios when behavior changes. Include happy paths plus applicable boundary, malformed, failure, concurrency, and integration cases. Pure documentation, styling, or scaffolding units may state why no behavioral test applies.

## Completion gate

The plan is ready only when its scope matches the request, every unit has an independent completion check, dependencies are explicit, the highest-risk assumption is tested early, and an implementer can begin without guessing product decisions. Report the saved path and stop. Do not start implementation automatically.
