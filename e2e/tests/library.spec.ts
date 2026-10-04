import { admin } from "./support/accounts.ts";
import { scan } from "./support/axe.ts";
import { createCampaign } from "./support/campaigns.ts";
import {
  addFromLibrary,
  browserOf,
  chooseFaction,
  libraryFaction,
  uniqueName,
} from "./support/library.ts";
import { desktopOnly, lowValue, expect, test } from "./support/fixtures.ts";

test("an Admin makes a Manager, who builds the library that everyone sees", async ({
  signIn,
  signUp,
  isMobile,
}) => {
  test.slow();
  const manager = await signUp("Mia");
  const player = await signUp("Pat");
  // Every run shares the library: a faction of this test's own.
  const faction = `French ${String(Date.now())}`;

  // Not a Manager yet: the library is there to view, not to change.
  await manager.page.goto("/library");
  await expect(manager.page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
  await expect(manager.page.getByRole("button", { name: "New faction" })).toHaveCount(0);

  const adminPage = await signIn(admin.email, admin.password);
  await adminPage
    .getByRole("navigation", { name: isMobile ? "Main tabs" : "Main" })
    .getByRole("link", { name: "Users" })
    .click();
  await adminPage.getByRole("searchbox", { name: "Search" }).fill(manager.email);
  await expect(adminPage).toHaveURL(/search=/);
  await adminPage.getByRole("row").filter({ hasText: manager.email }).getByRole("link").click();
  await adminPage.getByRole("switch", { name: "Manager" }).click();
  await expect(adminPage.getByText("Mia is now a Manager.")).toBeVisible();

  // At once, without signing in again.
  const page = manager.page;
  await page.reload();
  await page.getByRole("button", { name: "New faction" }).click();
  const factionForm = page.getByRole("dialog");
  await factionForm.getByRole("textbox", { name: "Name" }).fill(faction);
  await factionForm.getByRole("combobox", { name: "Nation" }).click();
  await factionForm.getByRole("option", { name: "France" }).click();
  await factionForm.getByRole("button", { name: "Add faction" }).click();
  await expect(page.getByRole("heading", { level: 1, name: faction })).toBeVisible();

  await page.getByRole("button", { name: "Add unit" }).click();
  const unitForm = page.getByRole("dialog");
  await unitForm.getByRole("textbox", { name: "Name" }).fill("Imperial Guard");
  await unitForm.getByRole("combobox", { name: "Type" }).click();
  await unitForm.getByRole("option", { name: "Line Infantry" }).click();
  await unitForm.getByRole("textbox", { name: "Fighting Factor (FF)" }).fill("7");
  await unitForm.getByRole("textbox", { name: "Points" }).fill("40");
  await unitForm.getByRole("combobox", { name: "Division" }).fill("Guard Infantry");
  await unitForm.getByRole("combobox", { name: "Brigade" }).fill("Old Guard");
  await unitForm.getByRole("button", { name: "Add unit" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Its order of battle: the unit under its brigade, under its division.
  const units = page.getByRole("region", { name: "Units" });
  await expect(units.getByRole("row")).toHaveText([
    /^Name/,
    /^Guard Infantry1 unit · 40 points/,
    /^Old Guard1 unit · 40 points/,
    /^Imperial Guard/,
  ]);
  expect(await scan(page, "library faction (Manager)")).toEqual([]);

  // Anyone signed in sees it, and can't change it.
  await player.page.goto("/library");
  await player.page.getByRole("link", { name: faction }).click();
  await expect(player.page.getByRole("region", { name: "Units" })).toContainText("Imperial Guard");
  await expect(player.page.getByRole("button", { name: "Add unit" })).toHaveCount(0);
  await expect(player.page.getByRole("button", { name: "Edit faction" })).toHaveCount(0);
});

test("an Umpire takes a library unit into two campaigns, but only once into each", async ({
  signUp,
  isMobile,
}) => {
  test.skip(isMobile, desktopOnly);
  test.slow();
  const umpire = await signUp("Uma");
  const page = umpire.page;
  const faction = await libraryFaction(browserOf(page), "French", "France", [
    { name: "Imperial Guard", type: "LineInfantry" },
  ]);

  for (const campaign of ["Austerlitz 1805", "Jena 1806"]) {
    await createCampaign(page, campaign);
    const campaignUrl = page.url();
    for (const army of ["Grande Armée", "Reserve"]) {
      await page.goto(campaignUrl);
      await page.getByRole("button", { name: "New army" }).click();
      await page.getByRole("dialog").getByRole("textbox", { name: "Name" }).fill(army);
      await page.getByRole("dialog").getByRole("button", { name: "Add army" }).click();
      await page.getByRole("link", { name: army }).click();
      await chooseFaction(page, faction.name);
    }

    // The Reserve's page: the Guard joins it, and the Grande Armée can't have it too.
    await addFromLibrary(page, ["Imperial Guard"]);
    await expect(page.getByRole("region", { name: "Units" })).toContainText("Imperial Guard");
    await page.goto(campaignUrl);
    await page.getByRole("link", { name: "Grande Armée" }).click();
    await page.getByRole("button", { name: "Add units" }).click();
    const picker = page.getByRole("dialog", { name: "Add units" });
    await expect(picker.getByRole("checkbox", { name: "Imperial Guard" })).toBeDisabled();
    await expect(picker).toContainText("In Reserve");
    await picker.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("an Admin imports the club's library CSV, then imports it again unchanged", async ({
  signIn,
  isMobile,
}) => {
  test.skip(true, lowValue);
  test.skip(isMobile, desktopOnly);
  // Every run shares the library: a nation (so a faction) of this test's own.
  const nation = uniqueName("Hanoverians");
  const row = (unit: string, brigade: string, type: string) =>
    [
      `${nation} | I Corps | 1st Division | ${brigade} | ${unit}`,
      nation,
      "Hanover",
      "I Corps",
      "L.G. Sir John Moore",
      "1st Division",
      "L.G. Lord Edward Paget",
      brigade,
      "M.G. Peregrine Maitland",
      unit,
      "",
      type,
      "6",
      "34",
      "Painted",
    ].join(",");
  const csv = [
    "key,nation,flag,corps,corps_commander,division,division_commander,brigade,brigade_commander,unit,notes,type,ff,points,status",
    row("Field Battalion Bremen", "1st Brigade", "LineInfantry"),
    row("Field Jager Company", "1st Brigade", "LightInfantry"),
  ].join("\n");
  const file = { name: "complete_library.csv", mimeType: "text/csv", buffer: Buffer.from(csv) };
  const page = await signIn(admin.email, admin.password);
  await page.goto("/library");

  await page.getByRole("button", { name: "Import" }).click();
  let dialog = page.getByRole("dialog", { name: "Import the library" });
  await dialog.getByLabel("CSV file").setInputFiles(file);
  await expect(dialog.getByText("2 units in 1 faction.")).toBeVisible();
  await expect(dialog.getByRole("row").filter({ hasText: nation })).toContainText("New faction");
  await dialog.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Imported the library: 2 units added, 0 changed.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The new faction's order of battle: its corps and division, each with its commander.
  await page.getByRole("link", { name: nation }).click();
  const units = page.getByRole("region", { name: "Units" });
  await expect(units.getByRole("row")).toHaveText([
    /^Name/,
    /^I CorpsL\.G\. Sir John Moore2 units · 68 points/,
    /^1st DivisionL\.G\. Lord Edward Paget2 units/,
    /^1st BrigadeM\.G\. Peregrine Maitland2 units/,
    /^Field Battalion Bremen/,
    /^Field Jager Company/,
  ]);
  expect(await scan(page, "library faction with corps")).toEqual([]);

  // The same file again changes nothing.
  await page.goto("/library");
  await page.getByRole("button", { name: "Import" }).click();
  dialog = page.getByRole("dialog", { name: "Import the library" });
  await dialog.getByLabel("CSV file").setInputFiles(file);
  await expect(dialog.getByRole("row").filter({ hasText: nation })).toHaveText(
    new RegExp(`^${nation}002$`),
  );
});
