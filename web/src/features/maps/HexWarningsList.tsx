import { Alert, List, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import {
  describeThreat,
  describeWarning,
  warningPlace,
  type DepotThreat,
  type HexWarning,
} from "@/features/maps/contact";
import type { TerrainIndex } from "@/features/maps/terrain";

interface HexWarningsListProps {
  warnings: readonly HexWarning[];
  /** Depots with the other side's units in their hex (step 48a). */
  threats?: readonly DepotThreat[];
  terrain: TerrainIndex;
  /** Whose positions they're from: the orders as given, or where the units ended up. */
  from: "orders" | "positions";
  /** Its heading and the list's name: a commander's warnings are their own side's concentration. */
  title?: string;
}

/**
 * Contact and concentration (step 46, decision 0017): each hex to warn of, in words. The Umpire
 * sees every side's; a commander, their own units' hexes over a limit. Warnings only: nothing is refused, and battles are fought at the table. The map outlines
 * the same hexes, for sight.
 */
export function HexWarningsList({
  warnings,
  threats = [],
  terrain,
  from,
  title = "Contact and concentration",
}: HexWarningsListProps) {
  if (warnings.length === 0 && threats.length === 0) return null;
  return (
    <Alert color="orange" icon={<IconAlertTriangle aria-hidden />} title={title}>
      <Text size="xs" mb="xs">
        {from === "orders"
          ? "Where the units will be, by the orders as given."
          : "Where the units ended up."}
      </Text>
      <List size="sm" spacing={6} aria-label={title}>
        {warnings.map((warning) => (
          <List.Item key={`${String(warning.hex.q)},${String(warning.hex.r)}`}>
            <Text size="sm" fw={600} span>
              {warningPlace(warning, terrain)}:
            </Text>{" "}
            {describeWarning(warning).join(" ")}
          </List.Item>
        ))}
        {threats.map((threat) => (
          <List.Item key={threat.depot.id}>{describeThreat(threat)}</List.Item>
        ))}
      </List>
    </Alert>
  );
}
