# AGENTS.md — Branch/Session Rules

These rules apply to every new branch/session on this repository. Follow them exactly.

## Session start

1. **Start from the latest main.** Every new branch is cut from the current `main`. Do not continue stale work from an old branch.
2. **Do not rebuild from memory or chat history.** The docs are the source of truth, not what you remember.
3. **Read these files before doing any work:**
   - `docs/product.md` — what the product is
   - `docs/build_plan.md` — the phases and their scope
   - `docs/implementation_plan.md` — technical detail for the current phase
   - `docs/implementation_logs.md` — what has been built so far, and how it was verified

## During the session

4. **Work only on the requested phase.** Do not start the next phase, even if it seems trivial or obviously follows.
5. **Keep changes minimal.** Change only what the requested phase requires.

## Session end

6. **Test what you built.** Verify the work end-to-end before reporting done.
7. **Update the docs.** Record what was built and any decisions made (implementation logs, plan status).
8. **Provide short manual test steps.** The user will test personally before merging the branch to main.

## Verification checklist (before reporting done)

- [ ] Branched from latest main
- [ ] Read all four docs files before starting
- [ ] Only the requested phase was touched
- [ ] Work was tested
- [ ] Docs updated
- [ ] Manual test steps written out for the user
