import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { CourierSettingsResponse, CampaignResponse } from "@/api/generated/model";
import { renderApp } from "@/test/render";
import { server } from "@/test/server";
import { testUser } from "@/test/session";

const campaignId = "0192f5c1-0000-7000-8000-00000000c001";

function serve(settings: CourierSettingsResponse = { speed: 1.5 }) {
  const saved: unknown[] = [];
  server.use(
    http.get(`*/api/campaigns/${campaignId}`, () =>
      HttpResponse.json({
        id: campaignId,
        name: "The Hundred Days",
        description: null,
        umpire: {
          memberId: "0192f5c1-0000-7000-8000-00000000d001",
          userId: testUser.id,
          firstName: "Mel",
          lastName: "Green",
        },
        myRole: "Umpire",
        playerCount: 0,
        createdAt: "2026-09-01T12:00:00Z",
        updatedAt: "2026-09-01T12:00:00Z",
      } satisfies CampaignResponse),
    ),
    http.get(`*/api/campaigns/${campaignId}/courier-settings`, () => HttpResponse.json(settings)),
    http.put(`*/api/campaigns/${campaignId}/courier-settings`, async ({ request }) => {
      const body = (await request.json()) as CourierSettingsResponse;
      saved.push(body);
      return HttpResponse.json(body);
    }),
  );
  return saved;
}

const section = async () => within(await screen.findByRole("region", { name: "Couriers" }));

describe("the campaign's couriers", () => {
  it("lets the Umpire change how fast couriers ride", async () => {
    const saved = serve();
    const user = userEvent.setup();
    await renderApp(`/campaigns/${campaignId}/edit`);
    const found = await section();

    const speed = await found.findByRole("textbox", { name: /Speed, times light cavalry.s/ });
    expect(speed).toHaveValue("1.5");
    await user.clear(speed);
    await user.type(speed, "3");
    await user.click(found.getByRole("button", { name: "Save couriers" }));

    expect(await screen.findByText("Saved the courier settings.")).toBeInTheDocument();
    expect(saved).toEqual([{ speed: 3 }]);
  });

  it("puts the rules' courier back", async () => {
    const saved = serve({ speed: 2 });
    const user = userEvent.setup();
    await renderApp(`/campaigns/${campaignId}/edit`);
    const found = await section();

    await user.click(await found.findByRole("button", { name: "Use the rules' courier" }));
    await user.click(found.getByRole("button", { name: "Save couriers" }));

    expect(await screen.findByText("Saved the courier settings.")).toBeInTheDocument();
    expect(saved).toEqual([{ speed: 1 }]);
  });
});
