import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Item, PurchaseOrder, POItem, SalesOrder, SOItem, ReceivingTransaction, CycleCountTransaction } from "../types";

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

/**
 * 📥 Parse Purchase Order CSV or XLSX file
 * Expected columns:
 * poNumber, vendor, expectedDate, ItemCode, Description, OrderedQty, ReceivedQty (optional), BinCode (optional)
 * 
 * Automatically groups rows by poNumber into single PO objects
 */
export async function parsePOFile(file: File): Promise<PurchaseOrder[]> {
  const fileName = file.name.toLowerCase();
  
  // Check if it's an Excel file
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parsePOExcel(file);
  }
  
  // Default to CSV parsing
  return parsePOCSV(file);
}

/**
 * Parse PO CSV file using PapaParse
 */
async function parsePOCSV(file: File): Promise<PurchaseOrder[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = normalizePOData(results.data);
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
 * Parse PO Excel file using SheetJS (xlsx)
 */
async function parsePOExcel(file: File): Promise<PurchaseOrder[]> {
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
        
        // Get the first worksheet (or look for "PO_Lines" sheet)
        let sheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('po') || name.toLowerCase().includes('purchase')
        ) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
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
        
        const normalizedData = normalizePOData(objects);
        resolve(normalizedData);
      } catch (err) {
        console.error("Error parsing PO Excel file:", err);
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsBinaryString(file);
  });
}

/**
 * Normalize PO data and group by poNumber
 * Supports various column name variations
 */
function normalizePOData(rawData: any[]): PurchaseOrder[] {
  // Group rows by poNumber
  const poMap = new Map<string, {
    poNumber: string;
    vendor: string;
    cardCode: string;
    expectedDate: string;
    items: POItem[];
  }>();

  rawData.forEach((row: any) => {
    // Normalize column names (case-insensitive, various formats)
    // SAP Business One: DocNum
    // Standard formats: poNumber, PONumber, etc.
    const poNumber = (
      row.DocNum ||           // SAP Business One standard
      row.DocEntry ||         // SAP alternative (entry number)
      row.poNumber || 
      row.PONumber || 
      row.po_number || 
      row.PO_Number ||
      row["PO Number"] ||
      row["Purchase Order"] ||
      row.PONum ||
      ""
    ).toString().trim();

    if (!poNumber) {
      console.warn("Skipping row with missing PO Number:", row);
      return;
    }

    // SAP Business One: CardName (vendor name) and CardCode (vendor code)
    const vendorName = (
      row.CardName ||         // SAP Business One: Vendor Name
      row.vendor || 
      row.Vendor || 
      row.VendorName ||
      row["Vendor Name"] ||
      row.supplier ||
      row.Supplier ||
      ""
    ).toString().trim();

    const cardCode = (
      row.CardCode ||         // SAP Business One: Vendor Code
      row.cardCode ||
      row.card_code ||
      row.VendorCode ||
      row.vendor_code ||
      ""
    ).toString().trim();

    // Prefer vendor name, fallback to card code if no name
    const vendor = vendorName || cardCode || "Unknown Vendor";

    // Parse date - support various formats
    // SAP Business One: ReqDate (required/expected date) or DocDueDate (due date)
    let expectedDate = (
      row.ReqDate ||          // SAP Business One: Required Date
      row.DocDueDate ||       // SAP Business One: Document Due Date
      row.DocDate ||          // SAP Business One: Document Date (fallback)
      row.expectedDate || 
      row.ExpectedDate || 
      row.expected_date ||
      row["Expected Date"] ||
      row.dueDate ||
      row.DueDate ||
      ""
    ).toString().trim();

    // Try to parse and format date
    if (expectedDate) {
      const parsed = new Date(expectedDate);
      if (!isNaN(parsed.getTime())) {
        expectedDate = parsed.toISOString().split('T')[0]; // YYYY-MM-DD
      }
    }

    // Create PO if it doesn't exist
    if (!poMap.has(poNumber)) {
      poMap.set(poNumber, {
        poNumber,
        vendor,
        cardCode: cardCode || "",
        expectedDate: expectedDate || new Date().toISOString().split('T')[0],
        items: [],
      });
    }

    const po = poMap.get(poNumber)!;

    // Line number (for sort order)
    const lineNumber = parseInt(
      row.LineNumber ||
      row.LineNum ||
      row.line_number ||
      row["Line Number"] ||
      "0"
    ) || 0;

    // Add item to PO
    // SAP Business One uses ItemCode (standard)
    const itemCode = (
      row.ItemCode ||         // SAP Business One & standard
      row.itemcode || 
      row.item_code || 
      row.Item || 
      row.SKU || 
      row.sku ||
      ""
    ).toString().trim();

    // SAP Business One: Dscription (note: "Dscription" not "Description" - SAP typo!)
    const description = (
      row.Dscription ||       // SAP Business One: Description (note the typo in SAP!)
      row.Description || 
      row.description || 
      row.desc || 
      row.ItemName ||
      row.Item_Name ||
      ""
    ).toString().trim();

    // SAP Business One: Quantity (ordered qty), OpenQty (remaining to receive)
    // ReceivedQty = Quantity - OpenQty
    const orderedQty = parseFloat(
      row.Quantity ||         // SAP Business One: Ordered Quantity
      row.OrderedQty || 
      row.orderedqty || 
      row.ordered_qty || 
      row.quantity ||
      row.Qty || 
      row.qty ||
      "0"
    ) || 0;

    const openQty = parseFloat(
      row.OpenQty ||          // SAP Business One: Open Quantity (remaining to receive)
      row.OpenQuantity ||
      "0"
    ) || 0;

    // Calculate received quantity: Ordered - Open
    // If ReceivedQty is explicitly provided, use it; otherwise calculate from OpenQty
    const receivedQty = row.ReceivedQty !== undefined && row.ReceivedQty !== ""
      ? parseFloat(row.ReceivedQty) || 0
      : orderedQty > 0 && openQty >= 0
        ? orderedQty - openQty  // Calculate: Ordered - Open = Received
        : 0;

    // SAP Business One: WhsCode (warehouse code) - bin location might be in separate table
    // For now, use standard bin code fields
    const binCode = (
      row.BinCode || 
      row.bincode || 
      row.bin_code || 
      row.Bin || 
      row.PutawayLocation ||
      row.WhsCode ||          // SAP Business One: Warehouse Code (if used as bin)
      ""
    ).toString().trim() || undefined;

    if (itemCode && orderedQty > 0) {
      po.items.push({
        LineNumber: lineNumber,
        ItemCode: itemCode,
        Description: description || itemCode,
        OrderedQty: orderedQty,
        ReceivedQty: receivedQty,
        RemainingQty: orderedQty - receivedQty, // Auto-calculate remaining qty
        BinCode: binCode,
      });
    }
  });

  // Convert to PurchaseOrder array with unique IDs
  const purchaseOrders: PurchaseOrder[] = Array.from(poMap.values()).map((po, index) => {
    // Sort items by line number
    po.items.sort((a, b) => (a.LineNumber || 0) - (b.LineNumber || 0));

    return {
      id: `po-${Date.now()}-${index}`,
      poNumber: po.poNumber,
      vendor: po.vendor,
      cardCode: po.cardCode || undefined,
      items: po.items,
      status: po.items.every(item => item.ReceivedQty >= item.OrderedQty) 
        ? "completed" 
        : po.items.some(item => item.ReceivedQty > 0) 
          ? "receiving" 
          : "pending",
      expectedDate: po.expectedDate,
    };
  });

  return purchaseOrders;
}

