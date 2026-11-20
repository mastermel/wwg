import type { ArmySummary, CourierResponse } from "@/api/generated/model";
import { hexName } from "@/features/maps/hex-grid";

const armyName = (armies: readonly ArmySummary[], id: string) =>
  armies.find((a) => a.id === id)?.name ?? "An army";

const plural = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`;

/** "a", "a and b", "a, b and c". */
const listed = (parts: readonly string[]) =>
  parts.length < 2
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1) ?? ""}`;

/** Who sent a courier and to whom (decision 0033): each army, with its Commander in Chief. */
export function courierRoute(courier: CourierResponse, armies: readonly ArmySummary[]): string {
  const end = (armyId: string, chief: string | null | undefined) =>
    chief ? `${armyName(armies, armyId)} (${chief})` : armyName(armies, armyId);
  return `${end(courier.fromArmyId, courier.fromCommanderInChief)} to ${end(courier.toArmyId, courier.toCommanderInChief)}`;
}

/** Where a courier on its way is, and how its ride goes: arriving, turns to ride, or waiting. */
export function courierProgress(courier: CourierResponse, armies: readonly ArmySummary[]): string {
  const where = hexName(courier);
  if (courier.waiting === "NoCommanderInChief") {
    return `${where}, waiting: ${armyName(armies, courier.toArmyId)} has no Commander in Chief on the map`;
  }
  if (courier.waiting === "NoWay")
    return `${where}, waiting: no way reaches their Commander in Chief`;
  if (courier.arrivesNext) return `${where}, arriving next turn`;
  if (courier.turnsToRide != null) {
    const turns = Math.max(1, Math.ceil(courier.turnsToRide));
    return `${where}, about ${plural(turns, "turn", "turns")} to ride`;
  }
  return where;
}

/** What a courier's report carries. */
export function courierCargo(courier: CourierResponse): string {
  const parts = [
    ...(courier.includesSnapshot ? ["their units"] : []),
    ...(courier.sightingCount > 0 ? [plural(courier.sightingCount, "sighting", "sightings")] : []),
    ...(courier.note ? ["a message"] : []),
  ];
  return parts.length === 0 ? "Carries nothing." : `Carries ${listed(parts)}.`;
}

/** When a courier was sent, and how it ended if it has: arrived, or cancelled and by whom. */
export function courierOutcome(courier: CourierResponse): string {
  const sent = `Sent turn ${String(courier.sentTurn)}`;
  if (courier.status === "Arrived") return `${sent}, arrived turn ${String(courier.arrivedTurn)}.`;
  if (courier.status === "Stopped") {
    const by = courier.stoppedBy ? ` by ${courier.stoppedBy}` : "";
    return `${sent}, cancelled turn ${String(courier.stoppedTurn)}${by}.`;
  }
  return `${sent}.`;
}
