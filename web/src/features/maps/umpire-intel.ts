import type {
  ArmySummary,
  ArmyUnitResponse,
  UmpireSightingRequest,
  UnitPosition,
} from "@/api/generated/model";
import { hexKey, type Hex } from "@/features/maps/hex-grid";
import type { SightingEntry } from "@/features/maps/sighting-entries";
import { suggestedSize } from "@/features/maps/sightings";

/** A unit the Umpire can tell an army of (decision 0035), where it stood as the open turn started. */
export interface IntelUnit {
  unit: ArmyUnitResponse;
  army: ArmySummary;
  hex: Hex;
  afloat: boolean;
}

/** An army's units on the map, for choosing among. */
export interface IntelArmy {
  army: ArmySummary;
  units: IntelUnit[];
}

/**
 * The units on the map, from where they stood as the open turn started; boats tied to a unit go
 * with it (decision 0022), so they're left out.
 */
export function intelUnits(
  units: readonly ArmyUnitResponse[],
  armies: readonly ArmySummary[],
  positions: readonly UnitPosition[],
): IntelUnit[] {
  const at = new Map(positions.map((p) => [p.unitId, p]));
  return units.flatMap((unit) => {
    const position = at.get(unit.id);
    const army = armies.find((a) => a.id === unit.armyId);
    return position && army && !position.carriedBy
      ? [
          {
            unit,
            army,
            hex: { q: position.q, r: position.r },
            afloat: position.boats.length > 0,
          },
        ]
      : [];
  });
}

/**
 * The armies the recipient can be told of, each with its units: of its own side (positions,
 * leaving the recipient out, as it knows its own) or of the other (sightings).
 */
export function intelArmies(
  units: readonly IntelUnit[],
  armies: readonly ArmySummary[],
  to: ArmySummary,
  ownSide: boolean,
): IntelArmy[] {
  return armies
    .filter((a) => a.id !== to.id && (a.side.id === to.side.id) === ownSide)
    .map((army) => ({ army, units: units.filter((u) => u.army.id === army.id) }))
    .filter((a) => a.units.length > 0);
}

/**
 * One sighting per hex of the chosen units of the other side, each as the Umpire last shaped it
 * for that hex, else prefilled: everything shown, with a rough size (as the start-turn dialog's).
 */
export function sightingEntries(
  chosen: readonly IntelUnit[],
  toArmyId: string,
  shapes: ReadonlyMap<string, SightingEntry>,
): SightingEntry[] {
  const byHex = new Map<string, IntelUnit[]>();
  for (const u of chosen) byHex.set(hexKey(u.hex), [...(byHex.get(hexKey(u.hex)) ?? []), u]);
  return [...byHex.entries()].map(([key, here]) => {
    const units = here.map((u) => ({
      unitId: u.unit.id,
      armyId: u.army.id,
      name: u.unit.name,
      type: u.unit.type,
      points: u.unit.points,
      afloat: u.afloat,
    }));
    const hex = here[0]?.hex ?? { q: 0, r: 0 };
    const shaped = shapes.get(key);
    return shaped
      ? { ...shaped, units }
      : {
          observingArmyId: toArmyId,
          q: hex.q,
          r: hex.r,
          whereabouts: "From the Umpire",
          screened: false,
          units,
          screenedUnits: [],
          pastScreen: false,
          byHand: false,
          include: true,
          showsHex: true,
          showsArmies: true,
          showsTypes: true,
          showsAfloat: units.some((u) => u.afloat),
          strength: "Rough",
          size: suggestedSize(units.reduce((sum, u) => sum + u.points, 0)),
        };
  });
}

/** The sightings to send: those included, as shaped. */
export const umpireSightings = (entries: readonly SightingEntry[]): UmpireSightingRequest[] =>
  entries
    .filter((e) => e.include)
    .map((e) => ({
      unitIds: e.units.map((u) => u.unitId),
      showsHex: e.showsHex,
      showsArmies: e.showsArmies,
      showsTypes: e.showsTypes,
      showsAfloat: e.showsAfloat && e.units.some((u) => u.afloat),
      strength: e.strength,
      size: e.strength === "Rough" ? e.size : null,
    }));
