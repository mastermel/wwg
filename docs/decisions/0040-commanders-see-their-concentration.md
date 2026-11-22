# 0040. Commanders see their own concentration, and the hexes named in warnings are links

- **Date:** 2026-11-22
- **Status:** Accepted (amends 0017)

## Context

Contact and concentration warnings (decision 0017) were the Umpire's only, so a commander learnt
a hex was over a limit only once the Umpire said so, and had no way to see a hex filling up
before then. Warnings and other lists beside the map name hexes by their coordinates, which then
had to be found on the map by eye.

## Decision

- **A hex's drawer totals its points:** each side's points counted towards the infantry and the
  cavalry limits, against that side's limits there (doubled in a City or a fortress, halved
  living off the land), of the units the viewer sees, where the shown turn's orders leave them
  (as the warnings count them). From four fifths of a limit it's marked near it; past it, over.
- **Commanders are warned of their own hexes over a limit**, as the Umpire is: in the turn panel
  (open and past turns) and outlined on the map, with the outline in the legend. They see only
  their own armies' units, so this never shows them contact or the other side's concentration.
- **A hex named in a warning or a list beside the map is a link** that opens its drawer and
  centres the map on it, as choosing a unit from a list does (decision 0038).

## Consequences

- Every member already reads the concentration settings, so the API doesn't change.
- Allies' units aren't counted in a commander's totals: they don't see them.
