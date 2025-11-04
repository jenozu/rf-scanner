import React, { useState, useEffect, useRef } from "react";
import { CycleCount, BinLocation, CycleCountTransaction, BinItem, InventorySession, TemporaryLocation, TemporaryLocationItem } from "../types";
import { ClipboardCheck, Camera, AlertCircle, CheckCircle2, Plus, FolderOpen, MapPin, X, Save, Play } from "lucide-react";
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
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemCode, setNewItemCode] = useState<string>("");
  const [newItemDescription, setNewItemDescription] = useState<string>("");
  const [newItemQty, setNewItemQty] = useState<number>(0);
  const videoRef = useRef<HTMLDivElement>(null);

  // Session management
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [currentSession, setCurrentSession] = useState<InventorySession | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState<string>("");

  // Temporary locations
  const [temporaryLocations, setTemporaryLocations] = useState<TemporaryLocation[]>([]);
  const [showTempLocationModal, setShowTempLocationModal] = useState(false);
  const [showCreateTempLocationModal, setShowCreateTempLocationModal] = useState(false);
  const [newTempLocationTitle, setNewTempLocationTitle] = useState<string>("");
  const [newTempLocationDescription, setNewTempLocationDescription] = useState<string>("");
  const [showMoveToTempLocationModal, setShowMoveToTempLocationModal] = useState(false);
  const [moveItemQty, setMoveItemQty] = useState<number>(0);

  // Load data
  useEffect(() => {
    const countsData = JSON.parse(localStorage.getItem("rf_cycle_counts") || "[]");
    const binsData = JSON.parse(localStorage.getItem("rf_bins") || "[]");
    const sessionsData = JSON.parse(localStorage.getItem("rf_inventory_sessions") || "[]");
    const tempLocationsData = JSON.parse(localStorage.getItem("rf_temporary_locations") || "[]");
    const currentSessionId = localStorage.getItem("rf_current_inventory_session");
    
    setCycleCounts(countsData);
    setBins(binsData);
    setSessions(sessionsData);
    setTemporaryLocations(tempLocationsData);

    // Restore current session if exists
    if (currentSessionId) {
      const session = sessionsData.find((s: InventorySession) => s.id === currentSessionId);
      if (session && session.status !== "completed") {
        setCurrentSession(session);
        // Restore current cycle count if exists
        if (session.currentCycleCountId) {
          const count = countsData.find((c: CycleCount) => c.id === session.currentCycleCountId);
          if (count) {
            setSelectedCount(count);
            setCountedQty(count.CountedQty || 0);
            setScannedCode(count.BinCode);
          }
        }
      } else {
        localStorage.removeItem("rf_current_inventory_session");
      }
    }

    // Check if we came from bin scan (Start Count button)
    const startBinCode = sessionStorage.getItem("rf_start_count_bin");
    if (startBinCode) {
      sessionStorage.removeItem("rf_start_count_bin");
      // Try to find existing pending count for this bin
      const existingCount = countsData.find(
        (c: CycleCount) => c.BinCode === startBinCode && c.Status === "pending"
      );
      if (existingCount) {
        setSelectedCount(existingCount);
        setCountedQty(0);
        setScannedCode(existingCount.BinCode);
        showToast(`✅ Found pending count for bin ${startBinCode}`, "success");
      } else {
        // Find bin and create a count task for the first item
        const bin = binsData.find((b: BinLocation) => b.BinCode === startBinCode);
        if (bin && bin.Items.length > 0) {
          // Create a cycle count task for the first item
          const firstItem = bin.Items[0];
          const newCount: CycleCount = {
            id: `cc-${Date.now()}`,
            BinCode: startBinCode,
            ItemCode: firstItem.ItemCode,
            ExpectedQty: firstItem.Quantity,
            Status: "pending",
          };
          const updatedCounts = [...countsData, newCount];
          localStorage.setItem("rf_cycle_counts", JSON.stringify(updatedCounts));
          setCycleCounts(updatedCounts);
          
          // Add to current session if exists
          const currentSessionId = localStorage.getItem("rf_current_inventory_session");
          if (currentSessionId) {
            const session = sessionsData.find((s: InventorySession) => s.id === currentSessionId);
            if (session) {
              const updatedSession: InventorySession = {
                ...session,
                cycleCountIds: [...session.cycleCountIds, newCount.id],
                currentCycleCountId: newCount.id,
                lastAccessedDate: new Date().toISOString(),
              };
              const updatedSessions = sessionsData.map((s: InventorySession) => 
                s.id === session.id ? updatedSession : s
              );
              localStorage.setItem("rf_inventory_sessions", JSON.stringify(updatedSessions));
              setCurrentSession(updatedSession);
              setSessions(updatedSessions);
            }
          }
          
          setSelectedCount(newCount);
          setCountedQty(0);
          setScannedCode(newCount.BinCode);
          showToast(`✅ Created count task for ${firstItem.ItemCode} in ${startBinCode}`, "success");
        } else {
          showToast(`ℹ️ Bin ${startBinCode} is empty. Add items first.`, "info");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Session management functions
  const createSession = () => {
    if (!newSessionName.trim()) {
      showToast("⚠️ Please enter a session name", "error");
      return;
    }

    const newSession: InventorySession = {
      id: `session-${Date.now()}`,
      name: newSessionName.trim(),
      createdDate: new Date().toISOString(),
      lastAccessedDate: new Date().toISOString(),
      status: "active",
      cycleCountIds: [],
    };

    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);
    setCurrentSession(newSession);
    localStorage.setItem("rf_inventory_sessions", JSON.stringify(updatedSessions));
    localStorage.setItem("rf_current_inventory_session", newSession.id);
    
    showToast(`✅ Created session: ${newSession.name}`, "success");
    setShowCreateSessionModal(false);
    setNewSessionName("");
  };

  const resumeSession = (session: InventorySession) => {
    const updatedSession: InventorySession = {
      ...session,
      status: "active",
      lastAccessedDate: new Date().toISOString(),
    };

    const updatedSessions = sessions.map((s) => (s.id === session.id ? updatedSession : s));
    setSessions(updatedSessions);
    setCurrentSession(updatedSession);
    localStorage.setItem("rf_inventory_sessions", JSON.stringify(updatedSessions));
    localStorage.setItem("rf_current_inventory_session", session.id);

    // Restore cycle counts from session
    if (session.cycleCountIds.length > 0) {
      const sessionCounts = cycleCounts.filter((c) => session.cycleCountIds.includes(c.id));
      if (sessionCounts.length > 0) {
        const pendingCounts = sessionCounts.filter((c) => c.Status === "pending");
        if (pendingCounts.length > 0) {
          showToast(`✅ Resumed session: ${session.name} (${pendingCounts.length} pending counts)`, "success");
        } else {
          showToast(`✅ Resumed session: ${session.name}`, "success");
        }
      }
    } else {
      showToast(`✅ Resumed session: ${session.name}`, "success");
    }

    setShowSessionModal(false);
  };

  const pauseSession = () => {
    if (!currentSession) return;

    const updatedSession: InventorySession = {
      ...currentSession,
      status: "paused",
      lastAccessedDate: new Date().toISOString(),
      currentCycleCountId: selectedCount?.id,
    };

    const updatedSessions = sessions.map((s) => (s.id === currentSession.id ? updatedSession : s));
    setSessions(updatedSessions);
    setCurrentSession(updatedSession);
    localStorage.setItem("rf_inventory_sessions", JSON.stringify(updatedSessions));

    showToast(`⏸️ Session paused: ${currentSession.name}`, "info");
  };

  const completeSession = () => {
    if (!currentSession) return;

    const updatedSession: InventorySession = {
      ...currentSession,
      status: "completed",
      lastAccessedDate: new Date().toISOString(),
    };

    const updatedSessions = sessions.map((s) => (s.id === currentSession.id ? updatedSession : s));
    setSessions(updatedSessions);
    setCurrentSession(null);
    localStorage.setItem("rf_inventory_sessions", JSON.stringify(updatedSessions));
    localStorage.removeItem("rf_current_inventory_session");

    showToast(`✅ Session completed: ${currentSession.name}`, "success");
  };

  // Temporary location functions
  const createTemporaryLocation = () => {
    if (!newTempLocationTitle.trim()) {
      showToast("⚠️ Please enter a title", "error");
      return;
    }

    const newLocation: TemporaryLocation = {
      id: `temp-${Date.now()}`,
      title: newTempLocationTitle.trim(),
      description: newTempLocationDescription.trim(),
      createdDate: new Date().toISOString(),
      items: [],
    };

    const updatedLocations = [...temporaryLocations, newLocation];
    setTemporaryLocations(updatedLocations);
    localStorage.setItem("rf_temporary_locations", JSON.stringify(updatedLocations));
    
    showToast(`✅ Created temporary location: ${newLocation.title}`, "success");
    setShowCreateTempLocationModal(false);
    setNewTempLocationTitle("");
    setNewTempLocationDescription("");
  };

  const moveItemToTemporaryLocation = (tempLocationId: string) => {
    if (!selectedCount || !binItem || moveItemQty <= 0) return;

    const tempLocation = temporaryLocations.find((tl) => tl.id === tempLocationId);
    if (!tempLocation) return;

    if (moveItemQty > countedQty) {
      showToast("⚠️ Cannot move more than counted quantity", "error");
      return;
    }

    const tempItem: TemporaryLocationItem = {
      itemCode: selectedCount.ItemCode,
      description: binItem.Description,
      quantity: moveItemQty,
      sourceBin: selectedCount.BinCode,
      movedDate: new Date().toISOString(),
    };

    const updatedLocations = temporaryLocations.map((tl) => {
      if (tl.id === tempLocationId) {
        // Check if item already exists, if so add to quantity
        const existingItem = tl.items.find((i) => i.itemCode === selectedCount.ItemCode);
        if (existingItem) {
          return {
            ...tl,
            items: tl.items.map((i) =>
              i.itemCode === selectedCount.ItemCode
                ? { ...i, quantity: i.quantity + moveItemQty }
                : i
            ),
          };
        }
        return {
          ...tl,
          items: [...tl.items, tempItem],
        };
      }
      return tl;
    });

    setTemporaryLocations(updatedLocations);
    localStorage.setItem("rf_temporary_locations", JSON.stringify(updatedLocations));

    // Update counted quantity (subtract moved quantity)
    setCountedQty(countedQty - moveItemQty);

    showToast(`✅ Moved ${moveItemQty} ${selectedCount.ItemCode} to ${tempLocation.title}`, "success");
    setShowMoveToTempLocationModal(false);
    setMoveItemQty(0);
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
    setCountedQty(count.CountedQty || 0);
    setScannedCode(count.BinCode);

    // Update current session if exists
    if (currentSession) {
      const updatedSession: InventorySession = {
        ...currentSession,
        lastAccessedDate: new Date().toISOString(),
        currentCycleCountId: count.id,
        cycleCountIds: currentSession.cycleCountIds.includes(count.id)
          ? currentSession.cycleCountIds
          : [...currentSession.cycleCountIds, count.id],
      };
      const updatedSessions = sessions.map((s) => (s.id === currentSession.id ? updatedSession : s));
      setSessions(updatedSessions);
      setCurrentSession(updatedSession);
      localStorage.setItem("rf_inventory_sessions", JSON.stringify(updatedSessions));
    }
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

    // Update current session if exists
    if (currentSession) {
      const updatedSession: InventorySession = {
        ...currentSession,
        lastAccessedDate: new Date().toISOString(),
        cycleCountIds: currentSession.cycleCountIds.includes(selectedCount.id)
          ? currentSession.cycleCountIds
          : [...currentSession.cycleCountIds, selectedCount.id],
        currentCycleCountId: undefined,
      };
      const updatedSessions = sessions.map((s) => (s.id === currentSession.id ? updatedSession : s));
      setSessions(updatedSessions);
      setCurrentSession(updatedSession);
      localStorage.setItem("rf_inventory_sessions", JSON.stringify(updatedSessions));
    }

    // Update bin inventory (always update, even if variance is 0 for accuracy)
    const bin = bins.find((b) => b.BinCode === selectedCount.BinCode);
    const binItem = bin?.Items.find((i) => i.ItemCode === selectedCount.ItemCode);
    
    const updatedBins = bins.map((bin) => {
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

    // Write CycleCountTransaction
    const txn: CycleCountTransaction = {
      id: `CC-${Date.now()}`,
      binCode: selectedCount.BinCode,
      itemCode: selectedCount.ItemCode,
      description: binItem?.Description || selectedCount.ItemCode,
      expectedQty: selectedCount.ExpectedQty,
      countedQty: countedQty,
      variance: variance,
      timestamp: new Date().toISOString(),
    };
    const existingTxns: CycleCountTransaction[] = JSON.parse(localStorage.getItem("rf_cycle_count_txns") || "[]");
    localStorage.setItem("rf_cycle_count_txns", JSON.stringify([txn, ...existingTxns]));

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
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="text-blue-600" />
            Cycle Counting
          </h1>
          <div className="flex gap-2">
            {currentSession && (
              <div className="bg-blue-50 px-3 py-1 rounded-md text-sm flex items-center gap-2">
                <FolderOpen size={16} className="text-blue-600" />
                <span className="font-medium text-blue-700">{currentSession.name}</span>
                <button
                  onClick={pauseSession}
                  className="text-blue-600 hover:text-blue-800"
                  title="Pause Session"
                >
                  <Save size={14} />
                </button>
              </div>
            )}
            <button
              onClick={() => setShowSessionModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
            >
              <FolderOpen size={16} />
              {currentSession ? "Switch Session" : "Start Session"}
            </button>
            <button
              onClick={() => setShowTempLocationModal(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm flex items-center gap-2"
            >
              <MapPin size={16} />
              Temp Locations
            </button>
          </div>
        </div>

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
            {(() => {
              const pendingCounts = currentSession
                ? cycleCounts.filter((c) => c.Status === "pending" && currentSession.cycleCountIds.includes(c.id))
                : cycleCounts.filter((c) => c.Status === "pending");
              return pendingCounts.length;
            })()}{" "}
            tasks
          </span>
        </div>

        {(() => {
          const pendingCounts = currentSession
            ? cycleCounts.filter((c) => c.Status === "pending" && currentSession.cycleCountIds.includes(c.id))
            : cycleCounts.filter((c) => c.Status === "pending");
          return pendingCounts.length === 0;
        })() ? (
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
            {(() => {
              const pendingCounts = currentSession
                ? cycleCounts.filter((c) => c.Status === "pending" && currentSession.cycleCountIds.includes(c.id))
                : cycleCounts.filter((c) => c.Status === "pending");
              return pendingCounts;
            })()
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
        {(() => {
          const completedCounts = currentSession
            ? cycleCounts.filter((c) => c.Status === "completed" && currentSession.cycleCountIds.includes(c.id))
            : cycleCounts.filter((c) => c.Status === "completed");
          return completedCounts.length > 0;
        })() && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-3">Completed Counts</h2>
            <div className="space-y-2">
              {(() => {
                const completedCounts = currentSession
                  ? cycleCounts.filter((c) => c.Status === "completed" && currentSession.cycleCountIds.includes(c.id))
                  : cycleCounts.filter((c) => c.Status === "completed");
                return completedCounts;
              })()
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

        {/* Session Management Modal */}
        {showSessionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Sessions</h3>
                <button
                  onClick={() => {
                    setShowSessionModal(false);
                    setShowCreateSessionModal(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              {!showCreateSessionModal ? (
                <>
                  <div className="mb-4">
                    <button
                      onClick={() => setShowCreateSessionModal(true)}
                      className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 mb-4"
                    >
                      + Create New Session
                    </button>
                  </div>

                  {sessions.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No sessions yet. Create one to get started!</p>
                  ) : (
                    <div className="space-y-2">
                      {sessions.map((session) => (
                        <div
                          key={session.id}
                          className={`border rounded-lg p-3 ${
                            currentSession?.id === session.id ? "bg-blue-50 border-blue-300" : "bg-white"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-semibold">{session.name}</h4>
                              <p className="text-sm text-gray-600">
                                Status: <span className="capitalize">{session.status}</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                Created: {new Date(session.createdDate).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-gray-500">
                                {session.cycleCountIds.length} counts in session
                              </p>
                            </div>
                            {session.status !== "completed" && (
                              <button
                                onClick={() => resumeSession(session)}
                                className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
                              >
                                <Play size={14} />
                                Resume
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <h4 className="font-semibold mb-3">Create New Session</h4>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Session Name</label>
                    <input
                      type="text"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      placeholder="e.g., Morning Count - Zone A"
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={createSession}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateSessionModal(false);
                        setNewSessionName("");
                      }}
                      className="px-4 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Temporary Locations Modal */}
        {showTempLocationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Temporary Locations</h3>
                <button
                  onClick={() => {
                    setShowTempLocationModal(false);
                    setShowCreateTempLocationModal(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              {!showCreateTempLocationModal ? (
                <>
                  <div className="mb-4">
                    <button
                      onClick={() => setShowCreateTempLocationModal(true)}
                      className="w-full bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 mb-4"
                    >
                      + Create New Temporary Location
                    </button>
                  </div>

                  {temporaryLocations.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No temporary locations yet. Create one to hold misplaced items!</p>
                  ) : (
                    <div className="space-y-3">
                      {temporaryLocations.map((location) => (
                        <div key={location.id} className="border rounded-lg p-3 bg-white">
                          <h4 className="font-semibold mb-1">{location.title}</h4>
                          {location.description && (
                            <p className="text-sm text-gray-600 mb-2">{location.description}</p>
                          )}
                          <p className="text-xs text-gray-500 mb-2">
                            {location.items.length} item{location.items.length !== 1 ? "s" : ""} stored
                          </p>
                          {location.items.length > 0 && (
                            <div className="bg-gray-50 rounded p-2 text-xs">
                              {location.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>{item.itemCode}</span>
                                  <span className="font-medium">Qty: {item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <h4 className="font-semibold mb-3">Create Temporary Location</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Title *</label>
                      <input
                        type="text"
                        value={newTempLocationTitle}
                        onChange={(e) => setNewTempLocationTitle(e.target.value)}
                        placeholder="e.g., Holding Area - Aisle 5"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <textarea
                        value={newTempLocationDescription}
                        onChange={(e) => setNewTempLocationDescription(e.target.value)}
                        placeholder="Brief description of this temporary location"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button
                      onClick={createTemporaryLocation}
                      className="flex-1 bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateTempLocationModal(false);
                        setNewTempLocationTitle("");
                        setNewTempLocationDescription("");
                      }}
                      className="px-4 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
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
          {countedQty > 0 && temporaryLocations.length > 0 && (
            <button
              onClick={() => setShowMoveToTempLocationModal(true)}
              className="px-4 bg-purple-600 text-white py-3 rounded-md hover:bg-purple-700 font-medium flex items-center gap-2"
            >
              <MapPin size={18} />
              Move to Temp
            </button>
          )}
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
      {bin && (
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Bin Contents ({bin.Items.length} items)</h3>
            <button
              onClick={() => setShowAddItemModal(true)}
              className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
            >
              <Plus size={16} /> Add Missing Item
            </button>
          </div>
          {bin.Items.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Empty bin - Add items to count</p>
          ) : (
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
          )}
        </div>
      )}

      {/* Add Missing Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Add Missing Item to Bin</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Item Code</label>
                <input
                  type="text"
                  value={newItemCode}
                  onChange={(e) => setNewItemCode(e.target.value.toUpperCase())}
                  placeholder="Scan or enter item code"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  placeholder="Item description"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(Number(e.target.value))}
                  min="0"
                  placeholder="Enter quantity"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  if (!newItemCode.trim() || !newItemDescription.trim() || newItemQty <= 0) {
                    showToast("⚠️ Please fill all fields with valid values", "error");
                    return;
                  }
                  if (!bin) return;
                  
                  // Check if item already exists in bin
                  if (bin.Items.some((i) => i.ItemCode === newItemCode)) {
                    showToast("⚠️ Item already exists in this bin", "error");
                    return;
                  }

                  // Add item to bin
                  const newItem: BinItem = {
                    ItemCode: newItemCode,
                    Description: newItemDescription,
                    Quantity: newItemQty,
                  };

                  const updatedBins = bins.map((b) => {
                    if (b.BinCode === selectedCount.BinCode) {
                      return {
                        ...b,
                        Items: [...b.Items, newItem],
                      };
                    }
                    return b;
                  });

                  localStorage.setItem("rf_bins", JSON.stringify(updatedBins));
                  setBins(updatedBins);
                  
                  showToast(`✅ Added ${newItemCode} to bin`, "success");
                  setShowAddItemModal(false);
                  setNewItemCode("");
                  setNewItemDescription("");
                  setNewItemQty(0);
                }}
                className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
              >
                Add Item
              </button>
              <button
                onClick={() => {
                  setShowAddItemModal(false);
                  setNewItemCode("");
                  setNewItemDescription("");
                  setNewItemQty(0);
                }}
                className="px-4 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Temporary Location Modal */}
      {showMoveToTempLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Move Item to Temporary Location</h3>
              <button
                onClick={() => {
                  setShowMoveToTempLocationModal(false);
                  setMoveItemQty(0);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Item: <span className="font-medium">{selectedCount.ItemCode}</span>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Counted Qty: <span className="font-medium">{countedQty}</span>
              </p>
              <label className="block text-sm font-medium mb-1">Quantity to Move</label>
              <input
                type="number"
                value={moveItemQty}
                onChange={(e) => setMoveItemQty(Number(e.target.value))}
                min="1"
                max={countedQty}
                placeholder="Enter quantity"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Temporary Location</label>
              {temporaryLocations.length === 0 ? (
                <p className="text-sm text-gray-500 mb-2">No temporary locations available.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {temporaryLocations.map((location) => (
                    <button
                      key={location.id}
                      onClick={() => moveItemToTemporaryLocation(location.id)}
                      disabled={moveItemQty <= 0 || moveItemQty > countedQty}
                      className="w-full text-left border rounded-lg p-3 hover:bg-purple-50 hover:border-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-semibold">{location.title}</div>
                      {location.description && (
                        <div className="text-sm text-gray-600">{location.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setShowMoveToTempLocationModal(false);
                setMoveItemQty(0);
              }}
              className="w-full bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

