import { useEffect, useMemo, useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import { stackUnits, type PlacedUnit, type UnitStack } from "@/features/maps/stacks";

/** What stacking goes by: each unit, in order, where it's drawn, and whether it leads. */
const stackedBy = (units: readonly PlacedUnit[]) =>
  units
    .map(
      ({ unit, longitude, latitude }) =>
        `${unit.id}@${String(longitude)},${String(latitude)}${unit.isCommanderInChief ? "*" : ""}`,
    )
    .join(" ");

/**
 * The units' markers, stacked where they'd overlap (`stackUnits`). Restacked on zoom (the
 * distances in pixels change) and when where they're drawn changes, not on every new array of
 * the same units; panning moves every marker together. Inside a CampaignMap.
 */
export function useStacks(units: readonly PlacedUnit[]): UnitStack[] {
  const { current: map } = useMap();
  const [stacked, setStacked] = useState(units);
  const [stacks, setStacks] = useState<UnitStack[]>([]);
  // Adjusted while rendering (React's pattern for state from props), so a parent that makes a
  // new array each render doesn't restack each time.
  if (stacked !== units && stackedBy(stacked) !== stackedBy(units)) setStacked(units);

  useEffect(() => {
    if (!map) return;
    const restack = () => {
      setStacks(stackUnits(stacked, (lngLat) => map.project(lngLat)));
    };
    restack();
    map.on("zoomend", restack);
    return () => {
      map.off("zoomend", restack);
    };
  }, [map, stacked]);

  // The units as they are now (their names, points, boats), in the stacks made from where they were.
  return useMemo(() => {
    const now = new Map(units.map((placed) => [placed.unit.id, placed]));
    return stacks.flatMap((stack) => {
      // Those gone since are left out, until the restack their going brings.
      const members = stack.units.flatMap((placed) => now.get(placed.unit.id) ?? []);
      return members.length > 0 ? [{ ...stack, units: members }] : [];
    });
  }, [stacks, units]);
}
