import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { getGetArmyQueryKey } from "@/api/generated/endpoints/armies/armies";
import { useAddScout } from "@/api/generated/endpoints/army-units/army-units";
import type { ArmyResponse } from "@/api/generated/model";
import { AddScoutBody } from "@/api/generated/zod/army-units/army-units.zod";
import { refreshCampaign } from "@/features/campaigns/campaign-cache";
import { applyServerErrors } from "@/lib/form-errors";
import { useOnline } from "@/lib/use-online";

type ScoutValues = z.infer<typeof AddScoutBody>;

/**
 * Adds a scout to the army (decision 0028): the campaign's own, never the library's, with only a
 * name. Mount it only while open.
 */
export function AddScoutModal({ army, onClose }: { army: ArmyResponse; onClose: () => void }) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const add = useAddScout();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ScoutValues>({
    resolver: zodResolver(AddScoutBody),
    defaultValues: { name: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const scout = await add.mutateAsync({ id: army.id, data: values });
      notifications.show({ color: "green", message: `Added ${scout.name}.` });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetArmyQueryKey(army.id) }),
        refreshCampaign(queryClient, army.campaignId),
      ]);
      onClose();
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["name"]));
    }
  });

  return (
    <Modal opened onClose={onClose} title="Add a scout" centered>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <Stack>
          {formError && (
            <Alert color="red" role="alert">
              {formError}
            </Alert>
          )}
          <Text size="sm">
            A scout rides as light cavalry and only watches: it has no FF or points, doesn&apos;t
            screen, force march or build boats, and needs no supply. Place it on the map once
            it&apos;s added.
          </Text>
          <TextInput
            label="Name"
            required
            data-autofocus
            error={errors.name?.message}
            {...form.register("name", { setValueAs: (value: string) => value.trim() })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!online}>
              Add scout
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
