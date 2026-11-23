# 0042. CI redeploys the production stack through the Komodo API

- **Date:** 2026-11-23
- **Status:** Accepted

## Context

CI pushes a new image to Docker Hub on every commit to `main`, but the `wwg` Komodo stack only
picked it up when Komodo next polled for newer images, up to an hour later (0006 left how Komodo
picks up images to be set up separately).

The options were a stack webhook, Komodo's `km` CLI, or a direct call to Komodo's HTTP API. The
webhook expects a signed GitHub push payload, so CI would have to forge one with Komodo's
webhook secret, which the resource sync shares. The CLI would be installed on every run for a
single request.

## Decision

- A `deploy` job runs after `docker` on `main` and calls `POST /execute` with `DeployStack` for
  the `wwg` stack. Komodo pulls `latest` before `compose up`.
- The call returns before the deploy finishes, so the job polls the update (`/read`,
  `GetUpdate`) until it completes, prints its logs, and fails if the deploy failed.
- It authenticates with an API key for a Komodo service user that has Execute permission on the
  `wwg` stack only. The key is in the `production` GitHub environment's secrets.
- The stack keeps polling for new images hourly as a fallback.

## Consequences

- A commit to `main` is live a few minutes after its checks pass, and a failed deploy shows up
  as a failed CI run.
- Setting it up needs manual steps outside the repo: the service user, its permission and API
  key in Komodo, and the `KOMODO_API_KEY` and `KOMODO_API_SECRET` secrets in GitHub.
- A leaked key can only redeploy the `wwg` stack.
