# Sales Order Upload - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Upload Your CSV
1. Open your WMS application
2. Navigate to **Setup** page
3. Find the green section: **"Upload Sales Orders (CSV or Excel)"**
4. Click and select your CSV file
5. Wait for: `✅ Loaded X sales order(s)`

### Step 2: Test the Parser (Optional)
1. Open `test-so-parser.html` in your browser
2. Drag and drop your CSV file
3. View parsed sales orders visually
4. Verify data looks correct

### Step 3: Access Orders in Code
```javascript
// Load all sales orders
const salesOrders = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]");

// Get pending orders
const pending = salesOrders.filter(so => so.status === "pending");

// Show first order
console.log(pending[0]);
```

## 📋 Your CSV Format

```csv
soNumber,customer,CardCode,LineNumber,ItemCode,Description,OrderedQty,DeliveredQty,BinCode
429687,NAPA STONEY CREEK,C000275,0,201-82630-LST,PLUNGER CAP,1.0,0.0,
429687,NAPA STONEY CREEK,C000275,1,210-00393-LST,LUB OIL PUMP,2.0,0.0,01-07E08
,,,,,,,,
429692,IN power,C002487,0,750-40624-LST,WATER PUMP,2.0,0.0,01-07I22
```

✅ **Supports:**
- Multiple SOs in one file
- Blank line separators (automatically handled)
- CSV or Excel (.xlsx)
- Flexible column names

## 💡 Quick Tips

### Check What's Loaded
```javascript
// In browser console
const sos = JSON.parse(localStorage.getItem("rf_sales_orders") || "[]");
console.table(sos.map(so => ({
  SO: so.soNumber,
  Customer: so.customer,
  Items: so.items.length,
  Status: so.status
})));
```

### Find a Specific Order
```javascript
const so = sos.find(s => s.soNumber === "429687");
console.log(so);
```

### Get All Items to Pick
```javascript
const allItemsToPick = sos
  .filter(so => so.status !== "shipped")
  .flatMap(so => so.items.filter(item => item.RemainingQty > 0));
console.log(`${allItemsToPick.length} items need picking`);
```

### Update After Picking
```javascript
// After picking 5 units of an item
const soNumber = "429687";
const itemCode = "201-82630-LST";
const pickedQty = 5;

const updated = sos.map(so => {
  if (so.soNumber === soNumber) {
    const newItems = so.items.map(item => {
      if (item.ItemCode === itemCode) {
        return {
          ...item,
          DeliveredQty: item.DeliveredQty + pickedQty,
          RemainingQty: item.RemainingQty - pickedQty
        };
      }
      return item;
    });
    
    // Check if all items are picked
    const allPicked = newItems.every(i => i.RemainingQty === 0);
    
    return {
      ...so,
      items: newItems,
      status: allPicked ? "picked" : "picking"
    };
  }
  return so;
});

localStorage.setItem("rf_sales_orders", JSON.stringify(updated));
```

## 🎯 Next Steps

1. **Test with your file**: Upload `SO_429803_429840_...csv`
2. **Verify data**: Open browser console and check localStorage
3. **Build UI**: Use `SO_INTEGRATION_EXAMPLE.tsx` as template
4. **Add to Pick Page**: Integrate SO selection into existing picking workflow

## 📚 Full Documentation

- **SO_UPLOAD_GUIDE.md** - Complete guide with all features
- **SO_FEATURE_IMPLEMENTATION_SUMMARY.md** - Technical details
- **SO_INTEGRATION_EXAMPLE.tsx** - Full React component example
- **test-so-parser.html** - Visual testing tool

## ❓ Troubleshooting

### Upload fails?
- Check column names match expected format
- Verify CSV is UTF-8 encoded
- Try the test parser first

### Can't see orders?
```javascript
// Check localStorage
console.log(localStorage.getItem("rf_sales_orders"));
```

### Wrong data parsed?
- Open test-so-parser.html
- Upload your file
- Check the JSON output
- Verify column mappings

## 🎉 You're Ready!

The sales order upload feature is fully integrated and ready to use. Upload your CSV and start building your picking workflow!

---

**Need Help?** Check the documentation files or inspect the code in:
- `src/types/index.ts` - Type definitions
- `src/data/csv-utils.ts` - Parser logic
- `src/pages/setup-page.tsx` - Upload UI

