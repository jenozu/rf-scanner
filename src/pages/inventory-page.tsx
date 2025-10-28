import React, { useState, useEffect, useRef } from "react";
import { CycleCount, BinLocation } from "../types";
import { ClipboardCheck, Camera, AlertCircle, CheckCircle2 } from "lucide-react";
import Quagga from "@ericblade/quagga2";

interface InventoryPageProps {
  setPage: (page: any) => void;
}

export default function InventoryPage({ setPage }: InventoryPageProps) {
  const [cycleCounts, setCycleCounts] = useState<CycleCount[]>([]);
  const [bins, setBins] = useState<BinLocation[]>([]);
  const [selectedCount, setSelectedCount] = useState<CycleCount | null>(null);
  const [countedQty, setCountedQty] = useState<number>(0);
  const [scanMode, setScanMode] = useState<boolean>(false);
  const [scannedCode, setScannedCode] = useState<string>("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  // Load data
  useEffect(() => {
    const countsData = JSON.parse(localStorage.getItem("rf_cycle_counts") || "[]");
    const binsData = JSON.parse(localStorage.getItem("rf_bins") || "[]");
    setCycleCounts(countsData);
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

  // Initialize scanner when scan mode is enabled
  useEffect(() => {
    if (scanMode && videoRef.current) {
      Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            target: videoRef.current,
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
            showToast("Failed to start camera", "error");
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
    }
  }, [scanMode]);

  // Handle barcode scan
  const handleScan = (code: string) => {
    setScannedCode(code);
    
    // Find cycle count task for this bin
    const count = cycleCounts.find(
      (c) => c.BinCode === code && c.Status === "pending"
    );

    if (count) {
      setSelectedCount(count);
      setCountedQty(0);
      setScanMode(false);
      showToast(`✅ Scanned bin: ${code}`, "success");
    } else {
      showToast(`❌ No pending count task for bin: ${code}`, "error");
    }
  };

  // Select count task manually
  const handleSelectCount = (count: CycleCount) => {
    setSelectedCount(count);
    setCountedQty(0);
    setScannedCode(count.BinCode);
  };

  // Submit count
  const handleSubmitCount = () => {
    if (!selectedCount) return;

    const variance = countedQty - selectedCount.ExpectedQty;
    const updatedCount: CycleCount = {
      ...selectedCount,
      CountedQty: countedQty,
      Variance: variance,
      CountDate: new Date().toISOString(),
      Status: "completed",
    };

    // Update cycle counts
    const updatedCounts = cycleCounts.map((c) =>
      c.id === selectedCount.id ? updatedCount : c
    );

    // Update bin inventory if there's a variance
    let updatedBins = bins;
    if (variance !== 0) {
      updatedBins = bins.map((bin) => {
        if (bin.BinCode === selectedCount.BinCode) {
          const updatedItems = bin.Items.map((item) => {
            if (item.ItemCode === selectedCount.ItemCode) {
              return {
                ...item,
                Quantity: countedQty,
              };
            }
            return item;
          });
          return { ...bin, Items: updatedItems };
        }
        return bin;
      });
    }

    // Save to localStorage
    localStorage.setItem("rf_cycle_counts", JSON.stringify(updatedCounts));
    localStorage.setItem("rf_bins", JSON.stringify(updatedBins));

    // Update state
    setCycleCounts(updatedCounts);
    setBins(updatedBins);

    if (variance === 0) {
      showToast("✅ Count accurate!", "success");
    } else {
      showToast(`⚠️ Variance detected: ${variance > 0 ? "+" : ""}${variance}`, "info");
    }

    // Reset
    setSelectedCount(null);
    setCountedQty(0);
    setScannedCode("");
  };

  // Render task list
  if (!selectedCount) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <ClipboardCheck className="text-blue-600" />
          Cycle Counting
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

        {/* Scan Mode */}
        {scanMode ? (
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-3">Scan Bin Location</h2>
              <div
                ref={videoRef}
                className="w-full max-w-sm aspect-video bg-black rounded-md overflow-hidden mx-auto mb-4"
              ></div>
              <button
                onClick={() => setScanMode(false)}
                className="w-full bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300"
              >
                Cancel Scan
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setScanMode(true)}
            className="mb-6 w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
          >
            <Camera size={20} />
            Scan Bin Location
          </button>
        )}

        {/* Task List */}
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Pending Counts</h2>
          <span className="text-sm text-gray-600">
            {cycleCounts.filter((c) => c.Status === "pending").length} tasks
          </span>
        </div>

        {cycleCounts.filter((c) => c.Status === "pending").length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CheckCircle2 size={48} className="mx-auto mb-4 opacity-50 text-green-500" />
            <p>All cycle counts completed!</p>
            <button
              onClick={() => setPage("setup")}
              className="mt-4 text-blue-600 underline"
            >
              Go to Setup to reset data
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {cycleCounts
              .filter((c) => c.Status === "pending")
              .map((count) => {
                const bin = bins.find((b) => b.BinCode === count.BinCode);

                return (
                  <div
                    key={count.id}
                    onClick={() => handleSelectCount(count)}
                    className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-blue-500"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          {count.BinCode}
                          <span className="text-sm text-gray-500 font-normal">
                            {bin?.Zone}
                          </span>
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Item: {count.ItemCode}
                        </p>
                        <p className="text-sm text-gray-600">
                          Expected: {count.ExpectedQty} units
                        </p>
                      </div>
                      <button
                        onClick={() => handleSelectCount(count)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                      >
                        Count
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Completed Counts */}
        {cycleCounts.filter((c) => c.Status === "completed").length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-3">Completed Counts</h2>
            <div className="space-y-2">
              {cycleCounts
                .filter((c) => c.Status === "completed")
                .map((count) => (
                  <div
                    key={count.id}
                    className="bg-gray-50 rounded-lg p-3 opacity-70"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{count.BinCode} - {count.ItemCode}</p>
                        <p className="text-sm text-gray-600">
                          Expected: {count.ExpectedQty} | Counted: {count.CountedQty}
                        </p>
                      </div>
                      <div className="text-right">
                        {count.Variance === 0 ? (
                          <CheckCircle2 className="text-green-600" size={24} />
                        ) : (
                          <div className="flex items-center gap-2">
                            <AlertCircle className="text-yellow-600" size={24} />
                            <span className="text-sm font-medium">
                              {count.Variance! > 0 ? "+" : ""}
                              {count.Variance}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render counting form
  const bin = bins.find((b) => b.BinCode === selectedCount.BinCode);
  const binItem = bin?.Items.find((i) => i.ItemCode === selectedCount.ItemCode);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <button
        onClick={() => {
          setSelectedCount(null);
          setCountedQty(0);
          setScannedCode("");
        }}
        className="mb-4 text-blue-600 hover:underline"
      >
        ← Back to Task List
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

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-2">{selectedCount.BinCode}</h2>
        <p className="text-gray-600 mb-6">{bin?.Zone}</p>

        <div className="border-t pt-4 mb-6">
          <h3 className="font-semibold text-lg mb-2">Item to Count</h3>
          <p className="text-gray-700">
            <span className="font-medium">Item Code:</span> {selectedCount.ItemCode}
          </p>
          {binItem && (
            <p className="text-gray-700">
              <span className="font-medium">Description:</span> {binItem.Description}
            </p>
          )}
        </div>

        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <p className="text-center text-sm text-gray-600 mb-1">Expected Quantity</p>
          <p className="text-center text-3xl font-bold text-blue-600">
            {selectedCount.ExpectedQty}
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Physical Count
          </label>
          <input
            type="number"
            value={countedQty}
            onChange={(e) => setCountedQty(Number(e.target.value))}
            placeholder="Enter counted quantity"
            className="w-full border border-gray-300 rounded-md px-4 py-3 text-lg"
            autoFocus
          />
          {countedQty !== selectedCount.ExpectedQty && countedQty > 0 && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <AlertCircle
                className={countedQty > selectedCount.ExpectedQty ? "text-yellow-600" : "text-red-600"}
                size={16}
              />
              <span className="font-medium">
                Variance: {countedQty - selectedCount.ExpectedQty > 0 ? "+" : ""}
                {countedQty - selectedCount.ExpectedQty}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSubmitCount}
            disabled={countedQty < 0}
            className="flex-1 bg-green-600 text-white py-3 rounded-md hover:bg-green-700 font-medium text-lg disabled:bg-gray-400"
          >
            Submit Count
          </button>
          <button
            onClick={() => {
              setSelectedCount(null);
              setCountedQty(0);
              setScannedCode("");
            }}
            className="px-6 bg-gray-200 text-gray-700 py-3 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Bin Contents Summary */}
      {bin && bin.Items.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3">Current Bin Contents</h3>
          <div className="space-y-2">
            {bin.Items.map((item) => (
              <div
                key={item.ItemCode}
                className={`flex justify-between p-2 rounded ${
                  item.ItemCode === selectedCount.ItemCode
                    ? "bg-blue-50 border border-blue-200"
                    : "bg-gray-50"
                }`}
              >
                <span className="text-sm">
                  {item.ItemCode} - {item.Description}
                </span>
                <span className="text-sm font-medium">{item.Quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

