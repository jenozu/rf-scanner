Goal: Implement a new "Full Inventory Count (Upload)" feature in src/pages/inventory-page.tsx that allows a user to upload a CSV or Excel file containing counted inventory data to update the system's inventory and log the transactions.
File to Modify: src/pages/inventory-page.tsx
Steps:
Update State Definitions:
Change the countingMode state type to include "full".
TypeScript
// Change this line:
const [countingMode, setCountingMode] = useState<"cycle" | "sequential">("cycle");
// To this:
const [countingMode, setCountingMode] = useState<"cycle" | "sequential" | "full">("cycle");
Add new state variables for the full count feature near the other state definitions (e.g., after numpadValue):
TypeScript
// Full counting mode state
const [fullCountFile, setFullCountFile] = useState<File | null>(null);
const [fullCountItems, setFullCountItems] = useState<CycleCount[]>([]);
const [fullCountStatus, setFullCountStatus] = useState<string>("");
Implement Full Count Functions:
Add the following two functions, handleFullCountFileUpload and processFullCount, to the component logic (e.g., before the render section). Ensure you import parseCSV from ../data/csv-utils if it's not already imported.
TypeScript
// Full Count functions
const handleFullCountFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setFullCountFile(file);
  const fileType = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') 
    ? 'Excel' 
    : 'CSV';
  setFullCountStatus(`⏳ Parsing ${fileType} file...`);

  try {
    // Use the existing parseCSV which returns Item[]
    const parsedItems = await parseCSV(file);
    
    // Convert Item[] to CycleCount[]
    const newCycleCounts: CycleCount[] = parsedItems.map((item, index) => ({
      id: `full-count-${Date.now()}-${index}`,
      BinCode: item.BinCode,
      ItemCode: item.ItemCode,
      ExpectedQty: item.ExpectedQty,
      // The uploaded file contains the counted quantity
      CountedQty: item.CountedQty ?? 0, 
      Variance: item.Variance ?? 0,
      Status: item.CountedQty !== undefined ? "counted" : "pending", // Mark as counted if Qty is present
    }));

    setFullCountItems(newCycleCounts);
    setFullCountStatus(`✅ Loaded ${newCycleCounts.length} items from ${fileType} file. Ready to process.`);
    showToast(`✅ Loaded ${newCycleCounts.length} items for full count.`, "success");
  } catch (err) {
    console.error("Error parsing full count file:", err);
    setFullCountStatus(`❌ Error reading ${fileType} file. Please check the format and column names (BinCode, ItemCode, ExpectedQty, CountedQty).`);
  }
};

const processFullCount = () => {
  if (!currentSession) {
    showToast("⚠️ Please start a session first", "error");
    return;
  }

  if (fullCountItems.length === 0) {
    showToast("⚠️ No items loaded for full count", "error");
    return;
  }

  // 1. Update the main cycleCounts list
  const newCounts = fullCountItems.filter(c => c.Status === "counted");
  const updatedCounts = [...cycleCounts, ...newCounts];
  localStorage.setItem("rf_cycle_counts", JSON.stringify(updatedCounts));
  setCycleCounts(updatedCounts);

  // 2. Update the current session with the new cycle count IDs
  const newCountIds = newCounts.map(c => c.id);
  const updatedSession: InventorySession = {
    ...currentSession,
    cycleCountIds: [...currentSession.cycleCountIds, ...newCountIds],
    lastAccessedDate: new Date().toISOString(),
  };
  const updatedSessions = sessions.map((s) => (s.id === currentSession.id ? updatedSession : s));
  localStorage.setItem("rf_inventory_sessions", JSON.stringify(updatedSessions));
  setCurrentSession(updatedSession);
  setSessions(updatedSessions);

  // 3. Update the bin inventory with the counted quantities
  let updatedBins = [...bins];
  const txns: CycleCountTransaction[] = [];

  newCounts.forEach(newCount => {
    const variance = newCount.CountedQty! - newCount.ExpectedQty;
    
    // Find and update the bin
    const binIndex = updatedBins.findIndex(b => b.BinCode === newCount.BinCode);
    if (binIndex !== -1) {
      const itemIndex = updatedBins[binIndex].Items.findIndex(i => i.ItemCode === newCount.ItemCode);
      if (itemIndex !== -1) {
        // Update the quantity in the bin
        updatedBins[binIndex].Items[itemIndex].Quantity = newCount.CountedQty!;
      } else {
        // Item not found in bin, add it (this shouldn't happen if master data is correct, but for robustness)
        updatedBins[binIndex].Items.push({
          ItemCode: newCount.ItemCode,
          Description: newCount.ItemCode, // Fallback description
          Quantity: newCount.CountedQty!,
        });
      }
    } else {
      // Bin not found, create a new bin (unlikely for full count, but for robustness)
      updatedBins.push({
        BinCode: newCount.BinCode,
        Zone: "FULL_COUNT",
        Items: [{
          ItemCode: newCount.ItemCode,
          Description: newCount.ItemCode,
          Quantity: newCount.CountedQty!,
        }],
      });
    }

    // Create a transaction log
    txns.push({
      id: `CC-${Date.now()}-${newCount.id}`,
      binCode: newCount.BinCode,
      itemCode: newCount.ItemCode,
      description: newCount.ItemCode, // Fallback description
      expectedQty: newCount.ExpectedQty,
      countedQty: newCount.CountedQty!,
      variance: variance,
      timestamp: new Date().toISOString(),
    });
  });

  localStorage.setItem("rf_bins", JSON.stringify(updatedBins));
  setBins(updatedBins);

  // 4. Save transactions
  const existingTxns: CycleCountTransaction[] = JSON.parse(localStorage.getItem("rf_cycle_count_txns") || "[]");
  localStorage.setItem("rf_cycle_count_txns", JSON.stringify([...txns, ...existingTxns]));

  // 5. Reset and notify
  setFullCountFile(null);
  setFullCountItems([]);
  setFullCountStatus(`✅ Successfully processed ${newCounts.length} counted items.`);
  showToast(`✅ Full count processed! ${newCounts.length} items updated.`, "success");
  setCountingMode("cycle"); // Switch back to cycle view
};
Update UI for Mode Selection:
In the main return block (where countingMode === "cycle"), find the Counting Mode section.
Change the grid layout from grid-cols-2 to grid-cols-3.
Add a new button for "Full Inventory Count (Upload)" next to the existing buttons.
HTML
// Find this:
<div className="grid grid-cols-2 gap-3">

