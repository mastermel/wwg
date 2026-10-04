import { beforeEach, describe, expect, it } from "vitest";
import type { MapLayers } from "@/api/generated/model";
import {
  differsFromDefault,
  hexesAcross,
  loadHidden,
  shownRealLayers,
} from "@/features/maps/map-layers";

const campaign: MapLayers = {
  roads: true,
  places: true,
  water: true,
  forests: true,
  hills: true,
  contours: false,
  grid: true,
};

describe("hexesAcross", () => {
  it("counts the hexes along the view's longest side", () => {
    // About 35 km across at Waterloo, and 22 km down: 7 hexes of 5 km.
    expect(hexesAcross({ west: 4.2, south: 50.6, east: 4.7, north: 50.8 }, 5000)).toBeCloseTo(7, 0);
    // Tall and narrow: the height counts.
    expect(hexesAcross({ west: 4.4, south: 50, east: 4.41, north: 51 }, 5000)).toBeCloseTo(22, 0);
  });
});

describe("shownRealLayers", () => {
  it("hides what the viewer hid, and never shows what the campaign hides", () => {
    const shown = shownRealLayers(campaign, {
      real: ["forests", "contours"],
      game: ["grid"],
      groups: [],
    });

    expect(shown).toEqual({ ...campaign, forests: false, contours: false });
  });

  it("hides all of them with the real map", () => {
    const shown = shownRealLayers(campaign, { real: [], game: [], groups: ["real"] });

    expect(shown).toEqual({
      ...campaign,
      roads: false,
      places: false,
      water: false,
      forests: false,
      hills: false,
    });
  });
});

describe("loadHidden", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is the defaults when nothing's saved, or what's saved isn't ours", () => {
    expect(loadHidden("c")).toEqual({ real: [], game: ["rivers"], groups: [] });
    localStorage.setItem("wwg:map-layers:c", "not json");
    expect(loadHidden("c")).toEqual({ real: [], game: ["rivers"], groups: [] });
  });

  it("hides rivers by default only on the Map page, not in the terrain editor", () => {
    expect(loadHidden("c", "terrain")).toEqual({ real: [], game: [], groups: [] });
  });

  it("keeps only the layers it knows", () => {
    localStorage.setItem(
      "wwg:map-layers:c",
      JSON.stringify({
        real: ["roads", "railways"],
        game: ["bridges", "units"],
        groups: ["game", "both"],
        version: 2,
      }),
    );

    expect(loadHidden("c")).toEqual({ real: ["roads"], game: ["bridges"], groups: ["game"] });
  });

  it("brings what was saved before rivers and waterways were apart up to date", () => {
    localStorage.setItem("wwg:map-layers:c", JSON.stringify({ real: [], game: [], groups: [] }));
    expect(loadHidden("c").game).toEqual(["rivers"]);

    // Hiding `rivers` hid the waterways too.
    localStorage.setItem(
      "wwg:map-layers:c",
      JSON.stringify({ real: [], game: ["rivers"], groups: [] }),
    );
    expect(loadHidden("c").game).toEqual(["rivers", "waterways"]);
  });
});

describe("differsFromDefault", () => {
  it("is false for the defaults, in any order, and true otherwise", () => {
    expect(differsFromDefault({ real: [], game: ["rivers"], groups: [] })).toBe(false);
    expect(differsFromDefault({ real: [], game: [], groups: [] })).toBe(true);
    expect(differsFromDefault({ real: [], game: [], groups: [] }, "terrain")).toBe(false);
    expect(differsFromDefault({ real: [], game: ["rivers", "grid"], groups: [] })).toBe(true);
  });
});
