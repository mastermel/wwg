import { describe, expect, it } from "vitest";
import { isPickedOut, standsOut } from "@/features/maps/pick-out";
import type { PlacedUnit } from "@/features/maps/stacks";

/** Only what standing out reads of a placed unit: its id and its army's. */
const placed = (unitId: string, armyId: string) =>
  ({ unit: { id: unitId }, army: { id: armyId } }) as PlacedUnit;

describe("picking out on the map", () => {
  const guard = { name: "Old Guard", unitIds: new Set(["grenadiers", "chasseurs"]) };

  it("knows a formation picked out by its units, in any order", () => {
    expect(isPickedOut(guard, ["chasseurs", "grenadiers"])).toBe(true);
    expect(isPickedOut(guard, ["grenadiers"])).toBe(false);
    expect(isPickedOut(guard, ["grenadiers", "chasseurs", "lancers"])).toBe(false);
    expect(isPickedOut(null, ["grenadiers"])).toBe(false);
  });

  it("makes a picked-out formation's units stand out, before an army", () => {
    const test = standsOut(guard, "nord");

    expect(test?.(placed("grenadiers", "nord"))).toBe(true);
    expect(test?.(placed("lancers", "nord"))).toBe(false);
  });

  it("makes an army's units stand out when no formation is picked out", () => {
    const test = standsOut(null, "nord");

    expect(test?.(placed("lancers", "nord"))).toBe(true);
    expect(test?.(placed("hussars", "prussia"))).toBe(false);
  });

  it("makes nothing stand out when nothing is picked out", () => {
    expect(standsOut(null, null)).toBeNull();
  });
});
