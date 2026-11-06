# Fix: Scan page found no items or bins (2026-11-06)

## Symptom
Scan page: "No matches found for 2992047 (searched 20334 items, 0 bins)". Bins and items
never appeared, even after two earlier fixes.

## Real cause (confirmed on the live server, `GET /api/data/rf_master`)
All 20,334 stored master rows were blank: `ItemCode ""`, `BinCode ""`, `Description ""`,
`ExpectedQty 0`. The master spreadsheet's first column was headed `Item No.` (SAP's own name),
but the importer (`normalizeData` in `src/data/csv-utils.ts`) only recognised an exact
`ItemCode`/`Item`/`SKU` header, so every field came through empty. It still saved one blank row
per spreadsheet line and reported success. The scanner then searched 20,334 empty rows.

The two earlier "fixes" (scanner also searching `rf_master`; cache headers) were reproduced on a
local snapshot, never against the live data, so they did not touch this.

## Changes
- `normalizeData` (master import) now matches headers ignoring case, spaces and punctuation
  (`Item No.`, `Item Number`, `ItemCode`, `SKU`...; `ItemName`/`Description`; `OnHandQty`/`QtyInBin`/
  `ExpectedQty`...) and reads the bin with the same rules as the PO/SO importers
  (`extractBinAndWarehouse`).
- A file with no readable item codes is now rejected with an error that lists the columns it
  found, instead of saving blank rows.
- Quantities with thousands separators (`"1,000"`) now parse as 1000.
- `columnKey` strips all non-alphanumerics (so `Item No.` -> `itemno`); the PO/SO importers
  share it.
- Tests: `src/data/csv-utils.test.ts` (SAP `Item No.` header, blank-file rejection, `1,000`).

## How the master sheet was rebuilt (SAP Query Generator)
Columns: `ItemCode, Description, BinCode, ExpectedQty, Warehouse`. One row per active item per
real (non-system) bin; items with no real-bin stock get one row with a blank bin and qty 0.
Filters: active items only (`frozenFor='N' AND validFor='Y'`), no `-SUB` parts, and only items
with movement in the last 4 years (`OINM`), or stock/open orders (`OITW`), or created in the last
4 years. Result: 20,158 rows / 17,824 items (was ~62,800 active items).

```sql
-- Select
T2.ItemCode AS ItemCode, T2.ItemName AS Description, ISNULL(T0.BinCode,'') AS BinCode,
ISNULL(T0.OnHandQty,0) AS ExpectedQty, ISNULL(T0.WhsCode,'') AS Warehouse
-- From
dbo.OITM T2 LEFT JOIN (SELECT Q.ItemCode,B.BinCode,B.WhsCode,Q.OnHandQty FROM dbo.OIBQ Q
  JOIN dbo.OBIN B ON B.AbsEntry=Q.BinAbs WHERE B.SysBin='N') T0 ON T0.ItemCode=T2.ItemCode
-- Where
T2.frozenFor='N' AND T2.validFor='Y' AND T2.ItemCode NOT LIKE '%-SUB'
AND (EXISTS (SELECT 1 FROM OINM M WHERE M.ItemCode=T2.ItemCode AND M.DocDate>=DATEADD(YEAR,-4,GETDATE()))
  OR EXISTS (SELECT 1 FROM OITW W WHERE W.ItemCode=T2.ItemCode AND (W.OnHand>0 OR W.OnOrder>0 OR W.IsCommited>0))
  OR T2.CreateDate>=DATEADD(YEAR,-4,GETDATE()))
-- Sort By
T2.ItemCode, T0.BinCode
```

Upload: Settings -> Master Inventory -> Upload / Replace Master (replaces `rf_master`, `rf_active`,
`rf_bins`; any counted quantities in `rf_active` are lost).

## Still open
- Scan page text "on this device" is stale (data comes from the server).
- 157 rows sit in the `01-XXX` placeholder bin; decide whether to exclude it in the SAP query.
- Items whose only stock is in the system bin show a blank bin and qty 0.
