import { Button, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconBinoculars, IconPlus, IconShield } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getGetArmyQueryKey } from "@/api/generated/endpoints/armies/armies";
import {
  useDeleteArmyUnit,
  useUpdateArmyUnit,
} from "@/api/generated/endpoints/army-units/army-units";
import type { ArmyResponse, ArmyUnitResponse, UpdateArmyUnitRequest } from "@/api/generated/model";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EmptyState } from "@/components/EmptyState";
import { Section } from "@/components/Section";
import { AddScoutModal } from "@/features/units/AddScoutModal";
import { AddUnitsModal } from "@/features/units/AddUnitsModal";
import { OrderOfBattleTable } from "@/features/units/OrderOfBattleTable";
import { UnitFormModal, type UnitValues } from "@/features/units/UnitFormModal";
import { useConfirmTarget } from "@/lib/use-confirm-target";
import { useOnline } from "@/lib/use-online";
import { errorMessage } from "@/lib/errors";

/** The form's values an army's copy keeps: notes and status are the library unit's alone. */
const armyCopy = (values: UnitValues): UpdateArmyUnitRequest => ({
  name: values.name,
  type: values.type,
  fightingFactor: values.fightingFactor,
  points: values.points,
  division: values.division,
  brigade: values.brigade,
  corps: values.corps,
  corpsCommander: values.corpsCommander,
  divisionCommander: values.divisionCommander,
  brigadeCommander: values.brigadeCommander,
});

/**
 * The army's units: the campaign's copies of library units, and its own scouts (decision 0028), in
 * their order of battle. The Umpire (or an Admin) adds them, from the army's factions or as scouts,
 * and edits and removes them.
 */
export function UnitsSection({ army, manager }: { army: ArmyResponse; manager: boolean }) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const update = useUpdateArmyUnit();
  const remove = useDeleteArmyUnit();
  const [adding, addModal] = useDisclosure(false);
  const [addingScout, scoutModal] = useDisclosure(false);
  const [editing, setEditing] = useState<ArmyUnitResponse | null>(null);
  const deleting = useConfirmTarget<ArmyUnitResponse>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetArmyQueryKey(army.id) });

  const confirmDelete = async (unit: ArmyUnitResponse) => {
    try {
      await remove.mutateAsync({ id: unit.id });
      notifications.show({ color: "green", message: `Removed ${unit.name}.` });
      await refresh();
    } catch (error) {
      notifications.show({
        color: "red",
        message: errorMessage(error, "The unit couldn't be removed. Try again."),
      });
    }
    deleting.close();
  };

  return (
    <Section
      title="Units"
      description={
        manager
          ? "From the library, and the army's own scouts. Editing one here changes this campaign's copy only."
          : undefined
      }
      flush
      actions={
        manager && (
          <Group gap="xs">
            <Button
              size="xs"
              variant="default"
              leftSection={<IconBinoculars size={14} aria-hidden />}
              onClick={scoutModal.open}
              disabled={!online}
            >
              Add a scout
            </Button>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} aria-hidden />}
              onClick={addModal.open}
              disabled={!online}
            >
              Add units
            </Button>
          </Group>
        )
      }
    >
      {army.units.length === 0 ? (
        <EmptyState icon={IconShield} title="No units yet">
          {manager
            ? "Choose them from the library with Add units."
            : "The Umpire hasn't added any yet."}
        </EmptyState>
      ) : (
        <OrderOfBattleTable
          units={army.units}
          editor={manager}
          online={online}
          onEdit={setEditing}
          onDelete={deleting.open}
          deleteVerb="Remove"
          totals
        />
      )}
      {adding && <AddUnitsModal army={army} onClose={addModal.close} />}
      {addingScout && <AddScoutModal army={army} onClose={scoutModal.close} />}
      {editing && (
        <UnitFormModal
          title="Edit unit"
          submitLabel="Save"
          defaultValues={editing}
          siblings={army.units}
          onClose={() => {
            setEditing(null);
          }}
          onSubmit={async (values) => {
            const unit = await update.mutateAsync({ id: editing.id, data: armyCopy(values) });
            notifications.show({ color: "green", message: `Saved ${unit.name}.` });
            await refresh();
          }}
        />
      )}
      <ConfirmModal
        opened={deleting.opened}
        onClose={deleting.close}
        title="Remove this unit?"
        confirmLabel="Remove unit"
        onConfirm={() => {
          if (deleting.target) void confirmDelete(deleting.target);
        }}
        loading={remove.isPending}
      >
        {deleting.target?.name} will be removed from {army.name}, and any changes made to it here
        lost. The library keeps its own.
      </ConfirmModal>
    </Section>
  );
}
