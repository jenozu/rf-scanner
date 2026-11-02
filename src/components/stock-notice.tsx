import type { StockResult } from "../data/stock-check";

interface StockNoticeProps {
  result: StockResult | undefined;
  /** The quantity the picker has typed in, to warn when it is more than the bin shows. */
  enteredQty?: number;
}

function AlsoIn({ result }: { result: StockResult }) {
  if (result.elsewhere.length === 0) return null;
  return (
    <p className="text-sm mt-1">
      Also in: {result.elsewhere.map((o) => `${o.binCode} (${o.quantity})`).join(", ")}
    </p>
  );
}

/** Shows how much the bin holds against what this pick line needs. */
export default function StockNotice({ result, enteredQty }: StockNoticeProps) {
  if (!result) return null;

  const tooMany =
    result.available !== null && typeof enteredQty === "number" && enteredQty > result.available && result.status !== "ok";
  const tooManyOk =
    result.available !== null && typeof enteredQty === "number" && enteredQty > result.available && result.status === "ok";

  if (result.status === "none") {
    return (
      <div role="alert" className="mb-4 rounded-lg border-2 border-red-500 bg-red-50 p-4 text-red-900">
        <p className="font-bold text-lg">✕ No stock in this bin</p>
        <p className="text-sm">The system shows none here, and this line needs {result.needed}.</p>
        <AlsoIn result={result} />
      </div>
    );
  }

  if (result.status === "partial") {
    return (
      <div role="alert" className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-50 p-4 text-amber-900">
        <p className="font-bold text-lg">⚠ Short stock: only {result.available} in this bin</p>
        <p className="text-sm">
          This line needs {result.needed}, so it is short by {result.short}. Pick what is there and check the other bins.
        </p>
        <AlsoIn result={result} />
        {tooMany && (
          <p className="text-sm font-semibold mt-2">
            You entered {enteredQty}, but the bin shows {result.available}.
          </p>
        )}
      </div>
    );
  }

  if (result.status === "unknown-bin") {
    return (
      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        This bin is not in the system, so stock could not be checked.
      </div>
    );
  }

  if (result.status === "needs-bin") {
    return (
      <div className="mb-4 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-700">
        This line needs a real bin before stock can be checked.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
      <span className="font-semibold">✓ In stock:</span> {result.inBin} in this bin
      {tooManyOk && (
        <span className="block font-semibold mt-1">
          You entered {enteredQty}, but the bin shows {result.available} left for this line.
        </span>
      )}
    </div>
  );
}
