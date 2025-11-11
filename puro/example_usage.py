"""
Example Usage Scripts for Address Book and Shipping Integration
Demonstrates how to use the address book system
"""

import os
from dotenv import load_dotenv
from address_book_db import get_db
from address_book_api import get_api
from shipping_integration import get_integration

# Load environment
load_dotenv()


def example_1_setup_database():
    """Example 1: Initial database setup with sample data"""
    print("=" * 60)
    print("EXAMPLE 1: Setup Database with Sample Data")
    print("=" * 60)
    
    db = get_db()
    
    # Add a customer
    print("\n1. Adding customer...")
    customer_id = db.add_customer("Acme Corporation", "7254525")
    print(f"   Created customer ID: {customer_id}")
    
    # Add shipping locations
    print("\n2. Adding shipping locations...")
    
    location1_id = db.add_shipping_location(
        customer_id=customer_id,
        location_name="Toronto Headquarters",
        street="123 Main Street",
        city="Toronto",
        province="ON",
        postal="M5J2R8",
        phone="416-555-1234",
        is_default=True
    )
    print(f"   Created location ID: {location1_id} (default)")
    
    location2_id = db.add_shipping_location(
        customer_id=customer_id,
        location_name="Montreal Branch",
        street="456 Rue Saint-Jacques",
        city="Montreal",
        province="QC",
        postal="H3B1A1",
        phone="514-555-5678",
        is_default=False
    )
    print(f"   Created location ID: {location2_id}")
    
    print("\n✓ Database setup complete!")
    return customer_id, location1_id, location2_id


def example_2_search_and_lookup():
    """Example 2: Search customers and locations"""
    print("\n" + "=" * 60)
    print("EXAMPLE 2: Search and Lookup")
    print("=" * 60)
    
    api = get_api()
    
    # Search customers
    print("\n1. Searching for customers containing 'Corp'...")
    customers = api.search_customers("Corp")
    print(f"   Found {len(customers)} customer(s):")
    for c in customers:
        print(f"   - {c['customer_name']} (ID: {c['customer_id']})")
    
    # Get customer locations
    if customers:
        customer = customers[0]
        print(f"\n2. Getting locations for '{customer['customer_name']}'...")
        locations = api.get_customer_locations(customer['customer_id'])
        print(f"   Found {len(locations)} location(s):")
        for loc in locations:
            default = " [DEFAULT]" if loc['is_default'] else ""
            print(f"   - {loc['location_name']}: {loc['address_city']}, {loc['address_province']}{default}")
    
    # Quick lookup
    print("\n3. Using quick lookup...")
    result = api.quick_lookup("Acme")
    if result['status'] == 'Success':
        print(f"   Customer: {result['customer']['customer_name']}")
        print(f"   Locations: {len(result['locations'])}")
        if result['default_location']:
            print(f"   Default: {result['default_location']['location_name']}")
    
    print("\n✓ Search complete!")


def example_3_get_shipping_address():
    """Example 3: Get formatted shipping address"""
    print("\n" + "=" * 60)
    print("EXAMPLE 3: Get Shipping Address")
    print("=" * 60)
    
    api = get_api()
    
    # Find a customer
    customers = api.search_customers("Acme")
    if not customers:
        print("   No customers found. Run example_1_setup_database() first.")
        return
    
    customer_id = customers[0]['customer_id']
    
    # Get formatted address
    print(f"\n1. Getting shipping address for customer ID {customer_id}...")
    address = api.get_shipping_address(customer_id=customer_id)
    
    if address:
        print("\n   Formatted Address (ready for Purolator):")
        print(f"   Name: {address['receiver_name']}")
        print(f"   Street: {address['receiver_street']}")
        print(f"   City: {address['receiver_city']}")
        print(f"   Province: {address['receiver_province']}")
        print(f"   Postal: {address['receiver_postal']}")
        print(f"   Country: {address['receiver_country']}")
        print(f"   Phone: {address['receiver_phone']}")
        if address['purolator_account']:
            print(f"   Account: {address['purolator_account']}")
    
    print("\n✓ Address retrieved!")


