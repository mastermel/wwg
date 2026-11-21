import { hexKey, type HexGrid } from "@/features/maps/hex-grid";
import type { PendingMove } from "@/features/maps/OrderOverlay";
import type { PlacedUnit } from "@/features/maps/stacks";

/** The units and ghosts to draw, where they're drawn; `split`: the hexes drawn in halves. */
export interface SideBySide {
  units: PlacedUnit[];
  moves: PendingMove[];
  split: ReadonlySet<string>;
}

/**
 * Where units share a hex with ghosts of units moving into it (decision 0039): the units there
 * are drawn in its west half, the ghosts in its east half, so neither hides the other. A hex
 * with only one or the other keeps them at its centre. Only where they're drawn changes: each
 * unit's hex stays its own.
 */
export function sideBySide(
  units: readonly PlacedUnit[],
  moves: readonly PendingMove[],
  grid: Pick<HexGrid, "half">,
): SideBySide {
  const arriving = new Set(moves.map((move) => hexKey(move.toHex)));
  const split = new Set(units.map((placed) => hexKey(placed.hex)).filter((k) => arriving.has(k)));
  return {
    units: units.map((placed) =>
      split.has(hexKey(placed.hex)) ? { ...placed, ...grid.half(placed.hex, "west") } : placed,
    ),
    moves: moves.map((move) =>
      split.has(hexKey(move.toHex)) ? { ...move, to: grid.half(move.toHex, "east") } : move,
    ),
    split,
  };
}
