# 0053. The time of day's march is a hex a turn, on every ground

- **Date:** 2026-11-25
- **Status:** Accepted (refines 0014, as 0052 does for force marches)

## Context

The rules (Campaign, §E.1) move French infantry (and some allies) "one additional hex each morning
turn", and Russian and Austrian infantry and foot artillery "one hex slower every afternoon turn".
Step 45 made that a flat hex's worth more or less of the turn's movement: a hex on flat ground,
but half a hex in low hills and one and a half on a good road. DESIGN.md already said "each rate
+ 1".

## Decision

- Each Morning, the Infantry class of the nations the campaign names moves by its land rates + 1;
  each Afternoon, the named nations' by their land rates − 1, never below ½. Ground a class can't
  cross stays closed. The turn's budget is always 1.
- Rates are worked out per unit and per turn: the API's `Movement.TableFor` (and
  `MovementTable.Faster`, which a force march uses too: decision 0052), the app's `ratesFor` and
  `faster` (`movement.ts`). In a Morning, a French force march is the rates + 2.
- A stack moving together goes by each unit's own rates (`StackMover.rates`), no longer a budget
  each.

## Consequences

- French infantry go two low-hill hexes in a Morning (not one and a half), four on a good road (not
  four and a half). Russians in an Afternoon go half a hex in low hills, as in high hills.
