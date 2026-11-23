/** How long to wait for a newly found version to download before reloading anyway. */
const installTimeoutMs = 15_000;

/** How often to look again, while waiting for the user to stop typing. */
const idleCheckMs = 1_000;

/** How often a running app asks the server for a new front-end. */
export const updateCheckIntervalMs = 5 * 60 * 1000;

/** Fields that take typed text: reloading while one has focus would lose what's being typed. */
const textFields =
  "textarea, select, [contenteditable]:not([contenteditable='false']), " +
  "input:not([type='button'], [type='checkbox'], [type='radio'], [type='range'], [type='reset'], [type='submit'])";

/**
 * Whether the app can reload without losing anything: no text field has focus and no modal is
 * open. Drawers don't count: the map's hex drawer stays open while the map is in use, and its
 * fields are covered by the focus check.
 */
export function isIdle(): boolean {
  return (
    !document.activeElement?.matches(textFields) &&
    document.querySelector(".mantine-Modal-root") === null
  );
}

/** Resolves once the app is idle (at once if it already is). */
function idle(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (isIdle()) {
        window.clearInterval(timer);
        resolve();
      }
    };
    const timer = window.setInterval(check, idleCheckMs);
    check();
  });
}

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

async function update({ whenIdle }: { whenIdle: boolean }): Promise<void> {
  const container = "serviceWorker" in navigator ? navigator.serviceWorker : undefined;
  const registration = await container?.getRegistration().catch(() => undefined);
  if (container && registration) {
    await registration.update().catch(() => undefined);
    if (registration.installing) {
      await installed(registration.installing);
    }
  }

  if (whenIdle) {
    await idle();
  }

  // With no controller (a first visit) the new version activates by itself.
  if (container?.controller && registration?.waiting) {
    container.addEventListener("controllerchange", () => {
      window.location.reload();
    });
    // vite-plugin-pwa's service worker (registerType "prompt") listens for this.
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return;
  }
  window.location.reload();
}

let pending: Promise<void> | undefined;

/**
 * Asks the server for a newer version of the app, and if one is (or already was) waiting,
 * activates it and reloads into it; otherwise just reloads. Offline, the check fails and the page
 * reloads from the cached app.
 *
 * With `whenIdle` (an automatic update: a new front-end or API was found) it waits until nobody's
 * typing or in a modal first. Without it (the account menu's "Update and reload") it goes at once.
 */
export function updateAndReload({ whenIdle = false }: { whenIdle?: boolean } = {}): Promise<void> {
  if (!whenIdle) {
    return update({ whenIdle });
  }
  pending ??= update({ whenIdle }).finally(() => {
    pending = undefined;
  });
  return pending;
}

/**
 * Asks the server for a new service worker (a new front-end) now and then: on an interval, and
 * whenever the app comes back into view or back online. Browsers only look by themselves on a
 * page load, which an open app or installed PWA may not have for days.
 */
export function watchForUpdates(registration: ServiceWorkerRegistration): void {
  const check = () => {
    if (navigator.onLine && document.visibilityState === "visible") {
      registration.update().catch(() => undefined);
    }
  };
  window.setInterval(check, updateCheckIntervalMs);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("online", check);
}
