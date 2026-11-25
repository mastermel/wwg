# 0052. A force march is a hex a turn faster, on every ground

- **Date:** 2026-11-25
- **Status:** Accepted (refines 0018)

## Context

The rules (Campaign, §E.2) force march by moving "1 hex per turn faster during the 2 day turns".
Decision 0018 read that as a flat hex's worth more of the turn's movement. On flat ground that's
the same, but not elsewhere: infantry went four and a half hexes on a good road (not four), and
only half a hex more in low hills (not one), so two low-hill hexes by force march were refused.

## Decision

- A force march raises each of the unit's class's land rates by one hex a turn, where it can move
  at all: infantry 3 on flat ground, 4 on a good road, 2 in low hills, 1½ in high hills; still
  none in mountains. The turn's budget is unchanged (still 1, with the time-of-day march).
- The API's `MovementTable.ForceMarching` and the app's `forceMarching` (`marches.ts`) give these
  rates; a stack moving together by force march uses them for every unit.

## Consequences

- A path that mixes grounds goes by each step's faster rate. Infantry can no longer force march
  three good-road hexes and then a flat one, as they could before (¾ + ⅓ is more than a turn).
- The French Morning march (step 45) is still a flat hex's worth of the turn, as before.
