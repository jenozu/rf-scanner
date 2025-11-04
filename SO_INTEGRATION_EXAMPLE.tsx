/**
 * Example: Sales Order Management Component
 * This demonstrates how to use the uploaded sales orders in your picking workflow
 */

import React, { useState, useEffect } from "react";
import { SalesOrder, SOItem } from "./src/types";
import { Package, User, Calendar, CheckCircle, Clock } from "lucide-react";

export default function SalesOrderList() {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Load sales orders from localStorage
  useEffect(() => {
    const storedSOs = localStorage.getItem("rf_sales_orders");
    if (storedSOs) {
      setSalesOrders(JSON.parse(storedSOs));
    }
  }, []);

  // Filter orders based on search
  const filteredOrders = salesOrders.filter(
    (so) =>
      so.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      so.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      so.cardCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get status badge color
  const getStatusColor = (status: SalesOrder["status"]) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-800";
      case "picking":
        return "bg-yellow-100 text-yellow-800";
      case "picked":
        return "bg-blue-100 text-blue-800";
      case "shipped":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Get status icon
  const getStatusIcon = (status: SalesOrder["status"]) => {
    switch (status) {
      case "pending":
        return <Clock size={16} />;
      case "picking":
        return <Package size={16} />;
      case "picked":
        return <CheckCircle size={16} />;
      case "shipped":
        return <CheckCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  // Calculate total items and remaining quantity
  const calculateOrderStats = (so: SalesOrder) => {
    const totalItems = so.items.length;
    const totalQty = so.items.reduce((sum, item) => sum + item.OrderedQty, 0);
    const remainingQty = so.items.reduce((sum, item) => sum + (item.RemainingQty || 0), 0);
    return { totalItems, totalQty, remainingQty };
  };

  // Start picking an order
  const handleStartPicking = (so: SalesOrder) => {
    // Update status to picking
    const updatedSOs = salesOrders.map((order) =>
      order.id === so.id ? { ...order, status: "picking" as const } : order
    );
    setSalesOrders(updatedSOs);
    localStorage.setItem("rf_sales_orders", JSON.stringify(updatedSOs));
    setSelectedSO({ ...so, status: "picking" });
    
    // In a real app, you would navigate to the picking page here
    console.log("Starting picking for SO:", so.soNumber);
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Package className="text-blue-600" />
        Sales Orders
      </h1>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by SO number, customer, or card code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Orders</p>
          <p className="text-2xl font-bold">{salesOrders.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Pending</p>
          <p className="text-2xl font-bold text-gray-800">
            {salesOrders.filter((so) => so.status === "pending").length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Picking</p>
          <p className="text-2xl font-bold text-yellow-600">
            {salesOrders.filter((so) => so.status === "picking").length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Shipped</p>
          <p className="text-2xl font-bold text-green-600">
            {salesOrders.filter((so) => so.status === "shipped").length}
          </p>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Package size={48} className="mx-auto mb-4 opacity-50" />
          <p>
            {searchTerm
              ? "No sales orders match your search"
              : "No sales orders uploaded"}
          </p>
          {!searchTerm && (
            <p className="text-sm mt-2">
              Upload sales orders from the Setup page to get started
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((so) => {
            const stats = calculateOrderStats(so);
            return (
              <div
                key={so.id}
                className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">SO #{so.soNumber}</h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(
                          so.status
                        )}`}
                      >
                        {getStatusIcon(so.status)}
                        {so.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                      <User size={14} />
                      {so.customer} ({so.cardCode})
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar size={12} />
                      Created: {new Date(so.createdDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {stats.totalItems} items • {stats.totalQty} units
                    </p>
                    {stats.remainingQty > 0 && (
                      <p className="text-xs text-orange-600 font-medium">
                        {stats.remainingQty} units remaining
                      </p>
                    )}
                  </div>
                </div>

                {/* Items Preview */}
                <div className="border-t pt-3 mb-3">
                  <p className="text-xs text-gray-500 mb-2">Items:</p>
                  <div className="space-y-1">
                    {so.items.slice(0, 3).map((item, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-gray-700 flex justify-between"
                      >
                        <span>
                          {item.ItemCode} - {item.Description}
                        </span>
                        <span className="font-medium">
                          {item.DeliveredQty}/{item.OrderedQty}
                          {item.BinCode && (
                            <span className="text-gray-500 ml-2">
                              @ {item.BinCode}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    {so.items.length > 3 && (
                      <p className="text-xs text-gray-400 italic">
                        +{so.items.length - 3} more items...
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {so.status === "pending" && (
                    <button
                      onClick={() => handleStartPicking(so)}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
                    >
                      Start Picking
                    </button>
                  )}
                  {so.status === "picking" && (
                    <button
                      onClick={() => setSelectedSO(so)}
                      className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 text-sm font-medium"
                    >
                      Continue Picking
                    </button>
                  )}
                  {(so.status === "picked" || so.status === "shipped") && (
                    <button
                      onClick={() => setSelectedSO(so)}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 text-sm font-medium"
                    >
                      View Details
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * INTEGRATION NOTES:
 * 
 * 1. To load uploaded sales orders:
 *    const salesOrders = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]");
 * 
 * 2. To filter pending orders for picking:
 *    const pendingOrders = salesOrders.filter(so => so.status === "pending");
 * 
 * 3. To get items that need picking:
 *    const itemsToPick = selectedSO.items.filter(item => item.RemainingQty! > 0);
 * 
 * 4. To update picked quantity:
 *    const updatedItems = selectedSO.items.map(item => 
 *      item.ItemCode === pickedItem.ItemCode 
 *        ? { ...item, DeliveredQty: item.DeliveredQty + pickedQty, RemainingQty: item.RemainingQty! - pickedQty }
 *        : item
 *    );
 * 
 * 5. To update order status:
 *    const allPicked = updatedItems.every(item => item.RemainingQty === 0);
 *    const newStatus = allPicked ? "picked" : "picking";
 * 
 * 6. To save updates:
 *    const updatedSalesOrders = salesOrders.map(so =>
 *      so.id === selectedSO.id ? { ...so, items: updatedItems, status: newStatus } : so
 *    );
 *    localStorage.setItem("rf_sales_orders", JSON.stringify(updatedSalesOrders));
 */

