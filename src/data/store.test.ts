import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DataStore, type DataApi } from "./store";

function fakeApi(initial: Record<string, any> = {}) {
  const server: Record<string, { data: any; revision: number }> = {};
  for (const [k, v] of Object.entries(initial)) server[k] = { data: v, revision: 1 };
  const calls: string[] = [];
  const api: DataApi & { fail: boolean; delay: number } = {
    fail: false,
    delay: 0,
    async getDataWithRevision(key) {
      calls.push(key);
      const snapshot = server[key] ?? { data: [], revision: 0 };
      if (api.delay) await new Promise((r) => setTimeout(r, api.delay));
      if (api.fail) throw new Error("server down");
      return { data: snapshot.data, revision: String(snapshot.revision) };
    },
  };
  return { api, server, calls };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("DataStore loading", () => {
  it("loads a collection when it is retained, with its revision", async () => {
    const { api } = fakeApi({ rf_bins: [{ BinCode: "A" }] });
    const store = new DataStore(api);
    const release = store.retain("rf_bins");
    expect(store.getSnapshot("rf_bins").loaded).toBe(false);
    await flush();
    const snap = store.getSnapshot("rf_bins");
    expect(snap.loaded).toBe(true);
    expect(snap.data).toEqual([{ BinCode: "A" }]);
    expect(snap.revision).toBe("1");
    release();
  });

  it("two users of one collection share a single first fetch", async () => {
    const { api, calls } = fakeApi({ rf_bins: [] });
    const store = new DataStore(api);
    const r1 = store.retain("rf_bins");
    const r2 = store.retain("rf_bins");
    await flush();
    expect(calls).toEqual(["rf_bins"]);
    r1(); r2();
  });

  it("keeps old data and reports the error when a refresh fails, then recovers", async () => {
    const { api } = fakeApi({ rf_bins: ["old"] });
    const store = new DataStore(api);
    const release = store.retain("rf_bins");
    await flush();
    api.fail = true;
    await store.load("rf_bins");
    expect(store.getSnapshot("rf_bins").data).toEqual(["old"]);
    expect(store.getSnapshot("rf_bins").error).toBe("server down");
    expect(store.getStatus().loadFailed).toBe(true);
    api.fail = false;
    await store.load("rf_bins");
    expect(store.getSnapshot("rf_bins").error).toBeNull();
    expect(store.getStatus().loadFailed).toBe(false);
    release();
  });

  it("returns the same snapshot object until something changes", async () => {
    const { api } = fakeApi({ rf_bins: [] });
    const store = new DataStore(api);
    const release = store.retain("rf_bins");
    await flush();
    expect(store.getSnapshot("rf_bins")).toBe(store.getSnapshot("rf_bins"));
    expect(store.getStatus()).toBe(store.getStatus());
    release();
  });

  it("notifies subscribers and stops after unsubscribe", async () => {
    const { api } = fakeApi({ rf_bins: [] });
    const store = new DataStore(api);
    const listener = vi.fn();
    const off = store.subscribe(listener);
    const release = store.retain("rf_bins");
    await flush();
    expect(listener).toHaveBeenCalled();
    listener.mockClear();
    off();
    await store.load("rf_bins");
    expect(listener).not.toHaveBeenCalled();
    release();
  });
});

describe("DataStore saving", () => {
  it("shows saving while the change runs, then reloads the affected collection", async () => {
    const { api, server } = fakeApi({ rf_bins: ["v1"] });
    const store = new DataStore(api);
    const release = store.retain("rf_bins");
    await flush();

    let finish!: () => void;
    const change = () => new Promise<string>((resolve) => {
      finish = () => { server.rf_bins = { data: ["v2"], revision: 2 }; resolve("done"); };
    });
    const saving = store.mutate(change, { reload: ["rf_bins"] });
    expect(store.getStatus().pending).toBe(1);
    finish();
    expect(await saving).toBe("done");
    expect(store.getStatus().pending).toBe(0);
    expect(store.getSnapshot("rf_bins").data).toEqual(["v2"]);
    release();
  });

  it("a failed save is rethrown and stays visible, never shown as saved", async () => {
    const { api } = fakeApi({});
    const store = new DataStore(api);
    await expect(store.mutate(async () => { throw new Error("HTTP 500"); })).rejects.toThrow("HTTP 500");
    expect(store.getStatus().pending).toBe(0);
    expect(store.getStatus().saveError).toBe("HTTP 500");
    // A later refresh success must not hide the failed save.
    await store.load("rf_bins");
    expect(store.getStatus().saveError).toBe("HTTP 500");
    // The next successful save clears it.
    await store.mutate(async () => "ok");
    expect(store.getStatus().saveError).toBeNull();
  });

  it("dismissSaveError clears the message", async () => {
    const { api } = fakeApi({});
    const store = new DataStore(api);
    await store.mutate(async () => { throw new Error("nope"); }).catch(() => {});
    store.dismissSaveError();
    expect(store.getStatus().saveError).toBeNull();
  });

  it("a reload after a save is never older than the save, even if a refresh was already in flight", async () => {
    const { api, server } = fakeApi({ rf_bins: ["v1"] });
    const store = new DataStore(api);
    const release = store.retain("rf_bins");
    await flush();

    api.delay = 100;
    const staleRefresh = store.load("rf_bins");      // starts, will return v1
    await vi.advanceTimersByTimeAsync(10);
    const saving = store.mutate(async () => { server.rf_bins = { data: ["v2"], revision: 2 }; }, { reload: ["rf_bins"] });
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all([staleRefresh, saving]);
    expect(store.getSnapshot("rf_bins").data).toEqual(["v2"]);
    release();
  });

  it("many saves at once all count and settle back to zero", async () => {
    const { api } = fakeApi({});
    const store = new DataStore(api);
    await Promise.all(Array.from({ length: 5 }, () => store.mutate(async () => 1)));
    expect(store.getStatus().pending).toBe(0);
  });
});

describe("DataStore background refresh", () => {
  it("refreshes on-screen collections every 30 seconds and stops when released", async () => {
    const { api, calls } = fakeApi({ rf_bins: [], rf_orders: [] });
    const store = new DataStore(api);
    const release = store.retain("rf_bins");
    await flush();
    store.getSnapshot("rf_orders"); // known but not on screen
    expect(calls).toEqual(["rf_bins"]);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls).toEqual(["rf_bins", "rf_bins"]);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls.filter((c) => c === "rf_bins")).toHaveLength(3);
    expect(calls).not.toContain("rf_orders");

    release();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(calls.filter((c) => c === "rf_bins")).toHaveLength(3);
  });

  it("refreshes when the window regains focus, but not while the page is hidden", async () => {
    const { api, calls } = fakeApi({ rf_bins: [] });
    const focusTarget = new EventTarget();
    const visibilityTarget = Object.assign(new EventTarget(), { visibilityState: "visible" });
    const store = new DataStore(api, { focusTarget, visibilityTarget });
    const release = store.retain("rf_bins");
    await flush();
    expect(calls).toHaveLength(1);

    focusTarget.dispatchEvent(new Event("focus"));
    await flush();
    expect(calls).toHaveLength(2);

    visibilityTarget.visibilityState = "hidden";
    focusTarget.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls).toHaveLength(2);

    visibilityTarget.visibilityState = "visible";
    visibilityTarget.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(calls).toHaveLength(3);

    release();
    focusTarget.dispatchEvent(new Event("focus"));
    await flush();
    expect(calls).toHaveLength(3);
  });

  it("uses a custom interval", async () => {
    const { api, calls } = fakeApi({ rf_bins: [] });
    const store = new DataStore(api, { intervalMs: 5_000 });
    const release = store.retain("rf_bins");
    await flush();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(calls).toHaveLength(2);
    release();
  });
});
