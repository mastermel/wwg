# 0028. Scouts: non-combat observers the Umpire adds to an army

- **Date:** 2026-10-03
- **Status:** Accepted (refines 0014, 0017, 0018, 0019, 0021 and 0022 for scouts)

## Context

The rules' movement table puts scouts with light cavalry, and the app has had a Scouts type since
step 39, treated like any other: it had an FF and points, counted towards the cavalry limit, and
was exempt from supply only by the campaign's default. The club's units are imported from its CSV
(decision 0025), which has no scouts. What a campaign wants is a small party whose only job is to
move about the map and watch the enemy: not a fighting unit, and not one of the club's figures.

## Decision

- **The Scouts type is the scout**, repurposed rather than added beside it: no library unit was
  one. Scouts aren't the library's: its form and its import refuse the type, and a library unit
  someone had typed in as Scouts becomes Light cavalry, with its campaigns' copies.
- **The Umpire adds a scout to an army** by name, at any time, as an army unit with no library
  unit (as a built boat is). It's placed like any unit added later. Its type can't be changed, and
  no other unit can be made a scout.
- **A scout doesn't fight:** it has no FF and no points (stored as 0, shown as "–"), so it adds
  nothing to an army's totals or a sighting's strength.
- **It moves as light cavalry**, and otherwise only watches. It can't screen, build boats or force
  march; supply and attrition don't touch it (whatever the campaign's exempt types), and a run of
  moves never becomes a forced march. It isn't counted towards concentration, doesn't make contact
  with the enemy, and doesn't take or hold towns.
- **It still sees and is seen:** its hex counts for its army's sightings as any unit's does, and
  the enemy can sight it. It can be carried by boats.
- **Its symbol is binoculars.**

## Consequences

- `POST /api/armies/{id}/scouts { name }` (Umpire); a migration turns library Scouts (and their
  army copies) into Light cavalry.
- The rules that went by a campaign's chosen types (supply's exempt types, concentration's
  counted types) leave scouts out whatever is chosen, and the settings stop offering them.
