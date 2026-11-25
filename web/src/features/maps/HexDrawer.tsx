import { Button, Drawer, Group, List, NavLink, Stack, Table, Text, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconChevronLeft } from "@tabler/icons-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { ArmyBadge } from "@/features/armies/identity/ArmyBadge";
import { armyColorVar } from "@/features/armies/identity/army-colors";
import { hexKey, hexName, type Hex } from "@/features/maps/hex-grid";
import type { HexInfo } from "@/features/maps/hex-info";
import type { PlacedUnit } from "@/features/maps/stacks";
import { CommanderInChiefBadge } from "@/features/units/CommanderInChiefBadge";
import { UnitSymbol } from "@/features/units/UnitSymbol";
import { UnitStat } from "@/features/units/UnitStat";
import { unitTypeLabels } from "@/features/units/unit-types";
import { shareOfTheWay } from "@/features/maps/movement";
import { useListMarches } from "@/api/generated/endpoints/turns/turns";
import { describeMarch } from "@/features/maps/marches";
import type { AttritionDueResponse, UnitSupplyResponse } from "@/api/generated/model";
import { AttritionWarning } from "@/features/maps/AttritionWarning";
import { UnitPointsHistory } from "@/features/maps/UnitPointsHistory";
import { UnitScreening } from "@/features/maps/UnitScreening";
import type { HexConcentration } from "@/features/maps/contact";
import { ConcentrationSummary } from "@/features/maps/ConcentrationSummary";
import classes from "@/features/maps/HexDrawer.module.css";

interface HexDrawerProps {
  /** The hex chosen on the map, and what the viewer knows of its terrain; closed when null. */
  hex: { hex: Hex; info: HexInfo } | null;
  /** The units chosen with it: those in it, or a marker's stack (which can reach past it). */
  units: readonly PlacedUnit[];
  /** What was sighted there, in words (`sightingsIn`). */
  sightings: readonly string[];
  /**
   * Each side's counted points there against its limits, of the units the viewer sees, and whose
   * positions they're from in words; nothing when no unit that fights is there.
   */
  concentration?: { counted: HexConcentration; note: string } | null;
  /** The unit being shown, of several. */
  selected: PlacedUnit | null;
  /** Shows one of the units, or (null) the list of them again. */
  onSelect: (unit: PlacedUnit | null) => void;
  onClose: () => void;
  /** What the viewer can do with the unit (placing it, its orders). */
  actions?: (unit: PlacedUnit) => ReactNode;
  /** What the viewer can do with the hex's units together (step 66), under their list. */
  listActions?: ReactNode;
  /** Whether the viewer follows the unit's moves, and so its forced marches (step 47). */
  showsMarches?: (unit: PlacedUnit) => boolean;
  /** The unit's supply in words (step 48), for those who see it. */
  supplyOf?: (unit: PlacedUnit) => string | undefined;
  /**
   * What the unit's attrition warning is from (decision 0050), for its commander and the Umpire
   * in the open turn: its supply, and the attrition its orders cost (missing for none); undefined
   * for anyone else.
   */
  attritionOf?: (
    unit: PlacedUnit,
  ) => { supply?: UnitSupplyResponse; due?: AttritionDueResponse } | undefined;
  /**
   * The unit's screening (decision 0026), for its commander and the Umpire: whether they may
   * change it now; undefined for anyone else.
   */
  screeningOf?: (unit: PlacedUnit) => { canChange: boolean } | undefined;
  /**
   * Changed to move focus into the drawer (a unit chosen from a list); focus goes back where it
   * was once the drawer closes. A click on the map leaves focus where it is.
   */
  focusRequest?: number;
  /** The viewer's own markers in the hex, and adding one (step 80), last. */
  markers?: ReactNode;
}

/**
 * Everything the viewer knows of a hex, opened by choosing it or a unit in it on the map (step
 * 57): its units (one shown in full, several listed to choose from), their points against the
 * concentration limits, what was sighted there, and its terrain. From the left on wide screens (the turn panel is on the right), from the bottom on
 * phones (DESIGN.md §3.13). It doesn't hold the page: the map and the panels stay in use, and
 * choosing another hex changes what it shows.
 */
