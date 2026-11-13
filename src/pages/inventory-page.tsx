import React, { useState, useEffect, useMemo, useRef } from "react";
import { CycleCount, BinLocation, CycleCountTransaction, BinItem, InventorySession, TemporaryLocation, TemporaryLocationItem, SessionItem } from "../types";
import { ClipboardCheck, Camera, AlertCircle, CheckCircle2, Plus, FolderOpen, MapPin, X, Save, Play, Download, List } from "lucide-react";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { buildSequentialItems, countLogsToCsv, selectBinsForCount, uploadedRowsToCounts } from "./inventory/counting-logic";
import type { SequentialCountItem, SessionCountLog, ToastState } from "./inventory/types";
import { ToastBanner } from "./inventory/toast-banner";
import { SequentialCountScreen } from "./inventory/sequential-count-screen";
import { FullCountScreen } from "./inventory/full-count-screen";
import { BinRangeModal } from "./inventory/bin-range-modal";
import { BinInfoModal } from "./inventory/bin-info-modal";
import { VarianceApprovals } from "../components/variance-approvals";
import { parseCSV } from "../data/csv-utils";
import { useCollection } from "../data/hooks";
import { appendRecords, saveBinChanges, saveRecordChanges, submitCounts } from "../data/ops";

// The signed-in user's name (saved at login); used for count logs and bin locks.
const currentUsername = () => sessionStorage.getItem("rf_current_username") || "Unknown";

interface InventoryPageProps {
  setPage: (page: any) => void;
}

