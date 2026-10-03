import { describe, expect, it } from "vitest";
import type { UnitType } from "@/api/generated/model";
import { orderOfBattle, unitsIn } from "@/features/units/order-of-battle";

const unit = (
  name: string,
  division: string | null = null,
  brigade: string | null = null,
  type: UnitType = "LineInfantry",
) => ({ name, type, division, brigade });

const names = (units: { name: string }[]) => units.map((u) => u.name);

describe("the order of battle", () => {
  it("leaves units in no division or brigade as they are", () => {
    const oob = orderOfBattle([unit("Guard"), unit("Hussars")]);

    expect(oob.grouped).toBe(false);
    expect(names(oob.units)).toEqual(["Guard", "Hussars"]);
    expect(oob.brigades).toEqual([]);
    expect(oob.divisions).toEqual([]);
  });

  it("puts units under their brigades, and brigades under their divisions", () => {
    const oob = orderOfBattle([
      unit("1st Ligne", "1st Division", "1st Brigade"),
      unit("2nd Ligne", "1st Division", "2nd Brigade"),
      unit("3rd Ligne", "1st Division", "1st Brigade"),
      unit("Foot Battery", "1st Division"),
      unit("Lancers", "Cavalry Division", "Lancer Brigade"),
    ]);

    expect(oob.grouped).toBe(true);
    expect(oob.units).toEqual([]);
    expect(
      oob.divisions.map((d) => ({
        name: d.name,
        units: names(d.units),
        brigades: d.brigades.map((b) => [b.name, ...names(b.units)]),
      })),
    ).toEqual([
      {
        name: "1st Division",
        units: ["Foot Battery"],
        brigades: [
          ["1st Brigade", "1st Ligne", "3rd Ligne"],
          ["2nd Brigade", "2nd Ligne"],
        ],
      },
      { name: "Cavalry Division", units: [], brigades: [["Lancer Brigade", "Lancers"]] },
    ]);
  });

  it("keeps units in no division first, with their own brigades", () => {
    const oob = orderOfBattle([
      unit("Grenadiers", "Guard"),
      unit("Napoleon", null, null, "Commander"),
      unit("Engineers", null, "Reserve"),
    ]);

    expect(names(oob.units)).toEqual(["Napoleon"]);
    expect(oob.brigades.map((b) => [b.name, ...names(b.units)])).toEqual([
      ["Reserve", "Engineers"],
    ]);
    expect(oob.divisions.map((d) => d.name)).toEqual(["Guard"]);
  });

  it("puts a group's commanders before its other units", () => {
    const oob = orderOfBattle([
      unit("Artillery", "1st Division"),
      unit("Quiot", "1st Division", null, "Commander"),
    ]);

    expect(names(oob.divisions[0]?.units ?? [])).toEqual(["Quiot", "Artillery"]);
  });

  it("matches names whatever their case or spacing, as first written", () => {
    const oob = orderOfBattle([
      unit("A", "1st Division", "Old Guard"),
      unit("B", " 1st division ", "old guard "),
    ]);

    expect(oob.divisions).toHaveLength(1);
    expect(oob.divisions[0]?.name).toBe("1st Division");
    expect(oob.divisions[0]?.brigades.map((b) => [b.name, ...names(b.units)])).toEqual([
      ["Old Guard", "A", "B"],
    ]);
  });

  it("sorts names as people count", () => {
    const oob = orderOfBattle([unit("A", "10th Division"), unit("B", "2nd Division")]);

    expect(oob.divisions.map((d) => d.name)).toEqual(["2nd Division", "10th Division"]);
  });

  it("counts a division's units, its brigades' too", () => {
    const oob = orderOfBattle([unit("A", "1st", "x"), unit("B", "1st"), unit("C", "1st", "y")]);

    expect(names(unitsIn(oob.divisions[0] ?? { name: "", units: [], brigades: [] }))).toEqual([
      "B",
      "A",
      "C",
    ]);
  });
});
