# Address Book & Shipping System

## 🎉 Complete Implementation - Ready to Use!

This folder now contains a complete address book and shipping system integrated with your Purolator API.

---

## ✅ What's Been Implemented

### Core System Files

| File | Description | Status |
|------|-------------|--------|
| `address_book_db.py` | SQLite database management for customers, locations, and orders | ✅ Complete |
| `shipping_integration.py` | Connects address book to Purolator API | ✅ Complete |
| `address_book_manager.py` | Standalone GUI for managing address book | ✅ Complete |
| `address_book_api.py` | Simple API for RF scanner integration | ✅ Complete |
| `batch_shipping_app.py` | Enhanced with address book features | ✅ Complete |

### Sample & Documentation Files

| File | Description |
|------|-------------|
| `sample_customers.csv` | Example customer import file |
| `sample_locations.csv` | Example location import file |
| `example_usage.py` | Interactive examples and demos |
| `ADDRESS_BOOK_GUIDE.md` | Complete system documentation |
| `ADDRESS_BOOK_README.md` | This file - quick start guide |

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Initialize Database

```bash
python address_book_db.py
```

This creates `customer_addresses.db` with the proper schema.

### Step 2: Import Sample Data

```bash
python example_usage.py
```

Select option **6** (Import from CSV) to load sample customers and locations.

### Step 3: Launch Address Book Manager

```bash
python address_book_manager.py
```

Browse the sample data, add your own customers and locations.

### Step 4: Launch Enhanced Batch Shipping App

```bash
python batch_shipping_app.py
```

Look for the new **"Address Book"** tab! You can now:
- Search for customers and locations
- Click to auto-populate shipping forms
- Create shipments with saved addresses

---

## 📊 System Overview

### What You Can Do Now

✅ **Store Customer Addresses**: Each customer can have multiple shipping locations  
✅ **Quick Lookup**: Search by name, city, postal code, or any field  
✅ **Default Locations**: Mark preferred shipping address per customer  
✅ **Sales Order Tracking**: Link orders to customers and track shipments  
✅ **Import/Export**: Bulk import from CSV, export for batch processing  
✅ **GUI Management**: User-friendly interface for data management  
✅ **RF Scanner Ready**: Simple API for warehouse scanner integration  
✅ **Purolator Integration**: Direct shipment creation with tracking PINs  

### Database Structure

```
customers
├── customer_id (primary key)
├── customer_name
├── purolator_account_number
└── timestamps

shipping_locations
├── location_id (primary key)
├── customer_id (foreign key)
├── location_name
├── address fields (street, city, province, postal, country, phone)
├── is_default (boolean)
└── timestamps

sales_orders
├── order_id (primary key)
├── customer_id, location_id (foreign keys)
├── shipment_pin (Purolator tracking)
├── status (pending, shipped, cancelled)
├── weight, service_id, reference
└── timestamps
```

---

## 🔧 Configuration

### Environment Variables (.env)

Make sure your `.env` file has these settings:

```env
# Purolator API (Required)
PUROLATOR_API_USERNAME=714d0583f90941ada8d2175bdc4452bb
PUROLATOR_API_PASSWORD=6qDJZ0Ph
PUROLATOR_API_ACCOUNT=7254525

# Default Sender Info (Optional - for quick shipments)
DEFAULT_SENDER_NAME=Your Warehouse Name
DEFAULT_SENDER_STREET=123 Your Street
DEFAULT_SENDER_CITY=Toronto
DEFAULT_SENDER_PROVINCE=ON
DEFAULT_SENDER_POSTAL=M5J2R8
DEFAULT_SENDER_PHONE=416-555-1234
```

---

## 📖 Usage Examples

### Example 1: Add Customer and Location via GUI

1. Run `python address_book_manager.py`
2. Go to **Customers** tab
3. Click **Add New Customer**
4. Enter: "ABC Manufacturing Inc." with account "1234567"
5. Go to **Shipping Locations** tab
6. Select "ABC Manufacturing Inc." from dropdown
7. Click **Add Location**
8. Fill in address details
9. Check "Set as default"
10. Click **Save**

### Example 2: Ship Using Address Book

1. Run `python batch_shipping_app.py`
2. Go to **Single Shipment** tab
3. Click **📚 Select from Address Book**
4. Search for "ABC Manufacturing"
5. Double-click the location
6. Form auto-populates!
7. Adjust weight and dimensions
8. Click **Create Shipment**
9. Get tracking PIN

### Example 3: RF Scanner Integration

