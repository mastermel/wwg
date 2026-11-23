# 0043. The API reports the version, and the offline cache is busted by the API contract

- **Date:** 2026-11-23
- **Status:** Accepted; the buster and update prompt amended by [0044](0044-the-app-updates-itself.md)

## Context

CI passed the image tag (a new timestamp on every run) into the Vite build, which baked it into
the bundle for the About page and used it as the offline query cache's buster. So every image
build produced a different bundle: the front-end stage could never come from Docker's build
cache, and every deploy discarded everyone's saved offline data and showed the "Update available"
prompt, even when nothing in the front-end had changed.

## Decision

- The version is a runtime setting of the API, `App:Version`, which the Dockerfile sets from the
  `APP_VERSION` build argument in its final stage (after every build step). `GET /health` returns
  it alongside the status, and the About page shows it from there. The front-end and API ship in
  one image, so one version covers both.
- The offline cache's buster is a hash of `api/openapi.json`, computed when the front-end is
  built. The contract is what decides the shape of the saved responses.

## Consequences

- The same code always builds the same bundle, so the image build's front-end stage is cached,
  and the e2e job's build can be reused by the `docker` job.
- A deploy that changes nothing in the front-end shows no update prompt and keeps the offline
  data. One that changes the contract still clears it.
- A change in what the API returns that doesn't show in the contract (the same shape, different
  meaning) no longer clears saved data. Restored data is refetched as soon as the app is online,
  so it's only stale while offline.
- The About page shows the version only while the API is reachable ("Unknown" offline).
