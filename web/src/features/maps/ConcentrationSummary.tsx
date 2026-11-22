import { Badge, Group, Stack, Table, Text } from "@mantine/core";
import { standing, type HexConcentration } from "@/features/maps/contact";

interface ConcentrationSummaryProps {
  /** What's counted in the hex. */
  counted: HexConcentration;
  /** Whose positions it's from, in words ("By the orders as given."). */
  note: string;
}

const marks = {
  over: { color: "red", label: "Over the limit" },
  near: { color: "orange", label: "Near the limit" },
} as const;

/**
 * Each side's counted points in a hex against its limits (step 46, decision 0017), in the hex's
 * drawer: so a commander sees a hex filling up before it's over, as well as once it is.
 */
export function ConcentrationSummary({ counted, note }: ConcentrationSummaryProps) {
  const named = counted.sides.length > 1;
  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed">
        {note}
      </Text>
      {counted.sides.map((side) => {
        const why = [
          counted.doubled ? "Doubled here: a city or a fortress." : null,
          side.offTheLand ? "Halved: living off the land." : null,
        ].filter(Boolean);
        return (
          <Stack key={side.side.id} gap={4}>
            {named && (
              <Text size="sm" fw={600}>
                {side.side.name}
              </Text>
            )}
            <Table
              variant="vertical"
              layout="fixed"
              withTableBorder
              aria-label={named ? `${side.side.name}'s concentration` : "Concentration"}
            >
              <Table.Tbody>
                {(
                  [
                    ["Infantry", side.infantry, side.infantryLimit],
                    ["Cavalry", side.cavalry, side.cavalryLimit],
                  ] as const
                ).map(([kind, points, limit]) => {
                  const mark = standing(points, limit);
                  return (
                    <Table.Tr key={kind}>
                      <Table.Th w={100}>{kind}</Table.Th>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap" justify="space-between">
                          <Text size="sm">
                            {points} of {limit} points
                          </Text>
                          {mark !== "within" && (
                            <Badge color={marks[mark].color} variant="light">
                              {marks[mark].label}
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
            {why.length > 0 && (
              <Text size="xs" c="dimmed">
                {why.join(" ")}
              </Text>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}
