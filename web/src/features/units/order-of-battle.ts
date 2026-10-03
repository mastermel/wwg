import type { UnitType } from "@/api/generated/model";

/** What grouping needs of a unit: a library unit, or an army's copy of one. */
export interface Placed {
  type: UnitType;
  division: string | null;
  brigade: string | null;
}

/** A brigade, and its units. */
export interface Brigade<T> {
  name: string;
  units: T[];
}

/** A division: its own units (its commander, say), then its brigades. */
export interface Division<T> extends Brigade<T> {
  brigades: Brigade<T>[];
}

/**
 * Units in their order of battle (decision 0024): those in no division (and their brigades)
 * first, then each division. With nothing grouped (`grouped` false), every unit is in `units`.
 */
export interface OrderOfBattle<T> extends Division<T> {
  divisions: Division<T>[];
  grouped: boolean;
}

/** The same group whatever the spacing or case it was typed in. */
const keyOf = (name: string) => name.trim().toLowerCase();

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true });

/** Commanders first, then as given (the API sorts by name). */
function commandersFirst<T extends Placed>(units: T[]) {
  return [
    ...units.filter((unit) => unit.type === "Commander"),
    ...units.filter((unit) => unit.type !== "Commander"),
  ];
}

/** Units under their brigades: those in none first, then the brigades by name. */
function brigaded<T extends Placed>(units: T[]): Division<T> {
  const loose: T[] = [];
  const brigades = new Map<string, Brigade<T>>();
  for (const unit of units) {
    const name = unit.brigade?.trim();
    if (!name) {
      loose.push(unit);
      continue;
    }
    const brigade = brigades.get(keyOf(name)) ?? { name, units: [] };
    brigade.units.push(unit);
    brigades.set(keyOf(name), brigade);
  }
  return {
    name: "",
    units: commandersFirst(loose),
    brigades: [...brigades.values()]
      .map((brigade) => ({ ...brigade, units: commandersFirst(brigade.units) }))
      .sort(byName),
  };
}

/** Groups units by division, then brigade; names sort as people count ("2nd" before "10th"). */
export function orderOfBattle<T extends Placed>(units: readonly T[]): OrderOfBattle<T> {
  const loose: T[] = [];
  const divisions = new Map<string, { name: string; units: T[] }>();
  for (const unit of units) {
    const name = unit.division?.trim();
    if (!name) {
      loose.push(unit);
      continue;
    }
    const division = divisions.get(keyOf(name)) ?? { name, units: [] };
    division.units.push(unit);
    divisions.set(keyOf(name), division);
  }
  const top = brigaded(loose);
  return {
    ...top,
    divisions: [...divisions.values()]
      .map((division) => ({ ...brigaded(division.units), name: division.name }))
      .sort(byName),
    grouped: divisions.size > 0 || top.brigades.length > 0,
  };
}

/** Every unit in a division, its brigades' too. */
export function unitsIn<T>(division: Division<T>) {
  return [...division.units, ...division.brigades.flatMap((brigade) => brigade.units)];
}
