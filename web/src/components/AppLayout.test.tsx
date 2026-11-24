import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { server, serveHealth } from "@/test/server";
import { renderApp } from "@/test/render";
import { testUser } from "@/test/session";

describe("app layout and routing", () => {
  it("sends the start page to the campaign list", async () => {
    await renderApp("/");

    expect(await screen.findByRole("heading", { level: 1, name: "Campaigns" })).toBeInTheDocument();
    expect(document.title).toBe("Campaigns · Wasatch Wargamers");
  });

  it("shows a not-found page for an unknown address", async () => {
    await renderApp("/no-such-page");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
  });

  it("marks the current page in the navigation and moves focus to the new heading", async () => {
    server.use(serveHealth("Healthy"));
    const user = userEvent.setup();
    await renderApp("/campaigns");
    await screen.findByRole("heading", { level: 1, name: "Campaigns" });

    const sidebar = screen.getByRole("navigation", { name: "Main" });
    expect(within(sidebar).getByRole("link", { name: "Campaigns" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(within(sidebar).getByRole("link", { name: "About" }));

    const heading = await screen.findByRole("heading", { level: 1, name: "About" });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(within(sidebar).getByRole("link", { name: "About" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("starts the sidebar as a rail of icons, and widens it to show their labels", async () => {
    const user = userEvent.setup();
    await renderApp("/campaigns");
    await screen.findByRole("heading", { level: 1, name: "Campaigns" });
    const sidebar = screen.getByRole("navigation", { name: "Main" });

    // Collapsed, each link is named by its label though only its icon shows.
    expect(within(sidebar).getByRole("link", { name: "Library" })).not.toHaveTextContent("Library");
    const expand = within(sidebar).getByRole("button", { name: "Expand menu" });
    expect(expand).toHaveAttribute("aria-expanded", "false");

    await user.click(expand);

    expect(within(sidebar).getByRole("link", { name: "Library" })).toHaveTextContent("Library");
    const collapse = within(sidebar).getByRole("button", { name: "Collapse menu" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    expect(localStorage.getItem("wwg-nav-expanded")).toBe("true");

    await user.click(collapse);
    expect(within(sidebar).getByRole("button", { name: "Expand menu" })).toBeInTheDocument();
  });

  it("lets the user choose light or dark, remembered, or go back to the system's", async () => {
    localStorage.clear();
    const user = userEvent.setup();
    await renderApp("/campaigns");
    await screen.findByRole("heading", { level: 1, name: "Campaigns" });
    const open = async () => {
      await user.click(screen.getByRole("button", { name: new RegExp(testUser.firstName) }));
      return screen.findByRole("menu");
    };

    const menu = await open();
    expect(within(menu).getByRole("menuitem", { name: "Match the system" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await user.click(within(menu).getByRole("menuitem", { name: "Dark" }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", "dark");
    });
    expect(localStorage.getItem("mantine-color-scheme-value")).toBe("dark");
    await user.click(within(await open()).getByRole("menuitem", { name: "Match the system" }));
    expect(localStorage.getItem("mantine-color-scheme-value")).toBe("auto");
  });

  it("updates and reloads the app from the account menu", async () => {
    const user = userEvent.setup();
    await renderApp("/campaigns");
    await screen.findByRole("heading", { level: 1, name: "Campaigns" });
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });

    await user.click(screen.getByRole("button", { name: new RegExp(testUser.firstName) }));
    const menu = await screen.findByRole("menu");
    await user.click(within(menu).getByRole("menuitem", { name: "Update and reload" }));

    await waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
    vi.unstubAllGlobals();
  });
});
