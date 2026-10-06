import type { UnitType } from "@/api/generated/model";

/** What grouping needs of a unit: a library unit, or an army's copy of one. */
export interface Placed {
  type: UnitType;
  division: string | null;
  brigade: string | null;
  corps?: string | null;
  corpsCommander?: string | null;
  divisionCommander?: string | null;
  brigadeCommander?: string | null;
  /** Its place in the imported file (decision 0025); null for a unit entered by hand. */
  importOrder?: number | null;
}

/** A brigade: its units, and who commands it when no unit of its own is that commander. */
export interface Brigade<T> {
  name: string;
  /**
   * The commander named on its units, to show beside its name; null when it has a Commander unit
   * of its own (decision 0030: theirs sits in the formation they command) or names nobody.
   */
  commander: string | null;
  units: T[];
}

/** A division: its own units (its commander, say), then its brigades. */
export interface Division<T> extends Brigade<T> {
  brigades: Brigade<T>[];
}

/** A corps (decision 0025): its own units and brigades, then its divisions. */
export interface Corps<T> extends Division<T> {
  divisions: Division<T>[];
}

/**
 * Units in their order of battle (decisions 0024 and 0025): those in no corps (with their own
 * brigades and divisions) first, then each corps. With nothing grouped (`grouped` false), every
 * unit is in `units`.
 */
export interface OrderOfBattle<T> extends Corps<T> {
  corps: Corps<T>[];
  grouped: boolean;
}

/** The same group whatever the spacing or case it was typed in. */
const keyOf = (name: string) => name.trim().toLowerCase();

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true });

/** Where a unit comes in the imported file; units entered by hand come after. */
const placeOf = (unit: Placed) => unit.importOrder ?? Number.POSITIVE_INFINITY;

/** A group's place: its first unit's in the file. */
const firstPlace = (units: readonly Placed[]) => Math.min(...units.map(placeOf));

/**
 * Groups in the file's order (the Guard first, say, which no sort by name would give), then the
 * rest by name, as people count ("2nd" before "10th").
 */
const inFileOrder = (a: { units: Placed[]; name: string }, b: { units: Placed[]; name: string }) =>
  firstPlace(a.units) - firstPlace(b.units) || byName(a, b);

/** Commanders first, then in the file's order, then as given (the API sorts by name). */
function ordered<T extends Placed>(units: T[]) {
  const sorted = [...units].sort((a, b) => placeOf(a) - placeOf(b) || 0);
  return [
    ...sorted.filter((unit) => unit.type === "Commander"),
    ...sorted.filter((unit) => unit.type !== "Commander"),
  ];
}

/**
 * Who commands a group, to name beside it: the first of its units to name someone, unless one of
 * its `own` units (not its brigades' or divisions') is a Commander, which shows them already.
 */
function commanderOf<T extends Placed>(
  units: readonly T[],
  own: readonly T[],
  pick: (unit: T) => string | null | undefined,
) {
  if (own.some((unit) => unit.type === "Commander")) return null;
  for (const unit of ordered([...units])) {
    const name = pick(unit)?.trim();
    if (name) return name;
  }
  return null;
}

/** Units with no name for the group, and the groups (by name, as first written) in file order. */
function grouped<T extends Placed>(
  units: readonly T[],
  nameOf: (unit: T) => string | null | undefined,
) {
  const loose: T[] = [];
  const groups = new Map<string, { name: string; units: T[] }>();
  for (const unit of units) {
    const name = nameOf(unit)?.trim();
    if (!name) {
      loose.push(unit);
      continue;
    }
    const group = groups.get(keyOf(name)) ?? { name, units: [] };
    group.units.push(unit);
    groups.set(keyOf(name), group);
  }
  return { loose, groups: [...groups.values()].sort(inFileOrder) };
}

/** Units under their brigades: those in none first, then the brigades. */
function brigaded<T extends Placed>(units: readonly T[]): Division<T> {
  const { loose, groups } = grouped(units, (unit) => unit.brigade);
  return {
    name: "",
    commander: null,
    units: ordered(loose),
    brigades: groups.map((brigade) => ({
      name: brigade.name,
      commander: commanderOf(brigade.units, brigade.units, (unit) => unit.brigadeCommander),
      units: ordered(brigade.units),
    })),
  };
}

/** Units under their divisions and brigades: those in no division (and their brigades) first. */
function divided<T extends Placed>(units: readonly T[]): Corps<T> {
  const { loose, groups } = grouped(units, (unit) => unit.division);
  return {
    ...brigaded(loose),
    divisions: groups.map((division) => {
      const brigades = brigaded(division.units);
      return {
        ...brigades,
        name: division.name,
        commander: commanderOf(division.units, brigades.units, (unit) => unit.divisionCommander),
      };
    }),
  };
}

/** Groups units by corps, then division, then brigade. */
export function orderOfBattle<T extends Placed>(units: readonly T[]): OrderOfBattle<T> {
  const { loose, groups } = grouped(units, (unit) => unit.corps);
  const top = divided(loose);
  return {
    ...top,
    corps: groups.map((corps) => {
      const divisions = divided(corps.units);
      return {
        ...divisions,
        name: corps.name,
        commander: commanderOf(corps.units, divisions.units, (unit) => unit.corpsCommander),
      };
    }),
    grouped: groups.length > 0 || top.divisions.length > 0 || top.brigades.length > 0,
  };
}

/** Every unit in a group: its own, its brigades' and its divisions'. */
export function unitsIn<T>(group: Division<T> & { divisions?: Division<T>[] }): T[] {
  return [
    ...group.units,
    ...group.brigades.flatMap((brigade) => brigade.units),
    ...(group.divisions ?? []).flatMap((division) => unitsIn(division)),
  ];
}
