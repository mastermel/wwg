import { scan } from "./support/axe.ts";
import { desktopOnly, expect, test } from "./support/fixtures.ts";
import { latestEmailText } from "./support/mailpit.ts";
import { apiAs } from "./support/api.ts";
import { clickMapCentre, clickMapPart } from "./support/map.ts";
import {
  approveAndStartNext,
  giveOrders,
  holdAndSubmit,
  startedCampaign,
} from "./support/turns.ts";
import { browserOf, libraryFaction } from "./support/library.ts";

test("a commander moves one unit, holds another and submits the turn", async ({ signUp }) => {
  test.slow();
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  const { campaignUrl } = await startedCampaign(umpire, commander, "Ligny 1815");

  const page = commander.page;
  await page.goto(`${campaignUrl}/map`);
  const panel = page.getByRole("region", { name: "Turn 1" });
  await expect(panel.getByRole("button", { name: "Submit turn 1" })).toBeDisabled();

  // Move: choose the unit on the map, then Move, then a point inside its range, then Confirm.
  await page.getByRole("button", { name: "Imperial Guard, Line Infantry, Armée du Nord" }).click();
  await page
    .getByRole("dialog")
    .getByRole("region", { name: "Imperial Guard" })
    .getByRole("button", { name: "Move" })
    .click();
  await expect(page.getByText(/Tap a shaded hex/)).toBeInViewport();
  // The drawer fades out: wait, or the click can land on it.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // The unit is in the middle of the map: a little to the right of it is well inside its range.
  // The Guard is in the middle hex; a fifth of the map's height up is the next hex north.
  await clickMapPart(page, 0, -0.22);
  await expect(page.getByText(/to here\?/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Imperial Guard will move.")).toBeVisible();
  await expect(panel.getByText("Moves 1 hex")).toBeVisible();

  // Hold: from the turn panel's list, the other way in.
  await panel.getByRole("button", { name: "Reserve Artillery" }).click();
  await page
    .getByRole("dialog")
    .getByRole("region", { name: "Reserve Artillery" })
    .getByRole("button", { name: "Hold" })
    .click();
  await expect(page.getByText("Reserve Artillery will hold.")).toBeVisible();
  await expect(panel.getByText("Holds")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await scan(page, "map, a commander's draft")).toEqual([]);

  await panel.getByRole("button", { name: "Submit turn 1" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Submitted Armée du Nord's turn 1.")).toBeVisible();
  await expect(panel.getByText("Submitted: the Umpire reviews it next.")).toBeVisible();
  await expect(panel.getByRole("button", { name: /Undo/ })).toHaveCount(0);

  // The Umpire hears of it: the only army, so every army has submitted (decision 0023).
  await expect
    .poll(() => latestEmailText(umpire.email), { timeout: 15_000 })
    .toContain("The army has submitted turn 1 of");
});

test("a commander of two armies submits each one's turn", async ({ signUp }) => {
  test.slow();
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  // Grouchy's Wing is Bob's too (decision 0036).
  const { campaignUrl, campaignId, armyId, allyArmyId } = await startedCampaign(
    umpire,
    commander,
    "Wavre 1815",
    1000,
    { ally: { commander, at: { q: 1, r: 0 } } },
  );
  await giveOrders(commander, campaignId, armyId);
  await giveOrders(commander, campaignId, allyArmyId ?? "");

  const page = commander.page;
  await page.goto(`${campaignUrl}/map`);
  const panel = page.getByRole("region", { name: "Turn 1" });
  for (const army of ["Armée du Nord", "Grouchy's Wing"]) {
    const orders = panel.getByRole("group", { name: army, exact: true });
    await orders.getByRole("button", { name: "Submit turn 1" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText(`Submitted ${army}'s turn 1.`)).toBeVisible();
    await expect(orders.getByText("Submitted: the Umpire reviews it next.")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  // The turn list names each army's status.
  await expect(
    page.getByRole("button", {
      name: /Turn 1 \(open\):.*Armée du Nord: submitted.*Grouchy's Wing: submitted/,
    }),
  ).toBeVisible();
});

test("a commander moves both units in a hex together", async ({ signUp }) => {
  test.slow();
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  const { campaignUrl } = await startedCampaign(umpire, commander, "Quatre Bras 1815", 4828, {
    stacked: true,
  });

  const page = commander.page;
  await page.goto(`${campaignUrl}/map`);
  const panel = page.getByRole("region", { name: "Turn 1" });

  // The hex's drawer lists both, and offers to move them together.
  await page.getByRole("button", { name: "2 units: Imperial Guard, Reserve Artillery" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("region", { name: "2 units" })).toBeVisible();
  await drawer.getByRole("button", { name: "Move all 2" }).click();
  await expect(page.getByText(/Tap a shaded hex for where all 2 units/)).toBeInViewport();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // The next hex north, as in the single unit's move.
  await clickMapPart(page, 0, -0.22);
  await expect(page.getByText("Move all 2 units 1 hex to here?")).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("The 2 units will move together.")).toBeVisible();
  await expect(panel.getByText("Moves 1 hex")).toHaveCount(2);
  await expect(panel.getByRole("button", { name: "Submit turn 1" })).toBeEnabled();
});

test("a commander taps a ghost, or without trails the unit, to choose the hex it is leaving", async ({
  signUp,
}) => {
  test.slow();
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  const { campaignUrl, campaignId, armyId } = await startedCampaign(
    umpire,
    commander,
    "Wavre 1815",
  );
  await giveOrders(commander, campaignId, armyId, { "Imperial Guard": [{ q: 0, r: -1 }] });

  const page = commander.page;
  await page.goto(`${campaignUrl}/map`);
  // The ghost, a hex north, opens the drawer of the hex the Guard left (step 75b).
  await page.getByRole("button", { name: "Where Imperial Guard is going" }).click();
  const drawer = page.getByRole("dialog", { name: "Hex (0, 0)" });
  await expect(drawer.getByRole("region", { name: "Imperial Guard" })).toBeVisible();
  await expect(drawer.getByText("Turn 1: Moves 1 hex")).toBeVisible();

  // Without trails (step 75e), the Guard shows where it's going, and choosing it draws its move.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Map layers" }).click();
  await page.getByRole("switch", { name: "Move trails" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const ghost = page.getByRole("button", { name: "Where Imperial Guard is going" });
  await expect(ghost).toHaveCount(0);
  await page.getByRole("button", { name: /on (its|their) way here/ }).click();
  await expect(ghost).toBeVisible();
});

test("the Umpire sends a turn back, approves it resubmitted with a note, and starts the next", async ({
  signUp,
}) => {
  test.slow();
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  const { campaignUrl, campaignId, armyId } = await startedCampaign(
    umpire,
    commander,
    "Wavre 1815",
  );
  await holdAndSubmit(commander, campaignId, armyId);

  // The Umpire sends it back, with a note on the turn and one on a unit.
  const page = umpire.page;
  await page.goto(`${campaignUrl}/map`);
  const panel = page.getByRole("region", { name: "Turn 1" });
  await expect(panel.getByText(/^0 moves, 2 holds\. Submitted/)).toBeVisible();
  expect(await scan(page, "map, the Umpire's review")).toEqual([]);
  await panel.getByRole("button", { name: "Send back Armée du Nord's turn" }).click();
  const dialog = page.getByRole("dialog", { name: "Send back Armée du Nord's turn 1" });
  await dialog.getByRole("textbox", { name: "Note" }).fill("Push on to Ligny.");
  await dialog.getByRole("textbox", { name: "Imperial Guard" }).fill("Take the ridge.");
  await dialog.getByRole("button", { name: "Send back" }).click();
  await expect(page.getByText("Sent back Armée du Nord's turn 1.")).toBeVisible();
  await expect(panel.getByText(/^Bob Tester is giving orders/)).toBeVisible();

  // Bob hears why, sees the notes, and submits again.
  await expect
    .poll(() => latestEmailText(commander.email), { timeout: 15_000 })
    .toContain("Push on to Ligny.");
  const bob = commander.page;
  await bob.goto(`${campaignUrl}/map`);
  const bobsPanel = bob.getByRole("region", { name: "Turn 1" });
  await expect(bobsPanel.getByRole("status", { name: "Sent back" })).toContainText(
    "Push on to Ligny.",
  );
  await expect(bobsPanel.getByText("Umpire: Take the ridge.")).toBeVisible();
  await bobsPanel.getByRole("button", { name: "Submit turn 1" }).click();
  await bob.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await expect(bob.getByText("Submitted Armée du Nord's turn 1.")).toBeVisible();

  // The Umpire approves it with a note, and starts turn 2.
  await page.reload();
  await panel.getByRole("button", { name: "Approve with a note: Armée du Nord" }).click();
  const approving = page.getByRole("dialog", { name: "Approve Armée du Nord's turn 1" });
  await approving.getByRole("textbox", { name: "Note for the commander" }).fill("Well marched.");
  await approving.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved Armée du Nord's turn 1.")).toBeVisible();

  // Bob reads the note while the turn is approved.
  await expect
    .poll(() => latestEmailText(commander.email), { timeout: 15_000 })
    .toMatch(/The Umpire's note\s+> Well marched\./);
  await bob.reload();
  await expect(bobsPanel.getByRole("status", { name: "Approved" })).toContainText(
    "approved this turn: Well marched.",
  );
  await panel.getByRole("button", { name: "Start turn 2" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start turn 2" }).click();
  await expect(page.getByText("Turn 2 has started.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Turn 2" })).toBeVisible();

  // Bob is told, with the Umpire's note, and gives orders for turn 2 with it in view.
  await expect
    .poll(() => latestEmailText(commander.email), { timeout: 15_000 })
    .toContain("Turn 2 of Wavre 1815 has started (Afternoon).");
  expect(await latestEmailText(commander.email)).toMatch(
    /The Umpire on your last orders\s+> Well marched\./,
  );
  await bob.reload();
  const bobsNextPanel = bob.getByRole("region", { name: "Turn 2" });
  await expect(bobsNextPanel.getByText("No order yet")).toHaveCount(2);
  await expect(bobsNextPanel.getByRole("status", { name: "The Umpire on turn 1" })).toContainText(
    "Well marched.",
  );
});

test("the Umpire places a unit added since the start, and then the next turn can start", async ({
  signUp,
  isMobile,
}) => {
  test.skip(isMobile, desktopOnly);
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  const { campaignUrl, campaignId, armyId } = await startedCampaign(
    umpire,
    commander,
    "Quatre Bras 1815",
  );
  await holdAndSubmit(commander, campaignId, armyId);
  const api = await apiAs(umpire.page);
  await api.post(`/api/armies/${armyId}/scouts`, { name: "Éclaireurs" });

  const page = umpire.page;
  await page.goto(`${campaignUrl}/map`);
  const panel = page.getByRole("region", { name: "Turn 1" });
  await panel.getByRole("button", { name: "Approve Armée du Nord's turn" }).click();
  await expect(page.getByText("Approved Armée du Nord's turn 1.")).toBeVisible();
  await expect(panel.getByText("Place 1 unit on the map.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Start turn 2" })).toBeDisabled();
  expect(await scan(page, "map, a unit to place")).toEqual([]);

  await panel.getByRole("button", { name: "Place Éclaireurs" }).click();
  await expect(page.getByText(/Click the map where/)).toContainText("Éclaireurs");
  await clickMapCentre(page);
  await page
    .getByRole("dialog", { name: "Place Éclaireurs here?" })
    .getByRole("button", { name: "Place unit" })
    .click();
  await expect(page.getByText("Placed Éclaireurs.")).toBeVisible();
  await expect(panel.getByText("Not on the map yet")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Start turn 2" })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Éclaireurs/ })).toBeVisible();
});

test("the Umpire makes a commander the Commander in Chief, which leads its stack", async ({
  signUp,
}) => {
  test.slow();
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  const { campaignUrl, armyId } = await startedCampaign(umpire, commander, "Ligny 1815");
  // Two generals join the army once it's started (setup isn't what this is about), with the Guard.
  const api = await apiAs(umpire.page);
  const staff = await libraryFaction(browserOf(umpire.page), "Staff", "France", [
    { name: "Napoleon", type: "Commander", fightingFactor: 1, points: 0 },
    { name: "Soult", type: "Commander", fightingFactor: 1, points: 0 },
  ]);
  const army = await api.get<{
    name: string;
    side: { id: string };
    color: string;
    nation: string;
    factions: { id: string }[];
  }>(`/api/armies/${armyId}`);
  await api.put(`/api/armies/${armyId}`, {
    name: army.name,
    sideId: army.side.id,
    color: army.color,
    nation: army.nation,
    factionIds: [...army.factions.map((f) => f.id), staff.id],
  });
  const generals = await api.post<{ id: string }[]>(`/api/armies/${armyId}/units`, {
    unitIds: staff.units.map((unit) => unit.id),
  });
  for (const general of generals) {
    await api.put(`/api/army-units/${general.id}/placement`, { q: 0, r: 0 });
  }

  const page = umpire.page;
  await page.goto(`${campaignUrl}/armies/${armyId}`);
  const units = page.getByRole("region", { name: "Units" });
  await units.getByRole("button", { name: "Make Napoleon Commander in Chief" }).click();
  await expect(page.getByText("Napoleon is now Armée du Nord's Commander in Chief.")).toBeVisible();
  await expect(units.getByTitle("Commander in Chief")).toHaveCount(1);

  // The commander finds Napoleon on top of the Guard's hex, and named as such in it.
  await commander.page.goto(`${campaignUrl}/map`);
  const stack = commander.page.getByRole("button", {
    name: /^\d units: Napoleon \(Commander in Chief\), /,
  });
  await expect(stack).toBeVisible();
  await stack.click();
  await expect(
    commander.page
      .getByRole("dialog")
      .getByRole("button", { name: "Napoleon, Commander in Chief, Armée du Nord" }),
  ).toBeVisible();
  await expect(
    commander.page
      .getByRole("dialog")
      .getByRole("button", { name: "Soult, Commander, Armée du Nord" }),
  ).toBeVisible();
});

test("the Umpire is warned where the orders bring the two sides together", async ({ signUp }) => {
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  const { campaignUrl, campaignId, armyId } = await startedCampaign(umpire, commander, "Ligny");
  // The other side's brigade waits next to the Guard, which Bob orders into its hex.
  const api = await apiAs(umpire.page);
  const prussian = await libraryFaction(browserOf(umpire.page), "Prussian", "Prussia", [
    { name: "1st Brigade", type: "LightInfantry", fightingFactor: 4, points: 20 },
  ]);
  const sides = await api.get<{ id: string }[]>(`/api/campaigns/${campaignId}/sides`);
  await api.put(`/api/sides/${sides[1].id}`, { name: "Coalition" });
  const prussians = await api.post<{ id: string }>(`/api/campaigns/${campaignId}/armies`, {
    name: "Prussian I Corps",
    commanderMemberId: null,
    sideId: sides[1].id,
    nation: "Prussia",
    factionIds: [prussian.id],
  });
  const [brigade] = await api.post<{ id: string }[]>(`/api/armies/${prussians.id}/units`, {
    unitIds: prussian.units.map((unit) => unit.id),
  });
  await api.put(`/api/army-units/${brigade.id}/placement`, { q: 1, r: 0 });
  await holdAndSubmit(commander, campaignId, armyId, { "Imperial Guard": [{ q: 1, r: 0 }] });

  await umpire.page.goto(`${campaignUrl}/map`);
  const warnings = umpire.page
    .getByRole("region", { name: "Turn 1" })
    .getByRole("list", { name: "Contact and concentration" });
  await expect(warnings).toContainText("Hex (1, 0): Contact: Coalition and French Empire.");
  expect(await scan(umpire.page, "map, contact")).toEqual([]);
  // The warning's colours, in the dark scheme too (accessibility.spec.ts can't reach a running map).
  await umpire.page.emulateMedia({ colorScheme: "dark" });
  expect(await scan(umpire.page, "map, contact, dark")).toEqual([]);

  // Bob, a commander, isn't told where the other side is.
  await commander.page.goto(`${campaignUrl}/map`);
  await expect(commander.page.getByRole("region", { name: "Turn 1" })).toBeVisible();
  await expect(commander.page.getByText("Contact and concentration")).toHaveCount(0);
});

test("a commander is warned of their own hex over a concentration limit", async ({ signUp }) => {
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  // Both units (60 points of infantry) in one hex, over a limit of 50.
  const { campaignUrl, campaignId } = await startedCampaign(
    umpire,
    commander,
    "Mont-Saint-Jean",
    4828,
    { stacked: true },
  );
  const api = await apiAs(umpire.page);
  await api.put(`/api/campaigns/${campaignId}/concentration`, {
    infantryTypes: ["LineInfantry", "FootArtillery"],
    cavalryTypes: ["HeavyCavalry"],
    infantryLimit: 50,
    cavalryLimit: 160,
  });

  const page = commander.page;
  await page.goto(`${campaignUrl}/map`);
  const warnings = page
    .getByRole("region", { name: "Turn 1" })
    .getByRole("list", { name: "Over the concentration limits" });
  await expect(warnings).toContainText(
    "Hex (0, 0): French Empire has 60 points of infantry, over 50.",
  );

  // Its hex is a link: the hex's drawer, with its points against the limits.
  await warnings.getByRole("button", { name: "Hex (0, 0)" }).click();
  const counted = page
    .getByRole("dialog", { name: "Hex (0, 0)" })
    .getByRole("region", { name: "Concentration" });
  await expect(counted.getByRole("row", { name: /Infantry/ })).toContainText("60 of 50 points");
  await expect(counted.getByText("Over the limit")).toBeVisible();
  expect(await scan(page, "map, concentration")).toEqual([]);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await scan(page, "map, concentration, dark")).toEqual([]);
});

test("the Umpire confirms a forced march's attrition, and it's in the unit's history", async ({
  signUp,
}) => {
  test.slow();
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  const { campaignUrl, campaignId, armyId } = await startedCampaign(umpire, commander, "Wavre");
  // Three turns marching back and forth make the first forced march, which is free.
  for (const path of [[{ q: 0, r: -1 }], [{ q: 0, r: 0 }], [{ q: 0, r: -1 }]]) {
    await holdAndSubmit(commander, campaignId, armyId, { "Imperial Guard": path });
    await approveAndStartNext(umpire, campaignId, armyId);
  }
  // A fourth costs attrition: approved, but not yet started.
  await holdAndSubmit(commander, campaignId, armyId, { "Imperial Guard": [{ q: 0, r: 0 }] });
  const api = await apiAs(umpire.page);
  const turns = await api.get<{ id: string; open: boolean }[]>(`/api/armies/${armyId}/turns`);
  await api.post(`/api/army-turns/${turns.find((t) => t.open)?.id ?? ""}/approve`, null);

  // Bob is warned before the turn starts: on the Guard's marker, and in its drawer.
  await commander.page.goto(`${campaignUrl}/map`);
  await commander.page
    .getByRole("button", {
      name: "Imperial Guard, Line Infantry, Armée du Nord, losing points to attrition",
    })
    .click();
  const warning = commander.page
    .getByRole("dialog")
    .getByRole("alert")
    .filter({ hasText: "Attrition this turn" });
  await expect(warning).toContainText("its 2nd turn of forced march, normal attrition");
  await expect(warning).toContainText("it loses under a point now");
  await expect(warning).toContainText("It must Hold 2 turns to rest off its forced march");
  expect(await scan(commander.page, "map, attrition warning")).toEqual([]);
  await commander.page.emulateMedia({ colorScheme: "dark" });
  expect(await scan(commander.page, "map, attrition warning, dark")).toEqual([]);
  await commander.page.emulateMedia({ colorScheme: "light" });

  const page = umpire.page;
  await page.goto(`${campaignUrl}/map`);
  await page.getByRole("button", { name: "Start turn 5" }).click();
  const dialog = page.getByRole("dialog", { name: "Start turn 5?" });
  // FF 6 and 30 points: 0.6 of a point, carried; the Umpire makes it 2.
  const loss = dialog.getByRole("textbox", { name: "Points Imperial Guard loses" });
  await expect(loss).toHaveValue("0");
  await expect(dialog).toContainText("its 2nd turn of forced march, normal attrition");
  expect(await scan(page, "start turn, attrition")).toEqual([]);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await scan(page, "start turn, attrition, dark")).toEqual([]);
  await page.emulateMedia({ colorScheme: "light" });
  await loss.fill("2");
  await dialog.getByRole("button", { name: "Start turn 5" }).click();
  await expect(page.getByText("Turn 5 has started.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Bob sees it in the Guard's drawer, with what its forced marches are now.
  await commander.page.goto(`${campaignUrl}/map`);
  await commander.page
    .getByRole("button", { name: "Imperial Guard, Line Infantry, Armée du Nord" })
    .click();
  const drawer = commander.page.getByRole("dialog").getByRole("region", { name: "Imperial Guard" });
  await expect(drawer.getByRole("list", { name: "Points history" })).toContainText(
    "Turn 4: −2, to 28. Forced march.",
  );
  await expect(drawer).toContainText("Force marching: 2 turns to rest off (a Hold each).");
});

test("a commander steps back through the turns; the Umpire picks out an army", async ({
  signUp,
}) => {
  test.slow();
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  const { campaignUrl, campaignId, armyId } = await startedCampaign(
    umpire,
    commander,
    "Quatre Bras",
  );
  // Turn 1: the Imperial Guard marches north (about 5.5 km), and the turn is approved.
  await holdAndSubmit(commander, campaignId, armyId, {
    "Imperial Guard": [{ q: 0, r: -1 }],
  });
  await approveAndStartNext(umpire, campaignId, armyId);
  // A second army joins, with a unit of its own on the map.
  const api = await apiAs(umpire.page);
  const prussian = await libraryFaction(browserOf(umpire.page), "Prussian", "Prussia", [
    { name: "1st Brigade", type: "LightInfantry", fightingFactor: 4, points: 20 },
  ]);
  const sides = await api.get<{ id: string }[]>(`/api/campaigns/${campaignId}/sides`);
  const prussians = await api.post<{ id: string }>(`/api/campaigns/${campaignId}/armies`, {
    name: "Prussian I Corps",
    commanderMemberId: null,
    sideId: sides[1].id,
    nation: "Prussia",
    factionIds: [prussian.id],
  });
  const [brigade] = await api.post<{ id: string }[]>(`/api/armies/${prussians.id}/units`, {
    unitIds: prussian.units.map((unit) => unit.id),
  });
  await api.put(`/api/army-units/${brigade.id}/placement`, { q: 2, r: 0 });

  // Bob steps back to the setup, and forward to turn 1: shown as it was played, the Guard starts
  // where it was placed (its march a ghost); now, in turn 2, it starts further north.
  const page = commander.page;
  await page.goto(`${campaignUrl}/map`);
  const guard = page.getByRole("button", { name: "Imperial Guard, Line Infantry, Armée du Nord" });
  // How far down the map the Guard is: the page may scroll between turns.
  const map = page.getByRole("region", { name: "Map", exact: true });
  const guardY = async () =>
    ((await guard.boundingBox())?.y ?? 0) - ((await map.boundingBox())?.y ?? 0);
  const turns = page.getByRole("list", { name: "Turns" });
  await turns.getByRole("button", { name: "Turn 0: Setup" }).click();
  await expect(page.getByText("Showing where the Umpire placed the units.")).toBeVisible();
  await expect(guard).toBeVisible();
  const atSetup = await guardY();
  expect(await scan(page, "map, a past turn")).toEqual([]);
  await page.keyboard.press("ArrowUp");
  await expect(
    page.getByText("Showing turn 1: where the units started it, and their moves."),
  ).toBeVisible();
  await expect(turns.getByRole("button", { name: /^Turn 1:/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(async () => Math.abs((await guardY()) - atSetup)).toBeLessThan(2);
  await page.getByRole("button", { name: "Back to now" }).click();
  await expect(page.getByRole("region", { name: "Turn 2" })).toBeVisible();
  await expect.poll(guardY).toBeLessThan(atSetup - 20);

  // The Umpire picks out Bob's army: the Prussians' unit fades.
  await umpire.page.goto(`${campaignUrl}/map`);
  const brigadeMarker = umpire.page.getByRole("button", {
    name: "1st Brigade, Light Infantry, Prussian I Corps",
  });
  await expect(brigadeMarker).toHaveCSS("opacity", "1");
  await umpire.page.getByRole("button", { name: /^Armée du Nord, \d+ on the map/ }).click();
  await expect(brigadeMarker).toHaveCSS("opacity", "0.3");
  await expect(
    umpire.page.getByRole("button", { name: "Imperial Guard, Line Infantry, Armée du Nord" }),
  ).toHaveCSS("opacity", "1");
  expect(await scan(umpire.page, "map, an army picked out")).toEqual([]);
});

test("the Umpire moves a unit past its limit, holds another, and submits for the army", async ({
  signUp,
}) => {
  test.slow();
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  // Small hexes, so three or more of them are in view on a phone too.
  const { campaignUrl } = await startedCampaign(umpire, commander, "Genappe 1815", 2000);

  const page = umpire.page;
  await page.goto(`${campaignUrl}/map`);
  await page.getByRole("button", { name: "Imperial Guard, Line Infantry, Armée du Nord" }).click();
  await page
    .getByRole("dialog")
    .getByRole("region", { name: "Imperial Guard" })
    .getByRole("button", { name: "Move" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // A third of the map east of the Guard: several 2 km hexes, more than its two a turn.
  await clickMapPart(page, 0.35, 0);
  await expect(page.getByText(/That's further than it can go in a turn\./)).toBeVisible();
  await page.getByRole("button", { name: "Move anyway" }).click();
  await expect(page.getByText("Imperial Guard will move.")).toBeVisible();

  await page
    .getByRole("button", { name: "Reserve Artillery, Foot Artillery, Armée du Nord" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("region", { name: "Reserve Artillery" })
    .getByRole("button", { name: "Hold" })
    .click();
  await expect(page.getByText("Reserve Artillery will hold.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await scan(page, "map, the Umpire giving orders")).toEqual([]);

  const panel = page.getByRole("region", { name: "Turn 1" });
  await panel.getByRole("button", { name: "Submit for them: Armée du Nord" }).click();
  await expect(page.getByText("Submitted Armée du Nord's turn 1.")).toBeVisible();
  await panel.getByRole("button", { name: "Approve Armée du Nord's turn" }).click();
  await expect(page.getByText("Approved Armée du Nord's turn 1.")).toBeVisible();

  // Bob is told what the Umpire set, and sees it marked.
  await expect
    .poll(() => latestEmailText(commander.email), { timeout: 15_000 })
    .toMatch(/Orders the Umpire set\s+- /);
  expect(await latestEmailText(commander.email)).toContain("- Imperial Guard: move");
  await commander.page.goto(`${campaignUrl}/map`);
  const bobsPanel = commander.page.getByRole("region", { name: "Turn 1" });
  await expect(bobsPanel.getByText(/set by the Umpire$/)).toHaveCount(2);
});

test("a commander moves into high hills, which take two turns", async ({ signUp }) => {
  test.slow();
  const umpire = await signUp("Ada");
  const commander = await signUp("Bob");
  const { campaignUrl, campaignId } = await startedCampaign(umpire, commander, "Grouchy 1815");
  // The hex north of the Guard is high hills: half of it a turn, for infantry.
  await (
    await apiAs(umpire.page)
  ).put(`/api/campaigns/${campaignId}/grid/cells/0/-1`, {
    terrain: "HighHill",
    forest: false,
    settlement: { size: "None", walled: false, fortress: false, capital: "None" },
  });

  const page = commander.page;
  await page.goto(`${campaignUrl}/map`);
  const panel = page.getByRole("region", { name: "Turn 1" });
  await page.getByRole("button", { name: "Imperial Guard, Line Infantry, Armée du Nord" }).click();
  await page
    .getByRole("dialog")
    .getByRole("region", { name: "Imperial Guard" })
    .getByRole("button", { name: "Move" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await clickMapPart(page, 0, -0.22);
  await expect(
    page.getByText(/half of the way into here\? It takes more than a turn/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText("Imperial Guard will move.")).toBeVisible();
  await expect(panel.getByText("Goes half of the way into the next")).toBeVisible();
});
