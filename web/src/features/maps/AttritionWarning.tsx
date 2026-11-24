import { Alert, List, Stack, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useListMarches } from "@/api/generated/endpoints/turns/turns";
import type { AttritionDueResponse, UnitSupplyResponse } from "@/api/generated/model";
import { attritionWarning } from "@/features/maps/attrition";

interface AttritionWarningProps {
  armyId: string;
  unitId: string;
  /** Its supply, now and by the orders as given. */
  supply?: UnitSupplyResponse;
  /** The attrition its orders as given cost it; missing when they cost none. */
  due?: AttritionDueResponse;
}

/**
 * The unit drawer's attrition warning (decision 0050), for its commander and the Umpire: where it
 * stood as the turn began, what its orders as given cost, and what follows. Red when the orders
 * cost it attrition, orange when it's only at risk; nothing otherwise.
 */
export function AttritionWarning({ armyId, unitId, supply, due }: AttritionWarningProps) {
  const marches = useListMarches(armyId, { query: { meta: { persist: false } } });
  const warning = attritionWarning({
    march: marches.data?.find((m) => m.unitId === unitId),
    supply,
    due,
  });
  if (!warning) return null;

  return (
    <Alert
      color={warning.owes ? "red" : "orange"}
      icon={<IconAlertTriangle aria-hidden />}
      title={warning.title}
    >
      <Stack gap={6}>
        {warning.now && <Text size="sm">{warning.now}</Text>}
        <Text size="sm" fw={warning.owes ? 600 : undefined}>
          {warning.next}
        </Text>
        {warning.consequences.length > 0 && (
          <List size="sm" spacing={4} aria-label="What follows">
            {warning.consequences.map((c) => (
              <List.Item key={c}>{c}</List.Item>
            ))}
          </List>
        )}
      </Stack>
    </Alert>
  );
}