/**
 * 📥 Parse Sales Order CSV or XLSX file
 * Expected columns:
 * soNumber, customer, CardCode, LineNumber, ItemCode, Description, OrderedQty, DeliveredQty, BinCode
 * 
 * Supports multiple sales orders in one file, separated by blank lines
 * Automatically groups rows by soNumber into single SO objects
 */
export async function parseSalesOrderFile(file: File): Promise<SalesOrder[]> {
  const fileName = file.name.toLowerCase();
  
  // Check if it's an Excel file
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseSOExcel(file);
  }
  
  // Default to CSV parsing
  return parseSOCSV(file);
}

/**
 * Parse Sales Order CSV file using PapaParse
 * Uses skipEmptyLines: false to detect blank line separators
 */
async function parseSOCSV(file: File): Promise<SalesOrder[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true, // Skip blank lines (they're just separators)
      complete: (results) => {
        try {
          const data = normalizeSOData(results.data);
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
 * Parse Sales Order Excel file using SheetJS (xlsx)
 */
async function parseSOExcel(file: File): Promise<SalesOrder[]> {
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
        
        // Get the first worksheet (or look for "SO" sheet)
        let sheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('so') || 
          name.toLowerCase().includes('sales') ||
          name.toLowerCase().includes('order')
        ) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
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
        
        const normalizedData = normalizeSOData(objects);
        resolve(normalizedData);
      } catch (err) {
        console.error("Error parsing Sales Order Excel file:", err);
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsBinaryString(file);
  });
}

