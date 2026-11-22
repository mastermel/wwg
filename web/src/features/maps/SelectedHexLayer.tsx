import { useComputedColorScheme } from "@mantine/core";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { Layer, Source } from "react-map-gl/maplibre";
import type { Hex, HexGrid } from "@/features/maps/hex-grid";
import { mapPalettes } from "@/features/maps/map-style";

/**
 * The hex whose card is open, outlined in the label colour (9.5:1 or more against the map), and
 * where its units are going, dashed (decision 0041). Mounted from the start and hidden when
 * there's none: WebKit can miss layers added later.
 */
export function SelectedHexLayer({
  grid,
  hex,
  destinations = [],
}: {
  grid: HexGrid;
  hex: Hex | null;
  destinations?: readonly Hex[];
}) {
  const { label } = mapPalettes[useComputedColorScheme("light")];
  const outline = (of: Hex): Feature<Polygon> => {
    const corners = grid.corners(of);
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[...corners, corners[0] ?? [0, 0]]] },
    };
  };
  const data: FeatureCollection<Polygon> = {
    type: "FeatureCollection",
    features: hex ? [outline(hex)] : [],
  };
  const going: FeatureCollection<Polygon> = {
    type: "FeatureCollection",
    features: destinations.map(outline),
  };
  return (
    <>
      <Source id="selected-hex" type="geojson" data={data}>
        <Layer
          id="selected-hex"
          type="line"
          layout={{ visibility: hex ? "visible" : "none" }}
          paint={{ "line-color": label, "line-width": 2.5 }}
        />
      </Source>
      <Source id="selected-destinations" type="geojson" data={going}>
        <Layer
          id="selected-destinations"
          type="line"
          layout={{ visibility: destinations.length > 0 ? "visible" : "none" }}
          paint={{ "line-color": label, "line-width": 2.5, "line-dasharray": [2, 1] }}
        />
      </Source>
    </>
  );
}
