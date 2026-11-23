import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ArmySummary } from "@/api/generated/model";
import { ApproveTurnBody } from "@/api/generated/zod/turns/turns.zod";
import { useOnline } from "@/lib/use-online";

// The body is nullable as a whole; the form fills in the object.
const ApproveForm = z.object({ note: ApproveTurnBody.options[1].shape.note.unwrap() });

type ApproveValues = z.infer<typeof ApproveForm>;

interface ApproveModalProps {
  army: ArmySummary;
  turn: number;
  /** Resolves to whether it was approved: the modal stays open if not. */
  onApprove: (note: string | null) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Approving a Submitted turn with a note for its commander (decision 0047): the plain **Approve**
 * beside it stays one click. A blank note approves without one. Mount it only while open.
 */
export function ApproveModal({ army, turn, onApprove, onClose }: ApproveModalProps) {
  const online = useOnline();
  const form = useForm<ApproveValues>({
    resolver: zodResolver(ApproveForm),
    defaultValues: { note: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ note }) => {
    if (await onApprove(note === "" ? null : note)) onClose();
  });

  return (
    <Modal opened onClose={onClose} title={`Approve ${army.name}'s turn ${String(turn)}`} centered>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <Stack>
          <Text size="sm">
            Its orders stand as submitted. The commander reads your note with the approval, and on
            the next turn.
          </Text>
          <Textarea
            label="Note for the commander"
            autosize
            minRows={3}
            data-autofocus
            error={errors.note?.message}
            {...form.register("note", { setValueAs: (value: string) => value.trim() })}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!online}>
              Approve
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
