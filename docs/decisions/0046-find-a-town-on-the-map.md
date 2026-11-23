# 0046. Everyone can find a town on the map

- **Date:** 2026-11-23
- **Status:** Accepted

## Context

Place search (0009) was for the Umpire only, to frame the campaign's area on the settings page.
Players reading orders or reports that name a town had to find it by eye on the map.

## Decision

- A separate endpoint, `GET /api/campaigns/{id}/map/towns?search=`, for every member. It searches
  only for towns and villages (not regions or countries), asks the geocoder to look inside the
  campaign's area (`bbox`), and drops anything whose hex isn't in the grid, since the services
  only prefer the area. Each result carries its hex (`q`, `r`), worked out on the server as other
  DTOs carry their hex's centre.
- The Umpire's place search is unchanged, so each endpoint keeps one access rule.
- The Map page has a **Find a town** box over the map. Choosing a result shows its hex as a hex
  named in a panel does (0040): its drawer opens and the map centres on it.
- The box also lists the game's own named towns, cities and fortresses (step 42b) first, matched
  in the browser from the grid every member already loads; then the real world's places.

## Consequences

- Both endpoints share the `places` rate limit (30 a minute per IP). Players at one table, on
  one network, share it; a debounced search uses a few requests, so that's enough for now.
- Without a MapTiler key, more searches go to Photon's public server (fair use).
- Neither list shows anything a player couldn't already find on the map: real-world geography
  isn't secret, and every member's map draws the game's settlements and their names.
