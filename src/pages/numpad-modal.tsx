import React, { useState, useEffect } from "react";
import { Item } from "../types";

interface NumpadModalProps {
  itemCode: string | null;
  onClose: () => void;
}

export default function NumpadModal({ itemCode, onClose }: NumpadModalProps) {
  const [item, setItem] = useState<Item | null>(null);
  const [value, setValue] = useState("");

  // Fetch item from localStorage when itemCode changes
  useEffect(() => {
    if (!itemCode) {
      onClose();
      return;
    }

    const data = JSON.parse(localStorage.getItem("rf_active") || "[]") as Item[];
    const foundItem = data.find((i) => i.ItemCode === itemCode);
    
    if (foundItem) {
      setItem(foundItem);
      setValue(foundItem.CountedQty?.toString() || "");
    } else {
      onClose();
    }
  }, [itemCode, onClose]);

  const handleKey = (num: string) => setValue((v) => v + num);
  const handleClear = () => setValue("");
  
  const handleSave = () => {
    if (!item) return;

    const qty = parseFloat(value) || 0;
    const data = JSON.parse(localStorage.getItem("rf_active") || "[]") as Item[];
    const updated = data.map((row) =>
      row.ItemCode === item.ItemCode
        ? {
            ...row,
            CountedQty: qty,
            Variance: qty - row.ExpectedQty,
          }
        : row
    );
    localStorage.setItem("rf_active", JSON.stringify(updated));
    onClose();
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-72 shadow-lg space-y-4">
        <h3 className="text-lg font-semibold text-center text-gray-800">
          Adjust Quantity
        </h3>
        <p className="text-sm text-center text-gray-500">{item.Description}</p>
        <p className="text-xs text-center text-gray-400">Item: {item.ItemCode}</p>

        <div className="text-center text-4xl font-bold py-3 border rounded-lg bg-gray-50">
          {value || "0"}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
            <button
              key={n}
              className="bg-gray-200 p-3 rounded-lg text-lg font-medium hover:bg-gray-300 transition"
              onClick={() => handleKey(n.toString())}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            onClick={handleClear}
            className="flex-1 bg-gray-100 py-2 rounded-lg font-medium hover:bg-gray-200 transition"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-primary text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
