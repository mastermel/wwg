# 0024. Commanders on the map, and each unit's division and brigade

- **Date:** 2026-10-03
- **Status:** Accepted

## Context

An army's units are a flat list: nothing on the map stands for its general, and nothing says how
the units are organised. The club's orders of battle group them into brigades, and brigades into
divisions, and a faction of any size is hard to read without them.

## Decision

- **A Commander unit type** stands for the army's general on the map. It moves as light cavalry
  (the rules' table, decision 0014), and is otherwise a unit like any other: it has an FF and
  points, can board boats, and is seen and reported by sightings. It isn't counted towards
  concentration, isn't a screen, and isn't exempt from supply unless the Umpire makes it so.
  Its symbol is a star.
- **Every unit has an optional Division and Brigade:** free text (≤100 characters each), set
  where its name and type are, in the library and on the army's copy. Adding a library unit to an
  army copies them, as it copies the rest (decision 0015).
- **The library's faction page, and an army's units, show their order of battle:** units grouped
  under their brigade, and brigades under their division. A group's own units (a division's commander, say) come before its
  brigades, and a group's commanders before its other units; a faction with no divisions or
  brigades shows its plain list as before.

## Consequences

- New: the `Commander` unit type (no migration: types are stored by name), and two nullable
  columns on `Units` and `ArmyUnits`.
- Grouping is by exact (case-insensitive) text, so the form suggests the faction's existing
  divisions and brigades, to keep a typo from starting a new group.