export default function InventoryPage({ setPage }: InventoryPageProps) {
  // Counting data lives on the server and is shared by every device. The lists
  // below are the latest server copy (refreshed on focus and every 30 s).
  const cycleCountsC = useCollection<CycleCount[]>("rf_cycle_counts", []);
  const binsC = useCollection<BinLocation[]>("rf_bins", []);
  const sessionsC = useCollection<InventorySession[]>("rf_inventory_sessions", []);
  const tempLocationsC = useCollection<TemporaryLocation[]>("rf_temporary_locations", []);
  const countLogsC = useCollection<SessionCountLog[]>("rf_session_count_logs", []);
  const cycleCounts = cycleCountsC.data;
  const bins = binsC.data;
  const temporaryLocations = tempLocationsC.data;
  // Older sessions may lack the items list.
  const sessions = useMemo(
    () => sessionsC.data.map((s) => ({ ...s, items: s.items || [] })),
    [sessionsC.data]
  );
  // The server keeps the newest log entry first; the page works oldest-first.
  const sessionCountLogs = useMemo(() => [...countLogsC.data].reverse(), [countLogsC.data]);
  const dataReady = ![cycleCountsC, binsC, sessionsC, tempLocationsC, countLogsC].some((c) => c.isLoading);
  const didInitRef = useRef(false);
  const [selectedCount, setSelectedCount] = useState<CycleCount | null>(null);
  const [countedQty, setCountedQty] = useState<number>(0);
  const [scanMode, setScanMode] = useState<boolean>(false);
  const [scannedCode, setScannedCode] = useState<string>("");
  const [toast, setToast] = useState<ToastState>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemCode, setNewItemCode] = useState<string>("");
  const [newItemDescription, setNewItemDescription] = useState<string>("");
  const [newItemQty, setNewItemQty] = useState<number>(0);
  const videoRef = useRef<HTMLDivElement>(null);

  // Session management
  const [currentSession, setCurrentSession] = useState<InventorySession | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState<string>("");

  // Temporary locations
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
  const [filterMode, setFilterMode] = useState<"range" | "aisle">("aisle");
  const [aisleFilter, setAisleFilter] = useState<string>("");
  const [startBinFilter, setStartBinFilter] = useState<string>("");
  const [endBinFilter, setEndBinFilter] = useState<string>("");
  const [sequentialItems, setSequentialItems] = useState<SequentialCountItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(0);
  const [showNumpad, setShowNumpad] = useState(false);
  const [numpadValue, setNumpadValue] = useState<string>("");
  const [showBinInfoModal, setShowBinInfoModal] = useState(false);
  const [scannedBinInfo, setScannedBinInfo] = useState<BinLocation | null>(null);

  // Full counting mode state
  const [fullCountFile, setFullCountFile] = useState<File | null>(null);
  const [fullCountItems, setFullCountItems] = useState<CycleCount[]>([]);
  const [fullCountStatus, setFullCountStatus] = useState<string>("");

  // Once the server data has loaded (one time): restore the session this device was
  // working in, and handle "Start Count" coming from a bin scan.
  useEffect(() => {
    if (!dataReady || didInitRef.current) return;
    didInitRef.current = true;

    const countsData = cycleCounts;
    const binsData = bins;
    const sessionsData = sessions;
    // Which session THIS handheld is working in is a per-device choice, so it stays here.
    const currentSessionId = localStorage.getItem("rf_current_inventory_session");

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
  }, [dataReady]);

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

  // Saving: each handler computes the new list and calls the setter, as before. The
  // setter now sends only the records that changed to the server (so two devices
  // working on different records never overwrite each other) and says so if it fails.
  const saveFailed = (what: string) => (error: any) =>
    showToast(`❌ ${what} not saved: ${error?.message || "server error"}`, "error");
  const setCycleCounts = (next: CycleCount[]) => {
    saveRecordChanges("rf_cycle_counts", cycleCounts, next).catch(saveFailed("Count"));
  };
  const setSessions = (next: InventorySession[]) => {
    saveRecordChanges("rf_inventory_sessions", sessions, next).catch(saveFailed("Session"));
  };
  const setTemporaryLocations = (next: TemporaryLocation[]) => {
    saveRecordChanges("rf_temporary_locations", temporaryLocations, next).catch(saveFailed("Temporary location"));
  };
  const setBins = (next: BinLocation[]) => {
    saveBinChanges(bins, next).catch(saveFailed("Bin quantity"));
  };
  const setSessionCountLogs = (next: SessionCountLog[]) => {
    const added = next.slice(sessionCountLogs.length);
    const withIds = added.map((log, i) => ({ ...log, id: log.id ?? `log-${log.sessionId}-${Date.now()}-${i}` }));
    if (withIds.length > 0) appendRecords("rf_session_count_logs", withIds).catch(saveFailed("Count log"));
  };
  const saveCountTxns = (txns: CycleCountTransaction[]) => {
    appendRecords("rf_cycle_count_txns", txns).catch(saveFailed("Count transaction"));
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
    localStorage.setItem("rf_current_inventory_session", newSession.id);
    
    showToast(`✅ Created session: ${newSession.name}`, "success");
    setShowCreateSessionModal(false);
    setNewSessionName("");
    
    // Open tracking form
    setSelectedSessionForTracking(newSession);
    setShowSessionTrackingForm(true);
  };

  const resumeSession = async (session: InventorySession) => {
    const updatedSession: InventorySession = {
      ...session,
      status: "active",
      lastAccessedDate: new Date().toISOString(),
      items: session.items || [],
    };

    const updatedSessions = sessions.map((s) => (s.id === session.id ? updatedSession : s));
    setSessions(updatedSessions);
    setCurrentSession(updatedSession);
    localStorage.setItem("rf_current_inventory_session", session.id);

    // Restore sequential counting state if it was in sequential mode
    if (session.countingMode === "sequential" && session.binRangeStart && session.binRangeEnd) {
      const startBin = session.binRangeStart;
      const endBin = session.binRangeEnd;
      
      setStartBinFilter(startBin);
      setEndBinFilter(endBin);
      
      // Rebuild the list from the bins as they are now.
      const selection = selectBinsForCount(bins, { mode: "range", startBin, endBin });
      const items = selection.ok ? buildSequentialItems(selection.bins) : [];

      if (items.length > 0) {
        const itemIndex = Math.min(session.currentItemIndex || 0, items.length - 1);
        
        // Re-lock the bins
        let relockWarning = "";
        try {
          const { api } = await import("../services/api");
          const username = currentUsername();
          
          await api.lockBins(startBin, endBin, session.id, session.name, username);
        } catch (error: any) {
          // Someone else locked these bins while this session was paused: do not count over them.
          const conflict = Array.isArray(error?.details?.conflicts) ? error.details.conflicts[0] : undefined;
          if (error?.status === 409 && conflict) {
            showToast(
              `❌ Bins ${conflict.startBin} to ${conflict.endBin} are being counted by ${conflict.username} (${conflict.sessionName})`,
              "error"
            );
            setCountingMode("cycle");
            setShowSessionModal(false);
            return;
          }
          console.error("Error re-locking bins:", error);
          relockWarning = " (could not re-lock the bins: server unreachable)";
        }
        
        // Set all state in correct order
        setSequentialItems(items);
        setCurrentItemIndex(itemIndex);
        setCountedQty(0);
        setNumpadValue("");
        
        // IMPORTANT: Force switch to sequential mode
        setCountingMode("sequential");
        
        setShowSessionModal(false);
        
        showToast(`✅ Resumed: ${session.name} - Item ${itemIndex + 1} of ${items.length}${relockWarning}`, relockWarning ? "info" : "success");
      } else {
        showToast(`⚠️ No items found in bin range ${startBin} to ${endBin}`, "error");
        setCountingMode("cycle");
        setShowSessionModal(false);
      }
    } else {
      // No sequential state saved, stay in cycle mode
      setCountingMode("cycle");
      setShowSessionModal(false);
      
      // Restore cycle counts from session
      if (session.cycleCountIds && session.cycleCountIds.length > 0) {
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
    }
  };

  const pauseSession = () => {
    if (!currentSession) return;

    const updatedSession: InventorySession = {
      ...currentSession,
      status: "paused",
      lastAccessedDate: new Date().toISOString(),
      currentCycleCountId: selectedCount?.id,
      // Save sequential counting state
      countingMode: countingMode,
      binRangeStart: startBinFilter,
      binRangeEnd: endBinFilter,
      currentItemIndex: currentItemIndex,
    };

    const updatedSessions = sessions.map((s) => (s.id === currentSession.id ? updatedSession : s));
    setSessions(updatedSessions);
    setCurrentSession(updatedSession);

    showToast(`⏸️ Session paused: ${currentSession.name}`, "info");
  };

  const completeSession = async () => {
    if (!currentSession) return;

    // Unlock bins when completing session
    try {
      const { api } = await import("../services/api");
      await api.unlockBins(currentSession.id);
    } catch (error) {
      console.error("Error unlocking bins:", error);
    }

    const updatedSession: InventorySession = {
      ...currentSession,
      status: "completed",
      lastAccessedDate: new Date().toISOString(),
    };

    const updatedSessions = sessions.map((s) => (s.id === currentSession.id ? updatedSession : s));
    setSessions(updatedSessions);
    setCurrentSession(null);
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

    showToast("✅ Item removed", "success");
  };

  // ========== Sequential Counting Functions ==========

  // Start sequential count with bin range or aisle filter
  const startSequentialCount = async () => {
    if (!currentSession) {
      showToast("⚠️ No active session", "error");
      return;
    }

    const selection = selectBinsForCount(bins, {
      mode: filterMode,
      aisle: aisleFilter,
      startBin: startBinFilter,
      endBin: endBinFilter,
    });
    if (!selection.ok) {
      showToast(selection.message, "error");
      return;
    }
    const { bins: filteredBins, startBin, endBin } = selection;

    try {
      // Check if bins are available (not locked by another user)
      const { api } = await import("../services/api");
      const availability = await api.checkBinAvailability(startBin, endBin, currentSession.id);

      if (!availability.available && availability.conflicts.length > 0) {
        const conflict = availability.conflicts[0];
        showToast(
          `❌ Bins ${conflict.startBin} to ${conflict.endBin} are being counted by ${conflict.username} (${conflict.sessionName})`,
          "error"
        );
        return;
      }

      const items = buildSequentialItems(filteredBins);

      if (items.length === 0) {
        showToast("⚠️ No items found in the selected bins", "error");
        return;
      }

      // Get username for locking
      const username = currentUsername();

      // Lock the bin range
      await api.lockBins(startBin, endBin, currentSession.id, currentSession.name, username);

      // Update session with bin range info
      const updatedSession: InventorySession = {
        ...currentSession,
        countingMode: "sequential",
        binRangeStart: startBin,
        binRangeEnd: endBin,
        currentItemIndex: 0,
        lastAccessedDate: new Date().toISOString(),
      };
      
      const updatedSessions = sessions.map((s) => s.id === currentSession.id ? updatedSession : s);
      setSessions(updatedSessions);
      setCurrentSession(updatedSession);
      
      // Set sequential state
      setSequentialItems(items);
      setCurrentItemIndex(0);
      setCountedQty(0);
      setNumpadValue("");
      setStartBinFilter(startBin);
      setEndBinFilter(endBin);
      
      setCountingMode("sequential");
      setShowBinRangeModal(false);
      
      const aisleInfo = filterMode === "aisle" ? ` (Aisle: ${aisleFilter})` : "";
      showToast(`✅ Loaded ${items.length} items from ${filteredBins.length} bins${aisleInfo}`, "success");
    } catch (error: any) {
      console.error("Error starting sequential count:", error);
      // 409 from /api/bins/lock: another session locked an overlapping range
      // between our availability check and the lock. Say who holds it.
      const conflict = Array.isArray(error?.details?.conflicts) ? error.details.conflicts[0] : undefined;
      if (error?.status === 409 && conflict) {
        showToast(
          `❌ Bins ${conflict.startBin} to ${conflict.endBin} are being counted by ${conflict.username} (${conflict.sessionName})`,
          "error"
        );
      } else {
        showToast(`❌ Error: ${error.message || "Failed to start counting"}`, "error");
      }
    }
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
    const username = currentUsername();

    // Create log entry
    const logEntry: SessionCountLog = {
      id: `log-${currentSession.id}-${Date.now()}`,
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

    // Counts never change stock here: a match is logged, a difference waits for admin approval.
    submitCounts([{
      binCode: currentItem.binCode,
      itemCode: currentItem.itemCode,
      description: currentItem.description,
      countedQty: qty,
      expectedQty: currentItem.expectedQty,
      sessionId: currentSession.id,
      sessionName: currentSession.name,
    }]).catch(saveFailed("Count"));

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
    saveCountTxns([txn]);

    if (variance === 0) {
      showToast("✅ Count accurate!", "success");
    } else {
      showToast(`⚠️ Variance ${variance > 0 ? "+" : ""}${variance} sent for admin approval`, "info");
    }

    // Move to next item
    const nextIndex = currentItemIndex + 1;
    if (nextIndex < sequentialItems.length) {
      setCurrentItemIndex(nextIndex);
      setCountedQty(0);
      setNumpadValue("");
      
      // Update session with new current index
      const updatedSession: InventorySession = {
        ...currentSession,
        currentItemIndex: nextIndex,
        lastAccessedDate: new Date().toISOString(),
      };
      const updatedSessions = sessions.map((s) => s.id === currentSession.id ? updatedSession : s);
      setSessions(updatedSessions);
      setCurrentSession(updatedSession);
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

    const csvContent = countLogsToCsv(sessionLogs);

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
  const exitSequentialMode = async () => {
    // Unlock bins when exiting
    if (currentSession) {
      try {
        const { api } = await import("../services/api");
        await api.unlockBins(currentSession.id);
      } catch (error) {
        console.error("Error unlocking bins:", error);
      }
    }
    
    setCountingMode("cycle");
    setSequentialItems([]);
    setCurrentItemIndex(0);
    setCountedQty(0);
    setNumpadValue("");
  };

  // Numpad functions
  const handleNumpadClick = (digit: string) => {
    if (digit === "OK") {
      // The green check on the sequential counting screen: save the entered quantity.
      // (0 is a valid count, but something must have been typed.)
      if (numpadValue === "") {
        showToast("⚠️ Please enter a quantity", "error");
        return;
      }
      submitSequentialCount(Number(numpadValue) || 0);
      return;
    }
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
      
      const newCycleCounts = uploadedRowsToCounts(parsedItems);

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
    setCycleCounts(updatedCounts);

    // 2. Update the current session with the new cycle count IDs
    const newCountIds = newCounts.map(c => c.id);
    const updatedSession: InventorySession = {
      ...currentSession,
      cycleCountIds: [...currentSession.cycleCountIds, ...newCountIds],
      lastAccessedDate: new Date().toISOString(),
    };
    const updatedSessions = sessions.map((s) => (s.id === currentSession.id ? updatedSession : s));
    setCurrentSession(updatedSession);
    setSessions(updatedSessions);

    // 3. Counted quantities go to admin approval (see submitCounts); bins change only on approval.
    const txns: CycleCountTransaction[] = [];

    newCounts.forEach(newCount => {
      const variance = newCount.CountedQty! - newCount.ExpectedQty;

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

    submitCounts(newCounts.map((c) => ({
      binCode: c.BinCode,
      itemCode: c.ItemCode,
      description: c.ItemCode,
      countedQty: c.CountedQty!,
      expectedQty: c.ExpectedQty,
      sessionId: currentSession.id,
      sessionName: currentSession.name,
    }))).catch(saveFailed("Full count"));

    // 4. Save transactions
    saveCountTxns(txns);

    // 5. Reset and notify
    setFullCountFile(null);
    setFullCountItems([]);
    setFullCountStatus(`✅ Successfully processed ${newCounts.length} counted items.`);
    showToast(`✅ Full count processed! ${newCounts.length} items updated.`, "success");
    setCountingMode("cycle"); // Switch back to cycle view
  };

  // Camera scanners. Only one is open at a time; each closes itself once it reads a code.
  const cameraFailed = () => showToast("Failed to start camera", "error");
  useBarcodeScanner(scanMode, videoRef, (code) => handleScan(code), cameraFailed);
  useBarcodeScanner(sessionTrackingScanMode, sessionTrackingVideoRef, (code) => {
    setSessionTrackingItemCode(code);
    setSessionTrackingScanMode(false);
    showToast(`✅ Scanned: ${code}`, "success");
  }, cameraFailed);
  useBarcodeScanner(tempTrackingScanMode, tempTrackingVideoRef, (code) => {
    setTempTrackingItemCode(code);
    setTempTrackingScanMode(false);
    showToast(`✅ Scanned: ${code}`, "success");
  }, cameraFailed);
  useBarcodeScanner(detailViewScanMode, detailViewVideoRef, (code) => {
    setDetailViewItemCode(code);
    setDetailViewScanMode(false);
    showToast(`✅ Scanned: ${code}`, "success");
  }, cameraFailed);

  // Handle barcode scan
  const handleScan = (code: string) => {
    setScannedCode(code);
    setScanMode(false);
    
    // Find the bin
    const bin = bins.find((b) => b.BinCode === code);

    if (bin) {
      // Show bin information modal
      setScannedBinInfo(bin);
      setShowBinInfoModal(true);
      showToast(`✅ Scanned bin: ${code}`, "success");
    } else {
      showToast(`❌ Bin not found: ${code}`, "error");
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
    }

    // The count is logged below; stock changes only when an admin approves a variance.
    const bin = bins.find((b) => b.BinCode === selectedCount.BinCode);
    const binItem = bin?.Items.find((i) => i.ItemCode === selectedCount.ItemCode);
    
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
    saveCountTxns([txn]);

    // Save

    // Update state
    setCycleCounts(updatedCounts);
    submitCounts([{
      binCode: selectedCount.BinCode,
      itemCode: selectedCount.ItemCode,
      description: binItem?.Description || selectedCount.ItemCode,
      countedQty: countedQty,
      expectedQty: selectedCount.ExpectedQty,
      sessionId: currentSession?.id,
      sessionName: currentSession?.name,
    }]).catch(saveFailed("Count"));

    if (variance === 0) {
      showToast("✅ Count accurate!", "success");
    } else {
      showToast(`⚠️ Variance ${variance > 0 ? "+" : ""}${variance} sent for admin approval`, "info");
    }

    // Reset
    setSelectedCount(null);
    setCountedQty(0);
    setScannedCode("");
  };

  // IMPORTANT: Check sequential mode FIRST (before cycle mode)
  // This ensures "Continue Counting" navigates to sequential UI immediately
  if (countingMode === "sequential" && sequentialItems.length > 0) {
    return (
      <SequentialCountScreen
        sessionName={currentSession?.name}
        items={sequentialItems}
        index={currentItemIndex}
        numpadValue={numpadValue}
        countedQty={countedQty}
        countedInSession={currentSession ? sessionCountLogs.filter((log) => log.sessionId === currentSession.id).length : 0}
        toast={toast}
        onExit={exitSequentialMode}
        onExport={exportSessionLogsToCSV}
        onNumpad={handleNumpadClick}
        onTyped={(qty, raw) => {
          setCountedQty(qty);
          setNumpadValue(raw);
        }}
        onPrevious={goToPreviousItem}
        onSkip={skipCurrentItem}
      />
    );
  }

  // Render task list (cycle mode)
  if (!selectedCount && countingMode === "cycle") {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <VarianceApprovals />
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="text-blue-600" />
            Inventory Counting
          </h1>
        </div>

        {/* Current Session Card - Bigger and easier to tap */}
        {currentSession && (
          <div className="mb-6 bg-blue-50 rounded-lg shadow p-4 border-2 border-blue-300">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-600 font-medium mb-1">Current Session</p>
                <h2 className="text-xl font-bold text-blue-900">{currentSession.name}</h2>
                <p className="text-sm text-blue-600 mt-1">
                  {sessionCountLogs.filter(l => l.sessionId === currentSession.id).length} items counted
                </p>
                {currentSession.binRangeStart && currentSession.binRangeEnd && (
                  <p className="text-xs text-gray-600 mt-1">
                    Bins: {currentSession.binRangeStart} to {currentSession.binRangeEnd}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    // If session has bin range, resume; otherwise start new count
                    if (currentSession.binRangeStart && currentSession.binRangeEnd) {
                      resumeSession(currentSession);
                    } else {
                      setShowBinRangeModal(true);
                    }
                  }}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium"
                >
                  {currentSession.binRangeStart ? "Continue Counting" : "Start Counting"}
                </button>
                <button
                  onClick={pauseSession}
                  className="bg-gray-200 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-300 font-medium"
                >
                  Pause Session
                </button>
                <button
                  onClick={() => setShowSessionModal(true)}
                  className="bg-white text-blue-600 px-6 py-3 rounded-md hover:bg-blue-50 font-medium border border-blue-600"
                >
                  Switch Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Start Session Button - if no current session */}
        {!currentSession && (
          <div className="mb-6">
            <button
              onClick={() => setShowSessionModal(true)}
              className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 text-lg font-medium flex items-center justify-center gap-2"
            >
              <FolderOpen size={24} />
              Start New Session
            </button>
          </div>
        )}

        {/* Mode Selection */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-3">Start Counting</h2>
          <button
            onClick={() => {
              if (!currentSession) {
                showToast("⚠️ Please start a session first", "error");
                setShowSessionModal(true);
                return;
              }
              setShowBinRangeModal(true);
            }}
            className="w-full bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 text-lg font-medium flex items-center justify-center gap-2"
          >
            <List size={24} />
            Sequential Count (Bin Range)
          </button>
          {currentSession && sessionCountLogs.filter(l => l.sessionId === currentSession.id).length > 0 && (
            <button
              onClick={exportSessionLogsToCSV}
              className="mt-3 w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
            >
              <Download size={20} />
              Export Session Log ({sessionCountLogs.filter(l => l.sessionId === currentSession.id).length} counts)
            </button>
          )}
        </div>

        {/* Toast */}
        <ToastBanner toast={toast} />

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
          <BinRangeModal
            filterMode={filterMode}
            aisle={aisleFilter}
            startBin={startBinFilter}
            endBin={endBinFilter}
            onFilterMode={setFilterMode}
            onAisle={setAisleFilter}
            onStartBin={setStartBinFilter}
            onEndBin={setEndBinFilter}
            onStart={startSequentialCount}
            onClose={() => {
              setShowBinRangeModal(false);
              setStartBinFilter("");
              setEndBinFilter("");
              setAisleFilter("");
            }}
          />
        )}

        {/* Bin Info Modal */}
        {showBinInfoModal && scannedBinInfo && (
          <BinInfoModal
            bin={scannedBinInfo}
            onClose={() => {
              setShowBinInfoModal(false);
              setScannedBinInfo(null);
            }}
          />
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
      <FullCountScreen
        sessionName={currentSession?.name}
        items={fullCountItems}
        status={fullCountStatus}
        toast={toast}
        onCancel={() => setCountingMode("cycle")}
        onFile={handleFullCountFileUpload}
        onProcess={processFullCount}
      />
    );
  }


  // Render counting form
  if (!selectedCount) return null;

  const bin = bins.find((b) => b.BinCode === selectedCount.BinCode);
  const binItem = bin?.Items.find((i) => i.ItemCode === selectedCount.ItemCode);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <VarianceApprovals />
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
      <ToastBanner toast={toast} />

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