def example_4_create_sales_order():
    """Example 4: Create a sales order"""
    print("\n" + "=" * 60)
    print("EXAMPLE 4: Create Sales Order")
    print("=" * 60)
    
    db = get_db()
    
    # Find customer and location
    customers = db.search_customers("Acme")
    if not customers:
        print("   No customers found. Run example_1_setup_database() first.")
        return None
    
    customer = customers[0]
    locations = db.get_customer_locations(customer['customer_id'])
    if not locations:
        print("   No locations found.")
        return None
    
    location = locations[0]
    
    # Create order
    order_id = f"ORD-{os.urandom(4).hex().upper()}"
    print(f"\n1. Creating sales order {order_id}...")
    
    db.add_sales_order(
        order_id=order_id,
        customer_id=customer['customer_id'],
        location_id=location['location_id'],
        weight="2.5",
        service_id="PurolatorExpress",
        reference=f"Test order for {customer['customer_name']}"
    )
    
    print(f"   Order created successfully!")
    print(f"   Customer: {customer['customer_name']}")
    print(f"   Ship to: {location['location_name']}")
    print(f"   Status: pending")
    
    print("\n✓ Order created!")
    return order_id


def example_5_ship_order():
    """Example 5: Ship a sales order (creates real shipment!)"""
    print("\n" + "=" * 60)
    print("EXAMPLE 5: Ship Sales Order")
    print("=" * 60)
    print("\nWARNING: This creates a REAL Purolator shipment!")
    print("Make sure your API credentials are set in .env file.")
    
    response = input("\nDo you want to continue? (yes/no): ")
    if response.lower() != 'yes':
        print("   Cancelled.")
        return
    
    # Get a pending order
    db = get_db()
    pending = db.get_pending_orders()
    
    if not pending:
        print("\n   No pending orders found.")
        print("   Run example_4_create_sales_order() first.")
        return
    
    order = pending[0]
    print(f"\n1. Shipping order: {order['order_id']}")
    print(f"   Customer: {order['customer_name']}")
    print(f"   Location: {order['location_name']}")
    
    # Ship the order
    api = get_api()
    
    # Package data (optional - will use order defaults if not provided)
    package_data = {
        'weight': order.get('weight', '2.5'),
        'length': '30',
        'width': '20',
        'height': '10',
        'service_id': order.get('service_id', 'PurolatorExpress'),
        'payment_type': 'Sender',
        'reference': order['order_id']
    }
    
    print("\n2. Creating shipment...")
    result = api.ship_order(order['order_id'], package_data)
    
    if result['status'] == 'Success':
        print(f"\n✓ Shipment created successfully!")
        print(f"   Tracking PIN: {result['shipment_pin']}")
        print(f"   Order status updated to 'shipped'")
    else:
        print(f"\n✗ Shipment failed!")
        print(f"   Error: {result.get('message', 'Unknown error')}")


def example_6_batch_import():
    """Example 6: Import customers and locations from CSV"""
    print("\n" + "=" * 60)
    print("EXAMPLE 6: Import from CSV")
    print("=" * 60)
    
    db = get_db()
    
    # Import customers
    if os.path.exists('sample_customers.csv'):
        print("\n1. Importing customers from sample_customers.csv...")
        db.import_from_csv('sample_customers.csv', 'customers')
        print("   Customers imported!")
    
    # Import locations
    if os.path.exists('sample_locations.csv'):
        print("\n2. Importing locations from sample_locations.csv...")
        db.import_from_csv('sample_locations.csv', 'locations')
        print("   Locations imported!")
    
    # Show results
    customers = db.get_all_customers()
    print(f"\n✓ Import complete! Total customers: {len(customers)}")


def example_7_export_data():
    """Example 7: Export data to CSV"""
    print("\n" + "=" * 60)
    print("EXAMPLE 7: Export to CSV")
    print("=" * 60)
    
    db = get_db()
    
    print("\n1. Exporting customers...")
    db.export_customers_to_csv('exported_customers.csv')
    print("   Exported to: exported_customers.csv")
    
    print("\n2. Exporting locations...")
    db.export_locations_to_csv('exported_locations.csv')
    print("   Exported to: exported_locations.csv")
    
    print("\n✓ Export complete!")