/**
 * Normalize Sales Order data and group by soNumber
 * Supports various column name variations
 */
function normalizeSOData(rawData: any[]): SalesOrder[] {
  // Group rows by soNumber
  const soMap = new Map<string, {
    soNumber: string;
    customer: string;
    cardCode: string;
    items: SOItem[];
  }>();

  rawData.forEach((row: any) => {
    // Normalize SO Number column
    // SAP Business One: DocNum or DocEntry
    const soNumber = (
      row.soNumber || 
      row.SONumber || 
      row.so_number || 
      row["SO Number"] ||
      row.DocNum ||           // SAP Business One standard
      row.DocEntry ||         // SAP alternative
      row.OrderNumber ||
      row["Order Number"] ||
      ""
    ).toString().trim();

    if (!soNumber) {
      console.warn("Skipping row with missing SO Number:", row);
      return;
    }

    // Customer name
    // SAP Business One: CardName (customer name)
    const customer = (
      row.customer || 
      row.Customer || 
      row.CustomerName ||
      row["Customer Name"] ||
      row.CardName ||         // SAP Business One: Customer Name
      ""
    ).toString().trim();

    // Customer code
    // SAP Business One: CardCode (customer code)
    const cardCode = (
      row.CardCode ||         // SAP Business One: Customer Code
      row.cardCode ||
      row.card_code ||
      row.CustomerCode ||
      row.customer_code ||
      ""
    ).toString().trim();

    // Create SO if it doesn't exist
    if (!soMap.has(soNumber)) {
      soMap.set(soNumber, {
        soNumber,
        customer: customer || "Unknown Customer",
        cardCode: cardCode || "",
        items: [],
      });
    }

    const so = soMap.get(soNumber)!;

    // Line number (for sort order)
    const lineNumber = parseInt(
      row.LineNumber ||
      row.LineNum ||
      row.line_number ||
      row["Line Number"] ||
      "0"
    ) || 0;

    // Item code
    // SAP Business One uses ItemCode (standard)
    const itemCode = (
      row.ItemCode ||         // SAP Business One & standard
      row.itemcode || 
      row.item_code || 
      row.Item || 
      row.SKU || 
      row.sku ||
      ""
    ).toString().trim();

    // Description
    // SAP Business One: Dscription (note the typo in SAP!)
    const description = (
      row.Description ||
      row.Dscription ||       // SAP Business One: Description (with typo)
      row.description || 
      row.desc || 
      row.ItemName ||
      row.Item_Name ||
      ""
    ).toString().trim();

    // Ordered quantity
    // SAP Business One: Quantity
    const orderedQty = parseFloat(
      row.OrderedQty || 
      row.Quantity ||         // SAP Business One
      row.orderedqty || 
      row.ordered_qty || 
      row.quantity ||
      row.Qty || 
      row.qty ||
      "0"
    ) || 0;

    // Delivered/shipped quantity
    // SAP Business One: DelivrdQty (delivered quantity)
    const deliveredQty = parseFloat(
      row.DeliveredQty ||
      row.DelivrdQty ||       // SAP Business One: Delivered Quantity
      row.deliveredqty || 
      row.delivered_qty ||
      row.ShippedQty ||
      row.shipped_qty ||
      "0"
    ) || 0;

    // Bin code (suggested pick location)
    const binCode = (
      row.BinCode || 
      row.bincode || 
      row.bin_code || 
      row.Bin || 
      row.PickLocation ||
      row.WhsCode ||          // SAP Business One: Warehouse Code
      ""
    ).toString().trim() || undefined;

    if (itemCode && orderedQty > 0) {
      so.items.push({
        LineNumber: lineNumber,
        ItemCode: itemCode,
        Description: description || itemCode,
        OrderedQty: orderedQty,
        DeliveredQty: deliveredQty,
        RemainingQty: orderedQty - deliveredQty,
        BinCode: binCode,
      });
    }
  });

  // Convert to SalesOrder array with unique IDs
  const salesOrders: SalesOrder[] = Array.from(soMap.values()).map((so, index) => {
    // Sort items by line number
    so.items.sort((a, b) => a.LineNumber - b.LineNumber);

    return {
      id: `so-${Date.now()}-${index}`,
      soNumber: so.soNumber,
      customer: so.customer,
      cardCode: so.cardCode,
      items: so.items,
      status: so.items.every(item => item.DeliveredQty >= item.OrderedQty) 
        ? "shipped" 
        : so.items.some(item => item.DeliveredQty > 0) 
          ? "picking" 
          : "pending",
      createdDate: new Date().toISOString().split('T')[0],
    };
  });

  return salesOrders;
}
