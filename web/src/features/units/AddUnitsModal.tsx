import { Alert, Button, Fieldset, Group, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getGetArmyQueryKey, useListArmies } from "@/api/generated/endpoints/armies/armies";
import {
  useAddArmyUnits,
  useListCampaignUnits,
} from "@/api/generated/endpoints/army-units/army-units";
import { getGetFactionQueryOptions } from "@/api/generated/endpoints/library/library";
import type { ArmyResponse } from "@/api/generated/model";
import { refreshCampaign } from "@/features/campaigns/campaign-cache";
import { OrderOfBattleTable } from "@/features/units/OrderOfBattleTable";
import { errorMessage } from "@/lib/errors";
import { useOnline } from "@/lib/use-online";

const units = (count: number) => (count === 1 ? "1 unit" : `${String(count)} units`);

/**
 * Choose library units to add to the army (decision 0015): those of its factions, by faction, each
 * in its order of battle. One already in the campaign says which army has it. Mount it only while
 * open.
 */
export function AddUnitsModal({ army, onClose }: { army: ArmyResponse; onClose: () => void }) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const add = useAddArmyUnits();
  const factions = useQueries({
    // Fetched afresh each time it opens: a Manager may have added units since.
    queries: army.factions.map((faction) =>
      getGetFactionQueryOptions(faction.id, { query: { refetchOnMount: "always" } }),
    ),
  });
  const campaignUnits = useListCampaignUnits(army.campaignId, {
    query: { refetchOnMount: "always" },
  });
  const armies = useListArmies(army.campaignId);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const armyNames = new Map((armies.data ?? []).map((a) => [a.id, a.name]));
  armyNames.set(army.id, army.name);
  const takenBy = new Map(
    (campaignUnits.data ?? []).map((u) => [u.unitId, armyNames.get(u.armyId) ?? "another army"]),
  );
  const loading = factions.some((f) => f.isPending) || campaignUnits.isPending;
  const failed = factions.some((f) => f.isError) || campaignUnits.isError;

  const submit = async () => {
    setError(null);
    try {
      const added = await add.mutateAsync({ id: army.id, data: { unitIds: chosen } });
      notifications.show({
        color: "green",
        message:
          added.length === 1
            ? `Added ${added[0]?.name ?? "1 unit"}.`
            : `Added ${units(added.length)}.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetArmyQueryKey(army.id) }),
        refreshCampaign(queryClient, army.campaignId),
      ]);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught, "The units couldn't be added. Try again."));
    }
  };

  return (
    <Modal opened onClose={onClose} title="Add units" centered size="xl">
      <Stack>
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        {army.factions.length === 0 ? (
          <Text>
            {army.name} takes its units from the library&apos;s factions: choose them with Edit army
            first.
          </Text>
        ) : loading ? (
          <Text c="dimmed">Loading the library…</Text>
        ) : failed ? (
          <Alert color="red" role="alert">
            The library couldn&apos;t be loaded. Try again.
          </Alert>
        ) : (
          <Stack gap="md">
            <Text size="sm" fw={500}>
              From {army.name}&apos;s factions
            </Text>
            {factions.map(({ data: faction }) =>
              faction ? (
                <Fieldset key={faction.id} legend={faction.name} variant="unstyled">
                  {faction.units.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      No units in the library yet.
                    </Text>
                  ) : (
                    <OrderOfBattleTable
                      units={faction.units}
                      selection={{
                        chosen,
                        onChange: setChosen,
                        unavailable: (unit) => {
                          const taken = takenBy.get(unit.id);
                          return taken === undefined ? undefined : `In ${taken}`;
                        },
                      }}
                    />
                  )}
                </Fieldset>
              ) : null,
            )}
          </Stack>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            loading={add.isPending}
            disabled={!online || chosen.length === 0}
          >
            {chosen.length === 0 ? "Add units" : `Add ${units(chosen.length)}`}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
