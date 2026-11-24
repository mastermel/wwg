import { Alert, Button, Group, NumberInput, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getGetCourierSettingsQueryKey,
  useGetCourierSettings,
  useUpdateCourierSettings,
} from "@/api/generated/endpoints/intelligence/intelligence";
import {
  updateCourierSettingsBodySpeedMax as speedMax,
  updateCourierSettingsBodySpeedMin as speedMin,
} from "@/api/generated/zod/intelligence/intelligence.zod";
import { QueryState } from "@/components/QueryState";
import { Section } from "@/components/Section";
import { errorMessage } from "@/lib/errors";
import { useOnline } from "@/lib/use-online";

/** The rules' courier rides as light cavalry (§L). */
const rulesSpeed = 1;

/**
 * How fast couriers ride (decision 0048), as a multiple of light cavalry's: 1.5 unless the Umpire
 * judges otherwise. Couriers already on their way ride at it from the next turn.
 */
export function CourierSection({ campaignId }: { campaignId: string }) {
  const settings = useGetCourierSettings(campaignId);
  return (
    <Section
      title="Couriers"
      description="A courier rides by the cheapest way, as light cavalry would, but this many times as far each turn."
    >
      <QueryState query={settings}>
        {(loaded) => (
          <CourierFields key={loaded.speed} campaignId={campaignId} saved={loaded.speed} />
        )}
      </QueryState>
    </Section>
  );
}

function CourierFields({ campaignId, saved }: { campaignId: string; saved: number }) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const update = useUpdateCourierSettings();
  const [speed, setSpeed] = useState<number | null>(saved);
  const [formError, setFormError] = useState<string | null>(null);
  const valid = speed !== null && speed >= speedMin && speed <= speedMax;

  const save = async () => {
    if (!valid) return;
    setFormError(null);
    try {
      await update.mutateAsync({ id: campaignId, data: { speed } });
      notifications.show({ color: "green", message: "Saved the courier settings." });
      await queryClient.invalidateQueries({ queryKey: getGetCourierSettingsQueryKey(campaignId) });
    } catch (error) {
      setFormError(errorMessage(error, "The courier settings weren't saved. Try again."));
    }
  };

  return (
    <Stack gap="md">
      {formError && (
        <Alert color="red" role="alert">
          {formError}
        </Alert>
      )}
      <NumberInput
        label="Speed, times light cavalry's"
        description="The rules' courier rides at 1. Couriers on their way ride at the new speed from the next turn."
        required
        min={speedMin}
        max={speedMax}
        decimalScale={2}
        allowNegative={false}
        clampBehavior="strict"
        // Its step buttons have no accessible names; arrow keys still step.
        hideControls
        step={0.25}
        value={speed ?? ""}
        onChange={(value) => {
          setSpeed(typeof value === "number" ? value : null);
        }}
        error={
          speed === null
            ? `Enter a speed from ${String(speedMin)} to ${String(speedMax)}.`
            : undefined
        }
      />
      <Group justify="space-between">
        <Button
          variant="subtle"
          onClick={() => {
            setSpeed(rulesSpeed);
          }}
        >
          Use the rules&apos; courier
        </Button>
        <Button
          loading={update.isPending}
          disabled={!online || !valid || speed === saved}
          onClick={() => void save()}
        >
          Save couriers
        </Button>
      </Group>
    </Stack>
  );
}
