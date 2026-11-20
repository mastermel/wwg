import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import {
  getListCouriersQueryKey,
  getListReportsQueryKey,
  useStopCourier,
} from "@/api/generated/endpoints/intelligence/intelligence";
import type { ArmySummary, CourierResponse } from "@/api/generated/model";
import {
  StopCourierBody,
  stopCourierBodyNoteMax,
} from "@/api/generated/zod/intelligence/intelligence.zod";
import { courierRoute } from "@/features/maps/couriers";
import { applyServerErrors } from "@/lib/form-errors";
import { useOnline } from "@/lib/use-online";

type CancelValues = z.infer<typeof StopCourierBody>;

interface CancelCourierModalProps {
  campaignId: string;
  courier: CourierResponse;
  armies: readonly ArmySummary[];
  onClose: () => void;
}

/**
 * The Umpire cancelling a courier with why (decision 0033): captured or lost, its report never
 * arrives. Only the Umpire and Admins see the note. Mount it only while open.
 */
export function CancelCourierModal({
  campaignId,
  courier,
  armies,
  onClose,
}: CancelCourierModalProps) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const stop = useStopCourier();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CancelValues>({
    resolver: zodResolver(StopCourierBody),
    defaultValues: { note: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const note = useWatch({ control: form.control, name: "note" });
  const route = courierRoute(courier, armies);

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await stop.mutateAsync({ id: courier.reportId, data: values });
      notifications.show({ color: "green", message: `Cancelled the courier from ${route}.` });
      onClose();
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["note"]));
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListCouriersQueryKey(campaignId) }),
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey(campaignId) }),
      ]);
    }
  });

  return (
    <Modal opened onClose={onClose} title="Cancel the courier?" centered>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <Stack>
          {formError && (
            <Alert color="red" role="alert">
              {formError}
            </Alert>
          )}
          <Text size="sm">
            From {route}. Captured or lost: the report never arrives, and nobody is told.
          </Text>
          <Textarea
            label="Why"
            description={`Only you and Admins see it. ${String(note.length)} of ${String(stopCourierBodyNoteMax)} characters.`}
            required
            autosize
            minRows={2}
            maxLength={stopCourierBodyNoteMax}
            data-autofocus
            error={errors.note?.message}
            {...form.register("note", { setValueAs: (value: string) => value.trim() })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Keep it
            </Button>
            <Button type="submit" color="red" loading={isSubmitting} disabled={!online}>
              Cancel the courier
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
