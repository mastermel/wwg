import type { TurnPart, UnitMarchResponse, UnitType } from "@/api/generated/model";
import { classOf, type Rates } from "@/features/maps/movement";
import { fights } from "@/features/units/unit-types";
import { attritionInWords, forcedMarchTurn, roughLoss } from "@/features/maps/attrition";

/**
 * Forced marches (step 47, decision 0018), in the app: how much further a force march goes, when
 * a unit can make one, and a unit's march count and what moving costs, in words. The count itself
 * is the API's (`GET /api/armies/{id}/marches`).
 */

/**
 * The rates a force march goes by (the rules, §E.2: "1 hex per turn faster"): each land rate a hex
 * more, where the class can move at all. As the API's `MovementTable.ForceMarching`.
 */
export function forceMarching(rates: Rates): Rates {
  return (movementClass, ground) => {
    const rate = rates(movementClass, ground);
    return movementClass !== "Boat" && rate > 0 ? rate + 1 : rate;
  };
}

/**
 * Whether the unit can force march this turn: never a scout (decision 0028); by day, and a class
 * that moves over flat ground.
 */
export function canForceMarch(rates: Rates, type: UnitType, part: TurnPart | null | undefined) {
  return fights(type) && part !== "Night" && rates(classOf(type), "Flat") > 0;
}

/** A unit's march count as the open turn began, in words. */
export function describeMarch(march: UnitMarchResponse) {
  if (march.forcedMarchTurns > 0) {
    return `Force marching: ${String(march.forcedMarchTurns)} ${march.forcedMarchTurns === 1 ? "turn" : "turns"} to rest off (a Hold each).`;
  }
  if (march.movesInRow > 0) {
    return `Moved ${String(march.movesInRow)} ${march.movesInRow === 1 ? "turn" : "turns"} in a row: a third makes a forced march.`;
  }
  return "Rested.";
}

/**
 * What moving this turn costs it, in words, with roughly how many points when its FF and points
 * are given; null for nothing.
 */
export function moveCost(
  march: UnitMarchResponse | undefined,
  forceMarch: boolean,
  unit?: { fightingFactor: number; points: number },
) {
  if (!march) return null;
  const multiplier = forceMarch ? march.forceMarchCosts : march.moveCosts;
  const cost = attritionInWords(multiplier);
  if (!cost) return null;
  const loss = unit && roughLoss(unit, multiplier);
  return `Moving costs ${cost}${loss ? ` (${loss})` : ""}: ${forcedMarchTurn(march.forcedMarchTurns + 1)}.`;
}
