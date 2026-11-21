import {
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useListCampaignUnits } from "@/api/generated/endpoints/army-units/army-units";
import {
  getListReportsQueryKey,
  useSendUmpireReport,
} from "@/api/generated/endpoints/intelligence/intelligence";
import { getListSightingsQueryKey } from "@/api/generated/endpoints/sightings/sightings";
import { useListPositions } from "@/api/generated/endpoints/turns/turns";
import type { ArmySummary } from "@/api/generated/model";
import { ArmyBadge } from "@/features/armies/identity/ArmyBadge";
import { hexKey, hexName } from "@/features/maps/hex-grid";
import type { SightingEntry } from "@/features/maps/sighting-entries";
import { SightingsFields } from "@/features/maps/SightingsFields";
import {
  intelArmies,
  intelUnits,
  sightingEntries,
  umpireSightings,
  type IntelArmy,
} from "@/features/maps/umpire-intel";
import { errorMessage } from "@/lib/errors";
import { useOnline } from "@/lib/use-online";

const noteLimit = 1000;

interface SendIntelligenceModalProps {
  campaignId: string;
  /** The open turn: the units are told of where they stood as it started. */
  openTurn: number;
  armies: readonly ArmySummary[];
  /** The army it's for, if chosen already. */
  to?: string;
  onClose: () => void;
}

/**
 * The Umpire's intelligence for an army (step 70b, decision 0035), arriving at once with no
 * courier: where units of its side are, sightings of the other side's to shape, and a note. Mount
 * it only while open.
 */
export function SendIntelligenceModal({
  campaignId,
  openTurn,
  armies,
  to,
  onClose,
}: SendIntelligenceModalProps) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const send = useSendUmpireReport();
  const fresh = { query: { meta: { persist: false }, refetchOnMount: "always" } } as const;
  const units = useListCampaignUnits(campaignId, fresh);
  // Where the open turn started: after the last closed turn, not where its orders take them.
  const positions = useListPositions(campaignId, { turn: openTurn - 1 }, fresh);
  const onMap = useMemo(
    () => intelUnits(units.data ?? [], armies, positions.data ?? []),
    [units.data, armies, positions.data],
  );
  const [toId, setToId] = useState<string | null>(to ?? null);
  const recipient = armies.find((a) => a.id === toId);
  const [told, setTold] = useState<ReadonlySet<string>>(new Set());
  const [shapes, setShapes] = useState<ReadonlyMap<string, SightingEntry>>(new Map());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const allies = recipient ? intelArmies(onMap, armies, recipient, true) : [];
  const enemies = recipient ? intelArmies(onMap, armies, recipient, false) : [];
  const chosen = (list: readonly IntelArmy[]) =>
    list.flatMap((a) => a.units).filter((u) => told.has(u.unit.id));
  const entries = recipient ? sightingEntries(chosen(enemies), recipient.id, shapes) : [];
  const positionIds = chosen(allies).map((u) => u.unit.id);
  const sightings = umpireSightings(entries);
  const empty = positionIds.length === 0 && sightings.length === 0 && note.trim() === "";

  const toggle = (ids: readonly string[], on: boolean) => {
    const next = new Set(told);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    setTold(next);
  };

  const submit = async () => {
    if (!recipient) return;
    setError(null);
    try {
      await send.mutateAsync({
        id: recipient.id,
        data: { note: note.trim() || null, positions: positionIds, sightings },
      });
      notifications.show({ color: "green", message: `Sent intelligence to ${recipient.name}.` });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey(campaignId) }),
        queryClient.invalidateQueries({ queryKey: getListSightingsQueryKey(campaignId) }),
      ]);
      onClose();
    } catch (failed) {
      setError(errorMessage(failed, "The intelligence couldn't be sent. Try again."));
    }
  };

  const unitGroups = (list: readonly IntelArmy[], none: string) =>
    list.length === 0 ? (
      <Text size="sm" c="dimmed">
        {none}
      </Text>
    ) : (
      list.map(({ army, units: theirs }) => {
        const ids = theirs.map((u) => u.unit.id);
        const count = ids.filter((id) => told.has(id)).length;
        return (
          <Stack key={army.id} gap={4} role="group" aria-label={army.name}>
            <Checkbox
              label={<ArmyBadge army={army} />}
              aria-label={`All of ${army.name}`}
              checked={count === ids.length}
              indeterminate={count > 0 && count < ids.length}
              onChange={(event) => {
                toggle(ids, event.currentTarget.checked);
              }}
            />
            <Stack gap={4} pl="lg">
              {theirs.map((u) => (
                <Checkbox
                  key={u.unit.id}
                  size="xs"
                  label={`${u.unit.name}, ${hexName(u.hex)}`}
                  checked={told.has(u.unit.id)}
                  onChange={(event) => {
                    toggle([u.unit.id], event.currentTarget.checked);
                  }}
                />
              ))}
            </Stack>
          </Stack>
        );
      })
    );

  return (
    <Modal opened onClose={onClose} title="Send intelligence" centered size="lg">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          <Text size="sm" c="dimmed">
            It reaches the army at once, with no courier, and tells of the units where they stood as
            turn {openTurn} started.
          </Text>
          <Select
            label="To"
            data={armies.map((a) => ({ value: a.id, label: a.name }))}
            value={toId}
            allowDeselect={false}
            onChange={(value) => {
              setToId(value);
              setTold(new Set());
              setShapes(new Map());
            }}
            comboboxProps={{ withinPortal: false }}
          />
          {recipient &&
            (units.isPending || positions.isPending ? (
              <Loader size="sm" aria-label="Loading the units" />
            ) : (
              <>
                <Stack gap="xs">
                  <Text size="sm" fw={600}>
                    Positions
                  </Text>
                  <Text size="xs" c="dimmed">
                    Their side&apos;s units it learns exactly: hex and points.
                  </Text>
                  {unitGroups(allies, "Their side has no other army on the map.")}
                </Stack>
                <Stack gap="xs">
                  <Text size="sm" fw={600}>
                    The other side
                  </Text>
                  <Text size="xs" c="dimmed">
                    Units it hears of, as sightings: shape each below.
                  </Text>
                  {unitGroups(enemies, "The other side has no army on the map.")}
                </Stack>
                {entries.length > 0 && (
                  <SightingsFields
                    entries={entries}
                    onChange={(changed) => {
                      setShapes(new Map(changed.map((e) => [hexKey(e), e])));
                    }}
                    armies={armies}
                    places={[]}
                    canAdd={false}
                    intro="What it learns of each hex of the units chosen: only those units, not the rest of the hex."
                    labelOf={(entry) => hexName(entry)}
                  />
                )}
              </>
            ))}
          <Textarea
            label="Message"
            autosize
            minRows={3}
            maxLength={noteLimit}
            description={`${String(note.length)} of ${String(noteLimit)} characters.`}
            value={note}
            onChange={(event) => {
              setNote(event.currentTarget.value);
            }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={send.isPending}
              disabled={!online || !recipient || empty}
            >
              Send intelligence
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
