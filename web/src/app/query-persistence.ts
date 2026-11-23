import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { defaultShouldDehydrateQuery } from "@tanstack/react-query";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import { cacheMaxAge } from "@/app/query-client";
import { apiContractHash } from "@/lib/api-contract-hash";
import { startingApiBuild } from "@/lib/api-build";

/**
 * Saves the API cache to IndexedDB so the app can show the last-known data offline (read-only).
 * The buster is the API build the page started with, and a hash of the contract the front-end was
 * built against: a deploy that changes the API discards the saved copy (`api-build.ts` reloads
 * the app when it sees one), so saved data never comes from an older API than the one running. It's cleared on sign-out, and when someone other than
 * the last user signs in (the session store).
 */
export const persistOptions: PersistQueryClientProviderProps["persistOptions"] = {
  persister: createAsyncStoragePersister({
    storage: { getItem: get, setItem: set, removeItem: del },
    key: "wwg:query-cache",
  }),
  maxAge: cacheMaxAge,
  buster: `${apiContractHash}:${startingApiBuild ?? ""}`,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) && query.meta?.persist !== false,
  },
};
