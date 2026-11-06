import React, { useState } from "react";
import { Trash2 } from "lucide-react";

interface Props {
  /** e.g. "PO 410787" */
  label: string;
  kind: "purchase order" | "sales order";
  lineCount: number;
  /** Quantity already received/picked on this order (0 if none). */
  progressQty: number;
  onDelete: () => Promise<void>;
  onMessage: (message: string, type: "success" | "error") => void;
}

/**
 * Small trash icon shown on each order card. Asks for confirmation, then deletes the
 * order on the server for every device. It does NOT undo stock already moved in or out of bins.
 */
export default function OrderDeleteButton({ label, kind, lineCount, progressQty, onDelete, onMessage }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // don't open the order underneath
    if (busy) return;
    const warning =
      progressQty > 0
        ? `\n\nThis ${kind} already has ${progressQty} unit(s) ${kind === "purchase order" ? "received" : "picked"}. ` +
          `Deleting it does NOT reverse the bin stock that was already changed.`
        : "";
    if (!window.confirm(`Delete ${label} (${lineCount} lines) for everyone?${warning}\n\nThis cannot be undone. You can re-import it afterwards.`)) {
      return;
    }
    setBusy(true);
    try {
      await onDelete();
      onMessage(`Deleted ${label}`, "success");
    } catch (error: any) {
      onMessage(`Not deleted: ${error?.message || "server error"}. Try again.`, "error");
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title={`Delete ${label}`}
      aria-label={`Delete ${label}`}
      className="shrink-0 p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      <Trash2 size={18} />
    </button>
  );
}
