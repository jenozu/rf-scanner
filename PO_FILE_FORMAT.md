# 📦 Purchase Order File Format Guide

## Overview

Your RF Warehouse Management System now supports importing Purchase Orders (POs) directly from CSV or XLSX files! This guide explains the exact format your `master_PO` spreadsheet should follow.

**✅ NEW:** The system now fully supports **SAP Business One** native column names! See `SAP_PO_EXPORT_GUIDE.md` for SAP-specific instructions.

## ✅ **Quick Answer: YES, You Can Upload POs!**

**Your system is now ready to receive orders from CSV/XLSX files!** 

Simply:
1. Format your spreadsheet following the guidelines below
2. Go to **Receive** page → Click "Upload PO File"
3. OR go to **Setup** page → Upload PO file section
4. Select your file and it will automatically parse and import!

---

## 📋 Required File Format

### **File Types Supported:**
- ✅ CSV (`.csv`)
- ✅ Excel (`xlsx`, `.xls`)

### **Sheet Name (for Excel):**
- First sheet will be used automatically
- OR any sheet with "PO" or "Purchase" in the name

---

## 📊 Column Requirements

### **Required Columns (Must Have):**

| Column Name | Description | Example | SAP Equivalent | Notes |
|------------|-------------|---------|----------------|-------|
| **poNumber** | Purchase Order Number | `PO-2025-001` | `DocNum` | Unique identifier for each PO |
| **vendor** | Vendor/Supplier Name | `Tech Supplies Inc.` | `CardName` or `CardCode` | Company name |
| **expectedDate** | Expected Receipt Date | `2025-11-01` | `ReqDate` or `DocDueDate` | Any date format accepted |
| **ItemCode** | SKU/Product Code | `MOUSE-001` | `ItemCode` | Item identifier |
| **Description** | Item Description | `Wireless Mouse` | `Dscription` | Product name (note: SAP uses "Dscription"!) |
| **OrderedQty** | Quantity Ordered | `50` | `Quantity` | Must be a number > 0 |

### **Optional Columns (Nice to Have):**

| Column Name | Description | Example | SAP Equivalent | Default |
|------------|-------------|---------|----------------|---------|
| **ReceivedQty** | Already Received Quantity | `10` | Auto-calc from `Quantity - OpenQty` | `0` if not provided |
| **OpenQty** | Open/Remaining Quantity | `20` | `OpenQty` | Auto-calculates received qty |
| **BinCode** | Pre-assigned Putaway Location | `A-01-01` | `WhsCode` (optional) | None (set during receiving) |

**💡 SAP Users:** If your export includes `OpenQty`, the system will automatically calculate `ReceivedQty = Quantity - OpenQty`!

---

## 📐 **Data Format Rules**

### **1. One Row = One Line Item**
- Each row represents **one item** on a purchase order
- Multiple rows with the **same `poNumber`** will be grouped into **one PO**

### **2. PO Grouping Example:**

```
poNumber,vendor,expectedDate,ItemCode,Description,OrderedQty
PO-2025-001,Tech Supplies Inc.,2025-11-01,MOUSE-001,Wireless Mouse,50
PO-2025-001,Tech Supplies Inc.,2025-11-01,KEYB-001,Mechanical Keyboard,30
PO-2025-001,Tech Supplies Inc.,2025-11-01,MON-001,24" LED Monitor,20
```

**Result:** One PO (`PO-2025-001`) with 3 line items

### **3. Multiple POs in One File:**

```
poNumber,vendor,expectedDate,ItemCode,Description,OrderedQty
PO-2025-001,Vendor A,2025-11-01,ITEM-A,Product A,10
PO-2025-001,Vendor A,2025-11-01,ITEM-B,Product B,20
PO-2025-002,Vendor B,2025-11-03,ITEM-C,Product C,15
PO-2025-002,Vendor B,2025-11-03,ITEM-D,Product D,25
```

**Result:** Two POs (`PO-2025-001` with 2 items, `PO-2025-002` with 2 items)

---

## 📝 **Complete Example CSV**

