import { Alert, Badge, Box, Button, Group, List, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCheck, IconChevronRight, IconPlayerTrackNext, IconSend } from "@tabler/icons-react";
import { useId, useState, type ReactNode } from "react";
import type {
  ArmyTurnDetails,
  ArmyTurnStatus,
  CampaignTurnSummary,
  ArmyUnitResponse,
} from "@/api/generated/model";
import { Section } from "@/components/Section";
import { ArmyBadge } from "@/features/armies/identity/ArmyBadge";
import { ArmyOrdersList, type CommandedUnit } from "@/features/maps/ArmyOrdersList";
import type { DepotThreat, HexWarning, UnitInHex } from "@/features/maps/contact";
import type { PlacedUnit } from "@/features/maps/stacks";
import { FormationList } from "@/features/maps/FormationList";
import { HexWarningsList } from "@/features/maps/HexWarningsList";
import type { TerrainIndex } from "@/features/maps/terrain";
import { ApproveModal } from "@/features/maps/ApproveModal";
import { ReviewModal } from "@/features/maps/ReviewModal";
import { SendIntelligenceButton } from "@/features/maps/SendIntelligenceButton";
import { StartTurnModal } from "@/features/maps/StartTurnModal";
import { UnitPlacementRow } from "@/features/maps/UnitPlacementRow";
import type { PickedOut } from "@/features/maps/pick-out";
import { reviewOf, type OpenArmyTurn, type useOrders } from "@/features/maps/use-orders";
import type { useReview } from "@/features/maps/use-review";
import { formatDateTime } from "@/lib/format";
import { useOnline } from "@/lib/use-online";
import { turnWhen } from "@/features/campaigns/calendar";

const statusLabels: Record<ArmyTurnStatus, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  Completed: "Approved",
};

interface ReviewPanelProps {
  campaignId: string;
  /** Where the orders as given leave the units, for sightings added by hand. */
  places: readonly UnitInHex[];
  open: CampaignTurnSummary;
  /** What stops the next turn starting. */
  problems: readonly string[];
  armyTurns: readonly OpenArmyTurn[];
  units: readonly ArmyUnitResponse[];
  review: ReturnType<typeof useReview>;
  /** Contact and concentration, by the orders as given (step 46). */
  warnings: readonly HexWarning[];
  threats: readonly DepotThreat[];
  terrain: TerrainIndex;
  /** Units added since the start and not on the map yet, which hold up the next turn. */
  unplaced: readonly { unit: PlacedUnit["unit"]; army: PlacedUnit["army"] }[];
  /** The unit being placed, if one is. */
  placing: string | null;
  onPlace: (unitId: string) => void;
  /** Every army's units, and where they are, for each army's list of units and orders (step 64d). */
  armyUnits: readonly CommandedUnit[];
  orders: ReturnType<typeof useOrders>;
  /** Opens a unit on the map (its drawer, with Move and Hold). */
  onChoose: (placed: PlacedUnit) => void;
  /** The formation picked out on the map, if one is (step 64). */
  pickedOut: PickedOut | null;
  onPickOut: (formation: PickedOut | null) => void;
}

/**
 * The Umpire's open turn (DESIGN.md §3.13): each army's turn with its status and times; Submit
 * for it while it's a Draft (decision 0011), Approve or Send back once it's submitted, Reopen
 * once it's approved; a unit added since the start to place (by army, in its order of battle); and Start turn N+1 once every
 * army's turn is approved and every unit is on the map.
 */