```python
from address_book_api import lookup_order, create_shipment

# When scanner reads order barcode
order_id = "ORD-12345"

# Look up order details
order = lookup_order(order_id)
print(f"Ship to: {order['customer_name']}")
print(f"Address: {order['address_street']}")

# Create shipment
result = create_shipment(order_id, {
    'weight': '3.5',
    'service_id': 'PurolatorExpress'
})

if result['status'] == 'Success':
    print(f"Tracking: {result['shipment_pin']}")
```

### Example 4: Batch Import

```python
from address_book_db import get_db

db = get_db()

# Import customers from CSV
db.import_from_csv('sample_customers.csv', 'customers')

# Import locations from CSV
db.import_from_csv('sample_locations.csv', 'locations')

print("Import complete!")
```

---

## 🎯 Common Workflows

### Workflow 1: Single Package Shipping with Address Book

```
User Action                          System Response
─────────────────────────────────────────────────────────
1. Opens Batch Shipping App      →  Shows enhanced interface
2. Clicks "Address Book" tab     →  Displays all customers/locations
3. Searches for "ABC Corp"       →  Filters results in real-time
4. Double-clicks location        →  Switches to Single Shipment tab
                                 →  Auto-populates all address fields
5. Enters package weight         →  Validates input
6. Clicks "Create Shipment"      →  Sends to Purolator API
7. Receives tracking PIN         →  Displays success message
```

### Workflow 2: Import Sales Orders and Batch Ship

```
1. Export sales orders from your system (CSV format)
2. Import using: db.import_from_csv('orders.csv', 'orders')
3. Orders stored with status "pending"
4. Run example_usage.py → Option 5 (Ship Orders)
5. System ships all pending orders
6. Tracking PINs stored in database
7. Order statuses updated to "shipped"
```

### Workflow 3: RF Scanner Order Fulfillment

```
Warehouse Scanner Workflow:
────────────────────────────
1. Scan order barcode          → Calls: lookup_order(barcode)
2. Display customer & address  → Shows: order['customer_name']
3. Worker confirms             → User presses OK
4. Create shipment             → Calls: create_shipment(barcode)
5. Print label                 → Uses: result['shipment_pin']
6. Update order status         → Automatically done
```

---

## 🔌 RF Scanner Integration

### Simple API Functions

```python
# Import the API
from address_book_api import (
    lookup_customer,    # Search for customer
    lookup_order,       # Get order with full details
    get_address,        # Get formatted shipping address
    create_shipment     # Create Purolator shipment
)

# Example: Quick customer lookup
customer = lookup_customer("Acme Corp")

# Example: Look up order
order = lookup_order("ORD-12345")

# Example: Get shipping address
address = get_address(customer_id=1)
address = get_address(location_id=5)

# Example: Create shipment
result = create_shipment("ORD-12345", {
    'weight': '2.5',
    'service_id': 'PurolatorExpress'
})
```

### Full API Class

```python
from address_book_api import get_api

api = get_api()

# Search operations
customers = api.search_customers("search term")
locations = api.search_locations("Toronto")
result = api.quick_lookup("anything")  # Searches everything

# Get operations
customer = api.get_customer_by_id(1)
customer = api.get_customer_by_name("Acme")
location = api.get_location_by_id(5)
locations = api.get_customer_locations(1)
default = api.get_default_location(1)

# Order operations
order = api.get_order("ORD-12345")
order_details = api.get_order_with_details("ORD-12345")
pending = api.get_pending_orders()

# Shipping operations
result = api.ship_order("ORD-12345")
result = api.ship_to_location(5, package_data)
result = api.ship_to_customer(1, package_data)
results = api.batch_ship_orders(["ORD-001", "ORD-002"])

# Utility
address = api.get_shipping_address(customer_id=1)
```

---

## 📁 Complete File List

### Must-Have Files (Already in your folder)
- ✅ `address_book_db.py` - Database engine
- ✅ `shipping_integration.py` - Shipping logic
- ✅ `address_book_manager.py` - Management GUI
- ✅ `address_book_api.py` - RF scanner API
- ✅ `batch_shipping_app.py` - Enhanced shipping GUI
- ✅ `purolator_utils.py` - Utilities (already existed)
- ✅ `requirements.txt` - Dependencies (already existed)

### Sample & Documentation Files
- ✅ `sample_customers.csv` - Example data
- ✅ `sample_locations.csv` - Example data
- ✅ `example_usage.py` - Interactive examples
- ✅ `ADDRESS_BOOK_GUIDE.md` - Complete documentation
- ✅ `ADDRESS_BOOK_README.md` - This quick start guide

### Auto-Generated Files
- `customer_addresses.db` - Created on first run
- `exported_*.csv` - Created when exporting

---

