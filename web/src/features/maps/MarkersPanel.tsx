import { Text } from "@mantine/core";
import type { MarkerResponse } from "@/api/generated/model";
import { Section } from "@/components/Section";
import { MarkerList } from "@/features/maps/MarkerList";

interface MarkersPanelProps {
  markers: readonly MarkerResponse[];
  busy: boolean;
  onEdit: (marker: MarkerResponse) => void;
  onRemove: (marker: MarkerResponse) => void;
}

/**
 * The viewer's own markers (step 80, decision 0054), each a link to its hex. They're added from a
 * hex's drawer.
 */
export function MarkersPanel({ markers, busy, onEdit, onRemove }: MarkersPanelProps) {
  return (
    <Section title="My markers" description="Your own notes on the map. No one else sees them.">
      {markers.length === 0 ? (
        <Text size="sm" c="dimmed">
          None yet. Choose a hex on the map, then Add a marker.
        </Text>
      ) : (
        <MarkerList
          markers={markers}
          label="My markers"
          withHex
          busy={busy}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      )}
    </Section>
  );
}