export function ReviewPanel({
  campaignId,
  places,
  open,
  problems,
  armyTurns,
  units,
  review,
  warnings,
  threats,
  terrain,
  unplaced,
  placing,
  onPlace,
  armyUnits,
  orders,
  onChoose,
  pickedOut,
  onPickOut,
}: ReviewPanelProps) {
  const online = useOnline();
  const [reviewing, setReviewing] = useState<{
    kind: "send-back" | "revert";
    entry: OpenArmyTurn;
    turn: ArmyTurnDetails;
  } | null>(null);
  const [approving, setApproving] = useState<{
    entry: OpenArmyTurn;
    turn: ArmyTurnDetails;
  } | null>(null);
  const [starting, { open: askToStart, close: closeStart }] = useDisclosure(false);
  const next = open.number + 1;

  return (
    <Section
      title={`Turn ${String(open.number)}`}
      description={[
        turnWhen(open) ? `${turnWhen(open) ?? ""}.` : null,
        `${String(open.submitted)} of ${String(open.armies)} armies have submitted this turn.`,
      ]
        .filter(Boolean)
        .join("\n")}
    >
      <Stack gap="lg">
        {unplaced.length > 0 && (
          <Stack gap={6}>
            <Text fw={600} size="sm">
              Not on the map yet
            </Text>
            <Text size="xs" c="dimmed">
              Added since the campaign started. Place each where it joins its army: from then on it
              moves by its orders.
            </Text>
            {[...new Map(unplaced.map((u) => [u.army.id, u.army])).values()].map((army) => (
              <Stack key={army.id} gap={6}>
                <Text fw={600} size="sm">
                  <ArmyBadge army={army} />
                </Text>
                <FormationList
                  items={unplaced.filter((u) => u.army.id === army.id)}
                  unitOf={(u) => u.unit}
                  label={`${army.name}'s units not on the map yet`}
                  renderItem={({ unit }) => (
                    <UnitPlacementRow
                      unit={unit}
                      army={army}
                      placed={false}
                      placing={placing}
                      onPlace={onPlace}
                    />
                  )}
                />
              </Stack>
            ))}
          </Stack>
        )}
        {armyTurns.map((entry) =>
          entry.turn ? (
            <ArmyTurnReview
              key={entry.army.id}
              entry={entry}
              turn={entry.turn}
              review={review}
              onReview={(kind, turn) => {
                setReviewing({ kind, entry, turn });
              }}
              onApproveWithNote={(turn) => {
                setApproving({ entry, turn });
              }}
              units={
                <ArmyUnitsFold
                  army={entry.army}
                  turn={entry.turn}
                  units={armyUnits.filter((u) => u.army.id === entry.army.id)}
                  orders={orders}
                  night={open.part === "Night"}
                  onChoose={onChoose}
                  pickedOut={pickedOut}
                  onPickOut={onPickOut}
                />
              }
            />
          ) : null,
        )}
        <HexWarningsList warnings={warnings} threats={threats} terrain={terrain} from="orders" />
        {problems.length > 0 && (
          <Alert role="status" color="gray" title={`Before turn ${String(next)} can start`}>
            <List size="sm" spacing={2}>
              {problems.map((problem) => (
                <List.Item key={problem}>{problem}</List.Item>
              ))}
            </List>
          </Alert>
        )}
        <SendIntelligenceButton campaignId={campaignId} />
        <Button
          leftSection={<IconPlayerTrackNext size={16} aria-hidden />}
          disabled={!online || problems.length > 0}
          onClick={askToStart}
        >
          Start turn {next}
        </Button>
      </Stack>
      {approving && (
        <ApproveModal
          army={approving.entry.army}
          turn={approving.turn.turn}
          onApprove={(note) => review.approve(approving.turn, approving.entry.army.name, note)}
          onClose={() => {
            setApproving(null);
          }}
        />
      )}
      {reviewing && (
        <ReviewModal
          kind={reviewing.kind}
          army={reviewing.entry.army}
          turn={reviewing.turn.turn}
          units={units.filter((u) => u.armyId === reviewing.entry.army.id)}
          onSubmit={(data) =>
            review.review(reviewing.kind, reviewing.turn, reviewing.entry.army.name, data)
          }
          onClose={() => {
            setReviewing(null);
          }}
        />
      )}
      {starting && (
        <StartTurnModal
          campaignId={campaignId}
          closing={open.number}
          armies={armyTurns.map((entry) => entry.army)}
          places={places}
          busy={review.busy}
          onStart={(attrition, sightings) => {
            void review.startNext(next, attrition, sightings).then((started) => {
              if (started) closeStart();
            });
          }}
          onClose={closeStart}
        />
      )}
    </Section>
  );
}

interface ArmyTurnReviewProps {
  entry: OpenArmyTurn;
  turn: ArmyTurnDetails;
  review: ReturnType<typeof useReview>;
  onReview: (kind: "send-back" | "revert", turn: ArmyTurnDetails) => void;
  /** Approving with a note for the commander (decision 0047). */
  onApproveWithNote: (turn: ArmyTurnDetails) => void;
  /** Its units and their orders, folded away. */
  units: ReactNode;
}

