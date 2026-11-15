import { X } from "lucide-react";
import type { BinLocation } from "../../types";

/** What a scanned bin holds. */
export function BinInfoModal({ bin, onClose }: { bin: BinLocation; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Bin: {bin.BinCode}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 rounded-md">
          <div className="text-sm text-gray-600 mb-1">Zone</div>
          <div className="text-lg font-bold text-blue-900">{bin.Zone}</div>
        </div>

        <div className="mb-2">
          <h4 className="font-semibold text-gray-700 mb-2">Items in This Bin:</h4>
        </div>

        {bin.Items && bin.Items.length > 0 ? (
          <div className="space-y-3">
            {bin.Items.map((item, index) => (
              <div key={index} className="border border-gray-300 rounded-md p-3 bg-gray-50">
                <div className="font-medium text-gray-900">{item.ItemCode}</div>
                <div className="text-sm text-gray-600 mt-1">{item.Description}</div>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-sm text-gray-600">Expected Qty:</span>
                  <span className="font-bold text-lg text-green-600">{item.Quantity}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-4">
            No items in this bin
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
