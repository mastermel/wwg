import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isIdle, updateAndReload, updateCheckIntervalMs, watchForUpdates } from "@/lib/app-update";

class FakeWorker extends EventTarget {
  postMessage = vi.fn();
  listening = false;
  state: ServiceWorkerState;
  constructor(state: ServiceWorkerState) {
    super();
    this.state = state;
  }
  override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
    this.listening = true;
    super.addEventListener(...args);
  }
  become(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

interface FakeRegistration {
  installing: FakeWorker | null;
  waiting: FakeWorker | null;
  update: () => Promise<void>;
}

let reload: ReturnType<typeof vi.fn>;
let container: EventTarget & { controller: object | null; getRegistration: () => unknown };

function serviceWorkers(registration: FakeRegistration | undefined, controller: object | null) {
  container = Object.assign(new EventTarget(), {
    controller,
    getRegistration: () => Promise.resolve(registration),
  });
  Object.defineProperty(navigator, "serviceWorker", { value: container, configurable: true });
}

function registration(changes: Partial<FakeRegistration> = {}): FakeRegistration {
  return { installing: null, waiting: null, update: () => Promise.resolve(), ...changes };
}

describe("updateAndReload", () => {
  beforeEach(() => {
    reload = vi.fn();
    vi.stubGlobal("location", { reload });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("just reloads when there's no newer version", async () => {
    const update = vi.fn(() => Promise.resolve());
    serviceWorkers(registration({ update }), {});

    await updateAndReload();

    expect(update).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it("activates a waiting version and reloads once it takes over", async () => {
    const waiting = new FakeWorker("installed");
    serviceWorkers(registration({ waiting }), {});

    await updateAndReload();

    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).not.toHaveBeenCalled();
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).toHaveBeenCalled();
  });

  it("waits for a version it has just found to download first", async () => {
    const reg = registration();
    const found = new FakeWorker("installing");
    reg.update = () => {
      reg.installing = found;
      return Promise.resolve();
    };
    serviceWorkers(reg, {});

    const done = updateAndReload();
    await vi.waitFor(() => {
      expect(found.listening).toBe(true);
    });
    reg.installing = null;
    reg.waiting = found;
    found.become("installed");
    await done;

    expect(found.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("reloads when the check fails, as it does offline", async () => {
    serviceWorkers(registration({ update: () => Promise.reject(new Error("offline")) }), {});

    await updateAndReload();

    expect(reload).toHaveBeenCalled();
  });

  it("reloads without a service worker", async () => {
    serviceWorkers(undefined, null);

    await updateAndReload();

    expect(reload).toHaveBeenCalled();
  });

  describe("when idle", () => {
    afterEach(() => {
      vi.useRealTimers();
      document.body.replaceChildren();
    });

    it("reloads at once when nobody's typing", async () => {
      serviceWorkers(registration(), {});

      await updateAndReload({ whenIdle: true });

      expect(reload).toHaveBeenCalled();
    });

    it("waits until the text field being typed in loses focus", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      serviceWorkers(registration(), {});
      const field = document.body.appendChild(document.createElement("textarea"));
      field.focus();

      const done = updateAndReload({ whenIdle: true });
      await vi.advanceTimersByTimeAsync(5_000);
      expect(reload).not.toHaveBeenCalled();

      field.blur();
      await vi.advanceTimersByTimeAsync(1_000);
      await done;
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it("waits until an open modal closes", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      const waiting = new FakeWorker("installed");
      serviceWorkers(registration({ waiting }), {});
      const modal = document.body.appendChild(document.createElement("div"));
      modal.className = "mantine-Modal-root";

      const done = updateAndReload({ whenIdle: true });
      await vi.advanceTimersByTimeAsync(5_000);
      expect(waiting.postMessage).not.toHaveBeenCalled();

      modal.remove();
      await vi.advanceTimersByTimeAsync(1_000);
      await done;
      expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    });

    it("doesn't count a focused checkbox or button as typing", () => {
      const checkbox = document.body.appendChild(document.createElement("input"));
      checkbox.type = "checkbox";
      checkbox.focus();
      expect(isIdle()).toBe(true);

      const text = document.body.appendChild(document.createElement("input"));
      text.focus();
      expect(isIdle()).toBe(false);
    });
  });
});

describe("watchForUpdates", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("checks now and then, and when the app comes back into view or online", () => {
    vi.useFakeTimers({ toFake: ["setInterval"] });
    const update = vi.fn(() => Promise.resolve());

    watchForUpdates({ update } as unknown as ServiceWorkerRegistration);
    vi.advanceTimersByTime(updateCheckIntervalMs);
    expect(update).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
    expect(update).toHaveBeenCalledTimes(3);
  });
});
