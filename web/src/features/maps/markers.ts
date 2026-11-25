import type { Map as MapLibreMap } from "maplibre-gl";
import type { Point } from "@/features/maps/geo";
import { hexKey, type Hex, type HexGrid } from "@/features/maps/hex-grid";
import type { TerrainIndex } from "@/features/maps/terrain";

/** A real-world place from the map's tiles (OpenMapTiles' `place` layer). */
export interface MapPlace {
  /** `city`, `town`, `village` or smaller. */
  kind: string;
  /** Its names, by key: `name`, `name:en` and the like. */
  names: Readonly<Record<string, unknown>>;
  /** Where it is. */
  point: Point;
}

const kinds = ["city", "town", "village"];

/**
 * The real-world places in the map's tiles loaded now, whether or not their names are shown. None
 * where the tiles aren't loaded yet (or the style has no such source).
 */
export function placesOnTheMap(map: Pick<MapLibreMap, "querySourceFeatures">): MapPlace[] {
  try {
    return map.querySourceFeatures("openmaptiles", { sourceLayer: "place" }).flatMap((feature) => {
      if (feature.geometry.type !== "Point") return [];
      const [longitude = 0, latitude = 0] = feature.geometry.coordinates;
      const names = feature.properties as Record<string, unknown>;
      const kind = typeof names.class === "string" ? names.class : "";
      return [{ kind, names, point: { longitude, latitude } }];
    });
  } catch {
    return [];
  }
}

const nameOf = (place: MapPlace, language: string) => {
  const own = place.names[`name:${language}`];
  const fallback = place.names.name;
  if (language !== "local" && typeof own === "string" && own.trim()) return own.trim();
  return typeof fallback === "string" && fallback.trim() ? fallback.trim() : null;
};

/**
 * The largest real-world city, town or village in the hex (decision 0054), named as the map
 * labels it: in `language` where it has a name in it, else its own. Null for none.
 */
export function realPlaceIn(
  places: readonly MapPlace[],
  hex: Hex,
  grid: Pick<HexGrid, "hexAt">,
  language: string,
): string | null {
  const found = places
    .filter((p) => kinds.includes(p.kind) && hexKey(grid.hexAt(p.point)) === hexKey(hex))
    .map((p) => ({ name: nameOf(p, language), size: kinds.indexOf(p.kind) }))
    .filter((p): p is { name: string; size: number } => p.name !== null)
    .sort((a, b) => a.size - b.size || a.name.localeCompare(b.name));
  return found[0]?.name ?? null;
}

/**
 * A new marker's title (decision 0054): the hex's own name in the game (its town, city or
 * fortress), else the real world's place there, else nothing (the viewer gives one).
 */
export function markerTitleFor(
  hex: Hex,
  terrain: TerrainIndex,
  realPlace: () => string | null,
): string {
  const name = terrain.cell(hex)?.settlement.name?.trim();
  if (name) return name;
  return realPlace() ?? "";
}
