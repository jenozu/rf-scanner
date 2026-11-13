import React, { useState, useEffect, useRef, useMemo } from "react";
import { BinLocation, PickWave, SalesOrder, SOItem } from "../types";
import { useCollection, dataStore } from "../data/hooks";
import { assignSoBin, pickSalesOrderLine, deleteRecord, createWave, deleteWave } from "../data/ops";
import OrderDeleteButton from "../components/order-delete-button";
import { checkStock, summarizeStock } from "../data/stock-check";
import StockNotice from "../components/stock-notice";
import BinAssignPanel from "../components/bin-assign-panel";
import WarehouseBadge from "../components/warehouse-badge";
import { classifyBin } from "../../server/ops-logic.js";
import { hasOpenLines, ordersInOpenWaves, waveMembers, waveProgress } from "../../server/waves.js";
import { compareBinCodes } from "../utils/bin-order";
import { useAuth } from "../hooks/useAuth";
import { errorCode, errorDetail, findLine, lineRef, newTxnId, sameItemCode, type LineRef } from "../data/line-ref";
import { Truck, Package, MapPin, Check, ShoppingCart } from "lucide-react";

type SoPick = { so: SalesOrder; item: SOItem; lineIndex: number; ref: LineRef };

// What the picker is working on: one sales order, or a wave of several.
type ActivePick = { title: string; subtitle: string };

interface PickPageProps {
  setPage: (page: any) => void;
}

// Real bins first, then bin order (numeric-aware, so "10" comes after "2").
function sortForPicking(picks: SoPick[]): SoPick[] {
  return picks.sort((a, b) => {
    const realA = classifyBin(a.item.BinCode, a.item.Warehouse).real;
    const realB = classifyBin(b.item.BinCode, b.item.Warehouse).real;
    if (realA !== realB) return realA ? 1 : -1;
    return compareBinCodes(a.item.BinCode || "", b.item.BinCode || "");
  });
}

// Lines of one order that still have something to pick.
function openPicks(so: SalesOrder): SoPick[] {
  const picks: SoPick[] = [];
  so.items.forEach((item, lineIndex) => {
    // Lines SAP no longer lists are closed: they cannot be picked.
    if ((item.RemainingQty || 0) > 0 && !item.SapClosed) picks.push({ so, item, lineIndex, ref: lineRef(item, lineIndex) });
  });
  return picks;
}

