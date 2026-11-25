import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Group, Modal, Stack, Textarea, TextInput } from "@mantine/core";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import {
  CreateMarkerBody,
  createMarkerBodyDescriptionMax,
} from "@/api/generated/zod/markers/markers.zod";
import { applyServerErrors } from "@/lib/form-errors";
import { useOnline } from "@/lib/use-online";

const MarkerFields = CreateMarkerBody.pick({ title: true, description: true });

export type MarkerValues = z.infer<typeof MarkerFields>;

interface MarkerFormModalProps {
  title: string;
  submitLabel: string;
  /** The hex it's on, in words: "Hex (3, −2)". */
  hexName: string;
  initial: MarkerValues;
  onSubmit: (values: MarkerValues) => Promise<void>;
  onClose: () => void;
}

/**
 * One of the viewer's own markers (step 80, decision 0054): a title, and a short description.
 * Mount it only while open.
 */
export function MarkerFormModal({
  title,
  submitLabel,
  hexName,
  initial,
  onSubmit,
  onClose,
}: MarkerFormModalProps) {
  const online = useOnline();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<MarkerValues>({
    resolver: zodResolver(MarkerFields),
    defaultValues: { title: initial.title, description: initial.description ?? "" },
  });
  const { errors, isSubmitting } = form.formState;
  const description = useWatch({ control: form.control, name: "description" }) ?? "";

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit({
        title: values.title,
        description: values.description === "" ? null : values.description,
      });
      onClose();
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ["title", "description"]));
    }
  });

  return (
    <Modal opened onClose={onClose} title={title} centered>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <Stack>
          {formError && (
            <Alert color="red" role="alert">
              {formError}
            </Alert>
          )}
          <TextInput
            label="Title"
            description={`On ${hexName}. Only you see your markers.`}
            required
            maxLength={100}
            data-autofocus
            error={errors.title?.message}
            {...form.register("title", { setValueAs: (value: string) => value.trim() })}
          />
          <Textarea
            label="Description"
            description={`Optional. ${String(description.length)} of ${String(createMarkerBodyDescriptionMax)} characters.`}
            autosize
            minRows={2}
            maxLength={createMarkerBodyDescriptionMax}
            error={errors.description?.message}
            {...form.register("description", { setValueAs: (value: string) => value.trim() })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!online}>
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
