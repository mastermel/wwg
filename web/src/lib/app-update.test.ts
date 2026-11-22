import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateAndReload } from "@/lib/app-update";

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
});
