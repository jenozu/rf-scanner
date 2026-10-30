import { useSyncStatus, dataStore } from "../data/hooks";

/** Small saved / saving / failed indicator for the top bar. */
export default function SyncStatus() {
  const status = useSyncStatus();

  if (status.saveError) {
    return (
      <span
        role="alert"
        className="inline-flex max-w-xs items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
      >
        <span className="truncate">Not saved: {status.saveError}</span>
        <button type="button" className="underline" onClick={() => dataStore.dismissSaveError()}>
          Dismiss
        </button>
      </span>
    );
  }

  if (status.pending > 0) {
    return (
      <span role="status" className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
        Saving…
      </span>
    );
  }

  if (status.loadFailed) {
    return (
      <span role="status" className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
        Can't reach server – data may be out of date
      </span>
    );
  }

  if (status.lastSyncedAt === null) return null;

  return (
    <span
      role="status"
      title={`Last synced ${new Date(status.lastSyncedAt).toLocaleTimeString()}`}
      className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
    >
      Synced
    </span>
  );
}
