import { ActionIcon, Autocomplete, Loader, Popover } from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useState } from "react";
import { useSearchTowns } from "@/api/generated/endpoints/maps/maps";
import type { HexCellResponse } from "@/api/generated/model";
import { hexName, type Hex } from "@/features/maps/hex-grid";
import { errorMessage } from "@/lib/errors";

interface TownSearchProps {
  campaignId: string;
  /** The grid's cells, for the game's own named settlements. */
  cells: readonly HexCellResponse[];
  /** Shows the chosen town's hex. */
  onChoose: (hex: Hex) => void;
}

// Matches ignore case and accents, so "liege" finds Liège.
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Finds a town on the map (decision 0046), from a button over the map: the game's own named
 * towns, cities and fortresses, then the real world's towns and villages in the campaign's area
 * (the API's town search). Choosing one shows its hex.
 */
export function TownSearch({ campaignId, cells, onChoose }: TownSearchProps) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const [text, setText] = useState("");
  const [search] = useDebouncedValue(text.trim(), 400);
  const enough = search.length >= 2;
  const towns = useSearchTowns(
    campaignId,
    { search },
    // Live answers, never saved; only once there's enough to search for.
    { query: { enabled: enough, meta: { persist: false }, staleTime: 60_000 } },
  );

  // Each option's text is unique, and leads to its hex.
  const hexes = new Map<string, Hex>();
  const game: string[] = [];
  const typed = fold(text.trim());
  if (typed.length >= 2) {
    for (const cell of cells) {
      const name = cell.settlement.name;
      if (!name || !fold(name).includes(typed)) continue;
      const option = `${name}, ${hexName(cell)}`;
      if (hexes.has(option)) continue;
      hexes.set(option, { q: cell.q, r: cell.r });
      game.push(option);
    }
    game.sort((a, b) => a.localeCompare(b));
  }
  const places: string[] = [];
  for (const town of enough ? (towns.data ?? []) : []) {
    if (hexes.has(town.description)) continue;
    hexes.set(town.description, { q: town.q, r: town.r });
    places.push(town.description);
  }
  const data = [
    ...(game.length > 0 ? [{ group: "On the game map", items: game }] : []),
    ...(places.length > 0 ? [{ group: "Places", items: places }] : []),
  ];
  const nothing = enough && !towns.isFetching && towns.isSuccess && data.length === 0;

  return (
    <Popover
      opened={opened}
      onChange={(open) => {
        if (!open) close();
      }}
      position="bottom-start"
      trapFocus
    >
      <Popover.Target>
        <ActionIcon
          variant="default"
          size="lg"
          aria-label="Find a town"
          aria-expanded={opened}
          onClick={toggle}
        >
          <IconSearch size={18} aria-hidden />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown w={320} maw="calc(100vw - 2rem)">
        <Autocomplete
          label="Find a town"
          placeholder="Waterloo"
          data-autofocus
          leftSection={<IconSearch size={16} aria-hidden />}
          rightSection={towns.isFetching ? <Loader size="xs" /> : null}
          value={text}
          onChange={setText}
          data={data}
          // Already matched; don't filter again.
          filter={({ options }) => options}
          onOptionSubmit={(option) => {
            const hex = hexes.get(option);
            if (!hex) return;
            close();
            setText("");
            onChoose(hex);
          }}
          description={nothing ? "No town by that name on the map." : undefined}
          error={towns.isError ? errorMessage(towns.error, "Town search didn't work.") : undefined}
          comboboxProps={{ withinPortal: false }}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
