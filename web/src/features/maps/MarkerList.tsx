import { ActionIcon, Group, List, Stack, Text } from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import type { MarkerResponse } from "@/api/generated/model";
import { HexLink } from "@/features/maps/HexLink";
import { useOnline } from "@/lib/use-online";

interface MarkerListProps {
  markers: readonly MarkerResponse[];
  /** What the list is, for screen readers. */
  label: string;
  /** Whether each names its hex, as a link to it (the panel's, not a hex's own drawer). */
  withHex?: boolean;
  busy: boolean;
  onEdit: (marker: MarkerResponse) => void;
  onRemove: (marker: MarkerResponse) => void;
}

/** The viewer's own markers (step 80, decision 0054), each with its description, to edit or remove. */
export function MarkerList({
  markers,
  label,
  withHex = false,
  busy,
  onEdit,
  onRemove,
}: MarkerListProps) {
  const online = useOnline();
  return (
    <List size="sm" spacing={6} listStyleType="none" p={0} aria-label={label}>
      {markers.map((marker) => (
        <List.Item key={marker.id} styles={{ itemWrapper: { width: "100%" } }}>
          <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
            <Stack gap={0} miw={0}>
              <Text size="sm" fw={500} style={{ overflowWrap: "anywhere" }}>
                {marker.title}
                {withHex && (
                  <Text span size="xs" c="dimmed" fw={400}>
                    {" "}
                    · <HexLink hex={marker} />
                  </Text>
                )}
              </Text>
              {marker.description && (
                <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>
                  {marker.description}
                </Text>
              )}
            </Stack>
            <Group gap={4} wrap="nowrap">
              <ActionIcon
                variant="subtle"
                aria-label={`Edit ${marker.title}`}
                disabled={!online || busy}
                onClick={() => {
                  onEdit(marker);
                }}
              >
                <IconPencil size={16} aria-hidden />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Remove ${marker.title}`}
                disabled={!online || busy}
                onClick={() => {
                  onRemove(marker);
                }}
              >
                <IconTrash size={16} aria-hidden />
              </ActionIcon>
            </Group>
          </Group>
        </List.Item>
      ))}
    </List>
  );
}
