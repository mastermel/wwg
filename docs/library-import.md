# Unit library import

The club keeps every nation's units in one Excel workbook, `complete_library.xlsx`, laid out
for printing. It isn't in git (`.gitignore`): the maintainer has it, and the script expects it
at `docs/complete_library.xlsx`.
[`scripts/library_csv.py`](../scripts/library_csv.py) turns it into one CSV with a row per unit,
[`complete_library.csv`](complete_library.csv), which is committed. This page records what we
learned about the workbook, how the script reads it, and the decisions we made together
(2026-10-03).

## Running it

The script needs [openpyxl](https://openpyxl.readthedocs.io/). From the repo root:

```sh
python3 -m venv /tmp/wwg-venv && /tmp/wwg-venv/bin/pip install openpyxl
/tmp/wwg-venv/bin/python scripts/library_csv.py
```

It rewrites the CSV, compares its totals with the workbook's own **Totals** tab, and lists the
rows it skipped or found odd. Re-run it whenever the workbook changes, and check that output.

## The workbook

| Tabs | What they hold |
| --- | --- |
| British, French, Italy, Polish, Austrian, Prussian, Russian, Swedish, US | One army's table of organisation each: the source of the CSV. |
| Totals, Corps, Combos, Data | Formulas that add up the nation tabs. No unit data; Totals is used as a cross-check. |
| Mover, Graphs | Empty. |

Each nation tab reads top to bottom:

1. A title and the army staff (CinC, Chief of Staff, ADCs…). Not imported.
2. For each corps: a corps heading, its commander on the next line(s), then divisions and
   brigades, each heading followed by its commander further along the row.
3. Unit rows under each brigade, with a battery or two after the brigade's units.
4. After each division or brigade, subtotal rows (`Batts.`/`Sqs.` and `Guns`), all formulas.
5. A corps statistics block, then army totals at the bottom. All formulas.

### Unit columns

The columns move from tab to tab, but within a tab they're fixed (the script's `LAYOUTS`):

| Field | British, Swedish | French, Italy, Polish | Austrian, Prussian, Russian | US |
| --- | --- | --- | --- | --- |
| Name | A–B | B–D | B–C | B–C |
| FF | F | G | F | F |
| Count ("Batts") | G | H | G | H |
| Count label | — | I | H | G (cavalry and guns only) |
| Pts | H | J | I | I |
| Status ("Pt") | K | M | L | L |
| Type ("L/M/H") | L | N | M | M |

A row is a unit when its FF or Pts cell holds a typed-in number; subtotal rows hold formulas.
That rule finds 1,077 units. To the right of each unit, formula columns break its points down
by FF (1–8), by type and by status. The script ignores them.

- **FF**: a fighting factor, 1–9 (9 for the Old Guard, plus one British Portuguese Battery).
- **Count**: what the count measures depends on the arm: battalions, squadrons or guns. A half
  battalion, squadron or battery is `0.5` or a battery marked `(1/2)`. The British Rocket Troop
  has 0 guns.
- **Pts**: the unit's points. Four cells are sums such as `=30+30`; the script uses the
  workbook's saved result.

### Two code columns

There are two single-letter columns, and `s` means something different in each.

**Status**, headed `Pt` (feeds the workbook's "Painted Pts." and "P & S Pts." totals):

| Code | Meaning | Units |
| --- | --- | --- |
| `p` | Painted | 746 (one typed `P`, read as `p`) |
| `s` | Substitute: on the table, another unit's figures stand in for it, e.g. `44th Regt. (sub: 45th Regt., from II)` | 179 |
| `u` | Unpainted | 149 |
| `x` | Unknown: one unit, French 16th Chasseurs a Cheval. Kept as-is. | 1 |
| blank | The two British siege artillery units | 2 |

**Type**, headed `S/R/L/H` and `L/M/H`, with totals columns headed Hvy / Med / Light / SK / R:

| Code | Meaning | CSV `class` |
| --- | --- | --- |
| `h` | Heavy | Heavy |
| `m` | Medium | Medium |
| `l` | Light | Light |
| `r` | Rifles | Light |
| `s` | Skirmishers | Light |
| blank | Artillery: every unit without a type is a battery, troop or gun | (blank) |

### Arm

- **Artillery**: any unit with no type code. This includes every "Battery" and "Troop".
- **Infantry or cavalry**: most tabs label the count `Batt.`/`Batts.` or `Sq.`/`Sqs.`. British
  and Swedish rows, and US infantry, have no label. For those, the script reads the label on the
  subtotal row below the unit, which is always there.
- **Italian "Guardie d'Onori"**: counted in `Cos` (companies?). The workbook's totals count it
  as cavalry, and so does the CSV (decided).
- **Exceptions**: a few units named "Artillery" are infantry by the workbook's own count (French
  Coast Artillery Garrison, 1st and 2nd Marine Artillery Regts.), and stay that way.

### Names

Names carry notes in brackets. A **trailing** bracket becomes the CSV's `notes`:

