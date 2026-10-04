# 0029. Every turn is shown as it was played: where the units started, and their moves

- **Date:** 2026-10-04
- **Status:** Accepted (replaces step 34's "no ghosts" on a past turn)

## Context

During the open turn the map draws each unit where it started the turn, and each move ordered in
it as a ghost at the destination with a dashed line along its path. Choosing a past turn instead
showed the units where they were after it, with no ghosts, so a player or the Umpire looking back
couldn't see who moved where in that turn. And in the open turn itself, once the Umpire approved
an army's turn its units jumped to their destinations and its ghosts went.

## Decision

- **Choosing a turn shows it as it was played**, past or open: the units where they started it
  (where they were after the turn before; turn 0, where they were placed) and each Move ordered
  in it as a ghost and a dashed line, whatever its army turn's status. Embarking, landing,
  building a boat and holding draw no ghost, as before.
- **A unit placed during the turn** (one added later, placed into the last closed turn) shows
  where it was placed, without a ghost.
- **What follows from the moves stays where the moves end:** the Umpire's contact,
  concentration and depot threats are from where the turn's orders leave the units, as in the
  open turn. A turn's sightings were made at its start, so they already match.
- The positions come from `GET /positions?turn=` for the turn before; the moves from the armies'
  turns the page already loads. The API doesn't change.

## Consequences

- Turn N's view and turn N+1's start from different places: stepping forward through the turns
  shows each turn's moves, then the units at their destinations as the next begins.
- The banner and the past turn's panel describe the start of the turn and its moves, not where
  the units ended up.
