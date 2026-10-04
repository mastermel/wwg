# 0027. A hex's units and sightings come before its terrain on the map

- **Date:** 2026-10-03
- **Status:** Accepted

## Context

On the Map page, the mouse's label and a click on a hex both described the hex's terrain, and a
unit's details opened only from its marker, in a drawer of their own. During a turn, players care
first about the troops in a hex, theirs or the enemy's as sighted, and only then about its ground.

## Decision

- **The hover label leads with what's in the hex:** the units in it (name, type, army), if any;
  else what was sighted there (the turn shown and the 3 before, as drawn, the older ones marked
  with their turn); else its ground. The unit markers lose their native tooltip, which repeated it.
- **A click or tap on a hex, or on a unit's marker, opens the hex's drawer** (replacing the hex's
  card and the unit drawer), titled with the hex: its units first (one in full, with its orders;
  several listed, each opening in full, with a way back to the list), then its sightings, then
  its terrain. A marker's stack, zoomed out, can take in the hexes around: the drawer lists the
  stack, naming any unit's other hex.
- The drawer's units follow the positions (by id), so they stay right as the positions refetch.

## Consequences

- Choosing a unit from the turn panel opens its hex's drawer, showing that unit.
- Tests find a unit's details as a region named for it inside the drawer, not as a dialog named
  for it.
