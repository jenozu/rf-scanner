import Papa from "papaparse";
import * as XLSX from "xlsx";
import { classifyBin, normalizeWarehouse } from "../../server/ops-logic.js";
import { parseQty as parseCellQty } from "./cell-parsing";
import { Item, ReceivingTransaction, CycleCountTransaction } from "../types";

// Purchase-order and sales-order import lives in sap-import.ts.

// --- Bin and warehouse columns --------------------------------------------------------
// SAP keeps the warehouse and the bin apart (a bin is like "01-RACK"; "01" is the warehouse).
// Older code treated a WhsCode column as the bin, which sends pickers to a bin that does not
// exist. Now the warehouse is stored on its own, and the bin comes only from bin columns:
// the line's own bin first, then the item's Default Bin Location, then its First Bin
// Location (the names SAP shows on the item's Inventory Data tab).
const BIN_COLUMNS = [
  "bincode", "bin", "binlocation", "picklocation", "putawaylocation",
  "defaultbinlocation", "defaultbin", "firstbinlocation", "firstbin",
  "fisrtbin", // SAP's own spelling of the "first bin" column on document lines (RDR1/POR1/DLN1.FisrtBin)
];
const WAREHOUSE_COLUMNS = ["whscode", "whsecode", "warehouse", "warehousecode", "whse", "whs"];

const columnKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, ""); // "Item No." -> "itemno"

function pickColumn(row: Record<string, unknown>, wanted: string[]): string[] {
  const byKey = new Map<string, unknown>();
  Object.keys(row).forEach((key) => byKey.set(columnKey(key), row[key]));
  return wanted
    .map((key) => byKey.get(key))
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
    .map((value) => String(value).trim());
}

/**
 * Bin and warehouse for one import row. The first bin column that holds a real bin wins;
 * if none does, the first value found is kept (so the screen can show what SAP had, such as
 * 01-SYSTEM-BIN-LOCATION) and the line is flagged as needing a bin.
 */
export function extractBinAndWarehouse(row: Record<string, unknown>): { binCode?: string; warehouse?: string } {
  const warehouse = normalizeWarehouse(pickColumn(row, WAREHOUSE_COLUMNS)[0]); // 5 / "5" / "05" -> "05"
  const candidates = pickColumn(row, BIN_COLUMNS);
  const binCode = candidates.find((value) => classifyBin(value, warehouse).real) ?? candidates[0];
  return { binCode: binCode || undefined, warehouse: warehouse || undefined };
}

/**
 * 📥 Parse CSV or XLSX file and return structured data
 * Expected columns:
 * BinCode, ItemCode, Description, ExpectedQty
 * 
 * Automatically detects file type and uses appropriate parser
 */
export async function parseCSV(file: File): Promise<Item[]> {
  const fileName = file.name.toLowerCase();
  
  // Check if it's an Excel file
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseExcel(file);
  }
  
  // Default to CSV parsing
  return parseCSVFile(file);
}

/**
 * Parse CSV file using PapaParse
 */
async function parseCSVFile(file: File): Promise<Item[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = normalizeData(results.data);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      },
      error: (error) => reject(error),
    });
  });
}

/**
 * Parse Excel file using SheetJS (xlsx)
 */
async function parseExcel(file: File): Promise<Item[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Failed to read file"));
          return;
        }
        
        // Read the workbook
        const workbook = XLSX.read(data, { type: "binary" });
        
        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: "",
        });
        
        // Convert array of arrays to array of objects
        if (jsonData.length === 0) {
          reject(new Error("Excel file is empty"));
          return;
        }
        
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];
        
        const objects = rows
          .filter(row => row.some(cell => cell !== "" && cell !== null && cell !== undefined))
          .map(row => {
            const obj: any = {};
            headers.forEach((header, index) => {
              obj[header] = row[index] !== undefined ? row[index] : "";
            });
            return obj;
          });
        
        const normalizedData = normalizeData(objects);
        resolve(normalizedData);
      } catch (err) {
        console.error("Error parsing Excel file:", err);
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsBinaryString(file);
  });
}

/**
 * Normalize data from either CSV or Excel into Item format
 * Supports various column name variations from different sources (SAP, manual exports, etc.)
 * 
 * Note: CountedQty and Variance are left undefined until user actually counts the item.
 * When re-importing data that already has counted values, they will be preserved.
 */
const ITEM_CODE_COLUMNS = ["itemcode", "itemno", "itemnumber", "itemnum", "item", "sku", "partnumber", "partno", "part"];
const DESCRIPTION_COLUMNS = ["description", "desc", "itemdescription", "itemname", "name"];
const QTY_COLUMNS = [
  "expectedqty", "quantity", "qty", "qtyinbin", "onhandqty", "onhand", "instock", "qtyonhand",
];

