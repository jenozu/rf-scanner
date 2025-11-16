import React, { useState, useEffect, useCallback } from "react";
import { parseCSV, parsePOFile, parseSalesOrderFile } from "../data/csv-utils";
import useServerStorage from "../hooks/useServerStorage";
import { Item, PageType, PurchaseOrder, SalesOrder } from "../types";
import { initializeSampleData, clearAllData } from "../data/sample-data";
import { api } from "../services/api";
import { Database, Upload, Play, Trash2, Package, ShoppingCart } from "lucide-react";
import { buildBinsFromItems } from "../utils/bin-utils";

interface SetupPageProps {
  setPage: (page: PageType) => void;
  onSetupComplete?: () => void;
}

const SetupPage: React.FC<SetupPageProps> = ({ setPage, onSetupComplete }) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [data, setData, isLoadingData] = useServerStorage<Item[]>("rf_active", []);
  const [status, setStatus] = useState<string>("");
  const [isLoadingMaster, setIsLoadingMaster] = useState(false);

  const persistInventoryData = useCallback(
    async (items: Item[], options: { syncToServer?: boolean } = {}) => {
      const { syncToServer = true } = options;
      const safeItems = Array.isArray(items) ? items : [];
      await setData(safeItems);
      localStorage.setItem("rf_active", JSON.stringify(safeItems));
      localStorage.setItem("rf_master", JSON.stringify(safeItems));

      const bins = buildBinsFromItems(safeItems);
      localStorage.setItem("rf_bins", JSON.stringify(bins));

      let serverSynced = true;
      if (syncToServer) {
        try {
          await Promise.all([
            api.saveData("rf_master", safeItems),
            api.saveData("rf_active", safeItems),
            api.saveData("rf_bins", bins),
          ]);
        } catch (error) {
          serverSynced = false;
          console.error("Error syncing inventory data to server:", error);
        }
      }

      return { bins, serverSynced };
    },
    [setData]
  );

  // 🔄 Auto-load master inventory from VPS on mount
  useEffect(() => {
    const loadMasterInventory = async () => {
      // Check if we already have data from server (but still try server first for fresh data)
      try {
        const existingData = await api.getData("rf_active");
        const hasExistingData = existingData && Array.isArray(existingData) && existingData.length > 0;
        
        // Always try to load from server first, unless we already have real data
        // (not sample data - sample data has only ~7 items)
        if (hasExistingData && existingData.length > 20) {
          await persistInventoryData(existingData, { syncToServer: false });
          setStatus(`✅ Using existing data (${existingData.length} items). Click "Load from Server" below to refresh.`);
          return;
        }
      } catch (error) {
        // API might not be available yet, continue with file load
        console.log("API not available, will try file load");
      }

      setIsLoadingMaster(true);
      setStatus("📥 Attempting to load master inventory from server...");

      try {
        // Try to fetch master inventory file from VPS
        const response = await fetch("/data/master_inventory.xlsx");
        
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], "master_inventory.xlsx", { type: blob.type });
          
          // Parse the file
          const parsedData = await parseCSV(file);
          
          const { serverSynced } = await persistInventoryData(parsedData);
          const syncNote = serverSynced ? "" : " ⚠️ Saved locally; server sync failed.";
          setStatus(`✅ Loaded ${parsedData.length} items from master inventory${syncNote}`);
          
          // Auto-complete setup after successful load
          setTimeout(() => {
            if (onSetupComplete) {
              onSetupComplete();
            }
          }, 1500);
        } else {
          // Master file not found on server
          if (response.status === 404) {
            setStatus("⚠️ Master inventory file not found on server. Please upload your inventory file below or use demo data.");
          } else {
            setStatus(`⚠️ Server error (${response.status}). Please upload your inventory file below or use demo data.`);
          }
        }
      } catch (error) {
        console.error("Error loading master inventory:", error);
        setStatus("⚠️ Could not connect to server. Please upload your inventory file below or use demo data.");
      } finally {
        setIsLoadingMaster(false);
      }
    };

    loadMasterInventory();
  }, [persistInventoryData]);

  // 🔄 Manual load from server button
  const handleLoadFromServer = async () => {
    setIsLoadingMaster(true);
    setStatus("📥 Loading master inventory from server...");

    try {
      const response = await fetch("/data/master_inventory.xlsx");
      
      if (response.ok) {
        const blob = await response.blob();
        const file = new File([blob], "master_inventory.xlsx", { type: blob.type });
        
        const parsedData = await parseCSV(file);
        
        const { serverSynced } = await persistInventoryData(parsedData);
        const syncNote = serverSynced ? "" : " ⚠️ Saved locally; server sync failed.";
        setStatus(`✅ Loaded ${parsedData.length} items from master inventory${syncNote}`);
        
        setTimeout(() => {
          if (onSetupComplete) {
            onSetupComplete();
          }
        }, 1500);
      } else {
        if (response.status === 404) {
          setStatus("❌ Master inventory file not found on server. Please upload manually.");
        } else {
          setStatus(`❌ Server error (${response.status}). Please try again or upload manually.`);
        }
      }
    } catch (error) {
      console.error("Error loading master inventory:", error);
      setStatus("❌ Could not connect to server. Please upload your inventory file manually.");
    } finally {
      setIsLoadingMaster(false);
    }
  };

  // 📥 Handle file upload (CSV or XLSX)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const fileType = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') 
      ? 'Excel' 
      : 'CSV';
    setStatus(`⏳ Parsing ${fileType} file...`);

    try {
      const parsedData = await parseCSV(file);

      const { serverSynced } = await persistInventoryData(parsedData);
      const syncNote = serverSynced ? "" : " ⚠️ Saved locally; server sync failed.";
      setStatus(`✅ Loaded ${parsedData.length} items from ${fileType} file${syncNote}`);
      
      // Automatically navigate to home if data is loaded successfully
      if (onSetupComplete) {
        setTimeout(() => {
          onSetupComplete();
        }, 1000);
      }
    } catch (err) {
      console.error("Error parsing file:", err);
      setStatus(`❌ Error reading ${fileType} file. Please check the format and column names.`);
    }
  };

  // 🔄 Resume saved session
  const handleResume = () => {
    if (data.length > 0) {
      setStatus(`Resumed from saved session (${data.length} items)`);
      if (onSetupComplete) onSetupComplete();
    } else {
      setStatus("⚠️ No saved session found.");
    }
  };

  // 🎲 Initialize sample data
  const handleInitializeSampleData = async () => {
    setStatus("⏳ Initializing sample data...");
    try {
      initializeSampleData();
      const sampleItems = JSON.parse(localStorage.getItem("rf_active") || "[]");
      const { serverSynced } = await persistInventoryData(sampleItems);
      const syncNote = serverSynced ? "" : " ⚠️ Saved locally; server sync failed.";
      setStatus(`✅ Sample data initialized! Ready to use.${syncNote}`);
      setTimeout(() => {
        if (onSetupComplete) onSetupComplete();
      }, 1500);
    } catch (err) {
      console.error("Error initializing data:", err);
      setStatus("❌ Error initializing sample data.");
    }
  };

  // 📥 Handle PO file upload
  const handlePOFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') 
      ? 'Excel' 
      : 'CSV';
    setStatus(`⏳ Parsing PO ${fileType} file...`);

    try {
      const newPOs = await parsePOFile(file);
      
      // Get existing POs or create empty array
      const existingPOs = (await api.getData("rf_purchase_orders")) || [] as PurchaseOrder[];
      const existingPONumbers = new Set(existingPOs.map(po => po.poNumber));
      
      // Filter out duplicates
      const uniqueNewPOs = newPOs.filter(po => !existingPONumbers.has(po.poNumber));
      
      if (uniqueNewPOs.length === 0) {
        setStatus("⚠️ All POs in file already exist. No new POs added.");
        e.target.value = "";
        return;
      }

      const mergedPOs = [...existingPOs, ...uniqueNewPOs];
      await api.saveData("rf_purchase_orders", mergedPOs);
      
      const totalItems = uniqueNewPOs.reduce((sum, po) => sum + po.items.length, 0);
      setStatus(`✅ Loaded ${uniqueNewPOs.length} purchase order(s) with ${totalItems} total line items from ${fileType} file`);
      e.target.value = "";
    } catch (err) {
      console.error("Error parsing PO file:", err);
      setStatus(`❌ Error reading PO ${fileType} file. Please check format. Required columns: poNumber, vendor, expectedDate, ItemCode, Description, OrderedQty`);
      e.target.value = "";
    }
  };

  // 📥 Handle Sales Order file upload
  const handleSOFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') 
      ? 'Excel' 
      : 'CSV';
    setStatus(`⏳ Parsing Sales Order ${fileType} file...`);

    try {
      const newSOs = await parseSalesOrderFile(file);
      
      // Get existing SOs or create empty array
      const existingSOs = (await api.getData("rf_sales_orders")) || [] as SalesOrder[];
      const existingSONumbers = new Set(existingSOs.map(so => so.soNumber));
      
      // Filter out duplicates
      const uniqueNewSOs = newSOs.filter(so => !existingSONumbers.has(so.soNumber));
      
      if (uniqueNewSOs.length === 0) {
        setStatus("⚠️ All Sales Orders in file already exist. No new SOs added.");
        e.target.value = "";
        return;
      }

      const mergedSOs = [...existingSOs, ...uniqueNewSOs];
      await api.saveData("rf_sales_orders", mergedSOs);
      
      setStatus(`✅ Loaded ${uniqueNewSOs.length} sales order(s) with ${newSOs.reduce((sum, so) => sum + so.items.length, 0)} total line items from ${fileType} file`);
      e.target.value = "";
    } catch (err) {
      console.error("Error parsing Sales Order file:", err);
      setStatus(`❌ Error reading Sales Order ${fileType} file. Please check format. Required columns: soNumber, customer, CardCode, ItemCode, Description, OrderedQty, DeliveredQty`);
      e.target.value = "";
    }
  };

  // 🗑️ Clear all data
  const handleClearData = () => {
    if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
      clearAllData();
      setData([]);
      setStatus("🗑️ All data cleared.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900 p-6">
      <div className="w-full max-w-lg bg-white shadow-lg rounded-xl p-8">
        <h1 className="text-3xl font-semibold text-center text-blue-600 mb-2">
          RF Warehouse Manager
        </h1>
        <p className="text-center text-gray-600 mb-4">
          Complete warehouse operations at your fingertips
        </p>
        
        {/* Info Box */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
          <p className="font-medium text-blue-900 mb-1">ℹ️ Data Storage Information</p>
          <p className="text-gray-600">
            Data is stored locally in your browser. Each user/browser has their own copy. 
            <strong className="text-blue-700"> To share the same inventory data, use "Load from Server"</strong> - 
            all users will load from the same master inventory file on the server.
          </p>
        </div>

        {/* 🔄 Load from Server - PRIMARY ACTION */}
        <div className="mb-6 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <Database className="text-green-600" size={28} />
            <h3 className="text-lg font-semibold text-green-900">Load from Server</h3>
          </div>
          <p className="text-sm text-gray-700 mb-4">
            Load the master inventory file from the server. This is the recommended option for new users.
            All users share the same master inventory file from the server.
          </p>
          <button
            onClick={handleLoadFromServer}
            disabled={isLoadingMaster}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {isLoadingMaster ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Loading...
              </>
            ) : (
              <>
                <Database size={20} />
                Load from Server
              </>
            )}
          </button>
        </div>

        <div className="text-center text-gray-400 mb-4">OR</div>

        {/* 🎲 Initialize Sample Data */}
        <div className="mb-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <Play className="text-blue-600" size={28} />
            <h3 className="text-lg font-semibold text-blue-900">Demo Data (Testing Only)</h3>
          </div>
          <p className="text-sm text-gray-700 mb-4">
            Start with pre-loaded sample data including purchase orders, customer orders, 
            bins, and cycle count tasks. Perfect for testing and learning!
            <strong className="block mt-2 text-red-600">⚠️ This is dummy data - use "Load from Server" for real inventory!</strong>
          </p>
          <button
            onClick={handleInitializeSampleData}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            <Play size={20} />
            Initialize Sample Data
          </button>
        </div>

        <div className="text-center text-gray-400 mb-4">OR</div>

        {/* 📁 File Upload Section */}
        <div className="text-center border-2 border-dashed border-gray-300 rounded-lg p-6 mb-4 hover:border-blue-400 transition">
          <Upload className="mx-auto mb-2 text-gray-400" size={32} />
          <label
            htmlFor="csvFile"
            className="cursor-pointer text-blue-500 font-medium"
          >
            Upload Inventory File (CSV or Excel)
          </label>
          <input
            id="csvFile"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <p className="text-xs text-gray-500 mt-2">
            Supports: <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Required columns: <code>BinCode</code>, <code>ItemCode</code>,{" "}
            <code>Description</code>, <code>ExpectedQty</code>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            (Column names are flexible - will auto-detect similar names)
          </p>
        </div>

        {/* 📦 Purchase Order Upload Section */}
        <div className="text-center border-2 border-dashed border-purple-300 rounded-lg p-6 mb-4 hover:border-purple-400 transition bg-purple-50">
          <Package className="mx-auto mb-2 text-purple-400" size={32} />
          <label
            htmlFor="poFile"
            className="cursor-pointer text-purple-600 font-medium"
          >
            Upload Purchase Orders (CSV or Excel)
          </label>
          <input
            id="poFile"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handlePOFileUpload}
            className="hidden"
          />
          <p className="text-xs text-gray-600 mt-2">
            Required columns: <code>poNumber</code>, <code>vendor</code>, <code>expectedDate</code>,{" "}
            <code>ItemCode</code>, <code>Description</code>, <code>OrderedQty</code>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Supports multiple purchase orders in one file (separated by blank lines)
          </p>
          <p className="text-xs text-gray-500">
            Optional: <code>ReceivedQty</code>, <code>BinCode</code>, <code>CardCode</code>, <code>LineNumber</code>
          </p>
        </div>

        {/* 🛒 Sales Order Upload Section */}
        <div className="text-center border-2 border-dashed border-green-300 rounded-lg p-6 mb-4 hover:border-green-400 transition bg-green-50">
          <ShoppingCart className="mx-auto mb-2 text-green-500" size={32} />
          <label
            htmlFor="soFile"
            className="cursor-pointer text-green-600 font-medium"
          >
            Upload Sales Orders (CSV or Excel)
          </label>
          <input
            id="soFile"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleSOFileUpload}
            className="hidden"
          />
          <p className="text-xs text-gray-600 mt-2">
            Required columns: <code>soNumber</code>, <code>customer</code>, <code>CardCode</code>,{" "}
            <code>ItemCode</code>, <code>Description</code>, <code>OrderedQty</code>, <code>DeliveredQty</code>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Supports multiple sales orders in one file (separated by blank lines)
          </p>
          <p className="text-xs text-gray-500">
            Optional: <code>LineNumber</code>, <code>BinCode</code>
          </p>
        </div>

        {/* 🔄 Resume Button */}
        {data.length > 0 && (
          <button
            onClick={handleResume}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 rounded-lg transition mb-4 flex items-center justify-center gap-2"
          >
            <Play size={20} />
            Resume Saved Session
          </button>
        )}

        {/* 🗑️ Clear Data Button */}
        <button
          onClick={handleClearData}
          className="w-full bg-red-100 hover:bg-red-200 text-red-700 font-medium py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"
        >
          <Trash2 size={16} />
          Clear All Data
        </button>

        {/* 🧾 Status Display */}
        {status && (
          <div className="mt-4 text-center text-gray-700 bg-gray-100 p-3 rounded-lg">
            {status}
          </div>
        )}

        {/* 📦 Summary */}
        {data.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h2 className="font-semibold text-lg text-gray-700 mb-2">
              📦 Loaded Data Summary
            </h2>
            <p className="text-gray-600 text-sm">Total items: {data.length}</p>
            <p className="text-gray-600 text-sm">
              First bin: {data[0]?.BinCode || "N/A"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupPage;
