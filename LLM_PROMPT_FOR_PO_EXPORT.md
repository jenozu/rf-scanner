# 🤖 LLM Prompt: Generate SAP PO Export Script

Copy and paste this entire prompt to ChatGPT, Claude, or any LLM to generate a Python script for exporting Purchase Orders from SAP Business One.

---

## 📋 PROMPT TO GIVE TO LLM:

```
I need a Python script that exports Purchase Order data from SAP Business One database and formats it for import into a warehouse management system.

DATABASE STRUCTURE:
- SAP Business One database
- Purchase Order Header Table: OPOR
- Purchase Order Lines Table: POR1
- Join: OPOR.DocEntry = POR1.DocEntry

REQUIRED OUTPUT COLUMNS:
The exported CSV/XLSX file must have these exact column names (in this order):
1. DocNum - Purchase Order Number (from OPOR.DocNum)
2. CardName - Vendor Name (from OPOR.CardName)
3. ReqDate - Expected/Required Date (from OPOR.ReqDate)
4. ItemCode - Item/SKU Code (from POR1.ItemCode)
5. Dscription - Item Description (from POR1.Dscription - note the spelling, it's "Dscription" not "Description")
6. Quantity - Ordered Quantity (from POR1.Quantity)
7. OpenQty - Open/Remaining Quantity (from POR1.OpenQty) - REQUIRED for accurate received qty calculation

REQUIREMENTS:
1. Export format: CSV or XLSX (user choice via parameter)
2. Only export OPEN Purchase Orders: WHERE OPOR.DocStatus = 'O' AND OPOR.CANCELED = 'N'
3. Only export lines with quantity: WHERE POR1.Quantity > 0
4. One row per PO line item (multiple rows per PO if it has multiple items)
5. Sort by: DocNum, then LineNum
6. Handle date formatting: Convert dates to YYYY-MM-DD format
7. Handle NULL values: Replace NULL with appropriate defaults (0 for numbers, empty string for text)

DATABASE CONNECTION:
- Use pyodbc or similar
- Support SQL Server connection string (similar to standard SAP B1 connections)
- Include connection error handling

OUTPUT FILE:
- Default filename: po_export_YYYYMMDD_HHMMSS.csv (or .xlsx)
- Include timestamp in filename
- Save to current directory or allow user to specify output path

ADDITIONAL FEATURES:
1. Add command-line arguments:
   - --format (csv or xlsx, default: csv)
   - --output (output file path, optional)
   - --po-number (filter by specific PO number, optional)
   - --vendor (filter by vendor code/name, optional)
   - --date-from (filter POs from this date, optional)
   - --date-to (filter POs to this date, optional)

2. Print summary statistics:
   - Total POs exported
   - Total line items
   - Total ordered quantity
   - Date range of exported POs

3. Error handling:
   - Database connection errors
   - SQL execution errors
   - File write errors

4. Include a .env file support for database credentials (DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD)

Please generate a complete, production-ready Python script with:
- Proper error handling
- Clear comments
- Type hints where appropriate
- Requirements.txt file
- README with usage instructions
```

---

## 📝 Alternative: More Detailed Technical Prompt

If you want more control, use this version:

```
Create a Python script that exports Purchase Order data from SAP Business One database to CSV/XLSX format.

TECHNICAL SPECIFICATIONS:

DATABASE:
- Type: SQL Server (SAP Business One)
- Connection: pyodbc
- Tables: OPOR (header), POR1 (lines)

SQL QUERY STRUCTURE:
SELECT 
    OP.DocNum AS DocNum,
    OP.CardName AS CardName,
    OP.ReqDate AS ReqDate,
    PL.ItemCode AS ItemCode,
    PL.Dscription AS Dscription,
    PL.Quantity AS Quantity,
    PL.OpenQty AS OpenQty
FROM OPOR OP
INNER JOIN POR1 PL ON OP.DocEntry = PL.DocEntry
WHERE OP.DocStatus = 'O'
  AND OP.CANCELED = 'N'
  AND PL.Quantity > 0
ORDER BY OP.DocNum, PL.LineNum

OUTPUT FORMAT:
- CSV or XLSX (user choice)
- Column order: DocNum, CardName, ReqDate, ItemCode, Dscription, Quantity, OpenQty
- Header row required
- Date format: YYYY-MM-DD
- Numeric values: No formatting, raw numbers
- Handle NULL: 0 for numbers, '' for strings

FEATURES:
1. Command-line interface with argparse
2. Environment variable support (.env file)
3. Logging (console output)
4. Progress indicators for large exports
5. Validation of output file
6. Error handling with clear messages

DEPENDENCIES:
- pyodbc
- pandas (for Excel export)
- python-dotenv (for .env support)

Generate the complete script with all features listed.
```

---

## 🎯 Quick Copy-Paste Version (Simplest)

```
Generate a Python script that:
1. Connects to SAP Business One database (SQL Server via pyodbc)
2. Queries Purchase Orders: OPOR table (header) joined with POR1 table (lines)
3. Exports to CSV/XLSX with columns: DocNum, CardName, ReqDate, ItemCode, Dscription, Quantity, OpenQty
4. Filters: Only open POs (DocStatus='O', CANCELED='N')
5. Includes command-line args for format (csv/xlsx) and output file path
6. Uses .env file for database credentials
7. Includes error handling and logging
```

---

## 📚 What the LLM Should Generate

The LLM should create:
1. ✅ `export_po.py` - Main script
2. ✅ `requirements.txt` - Dependencies
3. ✅ `.env.example` - Example environment file
4. ✅ `README.md` - Usage instructions

Use any of the prompts above - they're all designed to get you a working script! 🚀

