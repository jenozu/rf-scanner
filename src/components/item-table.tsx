import React from "react";
import { Check, X } from "lucide-react";
import { Item } from "../types";
import { displayBinCode } from "../utils/bin-utils";

interface ItemTableProps {
  items: Item[];
  onConfirm: (itemCode: string) => void;
  onAdjust: (itemCode: string) => void;
}

export default function ItemTable({ items, onConfirm, onAdjust }: ItemTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 text-left text-xs text-gray-600 uppercase tracking-wide">
            <th className="p-2">Item Code</th>
            <th className="p-2">Description</th>
            <th className="p-2 text-right">Expected</th>
            <th className="p-2 text-right">Counted</th>
            <th className="p-2 text-right">Variance</th>
            <th className="p-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            // Check if item has been counted
            const isCounted = item.CountedQty !== undefined && item.CountedQty !== null;
            
            // Color coding for variance
            const varianceColor =
              !isCounted
                ? "text-gray-400"
                : item.Variance === 0
                ? "text-green-600"
                : item.Variance! > 0
                ? "text-blue-600"
                : "text-red-600";

            return (
              <tr key={item.ItemCode} className="border-t hover:bg-gray-50">
                <td className="p-2 font-medium text-gray-900">{item.ItemCode}</td>
                <td className="p-2 text-gray-600">{item.Description}</td>
                <td className="p-2 text-right">{item.ExpectedQty}</td>
                <td className="p-2 text-right">
                  {isCounted ? (
                    item.CountedQty
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className={`p-2 text-right font-semibold ${varianceColor}`}>
                  {isCounted ? (
                    item.Variance! > 0 ? `+${item.Variance}` : item.Variance
                  ) : (
                    <span className="text-gray-400 font-normal">-</span>
                  )}
                </td>
                <td className="p-2 text-center">
                  <div className="flex justify-center space-x-2">
                    <button
                      onClick={() => onConfirm(item.ItemCode)}
                      className="flex items-center bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded-lg text-xs font-medium transition"
                    >
                      <Check size={14} className="mr-1" /> OK
                    </button>
                    <button
                      onClick={() => onAdjust(item.ItemCode)}
                      className="flex items-center bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded-lg text-xs font-medium transition"
                    >
                      <X size={14} className="mr-1" /> Fix
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
