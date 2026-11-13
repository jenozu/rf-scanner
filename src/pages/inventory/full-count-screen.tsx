import type React from "react";
import { CheckCircle2, Upload, X } from "lucide-react";
import type { CycleCount } from "../../types";
import { ToastBanner } from "./toast-banner";
import type { ToastState } from "./types";

interface Props {
  sessionName: string | undefined;
  items: CycleCount[];
  status: string;
  toast: ToastState;
  onCancel: () => void;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onProcess: () => void;
}

/** Upload a full count file and submit its counted quantities. */
export function FullCountScreen({ sessionName, items, status, toast, onCancel, onFile, onProcess }: Props) {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="text-yellow-600" />
          Full Inventory Count (Upload)
        </h1>
        <button
          onClick={onCancel}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm flex items-center gap-2"
        >
          <X size={16} />
          Cancel
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">1. Upload Count File</h2>
        <p className="text-gray-600 mb-4">
          Upload a CSV or Excel file containing your full inventory count. The file must contain the following columns: 
          <code className="font-mono bg-gray-100 p-1 rounded-md">BinCode</code>, 
          <code className="font-mono bg-gray-100 p-1 rounded-md">ItemCode</code>, 
          <code className="font-mono bg-gray-100 p-1 rounded-md">ExpectedQty</code>, and 
          <code className="font-mono bg-gray-100 p-1 rounded-md">CountedQty</code>.
        </p>
        
        <label className="block">
          <span className="sr-only">Choose file</span>
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={onFile}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-yellow-50 file:text-yellow-700
              hover:file:bg-yellow-100"
          />
        </label>
        <p className="mt-3 text-sm text-gray-500">{status}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">2. Process Count</h2>
        <p className="text-gray-600 mb-4">
          Once the file is uploaded and parsed, click the button below to submit the counted quantities in the current session. Counts that match are logged; any difference waits for admin approval before stock changes: 
          <span className="font-medium text-blue-600">{sessionName}</span>.
        </p>
        
        <button
          onClick={onProcess}
          disabled={items.length === 0}
          className={`w-full py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors ${
            items.length > 0
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          <CheckCircle2 size={20} />
          Process {items.length} Counted Items
        </button>
        
        {items.length > 0 && (
          <div className="mt-4 text-sm text-gray-500">
            <p>Items loaded: {items.length}</p>
            <p>Items marked as counted: {items.filter(c => c.Status === "counted").length}</p>
          </div>
        )}
      </div>

      {/* Toast */}
      <ToastBanner toast={toast} />
    </div>
  );
}
