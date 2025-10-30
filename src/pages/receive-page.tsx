import React, { useState, useEffect } from "react";
import { PurchaseOrder, POItem, BinLocation, LicensePlate, LicensePlateItem, ReceivingTransaction } from "../types";
import { Package, Check, AlertCircle, Plus, ScanLine, Printer } from "lucide-react";
import { generateLicensePlateId, getStagingBinCode } from "../utils/config";

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
  const [scanCode, setScanCode] = useState<string>("");
  const [lotMode, setLotMode] = useState<"none" | "lots" | "serials">("none");
  const [lots, setLots] = useState<Array<{ lotCode: string; qty: number }>>([]);
  const [serials, setSerials] = useState<string[]>([]);
  const [lastCreatedLP, setLastCreatedLP] = useState<LicensePlate | null>(null);

  // Load data
  useEffect(() => {
    const pos = JSON.parse(localStorage.getItem("rf_purchase_orders") || "[]");
    const binData = JSON.parse(localStorage.getItem("rf_bins") || "[]");
    setPurchaseOrders(pos);
    setBins(binData);
    setSelectedBin(getStagingBinCode());
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
    setSelectedBin(getStagingBinCode());
    setScanCode("");
    setLots([]);
    setSerials([]);
    setLotMode(item.RequiresLotSerial ? "lots" : "none");
  };

  // Save received quantity
  const handleSaveReceive = () => {
    if (!selectedPO || !receivingItem) return;
    // Enforce scan-to-validate
    if (scanCode.trim() !== receivingItem.ItemCode) {
      showToast("⚠️ Scan the item barcode to validate before receiving", "error");
      return;
    }

    if (!selectedBin) {
      showToast("⚠️ Please select a bin location", "error");
      return;
    }

    if (receivedQty <= 0) {
      showToast("⚠️ Received quantity must be greater than 0", "error");
      return;
    }

    if (receivingItem.RequiresLotSerial) {
      if (lotMode === "lots" && (lots.length === 0 || lots.reduce((s, l) => s + (l.qty || 0), 0) !== receivedQty)) {
        showToast("⚠️ Lot quantities must sum to received quantity", "error");
        return;
      }
      if (lotMode === "serials" && serials.length !== receivedQty) {
        showToast("⚠️ Number of serials must equal received quantity", "error");
        return;
      }
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
              RemainingQty: Math.max(0, item.OrderedQty - newReceivedQty),
              Lots: lotMode === "lots" ? lots : item.Lots,
              Serials: lotMode === "serials" ? serials : item.Serials,
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

    // Update bin location (stage to STAGING bin)
    const stagingBinCode = selectedBin || getStagingBinCode();
    const updatedBins = bins.map((bin) => {
      if (bin.BinCode === stagingBinCode) {
        const existingItemIndex = bin.Items.findIndex(
          (i) => i.ItemCode === receivingItem.ItemCode
        );
        
        if (existingItemIndex >= 0) {
          // Update existing item quantity
          const updatedItems = [...bin.Items];
          updatedItems[existingItemIndex].Quantity += receivedQty;
          // merge lots/serials if provided
          if (receivingItem.RequiresLotSerial) {
            const current = updatedItems[existingItemIndex];
            if (lotMode === "lots") {
              const existingLots = current.Lots || [];
              const mergedLots = [...existingLots];
              lots.forEach((l) => {
                const idx = mergedLots.findIndex((e) => e.lotCode === l.lotCode);
                if (idx >= 0) mergedLots[idx] = { lotCode: l.lotCode, qty: mergedLots[idx].qty + l.qty };
                else mergedLots.push({ lotCode: l.lotCode, qty: l.qty });
              });
              current.Lots = mergedLots;
            }
            if (lotMode === "serials") {
              const existingSerials = current.Serials || [];
              current.Serials = [...existingSerials, ...serials];
            }
            updatedItems[existingItemIndex] = current;
          }
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
                Lots: lotMode === "lots" ? lots : undefined,
                Serials: lotMode === "serials" ? serials : undefined,
              },
            ],
          };
        }
      }
      return bin;
    });

    // Create LP if line is complete after this receipt
    let createdLP: LicensePlate | null = null;
    const updatedPoRef = updatedPOs.find((p) => p.id === selectedPO.id)!;
    const updatedLine = updatedPoRef.items.find((i) => i.ItemCode === receivingItem.ItemCode)!;
    const lineCompleteNow = updatedLine.ReceivedQty >= updatedLine.OrderedQty;
    if (lineCompleteNow) {
      const lpId = generateLicensePlateId();
      const lpItem: LicensePlateItem = {
        ItemCode: updatedLine.ItemCode,
        Description: updatedLine.Description,
        qty: receivedQty,
        Lots: lotMode === "lots" ? lots : undefined,
        Serials: lotMode === "serials" ? serials : undefined,
      };
      createdLP = {
        lpId,
        items: [lpItem],
        createdAt: new Date().toISOString(),
        binCode: stagingBinCode,
        labels: [],
      };
      const existingLPs: LicensePlate[] = JSON.parse(localStorage.getItem("rf_lps") || "[]");
      localStorage.setItem("rf_lps", JSON.stringify([...existingLPs, createdLP]));
      setLastCreatedLP(createdLP);
    }

    // Write receiving transaction
    const txn: ReceivingTransaction = {
      id: `RCV-${Date.now()}`,
      poNumber: selectedPO.poNumber,
      itemCode: receivingItem.ItemCode,
      description: receivingItem.Description,
      qty: receivedQty,
      binCode: stagingBinCode,
      lpId: createdLP?.lpId,
      lots: lotMode === "lots" ? lots : undefined,
      serials: lotMode === "serials" ? serials : undefined,
      timestamp: new Date().toISOString(),
    };
    const existingTxns: ReceivingTransaction[] = JSON.parse(localStorage.getItem("rf_receiving_txns") || "[]");
    localStorage.setItem("rf_receiving_txns", JSON.stringify([txn, ...existingTxns]));

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
    setScanCode("");
    setLots([]);
    setSerials([]);

    if (createdLP) {
      showToast(`✅ Received ${receivedQty} of ${receivingItem.Description}. LP ${createdLP.lpId} created in STAGING.`, "success");
    } else {
      showToast(`✅ Received ${receivedQty} of ${receivingItem.Description} to STAGING`, "success");
    }
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
                  {/* Scan to validate */}
                  <div>
                    <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                      <ScanLine size={16} /> Scan Item to Validate
                    </label>
                    <input
                      type="text"
                      value={scanCode}
                      onChange={(e) => setScanCode(e.target.value.toUpperCase())}
                      placeholder={`Scan ${item.ItemCode}`}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    {scanCode && scanCode !== item.ItemCode && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle size={12} /> Scanned code does not match this PO line
                      </p>
                    )}
                  </div>

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

                  {/* Staging bin selection (fixed to staging by default) */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium">
                        Staging Bin (default)
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
                      {bins
                        .filter((bin) => bin.Status === "active")
                        .map((bin) => (
                          <option key={bin.BinCode} value={bin.BinCode}>
                            {bin.BinCode} - {bin.Zone}
                          </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Items are staged first; putaway happens later.</p>
                  </div>

                  {/* Lot/Serial Capture */}
                  {item.RequiresLotSerial && (
                    <div className="border rounded-md p-3">
                      <div className="flex gap-2 mb-3">
                        <button
                          className={`px-3 py-1 rounded-md text-sm ${lotMode === "lots" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
                          onClick={() => setLotMode("lots")}
                        >Lots</button>
                        <button
                          className={`px-3 py-1 rounded-md text-sm ${lotMode === "serials" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
                          onClick={() => setLotMode("serials")}
                        >Serials</button>
                      </div>

                      {lotMode === "lots" && (
                        <div className="space-y-2">
                          {lots.map((l, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input
                                type="text"
                                value={l.lotCode}
                                onChange={(e) => {
                                  const next = [...lots];
                                  next[idx] = { ...next[idx], lotCode: e.target.value.toUpperCase() };
                                  setLots(next);
                                }}
                                placeholder="Lot code"
                                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                              />
                              <input
                                type="number"
                                value={l.qty}
                                onChange={(e) => {
                                  const next = [...lots];
                                  next[idx] = { ...next[idx], qty: Number(e.target.value) };
                                  setLots(next);
                                }}
                                placeholder="Qty"
                                className="w-28 border border-gray-300 rounded-md px-3 py-2"
                              />
                              <button
                                onClick={() => setLots(lots.filter((_, i) => i !== idx))}
                                className="px-2 bg-gray-200 rounded-md"
                              >✕</button>
                            </div>
                          ))}
                          <button
                            onClick={() => setLots([...lots, { lotCode: "", qty: 0 }])}
                            className="text-blue-600 text-sm"
                          >+ Add Lot</button>
                          <p className="text-xs text-gray-500">Total lots qty: {lots.reduce((s, l) => s + (l.qty || 0), 0)} / {receivedQty}</p>
                        </div>
                      )}

                      {lotMode === "serials" && (
                        <div className="space-y-2">
                          {serials.map((s, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input
                                type="text"
                                value={s}
                                onChange={(e) => {
                                  const next = [...serials];
                                  next[idx] = e.target.value.toUpperCase();
                                  setSerials(next);
                                }}
                                placeholder="Serial number"
                                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                              />
                              <button
                                onClick={() => setSerials(serials.filter((_, i) => i !== idx))}
                                className="px-2 bg-gray-2 00 rounded-md"
                              >✕</button>
                            </div>
                          ))}
                          <button
                            onClick={() => setSerials([...serials, ""])}
                            className="text-blue-600 text-sm"
                          >+ Add Serial</button>
                          <p className="text-xs text-gray-500">Serials: {serials.filter(Boolean).length} / {receivedQty}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveReceive}
                      className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 font-medium"
                    >
                      Confirm Receive to Staging
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

      {/* Print LP Stub (shows when an LP was created) */}
      {lastCreatedLP && (
        <div className="fixed bottom-6 right-6">
          <button
            onClick={() => {
              const w = window.open("", "_blank");
              if (w) {
                w.document.write(`<pre>LP: ${lastCreatedLP.lpId}\nBin: ${lastCreatedLP.binCode}\nItems:\n${lastCreatedLP.items.map(i => `- ${i.ItemCode} ${i.Description} x ${i.qty}`).join("\n")}\n</pre>`);
                w.document.close();
                w.focus();
              }
            }}
            className="flex items-center gap-2 bg-white shadow-lg border px-4 py-2 rounded-md hover:bg-gray-50"
          >
            <Printer size={16} /> Print LP {lastCreatedLP.lpId}
          </button>
        </div>
      )}

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

