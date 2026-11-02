import React, { useState } from "react";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";

export interface ManageableOrder {
  id: string;
  /** e.g. "PO 410787" */
  label: string;
  /** e.g. vendor or customer */
  detail: string;
  status: string;
  lineCount: number;
  /** Quantity already received/picked on this order (0 if none). */
  progressQty: number;
}

interface Props {
  title: string;
  kind: "purchase order" | "sales order";
  orders: ManageableOrder[];
  onDelete: (id: string) => Promise<void>;
  onMessage: (message: string, type: "success" | "error") => void;
}

/**
 * Lists every imported order (including finished ones, which the main list hides)
 * with a Delete button. Deleting removes the order from the server for every device.
 * It does NOT undo stock that was already moved in or out of bins.
 */
export default function ManageOrdersPanel({ title, kind, orders, onDelete, onMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (orders.length === 0) return null;

  const handleDelete = async (order: ManageableOrder) => {
    if (busyId) return;
    const warning =
      order.progressQty > 0
        ? `\n\nThis ${kind} already has ${order.progressQty} unit(s) ${kind === "purchase order" ? "received" : "picked"}. ` +
          `Deleting it does NOT reverse the bin stock that was already changed.`
        : "";
    if (!window.confirm(`Delete ${order.label} (${order.lineCount} lines) for everyone?${warning}\n\nThis cannot be undone. You can re-import it afterwards.`)) {
      return;
    }
    setBusyId(order.id);
    try {
      await onDelete(order.id);
      onMessage(`Deleted ${order.label}`, "success");
    } catch (error: any) {
      onMessage(`Not deleted: ${error?.message || "server error"}. Try again.`, "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-8 border rounded-lg bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left font-medium text-gray-800"
      >
        <span>{title} ({orders.length})</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && (
        <ul className="divide-y border-t">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{order.label}</p>
                <p className="text-xs text-gray-500 truncate">
                  {order.detail} • {order.lineCount} lines • {order.status.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(order)}
                disabled={busyId !== null}
                className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-red-700 border border-red-300 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={16} /> {busyId === order.id ? "Deleting..." : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
