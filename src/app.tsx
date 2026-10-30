import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import WarehouseShell from "./components/warehouse-shell";
import { PageType, Item } from "./types";
import { api } from "./services/api";
import { buildBinsFromItems } from "./utils/bin-utils";
import { saveCollection } from "./data/ops";
import { demoUser, isDemoMode, resetDemoData, seedDemoData } from "./demo/demo-mode";

const HomePage = lazy(() => import("./pages/home-page"));
const TransactionsPage = lazy(() => import("./pages/transactions-page"));
const ScanPage = lazy(() => import("./pages/scan-page"));
const ReceivePage = lazy(() => import("./pages/receive-page"));
const PickPage = lazy(() => import("./pages/pick-page"));
const InventoryPage = lazy(() => import("./pages/inventory-page"));
const ExportPage = lazy(() => import("./pages/export-page"));
const ShippingPage = lazy(() => import("./pages/shipping-page"));
const SetupPage = lazy(() => import("./pages/setup-page"));
const SettingsPage = lazy(() => import("./pages/settings-page"));
const NumpadModal = lazy(() => import("./pages/numpad-modal"));

export default function App() {
  const demo = isDemoMode();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState<PageType>(demo ? "home" : "settings");
  const [showNumpad, setShowNumpad] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);

  // Make sure the server has bins: if it has none yet, build them from the inventory list.
  const ensureBinsData = useCallback(async (activeItems: Item[]) => {
    try {
      const binsData = await api.getData("rf_bins");
      if (Array.isArray(binsData) && binsData.length > 0) return;
    } catch (error) {
      console.log("Unable to load rf_bins from server:", error);
      return;
    }

    if (Array.isArray(activeItems) && activeItems.length > 0) {
      try {
        await saveCollection("rf_bins", buildBinsFromItems(activeItems), { overwrite: true });
      } catch (saveError) {
        console.log("Unable to save generated bins to the server:", saveError);
      }
    }
  }, []);

  const syncLocalInventoryData = ensureBinsData;

  useEffect(() => {
    const checkInitialState = async () => {
      if (demo) {
        seedDemoData();
        sessionStorage.setItem("rf_current_user_id", demoUser.id);
        sessionStorage.setItem("rf_auth_token", "demo-preview-token");
        setIsLoggedIn(true);
        setIsInitialized(true);
        setPage("home");
        return;
      }

      const currentUserId = sessionStorage.getItem("rf_current_user_id");
      const loggedIn = !!currentUserId;
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
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
          console.error("Error checking data:", error);
          setPage("setup");
        }
      } else {
        setPage("settings");
      }
    };

    checkInitialState();
  }, [demo, syncLocalInventoryData]);

  const handleAdjust = (itemCode: string) => {
    setActiveItem(itemCode);
    setShowNumpad(true);
  };

  const handleStartCount = (binCode: string) => {
    setPage("inventory");
    sessionStorage.setItem("rf_start_count_bin", binCode);
  };

  const handleCloseNumpad = () => {
    setShowNumpad(false);
    setActiveItem(null);
  };

  const handleSetupComplete = () => {
    setIsInitialized(true);
    setPage("home");
  };

  const handleLogin = async () => {
    setIsLoggedIn(true);
    if (demo) {
      setIsInitialized(true);
      setPage("home");
      return;
    }

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

  const handleResetDemo = () => {
    resetDemoData();
    window.location.reload();
  };

  return (
    <WarehouseShell
      currentPage={page}
      setPage={setPage}
      isLoggedIn={isLoggedIn}
      isDemo={demo}
      onResetDemo={demo ? handleResetDemo : undefined}
    >
      <Suspense
        fallback={
          <div className="wms-loading-shell" role="status" aria-live="polite">
            <span />
            <strong>Loading warehouse module</strong>
          </div>
        }
      >
      {page === "settings" && <SettingsPage setPage={setPage} onLogin={handleLogin} />}
      {page === "setup" && isLoggedIn && (
        <SetupPage setPage={setPage} onSetupComplete={handleSetupComplete} />
      )}
      {page === "home" && isLoggedIn && <HomePage setPage={setPage} />}
      {page === "transactions" && isLoggedIn && <TransactionsPage setPage={setPage} />}
      {page === "receive" && isLoggedIn && <ReceivePage setPage={setPage} />}
      {page === "scan" && isLoggedIn && (
        <ScanPage
          setPage={setPage}
          onAdjustItem={handleAdjust}
          onStartCount={handleStartCount}
        />
      )}
      {page === "pick" && isLoggedIn && <PickPage setPage={setPage} />}
      {page === "inventory" && isLoggedIn && <InventoryPage setPage={setPage} />}
      {page === "export" && isLoggedIn && <ExportPage setPage={setPage} />}
      {page === "shipping" && isLoggedIn && <ShippingPage setPage={setPage} />}

      {showNumpad && (
        <NumpadModal itemCode={activeItem} onClose={handleCloseNumpad} />
      )}
      </Suspense>
    </WarehouseShell>
  );
}
