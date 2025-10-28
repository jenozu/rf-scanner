import React, { useState } from "react";
import { parseCSV } from "../data/csv-utils";
import useLocalStorage from "../hooks/useLocalStorage";
import { Item, PageType } from "../types";
import { initializeSampleData, clearAllData } from "../data/sample-data";
import { Database, Upload, Play, Trash2 } from "lucide-react";

interface SetupPageProps {
  setPage: (page: PageType) => void;
  onSetupComplete?: () => void;
}

const SetupPage: React.FC<SetupPageProps> = ({ setPage, onSetupComplete }) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [data, setData] = useLocalStorage<Item[]>("rf_active", []);
  const [status, setStatus] = useState<string>("");

  // 📥 Handle CSV upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setStatus("⏳ Parsing CSV...");

    try {
      const parsedData = await parseCSV(file);

      // 🧮 Normalize and add missing fields
      const normalized: Item[] = parsedData.map((row: any) => ({
        BinCode: row.BinCode?.trim() || "",
        ItemCode: row.ItemCode?.trim() || "",
        Description: row.Description?.trim() || "",
        ExpectedQty: parseFloat(row.ExpectedQty) || 0,
        CountedQty: 0,
        Variance: 0,
      }));

      setData(normalized);
      setStatus(`✅ Loaded ${normalized.length} items from CSV`);
      setPage("scan");
    } catch (err) {
      console.error("Error parsing CSV:", err);
      setStatus("❌ Error reading file. Please check CSV format.");
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
            Upload Custom Stock CSV
          </label>
          <input
            id="csvFile"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <p className="text-xs text-gray-500 mt-2">
            Required: <code>BinCode</code>, <code>ItemCode</code>,{" "}
            <code>Description</code>, <code>ExpectedQty</code>
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
