import { useState } from "react";
import { api } from "../services/api";
import { dataStore } from "../data/hooks";
import {
  MIGRATION_LABELS,
  planMigration,
  readBrowserCollections,
  type MigrationRow,
} from "../data/migration";

type Step =
  | { name: "idle" }
  | { name: "checking" }
  | { name: "ready"; collections: Record<string, unknown>; rows: MigrationRow[] }
  | { name: "uploading" }
  | { name: "done"; results: Array<{ key: string; status: string; count: number; backup?: string }> }
  | { name: "error"; message: string };

const STATUS_TEXT: Record<string, string> = {
  uploaded: "Moved to the server",
  replaced: "Server copy replaced (old copy saved as a backup)",
  "skipped-not-empty": "Skipped: the server already had data",
  "skipped-empty-browser": "Nothing to move",
};

/**
 * Admin-only. Copies the warehouse data this device saved in its own browser (from
 * before data moved to the server) up to the server, once. Nothing on this device is
 * deleted. By default only collections that are empty on the server are filled;
 * replacing a collection that already has data is a separate, explicit choice.
 */
export default function MigrationCard() {
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [chosen, setChosen] = useState<Record<string, boolean>>({});

  const check = async () => {
    setStep({ name: "checking" });
    try {
      const collections = readBrowserCollections(window.localStorage);
      const { counts } = await api.getMigrationStatus();
      const rows = planMigration(collections, counts);
      // Collections the server doesn't have are ticked; ones it already has start unticked.
      setChosen(Object.fromEntries(rows.map((r) => [r.key, r.action === "upload"])));
      setStep({ name: "ready", collections, rows });
    } catch (error: any) {
      setStep({ name: "error", message: error?.message || "Could not check the server" });
    }
  };

  const upload = async () => {
    if (step.name !== "ready") return;
    const selected = step.rows.filter((r) => chosen[r.key]);
    if (selected.length === 0) return;
    const replacing = selected.filter((r) => r.action === "conflict");

    const message =
      `Move ${selected.length} collection(s) from this device to the server?\n\n` +
      (replacing.length > 0
        ? `These ALREADY have data on the server and will be replaced (the old server copy is saved as a backup file):\n` +
          replacing.map((r) => `  • ${r.label} (server: ${r.serverCount}, this device: ${r.browserCount})`).join("\n") +
          "\n\n"
        : "") +
      "Nothing on this device is deleted.";
    if (!window.confirm(message)) return;

    setStep({ name: "uploading" });
    try {
      const collections = Object.fromEntries(selected.map((r) => [r.key, step.collections[r.key]]));
      const { results } = await api.migrateBrowserData(collections, replacing.map((r) => r.key));
      // Show the new server data everywhere in the app straight away.
      await dataStore.refreshVisible();
      setStep({ name: "done", results });
    } catch (error: any) {
      setStep({ name: "error", message: error?.message || "The upload failed. Nothing was changed on this device." });
    }
  };

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-md space-y-3">
      <div>
        <p className="font-medium text-gray-900">Move this device's data to the server</p>
        <p className="text-sm text-gray-600 mt-1">
          Before data lived on the server, each device kept its own receiving, picking and counting
          work in its browser. Use this once on a device that has work you want to keep. Nothing on
          this device is deleted.
        </p>
      </div>

      {(step.name === "idle" || step.name === "error" || step.name === "done") && (
        <button
          type="button"
          onClick={check}
          className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition"
        >
          {step.name === "done" ? "Check this device again" : "Check this device"}
        </button>
      )}

      {step.name === "checking" && <p className="text-sm text-gray-600">Checking…</p>}
      {step.name === "uploading" && <p className="text-sm text-gray-600">Moving data to the server…</p>}

      {step.name === "error" && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {step.message}
        </p>
      )}

      {step.name === "ready" && step.rows.length === 0 && (
        <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded-md p-3">
          This device has no saved warehouse data to move.
        </p>
      )}

      {step.name === "ready" && step.rows.length > 0 && (
        <div className="space-y-3">
          <ul className="space-y-2">
            {step.rows.map((row) => (
              <li key={row.key} className="bg-white border border-gray-200 rounded-md p-3 text-sm">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4"
                    checked={!!chosen[row.key]}
                    onChange={(e) => setChosen({ ...chosen, [row.key]: e.target.checked })}
                  />
                  <span className="flex-1">
                    <span className="font-medium text-gray-900">{MIGRATION_LABELS[row.key] ?? row.key}</span>
                    <span className="block text-gray-600">
                      This device: {row.browserCount} · Server: {row.serverCount}
                    </span>
                    {row.action === "conflict" && (
                      <span className="block text-amber-800">
                        The server already has data. Tick to replace it with this device's copy (the old
                        server copy is saved as a backup file).
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={upload}
            disabled={!Object.values(chosen).some(Boolean)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            Move selected to the server
          </button>
        </div>
      )}

      {step.name === "done" && (
        <ul className="space-y-1 text-sm bg-white border border-gray-200 rounded-md p-3">
          {step.results.map((r) => (
            <li key={r.key}>
              <span className="font-medium">{MIGRATION_LABELS[r.key] ?? r.key}:</span>{" "}
              {STATUS_TEXT[r.status] ?? r.status}
              {r.count > 0 && r.status !== "skipped-not-empty" ? ` (${r.count})` : ""}
              {r.backup ? ` — backup: ${r.backup}` : ""}
            </li>
          ))}
          <li className="text-gray-600 pt-1">This device's own copy was left as it was.</li>
        </ul>
      )}
    </div>
  );
}
