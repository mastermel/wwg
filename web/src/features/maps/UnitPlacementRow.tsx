import { Button, Group, Text } from "@mantine/core";
import { IconMapPin } from "@tabler/icons-react";
import { armyColorVar } from "@/features/armies/identity/army-colors";
import type { PlacedUnit } from "@/features/maps/stacks";
import { UnitSymbol } from "@/features/units/UnitSymbol";
import { useOnline } from "@/lib/use-online";

interface UnitPlacementRowProps {
  unit: PlacedUnit["unit"];
  army: PlacedUnit["army"];
  placed: boolean;
  /** The unit being placed, if one is. */
  placing: string | null;
  onPlace: (unitId: string) => void;
}

/** A unit the Umpire places (or, while setting up, moves): its symbol, name and Place button. */
export function UnitPlacementRow({ unit, army, placed, placing, onPlace }: UnitPlacementRowProps) {
  const online = useOnline();
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Group gap="xs" wrap="nowrap" miw={0}>
        <UnitSymbol type={unit.type} color={armyColorVar(army.color)} width={26} />
        <div style={{ minWidth: 0 }}>
          <Text size="sm" truncate>
            {unit.name}
          </Text>
          <Text size="xs" c="dimmed">
            {placed ? "On the map" : "Not placed yet"}
          </Text>
        </div>
      </Group>
      <Button
        size="compact-sm"
        variant={placed ? "subtle" : "light"}
        leftSection={<IconMapPin size={14} aria-hidden />}
        disabled={!online || placing === unit.id}
        aria-label={`${placed ? "Move" : "Place"} ${unit.name}`}
        onClick={() => {
          onPlace(unit.id);
        }}
      >
        {placed ? "Move" : "Place"}
      </Button>
    </Group>
  );
}
