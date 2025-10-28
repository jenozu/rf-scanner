import React from "react";
import { Check, X } from "lucide-react";

interface ItemCardProps {
  item: {
    BinCode: string;
    ItemCode: string;
    Description: string;
    ExpectedQty: number;
    CountedQty: number;
    Variance: number;
  };
  onConfirm: (itemCode: string) => void;
  onAdjust: (itemCode: string) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onConfirm, onAdjust }) => {
  const varianceColor =
    item.Variance === 0
      ? "text-green-600"
      : item.Variance > 0
      ? "text-blue-600"
      : "text-red-600";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
      {/* Top Section */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col">
          <h3 className="font-semibold text-gray-900 text-sm">{item.ItemCode}</h3>
          <p className="text-xs text-gray-500">{item.Description}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Bin</p>
          <p className="font-medium text-gray-800">{item.BinCode}</p>
        </div>
      </div>

      {/* Quantity Section */}
      <div className="grid grid-cols-3 gap-2 text-center mt-3">
        <div>
          <p className="text-xs text-gray-500">Expected</p>
          <p className="text-sm font-semibold text-gray-800">{item.ExpectedQty}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Counted</p>
          <p className="text-sm font-semibold text-gray-800">{item.CountedQty}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Variance</p>
          <p className={`text-sm font-semibold ${varianceColor}`}>
            {item.Variance > 0 ? `+${item.Variance}` : item.Variance}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between mt-4">
        <button
          onClick={() => onConfirm(item.ItemCode)}
          className="flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-700 w-[48%] py-2 rounded-lg font-medium transition"
        >
          <Check size={18} className="mr-1" /> Confirm
        </button>
        <button
          onClick={() => onAdjust(item.ItemCode)}
          className="flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-700 w-[48%] py-2 rounded-lg font-medium transition"
        >
          <X size={18} className="mr-1" /> Adjust
        </button>
      </div>
    </div>
  );
};

export default ItemCard;
