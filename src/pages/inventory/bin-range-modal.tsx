import { X } from "lucide-react";

interface Props {
  filterMode: "aisle" | "range";
  aisle: string;
  startBin: string;
  endBin: string;
  onFilterMode: (mode: "aisle" | "range") => void;
  onAisle: (value: string) => void;
  onStartBin: (value: string) => void;
  onEndBin: (value: string) => void;
  onStart: () => void;
  onClose: () => void;
}

/** Choose the bins for a sequential count: a whole aisle, or a range of bin codes. */
export function BinRangeModal({
  filterMode, aisle, startBin, endBin, onFilterMode, onAisle, onStartBin, onEndBin, onStart, onClose,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Select Bins to Count</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Mode Toggle */}
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onFilterMode("aisle")}
              className={`py-2 px-4 rounded-md font-medium ${
                filterMode === "aisle"
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              By Aisle
            </button>
            <button
              onClick={() => onFilterMode("range")}
              className={`py-2 px-4 rounded-md font-medium ${
                filterMode === "range"
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              By Range
            </button>
          </div>
        </div>

        {/* Aisle Filter */}
        {filterMode === "aisle" && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Enter an aisle code to count all bins in that aisle (e.g., "01-1" for all bins starting with 01-1).
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Aisle Code</label>
                <input
                  type="text"
                  value={aisle}
                  onChange={(e) => onAisle(e.target.value.toUpperCase())}
                  placeholder="e.g., 01-1"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-lg"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will select all bins like: 01-1001, 01-1002, 01-1003, etc.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Range Filter */}
        {filterMode === "range" && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Enter the start and end bin codes to count all items within that range (inclusive).
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Bin Code</label>
                <input
                  type="text"
                  value={startBin}
                  onChange={(e) => onStartBin(e.target.value.toUpperCase())}
                  placeholder="e.g., 01-0001"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Bin Code</label>
                <input
                  type="text"
                  value={endBin}
                  onChange={(e) => onEndBin(e.target.value.toUpperCase())}
                  placeholder="e.g., 01-0100"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button
            onClick={onStart}
            className="flex-1 bg-green-600 text-white py-3 rounded-md hover:bg-green-700 font-medium text-lg"
          >
            Start Counting
          </button>
          <button
            onClick={onClose}
            className="px-4 bg-gray-200 text-gray-700 py-3 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
