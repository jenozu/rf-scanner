import React from "react";
import { Item } from "../types";

interface ProgressBarProps {
  data: Item[];
}

export default function ProgressBar({ data }: ProgressBarProps) {
  const counted = data.filter((d) => d.CountedQty !== undefined).length;
  const total = data.length;
  const percent = total ? ((counted / total) * 100).toFixed(1) : 0;

  return (
    <div className="mt-6">
      <p className="text-sm mb-1 text-gray-600">
        Bins Counted: {counted} / {total}
      </p>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-2 bg-primary rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
