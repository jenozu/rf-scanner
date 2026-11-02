import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ClipboardCheck,
  Package,
  Search,
  Truck,
} from "lucide-react";
import { useCollection } from "../data/hooks";
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

function timeLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function HomePage({ setPage }: HomePageProps) {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

  // Everything comes from the server and refreshes on focus and every 30 s, so the
  // dashboard shows the whole warehouse, not just this device's work.
  const { data: pos } = useCollection<PurchaseOrder[]>("rf_purchase_orders", []);
  const { data: orders } = useCollection<Order[]>("rf_orders", []);
  const { data: salesOrders } = useCollection<SalesOrder[]>("rf_sales_orders", []);
  const { data: waves } = useCollection<Wave[]>("rf_waves", []);
  const { data: counts } = useCollection<CycleCount[]>("rf_cycle_counts", []);
  const { data: bins } = useCollection<BinLocation[]>("rf_bins", []);
  const { data: receiving } = useCollection<ReceivingTransaction[]>("rf_receiving_txns", []);
  const { data: countTxns } = useCollection<CycleCountTransaction[]>("rf_cycle_count_txns", []);

  useEffect(() => {
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
  }, [pos, orders, salesOrders, waves, counts, bins, receiving, countTxns]);

  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const queues = [
    {
      label: "Receiving",
      page: "receive" as PageType,
      value: stats.pendingPOs + stats.receivingPOs,
      detail: `${stats.pendingPOs} not started · ${stats.receivingPOs} in progress`,
      icon: Package,
    },
    {
      label: "Picking",
      page: "pick" as PageType,
      value: stats.pendingOrders,
      detail: `${stats.activeWaves} ${stats.activeWaves === 1 ? "wave" : "waves"} open`,
      icon: Truck,
    },
    {
      label: "Cycle counts",
      page: "inventory" as PageType,
      value: stats.pendingCounts,
      detail: `${stats.completedCounts} completed`,
      icon: ClipboardCheck,
    },
    {
      label: "Shipping",
      page: "shipping" as PageType,
      value: stats.readyToShip,
      detail: `${stats.shipped} shipped`,
      icon: Truck,
    },
  ];

  const recommended = queues.find((q) => q.value > 0) || { label: "", page: "scan" as PageType, value: 0 };

  const hasWarning = timeline.some((entry) => entry.tone === "warn");

  return (
    <div className="ops-dashboard">
      <header className="fo-head">
        <h1>{today}</h1>
        <button className="fo-inquiry" onClick={() => setPage("scan")}>
          <Search size={18} />
          Item / bin inquiry
        </button>
      </header>

      <div className="fo-layout">
        <section className="fo-queues" aria-label="Work queues">
          <h2 className="fo-h2">Open work</h2>
          <ul>
            {queues.map((q) => {
              const Icon = q.icon;
              const isNext = q.label === recommended.label && q.value > 0;
              return (
                <li key={q.label}>
                  <button
                    className={`fo-queue ${q.value === 0 ? "is-empty" : ""} ${isNext ? "is-next" : ""}`}
                    onClick={() => setPage(q.page)}
                  >
                    <span className="fo-queue-count">{q.value}</span>
                    <span className="fo-queue-body">
                      <strong>
                        <Icon size={17} aria-hidden="true" />
                        {q.label}
                        {isNext && <em>Start here</em>}
                      </strong>
                      <small>{q.value === 0 ? "Nothing waiting" : q.detail}</small>
                    </span>
                    <ArrowRight size={20} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="fo-foot">
            {stats.totalBins} bins on record
            {stats.completedCounts > 0 && <> · count accuracy {stats.accuracy}%</>}
          </p>
        </section>

        <section className="fo-events" aria-label="Recent activity">
          <h2 className="fo-h2">
            Recent activity
            {hasWarning && (
              <span className="fo-flag">
                <AlertCircle size={14} aria-hidden="true" /> Variance to review
              </span>
            )}
          </h2>
          {timeline.length === 0 ? (
            <p className="fo-none">
              No activity yet. Receipts, counts and shipments will be listed here.
            </p>
          ) : (
            <ol>
              {timeline.map((entry) => (
                <li key={entry.id} className={`fo-event ${entry.tone}`}>
                  <time>{entry.time}</time>
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{entry.detail}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
