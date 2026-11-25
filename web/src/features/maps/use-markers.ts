import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListMarkersQueryKey,
  useCreateMarker,
  useDeleteMarker,
  useUpdateMarker,
} from "@/api/generated/endpoints/markers/markers";
import type { MarkerResponse, SaveMarkerRequest } from "@/api/generated/model";
import { errorMessage } from "@/lib/errors";

/**
 * The viewer's changes to their own markers (step 80, decision 0054): each confirms itself, then
 * refreshes their markers. Adding and saving throw on failure, for the form to show; removing
 * says what went wrong, and resolves to whether it worked.
 */
export function useMarkers(campaignId: string) {
  const queryClient = useQueryClient();
  const create = useCreateMarker();
  const update = useUpdateMarker();
  const remove = useDeleteMarker();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getListMarkersQueryKey(campaignId) });

  return {
    busy: create.isPending || update.isPending || remove.isPending,
    create: async (data: SaveMarkerRequest) => {
      try {
        await create.mutateAsync({ id: campaignId, data });
        notifications.show({ color: "green", message: `Added ${data.title}.` });
      } finally {
        await refresh();
      }
    },
    update: async (marker: MarkerResponse, data: SaveMarkerRequest) => {
      try {
        await update.mutateAsync({ id: marker.id, data });
        notifications.show({ color: "green", message: `Saved ${data.title}.` });
      } finally {
        await refresh();
      }
    },
    remove: async (marker: MarkerResponse) => {
      try {
        await remove.mutateAsync({ id: marker.id });
        notifications.show({ color: "green", message: `Removed ${marker.title}.` });
        return true;
      } catch (error) {
        notifications.show({
          color: "red",
          message: errorMessage(error, "The marker couldn't be removed. Try again."),
        });
        return false;
      } finally {
        await refresh();
      }
    },
  };
}
