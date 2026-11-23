/** Events closer together than this count as one return to the app. */
export const resumeDedupeMs = 5_000;

/**
 * Calls `callback` whenever the app comes back to the screen: on `visibilitychange` (when it
 * becomes visible), `pageshow` and window `focus`. On iOS an installed app hasn't always had
 * `visibilitychange` when brought back from the background, so the others back it up; the three
 * often fire together, so they count once within `resumeDedupeMs`. Returns a cleanup function.
 */
export function onResume(callback: () => void): () => void {
  let last = Number.NEGATIVE_INFINITY;
  const resumed = () => {
    if (document.visibilityState !== "visible") {
      return;
    }
    const now = Date.now();
    if (now - last < resumeDedupeMs) {
      return;
    }
    last = now;
    callback();
  };

  document.addEventListener("visibilitychange", resumed);
  window.addEventListener("pageshow", resumed);
  window.addEventListener("focus", resumed);
  return () => {
    document.removeEventListener("visibilitychange", resumed);
    window.removeEventListener("pageshow", resumed);
    window.removeEventListener("focus", resumed);
  };
}
