# 0025. Importing the unit library from the club's CSV

- **Date:** 2026-10-03
- **Status:** Accepted

## Context

The club's units live in a workbook its president keeps, laid out for printing. A script turns it
into one CSV of 1,077 units (`docs/complete_library.csv`, `docs/library-import.md`). Typing them
into the library one at a time isn't practical. The workbook also changes, so the library needs to
take a new copy of the file without duplicating what it already has. The workbook records more
than a unit has today: corps, commanders, notes and whether the figures are painted. The units
entered by hand so far are incomplete, and the club wants to stop relying on them.

## Decision

- **Managers and Admins import the CSV on the library page:** they upload the file, see a preview
  of what will change, then apply it, all or nothing. The upload creates and updates library units;
  it never deletes them.
- **The CSV is the app's import format, not the workbook's:** the script writes the app's own
  values (each unit's `UnitType`, its faction's flag, its status), so the importer doesn't read
  the workbook's letter codes.
- **A unit is recognised by its import key:** the script writes `nation | corps | division |
  brigade | name`, plus `| #2`, `| #3`… when a name repeats there (names hold `/` and `#`, never
  `|`), because names aren't unique (two identical
  "R.A. Batt." share one brigade). An imported unit keeps its key, so renaming it in the app
  doesn't break the match. A unit the workbook moves to another brigade arrives as a new unit.
- **The file decides for the units it lists:** a re-import overwrites what the app has for each
  keyed unit. Units without a key (entered by hand) are never touched. A keyed unit missing from
  the file is kept, and the preview lists it.
- **Factions are matched by name** (the CSV's `nation`, whatever its case; the oldest faction when
  two share the name). A faction that doesn't exist yet is created, with the CSV's flag.
- **Units gain the workbook's details:** `Corps`, the corps', division's and brigade's
  commanders (free text, like the division and brigade; decision 0024), `Notes` and `Status`
  (Painted, Substitute or Unpainted, or none). Corps and the commanders are copied to the army's
  copy with the rest (decision 0015). Notes and status stay with the library unit.
- **The order of battle gains the corps** above the division, and the commanders in the group
  headings. Formations keep the file's order (the Guard first, the Cavalry Reserve last) rather
  than sorting by name, which would put "IX Corps" before "V Corps". An imported unit stores its
  place in the file, and so does its army copy. Units without one come after, sorted as before.
- **The hand-entered units go to archive factions:** a migration moves every library unit that
  exists when it runs into an archive faction with its old faction's flag: "Archive (France)",
  "Archive (Britain)", or "Archive" for none. An army unit marches as its library unit's faction's
  nation (step 45), so one flagless Archive would change how archived units move in campaigns.
  Army units are copies, so campaigns keep them. The old factions stay, empty and still chosen by
  their armies, and the import fills them by name.
- **A United States flag** joins the nations, for the US faction.

## Consequences

- New columns on `Units` (corps, three commanders, notes, status, import key, import order) and
  on `ArmyUnits` (corps, three commanders, import order). A unique index on the faction's import
  keys. A data migration creates the archive factions.
- The faction checks that look at an army's units (deselecting a faction) see archived units as
  their archive faction's, so an army can deselect its old faction. The only other thing a
  campaign reads from the library unit's faction is its nation, which the archive keeps.
- The script's mapping to unit types is a judgement, checked by hand and fixable in the CSV.
  Artillery is horse artillery when its name says so (Horse, a Cheval, Volante, R.H.A., a British
  Troop), siege artillery when it says Siege, otherwise foot artillery.
- Formation commanders are text repeated on each unit of the group. Commanders as units on the
  map (decision 0024) remain the Umpire's to add. (Since decision 0030, the CSV includes each
  formation's commander as a Commander unit.)
- Problems found in the workbook go back to the president to fix at the source, and reach the
  library with the next import.
