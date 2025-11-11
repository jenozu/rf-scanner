"""
Address Book API for RF Scanner Integration
Simple API functions for RF scanners to query customer addresses and create shipments
"""

import os
from typing import Dict, List, Optional
from dotenv import load_dotenv
from address_book_db import get_db
from shipping_integration import get_integration

# Load environment
load_dotenv()


class AddressBookAPI:
    """Simple API for RF scanner integration"""
    
    def __init__(self, db_path: str = None):
        """
        Initialize API
        
        Args:
            db_path: Optional custom database path
        """
        self.db = get_db(db_path)
        self.integration = get_integration(db_path)
    
    # ========== LOOKUP FUNCTIONS ==========
    
    def get_customer_by_id(self, customer_id: int) -> Optional[Dict]:
        """
        Get customer by ID
        
        Args:
            customer_id: Customer ID
            
        Returns:
            Customer dictionary or None
        """
        return self.db.get_customer(customer_id)
    
    def get_customer_by_name(self, name: str) -> Optional[Dict]:
        """
        Get customer by name (first match)
        
        Args:
            name: Customer name (partial match supported)
            
        Returns:
            Customer dictionary or None
        """
        customers = self.db.search_customers(name)
        return customers[0] if customers else None
    
    def get_location_by_id(self, location_id: int) -> Optional[Dict]:
        """
        Get shipping location by ID
        
        Args:
            location_id: Location ID
            
        Returns:
            Location dictionary or None
        """
        return self.db.get_shipping_location(location_id)
    
    def get_customer_locations(self, customer_id: int) -> List[Dict]:
        """
        Get all shipping locations for a customer
        
        Args:
            customer_id: Customer ID
            
        Returns:
            List of location dictionaries
        """
        return self.db.get_customer_locations(customer_id)
    
    def get_default_location(self, customer_id: int) -> Optional[Dict]:
        """
        Get default shipping location for a customer
        
        Args:
            customer_id: Customer ID
            
        Returns:
            Location dictionary or None
        """
        return self.db.get_default_location(customer_id)
    
    def search_customers(self, search_term: str) -> List[Dict]:
        """
        Search for customers
        
        Args:
            search_term: Search term
            
        Returns:
            List of customer dictionaries
        """
        return self.db.search_customers(search_term)
    
    def search_locations(self, search_term: str) -> List[Dict]:
        """
        Search for locations across all customers
        
        Args:
            search_term: Search term (name, city, postal, etc.)
            
        Returns:
            List of location dictionaries with customer names
        """
        return self.db.search_locations(search_term)
    
    # ========== ORDER FUNCTIONS ==========
    
    def get_order(self, order_id: str) -> Optional[Dict]:
        """
        Get sales order by ID
        
        Args:
            order_id: Order ID
            
        Returns:
            Order dictionary or None
        """
        return self.db.get_sales_order(order_id)
    
    def get_order_with_details(self, order_id: str) -> Optional[Dict]:
        """
        Get sales order with full customer and location details
        
        Args:
            order_id: Order ID
            
        Returns:
            Dictionary with combined order, customer, and location data
        """
        return self.db.get_order_with_details(order_id)
    
    def get_pending_orders(self) -> List[Dict]:
        """
        Get all pending sales orders
        
        Returns:
            List of pending order dictionaries
        """
        return self.db.get_pending_orders()
    
    def create_order(self, order_id: str, customer_id: int, location_id: int,
                    weight: str = None, service_id: str = None, 
                    reference: str = None) -> Dict:
        """
        Create a new sales order
        
        Args:
            order_id: Unique order ID
            customer_id: Customer ID
            location_id: Shipping location ID
            weight: Package weight (kg)
            service_id: Purolator service ID
            reference: Additional reference
            
        Returns:
            Result dictionary with success status
        """
        try:
            self.db.add_sales_order(order_id, customer_id, location_id, 
                                   weight, service_id, reference)
            return {'status': 'Success', 'message': 'Order created'}
        except Exception as e:
            return {'status': 'Error', 'message': str(e)}
    
    # ========== SHIPPING FUNCTIONS ==========
    
    def ship_order(self, order_id: str, package_data: Dict = None) -> Dict:
        """
        Create shipment for a sales order
        
        Args:
            order_id: Sales order ID
            package_data: Optional package details (weight, dimensions, service)
            
        Returns:
            Result dictionary with shipment_pin and status
        """
        sender_data = self.integration.get_default_sender_data()
        return self.integration.ship_sales_order(order_id, sender_data, package_data)
    
    def ship_to_location(self, location_id: int, package_data: Dict) -> Dict:
        """
        Create shipment directly to a location
        
        Args:
            location_id: Shipping location ID
            package_data: Package details (weight, dimensions, service, reference)
            
        Returns:
            Result dictionary with shipment_pin and status
        """
        sender_data = self.integration.get_default_sender_data()
        return self.integration.ship_to_location(location_id, sender_data, package_data)
    
    def ship_to_customer(self, customer_id: int, package_data: Dict, 
                        location_id: int = None) -> Dict:
        """
        Create shipment to a customer (uses default location if not specified)
        
        Args:
            customer_id: Customer ID
            package_data: Package details
            location_id: Optional specific location ID (uses default if None)
            
        Returns:
            Result dictionary with shipment_pin and status
        """
        # Get location
        if location_id:
            location = self.db.get_shipping_location(location_id)
        else:
            location = self.db.get_default_location(customer_id)
        
        if not location:
            return {
                'status': 'Error',
                'message': f'No location found for customer {customer_id}'
            }
        
        return self.ship_to_location(location['location_id'], package_data)
    
    def batch_ship_orders(self, order_ids: List[str]) -> List[Dict]:
        """
        Create shipments for multiple orders
        
        Args:
            order_ids: List of order IDs
            
        Returns:
            List of result dictionaries
        """
        sender_data = self.integration.get_default_sender_data()
        return self.integration.batch_ship_orders(order_ids, sender_data)
    
    # ========== CONVENIENCE FUNCTIONS ==========
    
    def quick_lookup(self, search_term: str) -> Dict:
        """
        Quick lookup by any search term (customer name, location, etc.)
        Returns first match with all relevant info
        
        Args:
            search_term: Search term
            
        Returns:
            Dictionary with customer and location info, or error
        """
        # Try customer search first
        customers = self.search_customers(search_term)
        if customers:
            customer = customers[0]
            locations = self.get_customer_locations(customer['customer_id'])
            return {
                'status': 'Success',
                'customer': customer,
                'locations': locations,
                'default_location': self.get_default_location(customer['customer_id'])
            }
        
        # Try location search
        locations = self.search_locations(search_term)
        if locations:
            location = locations[0]
            customer = self.get_customer_by_id(location['customer_id'])
            return {
                'status': 'Success',
                'customer': customer,
                'locations': [location],
                'default_location': location if location.get('is_default') else None
            }
        
        return {
            'status': 'Error',
            'message': f'No results found for "{search_term}"'
        }
    
    def get_shipping_address(self, customer_id: int = None, location_id: int = None) -> Optional[Dict]:
        """
        Get formatted shipping address ready for Purolator
        
        Args:
            customer_id: Customer ID (uses default location)
            location_id: Specific location ID (takes precedence)
            
        Returns:
            Formatted address dictionary or None
        """
        if location_id:
            location = self.db.get_shipping_location(location_id)
        elif customer_id:
            location = self.db.get_default_location(customer_id)
        else:
            return None
        
        if not location:
            return None
        
        customer = self.db.get_customer(location['customer_id'])
        
        return {
            'receiver_name': customer['customer_name'] if customer else location['location_name'],
            'receiver_street': location['address_street'],
            'receiver_city': location['address_city'],
            'receiver_province': location['address_province'],
            'receiver_postal': location['address_postal'],
            'receiver_country': location.get('address_country', 'CA'),
            'receiver_phone': location['phone_number'],
            'purolator_account': customer.get('purolator_account_number') if customer else None
        }


