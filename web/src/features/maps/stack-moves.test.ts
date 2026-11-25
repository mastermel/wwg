import { describe, expect, it } from "vitest";
import type {
  ArmySummary,
  ArmyTurnDetails,
  UnitMarchResponse,
  UnitPosition,
  UnitType,
} from "@/api/generated/model";
import { ratesOf } from "@/features/maps/movement";
import {
  orderedGroups,
  stackCanForceMarch,
  stackGroups,
  stackMoveCost,
  stackMovers,
} from "@/features/maps/stack-moves";
import type { PlacedUnit } from "@/features/maps/stacks";

const rules = ratesOf(undefined);
const nord = { id: "nord", name: "Armée du Nord" } as ArmySummary;
const prussia = { id: "prussia", name: "Prussians" } as ArmySummary;

/** Only what moving together reads of a placed unit. */
const placed = (
  id: string,
  type: UnitType = "LineInfantry",
  changes: Partial<PlacedUnit> = {},
  army = nord,
) =>
  ({
    unit: { id, name: id, type, nation: "France", fightingFactor: 2, points: 50 },
    army,
    hex: { q: 0, r: 0 },
    ...changes,
  }) as PlacedUnit;

const turn = (changes: Partial<ArmyTurnDetails> = {}) =>
  ({ open: true, status: "Draft", orders: [], ...changes }) as unknown as ArmyTurnDetails;

describe("stackGroups", () => {
  it("offers an army's units without orders, two or more of them", () => {
    const units = [placed("guard"), placed("lancers", "LightCavalry"), placed("held")];
    const held = turn({ orders: [{ unitId: "held" } as UnitPosition] });

    const [group] = stackGroups(units, () => held, false);

    expect(group.units.map((p) => p.unit.id)).toEqual(["guard", "lancers"]);
    expect(group.mixed).toBe(false);
    expect(stackGroups(units.slice(1), () => held, false)).toEqual([]);
  });

  it("keeps each army's units apart, and leaves loose boats out", () => {
    const units = [
      placed("guard"),
      placed("barge", "Boat"),
      placed("lancers", "LightCavalry"),
      placed("landwehr", "LineInfantry", {}, prussia),
      placed("jäger", "LightInfantry", {}, prussia),
    ];

    const groups = stackGroups(units, () => turn(), true);

    expect(groups.map((g) => [g.army.id, g.units.map((p) => p.unit.id)])).toEqual([
      ["nord", ["guard", "lancers"]],
      ["prussia", ["landwehr", "jäger"]],
    ]);
  });

  it("marks units on boats with units ashore as mixed", () => {
    const units = [placed("guard", "LineInfantry", { boats: ["b1"] }), placed("lancers")];

    expect(stackGroups(units, () => turn(), false)[0]?.mixed).toBe(true);
  });

  it("offers nothing once the turn can't change, but the Umpire a Submitted one", () => {
    const units = [placed("guard"), placed("lancers")];
    const submitted = turn({ status: "Submitted" });

    expect(stackGroups(units, () => submitted, false)).toEqual([]);
    expect(stackGroups(units, () => submitted, true)).toHaveLength(1);
    expect(stackGroups(units, () => undefined, true)).toEqual([]);
  });
});

describe("orderedGroups", () => {
  it("offers an army's units with orders, two or more of them, loose boats aside", () => {
    const units = [
      placed("guard"),
      placed("lancers", "LightCavalry"),
      placed("free"),
      placed("barge", "Boat"),
    ];
    const ordered = turn({
      orders: ["guard", "lancers", "barge"].map((unitId) => ({ unitId }) as UnitPosition),
    });

    const [group] = orderedGroups(units, () => ordered, false);

    expect(group.units.map((p) => p.unit.id)).toEqual(["guard", "lancers"]);
    expect(orderedGroups(units.slice(1), () => ordered, false)).toEqual([]);
  });

  it("offers nothing once the turn can't change, but the Umpire a Submitted one", () => {
    const units = [placed("guard"), placed("lancers")];
    const submitted = turn({
      status: "Submitted",
      orders: units.map((p) => ({ unitId: p.unit.id }) as UnitPosition),
    });

    expect(orderedGroups(units, () => submitted, false)).toEqual([]);
    expect(orderedGroups(units, () => submitted, true)).toHaveLength(1);
  });
});

describe("stackMovers", () => {
  it("gives each unit its own rates, by boat while on boats, force march and all", () => {
    const heading = { hex: { q: 0, r: -1 }, progress: 0.5 };
    const movers = stackMovers(
      [
        placed("guard", "LineInfantry", { headingInto: heading }),
        placed("afloat", "LineInfantry", { boats: ["b1"] }),
      ],
      rules,
      "Morning",
      { morningNations: ["France"], afternoonNations: [] },
      true,
    );

    // French infantry in the Morning: a hex a turn faster, and another by force march; boats
    // neither.
    expect(movers[0]).toMatchObject({ type: "LineInfantry", carried: heading });
    expect(movers[0]?.rates("Infantry", "Flat")).toBe(4);
    expect(movers[1]).toMatchObject({ type: "Boat" });
    expect(movers[1]?.rates("Boat", "Downstream")).toBe(4);
  });
});

describe("stackCanForceMarch", () => {
  it("is only when every unit can", () => {
    expect(stackCanForceMarch([placed("guard"), placed("lancers")], rules, "Morning")).toBe(true);
    expect(stackCanForceMarch([placed("guard"), placed("eyes", "Scouts")], rules, "Morning")).toBe(
      false,
    );
    expect(stackCanForceMarch([placed("guard"), placed("lancers")], rules, "Night")).toBe(false);
  });
});

describe("stackMoveCost", () => {
  const march = (unitId: string, moveCosts: number): UnitMarchResponse => ({
    unitId,
    movesInRow: 2,
    forceMarchesInRow: 0,
    forcedMarchTurns: 1,
    moveCosts,
    forceMarchCosts: moveCosts * 2,
    orderCosts: 0,
  });

  it("names the units moving costs attrition, each with its own and roughly how many points", () => {
    const units = [placed("guard"), placed("lancers"), placed("hussars")];
    const marches = [march("guard", 1), march("lancers", 0), march("hussars", 2)];

    expect(stackMoveCost(units, marches, false)).toBe(
      "Moving costs attrition: guard (normal attrition, about 3 points) and hussars (double attrition, about 6 points).",
    );
    expect(stackMoveCost(units.slice(1, 2), marches, false)).toBeNull();
  });

  it("costs nothing on boats", () => {
    const units = [placed("guard", "LineInfantry", { boats: ["b1"] })];

    expect(stackMoveCost(units, [march("guard", 1)], false)).toBeNull();
  });
});
