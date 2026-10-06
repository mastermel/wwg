import { ActionIcon, Checkbox, Group, Table, Text, VisuallyHidden } from "@mantine/core";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { Fragment } from "react";
import classes from "@/features/units/OrderOfBattleTable.module.css";
import { unitCount } from "@/features/library/library-access";
import {
  orderOfBattle,
  unitsIn,
  type Brigade,
  type Division,
  type Placed,
} from "@/features/units/order-of-battle";
import { UnitStat } from "@/features/units/UnitStat";
import { unitTypeLabels } from "@/features/units/unit-types";

/** What a row shows: a library unit, or an army's copy of one. */
interface Row extends Placed {
  id: string;
  name: string;
  fightingFactor: number;
  points: number;
  /** A library unit's notes (decision 0025); an army's copy has none. */
  notes?: string | null;
}

/** Units to choose from, each with a checkbox by its name (Add units). */
export interface Selection<T> {
  /** The chosen units' ids, in the order they were chosen. */
  chosen: readonly string[];
  onChange: (chosen: string[]) => void;
  /** Why a unit can't be chosen ("In First Corps"), or undefined when it can. */
  unavailable?: (unit: T) => string | undefined;
}

interface OrderOfBattleTableProps<T extends Row> {
  units: T[];
  /** Shows each unit's Edit and Delete (or Remove) buttons. */
  editor?: boolean;
  online?: boolean;
  onEdit?: (unit: T) => void;
  onDelete?: (unit: T) => void;
  /** The delete button's word: an army's units are removed from it, not deleted. */
  deleteVerb?: "Delete" | "Remove";
  /** Ends with a row of the unit count and total points (the army's). */
  totals?: boolean;
  selection?: Selection<T>;
}

/** A row's first cell, stepped in by its level in the order of battle. */
const indent = (depth: number) =>
  depth > 0
    ? { paddingInlineStart: `calc(var(--mantine-spacing-lg) * ${String(depth + 1)})` }
    : undefined;

const points = (units: readonly Row[]) => units.reduce((sum, unit) => sum + unit.points, 0);

/**
 * Units in their order of battle (decisions 0024 and 0025), a library faction's or an army's: each
 * corps a band, its divisions under it (bands too), their brigades under them, each with its units
 * (its commander first); units in no corps or division come first. A heading names its commander
 * when no unit of its own is that commander (an army without its general, say). With no corps,
 * divisions or brigades at all, a plain list. With a `selection`, each unit can be ticked.
 */
