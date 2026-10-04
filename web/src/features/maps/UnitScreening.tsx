import { Stack, Switch, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetScreeningQueryKey,
  useGetScreening,
  useUpdateScreening,
} from "@/api/generated/endpoints/screening/screening";
import { describeScreeningTurns } from "@/features/maps/screening";
import { errorMessage } from "@/lib/errors";
import { useOnline } from "@/lib/use-online";

const live = { query: { meta: { persist: false } } } as const;

interface UnitScreeningProps {
  unitId: string;
  name: string;
  /** Whether the viewer may turn it on or off now (not on a past turn's map). */
  canChange: boolean;
}

/**
 * A unit's screening (decision 0026), in the unit drawer for its commander and the Umpire: the
 * switch, for the types that can screen, and the turns it closed screening. Nothing for a unit
 * that can't and never did.
 */
export function UnitScreening({ unitId, name, canChange }: UnitScreeningProps) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const screening = useGetScreening(unitId, live);
  const update = useUpdateScreening();
  const data = screening.data;
  if (!data || (!data.canScreen && data.turns.length === 0)) return null;
  const turns = describeScreeningTurns(data.turns);

  return (
    <Stack gap={4}>
      {data.canScreen && (
        <Switch
          label="Screening"
          description="The enemy's sightings of its hex see only the screen, not what's behind it."
          checked={data.screening}
          disabled={!canChange || !online || update.isPending}
          onChange={(event) => {
            const on = event.currentTarget.checked;
            void update
              .mutateAsync({ id: unitId, data: { screening: on } })
              .then((saved) => {
                queryClient.setQueryData(getGetScreeningQueryKey(unitId), saved);
                notifications.show({
                  color: "green",
                  message: on ? `${name} is screening.` : `${name} stopped screening.`,
                });
              })
              .catch((error: unknown) => {
                notifications.show({
                  color: "red",
                  message: errorMessage(error, "Screening couldn't be changed. Try again."),
                });
              });
          }}
        />
      )}
      <Text size="sm" c="dimmed">
        {turns ? `Screened: ${turns}.` : "Hasn't screened at the end of a turn yet."}
      </Text>
    </Stack>
  );
}