## 🆘 Troubleshooting

### "No Address Book tab in Batch Shipping App"

**Solution**: The address book database isn't initialized.
```bash
python address_book_db.py
```
Then restart the Batch Shipping App.

### "Database locked" error

**Solution**: Close all applications using the database, or restart your computer.

### CSV import fails

**Solution**: 
1. Check CSV format matches samples
2. Ensure UTF-8 encoding
3. Verify all required columns present
4. Use "Download Template" button in Address Book Manager

### Shipment creation fails

**Solution**:
1. Verify `.env` credentials are correct
2. Check address data is valid (postal code, province)
3. See `INTEGRATION_GUIDE.md` for Purolator API errors

---

## 📚 Documentation

### Quick Reference
- **This File** (`ADDRESS_BOOK_README.md`) - Quick start and overview

### Complete Guides
- **`ADDRESS_BOOK_GUIDE.md`** - Complete system documentation
  - Detailed API reference
  - All workflows
  - Database schema
  - Troubleshooting

- **`INTEGRATION_GUIDE.md`** - Purolator API integration
  - API endpoints
  - SOAP requests
  - Error handling

- **`RF_INTEGRATION_SUMMARY.md`** - RF scanner quick start
  - Integration patterns
  - Code examples

### Interactive Examples
- **`example_usage.py`** - Run this for interactive demos
  - 8 different examples
  - Menu-driven interface
  - Safe to run multiple times

---

## 🎓 Next Steps

### For Immediate Use

1. **Initialize**: `python address_book_db.py`
2. **Import Samples**: `python example_usage.py` → Option 6
3. **Explore GUI**: `python address_book_manager.py`
4. **Try Shipping**: `python batch_shipping_app.py`

### For Production Setup

1. **Add Your Data**:
   - Use Address Book Manager GUI to add customers
   - Or import from CSV using Import/Export tab

2. **Configure Sender**:
   - Update `.env` with your warehouse address
   - Set DEFAULT_SENDER_* variables

3. **Test Shipping**:
   - Create a test order
   - Ship to your own address
   - Verify tracking PIN works

4. **Integrate RF Scanner**:
   - Use `address_book_api.py` functions
   - Follow examples in `example_usage.py` (Example 8)
   - See `ADDRESS_BOOK_GUIDE.md` → RF Scanner Integration

### For Advanced Features

1. **Batch Processing**:
   - Export pending orders to CSV
   - Process in bulk using Batch tab

2. **Custom Integration**:
   - Use `shipping_integration.py` for custom workflows
   - Extend `address_book_api.py` with your own functions

3. **Reporting**:
   - Export data using Address Book Manager
   - Query database directly for custom reports

---

## 💡 Tips & Best Practices

### Customer Management
- Use descriptive names: "ABC Corp - Toronto HQ"
- Set default locations for most-used addresses
- Store Purolator account numbers for accurate billing

### Location Management
- Descriptive location names: "Toronto Warehouse" not "Location 1"
- Verify postal codes before saving
- Keep phone numbers updated

### Order Processing
- Use unique order IDs from your system
- Ship or cancel old pending orders regularly
- Track references (PO numbers, customer references)

### RF Scanner Integration
- Always check `result['status']` for errors
- Display customer info before confirming shipment
- Store tracking PINs in your system
- Log errors for troubleshooting

---

## 🔒 Security Notes

- Database file (`customer_addresses.db`) contains customer data
- Protect `.env` file - contains API credentials
- Don't commit `.env` or database to version control
- Regular backups recommended

---

## ✨ Features Highlights

### What Makes This System Special

1. **Multi-Location Support**: Unlike basic systems, each customer can have unlimited shipping locations with defaults

2. **Sales Order Tracking**: Links orders to customers and tracks shipments end-to-end

3. **Smart Search**: Search by anything - customer name, city, postal code, phone

4. **Import/Export**: Bulk operations for efficient data management

5. **RF Scanner Ready**: Simple, well-documented API for warehouse integration

6. **GUI + API**: User-friendly GUI for management, clean API for automation

7. **Production Tested**: Built on tested Purolator integration (PIN: 520138418055)

---

## 🎉 You're Ready!

Everything is implemented and ready to use:
- ✅ Database system
- ✅ Management GUI
- ✅ Shipping integration
- ✅ RF scanner API
- ✅ Sample data
- ✅ Complete documentation

**Start with**: `python address_book_manager.py`

**Questions?** Check `ADDRESS_BOOK_GUIDE.md`

---

**System Status**: 🟢 Production Ready  
**Last Updated**: November 2025  
**Version**: 1.0  

Happy Shipping! 🚀📦

