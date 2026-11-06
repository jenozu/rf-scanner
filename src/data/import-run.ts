/**
 * Importing a SAP order file = read the file in the browser, then let the server merge it.
 * Both import screens (Setup and Receive) use this one function, so they behave the same.
 */
import { importPurchaseOrderFile, importSalesOrderFile, ImportError, type ImportReport } from "./sap-import";
import { importOrders } from "./ops";
import type { ImportResult } from "../../server/order-import.js";

export interface ImportRun {
  kind: "po" | "so";
  report: ImportReport;
  server: ImportResult;
}

export async function runOrderImport(kind: "po" | "so", file: File): Promise<ImportRun> {
  const parsed = kind === "po" ? await importPurchaseOrderFile(file) : await importSalesOrderFile(file);
  const server = await importOrders(kind, parsed.orders as never);
  return { kind, report: parsed.report, server: server as ImportResult };
}

export { ImportError };
