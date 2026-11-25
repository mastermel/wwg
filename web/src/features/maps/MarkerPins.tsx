import { IconMapPinFilled } from "@tabler/icons-react";
import { Marker } from "react-map-gl/maplibre";
import type { MarkerResponse } from "@/api/generated/model";
import classes from "@/features/maps/MarkerPins.module.css";

/**
 * The viewer's own markers (step 80, decision 0054), on the map inside a CampaignMap: a pin with
 * the title, up and to the right of the hex's centre, out from under its units. For sight only:
 * a click goes through to the hex, whose drawer lists them.
 */
export function MarkerPins({ markers }: { markers: readonly MarkerResponse[] }) {
  return (
    <>
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          longitude={marker.longitude}
          latitude={marker.latitude}
          anchor="bottom-left"
          offset={[6, -10]}
          style={{ pointerEvents: "none" }}
        >
          <span className={classes.pin} aria-hidden>
            <IconMapPinFilled size={14} />
            <span className={classes.title}>{marker.title}</span>
          </span>
        </Marker>
      ))}
    </>
  );
}
