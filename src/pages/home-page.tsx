import { Fragment, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
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

  const queueMax = Math.max(1, stats.pendingPOs + stats.receivingPOs, stats.pendingOrders, stats.readyToShip);
  const SEGMENTS = 12;
  const segmentsFor = (value: number, max: number) =>
    value <= 0 ? 0 : Math.max(1, Math.round((value / max) * SEGMENTS));

  const stations: Array<{
    key: string;
    name: string;
    value: number;
    unit: string;
    note: string;
    meter: number;
    meterLabel: string;
    page: PageType;
  }> = [
    {
      key: "receive",
      name: "Receiving",
      value: stats.pendingPOs + stats.receivingPOs,
      unit: "purchase orders open",
      note: `${stats.receivingPOs} being received now`,
      meter: segmentsFor(stats.pendingPOs + stats.receivingPOs, queueMax),
      meterLabel: "Load against the busiest queue",
      page: "receive",
    },
    {
      key: "shelf",
      name: "On the shelf",
      value: stats.totalBins,
      unit: "bins on record",
      note: stats.completedCounts
        ? `${stats.accuracy}% count accuracy, ${stats.pendingCounts} counts due`
        : `${stats.pendingCounts} counts due`,
      meter: stats.completedCounts ? Math.round((stats.accuracy / 100) * SEGMENTS) : 0,
      meterLabel: "Count accuracy",
      page: "inventory",
    },
    {
      key: "pick",
      name: "Picking",
      value: stats.pendingOrders,
      unit: "sales orders to pick",
      note: `${stats.activeWaves} ${stats.activeWaves === 1 ? "wave" : "waves"} open`,
      meter: segmentsFor(stats.pendingOrders, queueMax),
      meterLabel: "Load against the busiest queue",
      page: "pick",
    },
    {
      key: "ship",
      name: "Shipping",
      value: stats.readyToShip,
      unit: "orders ready to ship",
      note: `${stats.shipped} shipped to date`,
      meter: segmentsFor(stats.readyToShip, queueMax),
      meterLabel: "Load against the busiest queue",
      page: "shipping",
    },
  ];

  const variances = countTxns.filter((txn) => txn.variance !== 0).length;
  const attention: Array<{ text: string; page: PageType }> = [];
  if (variances > 0)
    attention.push({
      text: `${variances} count ${variances === 1 ? "variance" : "variances"} to review`,
      page: "inventory",
    });
  if (stats.receivingPOs > 0)
    attention.push({
      text: `${stats.receivingPOs} purchase ${stats.receivingPOs === 1 ? "order" : "orders"} part-received`,
      page: "receive",
    });

  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-lede">{today}</p>

      <section className="board" aria-label="Work moving through the warehouse">
        <div className="board-stations">
          {stations.map((st, index) => (
            <Fragment key={st.key}>
              <button type="button" className="station" onClick={() => setPage(st.page)}>
                <span className="station-name">{st.name}</span>
                <strong className="station-value">{st.value}</strong>
                <span className="station-unit">{st.unit}</span>
                <span
                  className="station-meter"
                  role="img"
                  aria-label={`${st.meterLabel}: ${st.meter} of ${SEGMENTS}`}
                >
                  {Array.from({ length: SEGMENTS }, (_, n) => (
                    <i
                      key={n}
                      className={n < st.meter ? "is-on" : ""}
                      style={{ ["--i" as string]: n }}
                    />
                  ))}
                </span>
                <span className="station-note">{st.note}</span>
              </button>
              {index < stations.length - 1 && (
                <svg
                  className={`board-link ${stations[index].value > 0 ? "is-live" : ""}`}
                  viewBox="0 0 40 16"
                  aria-hidden="true"
                >
                  <path d="M0 8 H34 M28 2 L35 8 L28 14" />
                </svg>
              )}
            </Fragment>
          ))}
        </div>

        <div className="board-attention">
          <span className="board-attention-title">
            {attention.length ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
            {attention.length ? "Needs attention" : "Nothing flagged"}
          </span>
          {attention.map((a) => (
            <button key={a.text} type="button" onClick={() => setPage(a.page)}>
              {a.text}
            </button>
          ))}
        </div>
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
