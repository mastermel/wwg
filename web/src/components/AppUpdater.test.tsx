import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppUpdater } from "@/components/AppUpdater";

const pwa = vi.hoisted(() => ({
  needRefresh: false,
  onRegisteredSW: undefined as
    ((url: string, registration: ServiceWorkerRegistration | undefined) => void) | undefined,
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (options: { onRegisteredSW: typeof pwa.onRegisteredSW }) => {
    pwa.onRegisteredSW = options.onRegisteredSW;
    return {
      needRefresh: [pwa.needRefresh, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    };
  },
}));

const updateAndReload = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const watchForUpdates = vi.hoisted(() => vi.fn());
vi.mock("@/lib/app-update", () => ({ updateAndReload, watchForUpdates }));

describe("AppUpdater", () => {
  beforeEach(() => {
    pwa.needRefresh = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing until a new version is ready", () => {
    render(<AppUpdater />);

    expect(updateAndReload).not.toHaveBeenCalled();
  });

  it("reloads into a new version, once nobody's typing, without asking", () => {
    pwa.needRefresh = true;

    render(<AppUpdater />);

    expect(updateAndReload).toHaveBeenCalledWith({ whenIdle: true });
  });

  it("watches for new versions once the service worker is registered", () => {
    render(<AppUpdater />);
    const registration = {} as ServiceWorkerRegistration;

    pwa.onRegisteredSW?.("/sw.js", registration);

    expect(watchForUpdates).toHaveBeenCalledWith(registration);
  });
});