export function OrderOfBattleTable<T extends Row>({
  units,
  editor = false,
  online = true,
  onEdit,
  onDelete,
  deleteVerb = "Delete",
  totals = false,
  selection,
}: OrderOfBattleTableProps<T>) {
  const oob = orderOfBattle(units);
  const columns = editor ? 5 : 4;

  const toggle = (unit: T, checked: boolean) => {
    if (!selection) return;
    const others = selection.chosen.filter((id) => id !== unit.id);
    selection.onChange(checked ? [...others, unit.id] : others);
  };

  /** A unit's name: with a checkbox when choosing, saying why if it can't be chosen. */
  const nameOf = (unit: T) => {
    if (!selection) return unit.name;
    const unavailable = selection.unavailable?.(unit);
    return (
      <Checkbox
        label={unit.name}
        description={unavailable}
        disabled={unavailable !== undefined}
        checked={selection.chosen.includes(unit.id)}
        onChange={(event) => {
          toggle(unit, event.currentTarget.checked);
        }}
      />
    );
  };

  const unitRow = (unit: T, depth: number) => (
    <Table.Tr key={unit.id}>
      <Table.Td style={indent(depth)}>
        {nameOf(unit)}
        <Text size="xs" c="dimmed" hiddenFrom="sm">
          {unitTypeLabels[unit.type]}
        </Text>
        {unit.notes && (
          <Text size="xs" c="dimmed">
            {unit.notes}
          </Text>
        )}
      </Table.Td>
      <Table.Td visibleFrom="sm">{unitTypeLabels[unit.type]}</Table.Td>
      <Table.Td ta="right">
        <UnitStat type={unit.type} value={unit.fightingFactor} />
      </Table.Td>
      <Table.Td ta="right">
        <UnitStat type={unit.type} value={unit.points} />
      </Table.Td>
      {editor && (
        <Table.Td>
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <ActionIcon
              variant="subtle"
              aria-label={`Edit ${unit.name}`}
              onClick={() => {
                onEdit?.(unit);
              }}
              disabled={!online}
            >
              <IconEdit size={16} aria-hidden />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label={`${deleteVerb} ${unit.name}`}
              onClick={() => {
                onDelete?.(unit);
              }}
              disabled={!online}
            >
              <IconTrash size={16} aria-hidden />
            </ActionIcon>
          </Group>
        </Table.Td>
      )}
    </Table.Tr>
  );

  const headingRow = (
    kind: "corps" | "division" | "brigade",
    name: string,
    commander: string | null,
    grouped: readonly Row[],
    depth: number,
  ) => (
    <Table.Tr key={`${kind} ${name}`} className={classes[kind]}>
      <Table.Th
        scope="rowgroup"
        colSpan={columns}
        fw={kind === "brigade" ? 600 : 700}
        style={indent(depth)}
      >
        <Group gap="xs" wrap="wrap">
          <span>{name}</span>
          {commander && (
            <Text span size="sm" fw={400}>
              {commander}
            </Text>
          )}
          <Text span size="xs" c="dimmed" fw={400}>
            {unitCount(grouped.length)} · {points(grouped)} points
          </Text>
        </Group>
      </Table.Th>
    </Table.Tr>
  );

  const brigadeRows = (brigade: Brigade<T>, depth: number) => (
    <Fragment key={brigade.name}>
      {headingRow("brigade", brigade.name, brigade.commander, brigade.units, depth)}
      {brigade.units.map((unit) => unitRow(unit, depth + 1))}
    </Fragment>
  );

  /** A division's heading, its own units, then its brigades, from `depth` down. */
  const divisionRows = (division: Division<T>, depth: number) => (
    <Fragment key={division.name}>
      {headingRow("division", division.name, division.commander, unitsIn(division), depth)}
      {division.units.map((unit) => unitRow(unit, depth + 1))}
      {division.brigades.map((brigade) => brigadeRows(brigade, depth + 1))}
    </Fragment>
  );

  // Units in no division sit under a heading of their own once there are divisions or corps to
  // tell them from.
  const looseDepth = oob.divisions.length > 0 || oob.corps.length > 0 ? 1 : 0;
  const loose = [...oob.units, ...oob.brigades.flatMap((brigade) => brigade.units)];

  return (
    <Table horizontalSpacing="lg" highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          {/* Phones show the type under the name instead, rather than scroll sideways. */}
          <Table.Th visibleFrom="sm">Type</Table.Th>
          <Table.Th ta="right">
            <abbr title="Fighting Factor">FF</abbr>
          </Table.Th>
          <Table.Th ta="right">Points</Table.Th>
          {editor && (
            <Table.Th>
              <VisuallyHidden>Actions</VisuallyHidden>
            </Table.Th>
          )}
        </Table.Tr>
      </Table.Thead>
      {loose.length > 0 && (
        <Table.Tbody>
          {looseDepth > 0 && headingRow("division", "Not in a division", null, loose, 0)}
          {oob.units.map((unit) => unitRow(unit, looseDepth))}
          {oob.brigades.map((brigade) => brigadeRows(brigade, looseDepth))}
        </Table.Tbody>
      )}
      {oob.divisions.map((division) => (
        <Table.Tbody key={division.name}>{divisionRows(division, 0)}</Table.Tbody>
      ))}
      {oob.corps.map((corps) => (
        <Table.Tbody key={`corps ${corps.name}`}>
          {headingRow("corps", corps.name, corps.commander, unitsIn(corps), 0)}
          {corps.units.map((unit) => unitRow(unit, 1))}
          {corps.brigades.map((brigade) => brigadeRows(brigade, 1))}
          {corps.divisions.map((division) => divisionRows(division, 1))}
        </Table.Tbody>
      ))}
      {totals && (
        <Table.Tfoot className={classes.totals}>
          <Table.Tr>
            <Table.Th scope="row">{unitCount(units.length)}</Table.Th>
            <Table.Td visibleFrom="sm" />
            <Table.Td />
            <Table.Td ta="right" fw={700}>
              {points(units)}
            </Table.Td>
            {editor && <Table.Td />}
          </Table.Tr>
        </Table.Tfoot>
      )}
    </Table>
  );
}
