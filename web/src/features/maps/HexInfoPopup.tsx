import { Text } from "@mantine/core";
import { Popup } from "react-map-gl/maplibre";
import classes from "@/features/maps/HexInfoPopup.module.css";
import type { Point } from "@/features/maps/geo";

interface HexInfoPopupProps {
  at: Point;
  /** The hex's name (and its settlement's). */
  title: string;
  /** The units there, what was sighted there, or its ground (`hoverLines`). */
  lines: readonly string[];
  /** How far above the hex's centre, in pixels: clear of the markers there. */
  offset: number;
}

/**
 * A hex's label, at the hex, inside a CampaignMap, while the mouse is over it: its units, else
 * what was sighted there, else its ground. A click or tap opens the hex's drawer instead.
 */
export function HexInfoPopup({ at, title, lines, offset }: HexInfoPopupProps) {
  return (
    <Popup
      longitude={at.longitude}
      latitude={at.latitude}
      anchor="bottom"
      offset={offset}
      closeButton={false}
      closeOnClick={false}
      maxWidth="280px"
      className={classes.popup}
    >
      <div role="tooltip" aria-label={title}>
        <Text size="sm" fw={600}>
          {title}
        </Text>
        {lines.map((line) => (
          <Text key={line} size="xs">
            {line}
          </Text>
        ))}
      </div>
    </Popup>
  );
}
