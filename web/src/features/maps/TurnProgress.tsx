import { Group, Stack } from "@mantine/core";
import type { ArmySummary, CampaignTurnSummary } from "@/api/generated/model";
import { turnWhen } from "@/features/campaigns/calendar";
import { ArmyBadge } from "@/features/armies/identity/ArmyBadge";

interface TurnProgressProps {
  turn: CampaignTurnSummary;
  /** The campaign's armies, to name the ones still to submit. */
  armies: readonly ArmySummary[];
}

/**
 * How far a turn has got, for a panel's description: its day and time of day, how many armies
 * have submitted, and which haven't yet. Spans only: a description is a paragraph.
 */
export function TurnProgress({ turn, armies }: TurnProgressProps) {
  const when = turnWhen(turn);
  const pending = turn.pending.flatMap((id) => armies.find((a) => a.id === id) ?? []);
  return (
    <Stack component="span" gap={4}>
      {when && <span>{`${when}.`}</span>}
      <span>
        {`${String(turn.submitted)} of ${String(turn.armies)} armies have submitted this turn.`}
      </span>
      {pending.length > 0 && (
        <Group
          component="span"
          role="list"
          aria-label="Still to submit"
          gap="xs"
          c="var(--mantine-color-text)"
        >
          {pending.map((army) => (
            <span key={army.id} role="listitem">
              <ArmyBadge army={army} />
            </span>
          ))}
        </Group>
      )}
    </Stack>
  );
}
