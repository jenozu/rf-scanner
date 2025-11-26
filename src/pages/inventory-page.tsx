import React, { useState, useEffect, useRef } from "react";
import { CycleCount, BinLocation, CycleCountTransaction, BinItem, InventorySession, TemporaryLocation, TemporaryLocationItem, SessionItem } from "../types";
import { ClipboardCheck, Camera, AlertCircle, CheckCircle2, Plus, FolderOpen, MapPin, X, Save, Play, ChevronRight, ChevronLeft, SkipForward, Download, List, Upload } from "lucide-react";
import Quagga from "@ericblade/quagga2";
import { parseCSV } from "../data/csv-utils";

interface InventoryPageProps {
  setPage: (page: any) => void;
}

// Sequential count item for bin range counting
interface SequentialCountItem {
  binCode: string;
  zone: string;
  itemCode: string;
  description: string;
  expectedQty: number;
}

// Enhanced session count log entry
interface SessionCountLog {
  sessionId: string;
  sessionName: string;
  username: string;
  timestamp: string;
  binCode: string;
  itemCode: string;
  description: string;
  expectedQty: number;
  countedQty: number;
  variance: number;
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

  // Session tracking form
  const [showSessionTrackingForm, setShowSessionTrackingForm] = useState(false);
  const [selectedSessionForTracking, setSelectedSessionForTracking] = useState<InventorySession | null>(null);
  const [sessionTrackingItemCode, setSessionTrackingItemCode] = useState<string>("");
  const [sessionTrackingQty, setSessionTrackingQty] = useState<number>(0);
  const [sessionTrackingScanMode, setSessionTrackingScanMode] = useState<boolean>(false);
  const sessionTrackingVideoRef = useRef<HTMLDivElement>(null);

  // Temporary location tracking form
  const [showTempLocationTrackingForm, setShowTempLocationTrackingForm] = useState(false);
  const [selectedTempLocationForTracking, setSelectedTempLocationForTracking] = useState<TemporaryLocation | null>(null);
  const [tempTrackingItemCode, setTempTrackingItemCode] = useState<string>("");
  const [tempTrackingQty, setTempTrackingQty] = useState<number>(0);
  const [tempTrackingScanMode, setTempTrackingScanMode] = useState<boolean>(false);
  const tempTrackingVideoRef = useRef<HTMLDivElement>(null);

  // Temporary location detail view
  const [selectedTempLocationDetail, setSelectedTempLocationDetail] = useState<TemporaryLocation | null>(null);
  const [detailViewItemCode, setDetailViewItemCode] = useState<string>("");
  const [detailViewQty, setDetailViewQty] = useState<number>(0);
  const [detailViewScanMode, setDetailViewScanMode] = useState<boolean>(false);
  const detailViewVideoRef = useRef<HTMLDivElement>(null);

  // Sequential counting mode state
  const [countingMode, setCountingMode] = useState<"cycle" | "sequential" | "full">("cycle");
  const [showBinRangeModal, setShowBinRangeModal] = useState(false);
  const [startBinFilter, setStartBinFilter] = useState<string>("");
  const [endBinFilter, setEndBinFilter] = useState<string>("");
  const [sequentialItems, setSequentialItems] = useState<SequentialCountItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(0);
  const [sessionCountLogs, setSessionCountLogs] = useState<SessionCountLog[]>([]);
  const [showNumpad, setShowNumpad] = useState(false);
  const [numpadValue, setNumpadValue] = useState<string>("");

  // Full counting mode state
  const [fullCountFile, setFullCountFile] = useState<File | null>(null);
  const [fullCountItems, setFullCountItems] = useState<CycleCount[]>([]);
  const [fullCountStatus, setFullCountStatus] = useState<string>("");

  // Load data
  useEffect(() => {
    const countsData = JSON.parse(localStorage.getItem("rf_cycle_counts") || "[]");
    const binsData = JSON.parse(localStorage.getItem("rf_bins") || "[]");
    const sessionsDataRaw = JSON.parse(localStorage.getItem("rf_inventory_sessions") || "[]");
    const tempLocationsData = JSON.parse(localStorage.getItem("rf_temporary_locations") || "[]");
    const currentSessionId = localStorage.getItem("rf_current_inventory_session");
    const logsData = JSON.parse(localStorage.getItem("rf_session_count_logs") || "[]");
    
    // Ensure backward compatibility: initialize items array for existing sessions
    const sessionsData = sessionsDataRaw.map((s: InventorySession) => ({
      ...s,
      items: s.items || [],
    }));
    
    setCycleCounts(countsData);
    setBins(binsData);
    setSessions(sessionsData);
    setTemporaryLocations(tempLocationsData);
    setSessionCountLogs(logsData);

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
      items: [],
    };

    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);
    setCurrentSession(newSession);
    localStorage.setItem("rf_inventory_sessions", JSON.stringify(updatedSessions));
    localStorage.setItem("rf_current_inventory_session", newSession.id);
    