// Change to this:
<div className="grid grid-cols-3 gap-3">

// Add this button after the "Cycle Count (Task List)" button:
<button
  onClick={() => {
    if (!currentSession) {
      showToast("⚠️ Please start a session first", "error");
      setShowSessionModal(true);
      return;
    }
    setCountingMode("full");
  }}
  className="bg-yellow-600 text-white px-4 py-3 rounded-md hover:bg-yellow-700 font-medium flex items-center justify-center gap-2"
>
  <Upload size={20} />
  Full Inventory Count (Upload)
</button>
Add Full Count UI Rendering:
Before the // Render sequential counting UI block, add the new rendering logic for the "full" mode.
TypeScript
// Render full count UI
if (countingMode === "full") {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="text-yellow-600" />
          Full Inventory Count (Upload)
        </h1>
        <button
          onClick={() => setCountingMode("cycle")}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm flex items-center gap-2"
        >
          <X size={16} />
          Cancel
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">1. Upload Count File</h2>
        <p className="text-gray-600 mb-4">
          Upload a CSV or Excel file containing your full inventory count. The file must contain the following columns: 
          <code className="font-mono bg-gray-100 p-1 rounded-md">BinCode</code>, 
          <code className="font-mono bg-gray-100 p-1 rounded-md">ItemCode</code>, 
          <code className="font-mono bg-gray-100 p-1 rounded-md">ExpectedQty</code>, and 
          <code className="font-mono bg-gray-100 p-1 rounded-md">CountedQty</code>.
        </p>
        
        <label className="block">
          <span className="sr-only">Choose file</span>
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFullCountFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-yellow-50 file:text-yellow-700
              hover:file:bg-yellow-100"
          />
        </label>
        <p className="mt-3 text-sm text-gray-500">{fullCountStatus}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">2. Process Count</h2>
        <p className="text-gray-600 mb-4">
          Once the file is uploaded and parsed, click the button below to apply the counted quantities to your inventory and log the cycle count transactions in the current session: 
          <span className="font-medium text-blue-600">{currentSession?.name}</span>.
        </p>
        
        <button
          onClick={processFullCount}
          disabled={fullCountItems.length === 0}
          className={`w-full py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors ${
            fullCountItems.length > 0
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          <CheckCircle2 size={20} />
          Process {fullCountItems.length} Counted Items
        </button>
        
        {fullCountItems.length > 0 && (
          <div className="mt-4 text-sm text-gray-500">
            <p>Items loaded: {fullCountItems.length}</p>
            <p>Items marked as counted: {fullCountItems.filter(c => c.Status === "counted").length}</p>
          </div>
        )}
      </div>
    </div>
  );
}