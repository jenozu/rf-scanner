import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Download } from "lucide-react";
import { ToastBanner } from "./toast-banner";
import type { SequentialCountItem, ToastState } from "./types";

interface Props {
  sessionName: string | undefined;
  items: SequentialCountItem[];
  index: number;
  numpadValue: string;
  countedQty: number;
  countedInSession: number;
  toast: ToastState;
  onExit: () => void;
  onExport: () => void;
  onNumpad: (key: string) => void;
  onTyped: (qty: number, raw: string) => void;
  onPrevious: () => void;
  onSkip: () => void;
}

/** Walks a counter through every item in a bin range or aisle, one at a time. */
export function SequentialCountScreen({
  sessionName, items, index, numpadValue, countedQty, countedInSession, toast,
  onExit, onExport, onNumpad, onTyped, onPrevious, onSkip,
}: Props) {
  const currentItem = items[index];
  const progress = ((index + 1) / items.length) * 100;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={onExit}
          className="text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardCheck className="text-green-600" />
          Counting: {sessionName}
        </h1>
        <button
          onClick={() => {
            if (confirm("Export current session logs?")) {
              onExport();
            }
          }}
          className="text-blue-600 hover:text-blue-800"
        >
          <Download size={20} />
        </button>
      </div>

      {/* Toast */}
      <ToastBanner toast={toast} />

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Item {index + 1} of {items.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-green-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Item Card */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm text-gray-600">Bin Location</label>
            <div className="text-2xl font-bold text-blue-600">{currentItem.binCode}</div>
          </div>
          <div>
            <label className="text-sm text-gray-600">Zone</label>
            <div className="text-2xl font-bold text-gray-800">{currentItem.zone}</div>
          </div>
        </div>

        <div className="mb-6">
          <label className="text-sm text-gray-600">Item Code</label>
          <div className="text-xl font-bold text-gray-900">{currentItem.itemCode}</div>
        </div>

        <div className="mb-6">
          <label className="text-sm text-gray-600">Description</label>
          <div className="text-gray-800">{currentItem.description}</div>
        </div>

        <div className="mb-6 p-4 bg-blue-50 rounded-md">
          <label className="text-sm text-gray-600">Expected Quantity</label>
          <div className="text-3xl font-bold text-blue-600">{currentItem.expectedQty}</div>
        </div>

        {/* Quantity Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Counted Quantity</label>
          <input
            type="number"
            value={numpadValue || countedQty}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              onTyped(val, e.target.value);
            }}
            className="w-full text-3xl font-bold text-center border-2 border-gray-300 rounded-md p-4"
            autoFocus
          />
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"].map((btn) => (
            <button
              key={btn}
              onClick={() => onNumpad(String(btn))}
              className={`py-4 text-2xl font-bold rounded-md ${
                btn === "OK"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : btn === "C"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {btn === "OK" ? "✓" : btn}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onPrevious}
            disabled={index === 0}
            className="py-3 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <ChevronLeft size={20} />
            Previous
          </button>
          <button
            onClick={onSkip}
            disabled={index >= items.length - 1}
            className="py-3 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Skip
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Session Stats */}
      {sessionName !== undefined && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Session Statistics</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Items Counted:</span>
              <span className="ml-2 font-bold">{countedInSession}</span>
            </div>
            <div>
              <span className="text-gray-600">Remaining:</span>
              <span className="ml-2 font-bold">{Math.max(0, items.length - index)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
