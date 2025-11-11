"""
Shipping API Server for Node.js Integration
Accepts JSON commands via stdin and returns JSON responses via stdout
"""

import sys
import json
import os
from typing import Dict, Any
from pathlib import Path
from dotenv import load_dotenv

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from address_book_api import get_api
from shipping_integration import get_integration
from batch_shipping_app import BatchShippingApp

# Load environment
load_dotenv()

def handle_command(command: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle a command from Node.js
    
    Args:
        command: Dictionary with 'action' and parameters
        
    Returns:
        Response dictionary with 'status' and data
    """
    action = command.get('action')
    
    try:
        if action == 'search_customers':
            api = get_api()
            search_term = command.get('search_term', '')
            results = api.search_customers(search_term)
            return {
                'status': 'success',
                'data': results
            }
        
        elif action == 'search_locations':
            api = get_api()
            search_term = command.get('search_term', '')
            results = api.search_locations(search_term)
            return {
                'status': 'success',
                'data': results
            }
        
        elif action == 'get_customer_locations':
            api = get_api()
            customer_id = command.get('customer_id')
            if not customer_id:
                return {'status': 'error', 'message': 'customer_id required'}
            results = api.get_customer_locations(customer_id)
            return {
                'status': 'success',
                'data': results
            }
        
        elif action == 'get_order_with_details':
            api = get_api()
            order_id = command.get('order_id')
            if not order_id:
                return {'status': 'error', 'message': 'order_id required'}
            result = api.get_order_with_details(order_id)
            if result:
                return {
                    'status': 'success',
                    'data': result
                }
            else:
                return {
                    'status': 'error',
                    'message': f'Order {order_id} not found'
                }
        
        elif action == 'get_pending_orders':
            api = get_api()
            results = api.get_pending_orders()
            return {
                'status': 'success',
                'data': results
            }
        
        elif action == 'ship_order':
            api = get_api()
            order_id = command.get('order_id')
            if not order_id:
                return {'status': 'error', 'message': 'order_id required'}
            
            package_data = command.get('package_data', {})
            result = api.ship_order(order_id, package_data)
            return result
        
        elif action == 'ship_to_location':
            api = get_api()
            location_id = command.get('location_id')
            if not location_id:
                return {'status': 'error', 'message': 'location_id required'}
            
            package_data = command.get('package_data', {})
            result = api.ship_to_location(location_id, package_data)
            return result
        
        elif action == 'ship_to_customer':
            api = get_api()
            customer_id = command.get('customer_id')
            if not customer_id:
                return {'status': 'error', 'message': 'customer_id required'}
            
            location_id = command.get('location_id')  # Optional
            package_data = command.get('package_data', {})
            result = api.ship_to_customer(customer_id, package_data, location_id)
            return result
        
        elif action == 'batch_ship_orders':
            api = get_api()
            order_ids = command.get('order_ids', [])
            if not order_ids:
                return {'status': 'error', 'message': 'order_ids required'}
            
            results = api.batch_ship_orders(order_ids)
            return {
                'status': 'success',
                'data': results
            }
        
        elif action == 'get_shipping_address':
            api = get_api()
            customer_id = command.get('customer_id')
            location_id = command.get('location_id')
            result = api.get_shipping_address(customer_id, location_id)
            if result:
                return {
                    'status': 'success',
                    'data': result
                }
            else:
                return {
                    'status': 'error',
                    'message': 'Address not found'
                }
        
        elif action == 'quick_lookup':
            api = get_api()
            search_term = command.get('search_term', '')
            result = api.quick_lookup(search_term)
            return result
        
        elif action == 'create_shipment_direct':
            # Create shipment with direct address data (bypasses address book)
            shipment_data = command.get('shipment_data', {})
            if not shipment_data:
                return {'status': 'error', 'message': 'shipment_data required'}
            
            # Initialize shipping app
            app = BatchShippingApp.__new__(BatchShippingApp)
            app.username = os.getenv("PUROLATOR_API_USERNAME")
            app.password = os.getenv("PUROLATOR_API_PASSWORD")
            app.account = os.getenv("PUROLATOR_API_ACCOUNT")
            app.shipment_url = "https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx"
            app.documents_url = "https://webservices.purolator.com/EWS/V1/ShippingDocuments/ShippingDocumentsService.asmx"
            
            # Create shipment
            result = app.create_shipment_from_data(shipment_data)
            return result
        
        else:
            return {
                'status': 'error',
                'message': f'Unknown action: {action}'
            }
    
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e),
            'error_type': type(e).__name__
        }


def main():
    """Main entry point - read JSON from stdin, process, write JSON to stdout"""
    try:
        # Read JSON from stdin
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({
                'status': 'error',
                'message': 'No input provided'
            }))
            return
        
        command = json.loads(input_data)
        
        # Process command
        response = handle_command(command)
        
        # Write JSON to stdout
        print(json.dumps(response))
        
    except json.JSONDecodeError as e:
        print(json.dumps({
            'status': 'error',
            'message': f'Invalid JSON: {str(e)}'
        }))
    except Exception as e:
        print(json.dumps({
            'status': 'error',
            'message': str(e),
            'error_type': type(e).__name__
        }))


if __name__ == '__main__':
    main()

