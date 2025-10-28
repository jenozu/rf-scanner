import React, { useState, useEffect } from "react";
import { PurchaseOrder, POItem, BinLocation } from "../types";
import { Package, Check, AlertCircle, Plus } from "lucide-react";

interface ReceivePageProps {
  setPage: (page: any) => void;
}

export default function ReceivePage({ setPage }: ReceivePageProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [receivingItem, setReceivingItem] = useState<POItem | null>(null);
  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [selectedBin, setSelectedBin] = useState<string>("");
  const [bins, setBins] = useState<BinLocation[]>([]);
  const [newBinCode, setNewBinCode] = useState<string>("");
  const [showNewBinModal, setShowNewBinModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Load data
  useEffect(() => {
    const pos = JSON.parse(localStorage.getItem("rf_purchase_orders") || "[]");
    const binData = JSON.parse(localStorage.getItem("rf_bins") || "[]");
    setPurchaseOrders(pos);
    setBins(binData);
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

  // Select PO
  const handleSelectPO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setReceivingItem(null);
  };

  // Start receiving an item
  const handleReceiveItem = (item: POItem) => {
    setReceivingItem(item);
    setReceivedQty(item.OrderedQty - item.ReceivedQty); // Default to remaining qty
    setSelectedBin(item.BinCode || "");
  };

  // Save received quantity
  const handleSaveReceive = () => {
    if (!selectedPO || !receivingItem) return;
    
    if (!selectedBin) {
      showToast("⚠️ Please select a bin location", "error");
      return;
    }

    if (receivedQty <= 0) {
      showToast("⚠️ Received quantity must be greater than 0", "error");
      return;
    }

    // Update PO
    const updatedPOs = purchaseOrders.map((po) => {
      if (po.id === selectedPO.id) {
        const updatedItems = po.items.map((item) => {
          if (item.ItemCode === receivingItem.ItemCode) {
            const newReceivedQty = item.ReceivedQty + receivedQty;
            return {
              ...item,
              ReceivedQty: newReceivedQty,
              BinCode: selectedBin,
            };
          }
          return item;
        });

        // Check if all items fully received
        const allReceived = updatedItems.every(
          (item) => item.ReceivedQty >= item.OrderedQty
        );

        return {
          ...po,
          items: updatedItems,
          status: allReceived ? "completed" : "receiving",
          receivedDate: allReceived ? new Date().toISOString() : po.receivedDate,
        } as PurchaseOrder;
      }
      return po;
    });

    // Update bin location
    const updatedBins = bins.map((bin) => {
      if (bin.BinCode === selectedBin) {
        const existingItemIndex = bin.Items.findIndex(
          (i) => i.ItemCode === receivingItem.ItemCode
        );
        
        if (existingItemIndex >= 0) {
          // Update existing item quantity
          const updatedItems = [...bin.Items];
          updatedItems[existingItemIndex].Quantity += receivedQty;
          return { ...bin, Items: updatedItems };
        } else {
          // Add new item to bin
          return {
            ...bin,
            Items: [
              ...bin.Items,
              {
                ItemCode: receivingItem.ItemCode,
                Description: receivingItem.Description,
                Quantity: receivedQty,
              },
            ],
          };
        }
      }
      return bin;
    });

    // Save to localStorage
    localStorage.setItem("rf_purchase_orders", JSON.stringify(updatedPOs));
    localStorage.setItem("rf_bins", JSON.stringify(updatedBins));

    // Update state
    setPurchaseOrders(updatedPOs);
    setBins(updatedBins);
    setSelectedPO(updatedPOs.find((po) => po.id === selectedPO.id) || null);
    setReceivingItem(null);
    setReceivedQty(0);
    setSelectedBin("");

    showToast(`✅ Received ${receivedQty} of ${receivingItem.Description}`, "success");
  };

  // Create new bin
  const handleCreateBin = () => {
    if (!newBinCode.trim()) {
      showToast("⚠️ Please enter a bin code", "error");
      return;
    }

    // Check if bin already exists
    if (bins.some((bin) => bin.BinCode === newBinCode.toUpperCase())) {
      showToast("⚠️ Bin already exists", "error");
      return;
    }

    const newBin: BinLocation = {
      BinCode: newBinCode.toUpperCase(),
      Zone: "Zone D - Receiving",
      Capacity: 100,
      Status: "active",
      Items: [],
    };

    const updatedBins = [...bins, newBin];
    localStorage.setItem("rf_bins", JSON.stringify(updatedBins));
    setBins(updatedBins);
    setSelectedBin(newBin.BinCode);
    setNewBinCode("");
    setShowNewBinModal(false);
    showToast(`✅ Created new bin: ${newBin.BinCode}`, "success");
  };

  // Render PO list
  if (!selectedPO) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Package className="text-blue-600" />
          Receive Purchase Orders
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

        {purchaseOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package size={48} className="mx-auto mb-4 opacity-50" />
            <p>No purchase orders available</p>
            <button
              onClick={() => setPage("setup")}
              className="mt-4 text-blue-600 underline"
            >
              Go to Setup to initialize data
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {purchaseOrders.map((po) => (
              <div
                key={po.id}
                onClick={() => handleSelectPO(po)}
                className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-blue-500"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{po.poNumber}</h3>
                    <p className="text-sm text-gray-600">{po.vendor}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Expected: {new Date(po.expectedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      po.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : po.status === "receiving"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {po.status.toUpperCase()}
                  </span>
                </div>
                <div className="mt-3 text-sm text-gray-700">
                  {po.items.length} items • {po.items.reduce((sum, item) => sum + item.ReceivedQty, 0)} / {po.items.reduce((sum, item) => sum + item.OrderedQty, 0)} received
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render PO details and receiving workflow
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <button
        onClick={() => setSelectedPO(null)}
        className="mb-4 text-blue-600 hover:underline"
      >
        ← Back to PO List
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

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-xl font-bold">{selectedPO.poNumber}</h2>
        <p className="text-gray-600">{selectedPO.vendor}</p>
        <p className="text-sm text-gray-500 mt-1">
          Expected: {new Date(selectedPO.expectedDate).toLocaleDateString()}
        </p>
      </div>

      <h3 className="font-semibold text-lg mb-3">Items to Receive</h3>

      <div className="space-y-3">
        {selectedPO.items.map((item) => {
          const isReceiving = receivingItem?.ItemCode === item.ItemCode;
          const remaining = item.OrderedQty - item.ReceivedQty;
          const isComplete = remaining === 0;

          return (
            <div
              key={item.ItemCode}
              className={`bg-white rounded-lg shadow p-4 ${
                isComplete ? "opacity-60" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold">{item.Description}</h4>
                  <p className="text-sm text-gray-600">Code: {item.ItemCode}</p>
                  <p className="text-sm text-gray-600">
                    Received: {item.ReceivedQty} / {item.OrderedQty}
                    {item.BinCode && ` → Bin: ${item.BinCode}`}
                  </p>
                </div>
                {isComplete ? (
                  <Check className="text-green-600" size={24} />
                ) : (
                  <button
                    onClick={() => handleReceiveItem(item)}
                    disabled={isReceiving}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {isReceiving ? "Receiving..." : "Receive"}
                  </button>
                )}
              </div>

              {/* Receiving Form */}
              {isReceiving && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Quantity Received
                    </label>
                    <input
                      type="number"
                      value={receivedQty}
                      onChange={(e) => setReceivedQty(Number(e.target.value))}
                      max={remaining}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Remaining to receive: {remaining}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium">
                        Putaway Location
                      </label>
                      <button
                        onClick={() => setShowNewBinModal(true)}
                        className="text-blue-600 text-sm flex items-center gap-1 hover:underline"
                      >
                        <Plus size={16} /> New Bin
                      </button>
                    </div>
                    <select
                      value={selectedBin}
                      onChange={(e) => setSelectedBin(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">Select bin location</option>
                      {bins
                        .filter((bin) => bin.Status === "active")
                        .map((bin) => (
                          <option key={bin.BinCode} value={bin.BinCode}>
                            {bin.BinCode} - {bin.Zone}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveReceive}
                      className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 font-medium"
                    >
                      Confirm Putaway
                    </button>
                    <button
                      onClick={() => setReceivingItem(null)}
                      className="px-4 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Bin Modal */}
      {showNewBinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Create New Bin</h3>
            <input
              type="text"
              value={newBinCode}
              onChange={(e) => setNewBinCode(e.target.value.toUpperCase())}
              placeholder="Enter bin code (e.g., A-01-01)"
              className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateBin}
                className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
              >
                Create Bin
              </button>
              <button
                onClick={() => {
                  setShowNewBinModal(false);
                  setNewBinCode("");
                }}
                className="px-4 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

