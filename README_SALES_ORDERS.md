# 📦 Sales Order Upload Feature - Complete Documentation

## Overview

Your WMS now supports uploading CSV files containing **multiple sales orders** separated by blank lines. The system automatically parses, groups, and prepares them for picking workflows.

---

## 🎯 What You Can Do

✅ Upload CSV/XLSX files with multiple sales orders  
✅ Automatic grouping by SO number  
✅ Flexible column name recognition (works with SAP Business One)  
✅ Auto-calculate remaining quantities to pick  
✅ Status tracking (pending → picking → picked → shipped)  
✅ Prevent duplicate uploads  
✅ Store and retrieve from browser localStorage  

---

## 📁 Your CSV Format

### Example from Your Sample File
```csv
soNumber,customer,CardCode,LineNumber,ItemCode,Description,OrderedQty,DeliveredQty,BinCode
429687,NAPA STONEY CREEK,C000275,0,201-82630-LST,PLUNGER CAP,1.0,0.0,
429687,NAPA STONEY CREEK,C000275,1,210-00393-LST,LUB OIL PUMP BALL VALVE,2.0,0.0,01-07E08
429687,NAPA STONEY CREEK,C000275,2,201-82620-LST,PUMP PLUNGER,1.0,0.0,
,,,,,,,,
429692,IN power,C002487,0,750-40624-LST,WATER PUMP ASSM,2.0,0.0,01-07I22
429692,IN power,C002487,1,751-40211-LST,GASKET-WATER PUMP,2.0,0.0,01-07E42
```

### What Happens When You Upload
```javascript
// Your file with 11 SOs becomes:
[
  {
    id: "so-1730000000000-0",
    soNumber: "429687",
    customer: "NAPA STONEY CREEK",
    cardCode: "C000275",
    status: "pending",
    items: [
      {
        LineNumber: 0,
        ItemCode: "201-82630-LST",
        Description: "PLUNGER CAP",
        OrderedQty: 1.0,
        DeliveredQty: 0.0,
        RemainingQty: 1.0,
        BinCode: undefined
      },
      // ... more items
    ],
    createdDate: "2024-11-04"
  },
  // ... 10 more sales orders
]
```

---

## 🚀 Quick Start

### 1. Upload Your File

**In the App:**
1. Go to **Setup** page
2. Find the green section: **"Upload Sales Orders (CSV or Excel)"**
3. Click and select: `SO_429803_429840_429839_...csv`
4. See: `✅ Loaded 11 sales order(s) with XX total line items`

**OR Test First:**
1. Open `test-so-parser.html` in browser
2. Drag your CSV file onto it
3. View visual breakdown of all orders
4. Verify data looks correct

### 2. Access in Code

```javascript
// Load all sales orders
const salesOrders = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]");

// Filter by status
const pendingOrders = salesOrders.filter(so => so.status === "pending");
const pickingOrders = salesOrders.filter(so => so.status === "picking");

// Get all items needing picking
const itemsToPick = salesOrders
  .flatMap(so => so.items)
  .filter(item => item.RemainingQty > 0);

console.log(`${pendingOrders.length} orders pending`);
console.log(`${itemsToPick.length} items need picking`);
```

### 3. Build Your UI

See `SO_INTEGRATION_EXAMPLE.tsx` for a complete React component showing:
- Sales order list with search
- Status badges and stats
- Item details with quantities
- Pick action buttons

---

## 📊 Data Structure

### SalesOrder Type
```typescript
interface SalesOrder {
  id: string;              // Auto-generated: "so-1730000000000-0"
  soNumber: string;        // "429687"
  customer: string;        // "NAPA STONEY CREEK"
  cardCode: string;        // "C000275"
  items: SOItem[];         // Array of line items
  status: "pending" | "picking" | "picked" | "shipped";
  createdDate: string;     // "2024-11-04"
  shippedDate?: string;    // Optional
}
```

### SOItem Type
```typescript
interface SOItem {
  LineNumber: number;      // 0, 1, 2, ... (for sorting)
  ItemCode: string;        // "201-82630-LST"
  Description: string;     // "PLUNGER CAP"
  OrderedQty: number;      // 1.0
  DeliveredQty: number;    // 0.0
  RemainingQty?: number;   // 1.0 (auto-calculated)
  BinCode?: string;        // "01-07E08" or undefined
}
```

---

## 🔄 Workflow Integration

### Basic Picking Flow

```javascript
// 1. User selects an order
const selectedSO = salesOrders.find(so => so.soNumber === "429687");

// 2. Show items to pick
const itemsNeedingPick = selectedSO.items.filter(item => item.RemainingQty > 0);

// 3. User picks an item
const pickedItemCode = "201-82630-LST";
const pickedQty = 1;

// 4. Update the order
const updatedItems = selectedSO.items.map(item => {
  if (item.ItemCode === pickedItemCode) {
    const newDelivered = item.DeliveredQty + pickedQty;
    const newRemaining = item.OrderedQty - newDelivered;
    return {
      ...item,
      DeliveredQty: newDelivered,
      RemainingQty: newRemaining
    };
  }
  return item;
});

// 5. Check if order is complete
const allItemsPicked = updatedItems.every(item => item.RemainingQty === 0);

// 6. Update status
const updatedSO = {
  ...selectedSO,
  items: updatedItems,
  status: allItemsPicked ? "picked" : "picking"
};

// 7. Save back to storage
const updatedSalesOrders = salesOrders.map(so =>
  so.id === selectedSO.id ? updatedSO : so
);
localStorage.setItem("rf_sales_orders", JSON.stringify(updatedSalesOrders));
```

