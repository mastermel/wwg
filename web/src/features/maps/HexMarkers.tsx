import { Button, Stack } from "@mantine/core";
import { IconMapPinPlus } from "@tabler/icons-react";
import type { MarkerResponse } from "@/api/generated/model";
import { MarkerList } from "@/features/maps/MarkerList";
import { useOnline } from "@/lib/use-online";

interface HexMarkersProps {
  /** The viewer's markers in the hex. */
  markers: readonly MarkerResponse[];
  busy: boolean;
  onAdd: () => void;
  onEdit: (marker: MarkerResponse) => void;
  onRemove: (marker: MarkerResponse) => void;
}

/** A hex's drawer's **My markers** (step 80, decision 0054): the viewer's there, and adding one. */
export function HexMarkers({ markers, busy, onAdd, onEdit, onRemove }: HexMarkersProps) {
  const online = useOnline();
  return (
    <Stack gap="xs">
      {markers.length > 0 && (
        <MarkerList
          markers={markers}
          label="My markers here"
          busy={busy}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      )}
      <Button
        variant="default"
        size="compact-sm"
        leftSection={<IconMapPinPlus size={16} aria-hidden />}
        style={{ alignSelf: "flex-start" }}
        disabled={!online || busy}
        onClick={onAdd}
      >
        Add a marker
      </Button>
    </Stack>
  );
}
