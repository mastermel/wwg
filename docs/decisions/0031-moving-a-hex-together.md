# 0031. A hex's units move together along one path, at the pace of the slowest

- **Date:** 2026-11-20
- **Status:** Accepted (refines 0014, 0018 and 0022 for moves of several units)

## Context

Orders are given unit by unit. A commander who keeps a division together in one hex gives each
unit the same move, one at a time. Moving them all in one go needs a reach for the stack, and
"the slowest unit" isn't one class: infantry are slower than cavalry on the flat, but cavalry
can't cross mountains that infantry can; some nations' infantry march further in the morning; and
a unit part of the way into a hex has less of it left to go.

## Decision

- **Move all** is an extra order, beside each unit's own: it gives each unit in a hex the same
  Move, and each can still be changed or taken back alone.
- **One army's units**, and only those **without an order** this turn. Allies in the hex are
  their own armies'.
- **All on boats, or all ashore.** Boats not carrying a unit are left out of the stack.
- **One path, at the slowest unit's pace:** a step costs the stack the most that any of its units
  pays for it, as a share of that unit's own turn, so a path the stack can afford suits every
  unit. Only hexes the **whole stack gets into** are reachable: none stops part of the way.
- **Force march** only if every unit can; each owes attrition by its own march count.
- **The API checks each unit as `GiveOrder` would** (all or nothing, naming the one that can't
  go), plus that they start in one hex, afloat or ashore alike, and each gets the whole way. The
  stack's reach is the front-end's alone: a path it allows passes every unit's own check.

## Consequences

- New: `POST /api/army-turns/{id}/move`, and the drawer's **Move all**.
- Taking back all of a stack's orders at once is later work, if it's wanted.
