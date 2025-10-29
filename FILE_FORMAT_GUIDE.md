# Inventory File Upload Guide

## Supported File Formats

Your RF Scanner app now supports:
- ✅ **CSV** (.csv)
- ✅ **Excel** (.xlsx, .xls)

You can use either format - the app will automatically detect and parse it correctly!

## Required Columns

Your file must have these 4 columns (column names are flexible):

| Column Name | Alternative Names | Description | Example |
|-------------|------------------|-------------|---------|
| **BinCode** | Bin, bin_code, bincode | Location code in warehouse | A-01-A, BIN-123 |
| **ItemCode** | Item, item_code, itemcode, SKU | Unique item identifier | ITEM-001, SKU12345 |
| **Description** | description, desc, Name | Item description | "Blue Widget 5mm" |
| **ExpectedQty** | Quantity, Qty, expected_qty, expectedqty | Expected quantity in stock | 100, 25.5 |

## Example File Structure

### CSV Format
```csv
BinCode,ItemCode,Description,ExpectedQty
A-01-A,ITEM-001,Blue Widget 5mm,100
A-01-B,ITEM-002,Red Gadget 10mm,50
B-02-C,ITEM-003,Green Tool Large,25
```

### Excel Format (.xlsx)

**Standard Format:**
| BinCode | ItemCode | Description | ExpectedQty |
|---------|----------|-------------|-------------|
| A-01-A  | ITEM-001 | Blue Widget 5mm | 100 |
| A-01-B  | ITEM-002 | Red Gadget 10mm | 50 |
| B-02-C  | ITEM-003 | Green Tool Large | 25 |

**SAP Export Format (also supported):**
| Warehouse | BinCode | ItemCode | ItemName | QtyInBin |
|-----------|---------|----------|----------|----------|
| 01        | 01-0002 | 4252237-DTZ | PROFILE WASHER | 4 |
| 01        | 01-0004 | 1182349-DTZ | O-SEAL | 1 |
| 01        | 01-0006 | 2992038-DTZ | LOCATING TOOL | 0 |

> **Note:** The `Warehouse` column is optional and will be ignored if present.

## Flexible Column Names

The app is smart and will automatically recognize these variations:

**BinCode alternatives:**
- BinCode, Bin, bin_code, bincode, BIN

**ItemCode alternatives:**
- ItemCode, Item, item_code, itemcode, SKU, sku

**Description alternatives:**
- Description, description, desc, Name, name, **ItemName** (SAP), itemname, item_name

**ExpectedQty alternatives:**
- ExpectedQty, Quantity, Qty, expected_qty, expectedqty, **QtyInBin** (SAP), qtyinbin, qty_in_bin, OnHandQty, onhandqty

**Note:** Column names in **bold** are commonly used in SAP Business One exports.

## Tips for Best Results

1. **First row should be headers** - Column names should be in the first row
2. **No empty rows** - Remove any blank rows from your file
3. **Consistent formatting** - Keep data types consistent (numbers as numbers, text as text)
4. **Clean data** - Remove any special characters or formatting that might cause issues
5. **Single worksheet** - For Excel files, data should be in the first worksheet

## How to Upload

1. Go to the **Setup** page (or click "Clear All Data" from Settings)
2. Click on **"Upload Inventory File (CSV or Excel)"**
3. Select your `.csv`, `.xlsx`, or `.xls` file
4. Wait for the file to parse (you'll see a success message)
5. The app will automatically load your inventory data!

## Troubleshooting

**Error: "Error reading file"**
- Check that your file has the required columns
- Verify the file isn't corrupted
- Try saving as CSV if using Excel

**Data looks wrong**
- Check column names match the required format
- Ensure quantities are numbers (not text)
- Remove any extra columns that might be confusing the parser

**Nothing happens**
- Check browser console for errors (F12)
- Verify file size isn't too large (recommend under 10MB)
- Try a different browser

## Converting Your File

### From Excel to CSV (if needed):
1. Open your Excel file
2. Click **File → Save As**
3. Choose **CSV (Comma delimited) (*.csv)** as the file type
4. Save and upload!

### From Other Formats:
- Most spreadsheet programs (Google Sheets, LibreOffice) can export to CSV or Excel
- Make sure to preserve the column structure

---

**Need help?** Check that your file structure matches the examples above, and ensure all required columns are present with valid data.

