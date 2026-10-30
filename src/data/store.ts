/**
 * Shared data store: the server is the source of truth, this is the in-memory cache.
 *
 * - Pages read collections through useCollection (see hooks.ts); nothing here uses
 *   localStorage.
 * - Changes go through mutate(): it tracks "saving", waits for the server, then
 *   reloads the affected collections. A failed save is kept in status.saveError
 *   (visible in the UI) and rethrown, so the caller never shows a false success.
 * - Collections that are on screen refresh when the window regains focus and every
 *   30 seconds, so a receipt made on one device shows up on another.
 *
 * No React imports here: the store is plain TypeScript so it can be unit-tested.
 */

export interface DataApi {
  getDataWithRevision(key: string): Promise<{ data: any; revision: string | null }>;
}

export interface CollectionSnapshot {
  readonly data: any;
  readonly revision: string | null;
  /** True once the first load from the server has succeeded. */
  readonly loaded: boolean;
  /** True while the very first load is running. */
  readonly loading: boolean;
  /** Message from the latest failed load, cleared by the next successful one. */
  readonly error: string | null;
}

export interface SyncStatus {
  /** Number of saves in flight. */
  readonly pending: number;
  /** Message from the latest failed save; stays until dismissed or the next save succeeds. */
  readonly saveError: string | null;
  /** True if any collection's latest load failed (data on screen may be stale). */
  readonly loadFailed: boolean;
  /** When any collection last loaded from the server (ms since epoch). */
  readonly lastSyncedAt: number | null;
}

interface EventTargetLike {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface DataStoreOptions {
  /** How often on-screen collections refresh. Default 30 seconds. */
  intervalMs?: number;
  /** Target for the "focus" event (window in the app). */
  focusTarget?: EventTargetLike | null;
  /** Target for "visibilitychange" (document in the app). */
  visibilityTarget?: (EventTargetLike & { visibilityState?: string }) | null;
}

interface Entry {
  snapshot: CollectionSnapshot;
  /** Users of this collection that want it refreshed in the background. */
  liveRefs: number;
  refs: number;
  running: Promise<void> | null;
  queued: Promise<void> | null;
}

const INITIAL: CollectionSnapshot = { data: null, revision: null, loaded: false, loading: false, error: null };

const messageOf = (error: unknown) =>
  error instanceof Error && error.message ? error.message : "Something went wrong";

export class DataStore {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private status: SyncStatus = { pending: 0, saveError: null, loadFailed: false, lastSyncedAt: null };
  private timer: ReturnType<typeof setInterval> | null = null;
  private totalRefs = 0;
  private readonly intervalMs: number;

  constructor(private readonly api: DataApi, private readonly options: DataStoreOptions = {}) {
    this.intervalMs = options.intervalMs ?? 30_000;
  }

  // --- subscription (arrow functions so they can be passed straight to React) ---

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getStatus = (): SyncStatus => this.status;

  getSnapshot = (key: string): CollectionSnapshot => this.entry(key).snapshot;

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private entry(key: string): Entry {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { snapshot: INITIAL, liveRefs: 0, refs: 0, running: null, queued: null };
      this.entries.set(key, entry);
    }
    return entry;
  }

  private setSnapshot(key: string, patch: Partial<CollectionSnapshot>) {
    const entry = this.entry(key);
    entry.snapshot = { ...entry.snapshot, ...patch };
    const loadFailed = [...this.entries.values()].some((e) => e.snapshot.error !== null);
    if (loadFailed !== this.status.loadFailed) this.status = { ...this.status, loadFailed };
    this.notify();
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };
    this.notify();
  }

  // --- loading ---

  /**
   * Mark a collection as on screen: loads it now and keeps it fresh. Returns a release
   * function. Pass { refresh: false } for big, rarely changing collections (such as
   * the master inventory): they load once and are not re-downloaded every 30 s.
   */
  retain(key: string, options: { refresh?: boolean } = {}): () => void {
    const live = options.refresh !== false;
    const entry = this.entry(key);
    const firstUser = entry.refs === 0;
    entry.refs += 1;
    if (live) entry.liveRefs += 1;
    this.totalRefs += 1;
    // Show what is cached straight away, but re-check the server whenever a page that
    // wants fresh data opens (the cached copy may be old: another device or another
    // page may have changed it since). Load-once collections only load when missing.
    if ((!entry.snapshot.loaded && !entry.running) || (live && firstUser && entry.snapshot.loaded)) void this.load(key);
    this.startTimers();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      entry.refs -= 1;
      if (live) entry.liveRefs -= 1;
      this.totalRefs -= 1;
      if (this.totalRefs === 0) this.stopTimers();
    };
  }

  /**
   * Fetch a collection from the server. Loads for one key never overlap: a request
   * made while one is running waits for it and then fetches again, so a reload
   * after a save can never return data older than the save.
   */
  load(key: string): Promise<void> {
    const entry = this.entry(key);
    if (!entry.running) {
      entry.running = this.fetchOnce(key).finally(() => { entry.running = null; });
      return entry.running;
    }
    if (!entry.queued) {
      entry.queued = entry.running.then(() => {
        entry.queued = null;
        entry.running = this.fetchOnce(key).finally(() => { entry.running = null; });
        return entry.running;
      });
    }
    return entry.queued;
  }

  private async fetchOnce(key: string): Promise<void> {
    if (!this.entry(key).snapshot.loaded) this.setSnapshot(key, { loading: true });
    try {
      const { data, revision } = await this.api.getDataWithRevision(key);
      this.setSnapshot(key, { data, revision, loaded: true, loading: false, error: null });
      this.setStatus({ lastSyncedAt: Date.now() });
    } catch (error) {
      // Keep whatever was loaded before; the error shows in the status indicator.
      this.setSnapshot(key, { loading: false, error: messageOf(error) });
    }
  }

  /** Reload every collection that is currently on screen. */
  refreshVisible(): Promise<void[]> {
    const keys = [...this.entries.entries()].filter(([, e]) => e.liveRefs > 0).map(([k]) => k);
    return Promise.all(keys.map((key) => this.load(key)));
  }

  // --- saving ---

  /**
   * Run a server change. While it runs status.pending is above zero. On success the
   * listed collections are reloaded; on failure the error is recorded in
   * status.saveError and rethrown so the caller can react.
   */
  async mutate<R>(change: () => Promise<R>, options: { reload?: string[] } = {}): Promise<R> {
    this.setStatus({ pending: this.status.pending + 1 });
    try {
      const result = await change();
      this.setStatus({ saveError: null });
      await Promise.all((options.reload ?? []).map((key) => this.load(key)));
      return result;
    } catch (error) {
      this.setStatus({ saveError: messageOf(error) });
      throw error;
    } finally {
      this.setStatus({ pending: this.status.pending - 1 });
    }
  }

  dismissSaveError() {
    if (this.status.saveError) this.setStatus({ saveError: null });
  }

  // --- background refresh ---

  private onFocus = () => {
    if (this.options.visibilityTarget?.visibilityState === "hidden") return;
    void this.refreshVisible();
  };

  private startTimers() {
    if (this.timer) return;
    this.timer = setInterval(this.onFocus, this.intervalMs);
    this.options.focusTarget?.addEventListener("focus", this.onFocus);
    this.options.visibilityTarget?.addEventListener("visibilitychange", this.onFocus);
  }

  private stopTimers() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.options.focusTarget?.removeEventListener("focus", this.onFocus);
    this.options.visibilityTarget?.removeEventListener("visibilitychange", this.onFocus);
  }
}
