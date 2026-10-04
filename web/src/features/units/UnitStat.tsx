import { VisuallyHidden } from "@mantine/core";
import type { UnitType } from "@/api/generated/model";
import { fights } from "@/features/units/unit-types";

/** A unit's FF or points: "–" for a scout, which doesn't fight (decision 0028). */
export function UnitStat({ type, value }: { type: UnitType; value: number }) {
  if (fights(type)) return value;
  return (
    <>
      <span aria-hidden>–</span>
      <VisuallyHidden>None</VisuallyHidden>
    </>
  );
}
