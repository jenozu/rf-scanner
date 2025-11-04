# 📦 SAP PO Export Script - Usage Guide

## Quick Start

### 1. Install Dependencies

```bash
pip install -r export_po_requirements.txt
```

### 2. Configure Database Connection

Create a `.env` file in the same directory:

```env
DB_SERVER=your_sap_server
DB_NAME=SBO_DEMO_US
DB_USER=sa
DB_PASSWORD=your_password
DB_DRIVER={ODBC Driver 17 for SQL Server}
```

### 3. Run the Script

**Basic Export (all open POs):**
```bash
python export_po_from_sap.py --format csv
```

**Export to Excel:**
```bash
python export_po_from_sap.py --format xlsx --output my_po_export.xlsx
```

**Filter by PO Number:**
```bash
python export_po_from_sap.py --po-number 12345
```

**Filter by Vendor:**
```bash
python export_po_from_sap.py --vendor "Tech Supplies"
```

**Filter by Date Range:**
```bash
python export_po_from_sap.py --date-from 2025-01-01 --date-to 2025-12-31
```

**Combine Filters:**
```bash
python export_po_from_sap.py --format xlsx --vendor "Tech Supplies" --date-from 2025-11-01
```

## Output Format

The script exports these columns (in order):
1. **DocNum** - Purchase Order Number
2. **CardName** - Vendor Name
3. **ReqDate** - Expected Date (YYYY-MM-DD)
4. **ItemCode** - Item/SKU Code
5. **Dscription** - Item Description
6. **Quantity** - Ordered Quantity
7. **OpenQty** - Remaining to Receive

## Output File

- Default filename: `po_export_YYYYMMDD_HHMMSS.csv` (or `.xlsx`)
- Includes timestamp to prevent overwriting
- Can specify custom path with `--output` option

## Summary Statistics

After export, the script displays:
- Total number of POs
- Total line items
- Total ordered quantity
- Total remaining quantity (OpenQty)
- Total received (calculated: Quantity - OpenQty)
- Date range of exported POs

## Error Handling

The script handles:
- Database connection errors
- SQL query errors
- File write errors
- Missing data/null values

## Next Steps

1. Export your POs using this script
2. Go to RF Warehouse Management System
3. Navigate to **Receive** page
4. Click **"Upload PO File"**
5. Select your exported CSV/XLSX file
6. POs will appear ready for receiving! 🎉

---

**Note:** This script only exports **OPEN** Purchase Orders (`DocStatus = 'O'` and `CANCELED = 'N'`) with items that have `Quantity > 0`.

