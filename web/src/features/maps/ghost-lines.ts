import type { FeatureCollection, LineString } from "geojson";
import type { PendingMove } from "@/features/maps/OrderOverlay";

/**
 * The moves' lines, each path once (step 66): units moving together from one hex along one path
 * share a line, `units` saying how many.
 */
export function sharedLines(moves: readonly PendingMove[]): FeatureCollection<LineString> {
  const lines = new Map<string, { line: [number, number][]; units: number }>();
  for (const { line } of moves) {
    const key = JSON.stringify(line);
    const shared = lines.get(key);
    if (shared) shared.units += 1;
    else lines.set(key, { line, units: 1 });
  }
  return {
    type: "FeatureCollection",
    features: [...lines.values()].map(({ line, units }) => ({
      type: "Feature",
      properties: { units },
      geometry: { type: "LineString", coordinates: line },
    })),
  };
}
