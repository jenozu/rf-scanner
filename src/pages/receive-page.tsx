import React, { useState, useEffect, useRef } from "react";
import { PurchaseOrder, POItem, BinLocation } from "../types";
import { Package, Check, AlertCircle, Plus, Upload, Search as SearchIcon, Download, Calculator } from "lucide-react";
import { getStagingBinCode } from "../utils/config";
import { parsePOFile } from "../data/csv-utils";
import QuantityNumpad from "../components/quantity-numpad";
import { useCollection } from "../data/hooks";
import { receiveStock, saveCollection, upsertManyRecords } from "../data/ops";

interface ReceivePageProps {
  setPage: (page: any) => void;
}

export default function ReceivePage({ setPage }: ReceivePageProps) {
  // Orders and bins come from the server (shared by every device). The selected
  // PO and line are remembered by id/position so they follow the live data.
  const { data: purchaseOrders } = useCollection<PurchaseOrder[]>("rf_purchase_orders", []);
  const { data: bins } = useCollection<BinLocation[]>("rf_bins", []);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [receivingIndex, setReceivingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Same attempt (same payload) keeps the same transaction id, so a retry after a
  // lost response cannot receive the stock twice.
  const attemptRef = useRef<{ key: string; id: string } | null>(null);
  const selectedPO = purchaseOrders.find((po) => po.id === selectedPOId) ?? null;
  const receivingItem: POItem | null =
    selectedPO && receivingIndex !== null ? selectedPO.items[receivingIndex] ?? null : null;
  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [selectedBin, setSelectedBin] = useState<string>("");
  const [newBinCode, setNewBinCode] = useState<string>("");
  const [showNewBinModal, setShowNewBinModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [showNumpad, setShowNumpad] = useState(false);
  const [lotMode, setLotMode] = useState<"none" | "lots" | "serials">("none");
  const [lots, setLots] = useState<Array<{ lotCode: string; qty: number }>>([]);
  const [serials, setSerials] = useState<string[]>([]);
  // Local PO search
  const [poSearch, setPoSearch] = useState<string>("");
  // Server PO listing/search
  const [serverSearch, setServerSearch] = useState<string>("");
  const [serverFiles, setServerFiles] = useState<string[]>([]);
  const [serverLoading, setServerLoading] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string>("");

  useEffect(() => {
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
    setSelectedPOId(po.id);
    setReceivingIndex(null);
  };

  // Start receiving an item
  const handleReceiveItem = (item: POItem, index: number) => {
    setReceivingIndex(index);
    setReceivedQty(item.OrderedQty - item.ReceivedQty); // Default to remaining qty
    // Pre-fill with PO's bin code as default
    setSelectedBin(item.BinCode || getStagingBinCode());
    setLots([]);
    setSerials([]);
    setLotMode(item.RequiresLotSerial ? "lots" : "none");
  };

  // Save received quantity
  const handleSaveReceive = async () => {
    if (!selectedPO || !receivingItem) return;

    // Bin is optional - use PO's bin or skip assignment if blank
    const finalBin = selectedBin || receivingItem.BinCode || getStagingBinCode();

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

    if (isSaving || receivingIndex === null) return;

    const lotsToSend = lotMode === "lots" ? lots : undefined;
    const serialsToSend = lotMode === "serials" ? serials : undefined;
    const attemptKey = JSON.stringify([selectedPO.id, receivingIndex, receivedQty, finalBin, lotsToSend, serialsToSend]);
    if (attemptRef.current?.key !== attemptKey) {
      attemptRef.current = {
        key: attemptKey,
        id: `RCV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
    }

    setIsSaving(true);
    try {
      // One request: PO line + bin quantity + receiving log, all or nothing.
      const result = await receiveStock({
        poId: selectedPO.id,
        lineIndex: receivingIndex,
        qty: receivedQty,
        binCode: finalBin,
        txnId: attemptRef.current.id,
        createBin: { Zone: "Main", Capacity: 1000, Status: "active" },
        lots: lotsToSend,
        serials: serialsToSend,
      });
      attemptRef.current = null;

      setReceivingIndex(null);
      setReceivedQty(0);
      setSelectedBin("");
      setLots([]);
      setSerials([]);

      showToast(
        result.duplicate
          ? "ℹ️ This receipt was already saved"
          : `✅ Received ${receivedQty} of ${receivingItem.Description} → Bin: ${finalBin}`,
        "success"
      );
    } catch (error: any) {
      // Nothing was saved (or the same attempt can be retried safely). Keep the form.
      showToast(`❌ Not saved: ${error?.message || "server error"}. Try again.`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Create new bin
  const handleCreateBin = async () => {
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

    try {
      // Refused (and reloaded) if someone else changed the bin list since this
      // device last loaded it; the user just taps Create again.
      await saveCollection("rf_bins", [...bins, newBin]);
      setSelectedBin(newBin.BinCode);
      setNewBinCode("");
      setShowNewBinModal(false);
      showToast(`✅ Created new bin: ${newBin.BinCode}`, "success");
    } catch (error: any) {
      showToast(`❌ Bin not created: ${error?.message || "server error"}`, "error");
    }
  };

  // Fetch server PO file index from /data/pos/ (nginx autoindex)
  const fetchServerPOIndex = async () => {
    setServerError("");
    setServerLoading(true);
    try {
      const res = await fetch("/data/pos/");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      // Extract links to .csv/.xlsx files
      const links = Array.from(html.matchAll(/href=\"([^\"]+)\"/g))
        .map(m => m[1])
        .filter(href => /\.(csv|xlsx|xls)$/i.test(href))
        // Remove parent directory links and anchors
        .filter(href => !href.startsWith("?"))
        .map(href => decodeURIComponent(href.replace(/^\/?/,'').replace(/#.*/,'').replace(/\?.*/,'')));
      // Deduplicate
      const unique = Array.from(new Set(links));
      setServerFiles(unique);
    } catch (e: any) {
      setServerError(`Failed to load server PO list: ${e.message || e}`);
    } finally {
      setServerLoading(false);
    }
  };

  // Import a PO file from server by filename
  const handleImportServerPO = async (filename: string) => {
    try {
      showToast(`⏳ Loading ${filename}...`, "info");
      const url = `/data/pos/${encodeURIComponent(filename)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || (filename.toLowerCase().endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') });
      const newPOs = await parsePOFile(file);
      const existingPONumbers = new Set(purchaseOrders.map(po => po.poNumber));
      const uniqueNewPOs = newPOs.filter(po => !existingPONumbers.has(po.poNumber));
      if (uniqueNewPOs.length > 0) await upsertManyRecords("rf_purchase_orders", uniqueNewPOs, true);
      showToast(`✅ Imported ${uniqueNewPOs.length} PO(s) from server file`, "success");
    } catch (e: any) {
      showToast(`❌ Import failed: ${e.message || e}`, "error");
    }
  };

  // Handle PO file upload
  const handlePOFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast("⏳ Parsing PO file...", "info");

    try {
      const newPOs = await parsePOFile(file);
      
      // Merge with existing POs (don't duplicate if PO number exists)
      const existingPONumbers = new Set(purchaseOrders.map(po => po.poNumber));
      
      const uniqueNewPOs = newPOs.filter(po => !existingPONumbers.has(po.poNumber));
      
      if (uniqueNewPOs.length === 0) {
        showToast("⚠️ All POs in file already exist. No new POs added.", "info");
        e.target.value = ""; // Reset file input
        return;
      }

      await upsertManyRecords("rf_purchase_orders", uniqueNewPOs, true);
      
      showToast(`✅ Loaded ${uniqueNewPOs.length} purchase order(s) from ${file.name}`, "success");
      e.target.value = ""; // Reset file input
    } catch (err) {
      console.error("Error importing PO file:", err);
      showToast("❌ Could not import the file. Check the PO file format and try again.", "error");
      e.target.value = ""; // Reset file input
    }
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

        {/* Upload PO File Button */}
        <div className="mb-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Upload className="text-blue-600" size={20} />
            <h3 className="font-semibold text-blue-900">Upload Purchase Orders</h3>
          </div>
          <p className="text-sm text-gray-700 mb-3">
            Upload a CSV or XLSX file with PO data. Required columns: <code className="text-xs bg-white px-1 rounded">poNumber</code>, <code className="text-xs bg-white px-1 rounded">vendor</code>, <code className="text-xs bg-white px-1 rounded">expectedDate</code>, <code className="text-xs bg-white px-1 rounded">ItemCode</code>, <code className="text-xs bg-white px-1 rounded">Description</code>, <code className="text-xs bg-white px-1 rounded">OrderedQty</code>
          </p>
          <label className="cursor-pointer inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
            <Upload size={16} className="inline mr-2" />
            Upload PO File (CSV/XLSX)
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handlePOFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Search & Import from Server */}
        <div className="mb-6 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Download className="text-purple-600" size={20} />
            <h3 className="font-semibold text-purple-900">Load POs from Server (/data/pos)</h3>
          </div>
          <div className="flex gap-2">
            <input
              value={serverSearch}
              onChange={(e) => setServerSearch(e.target.value)}
              placeholder="Search by PO number or filename..."
              className="flex-1 border border-gray-300 rounded-md px-3 py-2"
            />
            <button onClick={fetchServerPOIndex} className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">Fetch</button>
          </div>
          {serverError && <p className="text-sm text-red-600 mt-2">{serverError}</p>}
          {serverLoading && <p className="text-sm text-gray-600 mt-2">Loading...</p>}
          {!serverLoading && serverFiles.length > 0 && (
            <div className="mt-3 max-h-56 overflow-auto border rounded-md bg-white">
              {serverFiles
                .filter(name => serverSearch ? name.toLowerCase().includes(serverSearch.toLowerCase()) : true)
                .map(name => (
                  <div key={name} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                    <span className="text-sm text-gray-800 truncate mr-3">{name}</span>
                    <button onClick={() => handleImportServerPO(name)} className="text-sm px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700">Import</button>
                  </div>
              ))}
            </div>
          )}
        </div>

        {/* Local PO search */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Search POs</label>
          <div className="flex gap-2">
            <input
              value={poSearch}
              onChange={(e) => setPoSearch(e.target.value)}
              placeholder="Search PO number or vendor..."
              className="flex-1 border border-gray-300 rounded-md px-3 py-2"
            />
            <div className="px-3 py-2 border rounded-md bg-gray-50 text-gray-700 text-sm flex items-center gap-1">
              <SearchIcon size={14} /> {purchaseOrders.filter(po => !poSearch || po.poNumber.toLowerCase().includes(poSearch.toLowerCase()) || po.vendor.toLowerCase().includes(poSearch.toLowerCase())).length}
            </div>
          </div>
        </div>

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
            {purchaseOrders
              .filter(po => !poSearch || po.poNumber.toLowerCase().includes(poSearch.toLowerCase()) || po.vendor.toLowerCase().includes(poSearch.toLowerCase()))
              .map((po) => (
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
        onClick={() => { setSelectedPOId(null); setReceivingIndex(null); }}
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
        {selectedPO.items.map((item, index) => {
          const isReceiving = receivingIndex === index;
          const remaining = item.OrderedQty - item.ReceivedQty;
          const isComplete = remaining === 0;

          return (
            <div
              key={`${item.LineNumber ?? index}-${item.ItemCode}`}
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
                    onClick={() => handleReceiveItem(item, index)}
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium">
                        Quantity Received
                      </label>
                      <button
                        onClick={() => setShowNumpad(true)}
                        className="text-blue-600 text-sm flex items-center gap-1 hover:underline"
                      >
                        <Calculator size={16} /> Numpad
                      </button>
                    </div>
                    <input
                      type="number"
                      value={receivedQty}
                      onChange={(e) => setReceivedQty(Number(e.target.value))}
                      max={remaining}
                      min={0}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Remaining to receive: {remaining}
                    </p>
                  </div>

                  {/* Bin location input (optional - defaults to PO's bin if available) */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">
                      Bin Location {item.BinCode && `(default: ${item.BinCode})`}
                    </label>
                    <input
                      type="text"
                      value={selectedBin}
                      onChange={(e) => setSelectedBin(e.target.value.toUpperCase())}
                      placeholder={item.BinCode || "Enter bin location (optional)"}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.BinCode 
                        ? `Will use "${item.BinCode}" from PO if left blank.` 
                        : "Leave blank to use staging area."}
                    </p>
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
                      disabled={isSaving}
                      className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 font-medium disabled:bg-gray-400"
                    >
                      {isSaving ? "Saving..." : "Confirm Receive to Staging"}
                    </button>
                    <button
                      onClick={() => setReceivingIndex(null)}
                      disabled={isSaving}
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

      {/* Quantity Numpad Modal */}
      {showNumpad && receivingItem && (
        <QuantityNumpad
          value={receivedQty}
          onChange={(value) => setReceivedQty(value)}
          onClose={() => setShowNumpad(false)}
          max={receivingItem.OrderedQty - receivingItem.ReceivedQty}
          label={`Enter Quantity for ${receivingItem.Description}`}
        />
      )}
    </div>
  );
}

