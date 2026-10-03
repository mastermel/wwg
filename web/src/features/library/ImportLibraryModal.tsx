import { Alert, Badge, Button, Group, Input, List, Modal, Stack, Table, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import {
  useImportLibrary,
  usePreviewLibraryImport,
} from "@/api/generated/endpoints/library/library";
import type { LibraryImportResponse } from "@/api/generated/model";
import { NationFlag } from "@/features/armies/identity/NationFlag";
import { unitCount } from "@/features/library/library-access";
import { errorMessage } from "@/lib/errors";
import { useOnline } from "@/lib/use-online";

/** How many missing units the preview names; the rest are counted. */
const missingListed = 10;

const others = (count: number, listed: number) =>
  count > listed ? `…and ${String(count - listed)} more.` : null;

/** What the file holds, and what importing it does to each faction. */
function PreviewTable({ preview }: { preview: LibraryImportResponse }) {
  return (
    <Table horizontalSpacing="sm" verticalSpacing="xs">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Faction</Table.Th>
          <Table.Th ta="right">New</Table.Th>
          <Table.Th ta="right">Changed</Table.Th>
          <Table.Th ta="right">Unchanged</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {preview.factions.map((faction) => (
          <Table.Tr key={faction.id ?? `new ${faction.name}`}>
            <Table.Td>
              <Group gap="xs" wrap="nowrap">
                <NationFlag nation={faction.nation} plainColor="var(--mantine-color-gray-5)" />
                <span>{faction.name}</span>
                {faction.id === null && (
                  <Badge size="xs" variant="light">
                    New faction
                  </Badge>
                )}
              </Group>
            </Table.Td>
            <Table.Td ta="right">{faction.created}</Table.Td>
            <Table.Td ta="right">{faction.updated}</Table.Td>
            <Table.Td ta="right">{faction.unchanged}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

/**
 * Imports the club's unit library from its CSV (decision 0025): the chosen file is previewed
 * (each faction, matched by name or new, with its units to add and change; imported units the file
 * no longer has; rows it can't take), then imported, all or nothing. Mount it only while open.
 */
export function ImportLibraryModal({ onClose }: { onClose: () => void }) {
  const online = useOnline();
  const fileId = useId();
  const queryClient = useQueryClient();
  const previewImport = usePreviewLibraryImport();
  const runImport = useImportLibrary();
  const [csv, setCsv] = useState<string | null>(null);
  const [preview, setPreview] = useState<LibraryImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (file: File | undefined) => {
    setPreview(null);
    setError(null);
    setCsv(null);
    if (!file) return;
    try {
      const text = await file.text();
      setPreview(await previewImport.mutateAsync({ data: { csv: text } }));
      setCsv(text);
    } catch (failure) {
      setError(
        errorMessage(failure, "The file couldn't be read. Check it's the CSV, and try again."),
      );
    }
  };

  const confirm = async () => {
    if (csv === null) return;
    setError(null);
    try {
      const done = await runImport.mutateAsync({ data: { csv } });
      const created = done.factions.reduce((sum, f) => sum + f.created, 0);
      const updated = done.factions.reduce((sum, f) => sum + f.updated, 0);
      notifications.show({
        color: "green",
        message: `Imported the library: ${unitCount(created)} added, ${String(updated)} changed.`,
      });
      // Every faction's page may have changed, as well as the list.
      await queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0]).startsWith("/api/factions"),
      });
      onClose();
    } catch (failure) {
      setError(errorMessage(failure, "The library wasn't imported. Try again."));
    }
  };

  const ready = preview !== null && preview.errorCount === 0 && preview.unitCount > 0;

  return (
    <Modal opened onClose={onClose} title="Import the library" centered size="lg">
      <Stack>
        <Text size="sm">
          Choose the club&apos;s library CSV (made from the workbook by{" "}
          <code>scripts/library_csv.py</code>). Each nation fills the faction of that name, or a new
          one; units it imported before are updated, and units entered by hand are left as they are.
          Campaigns keep their own copies.
        </Text>
        <Input.Wrapper label="CSV file" labelElement="label" id={fileId}>
          <input
            id={fileId}
            type="file"
            accept=".csv,text/csv"
            disabled={!online || runImport.isPending}
            onChange={(event) => void choose(event.currentTarget.files?.[0])}
          />
        </Input.Wrapper>
        {previewImport.isPending && <Text size="sm">Reading the file…</Text>}
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        {preview && preview.errorCount > 0 && (
          <Alert color="red" role="alert" title="This file can't be imported">
            <List size="sm">
              {preview.errors.map((e) => (
                <List.Item key={`${String(e.row)} ${e.column ?? ""}`}>
                  {e.row > 0 && `Row ${String(e.row)}${e.column ? `, ${e.column}` : ""}: `}
                  {e.message}
                </List.Item>
              ))}
            </List>
            {others(preview.errorCount, preview.errors.length)}
          </Alert>
        )}
        {preview?.errorCount === 0 && (
          <>
            <Text size="sm">
              {unitCount(preview.unitCount)} in {String(preview.factions.length)}{" "}
              {preview.factions.length === 1 ? "faction" : "factions"}.
            </Text>
            <PreviewTable preview={preview} />
          </>
        )}
        {preview && preview.missing.length > 0 && (
          <Alert role="status" title="Not in this file">
            <Text size="sm">
              {unitCount(preview.missing.length)} imported before{" "}
              {preview.missing.length === 1 ? "isn't" : "aren't"} in this file. The library keeps
              them: delete any you no longer want from their faction.
            </Text>
            <List size="sm">
              {preview.missing.slice(0, missingListed).map((unit) => (
                <List.Item key={unit.id}>{unit.name}</List.Item>
              ))}
            </List>
            {others(preview.missing.length, missingListed)}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void confirm()}
            loading={runImport.isPending}
            disabled={!online || !ready}
          >
            Import
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
