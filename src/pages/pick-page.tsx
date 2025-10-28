import React, { useState, useEffect } from "react";
import { Wave, Order, OrderItem, BinLocation } from "../types";
import { Truck, Package, MapPin, Check, AlertTriangle } from "lucide-react";

interface PickPageProps {
  setPage: (page: any) => void;
}

export default function PickPage({ setPage }: PickPageProps) {
  const [waves, setWaves] = useState<Wave[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bins, setBins] = useState<BinLocation[]>([]);
  const [selectedWave, setSelectedWave] = useState<Wave | null>(null);
  const [waveOrders, setWaveOrders] = useState<Order[]>([]);
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  const [pickList, setPickList] = useState<{ order: Order; item: OrderItem }[]>([]);
  const [pickedQty, setPickedQty] = useState<number>(0);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Load data
  useEffect(() => {
    const wavesData = JSON.parse(localStorage.getItem("rf_waves") || "[]");
    const ordersData = JSON.parse(localStorage.getItem("rf_orders") || "[]");
    const binsData = JSON.parse(localStorage.getItem("rf_bins") || "[]");
    setWaves(wavesData);
    setOrders(ordersData);
    setBins(binsData);
  }, []);

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

  // Select wave and build pick list
  const handleSelectWave = (wave: Wave) => {
    setSelectedWave(wave);
    
    // Get orders for this wave
    const ordersInWave = orders.filter((order) => wave.orders.includes(order.id));
    setWaveOrders(ordersInWave);

    // Build consolidated pick list (group by bin)
    const picks: { order: Order; item: OrderItem }[] = [];
    ordersInWave.forEach((order) => {
      order.items.forEach((item) => {
        picks.push({ order, item });
      });
    });

    // Sort by bin location for efficient picking
    picks.sort((a, b) => a.item.BinCode.localeCompare(b.item.BinCode));
    setPickList(picks);
    setCurrentPickIndex(0);

    // Mark wave as active
    const updatedWaves = waves.map((w) =>
      w.id === wave.id ? { ...w, status: "active" as const } : w
    );
    setWaves(updatedWaves);
    localStorage.setItem("rf_waves", JSON.stringify(updatedWaves));
  };

  // Confirm pick
  const handleConfirmPick = () => {
    if (currentPickIndex >= pickList.length) return;

    const currentPick = pickList[currentPickIndex];
    const { order, item } = currentPick;

    if (pickedQty <= 0) {
      showToast("⚠️ Picked quantity must be greater than 0", "error");
      return;
    }

    if (pickedQty > item.OrderedQty) {
      showToast("⚠️ Picked quantity exceeds ordered quantity", "error");
      return;
    }

    // Update order
    const updatedOrders = orders.map((o) => {
      if (o.id === order.id) {
        const updatedItems = o.items.map((i) => {
          if (i.ItemCode === item.ItemCode) {
            return { ...i, PickedQty: pickedQty };
          }
          return i;
        });

        // Check if all items picked
        const allPicked = updatedItems.every((i) => i.PickedQty >= i.OrderedQty);

        return {
          ...o,
          items: updatedItems,
          status: allPicked ? ("picked" as const) : ("picking" as const),
        };
      }
      return o;
    });

    // Update bin inventory
    const updatedBins = bins.map((bin) => {
      if (bin.BinCode === item.BinCode) {
        const updatedItems = bin.Items.map((binItem) => {
          if (binItem.ItemCode === item.ItemCode) {
            return {
              ...binItem,
              Quantity: Math.max(0, binItem.Quantity - pickedQty),
            };
          }
          return binItem;
        });
        return { ...bin, Items: updatedItems };
      }
      return bin;
    });

    // Save updates
    localStorage.setItem("rf_orders", JSON.stringify(updatedOrders));
    localStorage.setItem("rf_bins", JSON.stringify(updatedBins));
    setOrders(updatedOrders);
    setBins(updatedBins);

    showToast(`✅ Picked ${pickedQty} of ${item.Description}`, "success");

    // Move to next pick
    const nextIndex = currentPickIndex + 1;
    if (nextIndex >= pickList.length) {
      // Wave complete
      const updatedWaves = waves.map((w) =>
        w.id === selectedWave?.id
          ? { ...w, status: "completed" as const, completedDate: new Date().toISOString() }
          : w
      );
      setWaves(updatedWaves);
      localStorage.setItem("rf_waves", JSON.stringify(updatedWaves));
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
      const updatedWaves = waves.map((w) =>
        w.id === selectedWave?.id
          ? { ...w, status: "completed" as const, completedDate: new Date().toISOString() }
          : w
      );
      setWaves(updatedWaves);
      localStorage.setItem("rf_waves", JSON.stringify(updatedWaves));
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
    if (pickList.length > 0 && currentPickIndex < pickList.length) {
      setPickedQty(pickList[currentPickIndex].item.OrderedQty);
    }
  }, [currentPickIndex, pickList]);

  // Render wave list
  if (!selectedWave) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Truck className="text-blue-600" />
          Wave Picking
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

        {waves.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Truck size={48} className="mx-auto mb-4 opacity-50" />
            <p>No waves available</p>
            <button
              onClick={() => setPage("setup")}
              className="mt-4 text-blue-600 underline"
            >
              Go to Setup to initialize data
            </button>
          </div>
        ) : (
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
          <h2 className="text-lg font-bold">{selectedWave.waveNumber}</h2>
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
            className="flex-1 bg-green-600 text-white py-3 rounded-md hover:bg-green-700 font-medium text-lg"
          >
            Confirm Pick
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

