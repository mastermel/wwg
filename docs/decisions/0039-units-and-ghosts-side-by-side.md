# 0039. Units and the ghosts of units moving in share a hex side by side

- **Date:** 2026-11-21
- **Status:** Accepted

## Context

Units and the ghosts of moves into a hex (decision 0029) were both drawn at the hex's centre, so
whichever was drawn last hid the other: a unit ordered into an occupied hex covered the unit
already there, or was covered by it. Ghosts weren't stacked either: several units ordered into
one hex drew their ghosts on top of each other, with nothing saying how many.

## Decision

- **A hex with both is drawn in halves:** the units in it in its west half, the ghosts coming
  in in its east half, each a quarter of the hex's width from its centre (flat-topped hexes are
  widest across). The offset is in map units, not pixels, so both stay inside the hex at any
  zoom.
- **Only where they meet:** a hex with only units, or only ghosts, keeps them at its centre, so
  the map changes only where something would be hidden. Ordering a unit into an occupied hex
  moves the unit there aside, which shows the order.
- **Ghosts stack as units do**, where they'd overlap at the zoom, with a count (dashed, so it
  isn't taken for a stack of units).
- A courier in a split hex keeps its place beside its hex's units, in the west half.

## Consequences

- Only where things are drawn changes: each unit's hex, and what choosing its marker opens, are
  as before. The dashed lines still end at the hex's centre, between the two.
- Zoomed far out, the halves are closer than a symbol is wide and overlap again; units' markers
  stack with their neighbours' there anyway.
