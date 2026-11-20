import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

/** The list of `rows`, a group complete once every unit in it is done. */
const list = (rows: Row[]) => (
  <AppProviders queryClient={createQueryClient()}>
    <FormationList
      items={rows}
      unitOf={(r) => r}
      label="First Army's units"
      progress={(group) =>
        `${String(group.filter((r) => r.done).length)} of ${String(group.length)} placed`
      }
      complete={(group) => group.every((r) => r.done)}
      renderItem={(r) => r.name}
    />
  </AppProviders>
);

const renderList = (rows: Row[]) => render(list(rows));

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
    // Napoleon is placed, so his group starts folded.
    const loose = screen.getByRole("button", { name: "Not in a division 1 of 1 placed" });
    expect(loose).toHaveAttribute("aria-expanded", "false");
    const folded = document.getElementById(loose.getAttribute("aria-controls") ?? "");
    expect(folded?.children[0]).toHaveTextContent("Napoleon");
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

  it("folds a group away by its heading, and opens it again", async () => {
    renderList([row("1st Ligne", { brigade: "1st Brigade" }), row("Napoleon")]);
    const user = userEvent.setup();

    const heading = screen.getByRole("button", { name: "1st Brigade 0 of 1 placed" });
    expect(heading).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("1st Ligne")).toBeVisible();

    await user.click(heading);
    expect(heading).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list", { name: "1st Brigade" })).not.toBeInTheDocument();
    expect(screen.getByText("1st Ligne")).not.toBeVisible();
    // Folded, the heading still says how far the group has got.
    expect(heading).toHaveTextContent("0 of 1 placed");

    await user.click(heading);
    expect(screen.getByText("1st Ligne")).toBeVisible();
  });

  it("starts a complete group folded, and opens it once there's something to do again", () => {
    const rows = [
      row("1st Ligne", { brigade: "1st Brigade", done: true }),
      row("Lancers", { brigade: "Cavalry" }),
    ];
    const { rerender } = renderList(rows);

    expect(screen.getByRole("button", { name: /^1st Brigade/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("1st Ligne")).not.toBeVisible();
    expect(screen.getByRole("button", { name: /^Cavalry/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    rerender(list([{ ...rows[0], done: false }, rows[1]]));
    expect(screen.getByText("1st Ligne")).toBeVisible();
  });

  it("has no detectable accessibility problems", async () => {
    const { container } = renderList([
      row("1st Ligne", { corps: "I Corps", division: "1st Division", brigade: "1st Brigade" }),
      row("Napoleon"),
    ]);

    await expectNoAxeViolations(container);
  });
});
