import { describe, expect, it } from "vitest";
import type { ArmyColor } from "@/api/generated/model";
import {
  arrowhead,
  arrowheads,
  arrivalChoice,
  atDestinations,
  destinations,
  focusedLines,
  focusedMoves,
  ghostChoice,
  hexSize,
} from "@/features/maps/move-focus";
import type { Hex } from "@/features/maps/hex-grid";
import type { PendingMove } from "@/features/maps/OrderOverlay";
import type { PlacedUnit } from "@/features/maps/stacks";

const move = (unitId: string, color: ArmyColor, toHex: Hex, line: [number, number][]) =>
  ({
    placed: { unit: { id: unitId }, army: { color } },
    toHex,
    to: { longitude: 0, latitude: 0 },
    line,
  }) as unknown as PendingMove;

const path: [number, number][] = [
  [4.4, 50.7],
  [4.4, 50.72],
];
const north = move("a", "Red", { q: 0, r: -1 }, path);
const alongside = move("b", "Red", { q: 0, r: -1 }, [...path]);
const ally = move("c", "Blue", { q: 0, r: -1 }, [...path]);
const elsewhere = move("d", "Red", { q: 1, r: 0 }, [
  [4.4, 50.7],
  [4.42, 50.71],
]);

describe("focusedMoves", () => {
  it("picks the chosen units' moves", () => {
    expect(focusedMoves([north, elsewhere, ally], new Set(["a", "c"]))).toEqual([north, ally]);
  });

  it("picks none with nothing chosen", () => {
    expect(focusedMoves([north, elsewhere], null)).toEqual([]);
  });
});

describe("destinations", () => {
  it("names each hex once, but the one they start from", () => {
    const back = move("e", "Red", { q: 0, r: 0 }, path);
    expect(destinations([north, alongside, elsewhere, back], { q: 0, r: 0 })).toEqual([
      { q: 0, r: -1 },
      { q: 1, r: 0 },
    ]);
  });
});

describe("focusedLines", () => {
  it("draws a path once per army, counting its units, with its destination", () => {
    const lines = focusedLines([north, alongside, ally], (color) => color.toLowerCase());

    expect(lines.features.map((f) => [f.geometry.coordinates, f.properties])).toEqual([
      [path, { color: "red", units: 2, q: 0, r: -1 }],
      [path, { color: "blue", units: 1, q: 0, r: -1 }],
    ]);
  });
});

describe("arrowhead", () => {
  it("points along the last step, straddling the edge into the hex", () => {
    // Due north, at the equator, where a degree is a degree either way.
    const head = arrowhead(
      [
        [0, -2],
        [0, 0],
        [0, 1],
      ],
      1,
    );

    expect(head).not.toBeNull();
    const [tip, left, right] = head?.geometry.coordinates[0] ?? [];
    expect(tip[0]).toBeCloseTo(0);
    expect(tip[1]).toBeCloseTo(0.4);
    expect(left[1]).toBeCloseTo(-0.1);
    expect(right[1]).toBeCloseTo(-0.1);
    expect(left[0]).toBeCloseTo(-0.28);
    expect(right[0]).toBeCloseTo(0.28);
  });

  it("keeps its shape away from the equator, longitude scaled by the latitude", () => {
    // Due east at 60°, where a degree of longitude is half a degree of latitude.
    const head = arrowhead(
      [
        [-2, 60],
        [0, 60],
      ],
      1,
    );

    const tip = head?.geometry.coordinates[0]?.[0];
    expect(tip?.[0]).toBeCloseTo(-1.2);
    expect(tip?.[1]).toBeCloseTo(60);
  });

  it("is none for a line without a step", () => {
    expect(arrowhead([[0, 0]], 1)).toBeNull();
    expect(
      arrowhead(
        [
          [0, 0],
          [0, 0],
        ],
        1,
      ),
    ).toBeNull();
  });
});

describe("arrowheads", () => {
  it("puts one on each line, sized by its destination hex, in its colour", () => {
    const grid = {
      centre: () => ({ longitude: 0, latitude: 1 }),
      corners: (): [number, number][] => [[0.5, 1]],
    };
    const lines = focusedLines(
      [
        move("a", "Red", { q: 0, r: -1 }, [
          [0, 0],
          [0, 1],
        ]),
      ],
      () => "red",
    );

    const heads = arrowheads(lines, grid);

    expect(heads.features).toHaveLength(1);
    expect(heads.features[0]?.properties).toEqual({ color: "red" });
    // Size half a degree (near enough at 1°): the tip 0.3 short of the centre.
    expect(heads.features[0]?.geometry.coordinates[0]?.[0]?.[1]).toBeCloseTo(0.7, 2);
  });
});

describe("hexSize", () => {
  it("is the distance to a corner, longitude scaled by the latitude", () => {
    expect(hexSize([0, 60], [1, 60])).toBeCloseTo(0.5);
  });
});

describe("ghostChoice", () => {
  const from = (unitId: string, hex: Hex) =>
    ({ placed: { unit: { id: unitId }, hex }, toHex: { q: 5, r: 5 } }) as unknown as PendingMove;

  it("chooses the hex its units left", () => {
    expect(ghostChoice([from("a", { q: 0, r: 0 }), from("b", { q: 0, r: 0 })])).toEqual({
      hex: { q: 0, r: 0 },
    });
  });

  it("chooses the units themselves when they left different hexes", () => {
    const a = from("a", { q: 0, r: 0 });
    const b = from("b", { q: 1, r: 0 });
    expect(ghostChoice([a, b])).toEqual({ hex: { q: 0, r: 0 }, stack: [a.placed, b.placed] });
  });

  it("chooses nothing for no moves", () => {
    expect(ghostChoice([])).toBeNull();
  });
});

describe("without trails", () => {
  const unit = (id: string, hex: Hex) =>
    ({ unit: { id }, hex, longitude: 0, latitude: 0 }) as unknown as PlacedUnit;
  const going = (placed: PlacedUnit, toHex: Hex) =>
    ({ placed, toHex, to: { longitude: 4.5, latitude: 50.8, extra: 1 } }) as unknown as PendingMove;
  const staying = unit("a", { q: 0, r: 0 });
  const leaving = unit("b", { q: 1, r: 0 });
  const away = going(leaving, { q: 0, r: 0 });

  it("draws the units on their way where they're going, the rest where they are", () => {
    expect(atDestinations([staying, leaving], [away])).toEqual([
      staying,
      { ...leaving, hex: { q: 0, r: 0 }, longitude: 4.5, latitude: 50.8 },
    ]);
  });

  it("chooses where a marker's units left, when all of them are on their way", () => {
    const [drawn] = atDestinations([leaving], [away]) as [PlacedUnit];
    expect(arrivalChoice([drawn], [away])).toEqual({ hex: { q: 1, r: 0 } });
  });

  it("chooses a marker's units at its hex, when some of them stay", () => {
    const [, drawn] = atDestinations([staying, leaving], [away]) as [PlacedUnit, PlacedUnit];
    expect(arrivalChoice([staying, drawn], [away])).toEqual({
      hex: { q: 0, r: 0 },
      stack: [staying, drawn],
    });
  });

  it("chooses nothing apart for a marker without units on their way", () => {
    expect(arrivalChoice([staying], [away])).toBeNull();
  });
});