function ArmyTurnReview({
  entry: { army },
  turn,
  review,
  onReview,
  onApproveWithNote,
  units,
}: ArmyTurnReviewProps) {
  const online = useOnline();
  const moves = turn.orders.filter((o) => o.kind === "Move").length;
  const holds = turn.orders.length - moves;
  const commander = army.commander
    ? `${army.commander.firstName} ${army.commander.lastName}`
    : null;
  // A turn can be sent back and submitted again: the note that came with the latest submission.
  const commanderNote =
    turn.status === "Submitted"
      ? turn.history.findLast((event) => event.kind === "Submitted")?.note
      : null;

  return (
    <Stack gap={6}>
      <Group justify="space-between" wrap="nowrap">
        <Text fw={600} size="sm">
          <ArmyBadge army={army} />
        </Text>
        <Badge variant="light" color={turn.status === "Draft" ? "gray" : "navy"}>
          {statusLabels[turn.status]}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed">
        {turn.status === "Draft"
          ? `${commander ? `${commander} is giving orders` : "No commander: give its orders on the map"} (${String(turn.orders.length)} so far).`
          : `${String(moves)} ${moves === 1 ? "move" : "moves"}, ${String(holds)} ${holds === 1 ? "hold" : "holds"}. ` +
            (turn.status === "Submitted" && turn.submittedAt
              ? `Submitted ${formatDateTime(turn.submittedAt)}.`
              : turn.completedAt
                ? `Approved ${formatDateTime(turn.completedAt)}.`
                : "")}
      </Text>
      {commanderNote && (
        <Alert role="status" color="navy" title="Note from the commander">
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {commanderNote}
          </Text>
        </Alert>
      )}
      {units}
      {turn.status === "Draft" && (
        <Group gap="xs">
          <Button
            size="compact-sm"
            variant="default"
            leftSection={<IconSend size={14} aria-hidden />}
            aria-label={`Submit for them: ${army.name}`}
            disabled={!online || review.busy}
            onClick={() => void review.submit(turn, army.name)}
          >
            Submit for them
          </Button>
        </Group>
      )}
      {turn.status === "Submitted" && (
        <Group gap="xs">
          <Button
            size="compact-sm"
            leftSection={<IconCheck size={14} aria-hidden />}
            aria-label={`Approve ${army.name}'s turn`}
            disabled={!online || review.busy}
            onClick={() => void review.approve(turn, army.name)}
          >
            Approve
          </Button>
          <Button
            size="compact-sm"
            variant="default"
            aria-label={`Approve ${army.name}'s turn with a note`}
            disabled={!online || review.busy}
            onClick={() => {
              onApproveWithNote(turn);
            }}
          >
            Approve with note…
          </Button>
          <Button
            size="compact-sm"
            variant="default"
            aria-label={`Send back ${army.name}'s turn`}
            disabled={!online}
            onClick={() => {
              onReview("send-back", turn);
            }}
          >
            Send back
          </Button>
        </Group>
      )}
      {turn.status === "Completed" && (
        <Group gap="xs">
          <Button
            size="compact-sm"
            variant="subtle"
            aria-label={`Reopen ${army.name}'s turn`}
            disabled={!online}
            onClick={() => {
              onReview("revert", turn);
            }}
          >
            Reopen
          </Button>
        </Group>
      )}
    </Stack>
  );
}

interface ArmyUnitsFoldProps {
  army: OpenArmyTurn["army"];
  turn: ArmyTurnDetails;
  units: readonly CommandedUnit[];
  orders: ReturnType<typeof useOrders>;
  night: boolean;
  onChoose: (placed: PlacedUnit) => void;
  pickedOut: PickedOut | null;
  onPickOut: (formation: PickedOut | null) => void;
}

/**
 * An army's units and their orders, folded away until the Umpire opens them (step 64d): its
 * order of battle, each formation's menu (pick out, hold the rest), and undo, while the turn can
 * change (a Draft or Submitted, decision 0011).
 */
function ArmyUnitsFold({ army, turn, units, ...list }: ArmyUnitsFoldProps) {
  const [opened, { toggle }] = useDisclosure(false);
  const id = useId();
  const onMap = units.filter((u) => u.placed);
  const ordered = onMap.filter((u) => turn.orders.some((o) => o.unitId === u.unit.id)).length;
  if (units.length === 0) return null;

  return (
    <Box>
      <Button
        variant="subtle"
        color="gray"
        size="compact-sm"
        px={4}
        aria-expanded={opened}
        aria-controls={id}
        leftSection={
          <IconChevronRight
            size={14}
            aria-hidden
            style={{ transform: opened ? "rotate(90deg)" : undefined }}
          />
        }
        onClick={toggle}
      >
        {`Units (${String(ordered)} of ${String(onMap.length)} ordered)`}
      </Button>
      {opened && (
        <Box id={id} mt={4}>
          <ArmyOrdersList
            army={army}
            turn={turn}
            units={units}
            editable={turn.status !== "Completed"}
            notes={reviewOf(turn)?.unitNotes}
            {...list}
          />
        </Box>
      )}
    </Box>
  );
}
