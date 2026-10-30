import { useEffect, useRef, useSyncExternalStore } from "react";
import { api } from "../services/api";
import { DataStore, type SyncStatus } from "./store";

/** The one shared store for the whole app. */
export const dataStore = new DataStore(api, {
  focusTarget: typeof window !== "undefined" ? window : null,
  visibilityTarget: typeof document !== "undefined" ? document : null,
});

export interface Collection<T> {
  /** The server's data, or `initial` until the first load finishes. */
  data: T;
  /** True until the first load has finished (or failed). */
  isLoading: boolean;
  /** Message if the latest load failed; `data` is then the last good copy. */
  error: string | null;
  /** Revision of the data on screen (for conflict-checked whole-collection saves). */
  revision: string | null;
  /** Fetch again now. */
  reload: () => Promise<void>;
}

/**
 * Read a server collection. It loads when the page mounts, refreshes on window
 * focus and every 30 seconds, and updates after any change made through ops.ts.
 * Use { refresh: false } for large, rarely changing data to load it once only.
 */
export function useCollection<T>(
  key: string,
  initial: T,
  options: { refresh?: boolean } = {}
): Collection<T> {
  const initialRef = useRef(initial);
  const refresh = options.refresh !== false;

  useEffect(() => dataStore.retain(key, { refresh }), [key, refresh]);

  const snapshot = useSyncExternalStore(
    dataStore.subscribe,
    () => dataStore.getSnapshot(key),
    () => dataStore.getSnapshot(key)
  );

  return {
    data: snapshot.loaded && snapshot.data !== null ? (snapshot.data as T) : initialRef.current,
    isLoading: !snapshot.loaded && snapshot.error === null,
    error: snapshot.error,
    revision: snapshot.revision,
    reload: () => dataStore.load(key),
  };
}

/** Saving / failed / synced state for the indicator in the app shell. */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(dataStore.subscribe, dataStore.getStatus, dataStore.getStatus);
}
