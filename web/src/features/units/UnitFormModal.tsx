import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Autocomplete,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form";
import { z } from "zod";
import { UnitStatus, UnitType } from "@/api/generated/model";
import {
  CreateUnitBody,
  createUnitBodyBrigadeMax,
  createUnitBodyDivisionMax,
  createUnitBodyFightingFactorMax,
  createUnitBodyNotesMax,
  createUnitBodyPointsMax,
  createUnitBodyPointsMin,
} from "@/api/generated/zod/library/library.zod";
import { fights, unitTypeOptions } from "@/features/units/unit-types";
import { applyServerErrors } from "@/lib/form-errors";
import { useOnline } from "@/lib/use-online";

// Orval writes a minimum of 1 inline (.min(1)), with no constant as it has for the others.
const ffMin = 1;
const ffError = `Enter an FF from ${String(ffMin)} to ${String(createUnitBodyFightingFactorMax)}.`;

/** Free text up to `max` characters, or none. */
const upTo = (max: number) =>
  z
    .string()
    .max(max, `Keep it to ${String(max)} characters.`)
    .nullable();

// The generated schema, with messages people can act on.
const UnitForm = CreateUnitBody.extend({
  type: z.enum(Object.values(UnitType), { error: "Choose a type." }),
  // 0 for a scout, which doesn't fight (decision 0028); checked below.
  fightingFactor: z.int({ error: ffError }).min(0).max(createUnitBodyFightingFactorMax),
  points: z
    .int({
      error: `Enter points from ${String(createUnitBodyPointsMin)} to ${String(createUnitBodyPointsMax)}.`,
    })
    .min(createUnitBodyPointsMin)
    .max(createUnitBodyPointsMax),
  division: z
    .string()
    .max(createUnitBodyDivisionMax, `Keep it to ${String(createUnitBodyDivisionMax)} characters.`)
    .nullable(),
  brigade: z
    .string()
    .max(createUnitBodyBrigadeMax, `Keep it to ${String(createUnitBodyBrigadeMax)} characters.`)
    .nullable(),
  // Corps and commanders are as long as a division's name may be; notes and status are a
  // library unit's only.
  corps: upTo(createUnitBodyDivisionMax),
  corpsCommander: upTo(createUnitBodyDivisionMax),
  divisionCommander: upTo(createUnitBodyDivisionMax),
  brigadeCommander: upTo(createUnitBodyDivisionMax),
  notes: upTo(createUnitBodyNotesMax),
  status: z.enum(Object.values(UnitStatus)).nullable(),
}).refine((values) => !fights(values.type) || values.fightingFactor >= ffMin, {
  path: ["fightingFactor"],
  message: ffError,
});

export type UnitValues = z.infer<typeof UnitForm>;

const fields = [
  "name",
  "type",
  "fightingFactor",
  "points",
  "corps",
  "corpsCommander",
  "division",
  "divisionCommander",
  "brigade",
  "brigadeCommander",
  "notes",
  "status",
] as const;

/** A unit's place in its order of battle, for suggestions. */
interface Grouped {
  corps?: string | null;
  corpsCommander?: string | null;
  division?: string | null;
  divisionCommander?: string | null;
  brigade?: string | null;
  brigadeCommander?: string | null;
}

/** The order of battle's levels, each with its commander (decisions 0024 and 0025). */
const levels = [
  { group: "corps", label: "Corps", commander: "corpsCommander" },
  { group: "division", label: "Division", commander: "divisionCommander" },
  { group: "brigade", label: "Brigade", commander: "brigadeCommander" },
] as const;

const statusOptions = [
  { value: UnitStatus.Painted, label: "Painted" },
  { value: UnitStatus.Substitute, label: "Substitute (another unit's figures)" },
  { value: UnitStatus.Unpainted, label: "Unpainted" },
];

const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a?.trim() && a.trim().toLowerCase() === b?.trim().toLowerCase();

/** Units in the named group, or all of them while none is (or the group has no subgroups). */
function within(
  siblings: readonly Grouped[],
  level: "corps" | "division",
  name?: string | null,
  sub?: "division" | "brigade",
) {
  const inGroup = siblings.filter((u) => same(u[level], name));
  return sub && inGroup.some((u) => u[sub]) ? inGroup : siblings;
}

