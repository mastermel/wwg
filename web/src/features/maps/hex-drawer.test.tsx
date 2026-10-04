import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { ArmySummary } from "@/api/generated/model";
import { AppProviders } from "@/app/AppProviders";
import { createQueryClient } from "@/app/query-client";
import type { PlacedUnit } from "@/features/maps/stacks";
import { HexDrawer } from "@/features/maps/HexDrawer";
import { server } from "@/test/server";

const army: ArmySummary = {
  id: "a",
  name: "Armée du Nord",
  commander: null,
  side: { id: "0192f5c1-0000-7000-8000-00000000f001", name: "Coalition" },
  color: "Blue",
  nation: "France",
};

const unit = (id: string, name: string, type: PlacedUnit["unit"]["type"]): PlacedUnit => ({
  unit: {
    id,
    armyId: "a",
    unitId: "l",
    factionId: "f",
    nation: "France",
    name,
    type,
    fightingFactor: 6,
    points: 30,
    division: null,
    brigade: null,
    corps: null,
    corpsCommander: null,
    divisionCommander: null,
    brigadeCommander: null,
    importOrder: null,
  },
  army,
  hex: { q: 0, r: 0 },
  latitude: 50.7,
  longitude: 4.4,
});

const stack = [
  unit("g", "Imperial Guard", "LineInfantry"),
  unit("r", "Reserve Artillery", "FootArtillery"),
];

const info = {
  title: "Hex (0, 0), Wavre",
  summary: "Low hills",
  lines: ["Low hills.", "Wavre: Walled town."],
};

interface HarnessProps {
  units: PlacedUnit[];
  sightings?: string[];
  marches?: boolean;
  screening?: { canChange: boolean };
}

function Harness({ units, sightings = [], marches = false, screening }: HarnessProps) {
  const [selected, setSelected] = useState<PlacedUnit | null>(null);
  return (
    <HexDrawer
      hex={{ hex: { q: 0, r: 0 }, info }}
      units={units}
      sightings={sightings}
      selected={selected}
      onSelect={setSelected}
      onClose={() => undefined}
      actions={(chosen) => <button type="button">Order {chosen.unit.name}</button>}
      showsMarches={() => marches}
      screeningOf={() => screening}
    />
  );
}

const renderDrawer = (
  units: PlacedUnit[],
  marches = false,
  screening?: { canChange: boolean },
  sightings?: string[],
) =>
  render(
    <AppProviders queryClient={createQueryClient()}>
      <Harness units={units} sightings={sightings} marches={marches} screening={screening} />
    </AppProviders>,
  );

const hussars = [unit("h", "Hussars", "LightCavalry")];

describe("the hex drawer", () => {
  it("shows the hex's units, then what was sighted there, then its terrain", async () => {
    renderDrawer(stack.slice(0, 1), false, undefined, ["Prussian I Corps: a small force."]);
    const dialog = within(await screen.findByRole("dialog", { name: "Hex (0, 0), Wavre" }));

    expect(dialog.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Imperial Guard",
      "Sightings",
      "Terrain",
    ]);
    expect(
      within(dialog.getByRole("region", { name: "Sightings" })).getByText(
        "Prussian I Corps: a small force.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog.getByRole("region", { name: "Terrain" })).getByText("Wavre: Walled town."),
    ).toBeInTheDocument();
  });

  it("shows only the terrain of an empty hex", async () => {
    renderDrawer([]);
    const dialog = within(await screen.findByRole("dialog", { name: "Hex (0, 0), Wavre" }));

    expect(dialog.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Terrain",
    ]);
  });

  it("lists a stack's units, shows the one chosen with what can be done, and goes back", async () => {
    renderDrawer(stack);
    const units = within(await screen.findByRole("region", { name: "2 units" }));

    await userEvent.click(
      units.getByRole("button", { name: "Reserve Artillery, Foot Artillery, Armée du Nord" }),
    );

    expect(await screen.findByRole("region", { name: "Reserve Artillery" })).toBeInTheDocument();
    expect(screen.getByText("Foot Artillery")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Order Reserve Artillery" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "All 2 units here" }));

    expect(await screen.findByRole("region", { name: "2 units" })).toBeInTheDocument();
  });

  it("shows a single unit straight away", async () => {
    renderDrawer(stack.slice(0, 1));

    expect(await screen.findByRole("region", { name: "Imperial Guard" })).toBeInTheDocument();
    expect(screen.getByText("Armée du Nord")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /units here/ })).not.toBeInTheDocument();
  });

  it("shows its points history, and its forced marches to whoever follows its moves", async () => {
    server.use(
      http.get("*/api/army-units/g/points", () =>
        HttpResponse.json([
          {
            turn: 4,
            change: -3,
            pointsAfter: 27,
            reason: "Attrition",
            note: "Forced march",
            byName: "Ada Tester",
            at: "2026-09-04T12:00:00Z",
          },
          {
            turn: 5,
            change: 2,
            pointsAfter: 29,
            reason: "Edited",
            note: null,
            byName: "Ada Tester",
            at: "2026-09-05T12:00:00Z",
          },
        ]),
      ),
      http.get("*/api/armies/a/marches", () =>
        HttpResponse.json([
          {
            unitId: "g",
            movesInRow: 0,
            forceMarchesInRow: 0,
            forcedMarchTurns: 2,
            moveCosts: 2,
            forceMarchCosts: 2,
            orderCosts: 0,
          },
        ]),
      ),
    );
    renderDrawer(stack.slice(0, 1), true);

    const history = await screen.findByRole("list", { name: "Points history" });
    expect(
      within(history)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Turn 4: −3, to 27. Forced march.", "Turn 5: +2, to 29. Changed by Ada Tester."]);
    expect(
      await screen.findByText("Force marching: 2 turns to rest off (a Hold each)."),
    ).toBeInTheDocument();
  });

  it("keeps a unit's forced marches from whoever doesn't follow its moves", async () => {
    renderDrawer(stack.slice(0, 1));

    expect(await screen.findByRole("region", { name: "Imperial Guard" })).toBeInTheDocument();
    expect(screen.queryByText("Marches")).not.toBeInTheDocument();
  });

  it("turns a unit's screening on, for whoever commands it, with the turns it screened", async () => {
    let saved: unknown;
    server.use(
      http.get("*/api/army-units/h/screening", () =>
        HttpResponse.json({ canScreen: true, screening: false, turns: [1, 2, 3, 5] }),
      ),
      http.put("*/api/army-units/h/screening", async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ canScreen: true, screening: true, turns: [1, 2, 3, 5] });
      }),
    );
    renderDrawer(hussars, false, { canChange: true });

    expect(await screen.findByText("Screened: Turns 1–3 and 5.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: /Screening/ }));

    expect(await screen.findByText("Hussars is screening.")).toBeInTheDocument();
    expect(saved).toEqual({ screening: true });
    expect(screen.getByRole("switch", { name: /Screening/ })).toBeChecked();
  });

  it("shows screening without changing it on a past turn's map", async () => {
    server.use(
      http.get("*/api/army-units/h/screening", () =>
        HttpResponse.json({ canScreen: true, screening: true, turns: [] }),
      ),
    );
    renderDrawer(hussars, false, { canChange: false });

    expect(await screen.findByRole("switch", { name: /Screening/ })).toBeDisabled();
    expect(screen.getByText("Hasn't screened at the end of a turn yet.")).toBeInTheDocument();
  });

  it("keeps a unit's screening from whoever doesn't command it", async () => {
    renderDrawer(hussars);

    expect(await screen.findByRole("region", { name: "Hussars" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /Screening/ })).not.toBeInTheDocument();
  });
});
