import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { ArmySummary, AttritionDueResponse } from "@/api/generated/model";
import { AppProviders } from "@/app/AppProviders";
import { createQueryClient } from "@/app/query-client";
import type { HexConcentration } from "@/features/maps/contact";
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
    isCommanderInChief: false,
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
  concentration?: HexConcentration;
  /** The attrition its orders cost, for whoever follows its moves. */
  due?: AttritionDueResponse;
}

function Harness({
  units,
  sightings = [],
  marches = false,
  screening,
  concentration,
  due,
}: HarnessProps) {
  const [selected, setSelected] = useState<PlacedUnit | null>(null);
  return (
    <HexDrawer
      hex={{ hex: { q: 0, r: 0 }, info }}
      units={units}
      sightings={sightings}
      concentration={concentration && { counted: concentration, note: "By the orders as given." }}
      selected={selected}
      onSelect={setSelected}
      onClose={() => undefined}
      actions={(chosen) => <button type="button">Order {chosen.unit.name}</button>}
      showsMarches={() => marches}
      screeningOf={() => screening}
      attritionOf={() => (marches ? { due } : undefined)}
    />
  );
}

const renderDrawer = (
  units: PlacedUnit[],
  marches = false,
  screening?: { canChange: boolean },
  sightings?: string[],
  concentration?: HexConcentration,
) =>
  render(
    <AppProviders queryClient={createQueryClient()} env="test">
      <Harness
        units={units}
        sightings={sightings}
        marches={marches}
        screening={screening}
        concentration={concentration}
      />
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

  it("totals each side's points against the concentration limits, marking those near or over", async () => {
    const side = { infantryLimit: 100, cavalryLimit: 80, overCavalry: false };
    renderDrawer(stack, false, undefined, undefined, {
      hex: { q: 0, r: 0 },
      contact: true,
      doubled: false,
      infantryLimit: 200,
      cavalryLimit: 160,
      sides: [
        {
          ...side,
          side: army.side,
          infantry: 90,
          cavalry: 0,
          offTheLand: true,
          overInfantry: false,
        },
        {
          ...side,
          infantryLimit: 200,
          cavalryLimit: 160,
          side: { id: "s2", name: "French Empire" },
          infantry: 210,
          cavalry: 20,
          offTheLand: false,
          overInfantry: true,
        },
      ],
    });
    const part = within(
      within(await screen.findByRole("dialog")).getByRole("region", { name: "Concentration" }),
    );

    const coalition = within(part.getByRole("table", { name: "Coalition's concentration" }));
    expect(coalition.getByRole("row", { name: /Infantry/ })).toHaveTextContent(
      "90 of 100 pointsNear the limit",
    );
    expect(coalition.getByRole("row", { name: /Cavalry/ })).toHaveTextContent("0 of 80 points");
    expect(part.getByText("Halved: living off the land.")).toBeInTheDocument();
    const french = within(part.getByRole("table", { name: "French Empire's concentration" }));
    expect(french.getByRole("row", { name: /Infantry/ })).toHaveTextContent(
      "210 of 200 pointsOver the limit",
    );
    expect(part.getByText("By the orders as given.")).toBeInTheDocument();
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

  it("names each unit of a stack by what it shows: its rank, and its hex if not this one", async () => {
    const napoleon = unit("n", "Napoleon", "Commander");
    napoleon.unit.isCommanderInChief = true;
    const away = { ...unit("h", "Hussars", "LightCavalry"), hex: { q: 1, r: 0 } };
    renderDrawer([stack[0], napoleon, away]);
    const units = within(await screen.findByRole("region", { name: "3 units" }));

    expect(units.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Imperial Guard, Line Infantry, Armée du Nord",
      "Napoleon, Commander in Chief, Armée du Nord",
      "Hussars, Light Cavalry, Armée du Nord, Hex (1, 0)",
    ]);
    // What each shows is in its name, as axe checks it (WCAG 2.5.3; jsdom can't lay it out, so
    // axe leaves it undecided): its text run together, without what's hidden from listeners.
    const words = (text: string | null) =>
      (text ?? "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    for (const button of units.getAllByRole("button")) {
      const shown = [...button.querySelectorAll("*")]
        .filter((el) => el.children.length === 0 && !el.closest("[aria-hidden]"))
        .map((el) => el.textContent)
        .join("");
      expect(words(button.getAttribute("aria-label"))).toContain(words(shown));
    }
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

  it("warns what a unit's orders cost in attrition, and what follows", async () => {
    server.use(
      http.get("*/api/armies/a/marches", () =>
        HttpResponse.json([
          {
            unitId: "g",
            movesInRow: 0,
            forceMarchesInRow: 0,
            forcedMarchTurns: 1,
            moveCosts: 1,
            forceMarchCosts: 1,
            orderCosts: 1,
          },
        ]),
      ),
    );
    render(
      <AppProviders queryClient={createQueryClient()} env="test">
        <Harness
          units={stack.slice(0, 1)}
          marches
          due={{
            unitId: "g",
            armyId: "a",
            name: "Imperial Guard",
            fightingFactor: 6,
            points: 30,
            forcedMarchTurns: 2,
            forcedMarchMultiplier: 1,
            unsuppliedTurns: 0,
            multiplier: 1,
            loss: 1,
          }}
        />
      </AppProviders>,
    );

    const warning = (await screen.findByText("Attrition this turn")).closest<HTMLElement>(
      "[role=alert]",
    );
    if (!warning) throw new Error("No attrition warning.");
    expect(
      await within(warning).findByText(
        "As this turn began: force marching, with 1 turn of it to rest off.",
      ),
    ).toBeInTheDocument();
    expect(
      within(warning).getByText(/As the next turn starts, it loses 1 point \(30 → 29\)/),
    ).toBeInTheDocument();
    expect(
      within(within(warning).getByRole("list", { name: "What follows" })).getByText(
        /It must Hold 2 turns to rest off its forced march/,
      ),
    ).toBeInTheDocument();
  });

  it("warns nothing of attrition for a rested unit", async () => {
    renderDrawer(stack.slice(0, 1), true);

    expect(await screen.findByRole("region", { name: "Imperial Guard" })).toBeInTheDocument();
    expect(screen.queryByText(/attrition/i)).not.toBeInTheDocument();
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