export default function PickPage({ setPage }: PickPageProps) {
  // Shared server data (the same on every device); refreshes on focus and every 30 s.
  const { data: waves } = useCollection<PickWave[]>("rf_pick_waves", []);
  const { data: salesOrders } = useCollection<SalesOrder[]>("rf_sales_orders", []);
  const { data: bins } = useCollection<BinLocation[]>("rf_bins", []);
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const [isSaving, setIsSaving] = useState(false);
  // Sales orders ticked for the next wave (admin only).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creatingWave, setCreatingWave] = useState(false);
  // Set while a sales order or a wave is being picked; null on the list screens.
  const [activePick, setActivePick] = useState<ActivePick | null>(null);
  // ref = the line's key (or its position for orders from before line keys): picks act on that exact line.
  const [soPickList, setSoPickList] = useState<SoPick[]>([]);
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  const [pickedQty, setPickedQty] = useState<number>(0);
  // Confirming a pick: the item must be scanned; a quantity below what is open is a short pick
  // and needs a reason; a bin that shows less stock than the pick needs a deliberate "take it anyway".
  const [scanText, setScanText] = useState("");
  const [scanTried, setScanTried] = useState(false);
  const [shortReason, setShortReason] = useState("");
  const [shortfallPrompt, setShortfallPrompt] = useState<{ available: number; requested: number } | null>(null);
  const pickTxnId = useRef<string | null>(null); // kept across a retry of the same pick, so a lost reply cannot pick twice
  const sessionHadShort = useRef(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  // Wave bookkeeping, all worked out from the sales orders on the server.
  const sosById = useMemo(() => Object.fromEntries(salesOrders.map((s) => [s.id, s])), [salesOrders]);
  const orderIdsInOpenWaves = useMemo(() => ordersInOpenWaves(waves, sosById), [waves, sosById]);
  const openWaveOf = (soId: string) =>
    waves.find((w) => w.soIds.includes(soId) && waveProgress(w, sosById).status !== "completed");
  const isPickable = (so: SalesOrder) =>
    (so.status === "pending" || so.status === "picking") && hasOpenLines(so);
  const canAddToWave = (so: SalesOrder) => isPickable(so) && !orderIdsInOpenWaves.has(so.id);
  const activeWaves = waves.filter((w) => waveProgress(w, sosById).status !== "completed");

  const startPicks = (picks: SoPick[], pick: ActivePick) => {
    sessionHadShort.current = false;
    setSoPickList(sortForPicking(picks));
    setCurrentPickIndex(0);
    setActivePick(pick);
    // The order becomes "picking" on the server with the first confirmed pick.
  };

  const handleSelectSalesOrder = (so: SalesOrder) => {
    startPicks(openPicks(so), { title: `SO #${so.soNumber}`, subtitle: so.customer });
  };

  // A wave's pick list is every open line of every order in it, sorted by bin.
  const handleStartWave = (wave: PickWave) => {
    const members = waveMembers(wave, sosById) as SalesOrder[];
    const picks = members.flatMap((so) => openPicks(so));
    startPicks(picks, {
      title: `Wave ${wave.waveNumber}`,
      subtitle: `${members.length} ${members.length === 1 ? "order" : "orders"}`,
    });
  };

  const exitPicks = () => {
    setActivePick(null);
    setSoPickList([]);
    setCurrentPickIndex(0);
  };

  // The order line as the server has it now (its bin may have been assigned since the list was built).
  const liveLine = (entry: SoPick) =>
    findLine(salesOrders.find((s) => s.id === entry.so.id)?.items, entry.ref)?.line ?? entry.item;

  // Remaining quantity for a pick line, from the latest server data (another
  // device may have picked from the same line since this list was built).
  const liveRemaining = (entry: SoPick) => liveLine(entry).RemainingQty || 0;

  const resetPickInputs = () => {
    setScanText("");
    setScanTried(false);
    setShortReason("");
    setShortfallPrompt(null);
    pickTxnId.current = null;
  };

  const advanceAfterPick = () => {
    const nextIndex = currentPickIndex + 1;
    resetPickInputs();
    if (nextIndex >= soPickList.length) {
      showToast(sessionHadShort.current ? "Picking finished: some lines are still open (short)" : "🎉 Picking completed!", "success");
      setTimeout(() => exitPicks(), 2000);
    } else {
      setCurrentPickIndex(nextIndex);
      setPickedQty(liveRemaining(soPickList[nextIndex]));
    }
  };

  // Confirm pick
  const handleConfirmSOPick = async (acceptShortfall = false) => {
    if (currentPickIndex >= soPickList.length || !activePick || isSaving) return;

    const currentPick = soPickList[currentPickIndex];
    const { so, item } = currentPick;
    const line = liveLine(currentPick);
    const remainingQty = liveRemaining(currentPick);

    if (line.SapClosed) {
      showToast("⚠️ This line is closed in SAP and cannot be picked", "error");
      return;
    }
    if (remainingQty <= 0) {
      showToast("This line was already fully picked (another picker finished it)", "info");
      advanceAfterPick();
      return;
    }
    if (!(pickedQty >= 0)) {
      showToast("⚠️ Enter the quantity you picked", "error");
      return;
    }
    if (pickedQty > remainingQty) {
      showToast(`⚠️ Only ${remainingQty} left to pick on this line`, "error");
      return;
    }
    const isShort = pickedQty < remainingQty;
    if (pickedQty === 0 && !isShort) return;
    if (isShort && !shortReason.trim()) {
      setScanTried(true);
      showToast("⚠️ Picking less than is open: say why (short pick)", "error");
      return;
    }
    if (pickedQty > 0 && !sameItemCode(scanText, item.ItemCode)) {
      setScanTried(true);
      showToast(`⚠️ Scan ${item.ItemCode} to confirm the item`, "error");
      return;
    }
    if (pickedQty > 0 && !classifyBin(line.BinCode, line.Warehouse).real) {
      showToast("⚠️ Assign a real bin to this line before picking it", "error");
      return;
    }

    setIsSaving(true);
    try {
      pickTxnId.current ??= newTxnId("PICK");
      // One request: the exact line + stock from its bin + pick log. The server re-checks everything.
      const result = await pickSalesOrderLine({
        soId: so.id,
        ...currentPick.ref,
        qty: pickedQty,
        txnId: pickTxnId.current,
        scannedCode: pickedQty > 0 ? scanText.trim() : undefined,
        short: isShort ? { reason: shortReason.trim() } : undefined,
        acceptShortfall: acceptShortfall || undefined,
      });
      setIsSaving(false);
      if (isShort) sessionHadShort.current = true;
      const extra = result.shortfall ? ` (bin showed ${result.shortfall} fewer: logged)` : "";
      showToast(
        pickedQty === 0
          ? `Reported short: ${item.Description}`
          : `✅ Picked ${pickedQty} of ${item.Description}${isShort ? " (short)" : ""}${extra}`,
        "success"
      );
      advanceAfterPick();
    } catch (error: any) {
      setIsSaving(false);
      const code = errorCode(error);
      // These refusals are handled right here on the screen, so the global "Not saved" banner is just noise.
      if (code) dataStore.dismissSaveError();
      if (code === "INSUFFICIENT_BIN_STOCK") {
        // Nothing was changed. Ask the picker to confirm taking more than the bin shows.
        setShortfallPrompt({
          available: errorDetail<number>(error, "available") ?? 0,
          requested: errorDetail<number>(error, "requested") ?? pickedQty,
        });
        return;
      }
      pickTxnId.current = null; // the server refused it, so this attempt is over
      if (code === "OVER_PICK") {
        const left = errorDetail<number>(error, "remaining") ?? 0;
        showToast(`⚠️ Only ${left} left on this line: someone else picked it. Quantity updated.`, "error");
        setPickedQty(left);
        void dataStore.refreshVisible();
      } else if (code === "SCAN_MISMATCH") {
        setScanText("");
        setScanTried(true);
        showToast(`❌ Wrong item scanned: this line is ${item.ItemCode}`, "error");
      } else if (code === "LINE_CLOSED") {
        showToast("⚠️ This line was closed by a SAP import. Skipping it.", "error");
        void dataStore.refreshVisible();
      } else {
        showToast(`❌ Pick not saved: ${error?.message || "server error"}. Try again.`, "error");
      }
    }
  };

  const toggleSelected = (soId: string) => {
    setSelectedIds((ids) => (ids.includes(soId) ? ids.filter((id) => id !== soId) : [...ids, soId]));
  };

  const handleCreateWave = async () => {
    // Only orders that can still go in a wave; anything that changed since it was ticked is dropped.
    const soIds = selectedIds.filter((id) => {
      const so = sosById[id];
      return so && canAddToWave(so);
    });
    if (soIds.length === 0) {
      showToast("Tick at least one sales order that is not already in a wave", "error");
      return;
    }
    setCreatingWave(true);
    try {
      const { wave } = await createWave(soIds);
      setSelectedIds([]);
      showToast(`✅ Wave ${wave.waveNumber} created with ${soIds.length} ${soIds.length === 1 ? "order" : "orders"}`, "success");
    } catch (error: any) {
      showToast(`❌ Wave not created: ${error?.message || "server error"}`, "error");
    } finally {
      setCreatingWave(false);
    }
  };

  const handleDeleteWave = async (wave: PickWave) => {
    try {
      await deleteWave(wave.id);
      showToast(`Wave ${wave.waveNumber} deleted`, "info");
    } catch (error: any) {
      showToast(`❌ Wave not deleted: ${error?.message || "server error"}`, "error");
    }
  };

  // Confirm/skip/start effects keep the picking inputs in step with the current line.
  useEffect(() => {
    resetPickInputs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPickIndex, activePick]);

  // Initialize picked qty when pick changes
  useEffect(() => {
    if (soPickList.length > 0 && currentPickIndex < soPickList.length) {
      setPickedQty(liveRemaining(soPickList[currentPickIndex]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPickIndex, soPickList]);

  // Filter Sales Orders that need picking
  const pendingSalesOrders = salesOrders.filter((so) => so.status === "pending" || so.status === "picking");

  const toastBanner = toast && (
    <div
      className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg ${
        toast.type === "success"
          ? "bg-green-500 text-white"
          : toast.type === "error"
          ? "bg-red-500 text-white"
          : "bg-blue-500 text-white"
      }`}
    >
      {toast.message}
    </div>
  );

  // Render picking workflow (one sales order or one wave)
  if (activePick && currentPickIndex < soPickList.length) {
    const currentPick = soPickList[currentPickIndex];
    const { so, item } = currentPick;
    const progress = ((currentPickIndex / soPickList.length) * 100).toFixed(0);
    // Stock check for every line in pick order, so two lines of one item in one bin share its stock.
    const stockResults = checkStock(
      soPickList.map((entry) => ({
        binCode: liveLine(entry).BinCode,
        warehouse: liveLine(entry).Warehouse,
        itemCode: entry.item.ItemCode,
        needed: liveRemaining(entry),
      })),
      bins
    );
    const stock = stockResults[currentPickIndex];
    const current = liveLine(currentPick);
    const needsBin = !classifyBin(current.BinCode, current.Warehouse).real;

    return (
      <div className="p-4 max-w-4xl mx-auto">
        <button onClick={exitPicks} className="mb-4 text-blue-600 hover:underline">
          ← Back to Sales Orders
        </button>

        {toastBanner}

        {/* Progress Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold">
              {activePick.title} <span className="text-sm font-normal text-gray-500">{activePick.subtitle}</span>
            </h2>
            <span className="text-sm text-gray-600">
              {currentPickIndex + 1} / {soPickList.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Current Pick */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="text-blue-600" size={24} />
            <div>
              <h3 className="text-2xl font-bold">{needsBin ? "No real bin" : current.BinCode}</h3>
              <p className="text-sm text-gray-600">{needsBin ? "Assign a bin below" : "Pick from this location"}</p>
            </div>
          </div>

          <div className="border-t pt-4 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <Package className="text-gray-600 mt-1" size={20} />
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{item.Description}</h4>
                <p className="text-sm text-gray-600">Code: {item.ItemCode}</p>
                <WarehouseBadge warehouse={current.Warehouse} />
                <p className="text-sm text-gray-600">SO: {so.soNumber}</p>
                <p className="text-sm text-gray-600">Customer: {so.customer}</p>
              </div>
            </div>

            {needsBin ? (
              <BinAssignPanel
                itemCode={item.ItemCode}
                currentBin={current.BinCode}
                warehouse={current.Warehouse}
                bins={bins}
                onAssign={async (binCode) => {
                  await assignSoBin({ soId: so.id, ...currentPick.ref, binCode });
                  showToast(`✅ Bin ${binCode} assigned`, "success");
                }}
              />
            ) : (
              <StockNotice result={stock} enteredQty={pickedQty} />
            )}

            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-center text-3xl font-bold text-blue-600">
                {current.RemainingQty || 0}
              </p>
              <p className="text-center text-sm text-gray-600">Remaining Quantity</p>
              <p className="text-center text-xs text-gray-500 mt-1">
                {current.DeliveredQty || 0} of {current.OrderedQty} already delivered
              </p>
            </div>

            {!needsBin && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" htmlFor="so-scan">
                  Scan the item ({item.ItemCode})
                </label>
                <input
                  id="so-scan"
                  autoFocus
                  autoComplete="off"
                  value={scanText}
                  onChange={(e) => setScanText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setScanTried(true); }}
                  placeholder="Scan or type the item code"
                  className={`w-full border rounded-md px-4 py-3 text-lg ${
                    scanText && sameItemCode(scanText, item.ItemCode) ? "border-green-500 bg-green-50" : "border-gray-300"
                  }`}
                />
                {scanText && sameItemCode(scanText, item.ItemCode) && (
                  <p className="text-sm text-green-700 mt-1">✓ Right item</p>
                )}
                {scanTried && scanText && !sameItemCode(scanText, item.ItemCode) && (
                  <p className="text-sm text-red-600 mt-1">That is not {item.ItemCode}. Scan the item on this line.</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Picked Quantity
              </label>
              <input
                type="number"
                value={pickedQty}
                onChange={(e) => setPickedQty(Number(e.target.value))}
                min={0}
                max={current.RemainingQty || 0}
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-lg"
              />
            </div>

            {pickedQty < (current.RemainingQty || 0) && (
              <div className="mt-3 bg-amber-50 border border-amber-300 rounded-md p-3">
                <p className="text-sm font-medium text-amber-900">
                  Short pick: {(current.RemainingQty || 0) - pickedQty} will stay open on this line.
                </p>
                <input
                  value={shortReason}
                  onChange={(e) => setShortReason(e.target.value)}
                  placeholder="Why? (e.g. only 3 on the shelf, not found)"
                  className="w-full border border-amber-300 rounded-md px-3 py-2 mt-2"
                />
              </div>
            )}

            {shortfallPrompt && (
              <div className="mt-3 bg-red-50 border border-red-300 rounded-md p-3">
                <p className="text-sm text-red-900">
                  The bin shows only {shortfallPrompt.available} of {item.ItemCode}, but you are taking {shortfallPrompt.requested}.
                  If you take it anyway the bin goes to 0 and the difference ({shortfallPrompt.requested - shortfallPrompt.available}) is logged.
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => void handleConfirmSOPick(true)}
                    disabled={isSaving}
                    className="px-4 py-2 bg-red-600 text-white rounded-md disabled:bg-gray-400"
                  >
                    Take it anyway
                  </button>
                  <button onClick={() => setShortfallPrompt(null)} className="px-4 py-2 bg-gray-200 rounded-md">
                    Change quantity
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void handleConfirmSOPick()}
              disabled={isSaving || needsBin}
              className="flex-1 bg-green-600 text-white py-3 rounded-md hover:bg-green-700 font-medium text-lg disabled:bg-gray-400"
            >
              {isSaving ? "Saving..." : needsBin ? "Assign a bin first" : pickedQty === 0 ? "Report short" : pickedQty < (current.RemainingQty || 0) ? "Confirm Short Pick" : "Confirm Pick"}
            </button>
            <button
              onClick={() => {
                const nextIndex = currentPickIndex + 1;
                if (nextIndex >= soPickList.length) {
                  exitPicks();
                } else {
                  setCurrentPickIndex(nextIndex);
                  setPickedQty(liveRemaining(soPickList[nextIndex]));
                }
              }}
              className="px-6 bg-gray-200 text-gray-700 py-3 rounded-md hover:bg-gray-300"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render pick complete
  if (activePick && currentPickIndex >= soPickList.length) {
    return (
      <div className="p-4 max-w-4xl mx-auto text-center py-12">
        <Check className="mx-auto mb-4 text-green-600" size={64} />
        <h2 className="text-2xl font-bold mb-2">{activePick.title} complete</h2>
        <p className="text-gray-600">All items have been picked.</p>
        <button
          onClick={exitPicks}
          className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          Back to Sales Orders
        </button>
      </div>
    );
  }

  // List screen: waves, then sales orders (with tick boxes for admins building a wave)
  const selectableCount = selectedIds.filter((id) => sosById[id] && canAddToWave(sosById[id])).length;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <ShoppingCart className="text-blue-600" />
        Sales Order Picking
      </h1>

      {toastBanner}

      {/* Waves */}
      {activeWaves.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Truck className="text-purple-600" />
            Waves
          </h2>
          <div className="space-y-3">
            {activeWaves.map((wave) => {
              const progress = waveProgress(wave, sosById);
              const members = waveMembers(wave, sosById) as SalesOrder[];
              const statusStyle =
                progress.status === "picking" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800";
              return (
                <div key={wave.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        Wave {wave.waveNumber}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle}`}>
                          {progress.status.toUpperCase()}
                        </span>
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {progress.orderCount} {progress.orderCount === 1 ? "order" : "orders"}:{" "}
                        {members.map((so) => so.soNumber).join(", ") || "none left"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {progress.pickedLines} of {progress.totalLines} lines picked, {progress.openLines} still open
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => void handleDeleteWave(wave)}
                        disabled={progress.pickedLines > 0}
                        title={progress.pickedLines > 0 ? "A wave with picks cannot be deleted" : "Delete this wave"}
                        className="text-sm text-red-700 px-3 py-1 rounded-md border border-red-200 hover:bg-red-50 disabled:text-gray-400 disabled:border-gray-200 disabled:hover:bg-white"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleStartWave(wave)}
                    disabled={progress.openLines === 0}
                    className="mt-3 w-full bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 font-medium disabled:bg-gray-400"
                  >
                    {progress.openLines === 0 ? "Nothing left to pick" : "Pick wave"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Wave builder (admin) */}
      {isAdmin && pendingSalesOrders.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 bg-purple-50 border border-purple-200 rounded-md px-4 py-3">
          <p className="text-sm text-purple-900">
            Tick sales orders to group them into a wave. {selectableCount} selected.
          </p>
          <button
            onClick={() => void handleCreateWave()}
            disabled={creatingWave || selectableCount === 0}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 font-medium disabled:bg-gray-400"
          >
            {creatingWave ? "Creating..." : "Create wave"}
          </button>
        </div>
      )}

      {/* Sales orders */}
      {pendingSalesOrders.length > 0 ? (
        <div className="space-y-3">
          {pendingSalesOrders.map((so) => {
            const itemsToPick = so.items.filter((item) => (item.RemainingQty || 0) > 0);
            const totalRemaining = so.items.reduce((sum, item) => sum + (item.RemainingQty || 0), 0);
            const wave = openWaveOf(so.id);
            // Warn before the picker starts: lines whose bin holds too little (or nothing).
            const stockSummary = summarizeStock(
              checkStock(
                itemsToPick.map((line) => ({
                  binCode: line.BinCode,
                  warehouse: line.Warehouse,
                  itemCode: line.ItemCode,
                  needed: line.RemainingQty || 0,
                })),
                bins
              )
            );
            const ticked = selectedIds.includes(so.id);
            const tickable = canAddToWave(so);

            return (
              <div
                key={so.id}
                className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    {isAdmin && (
                      <input
                        type="checkbox"
                        aria-label={`Add SO ${so.soNumber} to a wave`}
                        className="mt-2 h-5 w-5"
                        checked={ticked}
                        disabled={!tickable && !ticked}
                        onChange={() => toggleSelected(so.id)}
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        SO #{so.soNumber}
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            so.status === "picking"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {so.status.toUpperCase()}
                        </span>
                        {wave && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            In wave {wave.waveNumber}
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {so.customer} {so.cardCode && `(${so.cardCode})`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {new Date(so.createdDate).toLocaleDateString()}
                      </p>
                      {(stockSummary.needsBin > 0 || stockSummary.none > 0 || stockSummary.partial > 0) && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {stockSummary.needsBin > 0 && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-600 text-white">
                              ✕ {stockSummary.needsBin} {stockSummary.needsBin === 1 ? "line needs" : "lines need"} a bin assigned
                            </span>
                          )}
                          {stockSummary.none > 0 && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                              ✕ {stockSummary.none} {stockSummary.none === 1 ? "line" : "lines"} with no stock
                            </span>
                          )}
                          {stockSummary.partial > 0 && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              ⚠ {stockSummary.partial} {stockSummary.partial === 1 ? "line" : "lines"} short on stock
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {itemsToPick.length} items to pick
                      </p>
                      <p className="text-sm font-semibold text-blue-600">
                        {totalRemaining} units remaining
                      </p>
                    </div>
                    <OrderDeleteButton
                      label={`SO ${so.soNumber}`}
                      kind="sales order"
                      lineCount={so.items.length}
                      progressQty={so.items.reduce((sum, item) => sum + (item.DeliveredQty || 0), 0)}
                      onDelete={() => deleteRecord("rf_sales_orders", so.id).then(() => undefined)}
                      onMessage={showToast}
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleSelectSalesOrder(so)}
                  className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 font-medium"
                >
                  Start Picking
                </button>
              </div>
            );
          })}
        </div>
      ) : salesOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ShoppingCart size={48} className="mx-auto mb-4 opacity-50" />
          <p>No sales orders available</p>
          <p className="text-sm mt-2">Upload sales orders from the Setup page</p>
          <button
            onClick={() => setPage("setup")}
            className="mt-4 text-blue-600 underline"
          >
            Go to Setup
          </button>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Check className="mx-auto mb-4 text-green-600" size={48} />
          <p>All sales orders have been picked!</p>
          <p className="text-sm mt-2">All {salesOrders.length} sales orders are complete.</p>
        </div>
      )}
    </div>
  );
}
