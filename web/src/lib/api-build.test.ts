import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateAndReload = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/lib/app-update", () => ({ updateAndReload }));

/** A fresh copy of the module, as a page that has just loaded would have. */
async function loadPage() {
  vi.resetModules();
  return import("@/lib/api-build");
}

describe("noteApiBuild", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("remembers the first build it sees, without reloading", async () => {
    const page = await loadPage();
    expect(page.startingApiBuild).toBeNull();

    page.noteApiBuild("a");
    page.noteApiBuild("a");

    expect(localStorage.getItem("wwg:api-build")).toBe("a");
    expect(updateAndReload).not.toHaveBeenCalled();
  });

  it("starts from the build last seen", async () => {
    localStorage.setItem("wwg:api-build", "a");

    const page = await loadPage();

    expect(page.startingApiBuild).toBe("a");
  });

  it("reloads once nobody's typing when the API's build changes", async () => {
    localStorage.setItem("wwg:api-build", "a");
    const page = await loadPage();

    page.noteApiBuild("a");
    expect(updateAndReload).not.toHaveBeenCalled();

    page.noteApiBuild("b");
    expect(localStorage.getItem("wwg:api-build")).toBe("b");
    expect(updateAndReload).toHaveBeenCalledWith({ whenIdle: true });
  });

  it("reloads when another tab has already seen the new build", async () => {
    localStorage.setItem("wwg:api-build", "a");
    const page = await loadPage();
    localStorage.setItem("wwg:api-build", "b");

    page.noteApiBuild("b");

    expect(updateAndReload).toHaveBeenCalledWith({ whenIdle: true });
  });

  it("ignores responses without the header", async () => {
    localStorage.setItem("wwg:api-build", "a");
    const page = await loadPage();

    page.noteApiBuild(null);

    expect(localStorage.getItem("wwg:api-build")).toBe("a");
    expect(updateAndReload).not.toHaveBeenCalled();
  });
});
