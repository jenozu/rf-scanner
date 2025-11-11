import { useState, useEffect } from "react";
import { PageType, SalesOrder, Order } from "../types";
import { 
  Package, 
  Truck, 
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FileText,
  Download,
  Loader2,
  XCircle
} from "lucide-react";

interface ShippingPageProps {
  setPage: (page: PageType) => void;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function ShippingPage({ setPage }: ShippingPageProps) {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "picked" | "shipped">("all");
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successMessages, setSuccessMessages] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      // Try to load from server first
      const response = await fetch(`${API_BASE_URL}/api/data/rf_sales_orders`);
      if (response.ok) {
        const serverOrders = await response.json() as SalesOrder[];
        if (serverOrders && serverOrders.length > 0) {
          setOrders(serverOrders);
          return;
        }
      }
    } catch (e) {
      console.log('Server not available, using localStorage');
    }
    
    // Fallback to localStorage
    const salesOrders = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]") as SalesOrder[];
    
    // Also check regular orders
    const regularOrders = JSON.parse(localStorage.getItem("rf_orders") || "[]") as Order[];
    
    // Convert regular orders to sales order format for display
    const convertedOrders: SalesOrder[] = regularOrders
      .filter(o => o.status === "picked" || o.status === "pending")
      .map(o => ({
        id: o.id,
        soNumber: o.orderNumber,
        customer: o.customer,
        cardCode: "",
        items: o.items.map(item => ({
          LineNumber: 0,
          ItemCode: item.ItemCode,
          Description: item.Description,
          OrderedQty: item.OrderedQty,
          DeliveredQty: item.PickedQty,
        })),
        status: o.status === "picked" ? "picked" : "pending",
        createdDate: new Date().toISOString(),
      }));
    
    const allOrders = [...salesOrders, ...convertedOrders];
    setOrders(allOrders);
  };

  const saveOrders = async (updatedOrders: SalesOrder[]) => {
    try {
      // Try to save to server
      await fetch(`${API_BASE_URL}/api/data/rf_sales_orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedOrders })
      });
    } catch (e) {
      console.log('Server not available, using localStorage');
    }
    
    // Also save to localStorage as backup
    localStorage.setItem("rf_sales_orders", JSON.stringify(updatedOrders));
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "all" || 
      (statusFilter === "pending" && order.status === "pending") ||
      (statusFilter === "picked" && order.status === "picked") ||
      (statusFilter === "shipped" && order.status === "shipped");
    
    return matchesSearch && matchesStatus;
  });

  const pendingOrders = orders.filter(o => o.status === "picked" || o.status === "pending");
  const shippedOrders = orders.filter(o => o.status === "shipped");

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const selectAll = () => {
    const pendingIds = filteredOrders
      .filter(o => o.status === "picked" || o.status === "pending")
      .map(o => o.id);
    setSelectedOrders(new Set(pendingIds));
  };

  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

  const exportSelectedToCSV = () => {
    if (selectedOrders.size === 0) {
      alert("Please select orders to export");
      return;
    }

    const selected = orders.filter(o => selectedOrders.has(o.id));
    
    // Create CSV content
    const headers = [
      "order_id",
      "customer_name",
      "customer_code",
      "order_number",
      "status",
      "created_date"
    ];
    
    const rows = selected.map(order => [
      order.id,
      order.customer,
      order.cardCode || "",
      order.soNumber,
      order.status,
      order.createdDate
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shipping_orders_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const createShipment = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    setLoading(prev => new Set(prev).add(orderId));
    setError(null);

    try {
      // Check if order has shipping address data
      const hasShippingAddress = order.shipToStreet && order.shipToCity && order.shipToProvince && order.shipToPostal;
      
      let requestBody: any = {
        orderId: order.id,
        packageData: {
          weight: '2.5', // Default weight, could be made configurable
          service_id: 'PurolatorExpress',
          reference: order.soNumber
        }
      };
      
      // If shipping address is available, use direct shipment (bypasses address book)
      if (hasShippingAddress) {
        requestBody.shipmentData = {
          // Sender info (from .env defaults - configured on backend)
          sender_name: process.env.DEFAULT_SENDER_NAME || 'Your Warehouse',
          sender_street: process.env.DEFAULT_SENDER_STREET || '123 Main St',
          sender_city: process.env.DEFAULT_SENDER_CITY || 'Toronto',
          sender_province: process.env.DEFAULT_SENDER_PROVINCE || 'ON',
          sender_postal: process.env.DEFAULT_SENDER_POSTAL || 'M5J2R8',
          sender_phone: process.env.DEFAULT_SENDER_PHONE || '416-555-1234',
          
          // Receiver info (from sales order)
          receiver_name: order.customer,
          receiver_street: order.shipToStreet,
          receiver_city: order.shipToCity,
          receiver_province: order.shipToProvince,
          receiver_postal: order.shipToPostal,
          receiver_country: order.shipToCountry || 'CA',
          receiver_phone: order.shipToPhone || '000-000-0000',
          
          // Package details
          service_id: 'PurolatorExpress',
          weight: '2.5',
          length: '30',
          width: '20',
          height: '10',
          payment_type: 'Sender',
          reference: order.soNumber
        };
      } else {
        // Fallback to address book lookup
        requestBody.customerName = order.customer;
      }

      const response = await fetch(`${API_BASE_URL}/api/shipping/shipments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (result.success) {
        // Update order status
        const updatedOrders = orders.map(o => 
          o.id === orderId 
            ? { ...o, status: 'shipped' as const, shipmentPin: result.shipmentPin, shippedDate: new Date().toISOString() }
            : o
        );
        setOrders(updatedOrders);
        await saveOrders(updatedOrders);
        
        // Show success message
        setSuccessMessages(prev => new Map(prev).set(orderId, `Shipment created! Tracking: ${result.shipmentPin}`));
        setTimeout(() => {
          setSuccessMessages(prev => {
            const next = new Map(prev);
            next.delete(orderId);
            return next;
          });
        }, 5000);
      } else {
        setError(result.error || 'Failed to create shipment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shipment');
      console.error('Error creating shipment:', err);
    } finally {
      setLoading(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const createBatchShipments = async () => {
    if (selectedOrders.size === 0) {
      setError("Please select orders to ship");
      return;
    }

    const orderIds = Array.from(selectedOrders);
    setLoading(prev => new Set([...prev, ...orderIds]));
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/shipments/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: orderIds,
          packageData: {
            weight: '2.5',
            service_id: 'PurolatorExpress'
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        // Update order statuses
        const updatedOrders = orders.map(o => {
          if (selectedOrders.has(o.id)) {
            const shipmentResult = result.results.find((r: any) => r.order_id === o.id);
            if (shipmentResult && (shipmentResult.status === 'Success' || shipmentResult.status === 'success')) {
              return {
                ...o,
                status: 'shipped' as const,
                shipmentPin: shipmentResult.shipment_pin,
                shippedDate: new Date().toISOString()
              };
            }
          }
          return o;
        });
        setOrders(updatedOrders);
        await saveOrders(updatedOrders);
        
        // Clear selection
        setSelectedOrders(new Set());
        
        // Show success message
        alert(`Batch shipment complete!\nSuccessful: ${result.successful}\nFailed: ${result.failed}`);
      } else {
        setError(result.error || 'Failed to create batch shipments');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create batch shipments');
      console.error('Error creating batch shipments:', err);
    } finally {
      setLoading(prev => {
        const next = new Set(prev);
        orderIds.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  const openPurolatorApp = () => {
    // Note: This would open the Python shipping app
    // For web deployment, you'd need to create a backend API endpoint
    alert("To use full shipping features:\n\n1. Open terminal/command prompt\n2. Navigate to: puro folder\n3. Run: python batch_shipping_app.py\n\nOr use the Export CSV feature to export orders for batch processing.");
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Shipping</h1>
          <p className="text-gray-600">Manage outbound shipments and create Purolator labels</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openPurolatorApp}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <ExternalLink size={18} />
            Open Shipping Tools
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <Package className="text-orange-600" size={20} />
            {pendingOrders.length > 0 && (
              <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                Ready
              </span>
            )}
          </div>
          <p className="text-2xl font-bold">{pendingOrders.length}</p>
          <p className="text-sm text-gray-600">Ready to Ship</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <Truck className="text-green-600" size={20} />
            {shippedOrders.length > 0 && (
              <CheckCircle2 className="text-green-500" size={16} />
            )}
          </div>
          <p className="text-2xl font-bold">{shippedOrders.length}</p>
          <p className="text-sm text-gray-600">Shipped Today</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <FileText className="text-blue-600" size={20} />
          </div>
          <p className="text-2xl font-bold">{selectedOrders.size}</p>
          <p className="text-sm text-gray-600">Selected</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by order number or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="picked">Ready to Ship</option>
              <option value="shipped">Shipped</option>
            </select>
          </div>
        </div>

        {/* Selection Actions */}
        {selectedOrders.size > 0 && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <span className="text-sm font-medium text-blue-800">
              {selectedOrders.size} order{selectedOrders.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={createBatchShipments}
                disabled={Array.from(selectedOrders).some(id => loading.has(id))}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {Array.from(selectedOrders).some(id => loading.has(id)) ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Truck size={14} />
                    Create Shipments
                  </>
                )}
              </button>
              <button
                onClick={exportSelectedToCSV}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center gap-1"
              >
                <Download size={14} />
                Export CSV
              </button>
              <button
                onClick={clearSelection}
                className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <XCircle className="text-red-600" size={18} />
            <span className="text-sm text-red-800">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold">Orders</h2>
          {filteredOrders.filter(o => o.status === "picked" || o.status === "pending").length > 0 && (
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Select All Ready
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-200">
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="mx-auto mb-2 text-gray-400" size={32} />
              <p>No orders found</p>
              <p className="text-sm mt-1">
                {searchTerm || statusFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Orders ready to ship will appear here"}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isSelected = selectedOrders.has(order.id);
              const isReady = order.status === "picked" || order.status === "pending";
              const totalItems = order.items.reduce((sum, item) => sum + item.OrderedQty, 0);

              return (
                <div
                  key={order.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    isSelected ? "bg-blue-50 border-l-4 border-blue-500" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {isReady && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOrderSelection(order.id)}
                          className="mt-1"
                        />
                      )}
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{order.soNumber}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            order.status === "shipped" 
                              ? "bg-green-100 text-green-800"
                              : order.status === "picked"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {order.status.toUpperCase()}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 mb-2">
                          <span className="font-medium">{order.customer}</span>
                          {order.cardCode && (
                            <span className="text-sm text-gray-500 ml-2">({order.cardCode})</span>
                          )}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Package size={14} />
                            {totalItems} item{totalItems > 1 ? "s" : ""}
                          </span>
                          <span>
                            {new Date(order.createdDate).toLocaleDateString()}
                          </span>
                          {order.shipmentPin && (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <Truck size={14} />
                              PIN: {order.shipmentPin}
                            </span>
                          )}
                        </div>
                        {successMessages.has(order.id) && (
                          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                            {successMessages.get(order.id)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {order.status === "shipped" && (
                        <CheckCircle2 className="text-green-500" size={20} />
                      )}
                      {isReady && (
                        <>
                          <button
                            onClick={() => createShipment(order.id)}
                            disabled={loading.has(order.id)}
                            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {loading.has(order.id) ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <Truck size={14} />
                                Create Shipment
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOrders(new Set([order.id]));
                              exportSelectedToCSV();
                            }}
                            className="text-blue-600 hover:text-blue-700 text-sm px-3 py-1 border border-blue-600 rounded hover:bg-blue-50"
                          >
                            Export
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="text-blue-600 mt-0.5" size={20} />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Shipping Integration</p>
            <p className="mb-2">
              Create Purolator shipments directly from this page. Orders are automatically matched with customers in the address book.
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Click "Create Shipment" on individual orders or select multiple for batch shipping</li>
              <li>Tracking PINs are automatically saved and labels are emailed to aobryan@marind.ca</li>
              <li>Order status is updated to "shipped" after successful shipment creation</li>
              <li>Export to CSV remains available as a backup option</li>
              <li>Ensure customers are added to the address book before shipping</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

