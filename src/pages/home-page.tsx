import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, Package, Truck } from "lucide-react";
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

  const queues = useMemo(
    () => [
      {
        label: "Receiving",
        value: stats.pendingPOs + stats.receivingPOs,
        note: `${stats.receivingPOs} in progress`,
        page: "receive" as PageType,
        icon: Package,
      },
      {
        label: "Picking",
        value: stats.pendingOrders,
        note: `${stats.activeWaves} waves open`,
        page: "pick" as PageType,
        icon: Truck,
      },
      {
        label: "Counts",
        value: stats.pendingCounts,
        note: stats.completedCounts ? `${stats.accuracy}% accurate to date` : "None completed yet",
        page: "inventory" as PageType,
        icon: ClipboardCheck,
      },
      {
        label: "Ready to ship",
        value: stats.readyToShip,
        note: `${stats.shipped} shipped`,
        page: "shipping" as PageType,
        icon: Truck,
      },
    ],
    [stats]
  );

  // The queue with the most work gets the filled tile.
  const busiest = queues.reduce((a, b) => (b.value > a.value ? b : a), queues[0]);

  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-lede">{today}. {stats.totalBins} bins on record.</p>

      <section className="queue-grid" aria-label="Open work">
        {queues.map((q) => (
          <button
            key={q.label}
            type="button"
            className={`queue-tile ${q.value > 0 && q === busiest ? "is-lead" : ""}`}
            onClick={() => setPage(q.page)}
          >
            <span className="queue-label">
              <q.icon size={16} strokeWidth={1.9} aria-hidden="true" />
              {q.label}
            </span>
            <strong className="queue-count">{q.value}</strong>
            <span className="queue-note">{q.note}</span>
            <ArrowRight className="queue-go" size={18} aria-hidden="true" />
          </button>
        ))}
      </section>

      <section className="activity" aria-labelledby="activity-title">
        <div className="activity-head">
          <h2 id="activity-title">Recent activity</h2>
          <button type="button" onClick={() => setPage("transactions")}>All transactions</button>
        </div>

        {timeline.length === 0 ? (
          <p className="activity-empty">
            Nothing has been received, counted or shipped yet. Activity shows up here as it happens.
          </p>
        ) : (
          <ul>
            {timeline.map((entry) => (
              <li key={entry.id} className={`tone-${entry.tone}`}>
                <time>{entry.time}</time>
                <strong>{entry.title}</strong>
                <span>{entry.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
