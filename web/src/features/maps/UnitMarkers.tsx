import { IconSailboat } from "@tabler/icons-react";
import { Marker } from "react-map-gl/maplibre";
import { armyColorVar } from "@/features/armies/identity/army-colors";
import {
  describeUnit,
  nameWithRank,
  type PlacedUnit,
  type UnitStack,
} from "@/features/maps/stacks";
import classes from "@/features/maps/UnitMarkers.module.css";
import { useStacks } from "@/features/maps/use-stacks";
import { UnitSymbol } from "@/features/units/UnitSymbol";

interface UnitMarkersProps {
  units: readonly PlacedUnit[];
  onSelect: (stack: UnitStack) => void;
  /**
   * Which units stand out (an army or a formation picked out; `standsOut`): stacks without any of
   * them are faded. Null or missing: every unit alike.
   */
  highlight?: ((placed: PlacedUnit) => boolean) | null;
  /** Units out of supply (step 48d), marked as such, for those who see their supply. */
  outOfSupply?: ReadonlySet<string>;
  /** A mouse pointer coming onto a stack's marker, or leaving it (null; step 75c). */
  onHover?: (stack: UnitStack | null) => void;
  /** Units drawn where they're going, not where they are (no trails, step 75e). */
  arriving?: ReadonlySet<string>;
}

/**
 * The units on the map, as buttons: one per unit, or one per stack where they'd overlap, which
 * shows how many and opens the list to choose from (DESIGN.md §3.13). Restacked as the zoom
 * changes (`useStacks`). Inside a CampaignMap.
 */
export function UnitMarkers({
  units,
  onSelect,
  highlight,
  outOfSupply,
  onHover,
  arriving,
}: UnitMarkersProps) {
  const stacks = useStacks(units);

  return stacks.map((stack) => {
    const [top, ...under] = stack.units as [PlacedUnit, ...PlacedUnit[]];
    const next = under.at(0);
    const cutOff = stack.units.filter((u) => outOfSupply?.has(u.unit.id));
    // On boats (step 51): its boats aren't drawn, but go with it.
    const afloat = stack.units.filter((u) => (u.boats?.length ?? 0) > 0);
    const onTheirWay = stack.units.filter((u) => arriving?.has(u.unit.id));
    const label =
      (under.length === 0
        ? describeUnit(top)
        : `${String(stack.units.length)} units: ${stack.units.map(nameWithRank).join(", ")}`) +
      (cutOff.length === 0
        ? ""
        : under.length === 0
          ? ", out of supply"
          : `; out of supply: ${cutOff.map((u) => u.unit.name).join(", ")}`) +
      (afloat.length === 0
        ? ""
        : under.length === 0
          ? ", on boats"
          : `; on boats: ${afloat.map((u) => u.unit.name).join(", ")}`) +
      (onTheirWay.length === 0
        ? ""
        : under.length === 0
          ? ", on its way here"
          : `; on their way here: ${onTheirWay.map((u) => u.unit.name).join(", ")}`);
    return (
      <Marker
        key={stack.key}
        longitude={stack.longitude}
        latitude={stack.latitude}
        anchor="center"
        onClick={(event) => {
          event.originalEvent.stopPropagation();
        }}
      >
        <button
          type="button"
          className={classes.marker}
          data-faded={highlight ? !stack.units.some(highlight) : undefined}
          aria-label={label}
          onClick={() => {
            onSelect(stack);
          }}
          // A mouse's only: a tap would leave it behind, with nothing to take it away.
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") onHover?.(stack);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") onHover?.(null);
          }}
        >
          {next && (
            <span className={classes.under} aria-hidden>
              <UnitSymbol
                type={next.unit.type}
                commanderInChief={next.unit.isCommanderInChief}
                color={armyColorVar(next.army.color)}
                width={30}
              />
            </span>
          )}
          <span style={{ position: "relative", display: "block" }}>
            <UnitSymbol
              type={top.unit.type}
              commanderInChief={top.unit.isCommanderInChief}
              color={armyColorVar(top.army.color)}
              width={30}
            />
          </span>
          {cutOff.length > 0 && (
            <span className={classes.supply} aria-hidden>
              !
            </span>
          )}
          {afloat.length > 0 && (
            <span className={classes.boats} aria-hidden>
              <IconSailboat size={10} stroke={2.5} />
            </span>
          )}
          {under.length > 0 && (
            <span className={classes.count} aria-hidden>
              {stack.units.length}
            </span>
          )}
        </button>
      </Marker>
    );
  });
}
