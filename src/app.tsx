import React, { useState, useEffect } from "react";
import HomePage from "./pages/home-page";
import TransactionsPage from "./pages/transactions-page";
import ScanPage from "./pages/scan-page";
import ReceivePage from "./pages/receive-page";
import PickPage from "./pages/pick-page";
import InventoryPage from "./pages/inventory-page";
import ExportPage from "./pages/export-page";
import SetupPage from "./pages/setup-page";
import SettingsPage from "./pages/settings-page";
import NumpadModal from "./pages/numpad-modal";
import FooterNav from "./components/footer-nav";
import Header from "./components/header";
import { PageType } from "./types";

export default function App() {
  // Check if data is initialized
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState<PageType>("settings");
  const [showNumpad, setShowNumpad] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);

  // Check login status and data on mount
  useEffect(() => {
    const currentUserId = localStorage.getItem("rf_current_user_id");
    const loggedIn = !!currentUserId;
    setIsLoggedIn(loggedIn);
    
    if (loggedIn) {
      // User is logged in, check for data
      const hasData = localStorage.getItem("rf_active") !== null;
      if (hasData) {
        setIsInitialized(true);
        setPage("home");
      } else {
        // Logged in but no data - go to setup
        setPage("setup");
      }
    } else {
      // Not logged in - show login (settings page)
      setPage("settings");
    }
  }, []);

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
  const handleLogin = () => {
    setIsLoggedIn(true);
    // Check if data exists after login
    const hasData = localStorage.getItem("rf_active") !== null;
    if (hasData) {
      setIsInitialized(true);
      setPage("home");
    } else {
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
      </main>

      {isInitialized && isLoggedIn && <FooterNav currentPage={page} setPage={setPage} />}

      {showNumpad && (
        <NumpadModal itemCode={activeItem} onClose={handleCloseNumpad} />
      )}
    </div>
  );
}
