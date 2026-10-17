import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Package,
  Search,
  TrendingUp,
  Truck,
} from "lucide-react";
import {
  BinLocation,
  CycleCount,
  CycleCountTransaction,
  Order,
  PageType,
  PurchaseOrder,
  ReceivingTransaction,
  SalesOrder,
  Wave,
} from "../types";

interface HomePageProps {
  setPage: (page: PageType) => void;
}

type Stats = {
  pendingPOs: number;
  receivingPOs: number;
  pendingOrders: number;
  activeWaves: number;
  pendingCounts: number;
  completedCounts: number;
  totalBins: number;
  accuracy: number;
  readyToShip: number;
  shipped: number;
};

type TimelineEntry = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: "good" | "warn" | "neutral";
};

const emptyStats: Stats = {
  pendingPOs: 0,
  receivingPOs: 0,
  pendingOrders: 0,
  activeWaves: 0,
  pendingCounts: 0,
  completedCounts: 0,
  totalBins: 0,
  accuracy: 0,
  readyToShip: 0,
  shipped: 0,
};

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function timeLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function HomePage({ setPage }: HomePageProps) {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    const pos = read<PurchaseOrder[]>("rf_purchase_orders", []);
    const orders = read<Order[]>("rf_orders", []);
    const salesOrders = read<SalesOrder[]>("rf_sales_orders", []);
    const waves = read<Wave[]>("rf_waves", []);
    const counts = read<CycleCount[]>("rf_cycle_counts", []);
    const bins = read<BinLocation[]>("rf_bins", []);
    const receiving = read<ReceivingTransaction[]>("rf_receiving_txns", []);
    const countTxns = read<CycleCountTransaction[]>("rf_cycle_count_txns", []);

    const completedCounts = counts.filter((count) => count.Status === "completed");
    const accurateCounts = completedCounts.filter((count) => count.Variance === 0).length;
    const accuracy =
      completedCounts.length > 0
        ? Math.round((accurateCounts / completedCounts.length) * 100)
        : 0;

    setStats({
      pendingPOs: pos.filter((po) => po.status === "pending").length,
      receivingPOs: pos.filter((po) => po.status === "receiving").length,
      pendingOrders:
        orders.filter((order) => order.status === "pending" || order.status === "picking").length +
        salesOrders.filter((order) => order.status === "pending" || order.status === "picking").length,
      activeWaves: waves.filter((wave) => wave.status === "active" || wave.status === "pending").length,
      pendingCounts: counts.filter((count) => count.Status === "pending").length,
      completedCounts: completedCounts.length,
      totalBins: bins.length,
      accuracy,
      readyToShip: salesOrders.filter((order) => order.status === "picked").length,
      shipped: salesOrders.filter((order) => order.status === "shipped").length,
    });

    const entries: Array<TimelineEntry & { stamp: number }> = [
      ...receiving.slice(0, 4).map((txn) => ({
        id: txn.id,
        title: "Receiving posted",
        detail: `${txn.poNumber} · ${txn.qty} × ${txn.itemCode} → ${txn.binCode}`,
        time: timeLabel(txn.timestamp),
        tone: "good" as const,
        stamp: new Date(txn.timestamp).getTime(),
      })),
      ...countTxns.slice(0, 4).map((txn) => ({
        id: txn.id,
        title: txn.variance === 0 ? "Count verified" : "Variance detected",
        detail: `${txn.binCode} · ${txn.itemCode} · ${txn.variance > 0 ? "+" : ""}${txn.variance}`,
        time: timeLabel(txn.timestamp),
        tone: txn.variance === 0 ? ("good" as const) : ("warn" as const),
        stamp: new Date(txn.timestamp).getTime(),
      })),
      ...salesOrders
        .filter((order) => order.status === "shipped" && order.shippedDate)
        .slice(0, 3)
        .map((order) => ({
          id: `ship-${order.id}`,
          title: "Shipment confirmed",
          detail: `${order.soNumber} · ${order.customer}${order.shipmentPin ? ` · ${order.shipmentPin}` : ""}`,
          time: timeLabel(order.shippedDate || ""),
          tone: "good" as const,
          stamp: new Date(order.shippedDate || "").getTime(),
        })),
    ];

    setTimeline(
      entries
        .filter((entry) => Number.isFinite(entry.stamp))
        .sort((a, b) => b.stamp - a.stamp)
        .slice(0, 6)
        .map(({ stamp: _stamp, ...entry }) => entry)
    );
  }, []);

  const workload = useMemo(
    () => [
      { label: "Receiving", value: stats.pendingPOs + stats.receivingPOs, page: "receive" as PageType },
      { label: "Picking", value: stats.pendingOrders, page: "pick" as PageType },
      { label: "Cycle counts", value: stats.pendingCounts, page: "inventory" as PageType },
      { label: "Shipping", value: stats.readyToShip, page: "shipping" as PageType },
    ],
    [stats]
  );

  const maxWorkload = Math.max(1, ...workload.map((item) => item.value));

  const recommended =
    workload.find((item) => item.value > 0) ||
    ({ label: "Inventory inquiry", value: 0, page: "scan" } as const);

  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="ops-dashboard">
      <section className="ops-hero">
        <div className="ops-hero-copy">
          <span className="ops-kicker">WAREHOUSE PULSE · {today.toUpperCase()}</span>
          <h1>
            Move the right work,
            <br />
            <em>without the noise.</em>
          </h1>
          <p>
            A live operational view built from the warehouse data already in RF Scanner.
            Prioritize inbound, outbound, counts, and shipping from one place.
          </p>

          <div className="ops-hero-actions">
            <button className="ops-primary-action" onClick={() => setPage(recommended.page)}>
              Continue with {recommended.label}
              <ArrowRight size={17} />
            </button>
            <button className="ops-secondary-action" onClick={() => setPage("scan")}>
              <Search size={17} />
              Item / bin inquiry
            </button>
          </div>
        </div>

        <div className="ops-focus-panel">
          <div className="ops-focus-head">
            <span>NEXT ACTION</span>
            <span className="ops-live-dot">LIVE</span>
          </div>
          <strong>{recommended.label}</strong>
          <p>
            {recommended.value > 0
              ? `${recommended.value} active ${recommended.value === 1 ? "task" : "tasks"} in queue`
              : "No urgent queue detected. Use inquiry or inventory tools as needed."}
          </p>
          <button onClick={() => setPage(recommended.page)}>
            Open workflow <ArrowRight size={15} />
          </button>
          <div className="ops-focus-grid" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      <section className="ops-metric-grid" aria-label="Warehouse metrics">
        <article className="ops-metric-card">
          <div className="ops-metric-icon"><Package size={18} /></div>
          <span>Inbound queue</span>
          <strong>{stats.pendingPOs + stats.receivingPOs}</strong>
          <small>{stats.receivingPOs} currently receiving</small>
        </article>
        <article className="ops-metric-card">
          <div className="ops-metric-icon"><Truck size={18} /></div>
          <span>Orders to pick</span>
          <strong>{stats.pendingOrders}</strong>
          <small>{stats.activeWaves} active / pending waves</small>
        </article>
        <article className="ops-metric-card">
          <div className="ops-metric-icon"><ClipboardCheck size={18} /></div>
          <span>Counts pending</span>
          <strong>{stats.pendingCounts}</strong>
          <small>{stats.completedCounts} completed in current data</small>
        </article>
        <article className="ops-metric-card">
          <div className="ops-metric-icon"><TrendingUp size={18} /></div>
          <span>Count accuracy</span>
          <strong>{stats.completedCounts ? `${stats.accuracy}%` : "—"}</strong>
          <small>{stats.completedCounts ? "Based on completed counts" : "No completed counts yet"}</small>
        </article>
      </section>

      <section className="ops-grid-two">
        <article className="ops-panel ops-workload">
          <div className="ops-panel-heading">
            <div>
              <span className="ops-section-kicker">WORK QUEUES</span>
              <h2>Current workload</h2>
            </div>
            <Activity size={19} />
          </div>

          <div className="ops-workload-list">
            {workload.map((item) => (
              <button key={item.label} onClick={() => setPage(item.page)}>
                <div className="ops-workload-row">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <div className="ops-progress-track">
                  <span style={{ width: `${Math.max(item.value ? 8 : 0, (item.value / maxWorkload) * 100)}%` }} />
                </div>
              </button>
            ))}
          </div>

          <div className="ops-panel-foot">
            <span>{stats.totalBins} active bin records available</span>
            <button onClick={() => setPage("inventory")}>Open inventory</button>
          </div>
        </article>

        <article className="ops-panel">
          <div className="ops-panel-heading">
            <div>
              <span className="ops-section-kicker">ACTIVITY</span>
              <h2>Recent warehouse events</h2>
            </div>
            {timeline.some((entry) => entry.tone === "warn") ? (
              <AlertCircle size={19} />
            ) : (
              <CheckCircle2 size={19} />
            )}
          </div>

          <div className="ops-timeline">
            {timeline.length === 0 ? (
              <div className="ops-empty-state">
                <Activity size={22} />
                <strong>No activity recorded yet</strong>
                <span>Receiving, counts, and shipment events will appear here.</span>
              </div>
            ) : (
              timeline.map((entry) => (
                <div className="ops-timeline-row" key={entry.id}>
                  <span className={`ops-event-dot ${entry.tone}`} />
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{entry.detail}</span>
                  </div>
                  <time>{entry.time}</time>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="ops-module-grid">
        <button className="ops-module-card" onClick={() => setPage("receive")}>
          <span>01 · INBOUND</span>
          <Package size={24} />
          <strong>Receive purchase orders</strong>
          <p>Verify product, quantity, lot / serial details, and staging location.</p>
          <i><ArrowRight size={16} /></i>
        </button>
        <button className="ops-module-card" onClick={() => setPage("pick")}>
          <span>02 · OUTBOUND</span>
          <Truck size={24} />
          <strong>Pick sales orders</strong>
          <p>Work bin-sorted pick lists with clear progress and completion states.</p>
          <i><ArrowRight size={16} /></i>
        </button>
        <button className="ops-module-card" onClick={() => setPage("inventory")}>
          <span>03 · ACCURACY</span>
          <ClipboardCheck size={24} />
          <strong>Run cycle counts</strong>
          <p>Resume sessions, verify bins, capture quantities, and surface variance.</p>
          <i><ArrowRight size={16} /></i>
        </button>
        <button className="ops-module-card" onClick={() => setPage("shipping")}>
          <span>04 · SHIPPING</span>
          <Truck size={24} />
          <strong>Prepare shipments</strong>
          <p>{stats.readyToShip} ready to ship · {stats.shipped} shipped in current data.</p>
          <i><ArrowRight size={16} /></i>
        </button>
      </section>
    </div>
  );
}
