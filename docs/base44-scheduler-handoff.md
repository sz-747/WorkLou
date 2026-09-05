# Base44 scheduler handoff

## Purpose

Run the existing WorkLou updater and discovery processes from Base44's native automation system. Postgres remains the canonical database. The Base44 functions are intentionally thin wrappers around the existing protected HTTP routes.

## Branch content to inspect

- `base44/functions/run-worklou-updater/`
- `base44/functions/run-worklou-discovery/`
- `base44/shared/run-worklou-job.ts`
- `src/app/api/updater/run/route.ts`
- `src/app/api/discovery/run/route.ts`
- `src/lib/scheduler-auth.ts`

## Required Base44 secrets

- `WORKLOU_APP_BASE_URL`: the published HTTPS origin of the WorkLou Next app, with no path.
- `SCHEDULER_SECRET`: one new random secret. The exact same value must be supplied to the Next app and the two Base44 functions. Never put the value in GitHub or chat.
- Existing application secrets: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `BRIGHT_DATA_API_KEY`, and `BRIGHT_DATA_SERP_ZONE`.

## Safe activation order

1. Confirm Base44 is reading the expected GitHub repository and commit.
2. Confirm whether this app expects functions under `base44/functions/` or root `functions/`. Adapt the two wrappers to Base44's actual project layout without duplicating them.
3. Configure the two required secrets.
4. Deploy both functions with their automations still inactive.
5. Manually run `runWorkLouUpdater`; require an HTTP 200 and a completion log.
6. Manually run `runWorkLouDiscovery`; require an HTTP 200 and a completion log. It deliberately calls `limit=1` to keep the demo run bounded.
7. Confirm the expected Postgres run or candidate changes.
8. Change both `is_active` values to `true`, deploy again, and confirm both appear as active in Base44 Automations.

## Important boundaries

- Do not recreate the updater or discovery business logic in Base44.
- Do not move the canonical data into Base44 Entities or its NoSQL database.
- Do not add Web Unlocker.
- Do not expose the scheduler secret in logs, source files, or chat.
- Do not activate either schedule until its manual run succeeds.

## Prompt to paste into Base44

```text
Do not edit anything yet. First verify exactly what GitHub source you can access.

Expected repository: sz-747/WorkLou
Expected branch: project-status-overview

Check whether you can read that branch and report:
1. the repository name;
2. the branch name and latest commit SHA you can see;
3. whether these files exist:
   - docs/base44-scheduler-handoff.md
   - base44/functions/run-worklou-updater/function.jsonc
   - base44/functions/run-worklou-discovery/function.jsonc
   - src/app/api/updater/run/route.ts
   - src/app/api/discovery/run/route.ts

If you can only access main, or those files are missing, stop. Tell me that the feature branch is not available and do not recreate anything from older code.

If the expected branch and files are available, read docs/base44-scheduler-handoff.md completely. Then integrate the two thin Base44 functions with the existing backend. Do not recreate the updater or discovery business logic. Do not move the Postgres data into Base44 Entities. Do not add Web Unlocker. Do not change the UI.

Confirm whether this project expects native functions under base44/functions/ or root functions/. Adapt the supplied wrappers to the correct Base44 layout without keeping duplicate copies.

The two functions must call the existing protected routes:
- POST /api/updater/run?trigger=scheduled
- POST /api/discovery/run?trigger=scheduled&limit=1

Use the same SCHEDULER_SECRET value in the WorkLou app and both functions. Store it only in Base44 secrets. Configure WORKLOU_APP_BASE_URL as the published HTTPS origin. Do not print either secret.

Deploy both functions with their schedules inactive. Run runWorkLouUpdater manually and require HTTP 200 plus a completion log. Then run runWorkLouDiscovery manually and require HTTP 200 plus a completion log. Confirm the expected Postgres run or candidate changes. Only after both manual checks pass, change both is_active values to true and deploy again.

Finish by reporting the deployed function names, schedule status, last manual run result, duration, and any remaining blocker. Do not claim success without the Base44 execution logs.
```
