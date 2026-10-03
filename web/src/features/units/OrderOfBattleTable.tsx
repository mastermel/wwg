import { ActionIcon, Group, Table, Text, VisuallyHidden } from "@mantine/core";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { Fragment } from "react";
import classes from "@/features/units/OrderOfBattleTable.module.css";
import { unitCount } from "@/features/library/library-access";
import {
  orderOfBattle,
  unitsIn,
  type Brigade,
  type Placed,
} from "@/features/units/order-of-battle";
import { unitTypeLabels } from "@/features/units/unit-types";

/** What a row shows: a library unit, or an army's copy of one. */
interface Row extends Placed {
  id: string;
  name: string;
  fightingFactor: number;
  points: number;
}

interface OrderOfBattleTableProps<T extends Row> {
  units: T[];
  /** Shows each unit's Edit and Delete (or Remove) buttons. */
  editor: boolean;
  online: boolean;
  onEdit: (unit: T) => void;
  onDelete: (unit: T) => void;
  /** The delete button's word: an army's units are removed from it, not deleted. */
  deleteVerb?: "Delete" | "Remove";
  /** Ends with a row of the unit count and total points (the army's). */
  totals?: boolean;
}

/** A row's first cell, stepped in by its level in the order of battle. */
const indent = (depth: number) =>
  depth > 0
    ? { paddingInlineStart: `calc(var(--mantine-spacing-lg) * ${String(depth + 1)})` }
    : undefined;

const points = (units: readonly Row[]) => units.reduce((sum, unit) => sum + unit.points, 0);

/**
 * Units in their order of battle (decision 0024), a library faction's or an army's: each division
 * a band, its brigades under it, each with its units; units in no division come first. With no
 * divisions or brigades at all, a plain list.
 */
export function OrderOfBattleTable<T extends Row>({
  units,
  editor,
  online,
  onEdit,
  onDelete,
  deleteVerb = "Delete",
  totals = false,
}: OrderOfBattleTableProps<T>) {
  const oob = orderOfBattle(units);
  const columns = editor ? 5 : 4;

  const unitRow = (unit: T, depth: number) => (
    <Table.Tr key={unit.id}>
      <Table.Td style={indent(depth)}>
        {unit.name}
        <Text size="xs" c="dimmed" hiddenFrom="sm">
          {unitTypeLabels[unit.type]}
        </Text>
      </Table.Td>
      <Table.Td visibleFrom="sm">{unitTypeLabels[unit.type]}</Table.Td>
      <Table.Td ta="right">{unit.fightingFactor}</Table.Td>
      <Table.Td ta="right">{unit.points}</Table.Td>
      {editor && (
        <Table.Td>
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <ActionIcon
              variant="subtle"
              aria-label={`Edit ${unit.name}`}
              onClick={() => {
                onEdit(unit);
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
                onDelete(unit);
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
    kind: "division" | "brigade",
    name: string,
    grouped: readonly Row[],
    depth: number,
  ) => (
    <Table.Tr key={`${kind} ${name}`} className={classes[kind]}>
      <Table.Th
        scope="rowgroup"
        colSpan={columns}
        fw={kind === "division" ? 700 : 600}
        style={indent(depth)}
      >
        <Group gap="xs" wrap="wrap">
          <span>{name}</span>
          <Text span size="xs" c="dimmed" fw={400}>
            {unitCount(grouped.length)} · {points(grouped)} points
          </Text>
        </Group>
      </Table.Th>
    </Table.Tr>
  );

  const brigadeRows = (brigade: Brigade<T>, depth: number) => (
    <Fragment key={brigade.name}>
      {headingRow("brigade", brigade.name, brigade.units, depth)}
      {brigade.units.map((unit) => unitRow(unit, depth + 1))}
    </Fragment>
  );

  // Units in no division sit under a heading of their own once there are divisions to tell
  // them from.
  const looseDepth = oob.divisions.length > 0 ? 1 : 0;
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
          {looseDepth > 0 && headingRow("division", "Not in a division", loose, 0)}
          {oob.units.map((unit) => unitRow(unit, looseDepth))}
          {oob.brigades.map((brigade) => brigadeRows(brigade, looseDepth))}
        </Table.Tbody>
      )}
      {oob.divisions.map((division) => (
        <Table.Tbody key={division.name}>
          {headingRow("division", division.name, unitsIn(division), 0)}
          {division.units.map((unit) => unitRow(unit, 1))}
          {division.brigades.map((brigade) => brigadeRows(brigade, 1))}
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
