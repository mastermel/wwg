# 0035. The Umpire sends an army intelligence: allies' positions, enemy sightings, a note

- **Date:** 2026-11-21
- **Status:** Accepted, not built yet (step 70; refines 0020)

## Context

At the start of a campaign the Umpire gives each army's commander a little intelligence, mostly
where their allies are. Decision 0020 lets intelligence reach a commander only by an ally's report
(by courier) or by sightings the Umpire shapes as a turn starts, and those sightings are of enemy
hexes only. The Umpire needs to send an army a report of their own: a note, and where any units
they choose are, from any army, allied or enemy.

## Decision

- **An Umpire's report is an `IntelReport` with no sending army** (`FromUmpire`), so it sits in
  the recipient's Intelligence panel beside allies' reports, marked "From the Umpire". It has no
  courier: it arrives at once, on the open turn (`SentTurn` = `ArrivedTurn`), and the Couriers
  panel and `Couriers.RideAsync` leave it out.
- **The Umpire picks the units**, from any army, and writes a note (up to 1,000 characters).
- **Units of the recipient's side are exact positions:** a snapshot entry each (name, type, hex,
  points), now naming its army, as an ally's report's snapshot does.
- **Units of the other side are sightings**, shaped as the Umpire's sightings are (decision 0020):
  one per hex of the chosen units, prefilled, with the hex or only roughly where, army and nation,
  unit types, and strength exact, rough or hidden. They're `Sighting` rows (`ByUmpire`) on the
  open turn, so they're drawn and fade like any sighting. A sighting covers only the chosen units
  in its hex, not the rest of it.
- **What it records is copied in**, from where the units stand at the open turn's start, never
  where this turn's orders take them (that would give away an ally's orders). Unit ids aren't
  included. The visibility rule doesn't widen.
- Once received, its sightings are the recipient's like any other, so they go on in the
  recipient's own reports ("all sightings received"); its snapshot doesn't, as a commander's
  snapshot is of their own army only.

## Consequences

- `IntelReport.FromArmyId` becomes nullable, allowed only for an Umpire's report; a snapshot
  entry gains its `ArmyId`, and a report its sightings made with it.
- Every place that assumes a report has a sender or a courier (the couriers list, the "sent"
  reports, `SightingCount`) needs checking.
- A snapshot entry whose army is later deleted shows as an army no longer in the campaign.
- New: an Umpire-only endpoint to send one, and a modal to write it.
