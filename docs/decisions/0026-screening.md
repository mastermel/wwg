# 0026. Screening: a status light troops' commanders turn on, which hides their hex

- **Date:** 2026-10-03
- **Status:** Accepted (refines 0020's screen)

## Context

The rule book's reconnaissance (Campaign, §K.2) lets light cavalry, medium cavalry and light
infantry screen: they stand between the enemy's scouts and their own troops, which the enemy then
can't see. A larger force moving into the screen's hex "brushes aside" the screen and learns the
general nature of what's behind it. Until now the app only hinted at a screen: the sightings due
flagged a hex when the observed side's light troops stood in the line of sight, whatever they
were doing, and the Umpire decided what was seen. A player had no way to say a unit was screening.

## Decision

- **Screening is a unit's status**, which its commander (or the Umpire, or an Admin) turns on or
  off at any time, whatever the turn's state: it stays on until turned off. Only **light infantry,
  light cavalry and medium cavalry** can screen; a unit changed to another type stops.
- **A screen hides its hex:** a sighting of a hex with a screening unit shows only the screening
  units there; the others in the hex aren't among what's seen. The screening units themselves can
  still be sighted. The **possible screen** flag (0020) now counts only screening units in the line
  of sight.
- **Getting past the screen is the Umpire's call:** the start-turn dialog lists the units a screen
  hides, and the Umpire can mark a sighting **past the screen** (a larger force brushing it aside,
  a scouting party getting through), which shows what's behind it too.
- **The turns a unit screened are kept:** each turn that closes with the unit screening, the
  moment the sightings are worked out, is recorded. Its commander and the Umpire see them in the
  unit's details. The enemy never learns a unit's status, only what's sighted.

## Consequences

- `ArmyUnit.Screening`, and `ScreeningTurn` (a unit, a turn) for its history.
- `GET` / `PUT /api/army-units/{id}/screening`, with Commander access on a unit's route.
- The sightings due list each hex's screened units apart, and a sighting request can go past the
  screen.
