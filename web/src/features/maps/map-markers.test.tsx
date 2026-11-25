import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type {
  CampaignMapResponse,
  CampaignResponse,
  HexCellResponse,
  MarkerResponse,
} from "@/api/generated/model";
import { noSettlement } from "@/features/maps/terrain";
import { renderApp } from "@/test/render";
import { server } from "@/test/server";

// MapLibre needs WebGL, which jsdom lacks: a stand-in whose button clicks the hex at (0, 0).
vi.mock("@/features/maps/CampaignMap", () => ({
  CampaignMap: ({
    onMapClick,
  }: {
    onMapClick?: (point: { longitude: number; latitude: number }) => void;
  }) => (
    <div role="application" aria-label="Campaign map">
      <button type="button" onClick={() => onMapClick?.({ longitude: 4.45, latitude: 50.675 })}>
        Click the map
      </button>
    </div>
  ),
}));

const campaignId = "0192f5c1-0000-7000-8000-00000000c001";
const ford: MarkerResponse = {
  id: "0192f5c1-0000-7000-8000-00000000e101",
  title: "Ford",
  description: "Hold it by turn 3.",
  q: 0,
  r: 0,
  latitude: 50.675,
  longitude: 4.45,
};
const wavre: HexCellResponse = {
  q: 0,
  r: 0,
  terrain: "Flat",
  forest: false,
  settlement: { ...noSettlement, size: "Town", name: "Wavre" },
  setByUmpire: true,
};

function serve(markers: MarkerResponse[], cells: HexCellResponse[] = []) {
  const requests: { method: string; url: string; body: unknown }[] = [];
  const record = async (request: Request) => {
    const text = await request.text();
    requests.push({
      method: request.method,
      url: new URL(request.url).pathname,
      body: text ? (JSON.parse(text) as unknown) : null,
    });
  };
  server.use(
    http.get(`*/api/campaigns/${campaignId}`, () =>
      HttpResponse.json({
        id: campaignId,
        name: "The Hundred Days",
        description: null,
        umpire: null,
        myRole: "Player",
        playerCount: 1,
        createdAt: "2026-09-01T12:00:00Z",
        updatedAt: "2026-09-01T12:00:00Z",
      } satisfies CampaignResponse),
    ),
    http.get(`*/api/campaigns/${campaignId}/map`, () =>
      HttpResponse.json({
        bounds: { west: 4.2, south: 50.55, east: 4.7, north: 50.8 },
        labelLanguage: "en",
        distanceUnit: "Kilometres",
        layers: {
          roads: true,
          places: true,
          water: true,
          forests: true,
          hills: true,
          contours: false,
          grid: true,
        },
        hexSize: 4828,
      } satisfies CampaignMapResponse),
    ),
    http.get(`*/api/campaigns/${campaignId}/grid`, () => HttpResponse.json({ cells, edges: [] })),
    http.get(`*/api/campaigns/${campaignId}/markers`, () => HttpResponse.json(markers)),
    http.post(`*/api/campaigns/${campaignId}/markers`, async ({ request }) => {
      await record(request);
      return HttpResponse.json(ford, { status: 201 });
    }),
    http.put(`*/api/markers/${ford.id}`, async ({ request }) => {
      await record(request);
      return HttpResponse.json(ford);
    }),
    http.delete(`*/api/markers/${ford.id}`, async ({ request }) => {
      await record(request);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return requests;
}

async function openHex() {
  const user = userEvent.setup();
  await renderApp(`/campaigns/${campaignId}/map`);
  await user.click(await screen.findByRole("button", { name: "Click the map" }));
  const drawer = within(await screen.findByRole("dialog", { name: /^Hex \(0, 0\)/ }));
  return { user, drawer };
}

describe("markers", () => {
  it("adds one from a hex's drawer, titled for the hex's town", async () => {
    const requests = serve([], [wavre]);
    const { user, drawer } = await openHex();

    await user.click(drawer.getByRole("button", { name: "Add a marker" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Add a marker" }));
    expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue("Wavre");
    await user.type(dialog.getByRole("textbox", { name: "Description" }), "  Their depot?  ");
    expect(dialog.getByText(/of 200 characters/)).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Add marker" }));

    expect(await screen.findByText("Added Wavre.")).toBeInTheDocument();
    expect(requests).toEqual([
      {
        method: "POST",
        url: `/api/campaigns/${campaignId}/markers`,
        body: { title: "Wavre", description: "Their depot?", q: 0, r: 0 },
      },
    ]);
  });

  it("starts untitled in a hex with no name, and needs a title", async () => {
    const requests = serve([]);
    const { user, drawer } = await openHex();

    await user.click(drawer.getByRole("button", { name: "Add a marker" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Add a marker" }));
    expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue("");
    await user.click(dialog.getByRole("button", { name: "Add marker" }));

    expect(dialog.getByRole("textbox", { name: "Title" })).toBeInvalid();
    expect(requests).toEqual([]);
  });

  it("shows the hex's own markers in its drawer", async () => {
    serve([ford]);
    const { drawer } = await openHex();

    const list = drawer.getByRole("list", { name: "My markers here" });
    expect(list).toHaveTextContent("Ford");
    expect(list).toHaveTextContent("Hold it by turn 3.");
  });

  it("lists them in My markers, to edit and remove", async () => {
    const requests = serve([ford]);
    const user = userEvent.setup();
    await renderApp(`/campaigns/${campaignId}/map`);

    const panel = await screen.findByRole("region", { name: "My markers" });
    const list = await within(panel).findByRole("list", { name: "My markers" });
    expect(list).toHaveTextContent("Ford · Hex (0, 0)");
    await user.click(within(list).getByRole("button", { name: "Edit Ford" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Edit Ford" }));
    expect(dialog.getByRole("textbox", { name: "Description" })).toHaveValue("Hold it by turn 3.");
    await user.clear(dialog.getByRole("textbox", { name: "Title" }));
    await user.type(dialog.getByRole("textbox", { name: "Title" }), "Ford at Limale");
    await user.clear(dialog.getByRole("textbox", { name: "Description" }));
    await user.click(dialog.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved Ford at Limale.")).toBeInTheDocument();

    await user.click(within(list).getByRole("button", { name: "Remove Ford" }));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Remove Ford?" })).getByRole("button", {
        name: "Remove marker",
      }),
    );

    expect(await screen.findByText("Removed Ford.")).toBeInTheDocument();
    expect(requests).toEqual([
      {
        method: "PUT",
        url: `/api/markers/${ford.id}`,
        body: { title: "Ford at Limale", description: null, q: 0, r: 0 },
      },
      { method: "DELETE", url: `/api/markers/${ford.id}`, body: null },
    ]);
  });

  it("says how to add one while there are none", async () => {
    serve([]);
    await renderApp(`/campaigns/${campaignId}/map`);

    const panel = await screen.findByRole("region", { name: "My markers" });
    expect(panel).toHaveTextContent("None yet. Choose a hex on the map, then Add a marker.");
  });
});