/** Each name once, in order ("2nd" before "10th"); Mantine refuses repeated options. */
function names(values: (string | null | undefined)[]) {
  const seen = new Map<string, string>();
  for (const value of values) {
    const name = value?.trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** What a unit has none of until it's given them; an army's copy never has notes or status. */
const noDetails = {
  division: null,
  brigade: null,
  corps: null,
  corpsCommander: null,
  divisionCommander: null,
  brigadeCommander: null,
  notes: null,
  status: null,
} satisfies Partial<UnitValues>;

/** A NumberInput's value as the form's number: empty becomes undefined, so it's "required". */
const toNumber = (value: number | string) => (typeof value === "number" ? value : undefined);

interface UnitFormModalProps {
  title: string;
  submitLabel: string;
  defaultValues?: DefaultValues<UnitValues>;
  /**
   * The units beside it (its faction's, or its army's): their corps, divisions and brigades are
   * suggested, so a slip of the keyboard doesn't start a new one, and choosing one fills in its
   * commander.
   */
  siblings?: readonly Grouped[];
  /** Shows the notes and status, which only a library unit has (decision 0025). */
  libraryDetails?: boolean;
  onSubmit: (values: UnitValues) => Promise<void>;
  onClose: () => void;
}

/**
 * A unit's name, type, Fighting Factor, points, and its corps, division and brigade with their
 * commanders (a library unit, with its notes and status, or an army's copy of one), in a modal.
 * A scout (decision 0028) stays a scout, with no FF or points: only its name and place change.
 * Mount it only while open.
 */
export function UnitFormModal({
  title,
  submitLabel,
  defaultValues = { name: "", points: 0 },
  siblings = [],
  libraryDetails = false,
  onSubmit,
  onClose,
}: UnitFormModalProps) {
  const online = useOnline();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<UnitValues>({
    resolver: zodResolver(UnitForm),
    defaultValues: { ...noDetails, ...defaultValues },
  });
  const { errors, isSubmitting } = form.formState;
  const scout = defaultValues.type !== undefined && !fights(defaultValues.type);
  const corps = useWatch({ control: form.control, name: "corps" });
  const division = useWatch({ control: form.control, name: "division" });
  // Each level's names: the chosen corps' divisions, and the chosen division's brigades (all of
  // them while it has none, or none is chosen yet).
  const suggestions = useMemo(
    () => ({
      corps: names(siblings.map((u) => u.corps)),
      division: names(within(siblings, "corps", corps, "division").map((u) => u.division)),
      brigade: names(within(siblings, "division", division, "brigade").map((u) => u.brigade)),
    }),
    [siblings, corps, division],
  );

  /** Fills in a group's commander from the units already in it, unless one's been entered. */
  const fillCommander = (level: (typeof levels)[number], name: string) => {
    if (form.getValues(level.commander)?.trim()) return;
    const known = siblings.find((u) => same(u[level.group], name) && u[level.commander]?.trim());
    if (known) form.setValue(level.commander, known[level.commander] ?? null);
  };

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, fields));
    }
  });

  return (
    <Modal opened onClose={onClose} title={title} centered size="lg">
      <form onSubmit={(event) => void submit(event)} noValidate>
        <Stack>
          {formError && (
            <Alert color="red" role="alert">
              {formError}
            </Alert>
          )}
          <TextInput
            label="Name"
            required
            data-autofocus
            error={errors.name?.message}
            {...form.register("name", { setValueAs: (value: string) => value.trim() })}
          />
          {scout ? (
            <Text size="sm" c="dimmed">
              A scout only watches: it has no FF or points.
            </Text>
          ) : (
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select
                  label="Type"
                  required
                  placeholder="Choose a type"
                  data={unitTypeOptions}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  allowDeselect={false}
                  error={errors.type?.message}
                  comboboxProps={{ withinPortal: false }}
                />
              )}
            />
          )}
          {levels.map((level) => (
            <Group key={level.group} grow align="flex-start">
              <Controller
                control={form.control}
                name={level.group}
                render={({ field }) => (
                  <Autocomplete
                    label={level.label}
                    data={suggestions[level.group]}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onOptionSubmit={(name) => {
                      fillCommander(level, name);
                    }}
                    onBlur={() => {
                      fillCommander(level, field.value ?? "");
                      field.onBlur();
                    }}
                    error={errors[level.group]?.message}
                    comboboxProps={{ withinPortal: false }}
                  />
                )}
              />
              <Controller
                control={form.control}
                name={level.commander}
                render={({ field }) => (
                  <TextInput
                    label={`${level.label} commander`}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={errors[level.commander]?.message}
                  />
                )}
              />
            </Group>
          ))}
          {!scout && (
            <Group grow align="flex-start">
              <Controller
                control={form.control}
                name="fightingFactor"
                render={({ field }) => (
                  <NumberInput
                    label="Fighting Factor (FF)"
                    required
                    min={ffMin}
                    max={createUnitBodyFightingFactorMax}
                    allowDecimal={false}
                    allowNegative={false}
                    clampBehavior="strict"
                    // Its step buttons have no accessible names; arrow keys still step.
                    hideControls
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(toNumber(value));
                    }}
                    onBlur={field.onBlur}
                    error={errors.fightingFactor?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="points"
                render={({ field }) => (
                  <NumberInput
                    label="Points"
                    required
                    min={createUnitBodyPointsMin}
                    max={createUnitBodyPointsMax}
                    allowDecimal={false}
                    allowNegative={false}
                    clampBehavior="strict"
                    // Its step buttons have no accessible names; arrow keys still step.
                    hideControls
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(toNumber(value));
                    }}
                    onBlur={field.onBlur}
                    error={errors.points?.message}
                  />
                )}
              />
            </Group>
          )}
          {libraryDetails && (
            <>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select
                    label="Figures"
                    placeholder="Not known"
                    data={statusOptions}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    clearable
                    error={errors.status?.message}
                    comboboxProps={{ withinPortal: false }}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <Textarea
                    label="Notes"
                    autosize
                    minRows={2}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.notes?.message}
                  />
                )}
              />
            </>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!online}>
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
