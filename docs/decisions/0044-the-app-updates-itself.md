# 0044. The app reloads itself into a new deploy, and a new API build drops the saved data

- **Date:** 2026-11-23
- **Status:** Accepted

## Context

A new front-end showed an "Update available, Reload" prompt, but only once the browser had looked
for a new service worker, which it does on a page load. An app left open, or an installed PWA
brought back from the background, could run an old front-end against a new API for days.

The offline cache was dropped only when the API contract changed (0043), so a change in what the
API returns that kept its shape left the saved data in place.

## Decision

- No prompt. When a new front-end has downloaded, the app activates it and reloads.
- A running app asks for a new service worker every 5 minutes, and when it comes back into view
  or back online.
- Every API response carries `X-Api-Build`: the API assembly's module version ID. .NET builds are
  deterministic, so it changes when the API's code or references change, and not for a deploy
  that only changes the front-end. (The image tag would change on every deploy.) The front-end
  keeps the last one seen in localStorage. When a response's build differs from the one the page
  started with, it reloads, picking up any new front-end at the same time.
- The offline cache's buster is the build the page started with plus the contract hash, so the
  reload starts without the old API's data. No clearing is needed, so nothing can race with a
  save in flight.
- It reloads only when nobody's typing: at once, unless a text field has focus or a modal is open,
  then as soon as neither is true. Drawers don't count: the map's hex drawer stays open while
  the map is in use (a focused field in it still does).
- The account menu's "Update and reload" stays, and goes at once.

## Consequences

- Open apps reach a new deploy within minutes, or on their next API call for an API change.
- Something half-typed in a field that has lost focus, outside a modal, can still be lost on a
  reload.
- A dependency update that keeps its assembly version (most patch releases) doesn't change the
  API build, so it neither reloads apps nor drops their data. Its responses almost always keep
  their shape, and restored data is refetched as soon as the app is online.
- The first visit after this ships has no saved build, so the next load drops the saved data once.
- In development, restarting the API after a code change reloads the open page and drops its
  saved data.
