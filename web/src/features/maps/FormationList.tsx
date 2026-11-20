import { Text, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { useId, useState, type ReactNode } from "react";
import classes from "@/features/maps/FormationList.module.css";
import { unitCount } from "@/features/library/library-access";
import {
  orderOfBattle,
  unitsIn,
  type Brigade,
  type Corps,
  type Division,
  type Placed,
} from "@/features/units/order-of-battle";

/** A row's entry in the order of battle: its unit's grouping, and the row itself. */
type Entry<T> = Placed & { id: string; item: T };

interface FormationListProps<T> {
  /** The rows: a unit each, with whatever the panel shows of it. */
  items: readonly T[];
  /** The unit a row is for, which places it in the order of battle. */
  unitOf: (item: T) => Placed & { id: string };
  /** The whole list's name ("First Army's orders"). */
  label: string;
  /** What a heading says of its group's rows ("3 of 5 placed"); by default, how many units. */
  progress?: (items: T[]) => string;
  /**
   * Whether there's nothing left to do in a group (every unit placed, say): such a group starts
   * folded (step 63). By default, none is.
   */
  complete?: (items: T[]) => boolean;
  renderItem: (item: T) => ReactNode;
}

type Kind = "corps" | "division" | "brigade";

/**
 * An army's units beside the map in its order of battle (step 62), as the army page's table has
 * them: corps, then divisions, then brigades, a group's own units (its commander first) before
 * its brigades and divisions; units in no corps or division first, under **Not in a division**
 * once there's one to tell them from. Each heading names the group, its commander (when no unit
 * of its own is that commander, decision 0030) and its `progress`, and folds its group away
 * (step 63): open to start with, unless it's `complete`, and opened again if it stops being so (an
 * order taken back), so nothing left to do is hidden. With no corps, divisions or brigades at
 * all, a plain list.
 */
export function FormationList<T>({
  items,
  unitOf,
  label,
  progress = (rows) => unitCount(rows.length),
  complete = () => false,
  renderItem,
}: FormationListProps<T>) {
  const oob = orderOfBattle<Entry<T>>(items.map((item) => ({ ...unitOf(item), item })));

  const rows = (entries: readonly Entry<T>[]) =>
    entries.map((entry) => <li key={entry.id}>{renderItem(entry.item)}</li>);

  const group = (
    kind: Kind,
    name: string,
    commander: string | null,
    all: readonly Entry<T>[],
    children: ReactNode,
  ) => {
    const groupItems = all.map((entry) => entry.item);
    return (
      <FormationGroup
        key={`${kind} ${name}`}
        kind={kind}
        name={name}
        commander={commander}
        progress={progress(groupItems)}
        complete={complete(groupItems)}
      >
        {children}
      </FormationGroup>
    );
  };

  const brigade = (b: Brigade<Entry<T>>) =>
    group("brigade", b.name, b.commander, b.units, rows(b.units));

  /** A division's (or the loose units') own units, then its brigades. */
  const divisionContents = (d: Division<Entry<T>>) => (
    <>
      {rows(d.units)}
      {d.brigades.map(brigade)}
    </>
  );

  const division = (d: Division<Entry<T>>) =>
    group("division", d.name, d.commander, unitsIn(d), divisionContents(d));

  const corps = (c: Corps<Entry<T>>) =>
    group(
      "corps",
      c.name,
      c.commander,
      unitsIn(c),
      <>
        {divisionContents(c)}
        {c.divisions.map(division)}
      </>,
    );

  const loose = [...oob.units, ...oob.brigades.flatMap((b) => b.units)];
  const apart = oob.divisions.length > 0 || oob.corps.length > 0;

  return (
    <ul className={classes.list} aria-label={label}>
      {!oob.grouped
        ? rows(oob.units)
        : loose.length > 0 &&
          (apart
            ? group("division", "Not in a division", null, loose, divisionContents(oob))
            : divisionContents(oob))}
      {oob.divisions.map(division)}
      {oob.corps.map(corps)}
    </ul>
  );
}

interface FormationGroupProps {
  kind: Kind;
  name: string;
  commander: string | null;
  progress: string;
  /** Nothing left to do in it: it starts folded. */
  complete: boolean;
  children: ReactNode;
}

/**
 * A group's heading, a button that folds it, and its rows as a list named for the group, stepped
 * in with a line beside it. Folded, its heading still shows its progress.
 */
function FormationGroup({
  kind,
  name,
  commander,
  progress,
  complete,
  children,
}: FormationGroupProps) {
  const nameId = useId();
  const listId = useId();
  const [open, setOpen] = useState(!complete);
  // Opened again when there's something to do in it once more (an order taken back), whoever
  // folded it: adjusted while rendering, as React suggests, rather than in an effect.
  const [wasComplete, setWasComplete] = useState(complete);
  if (complete !== wasComplete) {
    setWasComplete(complete);
    if (!complete) setOpen(true);
  }

  return (
    <li>
      {/* The spaces keep the words apart for screen readers; the flex gap spaces them on screen. */}
      <UnstyledButton
        className={classes.heading}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <IconChevronRight size={14} aria-hidden className={classes.chevron} />
        <Text id={nameId} span size="sm" fw={kind === "brigade" ? 600 : 700}>
          {name}
        </Text>{" "}
        {commander && (
          <>
            <Text span size="sm">
              {commander}
            </Text>{" "}
          </>
        )}
        <Text span size="xs" c="dimmed">
          {progress}
        </Text>
      </UnstyledButton>
      <ul
        id={listId}
        hidden={!open}
        className={`${classes.list} ${classes.nested} ${classes[kind]}`}
        aria-labelledby={nameId}
      >
        {children}
      </ul>
    </li>
  );
}