- `(sub: 45th Regt., from II)`: this unit's figures are borrowed from another unit (status `s`).
- `(sub in V)`: this unit's figures also stand in for a unit in corps V.
- Gun weight `(12 pdrs.)`, half battery `(1/2)`, a battery commander `(Mercer's)`, history
  `(was dad's 25th)`, and so on.

A trailing `(bis)`, "the second", stays in the name because it tells two units apart:
`West. Jager Carabinier` and `West. Jager Carabinier (bis)` are both in the Westphalian 59th Brigade.
Brackets **in the middle** of a name are part of a regimental title, so they stay in the name:
`1,2,Fus/3rd (2nd East Prussian) Regt.` or `1st (Heavy) Artillery Battery`. Removing them would
merge different units. `original_name` keeps the name exactly as typed. Prefixes such as `1,2,Fus/`
(Prussian) and `1,2/` (Austrian) list a regiment's battalions; the script leaves them alone.

## Hierarchy: corps, division, brigade

We fit every army into **Corps → Division → Brigade**, the standard Napoleonic chain, with each
level's commander in its own column. A level the army doesn't have is left blank. Groupings that
don't fit go to whichever level they're most like (decided):

| In the workbook | In the CSV |
| --- | --- |
| French Imperial Guard sub-commands ("Old Guard Infantry - Marshall Lefebvre") | Corps: `I Corps of Imperial Guard - Old Guard / Old Guard Infantry`, with the marshal as commander |
| French Cavalry Reserve (Murat), including "Cavalry Reserve (cont.)" | Corps. Its staff lines (Chief of Staff, ADC) are skipped. |
| British army-level siege "Artillery Reserve" (below the army totals) | Corps, with no division or brigade |
| Russian "I Cavalry Corps" inside I Corps, etc. | Division. A Kurassier Division under it joins the name: `I Cavalry Corps / 1st Kurassier Division`, with both commanders. |
| Prussian "I Corps Cavalry Reserve:" | Division |
| French VI Corps "Corps Artillery Reserve" | Division |
| Prussian brigades (division-sized in 1813–15, no divisions above them) | Brigade, with a blank division. The brigade's second commander ("2nd: Oberst …") is added to its commander. |
| French XIV Corps (brigades only) | Brigade, with a blank division |
| US army (no corps) | Corps blank |
| British "Independent" (Canadian Cavalry Division) and US "Cavalry" | Brigade |

A battery belongs to the brigade it's listed under (decided). On the British tab that's the
division's last brigade, because British batteries come at the end of each division.

Headings and commanders are copied as typed, including spelling slips ("Divison", "7Xnd
Brigade") and placeholder commanders ("Gen.", "M.G. "). Some names repeat across corps: French
X, XI and XIII Corps each have a "17th Cavalry Division".

## CSV columns

| Column | Content |
| --- | --- |
| `nation` | The tab name (`British`, `Italy`, `US`…) |
| `corps`, `division`, `brigade` | The unit's formation (see above) |
| `corps_commander`, `division_commander`, `brigade_commander` | Each formation's commander, as typed |
| `unit` | Name without trailing notes |
| `notes` | Trailing bracketed notes, `; `-separated |
| `arm` | Infantry, Cavalry or Artillery |
| `class` | Heavy, Medium or Light (from `type_code`). Blank for artillery. |
| `type_code` | The raw type letter: h, m, l, r, s or blank |
| `ff` | Fighting factor |
| `count`, `count_unit` | Battalions, Squadrons, Guns or Companies |
| `points` | Points |
| `status`, `status_code` | Painted / Substitute / Unpainted, and the raw letter |
| `original_name` | The name exactly as typed |
| `source_row` | The row on the nation's tab, for tracing a unit back |

## Checks against the workbook

The CSV's points and counts per army and arm match the Totals tab exactly, except in two places:

- **British artillery** is 40 points / 9 guns higher, because the siege artillery reserve isn't
  in the workbook's totals.
- **Russian cavalry** is 9 points / 4 squadrons lower. This is a workbook error: in I Corps the
  cavalry subtotal `=SUM(I41:I56)` takes in row 46, the Guard Horse Artillery Battery, which the
  artillery subtotal counts as well.

Rows the script skips:

- British row 86: `18th "King's Irish" Hussars` is typed into a subtotal row and has no figures
  (decided: skip).
- French rows 907–911: the Cavalry Reserve's staff (Chief of Staff, ADC).
- US rows 74, 80, 86: the unheaded totals at the bottom of the US tab.

## Open items

- Status `x` (French 16th Chasseurs a Cheval) and the blank status of the two British siege
  artillery units have no known meaning yet.
- The app's unit types (`UnitType`) are finer than the workbook's. Mapping to them is still to
  be decided: line vs. light infantry from `class`, foot vs. horse vs. siege artillery from
  names (`Horse`, `a Cheval`, `Volante`, `R.H.A.`, `Siege`).
- There is no corps in the app's library units yet; only division and brigade (step 54).
