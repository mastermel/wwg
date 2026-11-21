import { scan } from "./support/axe.ts";
import { desktopOnly, expect, test } from "./support/fixtures.ts";
import { apiAs } from "./support/api.ts";
import {
  approveAndStartNext,
  holdAndSubmit,
  holdForArmy,
  startedCampaign,
} from "./support/turns.ts";

test("a commander sends an ally a report, which a courier brings the next turn", async ({
  signUp,
}) => {
  test.slow();
  const umpire = await signUp("Ada");
  const bob = await signUp("Bob");
  const cy = await signUp("Cy");
  // Grouchy's wing next to the Guard: close by, so the report arrives next turn.
  const { campaignUrl, campaignId, armyId, allyArmyId } = await startedCampaign(
    umpire,
    bob,
    "Wavre",
    4828,
    { ally: { commander: cy, at: { q: 1, r: 0 } } },
  );

  const page = bob.page;
  await page.goto(`${campaignUrl}/map`);
  const intelligence = page.getByRole("region", { name: "Intelligence" });
  await intelligence.getByRole("button", { name: "Send a report" }).click();
  const dialog = page.getByRole("dialog", { name: "Send a report" });
  await dialog.getByRole("textbox", { name: "Message" }).fill("Come to Ligny by the Wavre road.");
  expect(await scan(page, "send a report")).toEqual([]);
  await dialog.getByRole("button", { name: "Send by courier" }).click();
  await expect(page.getByText("Sent a report to Grouchy's Wing by courier.")).toBeVisible();
  await expect(intelligence.getByRole("list", { name: "Reports sent" })).toContainText(
    "To Grouchy's Wing, turn 1.",
  );

  // Not there yet: the courier is still riding.
  await cy.page.goto(`${campaignUrl}/map`);
  await expect(cy.page.getByRole("region", { name: "Intelligence" })).toContainText(
    "No reports yet.",
  );

  await holdAndSubmit(bob, campaignId, armyId);
  await holdForArmy(umpire, campaignId, allyArmyId ?? "");
  await approveAndStartNext(umpire, campaignId, armyId);

  await cy.page.reload();
  const received = cy.page.getByRole("list", { name: "Reports received" });
  await expect(received).toContainText("From Armée du Nord, sent turn 1, arrived turn 2.");
  await expect(received).toContainText("Come to Ligny by the Wavre road.");
  // Skipping these steps for now, as that functionality has been temporarily removed
  // await received.getByRole("button", { name: "Show their 2 units" }).click();
  // await expect(received.getByRole("button", { name: "Hide their units" })).toBeVisible();
  expect(await scan(cy.page, "map, a report")).toEqual([]);
});

test("the Umpire sees a courier on the map and cancels it, saying why", async ({
  signUp,
  isMobile,
}) => {
  test.skip(isMobile, desktopOnly);
  test.slow();
  const umpire = await signUp("Ada");
  const bob = await signUp("Bob");
  const cy = await signUp("Cy");
  const { campaignUrl, campaignId, armyId, allyArmyId } = await startedCampaign(
    umpire,
    bob,
    "Mont-Saint-Jean",
    4828,
    { ally: { commander: cy, at: { q: 1, r: 0 } } },
  );
  await (
    await apiAs(bob.page)
  ).post(`/api/armies/${armyId}/reports`, {
    toArmyId: allyArmyId,
    note: "The Guard attacks at seven.",
  });

  const page = umpire.page;
  await page.goto(`${campaignUrl}/map`);
  const route = "Armée du Nord (Napoleon) to Grouchy's Wing (Grouchy)";
  const couriers = page.getByRole("region", { name: "Couriers" });
  await expect(couriers.getByRole("list", { name: "Couriers" })).toContainText(
    `${route}: Hex (0, 0), arriving next turn.`,
  );
  await page.getByRole("button", { name: `Courier from ${route}`, exact: true }).click();
  const popover = page.getByRole("dialog").filter({ hasText: `Courier from ${route}` });
  await expect(popover).toContainText("“The Guard attacks at seven.”");
  await popover.getByRole("button", { name: "Cancel the courier" }).click();

  const dialog = page.getByRole("dialog", { name: "Cancel the courier?" });
  await dialog.getByRole("textbox", { name: "Why" }).fill("Taken by Prussian hussars at Lasne.");
  expect(await scan(page, "cancel a courier")).toEqual([]);
  await dialog.getByRole("button", { name: "Cancel the courier" }).click();
  await expect(page.getByText(`Cancelled the courier from ${route}.`)).toBeVisible();
  await expect(couriers).toContainText("None on their way.");
  await couriers.getByRole("button", { name: "History (1)" }).click();
  const history = couriers.getByRole("list", { name: "Couriers arrived or cancelled" });
  await expect(history).toContainText("Sent turn 1, cancelled turn 1 by Ada");
  await expect(history).toContainText("Why: Taken by Prussian hussars at Lasne.");

  // It never arrives, and nobody is told.
  await holdAndSubmit(bob, campaignId, armyId);
  await holdForArmy(umpire, campaignId, allyArmyId ?? "");
  await approveAndStartNext(umpire, campaignId, armyId);
  await cy.page.goto(`${campaignUrl}/map`);
  await expect(cy.page.getByRole("region", { name: "Intelligence" })).toContainText(
    "No reports yet.",
  );
});

test("the Umpire sends an army an ally's position and an enemy sighting, which it has at once", async ({
  signUp,
}) => {
  test.slow();
  const umpire = await signUp("Ada");
  const bob = await signUp("Bob");
  const cy = await signUp("Cy");
  const { campaignUrl, armyId } = await startedCampaign(umpire, bob, "Quatre Bras", 4828, {
    ally: { commander: cy, at: { q: 1, r: 0 } },
    enemyAt: { q: 2, r: 0 },
  });

  const page = umpire.page;
  await page.goto(`${campaignUrl}/armies/${armyId}`);
  await page.getByRole("button", { name: "Send intelligence" }).click();
  const dialog = page.getByRole("dialog", { name: "Send intelligence" });
  await dialog.getByRole("checkbox", { name: "IV Corps, Hex (1, 0)" }).check();
  await dialog.getByRole("checkbox", { name: "1st Brigade, Hex (2, 0)" }).check();
  const sighting = dialog.getByRole("group", { name: "Hex (2, 0)" });
  await expect(sighting).toContainText("1st Brigade (Line Infantry, 20 points)");
  await sighting.getByText("Exact", { exact: true }).click();
  await dialog.getByRole("textbox", { name: "Message" }).fill("Grouchy is at Wavre.");
  expect(await scan(page, "send intelligence")).toEqual([]);
  await dialog.getByRole("button", { name: "Send intelligence" }).click();
  await expect(page.getByText("Sent intelligence to Armée du Nord.")).toBeVisible();

  await bob.page.goto(`${campaignUrl}/map`);
  const received = bob.page.getByRole("list", { name: "Reports received" });
  await expect(received).toContainText("From the Umpire, turn 1.");
  await expect(received).toContainText("Grouchy is at Wavre.");
  await received.getByRole("button", { name: "Show the 1 unit" }).click();
  await expect(received.getByRole("button", { name: "Hide the units" })).toBeVisible();
  await expect(bob.page.getByRole("list", { name: "Sightings" })).toContainText(
    "Hex (2, 0): Prussian I Corps: 1 line infantry, 20 points (reported).",
  );
  expect(await scan(bob.page, "map, the Umpire's report")).toEqual([]);
});
