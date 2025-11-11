"""
Shipping Integration Module
Connects address book database with Purolator shipping API
"""

import os
from typing import Dict, List, Optional
from dotenv import load_dotenv
from address_book_db import AddressBookDB, get_db
from batch_shipping_app import BatchShippingApp
from purolator_utils import validate_shipment_data


class ShippingIntegration:
    """
    Integration layer between address book and Purolator API
    """
    
    def __init__(self, db_path: str = None):
        """
        Initialize shipping integration
        
        Args:
            db_path: Optional custom database path
        """
        load_dotenv()
        
        # Initialize database
        self.db = get_db(db_path)
        
        # Initialize Purolator shipping app
        self.shipping_app = BatchShippingApp.__new__(BatchShippingApp)
        self.shipping_app.username = os.getenv("PUROLATOR_API_USERNAME")
        self.shipping_app.password = os.getenv("PUROLATOR_API_PASSWORD")
        self.shipping_app.account = os.getenv("PUROLATOR_API_ACCOUNT")
        self.shipping_app.shipment_url = "https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx"
        self.shipping_app.documents_url = "https://webservices.purolator.com/EWS/V1/ShippingDocuments/ShippingDocumentsService.asmx"
    
    def convert_location_to_shipment_data(self, location: Dict, 
                                         sender_data: Dict,
                                         package_data: Dict) -> Dict:
        """
        Convert address book location to Purolator shipment format
        
        Args:
            location: Location dictionary from database
            sender_data: Sender information dictionary
            package_data: Package details (weight, dimensions, service)
            
        Returns:
            Dictionary formatted for Purolator API
        """
        shipment_data = {
            # Sender information
            'sender_name': sender_data.get('sender_name', 'Your Warehouse'),
            'sender_street': sender_data.get('sender_street', '123 Main St'),
            'sender_city': sender_data.get('sender_city', 'Toronto'),
            'sender_province': sender_data.get('sender_province', 'ON'),
            'sender_postal': sender_data.get('sender_postal', 'M5J2R8'),
            'sender_phone': sender_data.get('sender_phone', '416-555-1234'),
            
            # Receiver information from location
            'receiver_name': location.get('customer_name', location.get('location_name', 'Unknown')),
            'receiver_street': location['address_street'],
            'receiver_city': location['address_city'],
            'receiver_province': location['address_province'],
            'receiver_postal': location['address_postal'],
            'receiver_country': location.get('address_country', 'CA'),
            'receiver_phone': location['phone_number'],
            
            # Package information
            'service_id': package_data.get('service_id', 'PurolatorExpress'),
            'weight': package_data.get('weight', '2.5'),
            'length': package_data.get('length', '30'),
            'width': package_data.get('width', '20'),
            'height': package_data.get('height', '10'),
            'payment_type': package_data.get('payment_type', 'Sender'),
            'reference': package_data.get('reference', '')
        }
        
        return shipment_data
    
    def ship_to_location(self, location_id: int, sender_data: Dict, 
                        package_data: Dict) -> Dict:
        """
        Create shipment to a specific location
        
        Args:
            location_id: ID of the shipping location
            sender_data: Sender information
            package_data: Package details
            
        Returns:
            Result dictionary with shipment_pin and status
        """
        # Get location from database
        location = self.db.get_shipping_location(location_id)
        if not location:
            return {
                'status': 'Error',
                'message': f'Location {location_id} not found'
            }
        
        # Get customer name for the receiver
        customer = self.db.get_customer(location['customer_id'])
        if customer:
            location['customer_name'] = customer['customer_name']
        
        # Convert to shipment format
        shipment_data = self.convert_location_to_shipment_data(
            location, sender_data, package_data
        )
        
        # Validate data
        is_valid, error_msg = validate_shipment_data(shipment_data)
        if not is_valid:
            return {
                'status': 'Error',
                'message': f'Validation failed: {error_msg}'
            }
        
        # Create shipment
        result = self.shipping_app.create_shipment_from_data(shipment_data)
        
        return result
    
    def ship_sales_order(self, order_id: str, sender_data: Dict, 
                        package_data: Dict = None) -> Dict:
        """
        Create shipment for a sales order
        
        Args:
            order_id: Sales order ID
            sender_data: Sender information
            package_data: Optional package details (uses order data if not provided)
            
        Returns:
            Result dictionary with shipment_pin and status
        """
        # Get order with full details
        order = self.db.get_order_with_details(order_id)
        if not order:
            return {
                'status': 'Error',
                'message': f'Order {order_id} not found'
            }
        
        # Check if already shipped
        if order['status'] == 'shipped':
            return {
                'status': 'Error',
                'message': f'Order {order_id} already shipped (PIN: {order.get("shipment_pin")})'
            }
        
        # Use order data if package_data not provided
        if package_data is None:
            package_data = {
                'weight': order.get('weight', '2.5'),
                'service_id': order.get('service_id', 'PurolatorExpress'),
                'reference': order.get('reference', order_id),
                'length': '30',
                'width': '20',
                'height': '10',
                'payment_type': 'Sender'
            }
        else:
            # Ensure reference includes order_id
            if 'reference' not in package_data:
                package_data['reference'] = order_id
        
        # Ship to the order's location
        result = self.ship_to_location(
            order['location_id'], 
            sender_data, 
            package_data
        )
        
        # Update order status if successful
        if result['status'] == 'Success':
            self.db.update_order_status(
                order_id, 
                'shipped', 
                result.get('shipment_pin')
            )
        
        return result
    
    def batch_ship_orders(self, order_ids: List[str], sender_data: Dict) -> List[Dict]:
        """
        Create shipments for multiple sales orders
        
        Args:
            order_ids: List of order IDs to ship
            sender_data: Sender information
            
        Returns:
            List of result dictionaries
        """
        results = []
        
        for order_id in order_ids:
            result = self.ship_sales_order(order_id, sender_data)
            results.append({
                'order_id': order_id,
                **result
            })
        
        return results
    
    def get_pending_shipments(self) -> List[Dict]:
        """
        Get all pending sales orders ready to ship
        
        Returns:
            List of pending order dictionaries with full details
        """
        return self.db.get_pending_orders()
    
    def create_order_from_location(self, order_id: str, customer_id: int, 
                                   location_id: int, weight: str = None,
                                   service_id: str = None, reference: str = None) -> bool:
        """
        Create a new sales order from customer location
        
        Args:
            order_id: Unique order ID
            customer_id: Customer ID
            location_id: Shipping location ID
            weight: Package weight
            service_id: Purolator service
            reference: Additional reference
            
        Returns:
            True if successful
        """
        return self.db.add_sales_order(
            order_id, customer_id, location_id,
            weight, service_id, reference
        )
    
    def lookup_customer_locations(self, customer_id: int) -> List[Dict]:
        """
        Get all shipping locations for a customer
        
        Args:
            customer_id: Customer ID
            
        Returns:
            List of location dictionaries
        """
        return self.db.get_customer_locations(customer_id)
    
    def get_default_sender_data(self) -> Dict:
        """
        Get default sender data from environment or defaults
        
        Returns:
            Dictionary with sender information
        """
        return {
            'sender_name': os.getenv('DEFAULT_SENDER_NAME', 'Your Warehouse'),
            'sender_street': os.getenv('DEFAULT_SENDER_STREET', '123 Main Street'),
            'sender_city': os.getenv('DEFAULT_SENDER_CITY', 'Toronto'),
            'sender_province': os.getenv('DEFAULT_SENDER_PROVINCE', 'ON'),
            'sender_postal': os.getenv('DEFAULT_SENDER_POSTAL', 'M5J2R8'),
            'sender_phone': os.getenv('DEFAULT_SENDER_PHONE', '416-555-1234')
        }
    
    def export_pending_to_csv(self, filepath: str):
        """
        Export pending orders to CSV for batch processing
        
        Args:
            filepath: Path to output CSV file
        """
        import csv
        
        pending_orders = self.get_pending_shipments()
        sender_data = self.get_default_sender_data()
        
        if not pending_orders:
            return
        
        # Convert to Purolator format
        shipment_rows = []
        for order in pending_orders:
            location = {
                'customer_name': order['customer_name'],
                'address_street': order['address_street'],
                'address_city': order['address_city'],
                'address_province': order['address_province'],
                'address_postal': order['address_postal'],
                'address_country': order['address_country'],
                'phone_number': order['phone_number']
            }
            
            package_data = {
                'weight': order.get('weight', '2.5'),
                'service_id': order.get('service_id', 'PurolatorExpress'),
                'reference': order['order_id'],
                'length': '30',
                'width': '20',
                'height': '10',
                'payment_type': 'Sender'
            }
            
            shipment_data = self.convert_location_to_shipment_data(
                location, sender_data, package_data
            )
            shipment_rows.append(shipment_data)
        
        # Write to CSV
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            if shipment_rows:
                fieldnames = list(shipment_rows[0].keys())
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(shipment_rows)


# Convenience function
def get_integration(db_path: str = None) -> ShippingIntegration:
    """
    Get shipping integration instance
    
    Args:
        db_path: Optional custom database path
        
    Returns:
        ShippingIntegration instance
    """
    return ShippingIntegration(db_path)


if __name__ == '__main__':
    # Example usage
    print("Testing Shipping Integration...")
    
    integration = get_integration()
    
    # Get pending shipments
    pending = integration.get_pending_shipments()
    print(f"\nFound {len(pending)} pending order(s)")
    
    # Example: Get default sender data
    sender = integration.get_default_sender_data()
    print(f"\nDefault sender: {sender['sender_name']}")
    
    print("\n✓ Shipping integration initialized successfully!")

