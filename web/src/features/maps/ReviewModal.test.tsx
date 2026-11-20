import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ArmySummary, ArmyUnitResponse } from "@/api/generated/model";
import { AppProviders } from "@/app/AppProviders";
import { createQueryClient } from "@/app/query-client";
import { ReviewModal } from "@/features/maps/ReviewModal";
import { expectNoAxeViolations } from "@/test/render";

const army: ArmySummary = {
  id: "0192f5c1-0000-7000-8000-00000000a001",
  name: "Armée du Nord",
  commander: null,
  side: { id: "0192f5c1-0000-7000-8000-00000000f001", name: "Coalition" },
  color: "Blue",
  nation: "France",
};

const unit = (id: string, name: string, division: string | null): ArmyUnitResponse => ({
  id: `0192f5c1-0000-7000-8000-00000000b00${id}`,
  armyId: army.id,
  unitId: null,
  factionId: null,
  nation: "France",
  name,
  type: "LineInfantry",
  fightingFactor: 5,
  points: 20,
  division,
  brigade: null,
  corps: null,
  corpsCommander: null,
  divisionCommander: null,
  brigadeCommander: null,
  importOrder: null,
  isCommanderInChief: false,
});

// The division's unit first, as the API might list them: the dialog shows it after the loose one.
const lancers = unit("1", "Lancers", "Cavalry Division");
const grenadiers = unit("2", "Grenadiers", null);

describe("the review dialog", () => {
  it("lists the units' notes in their order of battle, each sent for its own unit", async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    const { container } = render(
      <AppProviders queryClient={createQueryClient()}>
        <ReviewModal
          kind="send-back"
          army={army}
          turn={3}
          units={[lancers, grenadiers]}
          onSubmit={onSubmit}
          onClose={() => undefined}
        />
      </AppProviders>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Send back Armée du Nord's turn 3" });
    const notes = within(dialog).getByRole("list", { name: "Notes on units' orders" });
    expect(
      within(notes)
        .getAllByRole("button")
        .map((heading) => heading.textContent),
    ).toEqual(["Not in a division 1 unit", "Cavalry Division 1 unit"]);
    expect(
      within(within(notes).getByRole("list", { name: "Cavalry Division" })).getByRole("textbox", {
        name: "Lancers",
      }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);

    await user.type(within(dialog).getByRole("textbox", { name: "Lancers" }), "Screen the left.");
    await user.click(within(dialog).getByRole("button", { name: "Send back" }));

    expect(onSubmit).toHaveBeenCalledWith({
      note: null,
      unitNotes: [{ unitId: lancers.id, text: "Screen the left." }],
    });
  });
});
