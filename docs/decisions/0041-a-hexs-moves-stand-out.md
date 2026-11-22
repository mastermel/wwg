# 0041. A chosen hex's moves stand out, and the rest fade

- **Date:** 2026-11-22
- **Status:** Accepted

## Context

Every move was drawn alike: a dashed line from hex centre to hex centre, in the label colour,
wider the more units shared it (step 66d). Where units are close, their paths run along the
same hexes and lie exactly on top of each other, so one stack's move for the turn, where it
starts and where it ends, couldn't be picked out. Choosing a hex outlined it, but its moves
looked like any others.

## Decision

- **Choosing a hex focuses its units' moves**, all of them (not one unit's: the stack is what
  was chosen). They're drawn above the rest, solid, in each army's colour, with a halo so they
  show over the ground and the other lines.
- **The rest fade, but stay:** other lines to 30%, other ghosts to 25%, so where everything else
  is going is still there for context.
- **Both ends are framed:** the hex they start from is outlined, as before; where they go is
  outlined dashed.
- **Direction:** each focused line gets an arrowhead straddling the edge into its destination,
  clear of the ghost at the centre and sized by the hex, so it scales with the map. Only focused
  lines get one: on every line they'd add to the clutter.
- **Commanders and the Umpire alike.** Nothing changes while placing or moving, which draw their
  own, or when the chosen hex's units aren't moving.

## Alternatives held back

- **Spreading overlapping paths apart** (offsetting lines that share hexes, as transit maps do)
  would ease the clutter with nothing chosen, but keeping each path's offset steady as it joins
  and leaves others is real work. Revisit if the map's still too busy once focus is in.
- To come (step 75): tapping a ghost to choose its unit's hex, hover to preview with a mouse,
  and a switch to hide every move but the chosen hex's.

## Consequences

- Sight only, as moves always were: the turn panel lists the same orders.
- Zoomed far out, an arrowhead is smaller than a ghost and may hide under it.
