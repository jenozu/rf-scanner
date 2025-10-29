import React, { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";
import { Item, BinLocation } from "../types";
import { Package, MapPin, Plus, Search } from "lucide-react";
import { displayBinCode, normalizeBinInput } from "../utils/bin-utils";
import { smartSearch } from "../utils/search-utils";

interface ScanPageProps {
  setPage: (page: any) => void;
  onAdjustItem?: (itemCode: string) => void;
}

interface Toast {
  message: string;
  type: "success" | "error" | "info";
}

type ScanResult = {
  type: "item" | "bin" | "multiple";
  item?: Item;
  bin?: BinLocation;
  matches?: Item[];
};

const ScanPage: React.FC<ScanPageProps> = ({ setPage, onAdjustItem }) => {
  const [scannedCode, setScannedCode] = useState<string>("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [manualCode, setManualCode] = useState<string>("");
  const [bins, setBins] = useState<BinLocation[]>([]);
  const [showNewBinModal, setShowNewBinModal] = useState(false);
  const [newBinCode, setNewBinCode] = useState<string>("");
  const [newBinZone, setNewBinZone] = useState<string>("");
  const [toast, setToast] = useState<Toast | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  // Load bins
  useEffect(() => {
    const binsData = JSON.parse(localStorage.getItem("rf_bins") || "[]");
    setBins(binsData);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: Toast["type"] = "info") => {
    setToast({ message, type });
  };

  // ✅ Initialize barcode scanner
  useEffect(() => {
    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: videoRef.current!,
          constraints: {
            facingMode: "environment",
          },
        },
        decoder: {
          readers: ["code_128_reader", "ean_reader", "upc_reader"],
        },
      },
      (err) => {
        if (err) {
          console.error("Quagga init error:", err);
          return;
        }
        Quagga.start();
      }
    );

    Quagga.onDetected((result) => {
      const code = result.codeResult.code;
      if (code && code !== scannedCode) {
        handleScan(code);
      }
    });

    return () => {
      Quagga.stop();
      Quagga.offDetected(() => {});
    };
  }, []);

  // ✅ Handle barcode scan with smart search
  const handleScan = (code: string) => {
    console.log("Scanned:", code);
    setScannedCode(code);

    const items = JSON.parse(localStorage.getItem("rf_active") || "[]") as Item[];
    const result = smartSearch(code, bins, items);
    
    if (result) {
      if (result.type === "bin" && result.bin) {
        setScanResult({ type: "bin", bin: result.bin });
        showToast(`✅ Found bin: ${displayBinCode(result.bin.BinCode)}`, "success");
      } else if (result.type === "item" && result.item) {
        setScanResult({ type: "item", item: result.item });
        showToast(`✅ Found item: ${result.item.ItemCode}`, "success");
      } else if (result.matches && result.matches.length > 0) {
        setScanResult({ type: "multiple", matches: result.matches });
        showToast(`📋 Found ${result.matches.length} matching items`, "info");
      }
    } else {
      setScanResult(null);
      showToast(`❌ No matches found for: ${code}`, "error");
    }
  };

  // Handle manual lookup with normalization
  const handleManualLookup = () => {
    if (!manualCode.trim()) {
      showToast("⚠️ Please enter a code", "error");
      return;
    }
    // Normalize input (adds "01-" prefix if it looks like a bin code)
    const normalized = normalizeBinInput(manualCode.trim());
    handleScan(normalized);
  };
  
  // Handle selecting an item from multiple matches
  const handleSelectMatch = (item: Item) => {
    setScanResult({ type: "item", item });
    showToast(`✅ Selected: ${item.ItemCode}`, "success");
  };

  // Create new bin
  const handleCreateBin = () => {
    if (!newBinCode.trim()) {
      showToast("⚠️ Please enter a bin code", "error");
      return;
    }

    if (!newBinZone.trim()) {
      showToast("⚠️ Please enter a zone", "error");
      return;
    }

    // Check if bin already exists
    if (bins.some((bin) => bin.BinCode === newBinCode.toUpperCase())) {
      showToast("⚠️ Bin already exists", "error");
      return;
    }

    const newBin: BinLocation = {
      BinCode: newBinCode.toUpperCase(),
      Zone: newBinZone,
      Capacity: 100,
      Status: "active",
      Items: [],
    };

    const updatedBins = [...bins, newBin];
    localStorage.setItem("rf_bins", JSON.stringify(updatedBins));
    setBins(updatedBins);
    setNewBinCode("");
    setNewBinZone("");
    setShowNewBinModal(false);
    showToast(`✅ Created new bin: ${newBin.BinCode}`, "success");

    // Show the newly created bin
    setScanResult({ type: "bin", bin: newBin });
  };

  // Clear scan result
  const handleClearScan = () => {
    setScanResult(null);
    setScannedCode("");
    setManualCode("");
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Search className="text-blue-600" />
        Scan & Inquiry
      </h1>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg transition-opacity ${
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

      {/* ✅ Live camera stream */}
      <div
        ref={videoRef}
        className="w-full max-w-sm aspect-video bg-black rounded-md overflow-hidden mx-auto mb-4"
      ></div>

      {/* Manual Lookup */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium mb-2">Manual Lookup</label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            onKeyPress={(e) => e.key === "Enter" && handleManualLookup()}
            placeholder="Enter item or bin code"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2"
          />
          <button
            onClick={handleManualLookup}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            <Search size={20} />
          </button>
        </div>
      </div>

      {/* Display scanned result */}
      {scanResult ? (
        <div className="space-y-4">
          {scanResult.type === "bin" && scanResult.bin && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="text-blue-600" size={24} />
                    <h2 className="text-2xl font-bold">{displayBinCode(scanResult.bin.BinCode)}</h2>
                  </div>
                  <p className="text-gray-600">{scanResult.bin.Zone}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Capacity: {scanResult.bin.Capacity} units
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    scanResult.bin.Status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {scanResult.bin.Status.toUpperCase()}
                </span>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package size={20} className="text-gray-600" />
                  Bin Contents ({scanResult.bin.Items.length} items)
                </h3>
                {scanResult.bin.Items.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Empty bin</p>
                ) : (
                  <div className="space-y-2">
                    {scanResult.bin.Items.map((item) => (
                      <div
                        key={item.ItemCode}
                        className="flex justify-between items-center bg-gray-50 p-3 rounded-md"
                      >
                        <div>
                          <p className="font-medium">{item.ItemCode}</p>
                          <p className="text-sm text-gray-600">{item.Description}</p>
                        </div>
                        <span className="text-lg font-bold text-blue-600">
                          {item.Quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleClearScan}
                className="w-full mt-4 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          )}

          {scanResult.type === "item" && scanResult.item && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="text-blue-600" size={24} />
                <div>
                  <h2 className="text-2xl font-bold">{scanResult.item.ItemCode}</h2>
                  <p className="text-gray-600">{scanResult.item.Description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Expected Qty</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {scanResult.item.ExpectedQty}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Counted Qty</p>
                  <p className="text-2xl font-bold text-green-600">
                    {scanResult.item.CountedQty !== undefined && scanResult.item.CountedQty !== null
                      ? scanResult.item.CountedQty
                      : <span className="text-sm text-gray-400">Not counted</span>}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={20} className="text-gray-600" />
                  <p className="font-medium">Location</p>
                </div>
                <p className="text-lg">{displayBinCode(scanResult.item.BinCode)}</p>
              </div>

              {scanResult.item.Variance !== undefined && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600 mb-1">Variance</p>
                  <p
                    className={`text-lg font-bold ${
                      scanResult.item.Variance === 0
                        ? "text-green-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {scanResult.item.Variance > 0 ? "+" : ""}
                    {scanResult.item.Variance}
                  </p>
                </div>
              )}

              <button
                onClick={handleClearScan}
                className="w-full mt-4 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          )}

          {scanResult.type === "multiple" && scanResult.matches && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <Search className="text-blue-600" size={24} />
                <div>
                  <h2 className="text-xl font-bold">
                    {scanResult.matches.length} Matching Items
                  </h2>
                  <p className="text-sm text-gray-600">Click an item to select it</p>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {scanResult.matches.map((item) => (
                  <button
                    key={item.ItemCode}
                    onClick={() => handleSelectMatch(item)}
                    className="w-full text-left bg-gray-50 hover:bg-blue-50 p-4 rounded-md transition border-2 border-transparent hover:border-blue-200"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-lg">{item.ItemCode}</p>
                        <p className="text-sm text-gray-600">{item.Description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <MapPin size={14} className="text-gray-400" />
                          <span className="text-xs text-gray-500">
                            Bin: {displayBinCode(item.BinCode)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm text-gray-500">Expected</p>
                        <p className="text-xl font-bold text-blue-600">{item.ExpectedQty}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleClearScan}
                className="w-full mt-4 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      ) : scannedCode ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-yellow-800">
            No bin or item found for code: <strong>{scannedCode}</strong>
          </p>
          <button
            onClick={() => {
              setNewBinCode(scannedCode);
              setShowNewBinModal(true);
            }}
            className="mt-3 text-blue-600 hover:underline flex items-center justify-center gap-2 mx-auto"
          >
            <Plus size={16} />
            Create as new bin
          </button>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Search size={48} className="mx-auto mb-4 opacity-50" />
          <p>Scan a barcode or enter a code manually</p>
          <button
            onClick={() => setShowNewBinModal(true)}
            className="mt-4 text-blue-600 hover:underline flex items-center gap-2 mx-auto"
          >
            <Plus size={16} />
            Create New Bin
          </button>
        </div>
      )}

      {/* New Bin Modal */}
      {showNewBinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Create New Bin</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Bin Code</label>
                <input
                  type="text"
                  value={newBinCode}
                  onChange={(e) => setNewBinCode(e.target.value.toUpperCase())}
                  placeholder="e.g., A-01-01"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Zone</label>
                <input
                  type="text"
                  value={newBinZone}
                  onChange={(e) => setNewBinZone(e.target.value)}
                  placeholder="e.g., Zone A - Storage"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
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
                  setNewBinZone("");
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
};

export default ScanPage;
