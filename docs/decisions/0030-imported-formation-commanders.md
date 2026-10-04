# 0030. Formation commanders imported as Commander units

- **Date:** 2026-10-04
- **Status:** Accepted

## Context

The Commander unit type (decision 0024) puts an army's general on the map, but the library has
no Commander units: the Umpire would have to type in one for every general. The club's workbook
already names the commander of almost every corps, division and brigade, and the import
(decision 0025) copies those names onto the units as text only.

## Decision

- **The CSV script writes a Commander unit for each formation's commander:** each corps,
  division and brigade that has one, just before the formation's first unit. Its corps, division
  and brigade are the path down to the formation it commands, with the levels below that left
  blank. In the order of battle, a corps commander comes first in the corps, and a brigade
  commander first in the brigade.
- **The general's name is the unit's name**, as typed. When a formation lists further commanders
  ("2nd: Oberst …" for a Prussian brigade, or an acting corps commander), the first one is the
  unit and the others go in its notes. A Russian cavalry corps joined to its division's name gets
  one unit for each of the two commanders, each noting which formation it commands.
- **FF 1 and 0 points:** a general has no figures to fight with. The app requires an FF from 1
  to 9, so the FF is the lowest allowed. With 0 points, commanders don't change the army's
  totals. Both can be edited on the unit.
- **No unit for a blank or placeholder commander** ("Gen.", "M.G.", "M.G. Sir", "GM von"). The
  script lists them in its warnings, so they can be fixed in the workbook.
- **A commander is keyed by the post, not the name:** `nation | corps | division | brigade |
  Commander`. A new general named in the workbook updates the same unit instead of adding another.
  When two formations share a path (two "29th Cav. Brigade"s, say), the keys are numbered as for
  any repeated unit.

## Consequences

- The CSV grows from 1,077 rows to 1,567 (490 commanders). The importer needs no change: it
  already takes the `Commander` type, and the FF and points are inside its limits.
- The script's check against the workbook's Totals tab leaves commanders out.
- A commander unit joins an army the way any library unit does (Add units), and the Umpire places
  it on the map. The general's name is also still written on each of the formation's units.
- Replaces the last point of decision 0025's consequences, which left commanders as units for the
  Umpire to add by hand.
