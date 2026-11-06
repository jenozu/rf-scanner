import React from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ImportRun } from "../data/import-run";
import type { ImportReport } from "../data/sap-import";
import { summarizeImport } from "../data/import-summary";

export type ImportView = { run: ImportRun } | { error: string; report?: ImportReport };

const MAX_ROWS_SHOWN = 50;

/**
 * What an order import did: how many orders were added/updated, which rows were skipped and why,
 * and anything that needs a person. Nothing about an import is hidden in a console message.
 */
export default function ImportReportPanel({ view, onClose }: { view: ImportView; onClose: () => void }) {
  const failed = "error" in view;
  const report = failed ? view.report : view.run.report;
  const summary = failed ? null : summarizeImport(view.run.report, view.run.server);
  const attention = failed || summary!.tone === "attention";
  const skipped = report?.skipped ?? [];

  return (
    <div
      className={`mt-4 rounded-lg border p-4 text-left text-sm ${
        failed ? "border-red-300 bg-red-50" : attention ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"
      }`}
      role="status"
      data-testid="import-report"
    >
      <div className="flex items-start gap-2">
        {failed ? <XCircle className="mt-0.5 shrink-0 text-red-600" size={18} />
          : attention ? <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
          : <CheckCircle2 className="mt-0.5 shrink-0 text-green-600" size={18} />}
        <div className="flex-1">
          <p className="font-medium text-gray-900">{failed ? `Nothing was imported. ${view.error}` : summary!.headline}</p>
          {summary && summary.details.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-gray-700">
              {summary.details.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}
        </div>
        <button onClick={onClose} className="text-xs text-gray-500 underline" aria-label="Dismiss import report">Dismiss</button>
      </div>

      {skipped.length > 0 && (
        <details className="mt-3" open={failed}>
          <summary className="cursor-pointer font-medium text-gray-800">{skipped.length} row{skipped.length === 1 ? "" : "s"} not imported</summary>
          <table className="mt-2 w-full text-xs">
            <thead><tr className="text-left text-gray-500"><th className="pr-3">Row</th><th>Why</th></tr></thead>
            <tbody>
              {skipped.slice(0, MAX_ROWS_SHOWN).map((s) => (
                <tr key={`${s.row}-${s.reason}`} className="border-t border-black/5 align-top">
                  <td className="py-1 pr-3 font-mono">{s.row}</td>
                  <td className="py-1">{s.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {skipped.length > MAX_ROWS_SHOWN && <p className="mt-1 text-xs text-gray-500">…and {skipped.length - MAX_ROWS_SHOWN} more.</p>}
        </details>
      )}

      {report && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-gray-600">Columns read from the file</summary>
          <p className="mt-1 text-xs text-gray-600">
            Used: {Object.entries(report.columns.mapped).map(([role, header]) => `${header} (${role})`).join(", ") || "none"}
          </p>
          <p className="text-xs text-gray-600">All columns: {report.columns.found.join(", ") || "none"}</p>
        </details>
      )}
    </div>
  );
}
