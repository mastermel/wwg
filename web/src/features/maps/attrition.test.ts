import { describe, expect, it } from "vitest";
import type {
  AttritionDueResponse,
  UnitMarchResponse,
  UnitSupplyResponse,
} from "@/api/generated/model";
import {
  attritionInWords,
  attritionScale,
  attritionWarning,
  roughLoss,
  whyItOwes,
} from "@/features/maps/attrition";

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

const supply = (changes: Partial<UnitSupplyResponse>): UnitSupplyResponse => ({
  unitId: "u",
  armyId: "a",
  state: "Supplied",
  depotId: null,
  unsuppliedTurns: 0,
  nextState: "Supplied",
  nextUnsuppliedTurns: 0,
  ...changes,
});

const due = (changes: Partial<AttritionDueResponse>): AttritionDueResponse => ({
  unitId: "u",
  armyId: "a",
  name: "Imperial Guard",
  fightingFactor: 2,
  points: 50,
  forcedMarchTurns: 2,
  forcedMarchMultiplier: 1,
  unsuppliedTurns: 0,
  multiplier: 1,
  loss: 3,
  ...changes,
});

describe("attritionInWords", () => {
  it("reads 1, 2 and more", () => {
    expect([0, 1, 2, 4].map(attritionInWords)).toEqual([
      null,
      "normal attrition",
      "double attrition",
      "4× attrition",
    ]);
  });
});

describe("attritionScale", () => {
  it("is the rules' 3, 2, 1 and ½ by Fighting Factor", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(attritionScale)).toEqual([
      3, 3, 2, 2, 1, 1, 0.5, 0.5, 0.5,
    ]);
  });
});

describe("roughLoss", () => {
  it("is the scale × the multiple × points ÷ 50", () => {
    expect(roughLoss({ fightingFactor: 2, points: 50 }, 1)).toBe("about 3 points");
    expect(roughLoss({ fightingFactor: 4, points: 100 }, 2)).toBe("about 8 points");
    expect(roughLoss({ fightingFactor: 6, points: 50 }, 1)).toBe("about 1 point");
  });

  it("is under a point, or nothing for none", () => {
    expect(roughLoss({ fightingFactor: 8, points: 50 }, 1)).toBe("under a point");
    expect(roughLoss({ fightingFactor: 2, points: 50 }, 0)).toBeNull();
    expect(roughLoss({ fightingFactor: 0, points: 0 }, 1)).toBeNull();
  });
});

describe("whyItOwes", () => {
  it("names the forced march, doubled out of supply, and supply's own", () => {
    expect(whyItOwes(due({}))).toBe("its 2nd turn of forced march, normal attrition");
    expect(whyItOwes(due({ forcedMarchMultiplier: 2, unsuppliedTurns: 7, multiplier: 3 }))).toBe(
      "its 2nd turn of forced march, double attrition (doubled: out of supply); out of supply 7 turns, normal attrition",
    );
  });
});

describe("attritionWarning", () => {
  it("is nothing for a rested, supplied unit", () => {
    expect(attritionWarning({ march: march({}), supply: supply({}) })).toBeNull();
  });

  it("says what the orders cost, the loss, and the rest it needs", () => {
    expect(
      attritionWarning({ march: march({ forcedMarchTurns: 1 }), supply: supply({}), due: due({}) }),
    ).toEqual({
      owes: true,
      title: "Attrition this turn",
      now: "As this turn began: force marching, with 1 turn of it to rest off.",
      next: "This turn's orders cost it normal attrition: its 2nd turn of forced march, normal attrition. As the next turn starts, it loses 3 points (50 → 47), once the Umpire confirms it.",
      consequences: [
        "It must Hold 2 turns to rest off its forced march; each move before then costs more (×2 each turn).",
      ],
    });
  });

  it("says when the loss is under a point, carried over", () => {
    expect(attritionWarning({ due: due({ loss: 0 }) })?.next).toMatch(
      /it loses under a point now, carried over until it adds up to one/,
    );
  });

  it("warns a force-marching unit that's holding, without a loss", () => {
    expect(attritionWarning({ march: march({ forcedMarchTurns: 2 }) })).toEqual({
      owes: false,
      title: "At risk of attrition",
      now: "As this turn began: force marching, with 2 turns of it to rest off.",
      next: "This turn's orders rest it: no attrition, and one turn of forced march worked off.",
      consequences: [
        "It must Hold 1 turn to rest off its forced march; each move before then costs more (×2 each turn).",
      ],
    });
  });

  it("warns of the turns out of supply before attrition, and after", () => {
    expect(
      attritionWarning({ supply: supply({ nextState: "Unsupplied", nextUnsuppliedTurns: 3 }) })
        ?.consequences,
    ).toEqual([
      "Out of supply after this turn (3 of 6 turns): from the 7th it loses points every turn, and a forced march costs it double.",
    ]);
    const cutOff = attritionWarning({
      supply: supply({
        state: "Unsupplied",
        unsuppliedTurns: 6,
        nextState: "Unsupplied",
        nextUnsuppliedTurns: 7,
      }),
      due: due({ forcedMarchTurns: 0, forcedMarchMultiplier: 0, unsuppliedTurns: 7 }),
    });
    expect(cutOff?.now).toBe("As this turn began: out of supply for 6 turns.");
    expect(cutOff?.consequences).toEqual([
      "Cut off: it loses points every turn it stays out of supply, may only defend, and a forced march costs it double.",
    ]);
  });
});
