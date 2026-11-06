# Phase 3 + 4 notes: SAP import fidelity, receiving and picking correctness

Tasks 11 and 12. Branch `phase-3-4-line-identity` (stacks on PR #11, the master-import fix).

## What an order line is now
- Order id = `po-<DocNum>` / `so-<DocNum>`. Never time-based, so the same SAP document is the same record on every device and every import.
- Line key = `<DocNum>:<LineNumber>` (SAP's own line number). Receive, pick, assign-bin address a line by this key. A position (`lineIndex`) is accepted only for orders imported before keys existed; on a keyed line it is refused (`409 LINE_KEY_REQUIRED`) because the position may have moved.
- Warehouse (normalised: `5` -> `05`) and BinCode are separate fields.

## Import (task 11)
- Real exports read: headers are `Document Number`, `Item No.`, `Remaining Open Quantity`, `Customer/Vendor Code`... (not the DocNum/OpenQty names in the old guides). Aliases for both spellings are accepted; see `src/data/sap-import.ts`.
- Excel date serials, `yyyymmdd`, ISO, unambiguous d/m/y and month names parse; anything else is reported as a warning and the date is left blank.
- Quantities accept `1,000`, `1 000`, `1.234,50`, `2,5`; text like `abc` makes the row skipped with a reason.
- Files with no readable order numbers or item codes are rejected, listing the columns found. Every import shows a report: rows read, orders, lines accepted, rows skipped and why, warnings.
- Re-import (`POST /api/imports/orders`, runs under the file lock): new orders are added, existing ones updated. Open quantity comes from SAP; received/delivered history is kept (`max(app total, SAP-derived)`). Lines missing from the new file are flagged `SapClosed` (not deleted) and cannot be received/picked. A pick/receipt and an import at the same moment both survive. Same file on two devices at once = each order once.
- Legacy time-id orders are matched by DocNum; if that is ambiguous the import reports `LEGACY_ORDER_UNMATCHED` and leaves them alone.

## Receiving and picking (task 12)
All enforced by the server (`server/ops-logic.js`), so a stale or modified screen cannot get around them. A refusal changes nothing.
| Situation | Response |
|---|---|
| Receive more than is open on the line | 409 `OVER_RECEIPT` (`remaining`, `requested`) |
| Pick more than is open | 409 `OVER_PICK` |
| Line no longer in SAP's export | 409 `LINE_CLOSED` |
| Unknown line key | 404 `LINE_NOT_FOUND` |
| Pick without a scanned item / wrong item | 400 `SCAN_REQUIRED` / 409 `SCAN_MISMATCH` (scan compared to the line's ItemCode, case-insensitive) |
| Bin holds less than the pick | 409 `INSUFFICIENT_BIN_STOCK` unless `acceptShortfall: true`; then the bin goes to 0 and `shortfall` is logged. No more silent clamping. |
| Bin not in the system | pick allowed; log says `stockTracked: false` |
| Short pick (`short: {reason}`, qty may be 0) | recorded on the line (`ShortPick`), line stays open, order stays `picking`; cleared when the line is finished |
- Quantities are rounded to 6 decimals so `0.1 + 0.2` fills a line of `0.3`.
- Every pick is logged in `rf_pick_txns` (who, line, qty, bin, warehouse, scan, shortfall, short reason); a retry with the same `txnId` is a no-op. Receipts log the line key, warehouse and user too.
- Two pickers: all pick/receive/ship ops run under per-file locks. Four people racing for 10 units in steps of 4: exactly two land. Different lines of one order: both land.
- Shipping uses `POST /api/ops/so-ship` (status, PIN, date only). Saving a whole PO/SO record (`PUT /api/records/...`, `apply` with upserts, `upsert-many`) is now `409 USE_ORDER_OPERATIONS`; deleting an order still works.

## Verified vs assumed
Verified on the two real exports (PO: 76 orders / 267 lines; SO: 154 orders / 417 lines): parse and report, idempotent re-import, 6 simultaneous imports, picks surviving re-import, receiving/picking by key through the real Express API (`src/data/real-files-e2e.test.ts`, gated by `RF_REAL_PO_XLSX` / `RF_REAL_SO_XLSX`). The real SO has orders with a repeated ItemCode (used); the real PO has none, so "two PO lines with the same item" is covered by synthetic tests only.
Assumed: a blank LineNumber is SAP line 0; the scanned barcode equals the SAP ItemCode (no separate barcode column in the exports); `max()` is the right merge for received/delivered; UI checked in a real browser in demo mode only (same shared logic, not the Express server).
