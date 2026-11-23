import type { ArmyColor } from "@/api/generated/model";
import type { Feature, FeatureCollection, LineString, Polygon } from "geojson";
import { hexKey, type Hex, type HexGrid } from "@/features/maps/hex-grid";
import type { PendingMove } from "@/features/maps/OrderOverlay";
import type { PlacedUnit } from "@/features/maps/stacks";

/**
 * The moves of the chosen hex's units (decision 0041), which stand out on the map while the rest
 * fade: none when nothing is chosen, or none of the units chosen are moving.
 */
export function focusedMoves(
  moves: readonly PendingMove[],
  unitIds: ReadonlySet<string> | null,
): PendingMove[] {
  return unitIds ? moves.filter((move) => unitIds.has(move.placed.unit.id)) : [];
}

/** Where the focused moves go, each hex once, but the hex they start from (already outlined). */
export function destinations(focused: readonly PendingMove[], from: Hex | null): Hex[] {
  const hexes = new Map<string, Hex>();
  for (const { toHex } of focused) hexes.set(hexKey(toHex), toHex);
  if (from) hexes.delete(hexKey(from));
  return [...hexes.values()];
}

/**
 * The focused moves' lines, in their armies' colours: each path once per army, `units` saying how
 * many take it (as `sharedLines` does), and `q` and `r` its destination.
 */
export function focusedLines(
  focused: readonly PendingMove[],
  colorOf: (color: ArmyColor) => string,
): FeatureCollection<LineString> {
  const lines = new Map<
    string,
    { line: [number, number][]; to: Hex; color: string; units: number }
  >();
  for (const { line, toHex, placed } of focused) {
    const color = colorOf(placed.army.color);
    const key = JSON.stringify([line, color]);
    const shared = lines.get(key);
    if (shared) shared.units += 1;
    else lines.set(key, { line, to: toHex, color, units: 1 });
  }
  return {
    type: "FeatureCollection",
    features: [...lines.values()].map(({ line, to, color, units }) => ({
      type: "Feature",
      properties: { color, units, q: to.q, r: to.r },
      geometry: { type: "LineString", coordinates: line },
    })),
  };
}

/** How far back from the destination's centre the tip is, and the head's length and half width,
 *  in hex sizes (centre to corner): it straddles the edge the path crosses into the hex, clear
 *  of the ghost at the centre. */
const tipBack = 0.6;
const headLength = 0.5;
const halfWidth = 0.28;

/**
 * An arrowhead on a move's line where it enters its destination, pointing in (decision 0041); null
 * for a line without a step. `size` is the destination hex's size, centre to corner, in degrees
 * of latitude. Worked out on a plane with longitude scaled by the cosine of the latitude, so it
 * keeps its shape on the map.
 */
export function arrowhead(
  line: readonly [number, number][],
  size: number,
): Feature<Polygon> | null {
  const to = line.at(-1);
  const from = line.at(-2);
  if (!to || !from) return null;
  const k = Math.cos((to[1] * Math.PI) / 180);
  const dx = (to[0] - from[0]) * k;
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const [ux, uy] = [dx / length, dy / length];
  // A point `back` hex sizes behind the destination's centre along the line, `side` across it.
  const at = (back: number, side: number): [number, number] => [
    to[0] + (-ux * back - uy * side) * (size / k),
    to[1] + (-uy * back + ux * side) * size,
  ];
  const tip = at(tipBack, 0);
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [tip, at(tipBack + headLength, halfWidth), at(tipBack + headLength, -halfWidth), tip],
      ],
    },
  };
}

/** The focused lines' arrowheads, each in its line's colour. */
export function arrowheads(
  lines: FeatureCollection<LineString>,
  grid: Pick<HexGrid, "centre" | "corners">,
): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: lines.features.flatMap((line) => {
      const { q, r, color } = line.properties as { q: number; r: number; color: string };
      const { longitude, latitude } = grid.centre({ q, r });
      const [corner] = grid.corners({ q, r });
      const head = arrowhead(
        line.geometry.coordinates as [number, number][],
        hexSize([longitude, latitude], corner),
      );
      return head ? [{ ...head, properties: { color } }] : [];
    }),
  };
}

/** A hex's size, centre to corner, in degrees of latitude (the scale `arrowhead` works in). */
export function hexSize(centre: [number, number], corner: [number, number]): number {
  const k = Math.cos((centre[1] * Math.PI) / 180);
  return Math.hypot((corner[0] - centre[0]) * k, corner[1] - centre[1]);
}

/**
 * What tapping a ghost chooses (step 75b): the hex its units left, so its moves stand out; or,
 * where a ghost's stack gathers units from several hexes, those units, at the first one's hex.
 * Null for a ghost of no moves.
 */
export function ghostChoice(
  moves: readonly PendingMove[],
): { hex: Hex; stack?: PlacedUnit[] } | null {
  const first = moves.at(0);
  if (!first) return null;
  const from = new Set(moves.map((move) => hexKey(move.placed.hex)));
  return from.size === 1
    ? { hex: first.placed.hex }
    : { hex: first.placed.hex, stack: moves.map((move) => move.placed) };
}

/**
 * Without the moves' trails (step 75e): the units, those making `arrivals` drawn where they're
 * going (the hex, and where in it the ghost would be) instead of where they are.
 */
export function atDestinations(
  units: readonly PlacedUnit[],
  arrivals: readonly PendingMove[],
): PlacedUnit[] {
  const going = new Map(arrivals.map((move) => [move.placed.unit.id, move]));
  return units.map((placed) => {
    const move = going.get(placed.unit.id);
    return move
      ? { ...placed, hex: move.toHex, longitude: move.to.longitude, latitude: move.to.latitude }
      : placed;
  });
}

/**
 * What choosing a marker chooses without trails (step 75e), when units in it are drawn where
 * they're going: all of them on their way, what their ghost would (`ghostChoice`), so their moves
 * stand out from where they left; some staying, the marker's units, at its hex. Null when none
 * of its units are on their way.
 */
export function arrivalChoice(
  units: readonly PlacedUnit[],
  arrivals: readonly PendingMove[],
): { hex: Hex; stack?: PlacedUnit[] } | null {
  const ids = new Set(units.map((placed) => placed.unit.id));
  const theirs = arrivals.filter((move) => ids.has(move.placed.unit.id));
  const first = units.at(0);
  if (theirs.length === 0 || !first) return null;
  return theirs.length === units.length
    ? ghostChoice(theirs)
    : { hex: first.hex, stack: [...units] };
}
