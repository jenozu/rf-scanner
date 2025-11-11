import { useState, useEffect } from "react";
import { PageType, PurchaseOrder, Order, Wave, CycleCount, BinLocation } from "../types";
import { 
  Package, 
  Truck, 
  ClipboardCheck, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2
} from "lucide-react";

interface HomePageProps {
  setPage: (page: PageType) => void;
}

export default function HomePage({ setPage }: HomePageProps) {
  const [stats, setStats] = useState({
    pendingPOs: 0,
    receivingPOs: 0,
    pendingOrders: 0,
    activeWaves: 0,
    pendingCounts: 0,
    completedCounts: 0,
    totalBins: 0,
    accuracy: 0,
  });

  useEffect(() => {
    // Load data from localStorage
    const pos = JSON.parse(localStorage.getItem("rf_purchase_orders") || "[]") as PurchaseOrder[];
    const orders = JSON.parse(localStorage.getItem("rf_orders") || "[]") as Order[];
    const waves = JSON.parse(localStorage.getItem("rf_waves") || "[]") as Wave[];
    const counts = JSON.parse(localStorage.getItem("rf_cycle_counts") || "[]") as CycleCount[];
    const bins = JSON.parse(localStorage.getItem("rf_bins") || "[]") as BinLocation[];

    // Calculate stats
    const completedCountsList = counts.filter((c) => c.Status === "completed");
    const accurateCounts = completedCountsList.filter((c) => c.Variance === 0).length;
    const accuracy = completedCountsList.length > 0 
      ? (accurateCounts / completedCountsList.length) * 100 
      : 0;

    setStats({
      pendingPOs: pos.filter((po) => po.status === "pending").length,
      receivingPOs: pos.filter((po) => po.status === "receiving").length,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      activeWaves: waves.filter((w) => w.status === "active" || w.status === "pending").length,
      pendingCounts: counts.filter((c) => c.Status === "pending").length,
      completedCounts: completedCountsList.length,
      totalBins: bins.length,
      accuracy: Math.round(accuracy),
    });
  }, []);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Warehouse Dashboard</h1>
      <p className="text-gray-600 mb-6">
        {new Date().toLocaleDateString("en-US", { 
          weekday: "long", 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        })}
      </p>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setPage("receive")}
          className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <Package className="mb-2" size={24} />
          <p className="font-semibold">Receive</p>
          <p className="text-xs opacity-90">Process POs</p>
        </button>
        <button
          onClick={() => setPage("pick")}
          className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <Truck className="mb-2" size={24} />
          <p className="font-semibold">Pick</p>
          <p className="text-xs opacity-90">Fulfill Orders</p>
        </button>
        <button
          onClick={() => setPage("shipping")}
          className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <Truck className="mb-2" size={24} />
          <p className="font-semibold">Shipping</p>
          <p className="text-xs opacity-90">Create Labels</p>
        </button>
        <button
          onClick={() => setPage("scan")}
          className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <TrendingUp className="mb-2" size={24} />
          <p className="font-semibold">Scan</p>
          <p className="text-xs opacity-90">Item Inquiry</p>
        </button>
        <button
          onClick={() => setPage("inventory")}
          className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <ClipboardCheck className="mb-2" size={24} />
          <p className="font-semibold">Inventory</p>
          <p className="text-xs opacity-90">Cycle Count</p>
        </button>
      </div>

      {/* KPI Cards */}
      <h2 className="text-lg font-semibold mb-3">Today's Metrics</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Receiving */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <Package className="text-blue-600" size={20} />
            {stats.receivingPOs > 0 && (
              <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                Active
              </span>
            )}
          </div>
          <p className="text-2xl font-bold">{stats.pendingPOs + stats.receivingPOs}</p>
          <p className="text-sm text-gray-600">Pending POs</p>
        </div>

        {/* Picking */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <Truck className="text-green-600" size={20} />
            {stats.activeWaves > 0 && (
              <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                {stats.activeWaves} Wave{stats.activeWaves > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold">{stats.pendingOrders}</p>
          <p className="text-sm text-gray-600">Orders to Pick</p>
        </div>

        {/* Cycle Counting */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <ClipboardCheck className="text-orange-600" size={20} />
            {stats.pendingCounts > 0 && (
              <AlertCircle className="text-orange-500" size={16} />
            )}
          </div>
          <p className="text-2xl font-bold">{stats.pendingCounts}</p>
          <p className="text-sm text-gray-600">Pending Counts</p>
        </div>

        {/* Accuracy */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="text-purple-600" size={20} />
            {stats.accuracy === 100 && stats.completedCounts > 0 && (
              <CheckCircle2 className="text-green-500" size={16} />
            )}
          </div>
          <p className="text-2xl font-bold">{stats.accuracy}%</p>
          <p className="text-sm text-gray-600">Count Accuracy</p>
        </div>
      </div>

      {/* Warehouse Info */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3">Warehouse Overview</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Total Bins</p>
            <p className="text-lg font-bold">{stats.totalBins}</p>
          </div>
          <div>
            <p className="text-gray-600">Completed Counts</p>
            <p className="text-lg font-bold">{stats.completedCounts}</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(stats.pendingPOs > 0 || stats.pendingOrders > 0 || stats.pendingCounts > 0) && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-yellow-800">Pending Tasks</p>
              <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                {stats.pendingPOs > 0 && (
                  <li>• {stats.pendingPOs} purchase order{stats.pendingPOs > 1 ? "s" : ""} awaiting receipt</li>
                )}
                {stats.pendingOrders > 0 && (
                  <li>• {stats.pendingOrders} order{stats.pendingOrders > 1 ? "s" : ""} ready for picking</li>
                )}
                {stats.pendingCounts > 0 && (
                  <li>• {stats.pendingCounts} cycle count{stats.pendingCounts > 1 ? "s" : ""} pending</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
