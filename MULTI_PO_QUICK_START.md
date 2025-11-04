# Multi-PO Upload - Quick Start 🚀

## 📤 Upload Your Multi-PO File

### In Your App
```
Setup Page → Purple Section → "Upload Purchase Orders" → Select CSV
```

### Your CSV Format
```csv
poNumber,vendor,CardCode,LineNumber,ItemCode,Description,OrderedQty,ReceivedQty,BinCode
409650,DEUTZ CORPORATION (USD),P000108,0,282802-DTZ,AUXILIARY DRIVE,2.0,1.0,01-6B03
,,,,,,,,
409811,DEUTZ CORPORATION (USD),P000108,0,4610827-DTZ,VALVE MECHAN.COVER,2.0,2.0,01-4C08
```

✅ Multiple POs in one file  
✅ Blank lines separate POs  
✅ RemainingQty auto-calculated  
✅ Items sorted by LineNumber  

---

## 💾 Access Your POs

```javascript
// Load all POs
const pos = JSON.parse(localStorage.getItem("rf_purchase_orders") || "[]");

// Get specific PO
const po = pos.find(p => p.poNumber === "409650");

// Get items needing receiving
const itemsToReceive = po.items.filter(item => item.RemainingQty > 0);
```

---

## 📊 What You Get

```javascript
{
  id: "po-1730000000000-0",
  poNumber: "409650",
  vendor: "DEUTZ CORPORATION (USD)",
  cardCode: "P000108",              // ← Vendor code
  status: "receiving",              // auto-set
  expectedDate: "2024-11-04",
  items: [
    {
      LineNumber: 0,                // ← for sorting
      ItemCode: "282802-DTZ",
      Description: "AUXILIARY DRIVE",
      OrderedQty: 2.0,
      ReceivedQty: 1.0,
      RemainingQty: 1.0,            // ← auto-calculated!
      BinCode: "01-6B03"
    }
  ]
}
```

---

## 🧪 Quick Test

### Option 1: Visual Tool
```
Open test-po-parser.html → Drag CSV file → View results
```

### Option 2: Browser Console
```javascript
const pos = JSON.parse(localStorage.getItem("rf_purchase_orders") || "[]");
console.log(`Loaded ${pos.length} POs`);

pos.forEach(po => {
  const remaining = po.items.reduce((sum, i) => sum + i.RemainingQty, 0);
  console.log(`PO ${po.poNumber}: ${remaining} units remaining`);
});
```

---

## 🎯 Expected Results (Your File)

Your file: `PO_409844_409850_409857_409650_409811.csv`

```
✅ Loaded 5 purchase orders with 38 total line items

PO 409650: 1.0 units remaining (receiving)
PO 409811: 9.0 units remaining (receiving)
PO 409844: 11.0 units remaining (pending)
PO 409850: 27.0 units remaining (pending)
PO 409857: 12.0 units remaining (pending)

Total: 60.0 units to receive
```

---

## ✨ New Features

| Feature | Description |
|---------|-------------|
| **RemainingQty** | Auto-calculated: `OrderedQty - ReceivedQty` |
| **LineNumber** | Items sorted by line number |
| **CardCode** | Vendor code tracking (SAP compatible) |
| **Multi-PO** | Upload multiple POs in one file |
| **Status** | Auto-determined: pending/receiving/completed |

---

## 🔄 Use in Receiving

```javascript
// Get POs that need receiving
const needsReceiving = pos.filter(po => po.status !== "completed");

// Show remaining quantity
{pos.map(po => {
  const totalRemaining = po.items.reduce((sum, item) => 
    sum + item.RemainingQty, 0
  );
  
  return (
    <div>
      <h3>PO #{po.poNumber}</h3>
      <p>{po.vendor} ({po.cardCode})</p>
      <p>{totalRemaining} units remaining</p>
    </div>
  );
})}

// After receiving
const updated = pos.map(po => {
  if (po.poNumber === "409650") {
    const newItems = po.items.map(item => ({
      ...item,
      ReceivedQty: item.ReceivedQty + 1,
      RemainingQty: item.RemainingQty - 1
    }));
    return { ...po, items: newItems };
  }
  return po;
});
```

---

## 📚 Full Documentation

- **MULTI_PO_UPLOAD_GUIDE.md** - Complete guide
- **MULTI_PO_IMPLEMENTATION_COMPLETE.md** - Technical summary
- **test-po-parser.html** - Visual testing tool

---

## ✅ Quick Checklist

- [ ] Upload your multi-PO CSV via Setup page
- [ ] See success message with PO and item counts
- [ ] Open browser console and check data
- [ ] Verify RemainingQty is calculated
- [ ] Test with test-po-parser.html (optional)
- [ ] Use in receiving workflow

---

## 💡 Pro Tips

```javascript
// Count total remaining across all POs
const totalRemaining = pos
  .flatMap(po => po.items)
  .reduce((sum, i) => sum + i.RemainingQty, 0);

// Get most urgent PO (most items to receive)
const mostUrgent = pos
  .filter(po => po.status !== "completed")
  .sort((a, b) => {
    const aRemaining = a.items.reduce((sum, i) => sum + i.RemainingQty, 0);
    const bRemaining = b.items.reduce((sum, i) => sum + i.RemainingQty, 0);
    return bRemaining - aRemaining;
  })[0];

// Group by vendor
const byVendor = pos.reduce((acc, po) => {
  if (!acc[po.vendor]) acc[po.vendor] = [];
  acc[po.vendor].push(po);
  return acc;
}, {});
```

---

## 🎊 You're Ready!

Upload your multi-PO CSV file and start receiving efficiently! 📦

**Next**: Upload `PO_409844_409850_409857_409650_409811.csv` via Setup page!

