import React from "react";
import { exportCSV, exportReceivingTxnsCSV, exportCycleCountTxnsCSV } from "../data/csv-utils";
import useServerStorage from "../hooks/useServerStorage";
import { Item, ReceivingTransaction, CycleCountTransaction } from "../types";

interface ExportPageProps {
  setPage: (page: "home" | "scan" | "export") => void;
}

export default function ExportPage({ setPage }: ExportPageProps) {
  const [data] = useServerStorage<Item[]>("rf_active", []);
  const [receivingTxns] = useServerStorage<ReceivingTransaction[]>("rf_receiving_txns", []);
  const [cycleCountTxns] = useServerStorage<CycleCountTransaction[]>("rf_cycle_count_txns", []);

  const handleExport = () => {
    if (!data || data.length === 0) {
      alert("No data available to export.");
      return;
    }
    exportCSV(data, "rf_inventory_results.csv");
  };

  const handleExportReceivingTxns = () => {
    exportReceivingTxnsCSV(receivingTxns, "receiving_transactions.csv");
  };

  const handleExportCycleCountTxns = () => {
    exportCycleCountTxnsCSV(cycleCountTxns, "cycle_count_transactions.csv");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900 px-6 text-center">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8 space-y-6">
        <h2 className="text-2xl font-bold text-green-600">✅ Exports</h2>
        <p className="text-gray-600">Download inventory results and transaction logs.</p>

        <div className="space-y-4 mt-6">
          <button
            onClick={handleExport}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium shadow hover:bg-blue-700 transition"
          >
            ⬇ Download Updated CSV
          </button>

          <button
            onClick={handleExportReceivingTxns}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium shadow hover:bg-blue-700 transition"
          >
            ⬇ Download Receiving Log CSV {receivingTxns.length > 0 ? `(${receivingTxns.length})` : ""}
          </button>

          <button
            onClick={handleExportCycleCountTxns}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium shadow hover:bg-indigo-700 transition"
          >
            ⬇ Download Cycle Count Log CSV {cycleCountTxns.length > 0 ? `(${cycleCountTxns.length})` : ""}
          </button>

          <button
            onClick={() => setPage("scan")}
            className="w-full bg-gray-200 hover:bg-gray-300 py-3 rounded-lg font-medium transition"
          >
            Back to Counting
          </button>

          <button
            onClick={() => setPage("home")}
            className="w-full bg-gray-100 hover:bg-gray-200 py-3 rounded-lg font-medium transition"
          >
            Return to Home
          </button>
        </div>

        {data.length > 0 && (
          <div className="mt-6 text-sm text-gray-500">
            <p>
              <span className="font-semibold">{data.length}</span> items ready for export.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
