# Sales Order Upload - Cheat Sheet 🚀

## One-Page Quick Reference

---

## 📤 UPLOAD

### In Your App
```
Setup Page → Green Section → "Upload Sales Orders" → Select CSV
```

### Test Parser First (Optional)
```
Open test-so-parser.html → Drag CSV file → View results
```

---

## 💾 STORAGE

```javascript
// Key in localStorage
"rf_sales_orders"

// Load data
const sos = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]");

// Save data
localStorage.setItem("rf_sales_orders", JSON.stringify(sos));
```

---

## 📋 DATA STRUCTURE

```javascript
{
  id: "so-1730000000000-0",      // Auto-generated
  soNumber: "429687",             // Your SO number
  customer: "NAPA STONEY CREEK",  // Customer name
  cardCode: "C000275",            // Customer code
  status: "pending",              // pending|picking|picked|shipped
  createdDate: "2024-11-04",      // ISO date
  items: [                        // Array of items
    {
      LineNumber: 0,
      ItemCode: "201-82630-LST",
      Description: "PLUNGER CAP",
      OrderedQty: 1.0,
      DeliveredQty: 0.0,
      RemainingQty: 1.0,          // Auto-calculated
      BinCode: "01-07E08"         // Optional
    }
  ]
}
```

---

## 🔍 COMMON QUERIES

```javascript
// Get all SOs
const all = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]");

// Get pending orders
const pending = all.filter(so => so.status === "pending");

// Get a specific order
const so = all.find(so => so.soNumber === "429687");

// Get items needing pick
const itemsToPick = so.items.filter(item => item.RemainingQty > 0);

// Count total items across all SOs
const totalItems = all.reduce((sum, so) => sum + so.items.length, 0);

// Get all customers
const customers = [...new Set(all.map(so => so.customer))];
```

---

## ✏️ UPDATE WORKFLOW

```javascript
// After picking an item
const updatedSOs = salesOrders.map(so => {
  if (so.soNumber === "429687") {
    const updatedItems = so.items.map(item => {
      if (item.ItemCode === "201-82630-LST") {
        return {
          ...item,
          DeliveredQty: item.DeliveredQty + 1,
          RemainingQty: item.RemainingQty - 1
        };
      }
      return item;
    });
    
    const allDone = updatedItems.every(i => i.RemainingQty === 0);
    
    return {
      ...so,
      items: updatedItems,
      status: allDone ? "picked" : "picking"
    };
  }
  return so;
});

// Save back
localStorage.setItem("rf_sales_orders", JSON.stringify(updatedSOs));
```

---

## 📊 STATUS LOGIC

```javascript
// Auto-determined on upload:
all delivered?     → "shipped"
some delivered?    → "picking"
none delivered?    → "pending"

// After an order is fully picked:
status = "picked"

// After an order is shipped:
status = "shipped"
shippedDate = new Date().toISOString()
```

---

## 📄 CSV FORMAT

```csv
soNumber,customer,CardCode,LineNumber,ItemCode,Description,OrderedQty,DeliveredQty,BinCode
429687,NAPA STONEY CREEK,C000275,0,201-82630-LST,PLUNGER CAP,1.0,0.0,
429687,NAPA STONEY CREEK,C000275,1,210-00393-LST,LUB OIL PUMP,2.0,0.0,01-07E08
,,,,,,,,
429692,IN power,C002487,0,750-40624-LST,WATER PUMP,2.0,0.0,01-07I22
```

**Required:** soNumber, customer, ItemCode, Description, OrderedQty, DeliveredQty  
**Optional:** CardCode, LineNumber, BinCode

---

## 🎨 UI SNIPPETS

### Display Order Card
```jsx
<div className="order-card">
  <h3>SO #{so.soNumber}</h3>
  <p>{so.customer} ({so.cardCode})</p>
  <span className={`badge ${so.status}`}>{so.status}</span>
  <p>{so.items.length} items</p>
</div>
```

### Display Item List
```jsx
{so.items.map(item => (
  <div key={item.ItemCode}>
    <span>{item.ItemCode}</span>
    <span>{item.Description}</span>
    <span>{item.DeliveredQty}/{item.OrderedQty}</span>
    {item.BinCode && <span>@ {item.BinCode}</span>}
  </div>
))}
```

### Status Badge Colors
```css
.status-pending  { background: #e5e7eb; color: #4b5563; }
.status-picking  { background: #fef3c7; color: #92400e; }
.status-picked   { background: #dbeafe; color: #1e40af; }
.status-shipped  { background: #d1fae5; color: #065f46; }
```

---

## 🧪 CONSOLE TESTS

```javascript
// Load and inspect
const sos = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]");
console.table(sos);

// Verify specific order
const so = sos.find(s => s.soNumber === "429687");
console.log(so);

// Check all statuses
sos.forEach(so => console.log(`${so.soNumber}: ${so.status}`));

// Count items by status
console.log({
  pending: sos.filter(s => s.status === "pending").length,
  picking: sos.filter(s => s.status === "picking").length,
  picked: sos.filter(s => s.status === "picked").length,
  shipped: sos.filter(s => s.status === "shipped").length
});
```

---

## 🔗 COLUMN ALIASES

| Standard | Also Works |
|----------|------------|
| soNumber | SONumber, DocNum, OrderNumber |
| customer | Customer, CustomerName, CardName |
| CardCode | cardCode, CustomerCode |
| ItemCode | itemcode, Item, SKU |
| Description | description, desc, Dscription |
| OrderedQty | Quantity, Qty |
| DeliveredQty | deliveredqty, DelivrdQty, ShippedQty |
| BinCode | bincode, Bin, WhsCode |

---

## 📚 DOCUMENTATION

| File | Use For |
|------|---------|
| SO_QUICK_START.md | Getting started |
| SO_INTEGRATION_EXAMPLE.tsx | Code examples |
| README_SALES_ORDERS.md | Complete guide |
| test-so-parser.html | Visual testing |

---

## 🐛 DEBUG

```javascript
// Nothing loaded?
console.log(localStorage.getItem("rf_sales_orders"));

// Wrong data?
const raw = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]");
console.log(raw);

// Clear and retry
localStorage.removeItem("rf_sales_orders");
// Then re-upload

// Check for errors in console
// Look for red error messages
```

---

## ⚡ QUICK ACTIONS

```javascript
// Clear all SOs
localStorage.removeItem("rf_sales_orders");

// Export to JSON
const json = localStorage.getItem("rf_sales_orders");
const blob = new Blob([json], {type: "application/json"});
const url = URL.createObjectURL(blob);
// Create download link...

// Get stats
const sos = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]");
const stats = {
  totalOrders: sos.length,
  totalItems: sos.reduce((sum, so) => sum + so.items.length, 0),
  pendingItems: sos.flatMap(so => so.items).filter(i => i.RemainingQty > 0).length,
  completedOrders: sos.filter(so => so.status === "shipped").length
};
console.table(stats);
```

---

## ✅ TESTING CHECKLIST

- [ ] Upload CSV via Setup page
- [ ] Check localStorage in console
- [ ] Verify 11 orders loaded (from your sample)
- [ ] Check SO 429893 status = "shipped"
- [ ] Check SO 429897 status = "picking"
- [ ] Verify RemainingQty calculated correctly
- [ ] Try loading data in component
- [ ] Test filtering by status
- [ ] Test updating quantities
- [ ] Save and reload successfully

---

**💡 TIP:** Keep this cheat sheet handy while building your picking workflow!

