import { describe, expect, it } from "vitest";
import { sharedLines } from "@/features/maps/ghost-lines";
import type { PendingMove } from "@/features/maps/OrderOverlay";

const move = (line: [number, number][]) =>
  ({ line, to: { longitude: 0, latitude: 0 } }) as PendingMove;

describe("sharedLines", () => {
  it("draws a path several units take once, counting them", () => {
    const together: [number, number][] = [
      [4.4, 50.7],
      [4.4, 50.72],
    ];
    const alone: [number, number][] = [
      [4.4, 50.7],
      [4.42, 50.71],
    ];

    const lines = sharedLines([move(together), move(alone), move([...together])]);

    expect(lines.features.map((f) => [f.geometry.coordinates, f.properties])).toEqual([
      [together, { units: 2 }],
      [alone, { units: 1 }],
    ]);
  });
});
