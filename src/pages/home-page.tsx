import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
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

type FloorBin = {
  code: string;
  aisle: string;
  bay: string;
  zone: string;
  units: number;
  capacity: number;
  level: 0 | 1 | 2 | 3 | 4;
  items: BinLocation["Items"];
  countDue: boolean;
  pickWaiting: boolean;
};

// "01-0104" is warehouse 01, aisle 01, bay 04. Anything that doesn't follow that
// pattern goes under "Other" so odd SAP bin codes still show up on the map.
function parseBinCode(code: string): { aisle: string; bay: string } {
  const m = /^([A-Z0-9]+)-(\d{2})(\d{2,})$/i.exec(code.trim());
  return m ? { aisle: `${m[1]}-${m[2]}`, bay: m[3] } : { aisle: "Other", bay: code };
}

function timeLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function HomePage({ setPage }: HomePageProps) {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

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

  const floor = useMemo(() => {
    const due = new Set(counts.filter((c) => c.Status === "pending").map((c) => c.BinCode?.toUpperCase()));
    const picking = new Set<string>();
    salesOrders
      .filter((o) => o.status === "pending" || o.status === "picking")
      .forEach((o) =>
        o.items.forEach((line) => {
          const remaining = line.RemainingQty ?? line.OrderedQty - line.DeliveredQty;
          if (line.BinCode && remaining > 0) picking.add(line.BinCode.toUpperCase());
        })
      );

    const rows: FloorBin[] = bins
      .filter((bin) => bin.Status !== "inactive")
      .map((bin) => {
        const code = bin.BinCode.toUpperCase();
        const units = bin.Items.reduce((sum, item) => sum + (item.Quantity || 0), 0);
        const ratio = bin.Capacity > 0 ? units / bin.Capacity : units > 0 ? 1 : 0;
        const level = (units <= 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4) as FloorBin["level"];
        const { aisle, bay } = parseBinCode(code);
        return {
          code,
          aisle,
          bay,
          zone: bin.Zone,
          units,
          capacity: bin.Capacity,
          level,
          items: bin.Items,
          countDue: due.has(code),
          pickWaiting: picking.has(code),
        };
      });

    const aisles = new Map<string, FloorBin[]>();
    rows.forEach((row) => aisles.set(row.aisle, [...(aisles.get(row.aisle) || []), row]));
    const ordered = [...aisles.entries()]
      .sort(([a], [b]) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b, undefined, { numeric: true })))
      .map(([name, list]) => ({
        name,
        bins: list.sort((a, b) => a.bay.localeCompare(b.bay, undefined, { numeric: true })),
      }));

    const totalUnits = rows.reduce((s, r) => s + r.units, 0);
    const totalCapacity = rows.reduce((s, r) => s + r.capacity, 0);
    return {
      aisles: ordered,
      count: rows.length,
      usedPct: totalCapacity > 0 ? Math.round((totalUnits / totalCapacity) * 100) : 0,
      empty: rows.filter((r) => r.level === 0).length,
      dueCount: rows.filter((r) => r.countDue).length,
      pickCount: rows.filter((r) => r.pickWaiting).length,
      byCode: new Map(rows.map((r) => [r.code, r])),
    };
  }, [bins, counts, salesOrders]);

  const rail: Array<{ label: string; value: number; note: string; page: PageType }> = [
    { label: "Receiving", value: stats.pendingPOs + stats.receivingPOs, note: `${stats.receivingPOs} in progress`, page: "receive" },
    { label: "Picking", value: stats.pendingOrders, note: `${stats.activeWaves} ${stats.activeWaves === 1 ? "wave" : "waves"} open`, page: "pick" },
    { label: "Counts due", value: stats.pendingCounts, note: stats.completedCounts ? `${stats.accuracy}% accurate to date` : "None completed yet", page: "inventory" },
    { label: "Ready to ship", value: stats.readyToShip, note: `${stats.shipped} shipped`, page: "shipping" },
  ];
  const busiest = rail.reduce((a, b) => (b.value > a.value ? b : a), rail[0]);

  const sel = selected ? floor.byCode.get(selected) : undefined;

  const startCount = (code: string) => {
    sessionStorage.setItem("rf_start_count_bin", code);
    setPage("inventory");
  };

  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-lede">{today}</p>

      <section className="floor">
        <div className="rail" aria-label="Open work">
          {rail.map((row) => (
            <button
              key={row.label}
              type="button"
              className={`rail-row ${row.value > 0 && row === busiest ? "is-lead" : ""}`}
              onClick={() => setPage(row.page)}
            >
              <span className="rail-text">
                <span className="rail-label">{row.label}</span>
                <span className="rail-note">{row.note}</span>
              </span>
              <strong className="rail-count">{row.value}</strong>
              <ArrowRight className="rail-go" size={16} aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="map-panel">
          <div className="map-readout">
            <div><strong>{floor.count}</strong><span>bins</span></div>
            <div><strong>{floor.usedPct}%</strong><span>of capacity in use</span></div>
            <div><strong>{floor.empty}</strong><span>empty</span></div>
            <div><strong>{floor.dueCount}</strong><span>due for count</span></div>
            <div><strong>{floor.pickCount}</strong><span>with picks waiting</span></div>
          </div>

          {floor.count === 0 ? (
            <p className="activity-empty">No bins on record yet. Load the master inventory on the Settings page.</p>
          ) : (
            <div className="map-aisles" role="group" aria-label="Warehouse bins by aisle">
              {floor.aisles.map((aisle) => (
                <div className="aisle" key={aisle.name}>
                  <span className="aisle-name">{aisle.name === "Other" ? "Other" : `Aisle ${aisle.name}`}</span>
                  <div className="aisle-cells">
                    {aisle.bins.map((bin) => (
                      <button
                        key={bin.code}
                        type="button"
                        data-level={bin.level}
                        className={`bin ${bin.countDue ? "has-count" : ""} ${bin.pickWaiting ? "has-pick" : ""} ${selected === bin.code ? "is-selected" : ""}`}
                        aria-label={`Bin ${bin.code}, ${bin.units} of ${bin.capacity} units${bin.countDue ? ", count due" : ""}${bin.pickWaiting ? ", pick waiting" : ""}`}
                        aria-pressed={selected === bin.code}
                        title={`${bin.code}: ${bin.units} / ${bin.capacity}`}
                        onClick={() => setSelected(selected === bin.code ? null : bin.code)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="map-legend" aria-hidden="true">
            <span className="legend-scale">
              Stock vs capacity
              <i data-level="0" /><i data-level="1" /><i data-level="2" /><i data-level="3" /><i data-level="4" />
            </span>
            <span className="legend-pip count">Count due</span>
            <span className="legend-pip pick">Pick waiting</span>
          </div>

          <div className="map-detail" aria-live="polite">
            {sel ? (
              <>
                <div className="map-detail-main">
                  <strong>{sel.code}</strong>
                  <span>
                    {sel.zone} · {sel.units} of {sel.capacity} units
                    {sel.countDue ? " · count due" : ""}
                    {sel.pickWaiting ? " · pick waiting" : ""}
                  </span>
                  <span className="map-detail-items">
                    {sel.items.length === 0
                      ? "Empty"
                      : sel.items.map((i) => `${i.ItemCode} × ${i.Quantity}`).join(", ")}
                  </span>
                </div>
                <button type="button" onClick={() => startCount(sel.code)}>Count this bin</button>
              </>
            ) : (
              <span className="map-detail-hint">Select a bin to see what is in it.</span>
            )}
          </div>
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
