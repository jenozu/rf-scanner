# Address Book & Shipping System - Complete Guide

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [System Architecture](#system-architecture)
4. [Installation & Setup](#installation--setup)
5. [Using the Address Book Manager](#using-the-address-book-manager)
6. [Using the Batch Shipping App](#using-the-batch-shipping-app)
7. [RF Scanner Integration](#rf-scanner-integration)
8. [API Reference](#api-reference)
9. [Database Schema](#database-schema)
10. [Workflows](#workflows)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Address Book & Shipping System provides a complete solution for managing customer addresses and creating Purolator shipments. It consists of:

- **SQLite Database**: Stores customers, shipping locations, and sales orders
- **Address Book Manager**: Standalone GUI for managing the database
- **Batch Shipping App**: Enhanced with address book integration
- **Shipping Integration**: Connects address book to Purolator API
- **RF Scanner API**: Simple functions for RF scanner integration

### Key Features

✅ **Multi-Location Support**: Each customer can have unlimited shipping locations  
✅ **Default Locations**: Mark preferred shipping address per customer  
✅ **Quick Lookup**: Search by customer name, location, city, postal code  
✅ **Sales Order Tracking**: Link shipments to orders  
✅ **Import/Export**: CSV import for bulk setup  
✅ **RF Scanner Ready**: Simple API for warehouse scanners  
✅ **Purolator Integration**: Direct shipment creation with tracking PINs  

---

## Quick Start

### 1. Initialize Database

```bash
# Run this first time to create the database
python address_book_db.py
```

### 2. Import Sample Data

```bash
# Import sample customers and locations
python example_usage.py
# Select option 6 (Import from CSV)
```

### 3. Launch Address Book Manager

```bash
# Manage customers and locations
python address_book_manager.py
```

### 4. Launch Batch Shipping App

```bash
# Create shipments with address book integration
python batch_shipping_app.py
# Look for the "Address Book" tab
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACES                      │
├────────────────┬──────────────────┬────────────────────┤
│  Address Book  │  Batch Shipping  │   RF Scanner       │
│    Manager     │      App         │                    │
└────────┬───────┴────────┬─────────┴─────────┬──────────┘
         │                │                   │
         └────────────────┼───────────────────┘
                          │
         ┌────────────────▼─────────────────┐
         │    address_book_api.py           │
         │    (Unified API Layer)           │
         └────────────────┬─────────────────┘
                          │
         ┌────────────────▼─────────────────┐
         │  shipping_integration.py         │
         │  (Business Logic)                │
         └────────┬────────────────┬────────┘
                  │                │
         ┌────────▼────────┐  ┌───▼────────────────┐
         │ address_book_db │  │ batch_shipping_app │
         │    (Database)   │  │  (Purolator API)   │
         └─────────────────┘  └────────────────────┘
                  │                     │
         ┌────────▼────────┐  ┌────────▼──────────┐
         │ customer_       │  │  Purolator        │
         │ addresses.db    │  │  Web Services     │
         └─────────────────┘  └───────────────────┘
```

---

## Installation & Setup

### Prerequisites

- Python 3.7 or higher
- Purolator API credentials (production)

### Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

**Requirements**:
- `requests>=2.31.0` - HTTP library for API calls
- `python-dotenv>=1.0.0` - Environment variable management

### Step 2: Configure Environment

Create a `.env` file in the project directory:

```env
# Purolator API Credentials (Production)
PUROLATOR_API_USERNAME=714d0583f90941ada8d2175bdc4452bb
PUROLATOR_API_PASSWORD=6qDJZ0Ph
PUROLATOR_API_ACCOUNT=7254525

# Default Sender Information (Your Warehouse)
DEFAULT_SENDER_NAME=Your Warehouse Name
DEFAULT_SENDER_STREET=123 Warehouse Street
DEFAULT_SENDER_CITY=Toronto
DEFAULT_SENDER_PROVINCE=ON
DEFAULT_SENDER_POSTAL=M5J2R8
DEFAULT_SENDER_PHONE=416-555-1234

# Optional: Custom database path
# ADDRESS_BOOK_DB=path/to/custom/database.db
```

### Step 3: Initialize Database

```bash
python address_book_db.py
```

This creates `customer_addresses.db` in the current directory.

### Step 4: Test the System

```bash
python example_usage.py
```

Run the examples to verify everything is working.

---

## Using the Address Book Manager

### Launch

```bash
python address_book_manager.py
```

### Features

#### Customers Tab

**Add Customer**:
1. Click "Add New Customer"
2. Enter customer name
3. Optionally enter Purolator account number
4. Click Save

**Edit Customer**:
1. Select customer from list
2. Click "Edit Customer"
3. Modify details
4. Click Save

**Delete Customer**:
1. Select customer from list
2. Click "Delete Customer"
3. Confirm deletion (⚠ deletes all locations and orders)

**Search**:
- Type in search box to filter customers in real-time

#### Shipping Locations Tab

**Add Location**:
1. Select customer from dropdown
2. Click "Add Location"
3. Fill in all address fields:
   - Location name (e.g., "Toronto Warehouse")
   - Street address
   - City
   - Province (2-letter code)
   - Postal code
   - Country code
   - Phone number
4. Check "Set as default" if this is the primary location
5. Click Save

**Edit Location**:
1. Select customer from dropdown
2. Select location from list
3. Click "Edit Location"
4. Modify details
5. Click Save

**Delete Location**:
1. Select location from list
2. Click "Delete Location"
3. Confirm deletion

#### Import/Export Tab

**Import Customers**:
1. Click "Import Customers"
2. Select CSV file (format: customer_name, purolator_account_number)
3. Confirm import

**Import Locations**:
1. Click "Import Locations"
2. Select CSV file (see sample_locations.csv for format)
3. Confirm import

**Export Data**:
1. Click "Export Customers" or "Export Locations"
2. Choose destination file
3. Data exported as CSV

**Download Template**:
- Click "Download Template" to get properly formatted CSV

#### Sales Orders Tab

View all sales orders with status filtering:
- **all**: Show all orders
- **pending**: Show orders ready to ship
- **shipped**: Show completed orders
- **cancelled**: Show cancelled orders

---

## Using the Batch Shipping App

### Launch

```bash
python batch_shipping_app.py
```

### Address Book Tab (NEW!)

This tab appears if the address book database is available.

**Search & Browse**:
1. Enter search term (customer name, city, postal code)
2. View all matching locations
3. Double-click or click "Use This Address" to populate Single Shipment form

**Features**:
- Real-time search filtering
- Shows all customer locations
- One-click address selection
- Opens Address Book Manager for editing

### Single Shipment Tab (ENHANCED!)

**New Button**: 📚 Select from Address Book

**Workflow**:
1. Click "📚 Select from Address Book"
2. Search for customer/location
3. Double-click to select
4. Form auto-populates with address
5. Adjust package details (weight, dimensions)
6. Click "Create Shipment"
7. Get tracking PIN

**Manual Entry** (still available):
- Fill in all fields manually as before
- System validates data before sending

### Batch Processing Tab

Same as before - load CSV and process multiple shipments.

**Using Address Book for Batch**:
1. Go to Address Book tab
2. Select customers/locations
3. Export to CSV format
4. Import CSV in Batch Processing tab
5. Process all shipments

---

## RF Scanner Integration

The `address_book_api.py` module provides simple functions for RF scanner integration.

### Quick Functions

```python
from address_book_api import lookup_customer, lookup_order, create_shipment

# Example 1: Look up customer
customer = lookup_customer("Acme Corp")
print(f"Customer ID: {customer['customer_id']}")

# Example 2: Look up order with full details
order = lookup_order("ORD-12345")
print(f"Ship to: {order['location_name']}")
print(f"Address: {order['address_street']}")

# Example 3: Create shipment
result = create_shipment("ORD-12345", {
    'weight': '3.5',
    'service_id': 'PurolatorExpress'
})
print(f"Tracking: {result['shipment_pin']}")
```

### Complete API Class

```python
from address_book_api import get_api

# Get API instance
api = get_api()

# Search customers
customers = api.search_customers("Acme")

# Get customer locations
locations = api.get_customer_locations(customer_id=1)

# Get default location
default = api.get_default_location(customer_id=1)

# Get formatted shipping address
address = api.get_shipping_address(customer_id=1)

# Create sales order
api.create_order(
    order_id="ORD-12345",
    customer_id=1,
    location_id=5,
    weight="2.5",
    service_id="PurolatorExpress"
)

# Ship order
result = api.ship_order("ORD-12345")
```

### RF Scanner Workflow Example

```python
from address_book_api import get_api

def process_scanned_order(scanned_barcode):
    """Called when RF scanner scans an order barcode"""
    api = get_api()
    
    # Step 1: Look up order
    order = api.get_order_with_details(scanned_barcode)
    if not order:
        return {'error': 'Order not found'}
    
    # Step 2: Check if already shipped
    if order['status'] == 'shipped':
        return {
            'error': 'Already shipped',
            'tracking': order['shipment_pin']
        }
    
    # Step 3: Display info to scanner screen
    display_info = {
        'customer': order['customer_name'],
        'location': order['location_name'],
        'address': f"{order['address_street']}, {order['address_city']}"
    }
    
    # Step 4: User confirms on RF scanner
    # ... (your RF scanner confirmation code) ...
    
    # Step 5: Create shipment
    result = api.ship_order(scanned_barcode)
    
    if result['status'] == 'Success':
        return {
            'success': True,
            'tracking': result['shipment_pin']
        }
    else:
        return {
            'success': False,
            'error': result['message']
        }
```

---

## API Reference

### AddressBookDB Class

Database operations for customers, locations, and orders.

#### Customer Operations

```python
from address_book_db import get_db

db = get_db()

# Add customer
customer_id = db.add_customer("Company Name", "PurolatorAccount")

# Update customer
db.update_customer(customer_id, customer_name="New Name")

# Delete customer (cascades to locations and orders)
db.delete_customer(customer_id)

# Get customer
customer = db.get_customer(customer_id)

# Search customers
customers = db.search_customers("search term")

# Get all customers
all_customers = db.get_all_customers()
```

#### Location Operations

```python
# Add shipping location
location_id = db.add_shipping_location(
    customer_id=1,
    location_name="Toronto Office",
    street="123 Main St",
    city="Toronto",
    province="ON",
    postal="M5J2R8",
    phone="416-555-1234",
    country="CA",
    is_default=True
)

# Update location
db.update_shipping_location(location_id, address_city="Mississauga")

# Delete location
db.delete_shipping_location(location_id)

# Get location
location = db.get_shipping_location(location_id)

# Get customer's locations
locations = db.get_customer_locations(customer_id)

# Get default location
default = db.get_default_location(customer_id)

# Search locations (across all customers)
results = db.search_locations("Toronto")
```

#### Sales Order Operations

```python
# Add sales order
db.add_sales_order(
    order_id="ORD-12345",
    customer_id=1,
    location_id=5,
    weight="2.5",
    service_id="PurolatorExpress",
    reference="Customer PO 789"
)

# Update order status
db.update_order_status("ORD-12345", "shipped", shipment_pin="329847293847")

# Get order
order = db.get_sales_order("ORD-12345")

# Get order with full details (joined with customer and location)
order_details = db.get_order_with_details("ORD-12345")

# Get pending orders
pending = db.get_pending_orders()

# Get customer orders
orders = db.get_customer_orders(customer_id, status="pending")
```

### AddressBookAPI Class

High-level API for RF scanner and application integration.

#### Lookup Functions

```python
from address_book_api import get_api

api = get_api()

# Get customer by ID
customer = api.get_customer_by_id(1)

# Get customer by name (first match)
customer = api.get_customer_by_name("Acme")

# Get location by ID
location = api.get_location_by_id(5)

# Get customer locations
locations = api.get_customer_locations(1)

# Get default location
default = api.get_default_location(1)

# Search customers
results = api.search_customers("search term")

# Search locations
results = api.search_locations("Toronto")

# Quick lookup (searches everything)
result = api.quick_lookup("Acme")
```

#### Order Functions

```python
# Get order
order = api.get_order("ORD-12345")

# Get order with full details
order_details = api.get_order_with_details("ORD-12345")

# Get pending orders
pending = api.get_pending_orders()

# Create order
api.create_order("ORD-12345", customer_id=1, location_id=5)
```

#### Shipping Functions

```python
# Ship order (uses order's saved data)
result = api.ship_order("ORD-12345")

# Ship order with custom package data
result = api.ship_order("ORD-12345", {
    'weight': '3.5',
    'length': '40',
    'width': '30',
    'height': '20',
    'service_id': 'PurolatorExpress'
})

# Ship directly to location
result = api.ship_to_location(location_id=5, package_data={
    'weight': '2.5',
    'service_id': 'PurolatorExpress',
    'reference': 'ORDER-001'
})

# Ship to customer (uses default location)
result = api.ship_to_customer(customer_id=1, package_data={...})

# Batch ship multiple orders
results = api.batch_ship_orders(["ORD-001", "ORD-002", "ORD-003"])
```

#### Convenience Functions

```python
# Get formatted shipping address (ready for Purolator)
address = api.get_shipping_address(customer_id=1)
# or
address = api.get_shipping_address(location_id=5)
```

### ShippingIntegration Class

Integration layer between address book and Purolator API.

```python
from shipping_integration import get_integration

integration = get_integration()

# Convert location to Purolator format
location = db.get_shipping_location(5)
sender_data = integration.get_default_sender_data()
package_data = {'weight': '2.5', 'service_id': 'PurolatorExpress', ...}
shipment_data = integration.convert_location_to_shipment_data(
    location, sender_data, package_data
)

# Ship to location
result = integration.ship_to_location(5, sender_data, package_data)

# Ship sales order
result = integration.ship_sales_order("ORD-12345", sender_data)

# Batch ship orders
results = integration.batch_ship_orders(["ORD-001", "ORD-002"], sender_data)

# Get pending shipments
pending = integration.get_pending_shipments()

# Export pending to CSV
integration.export_pending_to_csv("pending_shipments.csv")

# Get default sender data (from .env)
sender = integration.get_default_sender_data()
```

---

## Database Schema

### customers

| Column | Type | Description |
|--------|------|-------------|
| customer_id | INTEGER PRIMARY KEY | Auto-increment ID |
| customer_name | TEXT NOT NULL | Customer name |
| purolator_account_number | TEXT | Purolator account (optional) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### shipping_locations

| Column | Type | Description |
|--------|------|-------------|
| location_id | INTEGER PRIMARY KEY | Auto-increment ID |
| customer_id | INTEGER NOT NULL | Foreign key to customers |
| location_name | TEXT NOT NULL | Location description |
| address_street | TEXT NOT NULL | Street address |
| address_city | TEXT NOT NULL | City |
| address_province | TEXT NOT NULL | Province/state code |
| address_postal | TEXT NOT NULL | Postal/ZIP code |
| address_country | TEXT NOT NULL | Country code (default: CA) |
| phone_number | TEXT NOT NULL | Phone number |
| is_default | INTEGER | 1 if default, 0 otherwise |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### sales_orders

| Column | Type | Description |
|--------|------|-------------|
| order_id | TEXT PRIMARY KEY | Unique order ID |
| customer_id | INTEGER NOT NULL | Foreign key to customers |
| location_id | INTEGER NOT NULL | Foreign key to locations |
| shipment_pin | TEXT | Purolator tracking PIN |
| status | TEXT | pending, shipped, or cancelled |
| weight | TEXT | Package weight |
| service_id | TEXT | Purolator service ID |
| reference | TEXT | Additional reference |
| created_at | TIMESTAMP | Creation timestamp |
| shipped_at | TIMESTAMP | Shipment timestamp |

---

## Workflows

### Workflow 1: Single Package Shipping

```
1. User opens Batch Shipping App
2. Click "Single Shipment" tab
3. Click "📚 Select from Address Book"
4. Search for customer
5. Double-click customer location
6. Form auto-populates
7. Adjust weight, dimensions, service
8. Click "Create Shipment"
9. Receive tracking PIN
10. Label printed (if configured)
```

### Workflow 2: Batch Shipping from Sales Orders

```
1. Create sales orders in system (via API or import)
2. Orders stored with status "pending"
3. Open Batch Shipping App → Address Book tab
4. View pending orders
5. Export pending orders to CSV
6. Go to Batch Processing tab
7. Load exported CSV
8. Click "Process Batch"
9. All shipments created
10. Order statuses updated to "shipped"
11. Tracking PINs stored in database
```

### Workflow 3: RF Scanner Integration

```
1. Warehouse worker scans order barcode
2. RF scanner calls lookup_order(barcode)
3. System displays customer and address
4. Worker confirms shipment
5. RF scanner calls create_shipment(barcode)
6. System creates Purolator shipment
7. Tracking PIN returned to scanner
8. Label printed at warehouse
9. Order marked as shipped
```

### Workflow 4: Import Customer Data

```
1. Export customer/location data from your system
2. Format as CSV (see sample files)
3. Open Address Book Manager
4. Go to Import/Export tab
5. Click "Import Locations"
6. Select CSV file
7. System imports all data
8. Verify in Customers/Locations tabs
```

---

## Troubleshooting

### Database Issues

**Problem**: `sqlite3.OperationalError: no such table`  
**Solution**: Initialize database with `python address_book_db.py`

**Problem**: Database locked  
**Solution**: Close all applications using the database, or restart

**Problem**: Can't find database file  
**Solution**: Check `ADDRESS_BOOK_DB` in `.env` or use default location

### Address Book Not Available

**Problem**: No "Address Book" tab in Batch Shipping App  
**Solution**: 
1. Verify `address_book_db.py` is in same directory
2. Run `python address_book_db.py` to initialize
3. Restart Batch Shipping App

### Import/Export Issues

**Problem**: CSV import fails  
**Solution**:
1. Check CSV format matches template
2. Ensure UTF-8 encoding
3. Verify all required columns present
4. Check for empty required fields

**Problem**: Duplicate customers on import  
**Solution**: System creates new customers - manually merge if needed

### Shipping Issues

**Problem**: "Location not found"  
**Solution**: Verify location_id exists in database

**Problem**: "Order already shipped"  
**Solution**: Order status is "shipped" - check shipment_pin for tracking

**Problem**: Purolator API error  
**Solution**:
1. Verify `.env` credentials
2. Check internet connection
3. Validate address data (postal code, province)
4. See INTEGRATION_GUIDE.md for API errors

### Performance Issues

**Problem**: Slow search with many customers  
**Solution**: Database has indexes - should be fast. Check disk space.

**Problem**: Batch processing timeout  
**Solution**: Process smaller batches (50-100 at a time)

---

## File Reference

### Core Files

| File | Purpose |
|------|---------|
| `address_book_db.py` | Database operations |
| `address_book_api.py` | API for RF scanner/apps |
| `address_book_manager.py` | GUI for managing data |
| `shipping_integration.py` | Purolator integration |
| `batch_shipping_app.py` | Enhanced with address book |
| `purolator_utils.py` | Address/phone parsing |

### Database Files

| File | Purpose |
|------|---------|
| `customer_addresses.db` | SQLite database (auto-created) |

### Sample Files

| File | Purpose |
|------|---------|
| `sample_customers.csv` | Example customer import |
| `sample_locations.csv` | Example location import |
| `example_usage.py` | Usage examples and demos |

### Documentation

| File | Purpose |
|------|---------|
| `ADDRESS_BOOK_GUIDE.md` | This file - complete guide |
| `INTEGRATION_GUIDE.md` | Purolator API integration |
| `RF_INTEGRATION_SUMMARY.md` | RF scanner quick start |

---

## Best Practices

### Customer Management

1. **Use Descriptive Names**: "ABC Corp - Toronto HQ" vs "ABC Corp"
2. **Set Default Locations**: Mark the most-used location as default
3. **Keep Data Updated**: Review and update addresses quarterly
4. **Use Purolator Accounts**: Store account numbers for billing

### Location Management

1. **Descriptive Location Names**: "Toronto Warehouse" not "Location 1"
2. **Verify Postal Codes**: System validates format but not existence
3. **Use Complete Addresses**: Include suite numbers, building names
4. **Phone Numbers**: Any format works - system parses automatically

### Order Management

1. **Unique Order IDs**: Use your existing order numbering system
2. **Track References**: Store PO numbers or customer references
3. **Update Weights**: Accurate weights ensure correct billing
4. **Check Pending Orders**: Regularly ship or cancel old pending orders

### RF Scanner Integration

1. **Error Handling**: Always check `result['status']`
2. **Display Info**: Show customer name and address before shipping
3. **Confirm Before Ship**: Get user confirmation
4. **Store PINs**: Save tracking PINs to your system
5. **Handle Failures**: Log errors and retry or flag for manual processing

---

## Support

### Documentation

- **This Guide**: Complete address book system documentation
- **INTEGRATION_GUIDE.md**: Purolator API technical details
- **RF_INTEGRATION_SUMMARY.md**: Quick RF scanner integration

### Example Code

- **example_usage.py**: Interactive examples of all features
- **test_production_auto.py**: Test Purolator API connection

### Getting Help

1. Check Troubleshooting section above
2. Review example scripts
3. Check error messages carefully
4. Verify database and credentials

---

## Changelog

### Version 1.0 (Current)

- Initial release
- Customer and location management
- Sales order tracking
- Purolator shipping integration
- RF scanner API
- Import/export functionality
- GUI applications
- Complete documentation

---

**Last Updated**: November 2025  
**Version**: 1.0  
**Status**: Production Ready ✅