def example_8_rf_scanner_workflow():
    """Example 8: Simulate RF scanner workflow"""
    print("\n" + "=" * 60)
    print("EXAMPLE 8: RF Scanner Workflow Simulation")
    print("=" * 60)
    
    api = get_api()
    
    # Step 1: RF scanner scans order barcode
    print("\n[RF SCANNER] Scanning order barcode...")
    order_id = input("Enter order ID (or press Enter to use pending order): ").strip()
    
    if not order_id:
        pending = api.get_pending_orders()
        if pending:
            order_id = pending[0]['order_id']
            print(f"Using pending order: {order_id}")
        else:
            print("No pending orders found.")
            return
    
    # Step 2: Look up order details
    print(f"\n[RF SCANNER] Looking up order {order_id}...")
    order = api.get_order_with_details(order_id)
    
    if not order:
        print("Order not found!")
        return
    
    # Step 3: Display order info
    print("\n[RF SCANNER] Order Details:")
    print(f"  Customer: {order['customer_name']}")
    print(f"  Ship to: {order['location_name']}")
    print(f"  Address: {order['address_street']}, {order['address_city']}")
    print(f"  Status: {order['status']}")
    
    # Step 4: Confirm and ship
    if order['status'] == 'shipped':
        print(f"  Already shipped! PIN: {order['shipment_pin']}")
        return
    
    response = input("\n[RF SCANNER] Ship this order? (yes/no): ")
    if response.lower() != 'yes':
        print("Cancelled.")
        return
    
    # Step 5: Create shipment
    print("\n[RF SCANNER] Creating shipment...")
    result = api.ship_order(order_id)
    
    if result['status'] == 'Success':
        print(f"\n✓ SHIPPED!")
        print(f"  Tracking: {result['shipment_pin']}")
        print(f"  [Print label for PIN: {result['shipment_pin']}]")
    else:
        print(f"\n✗ FAILED!")
        print(f"  Error: {result['message']}")


def main_menu():
    """Display main menu"""
    print("\n" + "=" * 60)
    print("ADDRESS BOOK & SHIPPING SYSTEM - EXAMPLES")
    print("=" * 60)
    print("\nAvailable Examples:")
    print("  1. Setup Database with Sample Data")
    print("  2. Search and Lookup")
    print("  3. Get Shipping Address")
    print("  4. Create Sales Order")
    print("  5. Ship Sales Order (creates REAL shipment!)")
    print("  6. Import from CSV")
    print("  7. Export to CSV")
    print("  8. RF Scanner Workflow Simulation")
    print("  9. Run All Examples (1-4)")
    print("  0. Exit")
    
    choice = input("\nSelect example (0-9): ").strip()
    
    if choice == '1':
        example_1_setup_database()
    elif choice == '2':
        example_2_search_and_lookup()
    elif choice == '3':
        example_3_get_shipping_address()
    elif choice == '4':
        example_4_create_sales_order()
    elif choice == '5':
        example_5_ship_order()
    elif choice == '6':
        example_6_batch_import()
    elif choice == '7':
        example_7_export_data()
    elif choice == '8':
        example_8_rf_scanner_workflow()
    elif choice == '9':
        example_1_setup_database()
        example_2_search_and_lookup()
        example_3_get_shipping_address()
        example_4_create_sales_order()
    elif choice == '0':
        print("\nGoodbye!")
        return False
    else:
        print("\nInvalid choice!")
    
    return True


if __name__ == '__main__':
    print("\nWelcome to Address Book & Shipping System Examples!")
    print("=" * 60)
    
    # Check if database exists
    if not os.path.exists('customer_addresses.db'):
        print("\n⚠ No database found. Creating new database...")
        db = get_db()
        print("✓ Database initialized!")
    
    # Main loop
    while main_menu():
        input("\nPress Enter to continue...")
    
    print("\n" + "=" * 60)

