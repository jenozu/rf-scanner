import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Item } from "../types";

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
function normalizeData(rawData: any[]): Item[] {
  return rawData.map((row: any) => {
    const item: Item = {
      BinCode: (
        row.BinCode || 
        row.bincode || 
        row.bin_code || 
        row.Bin || 
        row.BIN || 
        ""
      ).toString().trim(),
      
      ItemCode: (
        row.ItemCode || 
        row.itemcode || 
        row.item_code || 
        row.Item || 
        row.SKU || 
        row.sku || 
        ""
      ).toString().trim(),
      
      Description: (
        row.Description || 
        row.description || 
        row.desc || 
        row.Name || 
        row.name || 
        row.ItemName ||  // SAP export column
        row.itemname ||
        row.item_name ||
        ""
      ).toString().trim(),
      
      ExpectedQty: parseFloat(
        row.ExpectedQty || 
        row.expectedqty || 
        row.expected_qty || 
        row.Quantity || 
        row.quantity ||
        row.Qty || 
        row.qty ||
        row.QtyInBin ||  // SAP export column
        row.qtyinbin ||
        row.qty_in_bin ||
        row.OnHandQty ||
        row.onhandqty ||
        "0"
      ) || 0,
    };

    // If CountedQty exists in the source data (re-importing counted data), preserve it
    if (row.CountedQty !== undefined && row.CountedQty !== null && row.CountedQty !== "") {
      const countedQty = parseFloat(row.CountedQty) || 0;
      item.CountedQty = countedQty;
      // Auto-calculate Variance if CountedQty is present
      item.Variance = countedQty - item.ExpectedQty;
    }
    // Otherwise, leave CountedQty and Variance undefined (not yet counted)
    
    return item;
  });
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
