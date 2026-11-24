import type {
  AttritionDueResponse,
  UnitMarchResponse,
  UnitSupplyResponse,
} from "@/api/generated/model";
import { graceTurns } from "@/features/maps/supply";

/**
 * Attrition (decisions 0018, 0019 and 0050) in words: the rules' scale, roughly what a multiple of
 * it costs a unit, why a unit owes it, and the warning its drawer gives. The figures themselves
 * are the API's (`ListAttritionDue`, `ListMarches`, `GetSupply`); this mirrors `Attrition.Scale`
 * only to say roughly what a move would cost before it's ordered.
 */

/** Attrition as a multiple of the rules' scale, in words; null for none. */
export function attritionInWords(multiplier: number) {
  if (multiplier <= 0) return null;
  if (multiplier === 1) return "normal attrition";
  if (multiplier === 2) return "double attrition";
  return `${String(multiplier)}× attrition`;
}

const ordinal = (n: number) =>
  `${String(n)}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/** "Its 2nd turn of forced march" for the turn that leaves it at this many. */
export const forcedMarchTurn = (turns: number) => `its ${ordinal(turns)} turn of forced march`;

/** The points two battalions' scale is for. */
const scalePoints = 50;

/** The rules' scale: 3 points for FF 1–2, 2 for 3–4, 1 for 5–6, ½ for 7 and above. */
export function attritionScale(fightingFactor: number) {
  if (fightingFactor <= 2) return 3;
  if (fightingFactor <= 4) return 2;
  if (fightingFactor <= 6) return 1;
  return 0.5;
}

/**
 * Roughly what a multiple of the scale costs the unit, in words ("about 3 points"); null for no
 * points to lose. Points are lost whole, the fraction carried to the next loss, so it's "about".
 */
export function roughLoss(unit: { fightingFactor: number; points: number }, multiplier: number) {
  if (multiplier <= 0 || unit.points <= 0) return null;
  const owed = (attritionScale(unit.fightingFactor) * multiplier * unit.points) / scalePoints;
  if (owed < 1) return "under a point";
  const rounded = Math.round(owed * 10) / 10;
  return `about ${String(rounded)} ${rounded === 1 ? "point" : "points"}`;
}

const turns = (n: number) => `${String(n)} ${n === 1 ? "turn" : "turns"}`;
const points = (n: number) => `${String(n)} ${n === 1 ? "point" : "points"}`;

/**
 * Why a unit owes attrition, in words: its forced march (doubled out of supply), and from its 7th
 * turn out of supply, that too (steps 47 and 48).
 */
export function whyItOwes(d: AttritionDueResponse) {
  const out = d.unsuppliedTurns > 0;
  return [
    d.forcedMarchMultiplier > 0
      ? `${forcedMarchTurn(d.forcedMarchTurns)}, ${attritionInWords(d.forcedMarchMultiplier) ?? ""}${out ? " (doubled: out of supply)" : ""}`
      : null,
    d.unsuppliedTurns > graceTurns
      ? `out of supply ${String(d.unsuppliedTurns)} turns, normal attrition`
      : null,
  ]
    .filter(Boolean)
    .join("; ");
}

/** A unit's attrition warning, for its drawer: nothing to say is null. */
export interface AttritionWarning {
  /** Whether its orders cost it attrition (red), or it's only at risk (orange). */
  owes: boolean;
  title: string;
  /** Where it stood as the open turn began; null for nothing worth saying. */
  now: string | null;
  /** What its orders as given do. */
  next: string;
  /** What follows. */
  consequences: string[];
}

interface AttritionState {
  /** Its forced marches as the open turn began (its commander's and the Umpire's). */
  march?: UnitMarchResponse;
  /** Its supply, now and by the orders as given. */
  supply?: UnitSupplyResponse;
  /** The attrition its orders as given cost it; missing when they cost none. */
  due?: AttritionDueResponse;
}

/**
 * A unit's attrition warning: where it stands as the turn began (force marching, out of supply),
 * what its orders as given cost and why, and what follows (Holds to rest off a forced march, only
 * defending while cut off). Null when it owes nothing and isn't at risk.
 */
export function attritionWarning({ march, supply, due }: AttritionState): AttritionWarning | null {
  const forcing = (march?.forcedMarchTurns ?? 0) > 0;
  const outNow = supply?.state === "Unsupplied" && supply.unsuppliedTurns > 0;
  const outNext = supply?.nextState === "Unsupplied";
  if (!due && !forcing && !outNow && !outNext) return null;

  const now = [
    forcing && march
      ? `force marching, with ${turns(march.forcedMarchTurns)} of it to rest off`
      : null,
    outNow ? `out of supply for ${turns(supply.unsuppliedTurns)}` : null,
  ].filter(Boolean);

  const consequences: string[] = [];
  let next: string;
  if (due) {
    const loss =
      due.loss > 0
        ? `it loses ${points(due.loss)} (${String(due.points)} → ${String(due.points - due.loss)})`
        : "it loses under a point now, carried over until it adds up to one";
    next = `This turn's orders cost it ${attritionInWords(due.multiplier) ?? "attrition"}: ${whyItOwes(due)}. As the next turn starts, ${loss}, once the Umpire confirms it.`;
  } else if (forcing) {
    next = "This turn's orders rest it: no attrition, and one turn of forced march worked off.";
  } else {
    next = "This turn's orders cost it no attrition.";
  }

  const restAfter = due ? due.forcedMarchTurns : Math.max((march?.forcedMarchTurns ?? 0) - 1, 0);
  if (restAfter > 0) {
    consequences.push(
      `It must Hold ${turns(restAfter)} to rest off its forced march; each move before then costs more (×2 each turn).`,
    );
  }
  if (outNext) {
    const turnsOut = supply.nextUnsuppliedTurns;
    consequences.push(
      turnsOut > graceTurns
        ? "Cut off: it loses points every turn it stays out of supply, may only defend, and a forced march costs it double."
        : `Out of supply after this turn (${String(turnsOut)} of ${String(graceTurns)} turns): from the ${String(graceTurns + 1)}th it loses points every turn, and a forced march costs it double.`,
    );
  }

  return {
    owes: due !== undefined,
    title: due ? "Attrition this turn" : "At risk of attrition",
    now: now.length > 0 ? `As this turn began: ${now.join("; ")}.` : null,
    next,
    consequences,
  };
}
