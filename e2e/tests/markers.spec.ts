import { apiAs, waterlooMap } from "./support/api.ts";
import { scan } from "./support/axe.ts";
import { createCampaign, join, joinLink } from "./support/campaigns.ts";
import { expect, test } from "./support/fixtures.ts";
import { clickMapCentre } from "./support/map.ts";

test("a Player keeps a marker of their own on the map, which no one else sees", async ({
  signUp,
}) => {
  test.slow();
  const umpire = await signUp("Ada");
  const bob = await signUp("Bob");
  await createCampaign(umpire.page, "Plancenoit");
  const campaignUrl = umpire.page.url();
  const campaignId = new URL(campaignUrl).pathname.split("/").at(-1) ?? "";
  await join(bob.page, await joinLink(umpire.page), "Plancenoit");
  const api = await apiAs(umpire.page);
  await api.put(`/api/campaigns/${campaignId}/map`, waterlooMap);
  // The middle hex has a name in the game: a new marker there takes it.
  await api.put(`/api/campaigns/${campaignId}/grid/cells/0/0`, {
    terrain: "Flat",
    forest: false,
    settlement: {
      size: "Town",
      walled: false,
      fortress: false,
      capital: "None",
      name: "Plancenoit",
    },
  });

  const page = bob.page;
  await page.goto(`${campaignUrl}/map`);
  await expect(page.getByRole("region", { name: "My markers" })).toContainText("None yet.");
  await clickMapCentre(page);
  const drawer = page.getByRole("dialog", { name: "Hex (0, 0), Plancenoit" });
  await drawer.getByRole("button", { name: "Add a marker" }).click();
  const form = page.getByRole("dialog", { name: "Add a marker" });
  await expect(form.getByRole("textbox", { name: "Title" })).toHaveValue("Plancenoit");
  await form.getByRole("textbox", { name: "Description" }).fill("The Guard holds the church.");
  expect(await scan(page, "map, adding a marker")).toEqual([]);
  await form.getByRole("button", { name: "Add marker" }).click();
  await expect(page.getByText("Added Plancenoit.")).toBeVisible();
  await expect(drawer.getByRole("list", { name: "My markers here" })).toContainText(
    "The Guard holds the church.",
  );

  // Renamed from the panel beside the map, once the drawer has gone from over it.
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const panel = page.getByRole("list", { name: "My markers", exact: true });
  await expect(panel).toContainText("Plancenoit · Hex (0, 0)");
  await panel.getByRole("button", { name: "Edit Plancenoit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit Plancenoit" });
  await edit.getByRole("textbox", { name: "Title" }).fill("The church");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved The church.")).toBeVisible();
  await expect(panel).toContainText("The church · Hex (0, 0)");

  // Only Bob sees it: not even the Umpire.
  await umpire.page.goto(`${campaignUrl}/map`);
  await expect(umpire.page.getByRole("region", { name: "My markers" })).toContainText("None yet.");

  // Kept as he comes back, until he removes it.
  await page.reload();
  await panel.getByRole("button", { name: "Remove The church" }).click();
  await page
    .getByRole("dialog", { name: "Remove The church?" })
    .getByRole("button", { name: "Remove marker" })
    .click();
  await expect(page.getByText("Removed The church.")).toBeVisible();
  await expect(page.getByRole("region", { name: "My markers" })).toContainText("None yet.");
});
