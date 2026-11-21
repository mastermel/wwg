import type {
  ArmySummary,
  ArmyTurnDetails,
  TurnPart,
  UnitMarchResponse,
  UnitType,
} from "@/api/generated/model";
import { attritionInWords, canForceMarch, forceMarchBonus } from "@/features/maps/marches";
import { budgetFor, type Marches, type Rates, type StackMover } from "@/features/maps/movement";
import type { PlacedUnit } from "@/features/maps/stacks";

/**
 * Moving a hex's units together (step 66, decision 0031): which of them can, and what it takes.
 * The stack's reach is `movement.ts`' `stackReach`.
 */

/** How a placed unit moves: as boats while it's on them (step 51), else by its type. */
export const movesAs = (placed: PlacedUnit): UnitType =>
  (placed.boats?.length ?? 0) > 0 ? "Boat" : placed.unit.type;

/** One army's units in a hex that could move together, or why they can't. */
export interface StackGroup {
  army: ArmySummary;
  /** Its units in the hex without an order this turn (loose boats left out). */
  units: PlacedUnit[];
  /** Some are on boats and some ashore: they don't move together. */
  mixed: boolean;
}

/**
 * Each army's units in the hex that could move together: those without an order in its open
 * turn, while the viewer can change it, and two or more of them. Boats not carrying a unit are
 * left out; units on boats move together only with units on boats.
 */
export function stackGroups(
  units: readonly PlacedUnit[],
  turnOf: (armyId: string) => ArmyTurnDetails | undefined,
  manager: boolean,
): StackGroup[] {
  const armies = [...new Map(units.map((p) => [p.army.id, p.army])).values()];
  return armies.flatMap((army) => {
    const turn = turnOf(army.id);
    if (!changeable(turn, manager)) return [];
    const free = units.filter(
      (p) =>
        p.army.id === army.id &&
        p.unit.type !== "Boat" &&
        !turn.orders.some((o) => o.unitId === p.unit.id),
    );
    if (free.length < 2) return [];
    const afloat = free.filter((p) => movesAs(p) === "Boat").length;
    return [{ army, units: free, mixed: afloat > 0 && afloat < free.length }];
  });
}

/** Whether the viewer can change the turn: open, and a Draft (or Submitted, for the Umpire). */
const changeable = (turn: ArmyTurnDetails | undefined, manager: boolean): turn is ArmyTurnDetails =>
  // The Umpire can change a Submitted turn too (decision 0011).
  !!turn?.open && (turn.status === "Draft" || (manager && turn.status === "Submitted"));

/** One army's units in a hex with an order this turn, whose orders can be taken back together. */
export interface OrderedGroup {
  army: ArmySummary;
  units: PlacedUnit[];
}

/**
 * Each army's units in the hex with an order in its open turn, while the viewer can change it,
 * two or more of them: taken back together (step 66g). Loose boats are left out, as they are of
 * a stack's moves.
 */
export function orderedGroups(
  units: readonly PlacedUnit[],
  turnOf: (armyId: string) => ArmyTurnDetails | undefined,
  manager: boolean,
): OrderedGroup[] {
  const armies = [...new Map(units.map((p) => [p.army.id, p.army])).values()];
  return armies.flatMap((army) => {
    const turn = turnOf(army.id);
    if (!changeable(turn, manager)) return [];
    const ordered = units.filter(
      (p) =>
        p.army.id === army.id &&
        p.unit.type !== "Boat" &&
        turn.orders.some((o) => o.unitId === p.unit.id),
    );
    return ordered.length < 2 ? [] : [{ army, units: ordered }];
  });
}

/** What the stack's reach needs of each unit: how it moves, its turn's budget, how far it got. */
export function stackMovers(
  units: readonly PlacedUnit[],
  rates: Rates,
  part: TurnPart | null | undefined,
  marches: Marches | undefined,
  forceMarch: boolean,
): StackMover[] {
  return units.map((placed) => {
    const type = movesAs(placed);
    return {
      type,
      budget:
        budgetFor(rates, type, placed.unit.nation, part, marches) +
        (forceMarch ? forceMarchBonus(rates, type) : 0),
      carried: placed.headingInto,
    };
  });
}

/** Whether every unit in the stack can force march this turn. */
export const stackCanForceMarch = (
  units: readonly PlacedUnit[],
  rates: Rates,
  part: TurnPart | null | undefined,
) => units.length > 0 && units.every((p) => canForceMarch(rates, movesAs(p), part));

/**
 * What moving costs the stack's units, in words: those it costs attrition, each with its own
 * (decision 0018); null when it costs none of them anything. On boats, moving is rest.
 */
export function stackMoveCost(
  units: readonly PlacedUnit[],
  marches: readonly UnitMarchResponse[] | undefined,
  forceMarch: boolean,
) {
  const costs = units.flatMap((placed) => {
    if (movesAs(placed) === "Boat") return [];
    const march = marches?.find((m) => m.unitId === placed.unit.id);
    const cost = march && attritionInWords(forceMarch ? march.forceMarchCosts : march.moveCosts);
    return cost ? [`${placed.unit.name} (${cost})`] : [];
  });
  if (costs.length === 0) return null;
  const listed =
    costs.length === 1 ? costs[0] : `${costs.slice(0, -1).join(", ")} and ${costs.at(-1) ?? ""}`;
  return `Moving costs attrition: ${listed}.`;
}
