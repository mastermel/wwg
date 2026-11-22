/** How long to wait for a newly found version to download before reloading anyway. */
const installTimeoutMs = 15_000;

/** Resolves once `worker` has installed (or failed to), or after the timeout. */
function installed(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, installTimeoutMs);
    const check = () => {
      if (worker.state !== "installing") {
        window.clearTimeout(timeout);
        worker.removeEventListener("statechange", check);
        resolve();
      }
    };
    worker.addEventListener("statechange", check);
    check();
  });
}

/**
 * The account menu's "Update and reload": asks the server for a newer version, and if one is
 * (or already was) waiting, activates it and reloads into it; otherwise just reloads. For when
 * the "Update available" prompt was dismissed or never showed. Offline, the check fails and the
 * page reloads from the cached app.
 */
export async function updateAndReload(): Promise<void> {
  const container = "serviceWorker" in navigator ? navigator.serviceWorker : undefined;
  const registration = await container?.getRegistration().catch(() => undefined);
  if (container && registration) {
    await registration.update().catch(() => undefined);
    if (registration.installing) {
      await installed(registration.installing);
    }
    // With no controller (a first visit) the new version activates by itself.
    if (registration.waiting && container.controller) {
      container.addEventListener("controllerchange", () => {
        window.location.reload();
      });
      // vite-plugin-pwa's service worker (registerType "prompt") listens for this.
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
  }
  window.location.reload();
}