    showToast(`✅ Created session: ${newSession.name}`, "success");
    setShowCreateSessionModal(false);
    setNewSessionName("");
    
    // Open tracking form
    setSelectedSessionForTracking(newSession);
    setShowSessionTrackingForm(true);
  };

  const resumeSession = (session: InventorySession) => {
    const updatedSession: InventorySession = {
      ...session,
      status: "active",
      lastAccessedDate: new Date().toISOString(),
      items: session.items || [],
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
    
    // Open tracking form
    setSelectedTempLocationForTracking(newLocation);
    setShowTempLocationTrackingForm(true);
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

  // Add item to session
  const addItemToSession = () => {
    if (!selectedSessionForTracking || !sessionTrackingItemCode.trim() || sessionTrackingQty <= 0) {
      showToast("⚠️ Please enter item code and quantity", "error");
      return;
    }

    // Try to find item description from bins
    let description = "";
    const bin = bins.find((b) => b.Items.some((i) => i.ItemCode === sessionTrackingItemCode.trim()));
    if (bin) {
      const item = bin.Items.find((i) => i.ItemCode === sessionTrackingItemCode.trim());
      if (item) {
        description = item.Description;
      }
    }

    const newItem: SessionItem = {
      itemCode: sessionTrackingItemCode.trim(),
      description: description || undefined,
      quantity: sessionTrackingQty,
      addedDate: new Date().toISOString(),
    };

    const updatedSession: InventorySession = {
      ...selectedSessionForTracking,
      items: [...(selectedSessionForTracking.items || []), newItem],
    };

    const updatedSessions = sessions.map((s) => (s.id === selectedSessionForTracking.id ? updatedSession : s));
    setSessions(updatedSessions);
    setSelectedSessionForTracking(updatedSession);
    if (currentSession?.id === updatedSession.id) {
      setCurrentSession(updatedSession);
    }
    localStorage.setItem("rf_inventory_sessions", JSON.stringify(updatedSessions));

    showToast(`✅ Added ${sessionTrackingItemCode} (${sessionTrackingQty}) to session`, "success");
    setSessionTrackingItemCode("");
    setSessionTrackingQty(0);
    setSessionTrackingScanMode(false);
  };

  // Add item to temporary location (from tracking form)
  const addItemToTempLocationTracking = () => {
    if (!selectedTempLocationForTracking || !tempTrackingItemCode.trim() || tempTrackingQty <= 0) {
      showToast("⚠️ Please enter item code and quantity", "error");
      return;
    }

    // Try to find item description from bins
    let description = "";
    const bin = bins.find((b) => b.Items.some((i) => i.ItemCode === tempTrackingItemCode.trim()));
    if (bin) {
      const item = bin.Items.find((i) => i.ItemCode === tempTrackingItemCode.trim());
      if (item) {
        description = item.Description;
      }
    }

    const newItem: TemporaryLocationItem = {
      itemCode: tempTrackingItemCode.trim(),
      description: description || tempTrackingItemCode.trim(),
      quantity: tempTrackingQty,
      movedDate: new Date().toISOString(),
    };

    const updatedLocation: TemporaryLocation = {
      ...selectedTempLocationForTracking,
      items: [...selectedTempLocationForTracking.items, newItem],
    };

    const updatedLocations = temporaryLocations.map((tl) => (tl.id === selectedTempLocationForTracking.id ? updatedLocation : tl));
    setTemporaryLocations(updatedLocations);
    setSelectedTempLocationForTracking(updatedLocation);
    localStorage.setItem("rf_temporary_locations", JSON.stringify(updatedLocations));

    showToast(`✅ Added ${tempTrackingItemCode} (${tempTrackingQty}) to location`, "success");
    setTempTrackingItemCode("");
    setTempTrackingQty(0);
    setTempTrackingScanMode(false);
  };

  // Add item to temporary location (from detail view)
  const addItemToTempLocationDetail = () => {
    if (!selectedTempLocationDetail || !detailViewItemCode.trim() || detailViewQty <= 0) {
      showToast("⚠️ Please enter item code and quantity", "error");
      return;
    }

    // Try to find item description from bins
    let description = "";
    const bin = bins.find((b) => b.Items.some((i) => i.ItemCode === detailViewItemCode.trim()));
    if (bin) {
      const item = bin.Items.find((i) => i.ItemCode === detailViewItemCode.trim());
      if (item) {
        description = item.Description;
      }
    }

    const newItem: TemporaryLocationItem = {
      itemCode: detailViewItemCode.trim(),
      description: description || detailViewItemCode.trim(),
      quantity: detailViewQty,
      movedDate: new Date().toISOString(),
    };

    const updatedLocation: TemporaryLocation = {
      ...selectedTempLocationDetail,
      items: [...selectedTempLocationDetail.items, newItem],
    };

    const updatedLocations = temporaryLocations.map((tl) => (tl.id === selectedTempLocationDetail.id ? updatedLocation : tl));
    setTemporaryLocations(updatedLocations);
    setSelectedTempLocationDetail(updatedLocation);
    localStorage.setItem("rf_temporary_locations", JSON.stringify(updatedLocations));

    showToast(`✅ Added ${detailViewItemCode} (${detailViewQty}) to location`, "success");
    setDetailViewItemCode("");
    setDetailViewQty(0);
    setDetailViewScanMode(false);
  };

  // Remove item from temporary location
  const removeItemFromTempLocation = (locationId: string, itemIndex: number) => {
    const location = temporaryLocations.find((tl) => tl.id === locationId);
    if (!location) return;

    const updatedItems = location.items.filter((_, idx) => idx !== itemIndex);
    const updatedLocation: TemporaryLocation = {
      ...location,
      items: updatedItems,
    };

    const updatedLocations = temporaryLocations.map((tl) => (tl.id === locationId ? updatedLocation : tl));
    setTemporaryLocations(updatedLocations);
    if (selectedTempLocationDetail?.id === locationId) {
      setSelectedTempLocationDetail(updatedLocation);
    }
    localStorage.setItem("rf_temporary_locations", JSON.stringify(updatedLocations));

    showToast("✅ Item removed", "success");
  };

  // ========== Sequential Counting Functions ==========

  // Start sequential count with bin range
  const startSequentialCount = () => {
    if (!startBinFilter.trim() || !endBinFilter.trim()) {
      showToast("⚠️ Please enter both start and end bin codes", "error");
      return;
    }

    // Sort bins alphabetically
    const sortedBins = [...bins].sort((a, b) => a.BinCode.localeCompare(b.BinCode));
    
    // Filter bins within range (inclusive)
    const filteredBins = sortedBins.filter((bin) => {
      return bin.BinCode >= startBinFilter.trim() && bin.BinCode <= endBinFilter.trim();
    });

    if (filteredBins.length === 0) {
      showToast("⚠️ No bins found in the specified range", "error");
      return;
    }

    // Build sequential items list
    const items: SequentialCountItem[] = [];
    filteredBins.forEach((bin) => {
      bin.Items.forEach((item) => {
        items.push({
          binCode: bin.BinCode,
          zone: bin.Zone,
          itemCode: item.ItemCode,
          description: item.Description,
          expectedQty: item.Quantity,
        });
      });
    });

    if (items.length === 0) {
      showToast("⚠️ No items found in the specified bin range", "error");
      return;
    }

    setSequentialItems(items);
    setCurrentItemIndex(0);
    setCountingMode("sequential");
    setShowBinRangeModal(false);
    showToast(`✅ Loaded ${items.length} items from ${filteredBins.length} bins`, "success");
  };

  // Handle sequential count submission
  const submitSequentialCount = (qty: number) => {
    if (!currentSession) {
      showToast("⚠️ No active session. Please start a session first.", "error");
      return;
    }

    const currentItem = sequentialItems[currentItemIndex];
    if (!currentItem) return;

    const variance = qty - currentItem.expectedQty;

    // Get current user info
    const currentUserId = sessionStorage.getItem("rf_current_user_id");
    const users = JSON.parse(localStorage.getItem("rf_users") || "[]");
    const currentUser = users.find((u: any) => u.id === currentUserId);
    const username = currentUser ? currentUser.username : "Unknown";

    // Create log entry
    const logEntry: SessionCountLog = {
      sessionId: currentSession.id,
      sessionName: currentSession.name,
      username: username,
      timestamp: new Date().toISOString(),
      binCode: currentItem.binCode,
      itemCode: currentItem.itemCode,
      description: currentItem.description,
      expectedQty: currentItem.expectedQty,
      countedQty: qty,
      variance: variance,
    };

    // Add to session logs
    const updatedLogs = [...sessionCountLogs, logEntry];
    setSessionCountLogs(updatedLogs);
    localStorage.setItem("rf_session_count_logs", JSON.stringify(updatedLogs));

    // Update bin inventory
    const updatedBins = bins.map((bin) => {
      if (bin.BinCode === currentItem.binCode) {
        const updatedItems = bin.Items.map((item) => {
          if (item.ItemCode === currentItem.itemCode) {
            return { ...item, Quantity: qty };
          }
          return item;
        });
        return { ...bin, Items: updatedItems };
      }
      return bin;
    });
    setBins(updatedBins);
    localStorage.setItem("rf_bins", JSON.stringify(updatedBins));

    // Write to cycle count transaction log (for compatibility)
    const txn: CycleCountTransaction = {
      id: `SEQ-${Date.now()}`,
      binCode: currentItem.binCode,
      itemCode: currentItem.itemCode,
      description: currentItem.description,
      expectedQty: currentItem.expectedQty,
      countedQty: qty,
      variance: variance,
      timestamp: new Date().toISOString(),
    };
    const existingTxns: CycleCountTransaction[] = JSON.parse(localStorage.getItem("rf_cycle_count_txns") || "[]");
    localStorage.setItem("rf_cycle_count_txns", JSON.stringify([txn, ...existingTxns]));

    if (variance === 0) {
      showToast("✅ Count accurate!", "success");
    } else {
      showToast(`⚠️ Variance: ${variance > 0 ? "+" : ""}${variance}`, "info");
    }

    // Move to next item
    if (currentItemIndex < sequentialItems.length - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
      setCountedQty(0);
      setNumpadValue("");
    } else {
      showToast("🎉 All items in range have been counted!", "success");
      // Stay on last item, allow export
    }
  };

  // Skip current item
  const skipCurrentItem = () => {
    if (currentItemIndex < sequentialItems.length - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
      setCountedQty(0);
      setNumpadValue("");
      showToast("⏭️ Item skipped", "info");
    }
  };

  // Go to previous item
  const goToPreviousItem = () => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(currentItemIndex - 1);
      setCountedQty(0);
      setNumpadValue("");
    }
  };

  // Export session count logs to CSV
  const exportSessionLogsToCSV = () => {
    if (!currentSession) {
      showToast("⚠️ No active session", "error");
      return;
    }

    // Filter logs for current session
    const sessionLogs = sessionCountLogs.filter((log) => log.sessionId === currentSession.id);

    if (sessionLogs.length === 0) {
      showToast("⚠️ No counts logged in this session yet", "error");
      return;
    }

    // Build CSV content
    const headers = ["Session ID", "Session Name", "Username", "Timestamp", "Bin Code", "Item Code", "Description", "Expected Qty", "Counted Qty", "Variance"];
    const rows = sessionLogs.map((log) => [
      log.sessionId,
      log.sessionName,
      log.username,
      log.timestamp,
      log.binCode,
      log.itemCode,
      log.description,
      log.expectedQty.toString(),
      log.countedQty.toString(),
      log.variance.toString(),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory_session_${currentSession.name}_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`✅ Exported ${sessionLogs.length} count records`, "success");
  };

  // Exit sequential mode
  const exitSequentialMode = () => {
    setCountingMode("cycle");
    setSequentialItems([]);
    setCurrentItemIndex(0);
    setCountedQty(0);
    setNumpadValue("");
  };

  // Numpad functions
  const handleNumpadClick = (digit: string) => {
    if (digit === "C") {
      setNumpadValue("");
      setCountedQty(0);
    } else if (digit === "⌫") {
      setNumpadValue(numpadValue.slice(0, -1));
      setCountedQty(Number(numpadValue.slice(0, -1)) || 0);
    } else {
      const newValue = numpadValue + digit;
      setNumpadValue(newValue);
      setCountedQty(Number(newValue));
    }
  };;

  // Full Count functions
  const handleFullCountFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFullCountFile(file);
    const fileType = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') 
      ? 'Excel' 
      : 'CSV';
    setFullCountStatus(`⏳ Parsing ${fileType} file...`);

    try {
      // Use the existing parseCSV which returns Item[]
      const parsedItems = await parseCSV(file);
      
      // Convert Item[] to CycleCount[]
      const newCycleCounts: CycleCount[] = parsedItems.map((item, index) => ({
        id: `full-count-${Date.now()}-${index}`,
        BinCode: item.BinCode,
        ItemCode: item.ItemCode,
        ExpectedQty: item.ExpectedQty,
        // The uploaded file contains the counted quantity
        CountedQty: item.CountedQty ?? 0, 
        Variance: item.Variance ?? 0,
        Status: item.CountedQty !== undefined ? "counted" : "pending", // Mark as counted if Qty is present
      }));

      setFullCountItems(newCycleCounts);
      setFullCountStatus(`✅ Loaded ${newCycleCounts.length} items from ${fileType} file. Ready to process.`);
      showToast(`✅ Loaded ${newCycleCounts.length} items for full count.`, "success");
    } catch (err) {
      console.error("Error parsing full count file:", err);
      setFullCountStatus(`❌ Error reading ${fileType} file. Please check the format and column names (BinCode, ItemCode, ExpectedQty, CountedQty).`);
    }
  };

  const processFullCount = () => {
    if (!currentSession) {
      showToast("⚠️ Please start a session first", "error");
      return;
    }

    if (fullCountItems.length === 0) {
      showToast("⚠️ No items loaded for full count", "error");
      return;
    }

    // 1. Update the main cycleCounts list
    const newCounts = fullCountItems.filter(c => c.Status === "counted");
    const updatedCounts = [...cycleCounts, ...newCounts];
    localStorage.setItem("rf_cycle_counts", JSON.stringify(updatedCounts));
    setCycleCounts(updatedCounts);

    // 2. Update the current session with the new cycle count IDs
    const newCountIds = newCounts.map(c => c.id);
    const updatedSession: InventorySession = {
      ...currentSession,
      cycleCountIds: [...currentSession.cycleCountIds, ...newCountIds],
      lastAccessedDate: new Date().toISOString(),
    };
    const updatedSessions = sessions.map((s) => (s.id === currentSession.id ? updatedSession : s));
    localStorage.setItem("rf_inventory_sessions", JSON.stringify(updatedSessions));
    setCurrentSession(updatedSession);
    setSessions(updatedSessions);

    // 3. Update the bin inventory with the counted quantities
    let updatedBins = [...bins];
    const txns: CycleCountTransaction[] = [];

    newCounts.forEach(newCount => {
      const variance = newCount.CountedQty! - newCount.ExpectedQty;
      
      // Find and update the bin
      const binIndex = updatedBins.findIndex(b => b.BinCode === newCount.BinCode);
      if (binIndex !== -1) {
        const itemIndex = updatedBins[binIndex].Items.findIndex(i => i.ItemCode === newCount.ItemCode);
        if (itemIndex !== -1) {
          // Update the quantity in the bin
          updatedBins[binIndex].Items[itemIndex].Quantity = newCount.CountedQty!;
        } else {
          // Item not found in bin, add it (this shouldn't happen if master data is correct, but for robustness)
          updatedBins[binIndex].Items.push({
            ItemCode: newCount.ItemCode,
            Description: newCount.ItemCode, // Fallback description
            Quantity: newCount.CountedQty!,
          });
        }
      } else {
        // Bin not found, create a new bin (unlikely for full count, but for robustness)
        updatedBins.push({
          BinCode: newCount.BinCode,
          Zone: "FULL_COUNT",
          Items: [{
            ItemCode: newCount.ItemCode,
            Description: newCount.ItemCode,
            Quantity: newCount.CountedQty!,
          }],
        });
      }

      // Create a transaction log
      txns.push({
        id: `CC-${Date.now()}-${newCount.id}`,
        binCode: newCount.BinCode,
        itemCode: newCount.ItemCode,
        description: newCount.ItemCode, // Fallback description
        expectedQty: newCount.ExpectedQty,
        countedQty: newCount.CountedQty!,
        variance: variance,
        timestamp: new Date().toISOString(),
      });
    });

    localStorage.setItem("rf_bins", JSON.stringify(updatedBins));
    setBins(updatedBins);

    // 4. Save transactions
    const existingTxns: CycleCountTransaction[] = JSON.parse(localStorage.getItem("rf_cycle_count_txns") || "[]");
    localStorage.setItem("rf_cycle_count_txns", JSON.stringify([...txns, ...existingTxns]));

    // 5. Reset and notify
    setFullCountFile(null);
    setFullCountItems([]);
    setFullCountStatus(`✅ Successfully processed ${newCounts.length} counted items.`);
    showToast(`✅ Full count processed! ${newCounts.length} items updated.`, "success");
    setCountingMode("cycle"); // Switch back to cycle view
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

  // Initialize scanner for session tracking form
  useEffect(() => {
    if (sessionTrackingScanMode && sessionTrackingVideoRef.current) {
      Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            target: sessionTrackingVideoRef.current,
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
        if (code) {
          setSessionTrackingItemCode(code);
          setSessionTrackingScanMode(false);
          showToast(`✅ Scanned: ${code}`, "success");
        }
      });

      return () => {
        Quagga.stop();
        Quagga.offDetected(() => {});
      };
    }
  }, [sessionTrackingScanMode]);

  // Initialize scanner for temp location tracking form
  useEffect(() => {
    if (tempTrackingScanMode && tempTrackingVideoRef.current) {
      Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            target: tempTrackingVideoRef.current,
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
        if (code) {
          setTempTrackingItemCode(code);
          setTempTrackingScanMode(false);
          showToast(`✅ Scanned: ${code}`, "success");
        }
      });

      return () => {
        Quagga.stop();
        Quagga.offDetected(() => {});
      };
    }
  }, [tempTrackingScanMode]);

  // Initialize scanner for detail view
  useEffect(() => {
    if (detailViewScanMode && detailViewVideoRef.current) {
      Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            target: detailViewVideoRef.current,
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
        if (code) {
          setDetailViewItemCode(code);
          setDetailViewScanMode(false);
          showToast(`✅ Scanned: ${code}`, "success");
        }
      });

      return () => {
        Quagga.stop();
        Quagga.offDetected(() => {});
      };
    }
  }, [detailViewScanMode]);

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
  if (!selectedCount && countingMode === "cycle") {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="text-blue-600" />
            Inventory Counting
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

        {/* Mode Selection */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-3">Counting Mode</h2>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => {
                if (!currentSession) {
                  showToast("⚠️ Please start a session first", "error");
                  setShowSessionModal(true);
                  return;
                }
                setShowBinRangeModal(true);
              }}
              className="bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700 font-medium flex items-center justify-center gap-2"
            >
              <List size={20} />
              Sequential Count (Bin Range)
            </button>
            <button
              onClick={() => setCountingMode("cycle")}
              className="bg-gray-200 text-gray-700 px-4 py-3 rounded-md hover:bg-gray-300 font-medium flex items-center justify-center gap-2"
            >
              <ClipboardCheck size={20} />
              Cycle Count (Task List)
            </button>
            <button
              onClick={() => {
                if (!currentSession) {
                  showToast("⚠️ Please start a session first", "error");
                  setShowSessionModal(true);
                  return;
                }
                setCountingMode("full");
              }}
              className="bg-yellow-600 text-white px-4 py-3 rounded-md hover:bg-yellow-700 font-medium flex items-center justify-center gap-2"
            >
              <Upload size={20} />
              Full Inventory Count (Upload)
            </button>
          </div>
          {currentSession && sessionCountLogs.filter(l => l.sessionId === currentSession.id).length > 0 && (
            <button
              onClick={exportSessionLogsToCSV}
              className="mt-3 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Export Session Log ({sessionCountLogs.filter(l => l.sessionId === currentSession.id).length} counts)
            </button>
          )}
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

        {/* Bin Range Filter Modal */}
        {showBinRangeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Select Bin Range</h3>
                <button
                  onClick={() => {
                    setShowBinRangeModal(false);
                    setStartBinFilter("");
                    setEndBinFilter("");
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Enter the start and end bin codes to count all items within that range (inclusive).
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Bin Code</label>
                  <input
                    type="text"
                    value={startBinFilter}
                    onChange={(e) => setStartBinFilter(e.target.value.toUpperCase())}
                    placeholder="e.g., A-01-01"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Bin Code</label>
                  <input
                    type="text"
                    value={endBinFilter}
                    onChange={(e) => setEndBinFilter(e.target.value.toUpperCase())}
                    placeholder="e.g., A-01-10"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={startSequentialCount}
                  className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 font-medium"
                >
                  Start Counting
                </button>
                <button
                  onClick={() => {
                    setShowBinRangeModal(false);
                    setStartBinFilter("");
                    setEndBinFilter("");
                  }}
                  className="px-4 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
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
                        <div 
                          key={location.id} 
                          onClick={() => {
                            setSelectedTempLocationDetail(location);
                            setShowTempLocationModal(false);
                          }}
                          className="border rounded-lg p-3 bg-white cursor-pointer hover:shadow-md transition-shadow hover:border-purple-300"
                        >
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

  // Render full count UI
  if (countingMode === "full") {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Upload className="text-yellow-600" />
            Full Inventory Count (Upload)
          </h1>
          <button
            onClick={() => setCountingMode("cycle")}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm flex items-center gap-2"
          >
            <X size={16} />
            Cancel
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">1. Upload Count File</h2>
          <p className="text-gray-600 mb-4">
            Upload a CSV or Excel file containing your full inventory count. The file must contain the following columns: 
            <code className="font-mono bg-gray-100 p-1 rounded-md">BinCode</code>, 
            <code className="font-mono bg-gray-100 p-1 rounded-md">ItemCode</code>, 
            <code className="font-mono bg-gray-100 p-1 rounded-md">ExpectedQty</code>, and 
            <code className="font-mono bg-gray-100 p-1 rounded-md">CountedQty</code>.
          </p>
          
          <label className="block">
            <span className="sr-only">Choose file</span>
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFullCountFileUpload}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-yellow-50 file:text-yellow-700
                hover:file:bg-yellow-100"
            />
          </label>
          <p className="mt-3 text-sm text-gray-500">{fullCountStatus}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">2. Process Count</h2>
          <p className="text-gray-600 mb-4">
            Once the file is uploaded and parsed, click the button below to apply the counted quantities to your inventory and log the cycle count transactions in the current session: 
            <span className="font-medium text-blue-600">{currentSession?.name}</span>.
          </p>
          
          <button
            onClick={processFullCount}
            disabled={fullCountItems.length === 0}
            className={`w-full py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors ${
              fullCountItems.length > 0
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <CheckCircle2 size={20} />
            Process {fullCountItems.length} Counted Items
          </button>
          
          {fullCountItems.length > 0 && (
            <div className="mt-4 text-sm text-gray-500">
              <p>Items loaded: {fullCountItems.length}</p>
              <p>Items marked as counted: {fullCountItems.filter(c => c.Status === "counted").length}</p>
            </div>
          )}
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
      </div>
    );
  }

  // Render sequential counting UI
  if (countingMode === "sequential" && sequentialItems.length > 0) {
    const currentItem = sequentialItems[currentItemIndex];
    const progress = ((currentItemIndex + 1) / sequentialItems.length) * 100;

    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={exitSequentialMode}
            className="text-blue-600 hover:underline flex items-center gap-1"
          >
            ← Back to Menu
          </button>
          {currentSession && (
            <div className="bg-blue-50 px-3 py-1 rounded-md text-sm flex items-center gap-2">
              <FolderOpen size={16} className="text-blue-600" />
              <span className="font-medium text-blue-700">{currentSession.name}</span>
            </div>
          )}
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

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Item {currentItemIndex + 1} of {sequentialItems.length}
            </span>
            <span className="text-sm font-medium text-gray-700">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Current Item Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-blue-600">{currentItem.binCode}</h2>
              <p className="text-gray-600">{currentItem.zone}</p>
            </div>
            <button
              onClick={exportSessionLogsToCSV}
              className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
            >
              <Download size={16} />
              Export
            </button>
          </div>

          <div className="border-t pt-4 mb-4">
            <h3 className="font-semibold text-lg mb-2">Item Details</h3>
            <p className="text-gray-700">
              <span className="font-medium">Item Code:</span> {currentItem.itemCode}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Description:</span> {currentItem.description}
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <p className="text-center text-sm text-gray-600 mb-1">Expected Quantity</p>
            <p className="text-center text-4xl font-bold text-blue-600">
              {currentItem.expectedQty}
            </p>
          </div>

          {/* Numpad Display */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Counted Quantity</label>
            <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-gray-800">
                {numpadValue || "0"}
              </p>
            </div>
            {countedQty !== currentItem.expectedQty && countedQty >= 0 && (
              <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                <AlertCircle
                  className={countedQty > currentItem.expectedQty ? "text-yellow-600" : "text-red-600"}
                  size={16}
                />
                <span className="font-medium">
                  Variance: {countedQty - currentItem.expectedQty > 0 ? "+" : ""}
                  {countedQty - currentItem.expectedQty}
                </span>
              </div>
            )}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "C", "⌫"].map((digit) => (
              <button
                key={digit}
                onClick={() => handleNumpadClick(digit)}
                className={`py-4 text-xl font-semibold rounded-lg ${
                  digit === "C" || digit === "⌫"
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                }`}
              >
                {digit}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => submitSequentialCount(currentItem.expectedQty)}
              className="bg-green-600 text-white py-3 rounded-md hover:bg-green-700 font-medium flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} />
              Confirm ({currentItem.expectedQty})
            </button>
            <button
              onClick={() => {
                if (countedQty >= 0) {
                  submitSequentialCount(countedQty);
                } else {
                  showToast("⚠️ Please enter a quantity", "error");
                }
              }}
              disabled={countedQty < 0}
              className="bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:bg-gray-400"
            >
              Submit Count
            </button>
          </div>

          {/* Navigation Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={goToPreviousItem}
              disabled={currentItemIndex === 0}
              className="bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 font-medium flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
              Previous
            </button>
            <button
              onClick={skipCurrentItem}
              disabled={currentItemIndex >= sequentialItems.length - 1}
              className="bg-yellow-500 text-white py-2 rounded-md hover:bg-yellow-600 font-medium flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SkipForward size={18} />
              Skip
            </button>
            <button
              onClick={() => {
                if (currentItemIndex < sequentialItems.length - 1) {
                  setCurrentItemIndex(currentItemIndex + 1);
                  setCountedQty(0);
                  setNumpadValue("");
                }
              }}
              disabled={currentItemIndex >= sequentialItems.length - 1}
              className="bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 font-medium flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Session Stats */}
        {currentSession && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Session Statistics</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Items Counted</p>
                <p className="text-2xl font-bold text-blue-600">
                  {sessionCountLogs.filter((l) => l.sessionId === currentSession.id).length}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Variances Found</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {sessionCountLogs.filter((l) => l.sessionId === currentSession.id && l.variance !== 0).length}
                </p>
              </div>
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

      {/* Session Tracking Form Modal */}
      {showSessionTrackingForm && selectedSessionForTracking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Track Items - {selectedSessionForTracking.name}</h3>
              <button
                onClick={() => {
                  setShowSessionTrackingForm(false);
                  setSelectedSessionForTracking(null);
                  setSessionTrackingItemCode("");
                  setSessionTrackingQty(0);
                  setSessionTrackingScanMode(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Item Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sessionTrackingItemCode}
                    onChange={(e) => setSessionTrackingItemCode(e.target.value.toUpperCase())}
                    placeholder="Scan or enter item code"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                  />
                  <button
                    onClick={() => setSessionTrackingScanMode(!sessionTrackingScanMode)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Camera size={16} />
                    {sessionTrackingScanMode ? "Stop" : "Scan"}
                  </button>
                </div>
                {sessionTrackingScanMode && (
                  <div
                    ref={sessionTrackingVideoRef}
                    className="w-full max-w-sm aspect-video bg-black rounded-md overflow-hidden mx-auto mt-2"
                  ></div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  value={sessionTrackingQty}
                  onChange={(e) => setSessionTrackingQty(Number(e.target.value))}
                  min="1"
                  placeholder="Enter quantity"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <button
                onClick={addItemToSession}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
              >
                Add Item
              </button>
            </div>

            {/* List of items in session */}
            {selectedSessionForTracking.items && selectedSessionForTracking.items.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold mb-3">Items in Session ({selectedSessionForTracking.items.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedSessionForTracking.items.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 rounded p-3 flex justify-between items-center">
                      <div>
                        <span className="font-medium">{item.itemCode}</span>
                        {item.description && (
                          <p className="text-sm text-gray-600">{item.description}</p>
                        )}
                      </div>
                      <span className="font-medium">Qty: {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Temporary Location Tracking Form Modal */}
      {showTempLocationTrackingForm && selectedTempLocationForTracking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Track Items - {selectedTempLocationForTracking.title}</h3>
              <button
                onClick={() => {
                  setShowTempLocationTrackingForm(false);
                  setSelectedTempLocationForTracking(null);
                  setTempTrackingItemCode("");
                  setTempTrackingQty(0);
                  setTempTrackingScanMode(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Item Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempTrackingItemCode}
                    onChange={(e) => setTempTrackingItemCode(e.target.value.toUpperCase())}
                    placeholder="Scan or enter item code"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                  />
                  <button
                    onClick={() => setTempTrackingScanMode(!tempTrackingScanMode)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Camera size={16} />
                    {tempTrackingScanMode ? "Stop" : "Scan"}
                  </button>
                </div>
                {tempTrackingScanMode && (
                  <div
                    ref={tempTrackingVideoRef}
                    className="w-full max-w-sm aspect-video bg-black rounded-md overflow-hidden mx-auto mt-2"
                  ></div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  value={tempTrackingQty}
                  onChange={(e) => setTempTrackingQty(Number(e.target.value))}
                  min="1"
                  placeholder="Enter quantity"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <button
                onClick={addItemToTempLocationTracking}
                className="w-full bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700"
              >
                Add Item
              </button>
            </div>

            {/* List of items in location */}
            {selectedTempLocationForTracking.items.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold mb-3">Items in Location ({selectedTempLocationForTracking.items.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedTempLocationForTracking.items.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 rounded p-3 flex justify-between items-center">
                      <div>
                        <span className="font-medium">{item.itemCode}</span>
                        {item.description && (
                          <p className="text-sm text-gray-600">{item.description}</p>
                        )}
                      </div>
                      <span className="font-medium">Qty: {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Temporary Location Detail View */}
      {selectedTempLocationDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold">{selectedTempLocationDetail.title}</h3>
                {selectedTempLocationDetail.description && (
                  <p className="text-sm text-gray-600 mt-1">{selectedTempLocationDetail.description}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedTempLocationDetail(null);
                  setDetailViewItemCode("");
                  setDetailViewQty(0);
                  setDetailViewScanMode(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Add Item Form */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold mb-4">Add Item</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Item Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={detailViewItemCode}
                      onChange={(e) => setDetailViewItemCode(e.target.value.toUpperCase())}
                      placeholder="Scan or enter item code"
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    />
                    <button
                      onClick={() => setDetailViewScanMode(!detailViewScanMode)}
                      className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center gap-2"
                    >
                      <Camera size={16} />
                      {detailViewScanMode ? "Stop" : "Scan"}
                    </button>
                  </div>
                  {detailViewScanMode && (
                    <div
                      ref={detailViewVideoRef}
                      className="w-full max-w-sm aspect-video bg-black rounded-md overflow-hidden mx-auto mt-2"
                    ></div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    value={detailViewQty}
                    onChange={(e) => setDetailViewQty(Number(e.target.value))}
                    min="1"
                    placeholder="Enter quantity"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <button
                  onClick={addItemToTempLocationDetail}
                  className="w-full bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700"
                >
                  Add Item
                </button>
              </div>
            </div>

            {/* List of items */}
            <div>
              <h4 className="font-semibold mb-3">
                Items ({selectedTempLocationDetail.items.length})
              </h4>
              {selectedTempLocationDetail.items.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No items yet. Add items using the form above.</p>
              ) : (
                <div className="space-y-2">
                  {selectedTempLocationDetail.items.map((item, idx) => (
                    <div key={idx} className="bg-white border rounded-lg p-3 flex justify-between items-center">
                      <div className="flex-1">
                        <span className="font-medium">{item.itemCode}</span>
                        {item.description && (
                          <p className="text-sm text-gray-600">{item.description}</p>
                        )}
                        {item.sourceBin && (
                          <p className="text-xs text-gray-500">From: {item.sourceBin}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-medium">Qty: {item.quantity}</span>
                        <button
                          onClick={() => removeItemFromTempLocation(selectedTempLocationDetail.id, idx)}
                          className="text-red-600 hover:text-red-800"
                          title="Remove item"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

