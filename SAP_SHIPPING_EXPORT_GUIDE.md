# SAP Business One - Sales Order Export for Shipping

## Overview
This guide shows you exactly which fields to export from SAP Business One to enable automatic Purolator shipment creation in your RF Scanner WMS.

---

## ✅ Required Fields for Shipping

### Sales Order Header (ORDR)
| SAP Column | Purpose | Example |
|------------|---------|---------|
| `DocNum` | Sales order number | 429687 |
| `CardName` | Customer name | NAPA STONEY CREEK |
| `CardCode` | Customer code | C000275 |
| `Address2` | Ship-to street address | 123 Main Street |
| `City` | Ship-to city | Toronto |
| `County` | Ship-to province/state | ON |
| `ZipCode` | Ship-to postal code | M5J2R8 |
| `Country` | Ship-to country code | CA |
| `Phone1` | Contact phone number | 416-555-1234 |

### Sales Order Lines (RDR1)
| SAP Column | Purpose | Example |
|------------|---------|---------|
| `LineNum` | Line number (for sorting) | 0, 1, 2... |
| `ItemCode` | Product code | 201-82630-LST |
| `Dscription` | Item description | PLUNGER CAP |
| `Quantity` | Ordered quantity | 1.0 |
| `DelivrdQty` | Already delivered qty | 0.0 |
| `WhsCode` | Warehouse/bin code (optional) | 01-07E08 |

---

## 📝 SAP Query Template

Copy and paste this query into SAP Business One Query Manager:

```sql
SELECT 
    -- Order identification
    ORDR.DocNum,
    ORDR.CardName,
    ORDR.CardCode,
    
    -- Shipping address
    ORDR.Address2 AS ShipToStreet,
    ORDR.City AS ShipToCity,
    ORDR.County AS ShipToProvince,
    ORDR.ZipCode AS ShipToPostal,
    ORDR.Country AS ShipToCountry,
    ORDR.Phone1 AS ShipToPhone,
    
    -- Line details
    RDR1.LineNum,
    RDR1.ItemCode,
    RDR1.Dscription,
    RDR1.Quantity AS OrderedQty,
    RDR1.DelivrdQty AS DeliveredQty,
    RDR1.WhsCode AS BinCode

FROM ORDR
INNER JOIN RDR1 ON ORDR.DocEntry = RDR1.DocEntry

WHERE 
    ORDR.DocStatus = 'O'  -- Open orders only
    AND ORDR.CANCELED = 'N'  -- Not cancelled
    AND RDR1.Quantity > 0  -- Items with quantity

ORDER BY ORDR.DocNum, RDR1.LineNum
```

---

## 📊 CSV Format Example

Your export should look like this:

```csv
DocNum,CardName,CardCode,ShipToStreet,ShipToCity,ShipToProvince,ShipToPostal,ShipToCountry,ShipToPhone,LineNum,ItemCode,Dscription,OrderedQty,DeliveredQty,BinCode
429687,NAPA STONEY CREEK,C000275,123 Main St,Toronto,ON,M5J2R8,CA,416-555-1234,0,201-82630-LST,PLUNGER CAP,1.0,0.0,
429687,NAPA STONEY CREEK,C000275,123 Main St,Toronto,ON,M5J2R8,CA,416-555-1234,1,210-00393-LST,LUB OIL PUMP,2.0,0.0,01-07E08
,,,,,,,,,,,,,,
429692,IN power,C002487,456 Industrial Ave,Montreal,QC,H3B1A1,CA,514-555-5678,0,750-40624-LST,WATER PUMP,2.0,0.0,01-07I22
```

**Note:** Blank lines between orders are optional - the parser handles both formats.

---

## 🔄 Alternative Column Names

The RF Scanner automatically recognizes these SAP column variations:

| Standard | Also Accepts |
|----------|--------------|
| DocNum | DocEntry, OrderNumber |
| CardName | Customer, CustomerName |
| CardCode | customerCode, customer_code |
| Address2 | Street, Address, ShipToStreet |
| City | ShipToCity |
| County | State, Province, ShipToProvince |
| ZipCode | PostalCode, Zip, ShipToPostal |
| Country | ShipToCountry |
| Phone1 | Phone, Cellular, ShipToPhone |
| Dscription | Description, ItemName |
| Quantity | OrderedQty, Qty |
| DelivrdQty | DeliveredQty, ShippedQty |
| WhsCode | BinCode, Bin |

---

## 🚀 Export Steps

### Option 1: Using SAP Query Manager

1. Open **Tools > Queries > Query Manager**
2. Create **New Query**
3. Paste the SQL query above
4. Click **Execute**
5. Right-click results → **Export to Excel**
6. Save as CSV

### Option 2: Using Crystal Reports

1. Create new report based on Sales Orders
2. Add fields listed in "Required Fields" section above
3. Set filters: DocStatus = 'O', CANCELED = 'N'
4. Export to Excel/CSV

### Option 3: Using SAP DI API (Automated)

If you want to automate exports, create a scheduled script:

```python
# Example: SAP B1 DI API export (pseudo-code)
company = connect_to_sap()
recordset = company.GetBusinessObject(SQL_QUERY)
export_to_csv(recordset, 'sales_orders_for_shipping.csv')
```

---

## 📤 Upload to RF Scanner

After exporting:

1. Open your RF Scanner web app
2. Go to **Setup** page
3. Find **"Upload Sales Orders (CSV or Excel)"** section
4. Click and select your exported CSV
5. Wait for confirmation: `✅ Loaded X sales order(s)`

---

## 🎯 What Happens Next

Once uploaded with shipping addresses:

1. Orders appear on **Shipping** page
2. You can **create shipments** directly (no address book needed!)
3. System automatically:
   - Sends data to Purolator API
   - Gets tracking PIN back
   - Updates order status to "shipped"
   - Stores tracking number

---

## ⚠️ Common Issues

### "Missing shipping address"
- **Problem**: Orders don't have Address2, City, etc.
- **Solution**: Check if customer has ship-to address in SAP. Update query to use `CRD1` table if needed:

```sql
-- Alternative: Join to CRD1 for ship-to addresses
LEFT JOIN CRD1 ON ORDR.CardCode = CRD1.CardCode 
    AND CRD1.AdresType = 'S'  -- Ship-to address
    AND CRD1.Address = ORDR.ShipToCode
```

### "Phone number validation failed"
- **Problem**: Phone format not recognized
- **Solution**: Purolator parser handles any format: `416-555-1234`, `(416) 555-1234`, `4165551234`

### "Postal code invalid"
- **Problem**: Postal code missing space
- **Solution**: Parser auto-formats: `M5J2R8` → `M5J 2R8`

---

## 🏢 Warehouse Configuration

Before creating shipments, configure your warehouse address in `puro/.env`:

```env
DEFAULT_SENDER_NAME=Your Warehouse Name
DEFAULT_SENDER_STREET=123 Your Street
DEFAULT_SENDER_CITY=Toronto
DEFAULT_SENDER_PROVINCE=ON
DEFAULT_SENDER_POSTAL=M5J2R8
DEFAULT_SENDER_PHONE=416-555-1234
```

See `puro/env_template.txt` for full configuration template.

---

## 📞 Support

**Questions about SAP export?**
- Check SAP Business One documentation
- Consult your SAP administrator
- Review existing Crystal Reports for similar exports

**Questions about RF Scanner integration?**
- See `README_SALES_ORDERS.md`
- See `SO_UPLOAD_GUIDE.md`
- See `SHIPPING_API_DOCUMENTATION.md`

---

## ✅ Checklist

- [ ] Run SAP query to export sales orders
- [ ] Verify CSV has shipping address columns (Address2, City, County, ZipCode, Phone1)
- [ ] Configure warehouse address in `puro/.env`
- [ ] Upload CSV to RF Scanner
- [ ] Test creating a shipment
- [ ] Verify tracking PIN is returned

---

**You're ready to ship!** 🚀

This integration gives you a direct path from SAP → RF Scanner → Purolator with no manual data entry.

