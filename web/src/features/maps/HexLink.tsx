import { Anchor } from "@mantine/core";
import { useContext, type ReactNode } from "react";
import { hexName, type Hex } from "@/features/maps/hex-grid";
import { ShowHexContext } from "@/features/maps/show-hex";

interface HexLinkProps {
  hex: Hex;
  /** What it says: the hex's name ("Hex (3, −2)") unless given. */
  children?: ReactNode;
}

/**
 * A hex named beside the map (decision 0040): a link that opens its drawer and centres the map on
 * it. Away from the Map page it's only the name.
 */
export function HexLink({ hex, children }: HexLinkProps) {
  const show = useContext(ShowHexContext);
  const label = children ?? hexName(hex);
  if (!show) return label;
  return (
    <Anchor
      component="button"
      type="button"
      inherit
      // The text's own colour, underlined: the theme's link colour fails contrast on a warning.
      c="inherit"
      underline="always"
      title="Show it on the map"
      style={{ verticalAlign: "baseline" }}
      onClick={() => {
        show({ q: hex.q, r: hex.r });
      }}
    >
      {label}
    </Anchor>
  );
}