---

## 🎨 Column Name Flexibility

The parser automatically recognizes various formats:

| Your Column | Also Recognizes | SAP B1 Format |
|-------------|-----------------|---------------|
| soNumber | SONumber, so_number, OrderNumber | DocNum, DocEntry |
| customer | Customer, CustomerName, Customer Name | CardName |
| CardCode | cardCode, CustomerCode | CardCode ✓ |
| ItemCode | itemcode, Item, SKU | ItemCode ✓ |
| Description | description, desc, ItemName | Dscription |
| OrderedQty | Quantity, Qty, quantity | Quantity |
| DeliveredQty | deliveredqty, ShippedQty | DelivrdQty |
| BinCode | bincode, Bin, PickLocation | WhsCode |
| LineNumber | LineNum, line_number | LineNum |

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| **SO_QUICK_START.md** | 3-step quick start guide |
| **SO_UPLOAD_GUIDE.md** | Comprehensive feature guide |
| **SO_FEATURE_IMPLEMENTATION_SUMMARY.md** | Technical implementation details |
| **SO_INTEGRATION_EXAMPLE.tsx** | Full React component example |
| **test-so-parser.html** | Visual testing tool (drag & drop) |
| **README_SALES_ORDERS.md** | This file - complete overview |

---

## 🧪 Testing

### Test with Your Sample File

```bash
# Your file contains 11 orders:
SO 429687 - NAPA STONEY CREEK (8 items)
SO 429692 - IN power (8 items)
SO 429763 - TIMMINS MECHANICAL SOLUTIONS INC. (10 items)
SO 429793 - CASH SALE (1 item)
SO 429803 - TORONTO AUTOMOTIVE MACH.CO.LTD (2 items)
SO 429819 - WAJAX LIMITED (1 item)
SO 429839 - IRON EQUIPMENT (3 items)
SO 429840 - NORTH ROCK RENTALS LTD (1 item)
SO 429853 - HENNINGER'S DIESEL LTD (1 item)
SO 429893 - CANADIAN BEARINGS (1 item - already delivered!)
SO 429897 - HENNINGER'S DIESEL LTD (2 items - 1 delivered, 1 pending)
```

### Expected Results
- ✅ 11 sales orders loaded
- ✅ SO 429893: status = "shipped" (all delivered)
- ✅ SO 429897: status = "picking" (partial delivery)
- ✅ All others: status = "pending"
- ✅ All items have RemainingQty calculated

### Browser Console Test
```javascript
// After upload, run in console:
const sos = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]");
console.log(`✅ Loaded ${sos.length} sales orders`);

sos.forEach(so => {
  const totalItems = so.items.length;
  const pendingItems = so.items.filter(i => i.RemainingQty > 0).length;
  console.log(`SO ${so.soNumber}: ${so.customer} - ${pendingItems}/${totalItems} items pending`);
});
```

---

## 🛠️ Technical Details

### Files Modified

#### `src/types/index.ts`
- Added `SalesOrder` interface
- Added `SOItem` interface

#### `src/data/csv-utils.ts`
- Added `parseSalesOrderFile()` - Main entry point
- Added `parseSOCSV()` - CSV parser
- Added `parseSOExcel()` - Excel parser
- Added `normalizeSOData()` - Data transformation

#### `src/pages/setup-page.tsx`
- Added `handleSOFileUpload()` handler
- Added green upload section UI
- Imports `parseSalesOrderFile` and `SalesOrder` type

### Storage Key
```javascript
localStorage.setItem("rf_sales_orders", JSON.stringify(salesOrders));
```

### No Breaking Changes
- All existing code continues to work
- Purchase Orders still use `rf_purchase_orders`
- Sales Orders use separate `rf_sales_orders` key

---

## 🎯 Next Steps

### Immediate
1. ✅ Upload your sample CSV
2. ✅ Verify in browser console
3. ✅ Test with test-so-parser.html

### Short Term
1. Add SO selection to Pick page
2. Display SO items with bin locations
3. Track picked quantities
4. Update order status

### Future Enhancements
- Wave picking (batch multiple SOs)
- Print pick lists
- Picking transaction logs
- Server-side SO storage (like POs)
- SAP B1 integration script

---

## ❓ FAQ

**Q: Can I upload the same SO twice?**  
A: No, the system prevents duplicates. If an SO number already exists, it won't be added again.

**Q: What if my column names are different?**  
A: The parser is flexible! Check the "Column Name Flexibility" table above for supported variations.

**Q: Can I upload multiple files?**  
A: Yes! Each upload merges new SOs with existing ones (no duplicates).

**Q: Where is the data stored?**  
A: In browser localStorage under key `rf_sales_orders` as a JSON array.

**Q: Can I export the data?**  
A: Yes! Use `JSON.stringify()` and create a download, or build an export feature similar to receiving transactions.

**Q: Does this work offline?**  
A: Yes! Once uploaded, data is stored locally and works without internet.

---

## 🎉 Summary

You now have a fully functional Sales Order upload system that:
- ✅ Parses your multi-SO CSV files
- ✅ Groups and organizes data intelligently
- ✅ Calculates remaining quantities automatically
- ✅ Tracks order status through the workflow
- ✅ Integrates seamlessly with your existing WMS

**Ready to use!** Upload your file and start building your picking workflow. 🚀

---

## 📞 Support

For questions or issues:
1. Check documentation files in this directory
2. Review `SO_INTEGRATION_EXAMPLE.tsx` for code examples
3. Use `test-so-parser.html` to debug CSV parsing
4. Inspect browser console for data verification

