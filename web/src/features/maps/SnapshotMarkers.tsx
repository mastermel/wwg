import { Marker } from "react-map-gl/maplibre";
import type { ArmySummary, ReportResponse } from "@/api/generated/model";
import { armyColorVar } from "@/features/armies/identity/army-colors";
import { UnitSymbol } from "@/features/units/UnitSymbol";

/**
 * A received report's snapshot on the map, inside a CampaignMap (step 49d): the units where they
 * were when it was sent, faded as past positions are, each in its army's colour (an Umpire's report
 * can name several, decision 0035), or grey for an army no longer in the campaign. For sight only:
 * the report says so.
 */
export function SnapshotMarkers({
  report,
  armies,
}: {
  report: ReportResponse | undefined;
  armies: readonly ArmySummary[];
}) {
  const colors = new Map(armies.map((a) => [a.id, armyColorVar(a.color)]));
  return (
    <>
      {(report?.snapshot ?? []).map((unit, index) => (
        <Marker
          key={`${unit.name}-${String(index)}`}
          longitude={unit.longitude}
          latitude={unit.latitude}
          anchor="center"
          style={{ pointerEvents: "none", opacity: 0.55 }}
        >
          <span aria-hidden>
            <UnitSymbol
              type={unit.type}
              color={colors.get(unit.armyId) ?? "var(--mantine-color-silver-3)"}
              width={26}
            />
          </span>
        </Marker>
      ))}
    </>
  );
}
