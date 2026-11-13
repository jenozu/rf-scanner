import { useState } from "react";
import { useCollection } from "../data/hooks";
import { decideVariance } from "../data/ops";
import { useAuth } from "../hooks/useAuth";

export interface CountVariance {
  id: string;
  status: "pending" | "approved" | "rejected";
  binCode: string;
  itemCode: string;
  description: string;
  heldQty: number;
  countedQty: number;
  variance: number;
  sessionName: string | null;
  submittedBy: string;
  submittedAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

/** Count differences waiting for an admin. Stock changes only when an admin approves one. */
export function VarianceApprovals() {
  const { data, isLoading, error } = useCollection<CountVariance[]>("rf_count_variances", []);
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const pending = (data || []).filter((v) => v.status === "pending");
  if (isLoading || (pending.length === 0 && !error)) return null;

  const decide = async (v: CountVariance, decision: "approve" | "reject") => {
    setBusy(v.id);
    setMessage(null);
    try {
      const result = await decideVariance(v.id, decision);
      if (decision === "approve" && result.changedSinceCount) {
        setMessage(`Approved. ${v.binCode} / ${v.itemCode} had moved from ${result.previousQty} since the count, so it is now ${result.newQty}.`);
      } else {
        setMessage(decision === "approve" ? `Approved: ${v.binCode} / ${v.itemCode} is now ${v.countedQty}.` : `Rejected. ${v.binCode} / ${v.itemCode} is unchanged.`);
      }
    } catch (e: any) {
      setMessage(`Could not ${decision} this variance: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4" aria-label="Pending count variances">
      <h3 className="font-semibold text-amber-900">
        Count variances waiting for approval ({pending.length})
      </h3>
      <p className="text-sm text-amber-800">
        Stock does not change until a variance is approved.
        {!isAdmin && " Only an admin can approve or reject these."}
      </p>
      {error && <p className="mt-2 text-sm text-red-700">Could not load variances: {error}</p>}
      {message && <p className="mt-2 text-sm text-gray-800">{message}</p>}
      <ul className="mt-3 divide-y divide-amber-200">
        {pending.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>
              <strong>{v.binCode}</strong> · {v.itemCode} {v.description && `(${v.description})`}: held {v.heldQty}, counted{" "}
              {v.countedQty} ({v.variance > 0 ? "+" : ""}{v.variance}) by {v.submittedBy}
              {v.sessionName && ` in ${v.sessionName}`}
            </span>
            {isAdmin && (
              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === v.id}
                  onClick={() => decide(v, "approve")}
                  className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy === v.id}
                  onClick={() => decide(v, "reject")}
                  className="rounded bg-gray-200 px-3 py-1 text-gray-800 hover:bg-gray-300 disabled:opacity-50"
                >
                  Reject
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
