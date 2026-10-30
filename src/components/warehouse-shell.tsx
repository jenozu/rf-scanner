import { useMemo, useState } from "react";
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

const navItems: Array<{ page: PageType; label: string; shortLabel: string; icon: any }> = [
  { page: "home", label: "Dashboard", shortLabel: "Home", icon: Home },
  { page: "receive", label: "Receiving / GRPO", shortLabel: "Receive", icon: Package },
  { page: "pick", label: "Picking", shortLabel: "Pick", icon: Truck },
  { page: "scan", label: "Scan & Inquiry", shortLabel: "Scan", icon: Camera },
  { page: "inventory", label: "Inventory & Counts", shortLabel: "Count", icon: ClipboardCheck },
  { page: "transactions", label: "Transactions", shortLabel: "Moves", icon: Activity },
  { page: "shipping", label: "Shipping", shortLabel: "Ship", icon: Truck },
  { page: "export", label: "Exports", shortLabel: "Export", icon: FileText },
  { page: "settings", label: "Settings", shortLabel: "Setup", icon: Settings },
];

const pageCopy: Record<PageType, { eyebrow: string; title: string }> = {
  setup: { eyebrow: "System setup", title: "Initialize warehouse data" },
  home: { eyebrow: "Operations", title: "Warehouse control centre" },
  transactions: { eyebrow: "Inventory movement", title: "Transactions" },
  receive: { eyebrow: "Inbound", title: "Receiving / GRPO" },
  scan: { eyebrow: "Identification", title: "Scan & inquiry" },
  pick: { eyebrow: "Outbound", title: "Order picking" },
  inventory: { eyebrow: "Accuracy", title: "Inventory & cycle counts" },
  export: { eyebrow: "Data", title: "Exports" },
  shipping: { eyebrow: "Outbound", title: "Shipping operations" },
  settings: { eyebrow: "Administration", title: "Settings & access" },
};

export default function WarehouseShell({
  currentPage,
  setPage,
  isLoggedIn,
  isDemo,
  onResetDemo,
  children,
}: WarehouseShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = pageCopy[currentPage] || pageCopy.home;

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date()),
    []
  );

  const navigate = (page: PageType) => {
    setPage(page);
    setMobileOpen(false);
  };

  const nav = (
    <nav className="wms-nav" aria-label="Warehouse modules">
      {navItems.map(({ page, label, icon: Icon }) => {
        const active = currentPage === page;
        return (
          <button
            key={page}
            type="button"
            onClick={() => navigate(page)}
            className={`wms-nav-item ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
            {active && <span className="wms-nav-active-dot" aria-hidden="true" />}
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
              <small>Warehouse OS</small>
            </div>
          </div>

          <div className="wms-site-status">
            <span className="wms-status-light" />
            <div>
              <strong>Operations online</strong>
              <small>{isDemo ? "Isolated preview environment" : "Connected warehouse environment"}</small>
            </div>
          </div>

          {nav}

          <div className="wms-sidebar-footer">
            <div className="wms-shift-card">
              <span className="wms-shift-label">WORKSPACE</span>
              <strong>{isDemo ? "Preview warehouse" : "Warehouse operations"}</strong>
              <small>{today}</small>
            </div>
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
            <div className="wms-page-heading">
              <span>{meta.eyebrow}</span>
              <strong>{meta.title}</strong>
            </div>
          </div>

          <div className="wms-topbar-right">
            {isLoggedIn && <SyncStatus />}
            {isDemo && <span className="wms-preview-pill">DEMO · SAFE MODE</span>}
            {isLoggedIn && (
              <button className="wms-command-button" type="button" onClick={() => navigate("scan")}>
                <Search size={16} />
                <span>Quick inquiry</span>
                <kbd>/</kbd>
              </button>
            )}
          </div>
        </header>

        {isDemo && (
          <div className="wms-demo-rail">
            <span>Interactive preview</span>
            Synthetic warehouse data only · carrier, SAP, and production APIs are disabled.
          </div>
        )}

        <main className="wms-content">{children}</main>
      </div>

      {isLoggedIn && (
        <div className={`wms-mobile-drawer ${mobileOpen ? "is-open" : ""}`} aria-hidden={!mobileOpen}>
          <button className="wms-drawer-backdrop" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
          <div className="wms-drawer-panel">
            <div className="wms-drawer-head">
              <div className="wms-brand">
                <div className="wms-brand-mark"><span /><span /><span /></div>
                <div><strong>RF / WMS</strong><small>Warehouse OS</small></div>
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
          {navItems.slice(0, 5).map(({ page, shortLabel, icon: Icon }) => {
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
