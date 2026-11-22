import { useComputedColorScheme } from "@mantine/core";
import type { FeatureCollection, Polygon } from "geojson";
import { useMemo } from "react";
import { Layer, Marker, Source } from "react-map-gl/maplibre";
import { armyColors, armyColorVar } from "@/features/armies/identity/army-colors";
import type { Point } from "@/features/maps/geo";
import { mapPalettes } from "@/features/maps/map-style";
import { sharedLines } from "@/features/maps/ghost-lines";
import type { Hex, HexGrid } from "@/features/maps/hex-grid";
import { arrowheads, focusedLines } from "@/features/maps/move-focus";
import classes from "@/features/maps/OrderOverlay.module.css";
import { nameWithRank, type PlacedUnit } from "@/features/maps/stacks";
import { useStacks } from "@/features/maps/use-stacks";
import { UnitSymbol } from "@/features/units/UnitSymbol";

/** A unit's move this turn, not yet approved: from where it is along `line` to `to`. */
export interface PendingMove {
  placed: PlacedUnit;
  /** Where it's going: the hex, and where its ghost is drawn (its centre, or its east half). */
  toHex: Hex;
  to: Point;
  /** The hex centres it passes through, as [longitude, latitude], from where it is to `to`. */
  line: [number, number][];
}

interface OrderOverlayProps {
  moves: readonly PendingMove[];
  /**
   * The units whose moves stand out (decision 0041), drawn solid in their armies' colours with an
   * arrowhead, while the others fade; none, or an empty set, for all alike.
   */
  focus?: ReadonlySet<string>;
  /** For the arrowheads' size: the destination hexes' corners. */
  grid: Pick<HexGrid, "centre" | "corners">;
  /** The hexes the unit being moved can reach, each a ring of corners as [longitude, latitude]. */
  reachable?: readonly [number, number][][];
  /**
   * Tapping a ghost (step 75b), with the moves it shows: given, ghosts are buttons; missing (while
   * placing or moving), they let clicks through to the map.
   */
  onSelect?: (moves: PendingMove[]) => void;
}

/**
 * Moves not yet approved (DESIGN.md §3.13): a ghost of each unit where it's going, stacked with
 * a count where they'd overlap as units are (step 73), with a dashed line along its path (one for
 * units going together, the wider the more of them); and while
 * moving, the hexes within reach, shaded. The chosen hex's moves stand out (decision 0041), and a
 * ghost is a button choosing them (step 75b). Inside a CampaignMap. Otherwise drawn for sight
 * only: the turn panel lists the same orders for screen readers and keyboards.
 */
export function OrderOverlay({ moves, focus, grid, reachable = [], onSelect }: OrderOverlayProps) {
  const scheme = useComputedColorScheme("light");
  const { label: ink, halo } = mapPalettes[scheme];
  const focusing = focus !== undefined && focus.size > 0;
  const isFocused = (move: PendingMove) => focusing && focus.has(move.placed.unit.id);
  const focused = moves.filter(isFocused);
  const lines = sharedLines(moves.filter((move) => !isFocused(move)));
  const standing = focusedLines(focused, (color) => armyColors[color][scheme]);
  const heads = arrowheads(standing, grid);
  const ghosts = useMemo(
    () => moves.map(({ placed, toHex, to }) => ({ ...placed, hex: toHex, ...to })),
    [moves],
  );
  const stacks = useStacks(ghosts);
  const area: FeatureCollection<Polygon> = {
    type: "FeatureCollection",
    features: reachable.map((corners) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[...corners, corners[0] ?? [0, 0]]] },
    })),
  };

  return (
    <>
      <Source id="unit-range" type="geojson" data={area}>
        <Layer
          id="unit-range-fill"
          type="fill"
          paint={{ "fill-color": ink, "fill-opacity": 0.12 }}
        />
        <Layer
          id="unit-range-edge"
          type="line"
          paint={{ "line-color": ink, "line-width": 1, "line-opacity": 0.5 }}
        />
      </Source>
      <Source id="unit-moves" type="geojson" data={lines}>
        <Layer
          id="unit-moves"
          type="line"
          paint={{
            "line-color": ink,
            // 2 pixels for a unit, 3 for two, 4 for three or more.
            "line-width": ["min", 4, ["+", 1, ["get", "units"]]],
            "line-dasharray": [2, 1.5],
            // Faded behind the chosen hex's moves, while they stand out.
            "line-opacity": focusing ? 0.3 : 1,
          }}
        />
      </Source>
      {/* Mounted from the start, empty while nothing stands out: WebKit can miss layers added
          later. Above the others, with a halo so they show over the ground and the faded lines. */}
      <Source id="focused-moves" type="geojson" data={standing}>
        <Layer
          id="focused-moves-halo"
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": halo,
            "line-width": ["+", 3, ["min", 6, ["+", 3, ["get", "units"]]]],
          }}
        />
        <Layer
          id="focused-moves"
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": ["get", "color"],
            // 4 pixels for a unit, 5 for two, 6 for three or more.
            "line-width": ["min", 6, ["+", 3, ["get", "units"]]],
          }}
        />
      </Source>
      <Source id="focused-arrowheads" type="geojson" data={heads}>
        <Layer
          id="focused-arrowheads"
          type="fill"
          paint={{ "fill-color": ["get", "color"], "fill-outline-color": halo }}
        />
      </Source>
      {stacks.map((stack) => {
        const [top, ...under] = stack.units as [PlacedUnit, ...PlacedUnit[]];
        const next = under.at(0);
        const inFocus = focusing && stack.units.some((placed) => focus.has(placed.unit.id));
        const symbols = (
          <>
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
            <span className={classes.top} aria-hidden>
              <UnitSymbol
                type={top.unit.type}
                commanderInChief={top.unit.isCommanderInChief}
                color={armyColorVar(top.army.color)}
                width={30}
              />
            </span>
            {under.length > 0 && (
              <span className={classes.count} aria-hidden>
                {stack.units.length}
              </span>
            )}
          </>
        );
        const focusState = focusing ? (inFocus ? "in" : "out") : undefined;
        return (
          <Marker
            key={stack.key}
            longitude={stack.longitude}
            latitude={stack.latitude}
            anchor="center"
            style={onSelect ? undefined : { pointerEvents: "none" }}
            onClick={(event) => {
              // Not the map's click too, which would open the hex it's in.
              event.originalEvent.stopPropagation();
            }}
          >
            {onSelect ? (
              <button
                type="button"
                className={`${classes.ghost} ${classes.button}`}
                data-focus={focusState}
                aria-label={
                  under.length === 0
                    ? `Where ${nameWithRank(top)} is going`
                    : `Where ${String(stack.units.length)} units are going: ${stack.units.map(nameWithRank).join(", ")}`
                }
                onClick={() => {
                  const ids = new Set(stack.units.map((placed) => placed.unit.id));
                  onSelect(moves.filter((move) => ids.has(move.placed.unit.id)));
                }}
              >
                {symbols}
              </button>
            ) : (
              <span className={classes.ghost} data-focus={focusState} aria-hidden>
                {symbols}
              </span>
            )}
          </Marker>
        );
      })}
    </>
  );
}
