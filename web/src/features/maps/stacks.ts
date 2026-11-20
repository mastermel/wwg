import type { ArmySummary, ArmyUnitResponse } from "@/api/generated/model";
import { hexKey, type Hex } from "@/features/maps/hex-grid";
import { unitTypeLabels } from "@/features/units/unit-types";
import type { HeadingInto } from "@/features/maps/movement";

/** A unit where it is on the map, with its army (for its colour): its hex, and that hex's centre. */
export interface PlacedUnit {
  unit: ArmyUnitResponse;
  army: ArmySummary;
  hex: Hex;
  latitude: number;
  longitude: number;
  /** Part of the way into the next hex, from its last move (step 44). */
  headingInto?: HeadingInto;
  /** It lived off the land in the turn its position is after (step 48b). */
  livesOffTheLand?: boolean;
  /** The boats it's on, as of its position (step 51): empty, or missing, ashore. */
  boats?: readonly string[];
}

/** Units drawn as one marker: those that would overlap at the current zoom. */
export interface UnitStack {
  /** Stable while its first unit leads it. */
  key: string;
  units: PlacedUnit[];
  latitude: number;
  longitude: number;
}

/** The Commander in Chief first (decision 0032), so a stack's marker shows where the player is. */
const chiefFirst = (units: PlacedUnit[]) => [
  ...units.filter((placed) => placed.unit.isCommanderInChief),
  ...units.filter((placed) => !placed.unit.isCommanderInChief),
];

/**
 * Groups units whose markers would overlap (within `radius` pixels at the current zoom) into
 * stacks, each at its first unit's position. Greedy, in the given order, which is enough for the
 * few dozen units of a campaign. A Commander in Chief leads its stack, which keeps its key and place.
 */
export function stackUnits(
  units: readonly PlacedUnit[],
  project: (lngLat: [number, number]) => { x: number; y: number },
  radius = 26,
): UnitStack[] {
  const stacks: (UnitStack & { x: number; y: number })[] = [];
  for (const placed of units) {
    const { x, y } = project([placed.longitude, placed.latitude]);
    const near = stacks.find((stack) => Math.hypot(stack.x - x, stack.y - y) < radius);
    if (near) {
      near.units.push(placed);
    } else {
      stacks.push({
        key: placed.unit.id,
        units: [placed],
        latitude: placed.latitude,
        longitude: placed.longitude,
        x,
        y,
      });
    }
  }
  return stacks.map(({ key, units: members, latitude, longitude }) => ({
    key,
    units: chiefFirst(members),
    latitude,
    longitude,
  }));
}

/** The units in a hex. */
export const unitsIn = (hex: Hex, units: readonly PlacedUnit[]) =>
  units.filter((placed) => hexKey(placed.hex) === hexKey(hex));

/** What a screen reader hears for a unit. */
export const describeUnit = ({ unit, army }: PlacedUnit) =>
  `${unit.name}, ${unit.isCommanderInChief ? "Commander in Chief" : unitTypeLabels[unit.type]}, ${army.name}`;

/** A unit's name, saying when it's its army's Commander in Chief (decision 0032). */
export const nameWithRank = ({ unit }: PlacedUnit) =>
  unit.isCommanderInChief ? `${unit.name} (Commander in Chief)` : unit.name;
