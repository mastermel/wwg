import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { updateAndReload, watchForUpdates } from "@/lib/app-update";

/**
 * Registers the service worker and keeps the app up to date: when a new front-end has been
 * deployed and downloaded, it reloads into it as soon as nobody's typing or in a modal. No
 * prompt. (A new API build does the same, through `api-build.ts`.)
 */
export function AppUpdater() {
  const {
    needRefresh: [needRefresh],
  } = useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      if (registration) {
        watchForUpdates(registration);
      }
    },
  });

  useEffect(() => {
    if (needRefresh) {
      void updateAndReload({ whenIdle: true });
    }
  }, [needRefresh]);

  return null;
}
