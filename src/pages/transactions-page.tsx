import React from "react";
import { Package, Truck, ArrowRight } from "lucide-react";
import { PageType } from "../types";

interface TransactionsPageProps {
  setPage: (page: PageType) => void;
}

export default function TransactionsPage({ setPage }: TransactionsPageProps) {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Transactions</h1>
      <p className="text-gray-600 mb-6">
        Select a transaction type to process inventory movements
      </p>

      <div className="space-y-4">
        {/* Receive Inventory */}
        <button
          onClick={() => setPage("receive")}
          className="w-full bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-l-4 border-blue-500 text-left flex items-center justify-between group"
        >
          <div className="flex items-start gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Package className="text-blue-600" size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Receive Inventory</h2>
              <p className="text-gray-600 text-sm">
                Process incoming purchase orders and putaway items to bin locations
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                  Inbound
                </span>
                <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                  Purchase Orders
                </span>
                <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                  Putaway
                </span>
              </div>
            </div>
          </div>
          <ArrowRight className="text-gray-400 group-hover:text-blue-600 transition-colors" size={24} />
        </button>

        {/* Pick Orders */}
        <button
          onClick={() => setPage("pick")}
          className="w-full bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-l-4 border-green-500 text-left flex items-center justify-between group"
        >
          <div className="flex items-start gap-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <Truck className="text-green-600" size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Pick Orders</h2>
              <p className="text-gray-600 text-sm">
                Process customer orders with wave picking and order fulfillment
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-block px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                  Outbound
                </span>
                <span className="inline-block px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                  Wave Picking
                </span>
                <span className="inline-block px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                  Fulfillment
                </span>
              </div>
            </div>
          </div>
          <ArrowRight className="text-gray-400 group-hover:text-green-600 transition-colors" size={24} />
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> Receive adds items to inventory (inbound), Pick removes items for orders (outbound).
        </p>
      </div>
    </div>
  );
}

