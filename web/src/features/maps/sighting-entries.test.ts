import { describe, expect, it } from "vitest";
import type { SightingDueResponse } from "@/api/generated/model";
import { initialEntries, toRequests, withPastScreen } from "@/features/maps/sighting-entries";

const due = (afloat: boolean): SightingDueResponse => ({
  observingArmyId: "a",
  q: 1,
  r: 0,
  whereabouts: "1 hex east of the Guard",
  screened: false,
  units: [{ unitId: "u", armyId: "p", name: "Brigade", type: "LineInfantry", points: 30, afloat }],
  screenedUnits: [],
});

const screened: SightingDueResponse = {
  ...due(false),
  units: [
    { unitId: "h", armyId: "p", name: "Hussars", type: "LightCavalry", points: 10, afloat: false },
  ],
  screenedUnits: [
    { unitId: "c", armyId: "p", name: "Corps", type: "LineInfantry", points: 300, afloat: true },
  ],
};

describe("a sighting of a screened hex (decision 0026)", () => {
  it("sees only the screen, sized by it", () => {
    expect(initialEntries([screened]).map((e) => e.size)).toEqual(["Small"]);
    expect(toRequests(initialEntries([screened])).map((r) => r.pastScreen)).toEqual([false]);
  });

  it("past the screen, sees what it hides too, sized afresh", () => {
    const entries = initialEntries([screened]).map((e) => withPastScreen(e, true));
    expect(entries.map((e) => [e.size, e.showsAfloat])).toEqual([["Large", true]]);
    expect(toRequests(entries).map((r) => [r.pastScreen, r.showsAfloat])).toEqual([[true, true]]);
  });

  it("added by hand, tells of every unit it lists", () => {
    const entries = initialEntries([due(false)]).map((e) => ({ ...e, byHand: true }));
    expect(toRequests(entries).map((r) => r.pastScreen)).toEqual([true]);
  });
});

describe("a sighting of a force on boats (step 51)", () => {
  it("shows the boats unless the Umpire leaves them out", () => {
    const entries = initialEntries([due(true)]);
    expect(entries.map((e) => e.showsAfloat)).toEqual([true]);
    expect(toRequests(entries).map((r) => r.showsAfloat)).toEqual([true]);
    expect(
      toRequests(entries.map((e) => ({ ...e, showsAfloat: false }))).map((r) => r.showsAfloat),
    ).toEqual([false]);
  });

  it("never says anything of boats for a force ashore", () => {
    const entries = initialEntries([due(false)]).map((e) => ({ ...e, showsAfloat: true }));
    expect(toRequests(entries).map((r) => r.showsAfloat)).toEqual([false]);
  });
});
