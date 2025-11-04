import React, { useState } from "react";

interface QuantityNumpadProps {
  value: number;
  onChange: (value: number) => void;
  onClose: () => void;
  max?: number;
  label?: string;
}

export default function QuantityNumpad({
  value,
  onChange,
  onClose,
  max,
  label = "Enter Quantity",
}: QuantityNumpadProps) {
  const [inputValue, setInputValue] = useState(value.toString());

  const handleKey = (num: string) => {
    const newValue = inputValue === "0" ? num : inputValue + num;
    const numValue = parseFloat(newValue) || 0;
    if (!max || numValue <= max) {
      setInputValue(newValue);
    }
  };

  const handleClear = () => setInputValue("0");
  const handleBackspace = () => setInputValue((v) => v.slice(0, -1) || "0");

  const handleSave = () => {
    const numValue = parseFloat(inputValue) || 0;
    if (max && numValue > max) {
      onChange(max);
    } else {
      onChange(numValue);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-80 shadow-lg space-y-4">
        <h3 className="text-lg font-semibold text-center text-gray-800">
          {label}
        </h3>
        {max && (
          <p className="text-xs text-center text-gray-500">Max: {max}</p>
        )}

        <div className="text-center text-4xl font-bold py-4 border rounded-lg bg-gray-50">
          {inputValue || "0"}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              className="bg-gray-200 p-4 rounded-lg text-xl font-medium hover:bg-gray-300 transition active:bg-gray-400"
              onClick={() => handleKey(n.toString())}
            >
              {n}
            </button>
          ))}
          <button
            className="bg-gray-200 p-4 rounded-lg text-xl font-medium hover:bg-gray-300 transition active:bg-gray-400"
            onClick={() => handleKey("0")}
          >
            0
          </button>
          <button
            className="bg-gray-200 p-4 rounded-lg text-xl font-medium hover:bg-gray-300 transition active:bg-gray-400"
            onClick={handleBackspace}
          >
            ⌫
          </button>
          <button
            className="bg-gray-200 p-4 rounded-lg text-xl font-medium hover:bg-gray-300 transition active:bg-gray-400"
            onClick={handleClear}
          >
            Clear
          </button>
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