# Module-level convenience functions
_api_instance = None

def get_api(db_path: str = None) -> AddressBookAPI:
    """
    Get API instance (singleton pattern)
    
    Args:
        db_path: Optional custom database path
        
    Returns:
        AddressBookAPI instance
    """
    global _api_instance
    if _api_instance is None:
        _api_instance = AddressBookAPI(db_path)
    return _api_instance


# Quick access functions
def lookup_customer(search_term: str) -> Optional[Dict]:
    """Quick customer lookup"""
    return get_api().get_customer_by_name(search_term)


def lookup_order(order_id: str) -> Optional[Dict]:
    """Quick order lookup with full details"""
    return get_api().get_order_with_details(order_id)


def get_address(customer_id: int = None, location_id: int = None) -> Optional[Dict]:
    """Quick address lookup"""
    return get_api().get_shipping_address(customer_id, location_id)


def create_shipment(order_id: str, package_data: Dict = None) -> Dict:
    """Quick shipment creation from order"""
    return get_api().ship_order(order_id, package_data)


if __name__ == '__main__':
    # Example usage
    print("Address Book API - Example Usage\n")
    
    api = get_api()
    
    # Example 1: Search for a customer
    print("Example 1: Search for customers")
    customers = api.search_customers("Test")
    print(f"Found {len(customers)} customer(s)")
    for c in customers:
        print(f"  - {c['customer_name']} (ID: {c['customer_id']})")
    
    # Example 2: Get customer locations
    if customers:
        print(f"\nExample 2: Get locations for {customers[0]['customer_name']}")
        locations = api.get_customer_locations(customers[0]['customer_id'])
        print(f"Found {len(locations)} location(s)")
        for loc in locations:
            print(f"  - {loc['location_name']}: {loc['address_city']}, {loc['address_province']}")
    
    # Example 3: Quick lookup
    print("\nExample 3: Quick lookup")
    result = api.quick_lookup("Test")
    if result['status'] == 'Success':
        print(f"Customer: {result['customer']['customer_name']}")
        print(f"Locations: {len(result['locations'])}")
    
    # Example 4: Get formatted address
    if customers:
        print(f"\nExample 4: Get shipping address")
        address = api.get_shipping_address(customer_id=customers[0]['customer_id'])
        if address:
            print(f"  Name: {address['receiver_name']}")
            print(f"  Address: {address['receiver_street']}, {address['receiver_city']}")
    
    print("\n✓ API ready for RF scanner integration!")

