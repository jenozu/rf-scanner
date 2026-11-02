import { useState } from "react";
import type { BinLocation } from "../types";
import { classifyBin } from "../../server/ops-logic.js";

interface BinAssignPanelProps {
  itemCode: string;
  /** What the order line currently says (may be empty, SAP's system bin, or a warehouse code). */
  currentBin?: string;
  warehouse?: string;
  bins: BinLocation[];
  /** Saves the choice; throws with a readable message if it is refused. */
  onAssign: (binCode: string) => Promise<void>;
  /** Wording for other uses (receiving). The defaults are for picking. */
  heading?: string;
  explain?: string;
  actionLabel?: string;
  footer?: string;
  /** Extra one-tap choices, shown first (for example the staging area when receiving). */
  extraOptions?: Array<{ binCode: string; label: string }>;
}

/** Real bins that hold the item, most stock first. */
export function binsHoldingItem(bins: BinLocation[], itemCode: string, warehouse?: string) {
  const wanted = itemCode.trim().toUpperCase();
  return bins
    .filter((b) => classifyBin(b.BinCode, warehouse).real)
    .map((b) => ({
      binCode: b.BinCode,
      quantity: b.Items.filter((i) => i.ItemCode.trim().toUpperCase() === wanted).reduce((sum, i) => sum + (Number(i.Quantity) || 0), 0),
    }))
    .filter((b) => b.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity);
}

/**
 * Shown on a pick line that has no real bin. The picker must choose one before the line
 * can be picked. The choice is saved on the order line here; it does not change SAP.
 */
export default function BinAssignPanel({
  itemCode, currentBin, warehouse, bins, onAssign,
  heading = "This part has no real bin",
  explain,
  actionLabel = "Assign bin",
  footer = "This updates the order in this app only. Also set the item's Default Bin Location in SAP so future receipts go to the right place.",
  extraOptions = [],
}: BinAssignPanelProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const holding = binsHoldingItem(bins, itemCode, warehouse);
  const why = classifyBin(currentBin, warehouse).reason;

  const assign = async (binCode: string) => {
    const code = binCode.trim().toUpperCase();
    if (!code) {
      setError("Type or scan a bin code first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAssign(code);
      setTyped("");
    } catch (e: any) {
      setError(e?.message || "Could not assign the bin.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="alert" className="mb-4 rounded-lg border-2 border-red-500 bg-red-50 p-4 text-red-900">
      <p className="font-bold text-lg">{heading}</p>
      <p className="text-sm">
        {explain ?? `${why}. Choose where it is before picking. This line cannot be picked, and the order cannot finish, until you do.`}
      </p>

      {extraOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {extraOptions.map((o) => (
            <button
              key={o.binCode}
              type="button"
              disabled={busy}
              onClick={() => assign(o.binCode)}
              className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {holding.length > 0 ? (
        <div className="mt-3">
          <p className="text-sm font-semibold mb-1">Bins that hold {itemCode}:</p>
          <div className="flex flex-wrap gap-2">
            {holding.map((b) => (
              <button
                key={b.binCode}
                type="button"
                disabled={busy}
                onClick={() => assign(b.binCode)}
                className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
              >
                {b.binCode} <span className="font-normal">({b.quantity} in stock)</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm mt-3">No bin in the system shows stock of {itemCode}. Type the bin where you found it.</p>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") assign(typed); }}
          placeholder="Or type / scan a bin code"
          aria-label="Bin code"
          className="flex-1 rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-gray-900"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => assign(typed)}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
        >
          {busy ? "Saving..." : actionLabel}
        </button>
      </div>
      {error && <p className="text-sm font-semibold mt-2">{error}</p>}
      <p className="text-xs mt-3 text-red-800">{footer}</p>
    </div>
  );
}
