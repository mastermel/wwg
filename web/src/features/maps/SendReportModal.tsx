import { Alert, Button, Group, Modal, Select, Stack, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getListReportsQueryKey,
  useSendReport,
} from "@/api/generated/endpoints/intelligence/intelligence";
import type { ArmySummary } from "@/api/generated/model";
import { useSession } from "@/features/auth/session-context";
import { errorMessage } from "@/lib/errors";
import { useOnline } from "@/lib/use-online";

const noteLimit = 1000;

interface SendReportModalProps {
  campaignId: string;
  /** The armies the viewer sends from: a commander's own (the Umpire's, any). */
  from: readonly ArmySummary[];
  armies: readonly ArmySummary[];
  /** The armies with a Commander in Chief: a courier rides from one to another (decision 0033). */
  chiefs: ReadonlySet<string>;
  onClose: () => void;
}

/**
 * Sending an ally a report (step 49d, decisions 0020, 0033 and 0037): a hand-written message; a
 * courier carries it from our Commander in Chief to theirs, so both need one. Mount it only while
 * open.
 */
export function SendReportModal({
  campaignId,
  from,
  armies,
  chiefs,
  onClose,
}: SendReportModalProps) {
  const online = useOnline();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const send = useSendReport();
  const [fromId, setFromId] = useState(from[0]?.id ?? "");
  const sender = armies.find((a) => a.id === fromId);
  const allies = armies.filter((a) => a.side.id === sender?.side.id && a.id !== sender.id);
  // One commander's armies already know what each other knows (decision 0036): no couriers.
  const sameCommander = (army: ArmySummary) =>
    !!army.commander && army.commander.memberId === sender?.commander?.memberId;
  const why = (army: ArmySummary) =>
    sameCommander(army)
      ? army.commander?.userId === user?.id
        ? "yours too"
        : "the same commander"
      : chiefs.has(army.id)
        ? null
        : "no Commander in Chief";
  const [toId, setToId] = useState<string | null>(allies.find((a) => !why(a))?.id ?? null);
  const noChief = !chiefs.has(fromId);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const empty = note.trim() === "";

  const submit = async () => {
    if (!toId) return;
    setError(null);
    try {
      await send.mutateAsync({
        id: fromId,
        data: {
          toArmyId: toId,
          note: note.trim(),
        },
      });
      notifications.show({
        color: "green",
        message: `Sent a report to ${armies.find((a) => a.id === toId)?.name ?? "the ally"} by courier.`,
      });
      await queryClient.invalidateQueries({ queryKey: getListReportsQueryKey(campaignId) });
      onClose();
    } catch (failed) {
      setError(errorMessage(failed, "The report couldn't be sent. Try again."));
    }
  };

  return (
    <Modal opened onClose={onClose} title="Send a report" centered>
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
          {from.length > 1 && (
            <Select
              label="From"
              data={from.map((a) => ({ value: a.id, label: a.name }))}
              value={fromId}
              allowDeselect={false}
              onChange={(value) => {
                if (!value) return;
                setFromId(value);
                setToId(null);
              }}
              comboboxProps={{ withinPortal: false }}
            />
          )}
          {noChief && (
            <Alert role="status" color="gray">
              {sender?.name ?? "This army"} has no Commander in Chief, whom a courier rides from.
              The Umpire chooses one.
            </Alert>
          )}
          {allies.length === 0 ? (
            <Alert role="status" color="gray">
              Your side has no other army to send to.
            </Alert>
          ) : (
            <Select
              label="To"
              description="A courier rides it from your Commander in Chief to theirs: it takes a turn or more."
              data={allies.map((a) => {
                const reason = why(a);
                return reason
                  ? { value: a.id, label: `${a.name} (${reason})`, disabled: true }
                  : { value: a.id, label: a.name };
              })}
              value={toId}
              allowDeselect={false}
              onChange={setToId}
              comboboxProps={{ withinPortal: false }}
            />
          )}
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
              disabled={!online || noChief || !toId || empty}
            >
              Send by courier
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
