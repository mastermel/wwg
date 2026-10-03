import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type {
  FactionSummary,
  ImportLibraryRequest,
  LibraryImportResponse,
} from "@/api/generated/model";
import { expectNoAxeViolations, renderApp } from "@/test/render";
import { server } from "@/test/server";
import { testUser } from "@/test/session";

const manager = { ...testUser, isManager: true };
const britishId = "0192f5c1-0000-7000-8000-0000000fac02";
const csv =
  "key,nation,flag,unit,type,ff,points\nBritish | 1st Foot Guards,British,Britain,1st Foot Guards,LineInfantry,8,44\n";

const preview: LibraryImportResponse = {
  unitCount: 1077,
  factions: [
    { id: britishId, name: "British", nation: "Britain", created: 2, updated: 1, unchanged: 199 },
    { id: null, name: "US", nation: "UnitedStates", created: 35, updated: 0, unchanged: 0 },
  ],
  missing: [],
  errors: [],
  errorCount: 0,
};

/** The library's list, and the import's two endpoints; returns the CSV each was sent. */
function serveImport(answer: LibraryImportResponse = preview) {
  const sent: { previewed: string[]; imported: string[] } = { previewed: [], imported: [] };
  let factions: FactionSummary[] = [];
  server.use(
    http.get("*/api/factions", () => HttpResponse.json(factions)),
    http.post("*/api/library/import/preview", async ({ request }) => {
      sent.previewed.push(((await request.json()) as ImportLibraryRequest).csv);
      return HttpResponse.json(answer);
    }),
    http.post("*/api/library/import", async ({ request }) => {
      sent.imported.push(((await request.json()) as ImportLibraryRequest).csv);
      factions = [{ id: britishId, name: "British", nation: "Britain", unitCount: 202 }];
      return HttpResponse.json(answer);
    }),
  );
  return sent;
}

async function chooseFile(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Import" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Import the library" }));
  await user.upload(
    dialog.getByLabelText("CSV file"),
    new File([csv], "complete_library.csv", { type: "text/csv" }),
  );
  return dialog;
}

describe("importing the library", () => {
  it("previews the club's CSV, then imports it", async () => {
    const sent = serveImport();
    const user = userEvent.setup();
    const { container } = await renderApp("/library", { user: manager });

    const dialog = await chooseFile(user);

    expect(await dialog.findByText("1077 units in 2 factions.")).toBeInTheDocument();
    const rows = dialog
      .getAllByRole("row")
      .slice(1)
      .map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent));
    expect(rows).toEqual([
      ["British", "2", "1", "199"],
      ["USNew faction", "35", "0", "0"],
    ]);
    expect(sent).toEqual({ previewed: [csv], imported: [] });

    await user.click(dialog.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText("Imported the library: 37 units added, 1 changed."),
    ).toBeInTheDocument();
    expect(sent.imported).toEqual([csv]);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("link", { name: "British" })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("lists the rows a file can't take, and won't import it", async () => {
    const sent = serveImport({
      ...preview,
      errors: [
        { row: 3, column: "ff", message: "It must be a whole number from 1 to 9." },
        { row: 1, column: "points", message: 'The file has no "points" column.' },
      ],
      errorCount: 60,
    });
    const user = userEvent.setup();
    await renderApp("/library", { user: manager });

    const dialog = await chooseFile(user);

    const alert = within(await dialog.findByRole("alert"));
    expect(alert.getByText("This file can't be imported")).toBeInTheDocument();
    expect(
      alert.getByText("Row 3, ff: It must be a whole number from 1 to 9."),
    ).toBeInTheDocument();
    expect(alert.getByText("…and 58 more.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Import" })).toBeDisabled();
    expect(sent.imported).toEqual([]);
  });

  it("names the units imported before that the file no longer has", async () => {
    serveImport({
      ...preview,
      missing: [
        {
          id: "0192f5c1-0000-7000-8000-0000000u0009",
          factionId: britishId,
          name: "Old Militia",
          key: "x",
        },
      ],
    });
    const user = userEvent.setup();
    await renderApp("/library", { user: manager });

    const dialog = await chooseFile(user);

    const status = within(await dialog.findByRole("status"));
    expect(status.getByText(/1 unit imported before isn't in this file/)).toBeInTheDocument();
    expect(status.getByText("Old Militia")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Import" })).toBeEnabled();
  });

  it("isn't offered to everyone", async () => {
    serveImport();
    await renderApp("/library");

    expect(await screen.findByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import" })).not.toBeInTheDocument();
  });
});
