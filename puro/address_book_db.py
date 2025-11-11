"""
Address Book Database Module
Manages customer addresses, shipping locations, and sales orders for Purolator shipping
"""

import sqlite3
import os
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from contextlib import contextmanager
from purolator_utils import validate_postal_code, format_postal_code


class AddressBookDB:
    """Database manager for customer addresses and shipping locations"""
    
    def __init__(self, db_path: str = "customer_addresses.db"):
        """
        Initialize database connection
        
        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self.init_database()
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable column access by name
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def init_database(self):
        """Initialize database schema"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Customers table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS customers (
                    customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_name TEXT NOT NULL,
                    purolator_account_number TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Shipping locations table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS shipping_locations (
                    location_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL,
                    location_name TEXT NOT NULL,
                    address_street TEXT NOT NULL,
                    address_city TEXT NOT NULL,
                    address_province TEXT NOT NULL,
                    address_postal TEXT NOT NULL,
                    address_country TEXT NOT NULL DEFAULT 'CA',
                    phone_number TEXT NOT NULL,
                    is_default INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
                )
            ''')
            
            # Sales orders table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sales_orders (
                    order_id TEXT PRIMARY KEY,
                    customer_id INTEGER NOT NULL,
                    location_id INTEGER NOT NULL,
                    shipment_pin TEXT,
                    status TEXT DEFAULT 'pending',
                    weight TEXT,
                    service_id TEXT,
                    reference TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    shipped_at TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES customers (customer_id),
                    FOREIGN KEY (location_id) REFERENCES shipping_locations (location_id)
                )
            ''')
            
            # Create indexes for better performance
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_customer_name 
                ON customers(customer_name)
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_location_customer 
                ON shipping_locations(customer_id)
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_order_status 
                ON sales_orders(status)
            ''')
    
    # ========== CUSTOMER OPERATIONS ==========
    
    def add_customer(self, customer_name: str, purolator_account: str = None) -> int:
        """
        Add a new customer
        
        Args:
            customer_name: Name of the customer
            purolator_account: Optional Purolator account number
            
        Returns:
            customer_id of the newly created customer
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO customers (customer_name, purolator_account_number)
                VALUES (?, ?)
            ''', (customer_name, purolator_account))
            return cursor.lastrowid
    
    def update_customer(self, customer_id: int, customer_name: str = None, 
                       purolator_account: str = None) -> bool:
        """
        Update customer information
        
        Args:
            customer_id: ID of the customer to update
            customer_name: New customer name (optional)
            purolator_account: New Purolator account number (optional)
            
        Returns:
            True if update successful
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            updates = []
            params = []
            
            if customer_name is not None:
                updates.append("customer_name = ?")
                params.append(customer_name)
            
            if purolator_account is not None:
                updates.append("purolator_account_number = ?")
                params.append(purolator_account)
            
            if not updates:
                return False
            
            updates.append("updated_at = ?")
            params.append(datetime.now())
            params.append(customer_id)
            
            query = f"UPDATE customers SET {', '.join(updates)} WHERE customer_id = ?"
            cursor.execute(query, params)
            
            return cursor.rowcount > 0
    
    def delete_customer(self, customer_id: int) -> bool:
        """
        Delete a customer and all associated locations and orders
        
        Args:
            customer_id: ID of the customer to delete
            
        Returns:
            True if deletion successful
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Delete associated sales orders
            cursor.execute('DELETE FROM sales_orders WHERE customer_id = ?', (customer_id,))
            
            # Delete associated shipping locations
            cursor.execute('DELETE FROM shipping_locations WHERE customer_id = ?', (customer_id,))
            
            # Delete customer
            cursor.execute('DELETE FROM customers WHERE customer_id = ?', (customer_id,))
            
            return cursor.rowcount > 0
    
    def get_customer(self, customer_id: int) -> Optional[Dict]:
        """
        Get customer by ID
        
        Args:
            customer_id: ID of the customer
            
        Returns:
            Dictionary with customer data or None
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM customers WHERE customer_id = ?', (customer_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def search_customers(self, search_term: str = None) -> List[Dict]:
        """
        Search for customers by name
        
        Args:
            search_term: Search term (searches in customer name)
            
        Returns:
            List of customer dictionaries
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            if search_term:
                cursor.execute('''
                    SELECT * FROM customers 
                    WHERE customer_name LIKE ? 
                    ORDER BY customer_name
                ''', (f'%{search_term}%',))
            else:
                cursor.execute('SELECT * FROM customers ORDER BY customer_name')
            
            return [dict(row) for row in cursor.fetchall()]
    
    def get_all_customers(self) -> List[Dict]:
        """
        Get all customers
        
        Returns:
            List of all customer dictionaries
        """
        return self.search_customers()
    
    # ========== SHIPPING LOCATION OPERATIONS ==========
    
    def add_shipping_location(self, customer_id: int, location_name: str,
                             street: str, city: str, province: str,
                             postal: str, phone: str, country: str = 'CA',
                             is_default: bool = False) -> int:
        """
        Add a shipping location for a customer
        
        Args:
            customer_id: ID of the customer
            location_name: Name/description of the location
            street: Street address
            city: City
            province: Province/state code
            postal: Postal/ZIP code
            phone: Phone number
            country: Country code (default: CA)
            is_default: Set as default location for this customer
            
        Returns:
            location_id of the newly created location
        """
        # Format postal code
        postal = format_postal_code(postal)
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # If this is set as default, unset other defaults for this customer
            if is_default:
                cursor.execute('''
                    UPDATE shipping_locations 
                    SET is_default = 0 
                    WHERE customer_id = ?
                ''', (customer_id,))
            
            cursor.execute('''
                INSERT INTO shipping_locations 
                (customer_id, location_name, address_street, address_city, 
                 address_province, address_postal, address_country, phone_number, is_default)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (customer_id, location_name, street, city, province, postal, 
                  country, phone, 1 if is_default else 0))
            
            return cursor.lastrowid
    
    def update_shipping_location(self, location_id: int, **kwargs) -> bool:
        """
        Update a shipping location
        
        Args:
            location_id: ID of the location to update
            **kwargs: Fields to update (location_name, address_street, etc.)
            
        Returns:
            True if update successful
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Handle is_default specially
            if kwargs.get('is_default'):
                # Get customer_id for this location
                cursor.execute('SELECT customer_id FROM shipping_locations WHERE location_id = ?', 
                             (location_id,))
                result = cursor.fetchone()
                if result:
                    customer_id = result[0]
                    # Unset other defaults
                    cursor.execute('''
                        UPDATE shipping_locations 
                        SET is_default = 0 
                        WHERE customer_id = ?
                    ''', (customer_id,))
            
            # Format postal code if provided
            if 'address_postal' in kwargs:
                kwargs['address_postal'] = format_postal_code(kwargs['address_postal'])
            
            updates = []
            params = []
            
            for key, value in kwargs.items():
                updates.append(f"{key} = ?")
                params.append(value)
            
            if not updates:
                return False
            
            updates.append("updated_at = ?")
            params.append(datetime.now())
            params.append(location_id)
            
            query = f"UPDATE shipping_locations SET {', '.join(updates)} WHERE location_id = ?"
            cursor.execute(query, params)
            
            return cursor.rowcount > 0
    
    def delete_shipping_location(self, location_id: int) -> bool:
        """
        Delete a shipping location
        
        Args:
            location_id: ID of the location to delete
            
        Returns:
            True if deletion successful
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM shipping_locations WHERE location_id = ?', (location_id,))
            return cursor.rowcount > 0
    
    def get_shipping_location(self, location_id: int) -> Optional[Dict]:
        """
        Get shipping location by ID
        
        Args:
            location_id: ID of the location
            
        Returns:
            Dictionary with location data or None
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM shipping_locations WHERE location_id = ?', (location_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_customer_locations(self, customer_id: int) -> List[Dict]:
        """
        Get all shipping locations for a customer
        
        Args:
            customer_id: ID of the customer
            
        Returns:
            List of location dictionaries
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM shipping_locations 
                WHERE customer_id = ? 
                ORDER BY is_default DESC, location_name
            ''', (customer_id,))
            return [dict(row) for row in cursor.fetchall()]
    
    def get_default_location(self, customer_id: int) -> Optional[Dict]:
        """
        Get the default shipping location for a customer
        
        Args:
            customer_id: ID of the customer
            
        Returns:
            Dictionary with location data or None
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM shipping_locations 
                WHERE customer_id = ? AND is_default = 1
            ''', (customer_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    # ========== SALES ORDER OPERATIONS ==========
    
    def add_sales_order(self, order_id: str, customer_id: int, location_id: int,
                       weight: str = None, service_id: str = None, 
                       reference: str = None) -> bool:
        """
        Add a sales order
        
        Args:
            order_id: Unique order ID
            customer_id: ID of the customer
            location_id: ID of the shipping location
            weight: Package weight
            service_id: Purolator service ID
            reference: Additional reference
            
        Returns:
            True if successful
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO sales_orders 
                (order_id, customer_id, location_id, weight, service_id, reference)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (order_id, customer_id, location_id, weight, service_id, reference))
            return True
    
    def update_order_status(self, order_id: str, status: str, 
                           shipment_pin: str = None) -> bool:
        """
        Update sales order status
        
        Args:
            order_id: Order ID to update
            status: New status (pending, shipped, cancelled)
            shipment_pin: Purolator tracking PIN (optional)
            
        Returns:
            True if update successful
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            if status == 'shipped':
                cursor.execute('''
                    UPDATE sales_orders 
                    SET status = ?, shipment_pin = ?, shipped_at = ?
                    WHERE order_id = ?
                ''', (status, shipment_pin, datetime.now(), order_id))
            else:
                cursor.execute('''
                    UPDATE sales_orders 
                    SET status = ?
                    WHERE order_id = ?
                ''', (status, order_id))
            
            return cursor.rowcount > 0
    
    def get_sales_order(self, order_id: str) -> Optional[Dict]:
        """
        Get sales order by ID
        
        Args:
            order_id: Order ID
            
        Returns:
            Dictionary with order data or None
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM sales_orders WHERE order_id = ?', (order_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_pending_orders(self) -> List[Dict]:
        """
        Get all pending sales orders
        
        Returns:
            List of pending order dictionaries
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT so.*, c.customer_name, sl.location_name
                FROM sales_orders so
                JOIN customers c ON so.customer_id = c.customer_id
                JOIN shipping_locations sl ON so.location_id = sl.location_id
                WHERE so.status = 'pending'
                ORDER BY so.created_at
            ''')
            return [dict(row) for row in cursor.fetchall()]
    
    def get_customer_orders(self, customer_id: int, status: str = None) -> List[Dict]:
        """
        Get all orders for a customer
        
        Args:
            customer_id: ID of the customer
            status: Optional status filter
            
        Returns:
            List of order dictionaries
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            if status:
                cursor.execute('''
                    SELECT * FROM sales_orders 
                    WHERE customer_id = ? AND status = ?
                    ORDER BY created_at DESC
                ''', (customer_id, status))
            else:
                cursor.execute('''
                    SELECT * FROM sales_orders 
                    WHERE customer_id = ?
                    ORDER BY created_at DESC
                ''', (customer_id,))
            
            return [dict(row) for row in cursor.fetchall()]
    
    # ========== COMBINED QUERIES ==========
    
    def get_order_with_details(self, order_id: str) -> Optional[Dict]:
        """
        Get sales order with full customer and location details
        
        Args:
            order_id: Order ID
            
        Returns:
            Dictionary with combined order, customer, and location data
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT 
                    so.*,
                    c.customer_name, c.purolator_account_number,
                    sl.location_name, sl.address_street, sl.address_city,
                    sl.address_province, sl.address_postal, sl.address_country,
                    sl.phone_number
                FROM sales_orders so
                JOIN customers c ON so.customer_id = c.customer_id
                JOIN shipping_locations sl ON so.location_id = sl.location_id
                WHERE so.order_id = ?
            ''', (order_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def search_locations(self, search_term: str) -> List[Dict]:
        """
        Search shipping locations across all customers
        
        Args:
            search_term: Search term (searches in location name, city, postal)
            
        Returns:
            List of location dictionaries with customer names
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT sl.*, c.customer_name
                FROM shipping_locations sl
                JOIN customers c ON sl.customer_id = c.customer_id
                WHERE sl.location_name LIKE ? 
                   OR sl.address_city LIKE ?
                   OR sl.address_postal LIKE ?
                   OR c.customer_name LIKE ?
                ORDER BY c.customer_name, sl.location_name
            ''', (f'%{search_term}%', f'%{search_term}%', 
                  f'%{search_term}%', f'%{search_term}%'))
            return [dict(row) for row in cursor.fetchall()]
    
    # ========== EXPORT OPERATIONS ==========
    
    def export_customers_to_csv(self, filepath: str):
        """
        Export all customers to CSV file
        
        Args:
            filepath: Path to output CSV file
        """
        import csv
        
        customers = self.get_all_customers()
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            if customers:
                writer = csv.DictWriter(f, fieldnames=customers[0].keys())
                writer.writeheader()
                writer.writerows(customers)
    
    def export_locations_to_csv(self, filepath: str):
        """
        Export all shipping locations to CSV file
        
        Args:
            filepath: Path to output CSV file
        """
        import csv
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT sl.*, c.customer_name
                FROM shipping_locations sl
                JOIN customers c ON sl.customer_id = c.customer_id
                ORDER BY c.customer_name, sl.location_name
            ''')
            locations = [dict(row) for row in cursor.fetchall()]
        
        if locations:
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=locations[0].keys())
                writer.writeheader()
                writer.writerows(locations)
    
    def import_from_csv(self, filepath: str, import_type: str = 'locations'):
        """
        Import customers or locations from CSV
        
        Args:
            filepath: Path to CSV file
            import_type: 'customers' or 'locations'
        """
        import csv
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            if import_type == 'customers':
                for row in reader:
                    self.add_customer(
                        customer_name=row['customer_name'],
                        purolator_account=row.get('purolator_account_number')
                    )
            
            elif import_type == 'locations':
                for row in reader:
                    # Look up or create customer
                    customer_name = row.get('customer_name')
                    if customer_name:
                        customers = self.search_customers(customer_name)
                        if customers:
                            customer_id = customers[0]['customer_id']
                        else:
                            customer_id = self.add_customer(customer_name)
                    else:
                        customer_id = int(row['customer_id'])
                    
                    self.add_shipping_location(
                        customer_id=customer_id,
                        location_name=row['location_name'],
                        street=row['address_street'],
                        city=row['address_city'],
                        province=row['address_province'],
                        postal=row['address_postal'],
                        phone=row['phone_number'],
                        country=row.get('address_country', 'CA'),
                        is_default=bool(int(row.get('is_default', 0)))
                    )


