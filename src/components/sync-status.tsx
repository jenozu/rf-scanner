import { useSyncStatus, dataStore } from "../data/hooks";

/**
 * Saved / saving / failed indicator for the top bar.
 *
 * In the bar itself it is just a coloured dot on phones (text from tablet width
 * up) so it never widens the bar. Anything the user must read or act on (a failed
 * save, a lost connection) is shown as a banner under the bar instead.
 */
export default function SyncStatus() {
  const status = useSyncStatus();

  if (status.saveError) {
    return (
      <div
        role="alert"
        className="fixed left-2 right-2 top-16 z-50 flex items-center justify-between gap-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg sm:left-auto sm:right-4 sm:max-w-md"
      >
        <span>Not saved: {status.saveError}</span>
        <button type="button" className="shrink-0 underline" onClick={() => dataStore.dismissSaveError()}>
          Dismiss
        </button>
      </div>
    );
  }

  if (status.loadFailed) {
    return (
      <div
        role="status"
        className="fixed left-2 right-2 top-16 z-50 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-lg sm:left-auto sm:right-4 sm:max-w-md"
      >
        Can't reach the server. What you see may be out of date.
      </div>
    );
  }

  if (status.pending > 0) {
    return (
      <span
        role="status"
        aria-label="Saving"
        className="inline-flex items-center rounded-full py-1 text-xs font-semibold text-amber-800 sm:gap-2 sm:bg-amber-100 sm:px-2"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        <span className="hidden sm:inline">Saving…</span>
      </span>
    );
  }

  if (status.lastSyncedAt === null) return null;

  return (
    <span
      role="status"
      aria-label="Synced"
      title={`Last synced ${new Date(status.lastSyncedAt).toLocaleTimeString()}`}
      className="inline-flex items-center rounded-full py-1 text-xs font-semibold text-emerald-800 sm:gap-2 sm:bg-emerald-100 sm:px-2"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      <span className="hidden sm:inline">Synced</span>
    </span>
  );
}
