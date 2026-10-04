import { useState } from "react";
import type { MapBounds, MapLayers } from "@/api/generated/model";
import { distanceMetres } from "@/features/maps/geo";

/**
 * What each viewer shows on the map (the Map page's Layers panel): the real map's layers, from
 * OpenStreetMap, and the game map's, which the app draws from the campaign's terrain. A viewer
 * can hide what the campaign's map settings show, never show what they hide, one by one or a
 * whole map at once (keeping which of its layers they'd hidden). Rivers along the hexsides start
 * hidden on the Map page, where the waterways show the same rivers less busily. The game map is
 * drawn only once the view is close enough to read it.
 */

export const realLayers = [
  { key: "roads", label: "Roads" },
  { key: "places", label: "Place names" },
  { key: "water", label: "Water" },
  { key: "forests", label: "Forests" },
  { key: "hills", label: "Hills" },
  { key: "contours", label: "Contours" },
] as const;

export type RealLayer = (typeof realLayers)[number]["key"];

export const gameLayers = [
  { key: "grid", label: "Grid" },
  { key: "terrain", label: "Terrain" },
  { key: "roads", label: "Roads" },
  { key: "rivers", label: "Rivers" },
  { key: "waterways", label: "Waterways" },
  { key: "towns", label: "Towns & cities" },
  { key: "bridges", label: "Bridges" },
  { key: "warnings", label: "Contact & concentration" },
] as const;

export type GameLayer = (typeof gameLayers)[number]["key"];

/** The two maps, each of which a viewer can hide whole. */
export type LayerGroup = "real" | "game";

/** What a viewer has hidden: layers one by one, and whole maps. */
export interface HiddenLayers {
  real: RealLayer[];
  game: GameLayer[];
  groups: LayerGroup[];
}

const nothingHidden: HiddenLayers = { real: [], game: [], groups: [] };
const layerGroups: readonly string[] = ["real", "game"];

/**
 * What a viewer sees hidden before they change anything: on the Map page, rivers along the
 * hexsides (the waterways show the same rivers); the terrain editor shows everything, as the
 * Umpire edits both.
 */
export const defaultHidden = (page: LayersFor = "map"): HiddenLayers =>
  page === "map" ? { ...nothingHidden, game: ["rivers"] } : nothingHidden;

/**
 * Saved before rivers and waterways had a switch each, `rivers` was both, and rivers weren't
 * hidden by default. Saved since, it's this.
 */
const savedVersion = 2;

/** The game map is drawn once the view's longest side spans this many hexes or fewer. */
export const gameMaxHexesAcross = 20;

/** How many hexes the view's longest side spans. */
export function hexesAcross(view: MapBounds, hexSize: number) {
  const middle = (view.south + view.north) / 2;
  const across = distanceMetres(
    { latitude: middle, longitude: view.west },
    { latitude: middle, longitude: view.east },
  );
  const down = distanceMetres(
    { latitude: view.south, longitude: view.west },
    { latitude: view.north, longitude: view.west },
  );
  return Math.max(across, down) / hexSize;
}

/** Whether a game map layer is shown: the campaign has a game map, and neither it nor the layer is hidden. */
export const showsGameLayer = (campaign: MapLayers, hidden: HiddenLayers, key: GameLayer) =>
  campaign.grid && !hidden.groups.includes("game") && !hidden.game.includes(key);

/** The real map's layers the campaign shows, less those the viewer hid (all, with the map). */
export const shownRealLayers = (campaign: MapLayers, hidden: HiddenLayers): MapLayers => ({
  ...campaign,
  ...Object.fromEntries(
    realLayers.map(({ key }) => [
      key,
      campaign[key] && !hidden.groups.includes("real") && !hidden.real.includes(key),
    ]),
  ),
});

/** Which page's map the layers are for: each remembers its own. */
export type LayersFor = "map" | "terrain";

const storageKey = (campaignId: string, page: LayersFor = "map") =>
  `wwg:${page === "map" ? "map" : "terrain"}-layers:${campaignId}`;

/** Whether a viewer's layers differ from what they'd see before changing anything. */
export function differsFromDefault(hidden: HiddenLayers, page: LayersFor = "map") {
  const defaults = defaultHidden(page);
  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((key) => b.includes(key));
  return (
    !same(hidden.real, defaults.real) ||
    !same(hidden.game, defaults.game) ||
    !same(hidden.groups, defaults.groups)
  );
}

/** What the viewer hid on this campaign's map (or terrain editor), as this device remembers it. */
export function loadHidden(campaignId: string, page: LayersFor = "map"): HiddenLayers {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(campaignId, page)) ?? "null") as
      (Partial<HiddenLayers> & { version?: number }) | null;
    if (saved === null || typeof saved !== "object") return defaultHidden(page);
    const real = new Set<string>(realLayers.map((l) => l.key));
    const game = new Set<string>(gameLayers.map((l) => l.key));
    let savedGame: readonly string[] = saved.game ?? [];
    if (saved.version !== savedVersion) {
      // From before: hiding `rivers` hid the waterways too, and the default now hides rivers.
      const hadRivers = savedGame.includes("rivers");
      savedGame = [
        ...new Set([
          ...savedGame,
          ...defaultHidden(page).game,
          ...(hadRivers ? ["waterways"] : []),
        ]),
      ];
    }
    return {
      real: (saved.real ?? []).filter((key): key is RealLayer => real.has(key)),
      game: savedGame.filter((key): key is GameLayer => game.has(key)),
      groups: (saved.groups ?? []).filter((key): key is LayerGroup => layerGroups.includes(key)),
    };
  } catch {
    // Storage may be blocked or hold something else: the defaults.
    return defaultHidden(page);
  }
}

function saveHidden(campaignId: string, page: LayersFor, hidden: HiddenLayers) {
  try {
    localStorage.setItem(
      storageKey(campaignId, page),
      JSON.stringify({ ...hidden, version: savedVersion }),
    );
  } catch {
    // Not remembered on this device: it still applies until the page closes.
  }
}

/**
 * The viewer's hidden layers on a campaign's map, remembered on this device: the Map page's, or
 * the terrain editor's, apart.
 */
export function useHiddenLayers(campaignId: string, page: LayersFor = "map") {
  const [hidden, setHidden] = useState(() => loadHidden(campaignId, page));
  const change = (next: HiddenLayers) => {
    setHidden(next);
    saveHidden(campaignId, page, next);
  };
  return {
    hidden,
    changed: differsFromDefault(hidden, page),
    toggleReal: (key: RealLayer) => {
      change({
        ...hidden,
        real: hidden.real.includes(key)
          ? hidden.real.filter((k) => k !== key)
          : [...hidden.real, key],
      });
    },
    toggleGame: (key: GameLayer) => {
      change({
        ...hidden,
        game: hidden.game.includes(key)
          ? hidden.game.filter((k) => k !== key)
          : [...hidden.game, key],
      });
    },
    toggleGroup: (group: LayerGroup) => {
      change({
        ...hidden,
        groups: hidden.groups.includes(group)
          ? hidden.groups.filter((g) => g !== group)
          : [...hidden.groups, group],
      });
    },
    reset: () => {
      change(defaultHidden(page));
    },
  };
}
