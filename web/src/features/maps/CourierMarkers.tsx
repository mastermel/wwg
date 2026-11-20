import { Badge, Button, Popover, Stack, Text } from "@mantine/core";
import { IconHorse } from "@tabler/icons-react";
import { useState } from "react";
import { Marker } from "react-map-gl/maplibre";
import type { ArmySummary, CourierResponse } from "@/api/generated/model";
import { armyColors } from "@/features/armies/identity/army-colors";
import { CancelCourierModal } from "@/features/maps/CancelCourierModal";
import classes from "@/features/maps/CourierMarkers.module.css";
import {
  courierCargo,
  courierOutcome,
  courierProgress,
  courierRoute,
} from "@/features/maps/couriers";
import { useOnline } from "@/lib/use-online";

/**
 * The couriers on their way, on the Umpire's map inside a CampaignMap (step 68d, decision 0033):
 * a horse in the sender's colour, ringed among the enemy; its popover says who sent it to whom,
 * how its ride goes and what it carries, and cancels it.
 */
export function CourierMarkers({
  campaignId,
  couriers,
  armies,
}: {
  campaignId: string;
  couriers: readonly CourierResponse[];
  armies: readonly ArmySummary[];
}) {
  const online = useOnline();
  const [open, setOpen] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<CourierResponse | null>(null);

  return (
    <>
      {couriers
        .filter((c) => c.status === "EnRoute")
        .map((courier) => {
          const army = armies.find((a) => a.id === courier.fromArmyId);
          const route = courierRoute(courier, armies);
          return (
            <Marker
              key={courier.reportId}
              longitude={courier.longitude}
              latitude={courier.latitude}
              anchor="center"
              offset={[18, -18]}
            >
              <Popover
                opened={open === courier.reportId}
                onChange={(opened) => {
                  setOpen(opened ? courier.reportId : null);
                }}
                width={280}
                position="top"
                withArrow
                shadow="md"
              >
                <Popover.Target>
                  <button
                    type="button"
                    className={classes.courier}
                    data-among-the-enemy={courier.amongTheEnemy}
                    // The tile is white in both schemes: the light colours are the ones checked against it.
                    style={{ borderColor: army ? armyColors[army.color].light : undefined }}
                    aria-label={`Courier from ${route}`}
                    onClick={(event) => {
                      // Not a click on the map's hex beneath.
                      event.stopPropagation();
                      setOpen(open === courier.reportId ? null : courier.reportId);
                    }}
                  >
                    <IconHorse size={16} aria-hidden />
                  </button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Stack gap={4}>
                    <Text size="sm" fw={600}>
                      Courier from {route}
                    </Text>
                    <Text size="sm">{courierProgress(courier, armies)}.</Text>
                    <Text size="xs" c="dimmed">
                      {courierOutcome(courier)} {courierCargo(courier)}
                    </Text>
                    {courier.note && (
                      <Text size="xs" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>
                        “{courier.note}”
                      </Text>
                    )}
                    {courier.amongTheEnemy && (
                      <Badge color="orange" variant="light">
                        Among the enemy
                      </Badge>
                    )}
                    <Button
                      size="compact-sm"
                      color="red"
                      variant="light"
                      mt={4}
                      disabled={!online}
                      onClick={() => {
                        setOpen(null);
                        setCancelling(courier);
                      }}
                    >
                      Cancel the courier
                    </Button>
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            </Marker>
          );
        })}
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
    </>
  );
}
