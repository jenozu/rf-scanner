# Quick Reference Card - Address Book System

## 🚀 Commands to Remember

### Initialize System (First Time Only)
```bash
python address_book_db.py
```

### Launch Applications
```bash
python address_book_manager.py    # Manage customers & locations
python batch_shipping_app.py      # Create shipments (with address book)
python example_usage.py           # Interactive examples
```

---

## 📦 Common Tasks

### Add Customer & Location (GUI)
1. `python address_book_manager.py`
2. Customers tab → Add New Customer
3. Locations tab → Select customer → Add Location

### Ship Single Package (GUI)
1. `python batch_shipping_app.py`
2. Single Shipment tab
3. Click "📚 Select from Address Book"
4. Search & select
5. Adjust weight/dims
6. Create Shipment

### Import Data (GUI)
1. `python address_book_manager.py`
2. Import/Export tab
3. Click "Import Customers" or "Import Locations"
4. Select CSV file

---

## 💻 Code Snippets

### RF Scanner: Look up Order
```python
from address_book_api import lookup_order
order = lookup_order("ORD-12345")
print(order['customer_name'], order['address_street'])
```

### RF Scanner: Create Shipment
```python
from address_book_api import create_shipment
result = create_shipment("ORD-12345", {'weight': '3.5'})
print(result['shipment_pin'])
```

### Add Customer (Code)
```python
from address_book_db import get_db
db = get_db()
customer_id = db.add_customer("Company Name", "Purolator#")
```

### Add Location (Code)
```python
location_id = db.add_shipping_location(
    customer_id=1,
    location_name="Toronto Office",
    street="123 Main St",
    city="Toronto",
    province="ON",
    postal="M5J2R8",
    phone="416-555-1234",
    is_default=True
)
```

### Search Anything (Code)
```python
from address_book_api import get_api
api = get_api()
result = api.quick_lookup("search term")
```

---

## 📊 Database Tables

### customers
- customer_id, customer_name, purolator_account_number

### shipping_locations
- location_id, customer_id, location_name
- address_street, address_city, address_province, address_postal, address_country
- phone_number, is_default

### sales_orders
- order_id, customer_id, location_id
- shipment_pin, status (pending/shipped/cancelled)
- weight, service_id, reference

---

## 🔍 API Quick Reference

### Lookup Functions
```python
from address_book_api import get_api
api = get_api()

api.search_customers("term")        # Find customers
api.search_locations("term")        # Find locations
api.quick_lookup("anything")        # Search everything
api.get_customer_by_name("name")    # Get customer
api.get_default_location(cust_id)   # Get default address
```

### Shipping Functions
```python
api.ship_order("ORD-123")           # Ship order
api.ship_to_location(loc_id, pkg)   # Ship to location
api.ship_to_customer(cust_id, pkg)  # Ship to customer
api.batch_ship_orders(order_ids)    # Ship multiple
```

### Order Functions
```python
api.get_order("ORD-123")            # Get order
api.get_order_with_details("ORD")   # Order + full details
api.get_pending_orders()            # All pending
api.create_order(id, cust, loc)     # New order
```

---

## 🔧 Configuration

### .env File
```env
PUROLATOR_API_USERNAME=your_username
PUROLATOR_API_PASSWORD=your_password
PUROLATOR_API_ACCOUNT=your_account

DEFAULT_SENDER_NAME=Your Warehouse
DEFAULT_SENDER_STREET=Your Address
DEFAULT_SENDER_CITY=Your City
DEFAULT_SENDER_PROVINCE=ON
DEFAULT_SENDER_POSTAL=M5J2R8
DEFAULT_SENDER_PHONE=416-555-1234
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `address_book_db.py` | Database operations |
| `address_book_api.py` | RF scanner API |
| `address_book_manager.py` | Management GUI |
| `batch_shipping_app.py` | Shipping GUI |
| `shipping_integration.py` | Purolator integration |
| `example_usage.py` | Interactive examples |

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| No Address Book tab | Run `python address_book_db.py` |
| Database locked | Close all apps using database |
| Import fails | Check CSV format, use template |
| Shipment fails | Verify credentials in .env |

---

## 📖 Documentation

- **Quick Start**: `ADDRESS_BOOK_README.md`
- **Complete Guide**: `ADDRESS_BOOK_GUIDE.md`
- **Purolator API**: `INTEGRATION_GUIDE.md`
- **Implementation**: `IMPLEMENTATION_COMPLETE.md`

---

## 🎯 Workflows

### Single Package Workflow
```
Open Batch App → Address Book tab → Search →
Select → Form auto-fills → Adjust → Ship
```

### Batch Workflow
```
Create orders → Mark pending → Export CSV →
Load in Batch tab → Process → Tracking PINs stored
```

### RF Scanner Workflow
```
Scan barcode → lookup_order() → Display info →
Confirm → create_shipment() → Print label
```

---

## ✅ Quick Checklist

First Time Setup:
- [ ] Run `python address_book_db.py`
- [ ] Configure `.env` with warehouse info
- [ ] Import sample data (optional)
- [ ] Add your first customer
- [ ] Add customer location
- [ ] Test single shipment

Production Ready:
- [ ] Import all customers
- [ ] Set default locations
- [ ] Test with real address
- [ ] Integrate RF scanner (if needed)
- [ ] Train staff
- [ ] Start shipping!

---

**Print this page for quick reference at your desk!**

🟢 System Ready | 📦 Start Shipping | 🚀 Full Speed Ahead

