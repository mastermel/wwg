import { Alert, Badge, Button, Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconMoon, IconSend } from "@tabler/icons-react";
import { useState } from "react";
import type { ArmyTurnDetails, ArmyTurnStatus, CampaignTurnSummary } from "@/api/generated/model";
import { Section } from "@/components/Section";
import { ArmyBadge } from "@/features/armies/identity/ArmyBadge";
import { ArmyOrdersList, type CommandedUnit } from "@/features/maps/ArmyOrdersList";
import { commanderWarnings, type HexWarning } from "@/features/maps/contact";
import { HexWarningsList } from "@/features/maps/HexWarningsList";
import type { PickedOut } from "@/features/maps/pick-out";
import { SubmitTurnModal } from "@/features/maps/SubmitTurnModal";
import type { TerrainIndex } from "@/features/maps/terrain";
import type { PlacedUnit } from "@/features/maps/stacks";
import {
  approvalNoteOf,
  reviewOf,
  type OpenArmyTurn,
  type useOrders,
} from "@/features/maps/use-orders";
import { useOnline } from "@/lib/use-online";
import { turnPartHours, turnWhen } from "@/features/campaigns/calendar";

const statusLabels: Record<ArmyTurnStatus, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  Completed: "Approved",
};

interface TurnPanelProps {
  /** The open campaign turn, for its number and how far it's got. */
  open: CampaignTurnSummary;
  commanded: readonly OpenArmyTurn[];
  units: readonly CommandedUnit[];
  orders: ReturnType<typeof useOrders>;
  /** Opens a unit on the map (its drawer, with Move and Hold). */
  onChoose: (placed: PlacedUnit) => void;
  /** The formation picked out on the map, if one is (step 64). */
  pickedOut: PickedOut | null;
  onPickOut: (formation: PickedOut | null) => void;
  /** The commander's hexes over a concentration limit, by the orders as given (step 46). */
  warnings: readonly HexWarning[];
  terrain: TerrainIndex;
}

/**
 * A commander's turn (DESIGN.md §3.13): how far the turn has got, their hexes over a
 * concentration limit, and for each army they command its status, the Umpire's notes, each unit's order (with undo) in the army's order of battle, and
 * Submit.
 */
export function TurnPanel({
  open,
  commanded,
  units,
  orders,
  onChoose,
  pickedOut,
  onPickOut,
  warnings,
  terrain,
}: TurnPanelProps) {
  const [submitting, setSubmitting] = useState<OpenArmyTurn | null>(null);
  const [confirming, { open: ask, close }] = useDisclosure(false);
  const [note, setNote] = useState("");

  return (
    <Section
      title={`Turn ${String(open.number)}`}
      description={[
        turnWhen(open) ? `${turnWhen(open) ?? ""}.` : null,
        `${String(open.submitted)} of ${String(open.armies)} armies have submitted this turn.`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Stack gap="lg">
        {open.part === "Night" && (
          <Alert role="status" color="gray" icon={<IconMoon aria-hidden />}>
            It&apos;s night ({turnPartHours.Night}): a unit that moves by night counts it towards a
            forced march.
          </Alert>
        )}
        <HexWarningsList
          warnings={warnings}
          terrain={terrain}
          from="orders"
          title={commanderWarnings}
        />
        {commanded.map((entry) =>
          entry.turn ? (
            <ArmyTurnOrders
              key={entry.army.id}
              entry={entry}
              turn={entry.turn}
              units={units.filter((u) => u.army.id === entry.army.id)}
              orders={orders}
              night={open.part === "Night"}
              onChoose={onChoose}
              pickedOut={pickedOut}
              onPickOut={onPickOut}
              onSubmit={() => {
                setSubmitting(entry);
                ask();
              }}
            />
          ) : null,
        )}
      </Stack>
      <SubmitTurnModal
        opened={confirming}
        onClose={close}
        loading={orders.busy}
        note={note}
        setNote={setNote}
        onConfirm={() => {
          const turn = submitting?.turn;
          if (submitting && turn) {
            void orders
              .submit(submitting.army.id, turn, submitting.army.name, note.trim())
              .then(() => {
                setNote("");
                close();
              });
          }
        }}
      >
        The Umpire reviews {submitting?.army.name}&apos;s orders next. They can&apos;t be changed
        once submitted, unless the Umpire sends them back.
      </SubmitTurnModal>
    </Section>
  );
}

interface ArmyTurnOrdersProps {
  entry: OpenArmyTurn;
  turn: ArmyTurnDetails;
  units: readonly CommandedUnit[];
  orders: ReturnType<typeof useOrders>;
  onChoose: (placed: PlacedUnit) => void;
  pickedOut: PickedOut | null;
  onPickOut: (formation: PickedOut | null) => void;
  onSubmit: () => void;
  /** The turn is a Night: its moves are night moves. */
  night: boolean;
}

function ArmyTurnOrders({
  entry: { army, turns },
  turn,
  units,
  orders,
  onChoose,
  pickedOut,
  onPickOut,
  onSubmit,
  night,
}: ArmyTurnOrdersProps) {
  const online = useOnline();
  const draft = turn.status === "Draft";
  const review = reviewOf(turn);
  const approval = approvalNoteOf(turn, turns);
  const missing = units.filter(
    (u) => u.placed && !turn.orders.some((o) => o.unitId === u.unit.id),
  ).length;

  // Named for its army: a commander of several has a Submit for each (decision 0036).
  return (
    <Stack gap="xs" role="group" aria-label={army.name}>
      <Group justify="space-between" wrap="nowrap">
        <Text fw={600} size="sm">
          <ArmyBadge army={army} />
        </Text>
        <Badge variant="light" color={draft ? "gray" : "navy"}>
          {statusLabels[turn.status]}
        </Badge>
      </Group>
      {review && (
        <Alert
          role="status"
          color="yellow"
          title={review.kind === "SentBack" ? "Sent back" : "Reopened"}
        >
          <Text size="sm">
            {review.byName ?? "The Umpire"}{" "}
            {review.kind === "SentBack" ? "sent this turn back" : "reopened this turn"}
            {review.note ? `: ${review.note}` : "."}
          </Text>
        </Alert>
      )}
      {approval && (
        <Alert
          role="status"
          color="navy"
          title={approval.current ? "Approved" : `The Umpire on turn ${String(approval.turn)}`}
        >
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {approval.current
              ? `${approval.byName ?? "The Umpire"} approved this turn: ${approval.note}`
              : approval.note}
          </Text>
        </Alert>
      )}
      <ArmyOrdersList
        army={army}
        turn={turn}
        units={units}
        orders={orders}
        editable={draft}
        night={night}
        onChoose={onChoose}
        pickedOut={pickedOut}
        onPickOut={onPickOut}
        notes={review?.unitNotes}
      />
      {draft ? (
        <>
          <Button
            leftSection={<IconSend size={16} aria-hidden />}
            disabled={!online || missing > 0}
            onClick={onSubmit}
          >
            Submit turn {turn.turn}
          </Button>
          {missing > 0 && (
            <Text size="xs" c="dimmed">
              Give every unit an order to submit ({missing} to go). Choose a unit on the map or
              here.
            </Text>
          )}
        </>
      ) : (
        <Text size="sm" c="dimmed">
          {turn.status === "Submitted"
            ? "Submitted: the Umpire reviews it next."
            : "Approved: the next turn starts once every army's is."}
        </Text>
      )}
    </Stack>
  );
}
