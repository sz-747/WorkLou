# Branch collaboration and production deployment

Current work branch: `codex/branch-production-workflow`, cut from main at `e8e924ff47ce02f2c58a60b03a8f570c0bb57462`.

## Collaborating

Each task starts from the latest main in its own branch or separate worktree, per AGENTS.md. Push that branch explicitly:

```sh
git fetch origin
git switch -c your-task-name origin/main
git push -u origin HEAD
```

If multiple people intentionally work on the same branch, fetch and integrate its latest commits before pushing. Use `git pull --rebase` on a clean working tree, resolve conflicts, rerun checks, then push normally. Never force-push shared work. Sharing a GitHub account does not isolate working directories or prevent conflicting edits; separate checkouts/worktrees do.

The `Branch checks` workflow runs on branch pushes and pull requests. Each run gets a disposable Postgres 16 database, applies the schema, seeds synthetic fixtures, runs all database suites sequentially, builds production output, and checks production HTTP routes. New pushes supersede older checks for that same ref; other branches run independently. No production credentials are needed by these checks, and no tests run against production data.

## Production runtime

The Dockerfile builds the existing Next.js application with the lockfile and runs its standalone server as the non-root `node` user. It includes static assets and accepts the host's `PORT`. Build context excludes local environment files. Secrets are supplied at runtime, never as Docker build arguments.

Required runtime configuration:

- `DATABASE_URL`: the persistent production Postgres database.
- `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`: extraction and drafting provider configuration.
- `SCHEDULER_SECRET`: needed for protected updater/discovery HTTP calls.
- `BRIGHT_DATA_API_KEY`, `BRIGHT_DATA_SERP_ZONE`: needed for live discovery.

The production database must already have the reviewed schema. The image does not run `drizzle-kit push --force`, reseed, or change schema at startup. For a new empty synthetic demo database only, initialize with `npm ci`, `npm run db:push`, and `npm run db:seed` in a separate setup job. Existing database changes require inspection, a backup, and reviewed SQL; Drizzle push does not detect all check-constraint changes.

## Deployment status and remaining wiring

Production is not configured by this branch yet. The repository has no hosting URL or recorded GitHub deployment. The existing Base44 scheduler bridge is not a Next.js hosting target and its schedules remain inactive.

Once the production host is identified, configure it to deploy this selected branch after `Branch checks` passes, verify the deployed commit SHA and HTTP routes, and record the live URL here. Other feature branches must not overwrite that deployment. Serialize deployments to the same environment and keep a prior successful release available for rollback. `main` stays unchanged until the user's later review and merge.

The application still has the documented synthetic-demo boundary: no caseworker sign-in or admin roles. Team Git collaboration does not add application access control. Use synthetic data for this release.

## Manual verification

1. Open this branch on GitHub and confirm `Branch checks` succeeds for its latest commit.
2. After hosting is configured, open its production URL and check My Work → Women → the synthetic case, plus Admin and Data check.
3. With production LLM configuration set, extract a draft from synthetic notes, review and approve it, and reload to confirm persistence.
4. Push another commit to the selected branch; confirm its checked commit reaches production and `main` remains unchanged.