export function normalizeData(rawData: any[]): Item[] {
  const items = rawData.map((row: any) => {
    const { binCode } = extractBinAndWarehouse(row);
    const item: Item = {
      BinCode: binCode ?? "",
      ItemCode: pickColumn(row, ITEM_CODE_COLUMNS)[0] ?? "",
      Description: pickColumn(row, DESCRIPTION_COLUMNS)[0] ?? "",
      ExpectedQty: parseQty(pickColumn(row, QTY_COLUMNS)[0]),
    };

    // If CountedQty exists in the source data (re-importing counted data), preserve it
    if (row.CountedQty !== undefined && row.CountedQty !== null && row.CountedQty !== "") {
      const countedQty = parseQty(row.CountedQty);
      item.CountedQty = countedQty;
      // Auto-calculate Variance if CountedQty is present
      item.Variance = countedQty - item.ExpectedQty;
    }
    // Otherwise, leave CountedQty and Variance undefined (not yet counted)

    return item;
  });

  // A file whose headers match nothing used to import as thousands of blank rows and
  // report success. Fail loudly instead, and say which headers were found.
  if (items.length > 0 && !items.some((item) => item.ItemCode)) {
    const headers = Object.keys(rawData[0] ?? {}).filter(Boolean).join(", ") || "(none)";
    throw new Error(
      `No item codes found. Row 1 must have an ItemCode column (also accepted: Item No., Item Number, SKU). Columns found: ${headers}`
    );
  }
  return items;
}

/** Master inventory quantity: "1,000", "1 000", "2,5" and plain numbers; blank or unreadable -> 0. */
function parseQty(value: unknown): number {
  return parseCellQty(value) ?? 0;
}

/**
 * 📤 Export updated data as downloadable CSV
 */
export function exportCSV(data: Item[], filename = "rf_inventory_results.csv") {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  // Ensure columns are consistent and well-formatted
  const cleaned = data.map((item) => ({
    BinCode: item.BinCode,
    ItemCode: item.ItemCode,
    Description: item.Description,
    ExpectedQty: item.ExpectedQty,
    CountedQty: item.CountedQty ?? "",
    Variance: item.Variance ?? "",
  }));

  const csv = Papa.unparse(cleaned, {
    columns: [
      "BinCode",
      "ItemCode",
      "Description",
      "ExpectedQty",
      "CountedQty",
      "Variance",
    ],
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 📤 Export Receiving transactions as CSV
 */
export function exportReceivingTxnsCSV(transactions: ReceivingTransaction[], filename = "receiving_transactions.csv") {
  if (!transactions || transactions.length === 0) {
    alert("No receiving transactions to export.");
    return;
  }

  const cleaned = transactions.map((t) => ({
    id: t.id,
    timestamp: t.timestamp,
    poNumber: t.poNumber,
    itemCode: t.itemCode,
    description: t.description,
    qty: t.qty,
    binCode: t.binCode,
    lots: t.lots ? t.lots.map((l) => `${l.lotCode}:${l.qty}`).join("|") : "",
    serials: t.serials ? t.serials.join("|") : "",
  }));

  const csv = Papa.unparse(cleaned, {
    columns: [
      "id",
      "timestamp",
      "poNumber",
      "itemCode",
      "description",
      "qty",
      "binCode",
      "lots",
      "serials",
    ],
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 📤 Export Cycle Count transactions as CSV
 */
export function exportCycleCountTxnsCSV(transactions: CycleCountTransaction[], filename = "cycle_count_transactions.csv") {
  if (!transactions || transactions.length === 0) {
    alert("No cycle count transactions to export.");
    return;
  }

  const cleaned = transactions.map((t) => ({
    id: t.id,
    timestamp: t.timestamp,
    binCode: t.binCode,
    itemCode: t.itemCode,
    description: t.description,
    expectedQty: t.expectedQty,
    countedQty: t.countedQty,
    variance: (t.countedQty - t.expectedQty),
  }));

  const csv = Papa.unparse(cleaned, {
    columns: [
      "id",
      "timestamp",
      "binCode",
      "itemCode",
      "description",
      "expectedQty",
      "countedQty",
      "variance",
    ],
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 🧹 Optional utility to merge new CSV uploads with saved session
 */
export function mergeCSVData(oldData: Item[], newData: Item[]): Item[] {
  const merged = newData.map((newItem) => {
    const existing = oldData.find(
      (oldItem) =>
        oldItem.ItemCode === newItem.ItemCode &&
        oldItem.BinCode === newItem.BinCode
    );
    return existing
      ? { ...newItem, CountedQty: existing.CountedQty, Variance: existing.Variance }
      : newItem;
  });
  return merged;
}