```csv
poNumber,vendor,expectedDate,ItemCode,Description,OrderedQty,ReceivedQty,BinCode
PO-2025-001,Tech Supplies Inc.,2025-11-01,MOUSE-001,Wireless Mouse,50,0,
PO-2025-001,Tech Supplies Inc.,2025-11-01,KEYB-001,Mechanical Keyboard,30,0,
PO-2025-002,Office Essentials Co.,2025-11-03,DESK-001,Standing Desk,15,10,A-01-01
PO-2025-002,Office Essentials Co.,2025-11-03,CHAIR-001,Ergonomic Chair,25,15,A-01-02
PO-2025-003,Electronics Wholesale,2025-11-05,LAPTOP-001,Business Laptop,10,0,
PO-2025-003,Electronics Wholesale,2025-11-05,TABLET-001,10" Tablet,20,0,
```

---

## 🎯 **Flexible Column Name Detection**

The system is smart! It will automatically recognize these **variations** of column names:

### **PO Number:**
- `poNumber`, `PONumber`, `po_number`, `PO_Number`, `PO Number`, `Purchase Order`

### **Vendor:**
- `vendor`, `Vendor`, `VendorName`, `Vendor Name`, `supplier`, `Supplier`

### **Expected Date:**
- `expectedDate`, `ExpectedDate`, `expected_date`, `Expected Date`, `dueDate`, `DueDate`

### **Item Code:**
- `ItemCode`, `itemcode`, `item_code`, `Item`, `SKU`, `sku`

### **Description:**
- `Description`, `description`, `desc`, `ItemName`, `Item_Name`

### **Ordered Quantity:**
- `OrderedQty`, `orderedqty`, `ordered_qty`, `Quantity`, `quantity`, `Qty`, `qty`

### **Received Quantity:**
- `ReceivedQty`, `receivedqty`, `received_qty`, `Received`

### **Bin Code:**
- `BinCode`, `bincode`, `bin_code`, `Bin`, `PutawayLocation`

---

## ⚠️ **Important Notes**

### **✅ DO:**
- ✅ Use one row per line item
- ✅ Group line items with same `poNumber`
- ✅ Include header row with column names
- ✅ Use numbers for quantities (no text like "fifty")
- ✅ Use consistent date formats (YYYY-MM-DD preferred)

### **❌ DON'T:**
- ❌ Skip the header row
- ❌ Leave `poNumber` blank (row will be skipped)
- ❌ Use `OrderedQty` = 0 (row will be skipped)
- ❌ Mix different date formats in same column

---

## 🔄 **How It Works**

1. **Upload File** → System reads CSV/XLSX
2. **Parse Data** → Extracts all rows
3. **Group by PO** → Rows with same `poNumber` become one PO
4. **Check Duplicates** → Won't re-import existing PO numbers
5. **Auto-Status** → Sets status: `pending`, `receiving`, or `completed`
6. **Save** → Stores in `localStorage['rf_purchase_orders']`

---

## 🧪 **Testing Your File**

Before uploading a large file, test with a small sample:

```csv
poNumber,vendor,expectedDate,ItemCode,Description,OrderedQty
TEST-PO-001,Test Vendor,2025-11-01,TEST-001,Test Item,10
```

Upload this → Check Receive page → Verify PO appears correctly!

---

## 📍 **Where to Upload**

### **Option 1: Receive Page** (Recommended)
1. Navigate to **Receive** tab
2. Click **"Upload PO File (CSV/XLSX)"** button at top
3. Select your file
4. POs appear immediately in the list

### **Option 2: Setup Page**
1. Go to **Setup** page
2. Scroll to **"Upload Purchase Orders"** section
3. Upload your file
4. Navigate to Receive page to see POs

---

## ✅ **Summary**

**Your `master_PO` file should have these columns:**

```
poNumber, vendor, expectedDate, ItemCode, Description, OrderedQty
```

**Optional but helpful:**
```
ReceivedQty, BinCode
```

**That's it!** The system handles everything else automatically. 🎉

---

**Questions?** Check the app's toast notifications - they'll tell you if there are any issues with your file format!

