import type {
  ForceSize,
  SightedUnitResponse,
  SightingDueResponse,
  SightingRequest,
  SightingStrength,
} from "@/api/generated/model";
import { suggestedSize } from "@/features/maps/sightings";

/** One sighting in the start-turn list, as the Umpire is shaping it. */
export interface SightingEntry {
  observingArmyId: string;
  q: number;
  r: number;
  whereabouts: string;
  screened: boolean;
  /** What it sees: only the screen, where there is one (decision 0026). */
  units: readonly SightedUnitResponse[];
  /** What the screen in the hex hides. */
  screenedUnits: readonly SightedUnitResponse[];
  /** Whether it gets past the screen, seeing what it hides too. */
  pastScreen: boolean;
  /** Added by the Umpire rather than found. */
  byHand: boolean;
  include: boolean;
  showsHex: boolean;
  showsArmies: boolean;
  showsTypes: boolean;
  /** Whether it says the force was on boats (step 51); offered only when it was. */
  showsAfloat: boolean;
  strength: SightingStrength;
  size: ForceSize;
}

const pointsOf = (units: readonly { points: number }[]) =>
  units.reduce((sum, u) => sum + u.points, 0);

/** The units a sighting shows: those it sees, and what the screen hides once past it. */
export const shownUnits = (entry: SightingEntry) =>
  entry.pastScreen ? [...entry.units, ...entry.screenedUnits] : entry.units;

/** A sighting past its screen, or back behind it, with its rough size suggested afresh. */
export const withPastScreen = (entry: SightingEntry, pastScreen: boolean): SightingEntry => {
  const changed = { ...entry, pastScreen };
  const shown = shownUnits(changed);
  return {
    ...changed,
    showsAfloat: shown.some((u) => u.afloat),
    size: suggestedSize(pointsOf(shown)),
  };
};

/** Each sighting the app found, prefilled: everything shown, with a rough size (decision 0020). */
export const initialEntries = (due: readonly SightingDueResponse[]): SightingEntry[] =>
  due.map((d) => ({
    observingArmyId: d.observingArmyId,
    q: d.q,
    r: d.r,
    whereabouts: d.whereabouts,
    screened: d.screened,
    units: d.units,
    screenedUnits: d.screenedUnits,
    pastScreen: false,
    byHand: false,
    include: true,
    showsHex: true,
    showsArmies: true,
    showsTypes: true,
    showsAfloat: d.units.some((u) => u.afloat),
    strength: "Rough",
    size: suggestedSize(pointsOf(d.units)),
  }));

/** The sightings to send: those included, as shaped. */
export const toRequests = (entries: readonly SightingEntry[]): SightingRequest[] =>
  entries
    .filter((e) => e.include)
    .map((e) => ({
      observingArmyId: e.observingArmyId,
      q: e.q,
      r: e.r,
      showsHex: e.showsHex,
      showsArmies: e.showsArmies,
      showsTypes: e.showsTypes,
      showsAfloat: e.showsAfloat && shownUnits(e).some((u) => u.afloat),
      strength: e.strength,
      size: e.strength === "Rough" ? e.size : null,
      // One added by hand lists every unit in the hex, so it tells of them all, screen or not.
      pastScreen: e.byHand || (e.pastScreen && e.screenedUnits.length > 0),
    }));
