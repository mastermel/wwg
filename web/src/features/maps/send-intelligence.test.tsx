import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { ArmyResponse, ArmySummary, CampaignResponse } from "@/api/generated/model";
import { renderApp } from "@/test/render";
import { server } from "@/test/server";

const campaignId = "0192f5c1-0000-7000-8000-00000000c001";
const coalition = { id: "0192f5c1-0000-7000-8000-00000000f001", name: "Coalition" };
const empire = { id: "0192f5c1-0000-7000-8000-00000000f002", name: "French Empire" };

const army = (id: string, name: string, side: typeof coalition): ArmySummary => ({
  id,
  name,
  side,
  color: "Red",
  nation: "None",
  commander: null,
});
const firstCorps = army("0192f5c1-0000-7000-8000-00000000a001", "First Corps", coalition);
const reserve = army("0192f5c1-0000-7000-8000-00000000a002", "Reserve", coalition);
const nord = army("0192f5c1-0000-7000-8000-00000000a003", "Armée du Nord", empire);

const unit = (id: string, armyId: string, name: string, points: number) => ({
  id,
  armyId,
  name,
  type: "LineInfantry",
  fightingFactor: 5,
  points,
  isCommanderInChief: false,
});
const units = [
  unit("0192f5c1-0000-7000-8000-0000000b0001", firstCorps.id, "Light Division", 20),
  unit("0192f5c1-0000-7000-8000-0000000b0002", reserve.id, "Highlanders", 20),
  unit("0192f5c1-0000-7000-8000-0000000b0003", nord.id, "Old Guard", 30),
  unit("0192f5c1-0000-7000-8000-0000000b0004", nord.id, "Young Guard", 25),
  unit("0192f5c1-0000-7000-8000-0000000b0005", nord.id, "Lancers", 10),
];
const hexes: Partial<Record<string, [number, number]>> = {
  "Light Division": [0, 0],
  Highlanders: [1, 0],
  "Old Guard": [-1, 0],
  "Young Guard": [-1, 0],
  Lancers: [2, 2],
};

/** The Umpire on First Corps' page, turn 2 open; returns what was sent and the positions' turns. */
function serve() {
  const sent: unknown[] = [];
  const positionTurns: (string | null)[] = [];
  server.use(
    http.get(`*/api/campaigns/${campaignId}`, () =>
      HttpResponse.json({
        id: campaignId,
        name: "The Hundred Days",
        description: null,
        umpire: null,
        myRole: "Umpire",
        playerCount: 2,
        createdAt: "2026-09-01T12:00:00Z",
        updatedAt: "2026-09-01T12:00:00Z",
      } satisfies CampaignResponse),
    ),
    http.get(`*/api/armies/${firstCorps.id}`, () =>
      HttpResponse.json({
        ...firstCorps,
        campaignId,
        campaignName: "The Hundred Days",
        factions: [],
        units: [],
        createdAt: "2026-09-01T12:00:00Z",
        updatedAt: "2026-09-01T12:00:00Z",
      } satisfies ArmyResponse),
    ),
    http.get(`*/api/campaigns/${campaignId}/armies`, () =>
      HttpResponse.json([firstCorps, reserve, nord]),
    ),
    http.get(`*/api/campaigns/${campaignId}/turns`, () =>
      HttpResponse.json({ stage: "Running", openTurn: 2, turns: [], startProblems: [] }),
    ),
    http.get(`*/api/campaigns/${campaignId}/units`, () => HttpResponse.json(units)),
    http.get(`*/api/campaigns/${campaignId}/positions`, ({ request }) => {
      positionTurns.push(new URL(request.url).searchParams.get("turn"));
      return HttpResponse.json(
        units.map((u) => ({
          unitId: u.id,
          armyId: u.armyId,
          turn: 1,
          status: "Completed",
          kind: "Hold",
          q: hexes[u.name]?.[0] ?? 0,
          r: hexes[u.name]?.[1] ?? 0,
          latitude: 50.7,
          longitude: 4.4,
          path: [],
          byUmpire: false,
          progress: null,
          forceMarch: false,
          livesOffTheLand: false,
          boats: [],
          carriedBy: null,
        })),
      );
    }),
    http.post(`*/api/armies/${firstCorps.id}/umpire-reports`, async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json({}, { status: 201 });
    }),
  );
  return { sent, positionTurns };
}

describe("the Umpire's intelligence", () => {
  it("sends an army an ally's position and a sighting of the enemy, shaped", async () => {
    const { sent, positionTurns } = serve();
    const user = userEvent.setup();
    await renderApp(`/campaigns/${campaignId}/armies/${firstCorps.id}`);

    await user.click(await screen.findByRole("button", { name: "Send intelligence" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Send intelligence" }));
    // Its own army isn't offered: it knows where its units are.
    expect(dialog.queryByRole("group", { name: "First Corps" })).not.toBeInTheDocument();
    await user.click(await dialog.findByRole("checkbox", { name: "Highlanders, Hex (1, 0)" }));
    await user.click(dialog.getByRole("checkbox", { name: "Old Guard, Hex (−1, 0)" }));
    const sighting = within(dialog.getByRole("group", { name: "Hex (−1, 0)" }));
    expect(sighting.getByText(/Old Guard/)).toBeInTheDocument();
    expect(sighting.queryByText(/Young Guard/)).not.toBeInTheDocument();
    await user.click(sighting.getByRole("checkbox", { name: "Unit types" }));
    await user.type(dialog.getByRole("textbox", { name: "Message" }), "Wellington is at Waterloo.");
    await user.click(dialog.getByRole("button", { name: "Send intelligence" }));

    expect(await screen.findByText("Sent intelligence to First Corps.")).toBeInTheDocument();
    expect(positionTurns).toContain("1");
    expect(sent).toEqual([
      {
        note: "Wellington is at Waterloo.",
        positions: [units[1]?.id],
        sightings: [
          {
            unitIds: [units[2]?.id],
            showsHex: true,
            showsArmies: true,
            showsTypes: false,
            showsAfloat: false,
            strength: "Rough",
            size: "Small",
          },
        ],
      },
    ]);
  });

  it("chooses a whole army at once, one sighting per hex", async () => {
    serve();
    const user = userEvent.setup();
    await renderApp(`/campaigns/${campaignId}/armies/${firstCorps.id}`);

    await user.click(await screen.findByRole("button", { name: "Send intelligence" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Send intelligence" }));
    await user.click(await dialog.findByRole("checkbox", { name: "All of Armée du Nord" }));

    expect(dialog.getByRole("group", { name: "Hex (−1, 0)" })).toHaveTextContent(
      "Old Guard (Line Infantry, 30 points); Young Guard (Line Infantry, 25 points)",
    );
    expect(dialog.getByRole("group", { name: "Hex (2, 2)" })).toBeInTheDocument();
  });

  it("isn't offered while the campaign is being set up", async () => {
    serve();
    server.use(
      http.get(`*/api/campaigns/${campaignId}/turns`, () =>
        HttpResponse.json({ stage: "Setup", openTurn: 0, turns: [], startProblems: [] }),
      ),
    );
    await renderApp(`/campaigns/${campaignId}/armies/${firstCorps.id}`);

    expect(await screen.findByRole("button", { name: "Edit army" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send intelligence" })).not.toBeInTheDocument();
  });
});
