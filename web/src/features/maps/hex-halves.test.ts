import { describe, expect, it } from "vitest";
import type { Hex } from "@/features/maps/hex-grid";
import { sideBySide } from "@/features/maps/hex-halves";
import type { PendingMove } from "@/features/maps/OrderOverlay";
import type { PlacedUnit } from "@/features/maps/stacks";

// Each hex's centre is (q, r) in degrees; its halves a tenth either side.
const grid = {
  half: ({ q, r }: Hex, which: "west" | "east") => ({
    longitude: q + (which === "west" ? -0.1 : 0.1),
    latitude: r,
  }),
};

const unit = (id: string, hex: Hex) =>
  ({ unit: { id }, hex, longitude: hex.q, latitude: hex.r }) as PlacedUnit;

const move = (placed: PlacedUnit, toHex: Hex): PendingMove => ({
  placed,
  toHex,
  to: { longitude: toHex.q, latitude: toHex.r },
  line: [],
});

describe("units and ghosts side by side", () => {
  it("draws a hex's units in its west half and the ghosts coming in in its east half", () => {
    const staying = unit("staying", { q: 1, r: 1 });
    const coming = unit("coming", { q: 0, r: 0 });

    const drawn = sideBySide([staying, coming], [move(coming, { q: 1, r: 1 })], grid);

    expect([...drawn.split]).toEqual(["1,1"]);
    expect(drawn.units.map((p) => [p.unit.id, p.longitude, p.latitude])).toEqual([
      ["staying", 0.9, 1],
      ["coming", 0, 0],
    ]);
    expect(drawn.moves.map((m) => m.to)).toEqual([{ longitude: 1.1, latitude: 1 }]);
    // Only where they're drawn: the hex stays its own.
    expect(drawn.units[0]?.hex).toEqual({ q: 1, r: 1 });
  });

  it("keeps units alone, and ghosts alone, at the centre", () => {
    const here = unit("here", { q: 0, r: 0 });
    const going = move(here, { q: 2, r: 0 });

    const drawn = sideBySide([here], [going], grid);

    expect(drawn.split.size).toBe(0);
    expect(drawn.units[0]).toBe(here);
    expect(drawn.moves[0]).toBe(going);
  });

  it("splits both hexes when two units swap", () => {
    const a = unit("a", { q: 0, r: 0 });
    const b = unit("b", { q: 1, r: 0 });

    const drawn = sideBySide([a, b], [move(a, { q: 1, r: 0 }), move(b, { q: 0, r: 0 })], grid);

    expect(drawn.units.map((p) => p.longitude)).toEqual([-0.1, 0.9]);
    expect(drawn.moves.map((m) => m.to.longitude)).toEqual([1.1, 0.1]);
  });
});
