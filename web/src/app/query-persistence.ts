import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { defaultShouldDehydrateQuery } from "@tanstack/react-query";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import { cacheMaxAge } from "@/app/query-client";
import { apiContractHash } from "@/lib/api-contract-hash";

/**
 * Saves the API cache to IndexedDB so the app can show the last-known data offline (read-only).
 * The buster is a hash of the API contract: a deploy that changes it discards the saved copy, so
 * saved data never has an older shape than the code reading it. It's cleared on sign-out, and when someone other than
 * the last user signs in (the session store).
 */
export const persistOptions: PersistQueryClientProviderProps["persistOptions"] = {
  persister: createAsyncStoragePersister({
    storage: { getItem: get, setItem: set, removeItem: del },
    key: "wwg:query-cache",
  }),
  maxAge: cacheMaxAge,
  buster: apiContractHash,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) && query.meta?.persist !== false,
  },
};
