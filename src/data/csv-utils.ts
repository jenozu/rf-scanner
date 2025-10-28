import Papa from "papaparse";
import { Item } from "../types";

/**
 * 📥 Parse CSV file and return structured data
 * Expected columns:
 * BinCode, ItemCode, Description, ExpectedQty
 */
export async function parseCSV(file: File): Promise<Item[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data.map((row: any) => ({
            BinCode: (row.BinCode || "").trim(),
            ItemCode: (row.ItemCode || "").trim(),
            Description: (row.Description || "").trim(),
            ExpectedQty: parseFloat(row.ExpectedQty || "0") || 0,
            CountedQty: 0,
            Variance: 0,
          }));
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
