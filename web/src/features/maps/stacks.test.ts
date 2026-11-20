import { describe, expect, it } from "vitest";
import type { ArmySummary, ArmyUnitResponse } from "@/api/generated/model";
import {
  describeUnit,
  nameWithRank,
  stackUnits,
  unitsIn,
  type PlacedUnit,
} from "@/features/maps/stacks";

const army: ArmySummary = {
  id: "a",
  name: "Armée du Nord",
  commander: null,
  side: { id: "0192f5c1-0000-7000-8000-00000000f001", name: "Coalition" },
  color: "Blue",
  nation: "France",
};

const placed = (id: string, longitude: number, latitude = 0): PlacedUnit => ({
  unit: {
    id,
    armyId: "a",
    unitId: "l",
    factionId: "f",
    nation: "France",
    name: id,
    type: "LineInfantry",
    fightingFactor: 5,
    points: 20,
    division: null,
    brigade: null,
    corps: null,
    corpsCommander: null,
    divisionCommander: null,
    brigadeCommander: null,
    importOrder: null,
    isCommanderInChief: false,
  } satisfies ArmyUnitResponse,
  army,
  hex: { q: 0, r: 0 },
  latitude,
  longitude,
});

// One degree of longitude is ten pixels.
const project = ([lng, lat]: [number, number]) => ({ x: lng * 10, y: lat * 10 });

describe("stacking units", () => {
  it("stacks units whose markers would overlap, at the first one's position", () => {
    const stacks = stackUnits([placed("a", 0), placed("b", 1), placed("c", 10)], project);

    expect(stacks.map((s) => s.units.map((u) => u.unit.id))).toEqual([["a", "b"], ["c"]]);
    expect(stacks[0]).toMatchObject({ key: "a", longitude: 0 });
  });

  it("keeps apart units further than the radius", () => {
    expect(stackUnits([placed("a", 0), placed("b", 3)], project, 26)).toHaveLength(2);
  });

  it("puts an army's Commander in Chief at the top of its stack, which keeps its place", () => {
    const chief = placed("Napoleon", 1);
    chief.unit.type = "Commander";
    chief.unit.isCommanderInChief = true;

    const stacks = stackUnits([placed("a", 0), chief, placed("b", 2)], project);

    expect(stacks.map((s) => s.units.map((u) => u.unit.id))).toEqual([["Napoleon", "a", "b"]]);
    expect(stacks[0]).toMatchObject({ key: "a", longitude: 0 });
  });

  it("describes a Commander in Chief as such", () => {
    const chief = placed("Napoleon", 0);
    chief.unit.type = "Commander";
    chief.unit.isCommanderInChief = true;

    expect(describeUnit(chief)).toBe("Napoleon, Commander in Chief, Armée du Nord");
    expect(nameWithRank(chief)).toBe("Napoleon (Commander in Chief)");
    expect(nameWithRank(placed("Ney", 0))).toBe("Ney");
  });

  it("describes a unit for a screen reader", () => {
    expect(describeUnit(placed("Imperial Guard", 0))).toBe(
      "Imperial Guard, Line Infantry, Armée du Nord",
    );
  });
});

describe("unitsIn", () => {
  it("finds the units in a hex", () => {
    const here = placed("Guard", 0);
    const there = { ...placed("Lancers", 1), hex: { q: 1, r: 0 } };

    expect(unitsIn({ q: 0, r: 0 }, [here, there])).toEqual([here]);
    expect(unitsIn({ q: 2, r: 0 }, [here, there])).toEqual([]);
  });
});
