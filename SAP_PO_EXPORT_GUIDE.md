# 📦 SAP Business One Purchase Order Export Guide

## Overview

Your RF Warehouse Management System now supports **SAP Business One** native column names! When exporting Purchase Orders from SAP, you can use the exact column names from your SAP database.

---

## ✅ **SAP Business One Column Names**

When exporting from SAP (OPOR + POR1 tables), your export should include these columns:

### **Required Columns:**

| SAP Column Name | Description | Example | Alternative Names Accepted |
|----------------|-------------|---------|----------------------------|
| **DocNum** | Purchase Order Number | `12345` | `poNumber`, `PONumber`, `DocEntry` |
| **CardName** | Vendor Name | `Tech Supplies Inc.` | `CardCode`, `vendor`, `Vendor` |
| **ReqDate** | Required/Expected Date | `2025-11-01` | `DocDueDate`, `DocDate`, `expectedDate` |
| **ItemCode** | Item/SKU Code | `MOUSE-001` | `itemcode`, `SKU`, `Item` |
| **Dscription** | Item Description | `Wireless Mouse` | `Description` (note: SAP uses "Dscription"!) |
| **Quantity** | Ordered Quantity | `50` | `OrderedQty`, `Qty`, `quantity` |

### **Optional Columns (Auto-Calculated if Available):**

| SAP Column Name | Description | How It's Used |
|----------------|-------------|---------------|
| **OpenQty** | Open/Remaining Quantity | Auto-calculates: `ReceivedQty = Quantity - OpenQty` |
| **WhsCode** | Warehouse Code | Can be used as bin location if needed |
| **ReceivedQty** | Received Quantity | If provided, used directly; otherwise calculated from OpenQty |

---

## 🔄 **SAP Query for PO Export**

If you're querying SAP directly, use this SQL to export PO data:

```sql
SELECT 
    OP.DocNum AS DocNum,              -- PO Number
    OP.CardName AS CardName,          -- Vendor Name
    OP.ReqDate AS ReqDate,            -- Expected Date
    PL.ItemCode AS ItemCode,          -- Item Code
    PL.Dscription AS Dscription,      -- Description
    PL.Quantity AS Quantity,          -- Ordered Qty
    PL.OpenQty AS OpenQty,            -- Remaining to receive
    PL.WhsCode AS WhsCode             -- Warehouse (optional)
FROM OPOR OP
INNER JOIN POR1 PL ON OP.DocEntry = PL.DocEntry
WHERE OP.DocStatus = 'O'              -- Open POs only
  AND OP.CANCELED = 'N'               -- Not cancelled
  AND PL.OpenQty > 0                  -- Has items to receive
ORDER BY OP.DocNum, PL.LineNum;
```

---

## 📋 **SAP Export Format Examples**

### **Option 1: Basic SAP Export (Minimum Required)**

```csv
DocNum,CardName,ReqDate,ItemCode,Dscription,Quantity
12345,Tech Supplies Inc.,2025-11-01,MOUSE-001,Wireless Mouse,50
12345,Tech Supplies Inc.,2025-11-01,KEYB-001,Mechanical Keyboard,30
12346,Office Essentials Co.,2025-11-03,DESK-001,Standing Desk,15
```

**Result:** System will:
- Create PO #12345 with 2 items
- Create PO #12346 with 1 item
- Set `ReceivedQty = 0` (assuming all items still need to be received)

### **Option 2: SAP Export with OpenQty (Recommended)**

```csv
DocNum,CardName,ReqDate,ItemCode,Dscription,Quantity,OpenQty
12345,Tech Supplies Inc.,2025-11-01,MOUSE-001,Wireless Mouse,50,50
12345,Tech Supplies Inc.,2025-11-01,KEYB-001,Mechanical Keyboard,30,30
12346,Office Essentials Co.,2025-11-03,DESK-001,Standing Desk,15,5
```

**Result:** System will:
- Calculate `ReceivedQty` automatically:
  - MOUSE-001: `ReceivedQty = 50 - 50 = 0` (none received)
  - KEYB-001: `ReceivedQty = 30 - 30 = 0` (none received)
  - DESK-001: `ReceivedQty = 15 - 5 = 10` (10 already received!)

### **Option 3: SAP Export with Partial Receipt**

```csv
DocNum,CardName,ReqDate,ItemCode,Dscription,Quantity,OpenQty,WhsCode
12345,Tech Supplies Inc.,2025-11-01,MOUSE-001,Wireless Mouse,50,20,01
12345,Tech Supplies Inc.,2025-11-01,KEYB-001,Mechanical Keyboard,30,0,01
```

