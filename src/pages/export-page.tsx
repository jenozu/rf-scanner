import React from "react";
import { exportCSV, exportReceivingTxnsCSV, exportCycleCountTxnsCSV } from "../data/csv-utils";
import { useCollection } from "../data/hooks";
import { Item, ReceivingTransaction, CycleCountTransaction } from "../types";

interface ExportPageProps {
  setPage: (page: "home" | "scan" | "export") => void;
}

export default function ExportPage({ setPage }: ExportPageProps) {
  // The inventory file is large and rarely changes: load once. The logs refresh.
  const { data } = useCollection<Item[]>("rf_active", [], { refresh: false });
  const { data: receivingTxns } = useCollection<ReceivingTransaction[]>("rf_receiving_txns", []);
  const { data: cycleCountTxns } = useCollection<CycleCountTransaction[]>("rf_cycle_count_txns", []);

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
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="page-title">Exports</h1>
      <p className="page-lede">
        Download inventory results and transaction logs.
        {data.length > 0 && <> {data.length} items ready for export.</>}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          onClick={handleExport}
          className="bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition text-left"
        >
          Inventory results
          <span className="block text-sm font-normal text-blue-100">Updated CSV</span>
        </button>

        <button
          onClick={handleExportReceivingTxns}
          className="bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition text-left"
        >
          Receiving log
          <span className="block text-sm font-normal text-blue-100">
            {receivingTxns.length > 0 ? `${receivingTxns.length} transactions` : "No transactions yet"}
          </span>
        </button>

        <button
          onClick={handleExportCycleCountTxns}
          className="bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition text-left"
        >
          Cycle count log
          <span className="block text-sm font-normal text-blue-100">
            {cycleCountTxns.length > 0 ? `${cycleCountTxns.length} transactions` : "No transactions yet"}
          </span>
        </button>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setPage("scan")}
          className="bg-gray-100 hover:bg-gray-200 py-2 px-4 rounded-lg font-medium transition"
        >
          Back to counting
        </button>
        <button
          onClick={() => setPage("home")}
          className="bg-gray-100 hover:bg-gray-200 py-2 px-4 rounded-lg font-medium transition"
        >
          Dashboard
        </button>
      </div>
    </div>
  );
}
