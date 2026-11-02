import { useState } from "react";
import SyncStatus from "./sync-status";
import {
  Activity,
  Camera,
  ClipboardCheck,
  FileText,
  Home,
  Menu,
  Package,
  RotateCcw,
  Search,
  Settings,
  Truck,
  X,
} from "lucide-react";
import { PageType } from "../types";

interface WarehouseShellProps {
  currentPage: PageType;
  setPage: (page: PageType) => void;
  isLoggedIn: boolean;
  isDemo: boolean;
  onResetDemo?: () => void;
  children: React.ReactNode;
}

// Bottom bar on phones: Scan sits in the middle, under the thumb.
const dockPages: PageType[] = ["home", "receive", "scan", "pick", "inventory"];

const navItems: Array<{ page: PageType; label: string; shortLabel: string; icon: any; group: number }> = [
  { page: "home", label: "Dashboard", shortLabel: "Home", icon: Home, group: 0 },
  { page: "receive", label: "Receiving", shortLabel: "Receive", icon: Package, group: 1 },
  { page: "pick", label: "Picking", shortLabel: "Pick", icon: Truck, group: 1 },
  { page: "scan", label: "Scan & Inquiry", shortLabel: "Scan", icon: Camera, group: 1 },
  { page: "inventory", label: "Inventory & Counts", shortLabel: "Count", icon: ClipboardCheck, group: 1 },
  { page: "shipping", label: "Shipping", shortLabel: "Ship", icon: Truck, group: 1 },
  { page: "transactions", label: "Transactions", shortLabel: "Moves", icon: Activity, group: 2 },
  { page: "export", label: "Exports", shortLabel: "Export", icon: FileText, group: 2 },
  { page: "settings", label: "Settings", shortLabel: "Setup", icon: Settings, group: 3 },
];

export default function WarehouseShell({
  currentPage,
  setPage,
  isLoggedIn,
  isDemo,
  onResetDemo,
  children,
}: WarehouseShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = (page: PageType) => {
    setPage(page);
    setMobileOpen(false);
  };

  const nav = (
    <nav className="wms-nav" aria-label="Warehouse modules">
      {navItems.map(({ page, label, icon: Icon, group }, index) => {
        const active = currentPage === page;
        const startsGroup = index > 0 && navItems[index - 1].group !== group;
        return (
          <button
            key={page}
            type="button"
            onClick={() => navigate(page)}
            className={`wms-nav-item ${active ? "is-active" : ""} ${startsGroup ? "starts-group" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="wms-shell">
      {isLoggedIn && (
        <aside className="wms-sidebar">
          <div className="wms-brand">
            <div className="wms-brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>
              <strong>RF / WMS</strong>
              <small>Marindustrial</small>
            </div>
          </div>

          {nav}

          <div className="wms-sidebar-footer">
            {isDemo && onResetDemo && (
              <button className="wms-reset-button" type="button" onClick={onResetDemo}>
                <RotateCcw size={15} />
                Reset demo data
              </button>
            )}
          </div>
        </aside>
      )}

      <div className={`wms-main ${!isLoggedIn ? "is-auth" : ""}`}>
        <header className="wms-topbar">
          <div className="wms-topbar-left">
            {isLoggedIn && (
              <button
                className="wms-menu-button"
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>
            )}
            
          </div>

          <div className="wms-topbar-right">
            {isLoggedIn && <SyncStatus />}
            {isDemo && <span className="wms-preview-pill">Demo data</span>}
            {isLoggedIn && (
              <button className="wms-command-button" type="button" onClick={() => navigate("scan")}>
                <Search size={16} />
                <span>Find item or bin</span>
              </button>
            )}
          </div>
        </header>

        <main className="wms-content">{children}</main>
      </div>

      {isLoggedIn && (
        <div className={`wms-mobile-drawer ${mobileOpen ? "is-open" : ""}`} aria-hidden={!mobileOpen}>
          <button className="wms-drawer-backdrop" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
          <div className="wms-drawer-panel">
            <div className="wms-drawer-head">
              <div className="wms-brand">
                <div className="wms-brand-mark"><span /><span /><span /></div>
                <div><strong>RF / WMS</strong><small>Marindustrial</small></div>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                <X size={20} />
              </button>
            </div>
            {nav}
            {isDemo && onResetDemo && (
              <button className="wms-reset-button" type="button" onClick={onResetDemo}>
                <RotateCcw size={15} /> Reset demo data
              </button>
            )}
          </div>
        </div>
      )}

      {isLoggedIn && (
        <nav className="wms-mobile-dock" aria-label="Quick navigation">
          {dockPages
            .map((page) => navItems.find((item) => item.page === page)!)
            .map(({ page, shortLabel, icon: Icon }) => {
            const active = currentPage === page;
            return (
              <button
                key={page}
                type="button"
                className={active ? "is-active" : ""}
                onClick={() => navigate(page)}
              >
                <Icon size={19} strokeWidth={1.9} />
                <span>{shortLabel}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