**Result:** System will:
- MOUSE-001: `ReceivedQty = 50 - 20 = 30` (30 received, 20 remaining)
- KEYB-001: `ReceivedQty = 30 - 0 = 30` (fully received!)

---

## 🔧 **Smart Column Recognition**

The system automatically recognizes these SAP column variations:

### **PO Number:**
- ✅ `DocNum` (SAP primary)
- ✅ `DocEntry` (SAP entry number)
- ✅ `poNumber`, `PONumber` (standard formats)

### **Vendor:**
- ✅ `CardName` (SAP: Vendor Name) - **Preferred**
- ✅ `CardCode` (SAP: Vendor Code)
- ✅ `vendor`, `Vendor` (standard formats)

### **Expected Date:**
- ✅ `ReqDate` (SAP: Required Date) - **Preferred**
- ✅ `DocDueDate` (SAP: Document Due Date)
- ✅ `DocDate` (SAP: Document Date - fallback)
- ✅ `expectedDate`, `ExpectedDate` (standard formats)

### **Item Code:**
- ✅ `ItemCode` (SAP & standard)

### **Description:**
- ✅ `Dscription` (SAP - note the typo!) - **Recognized first**
- ✅ `Description` (standard spelling)

### **Quantity:**
- ✅ `Quantity` (SAP: Ordered Quantity)
- ✅ `OrderedQty` (standard format)
- ✅ `OpenQty` (SAP: Remaining to receive) - **Auto-calculates received**

### **Received Quantity:**
- ✅ `ReceivedQty` (if explicitly provided)
- ✅ **Auto-calculated** from `Quantity - OpenQty` when OpenQty is present

---

## 📊 **What Happens During Import**

1. **File Upload** → System reads CSV/XLSX
2. **Column Mapping** → Recognizes SAP column names automatically
3. **PO Grouping** → Rows with same `DocNum` grouped into single PO
4. **Received Qty Calculation** → If `OpenQty` exists: `ReceivedQty = Quantity - OpenQty`
5. **Status Detection** → Auto-sets status: `pending`, `receiving`, or `completed`
6. **Save** → Stores in `localStorage['rf_purchase_orders']`

---

## ✅ **SAP Export Checklist**

Before exporting from SAP, ensure:

- [ ] Export includes **one row per line item**
- [ ] All rows with same `DocNum` belong to same PO
- [ ] `DocNum` column is included (required!)
- [ ] `CardName` or `CardCode` included (vendor info)
- [ ] `ReqDate` or `DocDueDate` included (expected date)
- [ ] `ItemCode` included for each line
- [ ] `Quantity` included (ordered quantity)
- [ ] **Recommended:** Include `OpenQty` for accurate received quantities

---

## 🎯 **Quick Reference**

**Minimum SAP Export (Works!):**
```
DocNum, CardName, ReqDate, ItemCode, Dscription, Quantity
```

**Recommended SAP Export (Better!):**
```
DocNum, CardName, ReqDate, ItemCode, Dscription, Quantity, OpenQty
```

**Full SAP Export (Best!):**
```
DocNum, CardName, ReqDate, ItemCode, Dscription, Quantity, OpenQty, WhsCode
```

---

## 💡 **Tips**

1. **Filter Active POs:** Export only `DocStatus = 'O'` (Open) and `CANCELED = 'N'` (Not Cancelled)
2. **Filter by Date:** Add `WHERE OP.ReqDate >= '2025-01-01'` to get recent POs
3. **Multiple Warehouses:** Include `WhsCode` if you need warehouse-specific data
4. **Partial Receipts:** Including `OpenQty` ensures accurate received quantity calculation

---

## 🔍 **Example SAP Export Query (Complete)**

```sql
-- Export all open Purchase Orders ready for receiving
SELECT 
    OP.DocNum,
    OP.CardName,
    OP.ReqDate,
    PL.ItemCode,
    PL.Dscription,
    PL.Quantity,
    PL.OpenQty,
    PL.WhsCode,
    CASE 
        WHEN PL.OpenQty = 0 THEN PL.Quantity  -- Fully received
        ELSE PL.Quantity - PL.OpenQty           -- Partially received
    END AS ReceivedQty
FROM OPOR OP
INNER JOIN POR1 PL ON OP.DocEntry = PL.DocEntry
WHERE OP.DocStatus = 'O'              -- Open status
  AND OP.CANCELED = 'N'               -- Not cancelled
  AND PL.OpenQty >= 0                 -- Has items (or fully received)
  AND PL.Quantity > 0                 -- Has quantity ordered
ORDER BY OP.DocNum, PL.LineNum;
```

This query will export everything ready for your RF scanner! 🎉

---

**Your system is now fully compatible with SAP Business One exports!** Just export using SAP's native column names and upload directly. No manual column renaming needed! ✅

