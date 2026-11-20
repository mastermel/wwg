import { FormationMenu } from "@/features/maps/FormationMenu";
import type { PlacedUnit } from "@/features/maps/stacks";

/** A formation picked out on the map (step 64): its name, for saying so, and its units. */
export interface PickedOut {
  name: string;
  unitIds: ReadonlySet<string>;
}

/** Whether these units are the ones picked out: the same formation, whichever list it's in. */
export const isPickedOut = (picked: PickedOut | null, unitIds: readonly string[]) =>
  picked !== null &&
  picked.unitIds.size === unitIds.length &&
  unitIds.every((id) => picked.unitIds.has(id));

/**
 * What stands out on the map, as a test of each unit: a picked-out formation's units; else the
 * army the Umpire picked out (`ArmiesPanel`); else nothing (null: every unit alike).
 */
export function standsOut(
  picked: PickedOut | null,
  army: string | null,
): ((placed: PlacedUnit) => boolean) | null {
  if (picked) return (placed) => picked.unitIds.has(placed.unit.id);
  if (army) return (placed) => placed.army.id === army;
  return null;
}

/**
 * `FormationList`'s `picked` and `actions` for picking formations out on the map (step 64): each
 * heading marked while its formation is the one picked out, with a `FormationMenu` to pick it out
 * or let it go.
 */
export function pickingOut<T>(
  picked: PickedOut | null,
  onPickOut: (formation: PickedOut | null) => void,
  unitIdOf: (item: T) => string,
) {
  const isPicked = (items: T[]) => isPickedOut(picked, items.map(unitIdOf));
  return {
    picked: isPicked,
    actions: (name: string, items: T[]) => (
      <FormationMenu
        name={name}
        pickedOut={isPicked(items)}
        onPickOut={() => {
          onPickOut(isPicked(items) ? null : { name, unitIds: new Set(items.map(unitIdOf)) });
        }}
      />
    ),
  };
}
