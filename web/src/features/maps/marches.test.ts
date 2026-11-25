import { describe, expect, it } from "vitest";
import type { UnitMarchResponse } from "@/api/generated/model";
import { canForceMarch, describeMarch, forceMarching, moveCost } from "@/features/maps/marches";
import { ratesOf } from "@/features/maps/movement";

const rules = ratesOf(undefined);
const march = (changes: Partial<UnitMarchResponse>): UnitMarchResponse => ({
  unitId: "u",
  movesInRow: 0,
  forceMarchesInRow: 0,
  forcedMarchTurns: 0,
  moveCosts: 0,
  forceMarchCosts: 0,
  orderCosts: 0,
  ...changes,
});

describe("forceMarching", () => {
  it("moves a hex a turn faster on every ground the class can cross", () => {
    const marching = forceMarching(rules);
    expect(marching("Infantry", "Flat")).toBe(3);
    expect(marching("Infantry", "GoodRoad")).toBe(4);
    expect(marching("Infantry", "LowHill")).toBe(2);
    expect(marching("Infantry", "HighHill")).toBe(1.5);
    expect(marching("LightCavalry", "Mountain")).toBe(2);
  });

  it("opens no ground the class can't cross, and leaves boats alone", () => {
    const marching = forceMarching(rules);
    expect(marching("Infantry", "Mountain")).toBe(0);
    expect(marching("Boat", "Downstream")).toBe(4);
  });
});

describe("canForceMarch", () => {
  it("is by day only, for a class that moves over land", () => {
    expect(canForceMarch(rules, "LineInfantry", "Morning")).toBe(true);
    expect(canForceMarch(rules, "LineInfantry", "Night")).toBe(false);
    expect(canForceMarch(rules, "Boat", "Afternoon")).toBe(false);
  });

  it("is never a scout's", () => {
    expect(canForceMarch(rules, "Scouts", "Morning")).toBe(false);
  });
});

describe("describeMarch", () => {
  it("says how far into a run, or what's left to rest off", () => {
    expect(describeMarch(march({}))).toBe("Rested.");
    expect(describeMarch(march({ movesInRow: 2 }))).toBe(
      "Moved 2 turns in a row: a third makes a forced march.",
    );
    expect(describeMarch(march({ forcedMarchTurns: 1 }))).toBe(
      "Force marching: 1 turn to rest off (a Hold each).",
    );
  });
});

describe("moveCost", () => {
  it("says what moving costs, and which turn of forced march it is", () => {
    const tired = march({ forcedMarchTurns: 2, moveCosts: 2, forceMarchCosts: 2 });

    expect(moveCost(tired, false)).toBe(
      "Moving costs double attrition: its 3rd turn of forced march.",
    );
    expect(moveCost(march({ forceMarchCosts: 0 }), true)).toBeNull();
    expect(moveCost(undefined, false)).toBeNull();
  });

  it("says roughly how many points, given the unit's FF and points", () => {
    const tired = march({ forcedMarchTurns: 2, moveCosts: 2, forceMarchCosts: 2 });

    expect(moveCost(tired, false, { fightingFactor: 6, points: 30 })).toBe(
      "Moving costs double attrition (about 1.2 points): its 3rd turn of forced march.",
    );
  });
});
