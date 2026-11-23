import { updateAndReload } from "@/lib/app-update";

/** Where the last API build seen is kept, across reloads and shared by every tab. */
const storageKey = "wwg:api-build";

function readSaved(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function save(build: string) {
  try {
    localStorage.setItem(storageKey, build);
  } catch {
    // Storage is blocked (some private windows): changes just aren't noticed.
  }
}

/**
 * The API build this page started with (the API's `X-Api-Build` header, as last seen), or null
 * on a first visit. Part of the offline cache's buster (`query-persistence.ts`), so data saved
 * from one API build is never restored for another.
 */
export const startingApiBuild: string | null = readSaved();

/** The API build this page is working with: the one it started with, or the first one seen. */
let pageBuild = startingApiBuild;

/**
 * Called with every API response's `X-Api-Build` header. When the API has changed since this
 * page started (a new deploy), it remembers the new build and reloads the app once nobody's
 * typing, picking up a new front-end at the same time. The new buster then drops the saved data.
 */
export function noteApiBuild(build: string | null): void {
  if (!build) {
    return;
  }
  if (readSaved() !== build) {
    save(build);
  }
  if (pageBuild === null) {
    pageBuild = build;
  } else if (build !== pageBuild) {
    void updateAndReload({ whenIdle: true });
  }
}