export function HexDrawer({
  hex,
  units,
  sightings,
  concentration,
  selected,
  onSelect,
  onClose,
  actions,
  listActions,
  showsMarches,
  supplyOf,
  attritionOf,
  screeningOf,
  focusRequest = 0,
  markers,
}: HexDrawerProps) {
  const phone = useMediaQuery("(max-width: 48em)");
  const shown = selected ?? (units.length === 1 ? units[0] : undefined);
  const opened = hex !== null;
  // Focus moves in only when asked, and goes back once closed if it's still in the drawer (or
  // lost with it), without scrolling the page back to where it was.
  const focus = useRef({
    handled: 0,
    dialog: null as HTMLElement | null,
    returnTo: null as HTMLElement | null,
  });
  const takeFocus = (dialog: HTMLElement) => {
    if (focus.current.handled === focusRequest) return;
    focus.current.handled = focusRequest;
    const active = document.activeElement;
    if (active instanceof HTMLElement && !dialog.contains(active)) focus.current.returnTo = active;
    focus.current.dialog = dialog;
    dialog.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (opened) return;
    const { dialog, returnTo } = focus.current;
    focus.current.returnTo = null;
    const active = document.activeElement;
    if (returnTo?.isConnected && (active === document.body || dialog?.contains(active))) {
      returnTo.focus({ preventScroll: true });
    }
  }, [opened]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position={phone ? "bottom" : "left"}
      size={phone ? "auto" : "sm"}
      title={hex?.info.title}
      closeButtonProps={{ "aria-label": "Close" }}
      withOverlay={false}
      closeOnClickOutside={false}
      lockScroll={false}
      trapFocus={false}
      classNames={{ inner: classes.inner, content: classes.content }}
    >
      {hex && (
        <FocusTaker request={focusRequest} onFocus={takeFocus}>
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
                attritionOf={attritionOf}
                screeningOf={screeningOf}
              />
            </Part>
          ) : (
            units.length > 0 && (
              <Part title={`${String(units.length)} units`}>
                <Stack component="ul" gap={0} p={0} m={0}>
                  {units.map((placed) => {
                    // Its name says what it shows (WCAG 2.5.3): the badge is spelt out after it.
                    const about = [
                      placed.unit.isCommanderInChief
                        ? "Commander in Chief"
                        : unitTypeLabels[placed.unit.type],
                      placed.army.name,
                      // A marker's stack, zoomed out, can take in the hexes around.
                      ...(hexKey(placed.hex) === hexKey(hex.hex) ? [] : [hexName(placed.hex)]),
                    ];
                    return (
                      <li key={placed.unit.id} style={{ listStyle: "none" }}>
                        <NavLink
                          component="button"
                          label={
                            placed.unit.isCommanderInChief ? (
                              <Group gap={6} wrap="nowrap">
                                {placed.unit.name} <CommanderInChiefBadge hidden />
                              </Group>
                            ) : (
                              <>{placed.unit.name} </>
                            )
                          }
                          description={about.join(" · ")}
                          aria-label={[placed.unit.name, ...about].join(", ")}
                          leftSection={
                            <UnitSymbol
                              type={placed.unit.type}
                              commanderInChief={placed.unit.isCommanderInChief}
                              color={armyColorVar(placed.army.color)}
                              width={30}
                            />
                          }
                          onClick={() => {
                            onSelect(placed);
                          }}
                        />
                      </li>
                    );
                  })}
                </Stack>
                {listActions}
              </Part>
            )
          )}
          {concentration && (
            <Part title="Concentration">
              <ConcentrationSummary {...concentration} />
            </Part>
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
          {markers && <Part title="My markers">{markers}</Part>}
        </FocusTaker>
      )}
    </Drawer>
  );
}

/**
 * The drawer's contents, which hand its dialog over to be focused once it's there: the drawer's
 * portal mounts after the drawer opens, so the drawer itself can't reach it at once.
 */
function FocusTaker({
  request,
  onFocus,
  children,
}: {
  request: number;
  onFocus: (dialog: HTMLElement) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // `onFocus` skips a request it has handled, so it can run after every render.
  useEffect(() => {
    const dialog = ref.current?.closest<HTMLElement>('[role="dialog"]');
    if (request > 0 && dialog) onFocus(dialog);
  }, [request, onFocus]);
  return (
    <Stack gap="lg" ref={ref}>
      {children}
    </Stack>
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
  "actions" | "showsMarches" | "supplyOf" | "attritionOf" | "screeningOf"
> & { shown: PlacedUnit };

/** A unit in full: what it is, its state, and what the viewer can do with it. */
function UnitDetails({
  shown,
  actions,
  showsMarches,
  supplyOf,
  attritionOf,
  screeningOf,
}: UnitDetailsProps) {
  const supply = supplyOf?.(shown);
  const attrition = attritionOf?.(shown);
  const screening = screeningOf?.(shown);
  return (
    <>
      <Group gap="sm" wrap="nowrap">
        <UnitSymbol
          type={shown.unit.type}
          commanderInChief={shown.unit.isCommanderInChief}
          color={armyColorVar(shown.army.color)}
          width={40}
        />
        <Text fw={500}>
          {shown.unit.isCommanderInChief ? "Commander in Chief" : unitTypeLabels[shown.unit.type]}
        </Text>
      </Group>
      {attrition && (
        <AttritionWarning
          armyId={shown.army.id}
          unitId={shown.unit.id}
          supply={attrition.supply}
          due={attrition.due}
        />
      )}
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
