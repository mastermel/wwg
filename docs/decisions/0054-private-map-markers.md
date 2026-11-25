# 0054. Everyone can keep their own markers on the map

- **Date:** 2026-11-25
- **Status:** Accepted

## Context

Players plan over several turns: where they mean to gather, a ford they want to hold, a town they
suspect the enemy is heading for. Nothing on the map let them note it; they kept notes elsewhere,
apart from the hexes they were about.

## Decision

- A **marker** (`MapMarker`) is one user's note on a hex of one campaign: a title (required,
  ≤100) and a description (optional, ≤200). Only its owner ever sees it, through the API as in the
  app; it stays until they remove it, whatever turn it is.
- It belongs to the **user** in the campaign, not their membership, so Admins (who may not be
  members) keep markers too. Deleting the campaign or the user deletes their markers; leaving a
  campaign keeps them, for if they come back.
- Every member and Admin may list, add, change and remove their own:
  `GET` / `POST /api/campaigns/{id}/markers`, `PUT` / `DELETE /api/markers/{id}`. Someone else's
  marker is a 404, as if it weren't there. At most 100 a user in a campaign (409).
- An Admin masquerading as a user (0012) sees that user's markers, as they see everything else
  as them.
- In the app, a hex's drawer lists the viewer's markers there and offers **Add a marker**. Its
  title starts as the hex's own name in the game (its town, city or fortress), else the largest
  real-world town or village in the hex (from the map tiles already loaded), else empty.
- Markers are drawn on the map as a pin with the title, and listed in a **My markers** panel,
  each a link to its hex. The map's layers have a **My markers** switch under Units & markers.

## Consequences

- Markers are kept with the rest of the campaign's data for offline use, on the owner's device.
- Moving a marker is removing it and adding another; there's no move.
- The real-world name depends on which tiles the browser has loaded, so it can differ with the
  zoom; it's only a starting title, which the viewer can change.
