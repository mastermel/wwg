import { Accordion, ActionIcon, Badge, Group, List, Stack, Text } from "@mantine/core";
import { IconHandStop } from "@tabler/icons-react";
import { useState } from "react";
import type { ArmySummary, CourierResponse } from "@/api/generated/model";
import { Section } from "@/components/Section";
import { CancelCourierModal } from "@/features/maps/CancelCourierModal";
import {
  courierCargo,
  courierOutcome,
  courierProgress,
  courierRoute,
} from "@/features/maps/couriers";
import { useOnline } from "@/lib/use-online";

/**
 * Every courier, for the Umpire (steps 49d and 68, decisions 0020 and 0033): those on their way
 * (where each is, how its ride goes, flagged among the enemy, cancelling one with a note), and,
 * folded, those that arrived or were cancelled. Nothing when there's none.
 */
export function CouriersPanel({
  campaignId,
  couriers,
  armies,
}: {
  campaignId: string;
  couriers: readonly CourierResponse[];
  armies: readonly ArmySummary[];
}) {
  const online = useOnline();
  const [cancelling, setCancelling] = useState<CourierResponse | null>(null);
  if (couriers.length === 0) return null;
  const onTheirWay = couriers.filter((c) => c.status === "EnRoute");
  const done = couriers.filter((c) => c.status !== "EnRoute");

  return (
    <Section
      title="Couriers"
      description="Reports between allies, from one Commander in Chief to the other."
    >
      <Stack gap="sm">
        {onTheirWay.length === 0 ? (
          <Text size="sm" c="dimmed">
            None on their way.
          </Text>
        ) : (
          <List size="sm" spacing={8} listStyleType="none" p={0} aria-label="Couriers">
            {onTheirWay.map((courier) => (
              <List.Item key={courier.reportId}>
                <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
                  <Stack gap={2}>
                    <Text size="sm">
                      {courierRoute(courier, armies)}: {courierProgress(courier, armies)}.
                    </Text>
                    <Text size="xs" c="dimmed">
                      {courierOutcome(courier)} {courierCargo(courier)}
                    </Text>
                    {courier.note && (
                      <Text size="xs" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>
                        “{courier.note}”
                      </Text>
                    )}
                  </Stack>
                  <Group gap={4} wrap="nowrap">
                    {courier.amongTheEnemy && (
                      <Badge color="orange" variant="light">
                        Among the enemy
                      </Badge>
                    )}
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Cancel the courier from ${courierRoute(courier, armies)}`}
                      disabled={!online}
                      onClick={() => {
                        setCancelling(courier);
                      }}
                    >
                      <IconHandStop size={16} aria-hidden />
                    </ActionIcon>
                  </Group>
                </Group>
              </List.Item>
            ))}
          </List>
        )}
        {done.length > 0 && (
          <Accordion variant="contained">
            <Accordion.Item value="history">
              <Accordion.Control>
                <Text size="sm">History ({done.length})</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <List
                  size="sm"
                  spacing={8}
                  listStyleType="none"
                  p={0}
                  aria-label="Couriers arrived or cancelled"
                >
                  {done.map((courier) => (
                    <List.Item key={courier.reportId}>
                      <Stack gap={2}>
                        <Group gap="xs" wrap="nowrap">
                          <Text size="sm">{courierRoute(courier, armies)}</Text>
                          <Badge
                            color={courier.status === "Arrived" ? "green" : "red"}
                            variant="light"
                          >
                            {courier.status === "Arrived" ? "Arrived" : "Cancelled"}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {courierOutcome(courier)} {courierCargo(courier)}
                        </Text>
                        {courier.stoppedNote && (
                          <Text size="xs" style={{ whiteSpace: "pre-wrap" }}>
                            Why: {courier.stoppedNote}
                          </Text>
                        )}
                      </Stack>
                    </List.Item>
                  ))}
                </List>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        )}
      </Stack>
      {cancelling && (
        <CancelCourierModal
          campaignId={campaignId}
          courier={cancelling}
          armies={armies}
          onClose={() => {
            setCancelling(null);
          }}
        />
      )}
    </Section>
  );
}
