# 0034. Commanders have no FF or points

- **Date:** 2026-11-20
- **Status:** Accepted (amends 0024 and 0030)

## Context

Decision 0024 gave a Commander unit an FF and points like any other unit, and 0030 imported
formation commanders with FF 1 (the lowest the app allowed) and 0 points. A general has no figures
to fight with, so the club wants both to be 0, as a scout's are (decision 0028); the unit form
asked for an FF anyway.

## Decision

- **A Commander's FF and points are 0**, in the library and in a campaign. The API stores 0 for
  both whatever a create, edit or import sends for a Commander (changing a unit to a Commander
  clears them; changing it back asks for an FF again).
- **The unit form hides FF and points** while the type is Commander, and the app shows "–" for
  them, as for a scout.
- **A Commander still counts as a fighting unit** otherwise: contact, boats and sightings treat it
  as before. In particular, 0 points doesn't mean it has lost its boats (decision 0022): that rule
  is for units worn down to 0.
- A migration sets every Commander's FF and points to 0, in the library and in every campaign.

## Consequences

- `SaveUnitRequest.FightingFactor` and `UpdateArmyUnitRequest.FightingFactor` accept 0; the
  handlers hold every unit but a Commander or scout to an FF of 1 or more.
- A campaign started before the migration has no points-history entry for a Commander's points
  going to 0 (they were already 0 for imported ones).
