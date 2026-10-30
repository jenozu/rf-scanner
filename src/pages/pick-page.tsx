import React, { useState, useEffect } from "react";
import { Wave, Order, OrderItem, BinLocation, SalesOrder, SOItem } from "../types";
import { useCollection } from "../data/hooks";
import { adjustBin, pickSalesOrderLine, upsertRecord } from "../data/ops";
import { Truck, Package, MapPin, Check, AlertTriangle, ShoppingCart } from "lucide-react";

interface PickPageProps {
  setPage: (page: any) => void;
}

export default function PickPage({ setPage }: PickPageProps) {
  // Shared server data (the same on every device); refreshes on focus and every 30 s.
  const { data: waves } = useCollection<Wave[]>("rf_waves", []);
  const { data: orders } = useCollection<Order[]>("rf_orders", []);
  const { data: salesOrders } = useCollection<SalesOrder[]>("rf_sales_orders", []);
  const { data: bins } = useCollection<BinLocation[]>("rf_bins", []);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedWave, setSelectedWave] = useState<Wave | null>(null);
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<SalesOrder | null>(null);
  const [waveOrders, setWaveOrders] = useState<Order[]>([]);
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  const [pickList, setPickList] = useState<{ order: Order; item: OrderItem; itemIndex: number }[]>([]);
  // lineIndex = position of the line in the sales order; picks act on that exact line.
  const [soPickList, setSoPickList] = useState<{ so: SalesOrder; item: SOItem; lineIndex: number }[]>([]);
  const [pickedQty, setPickedQty] = useState<number>(0);
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

  // Select Sales Order and build pick list
  const handleSelectSalesOrder = (so: SalesOrder) => {
    setSelectedSalesOrder(so);
    
    // Build pick list from SO items that need picking
    const picks: { so: SalesOrder; item: SOItem; lineIndex: number }[] = [];
    so.items.forEach((item, lineIndex) => {
      if ((item.RemainingQty || 0) > 0) picks.push({ so, item, lineIndex });
    });

    // Sort by bin location for efficient picking
    picks.sort((a, b) => {
      const binA = a.item.BinCode || "";
      const binB = b.item.BinCode || "";
      return binA.localeCompare(binB);
    });
    
    setSoPickList(picks);
    setCurrentPickIndex(0);
    // The order becomes "picking" on the server with the first confirmed pick.
  };

  // Remaining quantity for a pick line, from the latest server data (another
  // device may have picked from the same line since this list was built).
  const liveRemaining = (entry: { so: SalesOrder; item: SOItem; lineIndex: number }) => {
    const liveLine = salesOrders.find((s) => s.id === entry.so.id)?.items[entry.lineIndex];
    return (liveLine ?? entry.item).RemainingQty || 0;
  };

  // Confirm pick for Sales Order
  const handleConfirmSOPick = async () => {
    if (currentPickIndex >= soPickList.length || !selectedSalesOrder || isSaving) return;

    const currentPick = soPickList[currentPickIndex];
    const { so, item, lineIndex } = currentPick;

    if (pickedQty <= 0) {
      showToast("⚠️ Picked quantity must be greater than 0", "error");
      return;
    }

    const remainingQty = liveRemaining(currentPick);
    if (pickedQty > remainingQty) {
      showToast("⚠️ Picked quantity exceeds remaining quantity", "error");
      return;
    }

    setIsSaving(true);
    try {
      // One request: sales-order line + stock taken from the bin.
      await pickSalesOrderLine({ soId: so.id, lineIndex, qty: pickedQty, binCode: item.BinCode });
    } catch (error: any) {
      showToast(`❌ Pick not saved: ${error?.message || "server error"}. Try again.`, "error");
      setIsSaving(false);
      return;
    }
    setIsSaving(false);

    showToast(`✅ Picked ${pickedQty} of ${item.Description}`, "success");

    // Move to next pick
    const nextIndex = currentPickIndex + 1;
    if (nextIndex >= soPickList.length) {
      // SO complete
      showToast("🎉 Sales Order picking completed!", "success");
      
      setTimeout(() => {
        setSelectedSalesOrder(null);
        setSoPickList([]);
        setCurrentPickIndex(0);
      }, 2000);
    } else {
      setCurrentPickIndex(nextIndex);
      setPickedQty(liveRemaining(soPickList[nextIndex]));
    }
  };

  // Select wave and build pick list
  const handleSelectWave = (wave: Wave) => {
    setSelectedWave(wave);
    
    // Get orders for this wave
    const ordersInWave = orders.filter((order) => wave.orders.includes(order.id));
    setWaveOrders(ordersInWave);

    // Build consolidated pick list (group by bin)
    const picks: { order: Order; item: OrderItem; itemIndex: number }[] = [];
    ordersInWave.forEach((order) => {
      order.items.forEach((item, itemIndex) => {
        picks.push({ order, item, itemIndex });
      });
    });

    // Sort by bin location for efficient picking
    picks.sort((a, b) => a.item.BinCode.localeCompare(b.item.BinCode));
    setPickList(picks);
    setCurrentPickIndex(0);

    // Mark wave as active
    saveWaveStatus({ ...wave, status: "active" as const });
  };

  // Wave status changes are saved to the server; a failure is shown, not hidden.
  const saveWaveStatus = (wave: Wave) => {
    upsertRecord("rf_waves", wave).catch((error: any) =>
      showToast(`❌ Wave status not saved: ${error?.message || "server error"}`, "error")
    );
  };

  // Confirm pick
  const handleConfirmPick = async () => {
    if (currentPickIndex >= pickList.length || isSaving) return;

    const currentPick = pickList[currentPickIndex];
    const { order, item, itemIndex } = currentPick;

    if (pickedQty <= 0) {
      showToast("⚠️ Picked quantity must be greater than 0", "error");
      return;
    }

    if (pickedQty > item.OrderedQty) {
      showToast("⚠️ Picked quantity exceeds ordered quantity", "error");
      return;
    }

    // Update the order from its latest server copy, changing only the picked line.
    const liveOrder = orders.find((o) => o.id === order.id) ?? order;
    const updatedItems = liveOrder.items.map((i, idx) =>
      idx === itemIndex ? { ...i, PickedQty: pickedQty } : i
    );
    const allPicked = updatedItems.every((i) => i.PickedQty >= i.OrderedQty);
    const updatedOrder: Order = {
      ...liveOrder,
      items: updatedItems,
      status: allPicked ? ("picked" as const) : ("picking" as const),
    };

    setIsSaving(true);
    try {
      await upsertRecord("rf_orders", updatedOrder);
    } catch (error: any) {
      showToast(`❌ Pick not saved: ${error?.message || "server error"}. Try again.`, "error");
      setIsSaving(false);
      return;
    }
    try {
      // Take the stock out of the bin (never below zero; unknown bins are skipped).
      if (bins.some((b) => b.BinCode === item.BinCode)) {
        await adjustBin({ binCode: item.BinCode, itemCode: item.ItemCode, delta: -pickedQty, clampAtZero: true });
      }
    } catch (error: any) {
      showToast(`⚠️ Pick recorded but the bin stock was not reduced (${error?.message || "server error"}). Tell a supervisor.`, "error");
    }
    setIsSaving(false);

    showToast(`✅ Picked ${pickedQty} of ${item.Description}`, "success");

    // Move to next pick
    const nextIndex = currentPickIndex + 1;
    if (nextIndex >= pickList.length) {
      // Wave complete
      if (selectedWave) {
        saveWaveStatus({ ...selectedWave, status: "completed" as const, completedDate: new Date().toISOString() });
      }
      showToast("🎉 Wave picking completed!", "success");
      
      // Return to wave list after brief delay
      setTimeout(() => {
        setSelectedWave(null);
        setWaveOrders([]);
        setPickList([]);
        setCurrentPickIndex(0);
      }, 2000);
    } else {
      setCurrentPickIndex(nextIndex);
      setPickedQty(pickList[nextIndex].item.OrderedQty); // Default to ordered qty
    }
  };

  // Skip item (record short pick)
  const handleSkipPick = () => {
    if (currentPickIndex >= pickList.length) return;

    const currentPick = pickList[currentPickIndex];
    showToast(`⚠️ Skipped pick for ${currentPick.item.Description}`, "info");

    // Move to next pick
    const nextIndex = currentPickIndex + 1;
    if (nextIndex >= pickList.length) {
      // Wave complete (with short picks)
      if (selectedWave) {
        saveWaveStatus({ ...selectedWave, status: "completed" as const, completedDate: new Date().toISOString() });
      }
      showToast("⚠️ Wave completed with short picks", "info");
      
      setTimeout(() => {
        setSelectedWave(null);
        setWaveOrders([]);
        setPickList([]);
        setCurrentPickIndex(0);
      }, 2000);
    } else {
      setCurrentPickIndex(nextIndex);
      setPickedQty(pickList[nextIndex].item.OrderedQty);
    }
  };

  // Initialize picked qty when pick changes
  useEffect(() => {
    if (soPickList.length > 0 && currentPickIndex < soPickList.length) {
      setPickedQty(liveRemaining(soPickList[currentPickIndex]));
    } else if (pickList.length > 0 && currentPickIndex < pickList.length) {
      setPickedQty(pickList[currentPickIndex].item.OrderedQty);
    }
  }, [currentPickIndex, pickList, soPickList]);

  // Filter Sales Orders that need picking
  const pendingSalesOrders = salesOrders.filter(so => 
    so.status === "pending" || so.status === "picking"
  );

  // Render Sales Order picking workflow
  if (selectedSalesOrder && currentPickIndex < soPickList.length) {
    const currentPick = soPickList[currentPickIndex];
    const { so, item } = currentPick;
    const progress = ((currentPickIndex / soPickList.length) * 100).toFixed(0);

    return (
      <div className="p-4 max-w-4xl mx-auto">
        <button
          onClick={() => {
            setSelectedSalesOrder(null);
            setSoPickList([]);
            setCurrentPickIndex(0);
          }}
          className="mb-4 text-blue-600 hover:underline"
        >
          ← Back to Sales Orders
        </button>

        {/* Toast */}
        {toast && (
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
        )}

        {/* Progress Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold">SO #{so.soNumber}</h2>
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
              <h3 className="text-2xl font-bold">{item.BinCode || "No Bin"}</h3>
              <p className="text-sm text-gray-600">Pick from this location</p>
            </div>
          </div>

          <div className="border-t pt-4 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <Package className="text-gray-600 mt-1" size={20} />
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{item.Description}</h4>
                <p className="text-sm text-gray-600">Code: {item.ItemCode}</p>
                <p className="text-sm text-gray-600">SO: {so.soNumber}</p>
                <p className="text-sm text-gray-600">Customer: {so.customer}</p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-center text-3xl font-bold text-blue-600">
                {item.RemainingQty || 0}
              </p>
              <p className="text-center text-sm text-gray-600">Remaining Quantity</p>
              <p className="text-center text-xs text-gray-500 mt-1">
                {item.DeliveredQty} of {item.OrderedQty} already delivered
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Picked Quantity
              </label>
              <input
                type="number"
                value={pickedQty}
                onChange={(e) => setPickedQty(Number(e.target.value))}
                max={item.RemainingQty || 0}
                className="w-full border border-gray-300 rounded-md px-4 py-3 text-lg"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConfirmSOPick}
              disabled={isSaving}
              className="flex-1 bg-green-600 text-white py-3 rounded-md hover:bg-green-700 font-medium text-lg disabled:bg-gray-400"
            >
              {isSaving ? "Saving..." : "Confirm Pick"}
            </button>
            <button
              onClick={() => {
                const nextIndex = currentPickIndex + 1;
                if (nextIndex >= soPickList.length) {
                  setSelectedSalesOrder(null);
                  setSoPickList([]);
                  setCurrentPickIndex(0);
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

  // Render SO complete
  if (selectedSalesOrder && currentPickIndex >= soPickList.length) {
    return (
      <div className="p-4 max-w-4xl mx-auto text-center py-12">
        <Check className="mx-auto mb-4 text-green-600" size={64} />
        <h2 className="text-2xl font-bold mb-2">Sales Order Complete!</h2>
        <p className="text-gray-600">All items have been picked.</p>
        <button
          onClick={() => {
            setSelectedSalesOrder(null);
            setSoPickList([]);
            setCurrentPickIndex(0);
          }}
          className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          Back to Sales Orders
        </button>
      </div>
    );
  }

  // Render Sales Orders list or Wave list
  if (!selectedWave && !selectedSalesOrder) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <ShoppingCart className="text-blue-600" />
          Sales Order Picking
        </h1>

        {/* Toast */}
        {toast && (
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
        )}

        {/* Show Sales Orders if available */}
        {pendingSalesOrders.length > 0 ? (
          <div className="space-y-3">
            {pendingSalesOrders.map((so) => {
              const itemsToPick = so.items.filter(item => (item.RemainingQty || 0) > 0);
              const totalRemaining = so.items.reduce((sum, item) => sum + (item.RemainingQty || 0), 0);
              
              return (
                <div
                  key={so.id}
                  className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
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
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {so.customer} {so.cardCode && `(${so.cardCode})`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {new Date(so.createdDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {itemsToPick.length} items to pick
                      </p>
                      <p className="text-sm font-semibold text-blue-600">
                        {totalRemaining} units remaining
                      </p>
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

        {/* Legacy Wave Picking Section (if waves exist) */}
        {waves.length > 0 && (
          <>
            <div className="my-8 border-t pt-8">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Truck className="text-purple-600" />
                Wave Picking (Legacy)
              </h2>
            </div>
            <div className="space-y-3">
              {waves.map((wave) => {
                const waveOrderList = orders.filter((o) => wave.orders.includes(o.id));
                const totalItems = waveOrderList.reduce(
                  (sum, order) => sum + order.items.length,
                  0
                );

                return (
                  <div
                    key={wave.id}
                    onClick={() => wave.status === "pending" && handleSelectWave(wave)}
                    className={`bg-white rounded-lg shadow p-4 border-l-4 border-blue-500 ${
                      wave.status === "pending"
                        ? "cursor-pointer hover:shadow-md transition-shadow"
                        : "opacity-60"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          {wave.waveNumber}
                          {waveOrderList.some((o) => o.priority === "urgent") && (
                            <AlertTriangle className="text-red-500" size={20} />
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {wave.orders.length} orders • {totalItems} items
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(wave.createdDate).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          wave.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : wave.status === "active"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {wave.status.toUpperCase()}
                      </span>
                    </div>
                    {wave.status === "pending" && (
                      <button
                        onClick={() => handleSelectWave(wave)}
                        className="mt-3 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
                      >
                        Start Picking
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // Render picking workflow
  if (currentPickIndex >= pickList.length) {
    return (
      <div className="p-4 max-w-4xl mx-auto text-center py-12">
        <Check className="mx-auto mb-4 text-green-600" size={64} />
        <h2 className="text-2xl font-bold mb-2">Wave Complete!</h2>
        <p className="text-gray-600">All items have been picked.</p>
      </div>
    );
  }

  const currentPick = pickList[currentPickIndex];
  const { order, item } = currentPick;
  const progress = ((currentPickIndex / pickList.length) * 100).toFixed(0);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <button
        onClick={() => {
          setSelectedWave(null);
          setWaveOrders([]);
          setPickList([]);
          setCurrentPickIndex(0);
        }}
        className="mb-4 text-blue-600 hover:underline"
      >
        ← Back to Wave List
      </button>

      {/* Toast */}
      {toast && (
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
      )}

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold">{selectedWave?.waveNumber ?? "Active Wave"}</h2>
          <span className="text-sm text-gray-600">
            {currentPickIndex + 1} / {pickList.length}
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
            <h3 className="text-2xl font-bold">{item.BinCode}</h3>
            <p className="text-sm text-gray-600">Pick from this location</p>
          </div>
        </div>

        <div className="border-t pt-4 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <Package className="text-gray-600 mt-1" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-lg">{item.Description}</h4>
              <p className="text-sm text-gray-600">Code: {item.ItemCode}</p>
              <p className="text-sm text-gray-600">Order: {order.orderNumber}</p>
              <p className="text-sm text-gray-600">Customer: {order.customer}</p>
              {order.priority === "urgent" && (
                <span className="inline-block mt-1 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                  URGENT
                </span>
              )}
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <p className="text-center text-3xl font-bold text-blue-600">
              {item.OrderedQty}
            </p>
            <p className="text-center text-sm text-gray-600">Required Quantity</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Picked Quantity
            </label>
            <input
              type="number"
              value={pickedQty}
              onChange={(e) => setPickedQty(Number(e.target.value))}
              max={item.OrderedQty}
              className="w-full border border-gray-300 rounded-md px-4 py-3 text-lg"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleConfirmPick}
            disabled={isSaving}
            className="flex-1 bg-green-600 text-white py-3 rounded-md hover:bg-green-700 font-medium text-lg disabled:bg-gray-400"
          >
            {isSaving ? "Saving..." : "Confirm Pick"}
          </button>
          <button
            onClick={handleSkipPick}
            className="px-6 bg-gray-200 text-gray-700 py-3 rounded-md hover:bg-gray-300"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

