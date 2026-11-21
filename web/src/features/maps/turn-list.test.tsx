import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CampaignTurnsResponse } from "@/api/generated/model";
import { AppProviders } from "@/app/AppProviders";
import { createQueryClient } from "@/app/query-client";
import { TurnList } from "@/features/maps/TurnList";

const turn = (armyTurns: CampaignTurnsResponse["turns"][number]["armyTurns"]) =>
  ({
    stage: "Running",
    openTurn: 1,
    startProblems: [],
    turns: [
      {
        number: 1,
        openedAt: "2026-09-02T12:00:00Z",
        closedAt: null,
        submitted: 1,
        armies: 3,
        armyTurns,
      },
    ],
  }) satisfies CampaignTurnsResponse;

const status = (armyId: string, done: boolean) => ({
  armyId,
  status: done ? ("Submitted" as const) : ("Draft" as const),
  submittedAt: done ? "2026-09-02T13:00:00Z" : null,
  completedAt: null,
});

const show = (turns: CampaignTurnsResponse) =>
  render(
    <AppProviders queryClient={createQueryClient()}>
      <TurnList
        turns={turns}
        viewing={1}
        onView={() => undefined}
        manager={false}
        armyNames={
          new Map([
            ["a1", "First Corps"],
            ["a2", "Second Corps"],
          ])
        }
      />
    </AppProviders>,
  );

describe("TurnList", () => {
  it("shows a commander of one army its status", () => {
    show(turn([status("a1", false)]));

    expect(screen.getByRole("button", { name: "Turn 1 (open): draft" })).toBeInTheDocument();
  });

  it("names each army's status for a commander of several (decision 0036)", () => {
    show(turn([status("a1", true), status("a2", false)]));

    expect(
      screen.getByRole("button", {
        name: "Turn 1 (open): First Corps: submitted, Second Corps: draft",
      }),
    ).toBeInTheDocument();
  });
});
