import React, { useState, useEffect } from "react";
import HomePage from "./pages/home-page";
import ScanPage from "./pages/scan-page";
import ReceivePage from "./pages/receive-page";
import PickPage from "./pages/pick-page";
import InventoryPage from "./pages/inventory-page";
import ExportPage from "./pages/export-page";
import SetupPage from "./pages/setup-page";
import NumpadModal from "./pages/numpad-modal";
import FooterNav from "./components/footer-nav";
import Header from "./components/header";
import { PageType } from "./types";

export default function App() {
  // Check if data is initialized
  const [isInitialized, setIsInitialized] = useState(false);
  const [page, setPage] = useState<PageType>("setup");
  const [showNumpad, setShowNumpad] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);

  // Check if sample data exists on mount
  useEffect(() => {
    const hasData = localStorage.getItem("rf_purchase_orders") !== null;
    if (hasData) {
      setIsInitialized(true);
      setPage("home");
    }
  }, []);

  // Open numpad for manual adjustment
  const handleAdjust = (itemCode: string) => {
    setActiveItem(itemCode);
    setShowNumpad(true);
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

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
      <Header />

      <main className="flex-1 p-4 pb-20">
        {page === "setup" && <SetupPage setPage={setPage} onSetupComplete={handleSetupComplete} />}
        {page === "home" && <HomePage setPage={setPage} />}
        {page === "receive" && <ReceivePage setPage={setPage} />}
        {page === "scan" && (
          <ScanPage setPage={setPage} onAdjustItem={handleAdjust} />
        )}
        {page === "pick" && <PickPage setPage={setPage} />}
        {page === "inventory" && <InventoryPage setPage={setPage} />}
        {page === "export" && <ExportPage setPage={setPage} />}
      </main>

      {isInitialized && <FooterNav currentPage={page} setPage={setPage} />}

      {showNumpad && (
        <NumpadModal itemCode={activeItem} onClose={handleCloseNumpad} />
      )}
    </div>
  );
}
