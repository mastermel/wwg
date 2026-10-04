import { Button, Drawer, Group, List, NavLink, Stack, Table, Text, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconChevronLeft } from "@tabler/icons-react";
import { useId, type ReactNode } from "react";
import { ArmyBadge } from "@/features/armies/identity/ArmyBadge";
import { armyColorVar } from "@/features/armies/identity/army-colors";
import { hexKey, hexName, type Hex } from "@/features/maps/hex-grid";
import type { HexInfo } from "@/features/maps/hex-info";
import { describeUnit, type PlacedUnit } from "@/features/maps/stacks";
import { UnitSymbol } from "@/features/units/UnitSymbol";
import { UnitStat } from "@/features/units/UnitStat";
import { unitTypeLabels } from "@/features/units/unit-types";
import { shareOfTheWay } from "@/features/maps/movement";
import { useListMarches } from "@/api/generated/endpoints/turns/turns";
import { describeMarch } from "@/features/maps/marches";
import { UnitPointsHistory } from "@/features/maps/UnitPointsHistory";
import { UnitScreening } from "@/features/maps/UnitScreening";

interface HexDrawerProps {
  /** The hex chosen on the map, and what the viewer knows of its terrain; closed when null. */
  hex: { hex: Hex; info: HexInfo } | null;
  /** The units chosen with it: those in it, or a marker's stack (which can reach past it). */
  units: readonly PlacedUnit[];
  /** What was sighted there, in words (`sightingsIn`). */
  sightings: readonly string[];
  /** The unit being shown, of several. */
  selected: PlacedUnit | null;
  /** Shows one of the units, or (null) the list of them again. */
  onSelect: (unit: PlacedUnit | null) => void;
  onClose: () => void;
  /** What the viewer can do with the unit (placing it, its orders). */
  actions?: (unit: PlacedUnit) => ReactNode;
  /** Whether the viewer follows the unit's moves, and so its forced marches (step 47). */
  showsMarches?: (unit: PlacedUnit) => boolean;
  /** The unit's supply in words (step 48), for those who see it. */
  supplyOf?: (unit: PlacedUnit) => string | undefined;
  /**
   * The unit's screening (decision 0026), for its commander and the Umpire: whether they may
   * change it now; undefined for anyone else.
   */
  screeningOf?: (unit: PlacedUnit) => { canChange: boolean } | undefined;
}

/**
 * Everything the viewer knows of a hex, opened by choosing it or a unit in it on the map (step
 * 57): its units (one shown in full, several listed to choose from), what was sighted there, and
 * its terrain. From the side on wide screens, from the bottom on phones (DESIGN.md §3.13).
 */
export function HexDrawer({
  hex,
  units,
  sightings,
  selected,
  onSelect,
  onClose,
  actions,
  showsMarches,
  supplyOf,
  screeningOf,
}: HexDrawerProps) {
  const phone = useMediaQuery("(max-width: 48em)");
  const shown = selected ?? (units.length === 1 ? units[0] : undefined);

  return (
    <Drawer
      opened={hex !== null}
      onClose={onClose}
      position={phone ? "bottom" : "right"}
      size={phone ? "auto" : "sm"}
      title={hex?.info.title}
      closeButtonProps={{ "aria-label": "Close" }}
    >
      {hex && (
        <Stack gap="lg">
          {shown ? (
            <Part title={shown.unit.name}>
              {units.length > 1 && (
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconChevronLeft size={16} aria-hidden />}
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => {
                    onSelect(null);
                  }}
                >
                  All {units.length} units here
                </Button>
              )}
              <UnitDetails
                shown={shown}
                actions={actions}
                showsMarches={showsMarches}
                supplyOf={supplyOf}
                screeningOf={screeningOf}
              />
            </Part>
          ) : (
            units.length > 0 && (
              <Part title={`${String(units.length)} units`}>
                <Stack component="ul" gap={0} p={0} m={0}>
                  {units.map((placed) => (
                    <li key={placed.unit.id} style={{ listStyle: "none" }}>
                      <NavLink
                        component="button"
                        label={placed.unit.name}
                        description={[
                          unitTypeLabels[placed.unit.type],
                          placed.army.name,
                          // A marker's stack, zoomed out, can take in the hexes around.
                          ...(hexKey(placed.hex) === hexKey(hex.hex) ? [] : [hexName(placed.hex)]),
                        ].join(" · ")}
                        aria-label={describeUnit(placed)}
                        leftSection={
                          <UnitSymbol
                            type={placed.unit.type}
                            color={armyColorVar(placed.army.color)}
                            width={30}
                          />
                        }
                        onClick={() => {
                          onSelect(placed);
                        }}
                      />
                    </li>
                  ))}
                </Stack>
              </Part>
            )
          )}
          {sightings.length > 0 && (
            <Part title="Sightings">
              <List size="sm" spacing={2}>
                {sightings.map((line) => (
                  <List.Item key={line}>{line}</List.Item>
                ))}
              </List>
            </Part>
          )}
          <Part title="Terrain">
            <List size="sm" spacing={2} listStyleType="none" p={0}>
              {hex.info.lines.map((line) => (
                <List.Item key={line}>{line}</List.Item>
              ))}
            </List>
          </Part>
        </Stack>
      )}
    </Drawer>
  );
}

