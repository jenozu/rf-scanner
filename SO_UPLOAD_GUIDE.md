# Sales Order CSV Upload Guide

## Overview
The WMS now supports uploading CSV files containing multiple sales orders separated by blank lines. The parser automatically groups items by sales order number and makes them available for picking workflows.

## CSV Format

### Expected Columns
```csv
soNumber,customer,CardCode,LineNumber,ItemCode,Description,OrderedQty,DeliveredQty,BinCode
```

### Column Descriptions
- **soNumber**: Sales order number (required)
- **customer**: Customer name
- **CardCode**: Customer code/ID
- **LineNumber**: Line item number (for sorting)
- **ItemCode**: Product/item code (required)
- **Description**: Item description
- **OrderedQty**: Quantity ordered (required)
- **DeliveredQty**: Quantity already delivered/shipped
- **BinCode**: Suggested bin location for picking (optional)

### Multiple Sales Orders
Multiple sales orders can be included in one file, separated by blank lines (rows with just commas).

### Example CSV
```csv
soNumber,customer,CardCode,LineNumber,ItemCode,Description,OrderedQty,DeliveredQty,BinCode
429687,NAPA STONEY CREEK,C000275,0,201-82630-LST,PLUNGER CAP,1.0,0.0,
429687,NAPA STONEY CREEK,C000275,1,210-00393-LST,LUB OIL PUMP BALL VALVE,2.0,0.0,01-07E08
429687,NAPA STONEY CREEK,C000275,2,201-82620-LST,PUMP PLUNGER,1.0,0.0,
,,,,,,,,
429692,IN power,C002487,0,750-40624-LST,WATER PUMP ASSM,2.0,0.0,01-07I22
429692,IN power,C002487,1,751-40211-LST,GASKET-WATER PUMP,2.0,0.0,01-07E42
,,,,,,,,
429763,TIMMINS MECHANICAL SOLUTIONS INC.,C002266,0,4916197-DTZ,EGR COOLER,1.0,0.0,01-1C09
429763,TIMMINS MECHANICAL SOLUTIONS INC.,C002266,1,4516715-DTZ,GASKET (4503887),1.0,0.0,01-0480
```

## Alternative Column Names Supported

The parser recognizes various column name formats:

### SO Number
- `soNumber`, `SONumber`, `so_number`, `SO Number`
- `DocNum`, `DocEntry` (SAP Business One)
- `OrderNumber`, `Order Number`

### Customer
- `customer`, `Customer`, `CustomerName`, `Customer Name`
- `CardName` (SAP Business One)

### Customer Code
- `CardCode` (SAP Business One)
- `cardCode`, `card_code`, `CustomerCode`, `customer_code`

### Item Code
- `ItemCode`, `itemcode`, `item_code`
- `Item`, `SKU`, `sku`

### Description
- `Description`, `Dscription` (SAP typo)
- `description`, `desc`, `ItemName`, `Item_Name`

### Quantities
- Ordered: `OrderedQty`, `Quantity`, `orderedqty`, `Qty`, `qty`
- Delivered: `DeliveredQty`, `DelivrdQty` (SAP), `ShippedQty`

### Bin Location
- `BinCode`, `bincode`, `bin_code`, `Bin`
- `PickLocation`, `WhsCode` (SAP)

## Usage in Code

### Import the Function
```typescript
import { parseSalesOrderFile } from "./data/csv-utils";
```

### Parse a CSV File
```typescript
// From file input
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  
  try {
    const salesOrders = await parseSalesOrderFile(file);
    console.log(`Loaded ${salesOrders.length} sales orders`);
    
    // Save to local storage or state
    localStorage.setItem("salesOrders", JSON.stringify(salesOrders));
    
    // Display summary
    salesOrders.forEach(so => {
      console.log(`SO ${so.soNumber}: ${so.customer} - ${so.items.length} items`);
    });
  } catch (error) {
    console.error("Error parsing sales order file:", error);
    alert("Failed to parse sales order file. Please check the format.");
  }
};
```

### SalesOrder Data Structure
```typescript
interface SalesOrder {
  id: string;              // Unique ID (auto-generated)
  soNumber: string;        // Sales order number
  customer: string;        // Customer name
  cardCode: string;        // Customer code
  items: SOItem[];         // Array of line items
  status: "pending" | "picking" | "picked" | "shipped";
  createdDate: string;     // ISO date string
  shippedDate?: string;    // Optional ship date
}

interface SOItem {
  LineNumber: number;      // Line item number
  ItemCode: string;        // Product code
  Description: string;     // Product description
  OrderedQty: number;      // Quantity ordered
  DeliveredQty: number;    // Quantity already delivered
  RemainingQty?: number;   // Auto-calculated: OrderedQty - DeliveredQty
  BinCode?: string;        // Optional suggested pick location
}
```

## Features

✅ **Multi-SO Support**: Parse multiple sales orders from one CSV file  
✅ **Flexible Column Names**: Recognizes various naming conventions including SAP Business One  
✅ **Auto-Grouping**: Automatically groups items by sales order number  
✅ **Auto-Status**: Automatically determines status (pending/picking/shipped)  
✅ **Remaining Qty Calculation**: Auto-calculates remaining quantity to pick  
✅ **Excel Support**: Works with both CSV and XLSX files  
✅ **Line Sorting**: Items are sorted by line number within each order  

## Integration Points

### Picking Workflow
1. Upload sales order CSV
2. Select an order to pick
3. System shows items with quantities and suggested bin locations
4. Scan items and record picked quantities
5. Update delivered quantities and order status

### Example Integration in Pick Page
```typescript
// Load sales orders from storage
const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);

useEffect(() => {
  const stored = localStorage.getItem("salesOrders");
  if (stored) {
    setSalesOrders(JSON.parse(stored));
  }
}, []);

// Display pending orders
const pendingOrders = salesOrders.filter(so => 
  so.status === "pending" || so.status === "picking"
);

// Show items that need picking
const itemsToPick = selectedOrder?.items.filter(item => 
  item.RemainingQty! > 0
);
```

## Testing

Use the provided sample CSV file:
`SO_429803_429840_429839_429897_429819_429692_429893_429853_429763_429687_429793.csv`

This file contains 11 sales orders with various line items to test the parsing functionality.

## Next Steps

1. **UI Integration**: Add file upload component to Pick page or Setup page
2. **SO Management**: Display loaded sales orders with search/filter
3. **Pick Task Generation**: Convert SOs to pick tasks
4. **Progress Tracking**: Update DeliveredQty as items are picked
5. **Transaction Logging**: Log pick transactions similar to receiving

## Notes

- The parser uses `skipEmptyLines: true` which automatically handles blank line separators
- All sales orders get unique IDs (timestamp-based)
- Status is automatically determined based on DeliveredQty vs OrderedQty
- Customer code (CardCode) is preserved for integration with business systems

