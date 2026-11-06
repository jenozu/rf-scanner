/** Plain-language summary of an import, for the screen. Pure, so it can be tested. */
import type { ImportReport } from "./sap-import";
import type { ImportResult } from "../../server/order-import.js";

export interface ImportSummary {
  /** "success" when everything was read and applied; "attention" when rows were skipped or something needs a person. */
  tone: "success" | "attention";
  headline: string;
  details: string[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function summarizeImport(report: ImportReport, server: ImportResult): ImportSummary {
  const noun = report.kind === "po" ? "purchase order" : "sales order";
  const parts: string[] = [];
  if (server.added) parts.push(`${server.added} new`);
  if (server.updated) parts.push(`${server.updated} updated`);
  if (server.unchanged) parts.push(`${server.unchanged} already up to date`);
  const headline = `Read ${plural(report.ordersFound, noun)} (${plural(report.linesAccepted, "line")}) from ${report.fileName}: ${parts.join(", ") || "nothing to change"}.`;

  const details: string[] = [];
  if (server.updated > 0) {
    const l = server.lines;
    const bits = [l.updated && `${plural(l.updated, "line")} changed`, l.added && `${plural(l.added, "line")} added`,
      l.reopened && `${plural(l.reopened, "line")} listed by SAP again`].filter(Boolean);
    if (bits.length) details.push(`Existing orders: ${bits.join(", ")}. Received/picked quantities were kept.`);
  }
  if (server.lines.closed > 0) {
    details.push(`${plural(server.lines.closed, "line")} no longer in SAP's file ${server.lines.closed === 1 ? "was" : "were"} marked closed (kept, but cannot be ${report.kind === "po" ? "received" : "picked"}).`);
  }
  if (report.skipped.length > 0) details.push(`${plural(report.skipped.length, "row")} could not be imported (listed below).`);
  for (const c of server.conflicts) details.push(`Needs a person: ${c.message}`);
  for (const w of report.warnings) {
    if (w.code === "line-already-complete") continue; // normal for lines SAP has finished; not worth a banner
    details.push(`${w.message}${w.count > 1 ? ` (${w.count} rows)` : w.count === 1 && w.rows.length ? ` (row ${w.rows[0]})` : ""}.`);
  }
  for (const n of server.notes) details.push(n.message);

  const attention = report.skipped.length > 0 || server.conflicts.length > 0;
  return { tone: attention ? "attention" : "success", headline, details };
}