# Convenience functions for quick access
def get_db(db_path: str = None) -> AddressBookDB:
    """
    Get database instance
    
    Args:
        db_path: Optional custom database path
        
    Returns:
        AddressBookDB instance
    """
    if db_path is None:
        db_path = os.getenv('ADDRESS_BOOK_DB', 'customer_addresses.db')
    return AddressBookDB(db_path)


if __name__ == '__main__':
    # Example usage and testing
    print("Initializing Address Book Database...")
    db = get_db()
    
    print("\nDatabase initialized successfully!")
    print(f"Database location: {db.db_path}")
    
    # Add a test customer
    print("\nAdding test customer...")
    customer_id = db.add_customer("Test Customer Inc.", "1234567")
    print(f"Created customer with ID: {customer_id}")
    
    # Add a test location
    print("\nAdding test location...")
    location_id = db.add_shipping_location(
        customer_id=customer_id,
        location_name="Main Office",
        street="123 Test Street",
        city="Toronto",
        province="ON",
        postal="M5J2R8",
        phone="416-555-1234",
        is_default=True
    )
    print(f"Created location with ID: {location_id}")
    
    # Query back
    print("\nQuerying customer...")
    customer = db.get_customer(customer_id)
    print(f"Customer: {customer['customer_name']}")
    
    locations = db.get_customer_locations(customer_id)
    print(f"Found {len(locations)} location(s) for this customer")
    
    print("\n✓ Database setup complete and tested!")

