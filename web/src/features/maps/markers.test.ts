import { describe, expect, it } from "vitest";
import type { HexCellResponse } from "@/api/generated/model";
import type { Point } from "@/features/maps/geo";
import type { Hex } from "@/features/maps/hex-grid";
import { markerTitleFor, realPlaceIn, type MapPlace } from "@/features/maps/markers";
import type { TerrainIndex } from "@/features/maps/terrain";

// A grid whose hexes are whole degrees of longitude, along the equator.
const grid = { hexAt: (point: Point): Hex => ({ q: Math.floor(point.longitude), r: 0 }) };
const at = (longitude: number): Point => ({ longitude, latitude: 0 });
const place = (kind: string, names: Record<string, string>, longitude = 0.5): MapPlace => ({
  kind,
  names,
  point: at(longitude),
});

describe("realPlaceIn", () => {
  it("prefers a city to a town, and a town to a village", () => {
    const places = [
      place("village", { name: "Plancenoit" }),
      place("city", { name: "Bruxelles" }),
      place("town", { name: "Waterloo" }),
    ];

    expect(realPlaceIn(places, { q: 0, r: 0 }, grid, "local")).toBe("Bruxelles");
  });

  it("leaves out places in other hexes and smaller than a village", () => {
    const places = [place("city", { name: "Namur" }, 1.5), place("hamlet", { name: "Fichermont" })];

    expect(realPlaceIn(places, { q: 0, r: 0 }, grid, "local")).toBeNull();
  });

  it("names it in the map's language, falling back to its own name", () => {
    const hex = { q: 0, r: 0 };

    expect(
      realPlaceIn([place("city", { name: "Bruxelles", "name:en": "Brussels" })], hex, grid, "en"),
    ).toBe("Brussels");
    expect(realPlaceIn([place("city", { name: "Liège" })], hex, grid, "en")).toBe("Liège");
    expect(
      realPlaceIn(
        [place("city", { name: "Bruxelles", "name:en": "Brussels" })],
        hex,
        grid,
        "local",
      ),
    ).toBe("Bruxelles");
  });
});

describe("markerTitleFor", () => {
  const terrain = (name: string | null): TerrainIndex => ({
    cell: () => ({ settlement: { name } }) as HexCellResponse,
    edge: () => undefined,
  });
  const hex = { q: 0, r: 0 };

  it("is the hex's own name in the game first", () => {
    expect(markerTitleFor(hex, terrain("Hougoumont"), () => "Braine-l'Alleud")).toBe("Hougoumont");
  });

  it("is the real world's place where the game names none", () => {
    expect(markerTitleFor(hex, terrain(null), () => "Braine-l'Alleud")).toBe("Braine-l'Alleud");
  });

  it("is empty where neither names one", () => {
    expect(markerTitleFor(hex, terrain(null), () => null)).toBe("");
  });
});
