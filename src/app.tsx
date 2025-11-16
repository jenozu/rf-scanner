import React, { useState, useEffect, useCallback } from "react";
import HomePage from "./pages/home-page";
import TransactionsPage from "./pages/transactions-page";
import ScanPage from "./pages/scan-page";
import ReceivePage from "./pages/receive-page";
import PickPage from "./pages/pick-page";
import InventoryPage from "./pages/inventory-page";
import ExportPage from "./pages/export-page";
import ShippingPage from "./pages/shipping-page";
import SetupPage from "./pages/setup-page";
import SettingsPage from "./pages/settings-page";
import NumpadModal from "./pages/numpad-modal";
import FooterNav from "./components/footer-nav";
import Header from "./components/header";
import { PageType, Item } from "./types";
import { api } from "./services/api";
import { buildBinsFromItems } from "./utils/bin-utils";

export default function App() {
  // Check if data is initialized
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState<PageType>("settings");
  const [showNumpad, setShowNumpad] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);

  const ensureBinsData = useCallback(async (activeItems: Item[]) => {
    try {
      const binsData = await api.getData("rf_bins");
      if (Array.isArray(binsData) && binsData.length > 0) {
        localStorage.setItem("rf_bins", JSON.stringify(binsData));
        return;
      }
    } catch (error) {
      console.log("Unable to load rf_bins from server:", error);
    }

    if (Array.isArray(activeItems) && activeItems.length > 0) {
      const generatedBins = buildBinsFromItems(activeItems);
      localStorage.setItem("rf_bins", JSON.stringify(generatedBins));
      try {
        await api.saveData("rf_bins", generatedBins);
      } catch (saveError) {
        console.log("Unable to sync generated bins to server:", saveError);
      }
    } else {
      localStorage.removeItem("rf_bins");
    }
  }, []);

  const syncLocalInventoryData = useCallback(async (activeItems: Item[]) => {
    const safeItems = Array.isArray(activeItems) ? activeItems : [];
    localStorage.setItem("rf_active", JSON.stringify(safeItems));
    try {
      const masterData = await api.getData("rf_master");
      if (Array.isArray(masterData) && masterData.length > 0) {
        localStorage.setItem("rf_master", JSON.stringify(masterData));
      } else if (safeItems.length > 0) {
        localStorage.setItem("rf_master", JSON.stringify(safeItems));
      }
    } catch (error) {
      if (safeItems.length > 0) {
        localStorage.setItem("rf_master", JSON.stringify(safeItems));
      }
      console.log("Could not sync rf_master:", error);
    }

    await ensureBinsData(safeItems);
  }, [ensureBinsData]);

  // Check login status and data on mount
  useEffect(() => {
    const checkInitialState = async () => {
      const currentUserId = sessionStorage.getItem("rf_current_user_id");
      const loggedIn = !!currentUserId;
      setIsLoggedIn(loggedIn);
      
      if (loggedIn) {
        // User is logged in, check for data from API
        try {
          const data = (await api.getData("rf_active")) as Item[];
          const hasData = data && Array.isArray(data) && data.length > 0;
          if (hasData) {
            await syncLocalInventoryData(data);
            setIsInitialized(true);
            setPage("home");
          } else {
            // Logged in but no data - go to setup
            setPage("setup");
          }
        } catch (error) {
          // API not available or error, go to setup
          console.error("Error checking data:", error);
          setPage("setup");
        }
      } else {
        // Not logged in - show login (settings page)
        setPage("settings");
      }
    };
    
    checkInitialState();
  }, [syncLocalInventoryData]);

  // Open numpad for manual adjustment
  const handleAdjust = (itemCode: string) => {
    setActiveItem(itemCode);
    setShowNumpad(true);
  };

  // Start cycle count from bin scan
  const handleStartCount = (binCode: string) => {
    setPage("inventory");
    // The inventory page will handle finding/create cycle count tasks for this bin
    // Store the bin code in localStorage for the inventory page to pick up
    sessionStorage.setItem("rf_start_count_bin", binCode);
  };

  // Close modal
  const handleCloseNumpad = () => {
    setShowNumpad(false);
    setActiveItem(null);
  };

  // Handle setup completion
  const handleSetupComplete = () => {
    setIsInitialized(true);
    setPage("home");
  };
  
  // Handle successful login
  const handleLogin = async () => {
    setIsLoggedIn(true);
    // Check if data exists after login
    try {
      const data = (await api.getData("rf_active")) as Item[];
      const hasData = data && Array.isArray(data) && data.length > 0;
      if (hasData) {
        await syncLocalInventoryData(data);
        setIsInitialized(true);
        setPage("home");
      } else {
        setPage("setup");
      }
    } catch (error) {
      console.error("Error checking data after login:", error);
      setPage("setup");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
      <Header />

      <main className="flex-1 p-4 pb-20">
        {page === "settings" && <SettingsPage setPage={setPage} onLogin={handleLogin} />}
        {page === "setup" && isLoggedIn && <SetupPage setPage={setPage} onSetupComplete={handleSetupComplete} />}
        {page === "home" && isLoggedIn && <HomePage setPage={setPage} />}
        {page === "transactions" && isLoggedIn && <TransactionsPage setPage={setPage} />}
        {page === "receive" && isLoggedIn && <ReceivePage setPage={setPage} />}
        {page === "scan" && isLoggedIn && (
          <ScanPage setPage={setPage} onAdjustItem={handleAdjust} onStartCount={handleStartCount} />
        )}
        {page === "pick" && isLoggedIn && <PickPage setPage={setPage} />}
        {page === "inventory" && isLoggedIn && <InventoryPage setPage={setPage} />}
        {page === "export" && isLoggedIn && <ExportPage setPage={setPage} />}
        {page === "shipping" && isLoggedIn && <ShippingPage setPage={setPage} />}
      </main>

      {isInitialized && isLoggedIn && <FooterNav currentPage={page} setPage={setPage} />}

      {showNumpad && (
        <NumpadModal itemCode={activeItem} onClose={handleCloseNumpad} />
      )}
    </div>
  );
}
