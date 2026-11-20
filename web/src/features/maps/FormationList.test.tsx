import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { UnitType } from "@/api/generated/model";
import { AppProviders } from "@/app/AppProviders";
import { createQueryClient } from "@/app/query-client";
import { FormationList } from "@/features/maps/FormationList";
import { expectNoAxeViolations } from "@/test/render";

interface Row {
  id: string;
  name: string;
  type: UnitType;
  corps: string | null;
  division: string | null;
  brigade: string | null;
  brigadeCommander?: string | null;
  done: boolean;
}

const row = (
  name: string,
  { corps = null, division = null, brigade = null, ...rest }: Partial<Row> = {},
): Row => ({
  id: name,
  name,
  type: "LineInfantry",
  corps,
  division,
  brigade,
  done: false,
  ...rest,
});

function renderList(rows: Row[]) {
  return render(
    <AppProviders queryClient={createQueryClient()}>
      <FormationList
        items={rows}
        unitOf={(r) => r}
        label="First Army's units"
        progress={(group) =>
          `${String(group.filter((r) => r.done).length)} of ${String(group.length)} placed`
        }
        renderItem={(r) => r.name}
      />
    </AppProviders>,
  );
}

/** The names in a list, its own rows and its groups' headings, in order. */
const entries = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .filter((item) => item.parentElement === list)
    .map((item) => item.firstElementChild?.textContent ?? item.textContent);

describe("the formation list", () => {
  it("lists units plainly when they're in no corps, division or brigade", () => {
    renderList([row("Guard"), row("Hussars")]);

    const list = screen.getByRole("list", { name: "First Army's units" });
    expect(entries(list)).toEqual(["Guard", "Hussars"]);
    expect(within(list).queryAllByRole("list")).toEqual([]);
  });

  it("groups units by corps, division and brigade, each with its progress", () => {
    renderList([
      row("1st Ligne", { corps: "I Corps", division: "1st Division", brigade: "1st Brigade" }),
      row("2nd Ligne", {
        corps: "I Corps",
        division: "1st Division",
        brigade: "1st Brigade",
        done: true,
      }),
      row("Foot Battery", { division: "Reserve" }),
      row("Napoleon", { type: "Commander", done: true }),
    ]);

    const list = screen.getByRole("list", { name: "First Army's units" });
    expect(entries(list)).toEqual([
      "Not in a division 1 of 1 placed",
      "Reserve 0 of 1 placed",
      "I Corps 1 of 2 placed",
    ]);
    expect(entries(screen.getByRole("list", { name: "Not in a division" }))).toEqual(["Napoleon"]);
    expect(entries(screen.getByRole("list", { name: "I Corps" }))).toEqual([
      "1st Division 1 of 2 placed",
    ]);
    expect(entries(screen.getByRole("list", { name: "1st Brigade" }))).toEqual([
      "1st Ligne",
      "2nd Ligne",
    ]);
  });

  it("names a group's commander when none of its units is them", () => {
    renderList([row("1st Ligne", { brigade: "1st Brigade", brigadeCommander: "Quiot" })]);

    const brigade = screen.getByRole("list", { name: "1st Brigade" });
    expect(brigade.previousElementSibling).toHaveTextContent("1st Brigade Quiot 0 of 1 placed");
  });

  it("keeps brigades in no division without a heading of their own", () => {
    renderList([row("Engineers", { brigade: "Reserve" }), row("Napoleon")]);

    const list = screen.getByRole("list", { name: "First Army's units" });
    expect(entries(list)).toEqual(["Napoleon", "Reserve 0 of 1 placed"]);
  });

  it("has no detectable accessibility problems", async () => {
    const { container } = renderList([
      row("1st Ligne", { corps: "I Corps", division: "1st Division", brigade: "1st Brigade" }),
      row("Napoleon"),
    ]);

    await expectNoAxeViolations(container);
  });
});
