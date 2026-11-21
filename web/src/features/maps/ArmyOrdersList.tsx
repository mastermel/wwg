import { ActionIcon, Button, Group, Text } from "@mantine/core";
import { IconArrowBackUp } from "@tabler/icons-react";
import type { ArmySummary, ArmyTurnDetails, UnitNoteDto } from "@/api/generated/model";
import { armyColorVar } from "@/features/armies/identity/army-colors";
import { FormationList } from "@/features/maps/FormationList";
import { describeOrder } from "@/features/maps/orders";
import { formationActions, type PickedOut } from "@/features/maps/pick-out";
import type { PlacedUnit } from "@/features/maps/stacks";
import type { useOrders } from "@/features/maps/use-orders";
import { CommanderInChiefBadge } from "@/features/units/CommanderInChiefBadge";
import { UnitSymbol } from "@/features/units/UnitSymbol";
import { useOnline } from "@/lib/use-online";

/** An army's unit, and where it is (undefined: the Umpire hasn't placed it yet). */
export interface CommandedUnit {
  unit: PlacedUnit["unit"];
  army: PlacedUnit["army"];
  placed: PlacedUnit | undefined;
}

interface ArmyOrdersListProps {
  army: ArmySummary;
  turn: ArmyTurnDetails;
  units: readonly CommandedUnit[];
  orders: ReturnType<typeof useOrders>;
  /** Whether the viewer can change the turn's orders now (a commander's Draft; the Umpire's Draft or Submitted). */
  editable: boolean;
  /** The turn is a Night: its moves are night moves. */
  night: boolean;
  /** Opens a unit on the map (its drawer, with Move and Hold). */
  onChoose: (placed: PlacedUnit) => void;
  /** The formation picked out on the map, if one is (step 64). */
  pickedOut: PickedOut | null;
  onPickOut: (formation: PickedOut | null) => void;
  /** The Umpire's notes on units, when the turn was sent back or reopened. */
  notes?: readonly UnitNoteDto[];
}

/**
 * An army's units in its order of battle, each with its order this turn (and undo), and each
 * formation's menu: pick it out on the map, and hold the rest (step 64). The commander's turn
 * panel and the Umpire's (step 64d) both list them.
 */
export function ArmyOrdersList({
  army,
  turn,
  units,
  orders,
  editable,
  night,
  onChoose,
  pickedOut,
  onPickOut,
  notes,
}: ArmyOrdersListProps) {
  const online = useOnline();
  const orderOf = (unitId: string) => turn.orders.find((o) => o.unitId === unitId);

  return (
    <FormationList
      items={units}
      unitOf={(u) => u.unit}
      label={`${army.name}'s orders`}
      progress={(group) => {
        // Units not on the map yet can't have orders, and don't hold up Submit.
        const onMap = group.filter((u) => u.placed);
        const ordered = onMap.filter((u) => orderOf(u.unit.id)).length;
        return onMap.length === 0
          ? "None on the map yet"
          : `${String(ordered)} of ${String(onMap.length)} ordered`;
      }}
      // While giving orders, a group with every unit on the map ordered starts folded; once
      // it can't change, every group is open, to read the orders.
      complete={(group) =>
        editable &&
        group.every((u) => u.placed) &&
        group.every((u) => orderOf(u.unit.id) !== undefined)
      }
      {...formationActions({
        picked: pickedOut,
        onPickOut,
        unitIdOf: (u: CommandedUnit) => u.unit.id,
        // While giving orders: the units on the map in it without one.
        holdTheRest: (name, group) => {
          const rest = group.filter((u) => u.placed && !orderOf(u.unit.id));
          return editable && rest.length > 0
            ? {
                count: rest.length,
                disabled: !online || orders.busy,
                onHold: () =>
                  void orders.holdTheRest(
                    army.id,
                    turn.id,
                    rest.map((u) => u.unit.id),
                    name,
                  ),
              }
            : undefined;
        },
      })}
      renderItem={({ unit, placed }) => {
        const order = orderOf(unit.id);
        const note = notes?.find((n) => n.unitId === unit.id);
        return (
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Group gap="xs" wrap="nowrap" miw={0}>
              <UnitSymbol
                type={unit.type}
                commanderInChief={unit.isCommanderInChief}
                color={armyColorVar(army.color)}
                width={26}
              />
              <div style={{ minWidth: 0 }}>
                <Group gap={6} wrap="nowrap">
                  {placed && editable ? (
                    <Button
                      variant="transparent"
                      size="compact-sm"
                      px={0}
                      onClick={() => {
                        onChoose(placed);
                      }}
                    >
                      {unit.name}
                    </Button>
                  ) : (
                    <Text size="sm" truncate>
                      {unit.name}
                    </Text>
                  )}
                  {unit.isCommanderInChief && <CommanderInChiefBadge />}
                </Group>
                <Text size="xs" c="dimmed">
                  {describeOrder(order, placed, night)}
                  {order?.byUmpire && " · set by the Umpire"}
                </Text>
                {note && (
                  <Text size="xs" fw={500}>
                    Umpire: {note.text}
                  </Text>
                )}
              </div>
            </Group>
            {editable && order && (
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Undo ${unit.name}'s order`}
                disabled={!online || orders.busy}
                onClick={() => void orders.undo(army.id, turn.id, unit)}
              >
                <IconArrowBackUp size={18} aria-hidden />
              </ActionIcon>
            )}
          </Group>
        );
      }}
    />
  );
}
