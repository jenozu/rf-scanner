import React, { useState, useEffect } from "react";
import { parseCSV, parsePOFile } from "../data/csv-utils";
import useLocalStorage from "../hooks/useLocalStorage";
import { Item, PageType, PurchaseOrder } from "../types";
import { initializeSampleData, clearAllData } from "../data/sample-data";
import { Database, Upload, Play, Trash2, Package } from "lucide-react";

interface SetupPageProps {
  setPage: (page: PageType) => void;
  onSetupComplete?: () => void;
}

const SetupPage: React.FC<SetupPageProps> = ({ setPage, onSetupComplete }) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [data, setData] = useLocalStorage<Item[]>("rf_active", []);
  const [status, setStatus] = useState<string>("");
  const [isLoadingMaster, setIsLoadingMaster] = useState(false);

  // 🔄 Auto-load master inventory from VPS on mount
  useEffect(() => {
    const loadMasterInventory = async () => {
      // Check if we already have data
      const existingData = localStorage.getItem("rf_active");
      if (existingData && JSON.parse(existingData).length > 0) {
        // Already have data, don't auto-load
        return;
      }

      setIsLoadingMaster(true);
      setStatus("📥 Loading master inventory from server...");

      try {
        // Try to fetch master inventory file from VPS
        const response = await fetch("/data/master_inventory.xlsx");
        
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], "master_inventory.xlsx", { type: blob.type });
          
          // Parse the file
          const parsedData = await parseCSV(file);
          
          // Save as both master (read-only) and active (working copy)
          localStorage.setItem("rf_master", JSON.stringify(parsedData));
          localStorage.setItem("rf_active", JSON.stringify(parsedData));
          
          setData(parsedData);
          setStatus(`✅ Loaded ${parsedData.length} items from master inventory`);
          
          // Auto-complete setup after successful load
          setTimeout(() => {
            if (onSetupComplete) {
              onSetupComplete();
            }
          }, 1500);
        } else {
          // Master file not found on server, allow manual upload
          setStatus("No master inventory found. Please upload manually.");
        }
      } catch (error) {
        console.error("Error loading master inventory:", error);
        setStatus("Could not load master inventory. Please upload manually.");
      } finally {
        setIsLoadingMaster(false);
      }
    };

    loadMasterInventory();
  }, []);

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

      // Save as both master (read-only) and active (working copy)
      localStorage.setItem("rf_master", JSON.stringify(parsedData));
      localStorage.setItem("rf_active", JSON.stringify(parsedData));
      
      setData(parsedData);
      setStatus(`✅ Loaded ${parsedData.length} items from ${fileType} file`);
      
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
  const handleInitializeSampleData = () => {
    setStatus("⏳ Initializing sample data...");
    try {
      initializeSampleData();
      setStatus("✅ Sample data initialized! Ready to use.");
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
      const existingPOs = JSON.parse(localStorage.getItem("rf_purchase_orders") || "[]") as PurchaseOrder[];
      const existingPONumbers = new Set(existingPOs.map(po => po.poNumber));
      
      // Filter out duplicates
      const uniqueNewPOs = newPOs.filter(po => !existingPONumbers.has(po.poNumber));
      
      if (uniqueNewPOs.length === 0) {
        setStatus("⚠️ All POs in file already exist. No new POs added.");
        e.target.value = "";
        return;
      }

      const mergedPOs = [...existingPOs, ...uniqueNewPOs];
      localStorage.setItem("rf_purchase_orders", JSON.stringify(mergedPOs));
      
      setStatus(`✅ Loaded ${uniqueNewPOs.length} purchase order(s) from ${fileType} file`);
      e.target.value = "";
    } catch (err) {
      console.error("Error parsing PO file:", err);
      setStatus(`❌ Error reading PO ${fileType} file. Please check format. Required columns: poNumber, vendor, expectedDate, ItemCode, Description, OrderedQty`);
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
        <p className="text-center text-gray-600 mb-8">
          Complete warehouse operations at your fingertips
        </p>

        {/* 🎲 Initialize Sample Data - PRIMARY ACTION */}
        <div className="mb-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <Database className="text-blue-600" size={28} />
            <h3 className="text-lg font-semibold text-blue-900">Demo Data</h3>
          </div>
          <p className="text-sm text-gray-700 mb-4">
            Start with pre-loaded sample data including purchase orders, customer orders, 
            bins, and cycle count tasks. Perfect for testing and learning!
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
            Optional: <code>ReceivedQty</code>, <code>BinCode</code>
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
