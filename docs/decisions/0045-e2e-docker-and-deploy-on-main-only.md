# 0045. The e2e, docker and deploy jobs run on main only, never on PRs

- **Date:** 2026-11-23
- **Status:** Accepted

## Context

The `e2e` job ran on every PR as well as on `main` (0007). `docker` ran on `main` except for
PRs, and `deploy` ran only because it depends on `docker`.

## Decision

- `e2e`, `docker` and `deploy` each run only on `main`, for a push or a manual run
  (`workflow_dispatch`), and never for a PR. Each job states the condition itself rather than
  relying on the jobs it needs being skipped.
- PRs get the `api` and `web` jobs only.
- A manual run on `main` still runs every job, so it can rebuild and redeploy on demand.

## Consequences

- PR checks are faster and cheaper, but a PR can merge with a broken end-to-end flow. Run the
  suite locally (`./stack.sh up && npm run test:docker`) before merging a change it covers.
- An image that fails end to end still never reaches Docker Hub: `docker` waits for `e2e`.
- Only `api` and `web` can be required checks for PRs.