/** One part of the drawer, under its own heading. */
function Part({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <Stack component="section" gap="sm" aria-labelledby={id}>
      <Title order={3} size="h5" id={id}>
        {title}
      </Title>
      {children}
    </Stack>
  );
}

type UnitDetailsProps = Pick<
  HexDrawerProps,
  "actions" | "showsMarches" | "supplyOf" | "screeningOf"
> & { shown: PlacedUnit };

/** A unit in full: what it is, its state, and what the viewer can do with it. */
function UnitDetails({ shown, actions, showsMarches, supplyOf, screeningOf }: UnitDetailsProps) {
  const supply = supplyOf?.(shown);
  const screening = screeningOf?.(shown);
  return (
    <>
      <Group gap="sm" wrap="nowrap">
        <UnitSymbol type={shown.unit.type} color={armyColorVar(shown.army.color)} width={40} />
        <Text fw={500}>{unitTypeLabels[shown.unit.type]}</Text>
      </Group>
      <Table variant="vertical" layout="fixed" withTableBorder>
        <Table.Tbody>
          <Table.Tr>
            <Table.Th w={100}>Army</Table.Th>
            <Table.Td>
              <ArmyBadge army={shown.army} />
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>FF</Table.Th>
            <Table.Td>
              <UnitStat type={shown.unit.type} value={shown.unit.fightingFactor} />
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>Points</Table.Th>
            <Table.Td>
              <UnitStat type={shown.unit.type} value={shown.unit.points} />
            </Table.Td>
          </Table.Tr>
          {shown.headingInto && (
            <Table.Tr>
              <Table.Th>Moving</Table.Th>
              <Table.Td>
                {shareOfTheWay(shown.headingInto.progress).replace(/^./, (c) => c.toUpperCase())} of
                the way into the next hex; it goes on there next turn.
              </Table.Td>
            </Table.Tr>
          )}
          {showsMarches?.(shown) && <MarchRow armyId={shown.army.id} unitId={shown.unit.id} />}
          {supply && (
            <Table.Tr>
              <Table.Th>Supply</Table.Th>
              <Table.Td>{supply}</Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
      {screening && (
        <UnitScreening
          unitId={shown.unit.id}
          name={shown.unit.name}
          canChange={screening.canChange}
        />
      )}
      <UnitPointsHistory unitId={shown.unit.id} />
      {actions?.(shown)}
    </>
  );
}

/** The unit's forced marches as the open turn began, for its commander and the Umpire. */
function MarchRow({ armyId, unitId }: { armyId: string; unitId: string }) {
  const marches = useListMarches(armyId, { query: { meta: { persist: false } } });
  const march = marches.data?.find((m) => m.unitId === unitId);
  if (!march) return null;
  return (
    <Table.Tr>
      <Table.Th>Marches</Table.Th>
      <Table.Td>{describeMarch(march)}</Table.Td>
    </Table.Tr>
  );
}
