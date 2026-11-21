# 0032. Each army's Commander in Chief, chosen by the Umpire

- **Date:** 2026-11-20
- **Status:** Accepted (builds on 0024)

## Context

An army has as many Commander units as its order of battle has named generals (decision 0030),
and nothing says which of them is the player: where on the map the person playing the army is.
The club's campaigns need that one marked, for everyone to see.

## Decision

- **One Commander in Chief (C-in-C) per army, or none:** a Commander unit the Umpire (or an
  Admin) chooses, stored as a flag on the army unit (`ArmyUnit.IsCommanderInChief`) and held to one
  per army by a partial unique index on `ArmyId`.
- **Choosing one replaces the last:** `PUT /api/armies/{id}/commander-in-chief { unitId }` makes
  the unit the army's C-in-C and the one before an ordinary commander, in one transaction; a null
  `unitId` leaves the army with none. Only a Commander unit of that army can be chosen (another
  type: 409; another army's unit: 400).
- **At any time:** while setting up, or once the campaign has started.
- **Only the Umpire:** not the army's commander, who might otherwise move their own location
  from general to general.
- **A unit changed to another type stops being C-in-C**, as one that can't screen stops
  screening. Removing the unit leaves the army with none.
- **Shown everywhere a unit is:** every member sees which unit it is (`isCommanderInChief` on
  `ArmyUnitResponse`, as units are every member's to see; where it is follows the visibility rule).
  Its symbol is the Commander's star in a ring, in the legend too, and lists name it "C-in-C"
  beside the unit's name.

## Consequences

- New: a column and a partial unique index on `ArmyUnits` (no table rebuild), and the endpoint.
- Nothing in the rules treated the C-in-C differently at first; decision 0033 then made couriers
  ride from C-in-C to C-in-C.
- A sighting or a courier's report copies units in as they were, without the flag.
