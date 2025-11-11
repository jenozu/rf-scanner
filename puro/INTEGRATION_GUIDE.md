# Purolator Batch Shipping - Integration Guide

## Executive Summary

This document provides complete technical specifications for integrating the Purolator batch shipping system into an RF scanning tool or warehouse management system.

**Current Status:**
- ✅ Production API: Fully working (account 7254525)
- ✅ Shipment Creation: Tested and operational
- ✅ Phone/Address Parsing: All formats supported
- ✅ CSV Batch Processing: Implemented
- ⚠️ Label Download: API permission required (workaround available)

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Components](#core-components)
3. [API Reference](#api-reference)
4. [Integration Patterns](#integration-patterns)
5. [Data Structures](#data-structures)
6. [Code Examples](#code-examples)
7. [Error Handling](#error-handling)
8. [Production Configuration](#production-configuration)
9. [Security](#security)
10. [Testing](#testing)

---

## System Architecture

### High-Level Overview

```
┌─────────────────┐
│  RF Scanner     │
│  / WMS System   │
└────────┬────────┘
         │
         │ (Order Data)
         ▼
┌─────────────────┐
│ Integration     │◄──── CSV Import / API Calls
│ Layer           │
└────────┬────────┘
         │
         │ (Parsed Data)
         ▼
┌─────────────────┐
│ Purolator       │
│ Shipping Module │
└────────┬────────┘
         │
         │ (SOAP XML)
         ▼
┌─────────────────┐
│ Purolator       │
│ Production API  │
└────────┬────────┘
         │
         ▼
    Shipment PIN
    (Track & Bill)
```

### Component Layers

1. **Data Input Layer**: RF scanner data → normalized format
2. **Validation Layer**: Address/phone parsing, data validation
3. **API Layer**: SOAP communication with Purolator
4. **Result Layer**: Shipment PINs, error logging, tracking

---

## Core Components

### 1. Utility Module (`purolator_utils.py`)

**Purpose**: Parse and validate shipment data

**Key Functions:**

```python
# Phone number parsing - handles multiple formats
parse_phone_number(phone_str: str) -> Dict[str, str]
# Returns: {"CountryCode": "1", "AreaCode": "416", "Phone": "1234567"}

# Address parsing - splits street number and name
parse_street_address(street_str: str) -> Tuple[str, str]
# Returns: ("123", "Main Street")

# Postal code validation and formatting
validate_postal_code(postal_code: str, country: str) -> bool
format_postal_code(postal_code: str) -> str

# Shipment data validation
validate_shipment_data(data: Dict) -> Tuple[bool, Optional[str]]
# Returns: (is_valid, error_message)

# Error message extraction from SOAP responses
extract_error_message(response_text: str) -> str
```

### 2. Batch Shipping App (`batch_shipping_app.py`)

**Purpose**: Main shipment creation engine

**Key Methods:**

```python
class BatchShippingApp:
    def __init__(self):
        # Initialize with credentials from environment
        
    def create_shipment_from_data(self, data: Dict) -> Dict:
        # Create single shipment, returns result with PIN
        
    def build_shipment_request_from_data(self, data: Dict) -> str:
        # Build SOAP XML request
        
    def extract_shipment_pin(self, response_text: str) -> Optional[str]:
        # Extract PIN from response
        
    def load_csv_shipments(self, csv_path: str) -> List[Dict]:
        # Load and validate CSV data
```

### 3. Configuration (`.env`)

```env
PUROLATOR_API_USERNAME=714d0583f90941ada8d2175bdc4452bb
PUROLATOR_API_PASSWORD=6qDJZ0Ph
PUROLATOR_API_ACCOUNT=7254525
```

---

## API Reference

### Production Endpoints

```python
# Shipment Creation
SHIPMENT_URL = "https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx"

# Label Download (requires permission)
DOCUMENTS_URL = "https://webservices.purolator.com/EWS/V1/ShippingDocuments/ShippingDocumentsService.asmx"
```

### Authentication

```python
# HTTP Basic Auth
auth = (username, password)

# SOAP Headers
headers = {
    "Content-Type": "text/xml; charset=utf-8",
    "SOAPAction": "http://purolator.com/pws/service/v2/CreateShipment"
}
```

### Request Structure

**Minimal shipment creation:**

```python
import requests
from purolator_utils import parse_phone_number, parse_street_address

# Parse data
sender_phone = parse_phone_number("416-123-4567")
sender_street_num, sender_street_name = parse_street_address("123 Main St")

# Build SOAP body
soap_body = f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:v2="http://purolator.com/pws/datatypes/v2">
  <soapenv:Header>
    <v2:RequestContext>
      <v2:Version>2.0</v2:Version>
      <v2:Language>en</v2:Language>
      <v2:GroupID>111</v2:GroupID>
      <v2:RequestReference>ORDER-001</v2:RequestReference>
    </v2:RequestContext>
  </soapenv:Header>
  <soapenv:Body>
    <v2:CreateShipmentRequest>
      <v2:Shipment>
        <v2:SenderInformation>
          <v2:Address>
            <v2:Name>Your Company</v2:Name>
            <v2:StreetNumber>{sender_street_num}</v2:StreetNumber>
            <v2:StreetName>{sender_street_name}</v2:StreetName>
            <v2:City>Toronto</v2:City>
            <v2:Province>ON</v2:Province>
            <v2:Country>CA</v2:Country>
            <v2:PostalCode>M5J2R8</v2:PostalCode>
            <v2:PhoneNumber>
              <v2:CountryCode>{sender_phone['CountryCode']}</v2:CountryCode>
              <v2:AreaCode>{sender_phone['AreaCode']}</v2:AreaCode>
              <v2:Phone>{sender_phone['Phone']}</v2:Phone>
            </v2:PhoneNumber>
          </v2:Address>
        </v2:SenderInformation>
        <v2:ReceiverInformation>
          <!-- Similar structure -->
        </v2:ReceiverInformation>
        <v2:PackageInformation>
          <v2:ServiceID>PurolatorExpress</v2:ServiceID>
          <v2:TotalWeight>
            <v2:Value>2.5</v2:Value>
            <v2:WeightUnit>kg</v2:WeightUnit>
          </v2:TotalWeight>
          <v2:Dimensions>
            <v2:Length>30</v2:Length>
            <v2:Width>20</v2:Width>
            <v2:Height>10</v2:Height>
            <v2:DimensionUnit>cm</v2:DimensionUnit>
          </v2:Dimensions>
          <v2:TotalPieces>1</v2:TotalPieces>
        </v2:PackageInformation>
        <v2:PaymentInformation>
          <v2:PaymentType>Sender</v2:PaymentType>
          <v2:RegisteredAccountNumber>7254525</v2:RegisteredAccountNumber>
        </v2:PaymentInformation>
        <v2:PickupInformation>
          <v2:PickupType>DropOff</v2:PickupType>
        </v2:PickupInformation>
      </v2:Shipment>
      <v2:PrinterType>Regular</v2:PrinterType>
    </v2:CreateShipmentRequest>
  </soapenv:Body>
</soapenv:Envelope>"""

# Send request
response = requests.post(
    SHIPMENT_URL,
    data=soap_body,
    headers=headers,
    auth=(username, password),
    timeout=30
)

# Extract PIN
if response.status_code == 200:
    # Parse XML to get ShipmentPIN/Value
    shipment_pin = extract_pin_from_response(response.text)
```

---

## Integration Patterns

### Pattern 1: Direct API Integration

**Use Case**: RF scanner directly calls shipment creation

```python
from batch_shipping_app import BatchShippingApp
import os

class RFShipmentIntegration:
    def __init__(self):
        self.app = BatchShippingApp.__new__(BatchShippingApp)
        self.app.username = os.getenv("PUROLATOR_API_USERNAME")
        self.app.password = os.getenv("PUROLATOR_API_PASSWORD")
        self.app.account = os.getenv("PUROLATOR_API_ACCOUNT")
        self.app.shipment_url = "https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx"
        
    def create_shipment_from_scan(self, scan_data):
        """
        Create shipment from RF scanner data
        
        Args:
            scan_data: Dict with order information from scanner
            
        Returns:
            Dict with shipment_pin, status, message
        """
        # Map scanner data to Purolator format
        shipment_data = {
            'sender_name': 'Your Warehouse',
            'sender_street': scan_data.get('warehouse_address'),
            'sender_city': 'Toronto',
            'sender_province': 'ON',
            'sender_postal': 'M5J2R8',
            'sender_phone': '416-555-1234',
            
            'receiver_name': scan_data.get('customer_name'),
            'receiver_street': scan_data.get('ship_to_address'),
            'receiver_city': scan_data.get('ship_to_city'),
            'receiver_province': scan_data.get('ship_to_province'),
            'receiver_postal': scan_data.get('ship_to_postal'),
            'receiver_country': 'CA',
            'receiver_phone': scan_data.get('customer_phone'),
            
            'service_id': scan_data.get('shipping_method', 'PurolatorExpress'),
            'weight': scan_data.get('weight', '2.5'),
            'length': scan_data.get('length', '30'),
            'width': scan_data.get('width', '20'),
            'height': scan_data.get('height', '10'),
            'payment_type': 'Sender',
            'reference': scan_data.get('order_number')
        }
        
        # Create shipment
        result = self.app.create_shipment_from_data(shipment_data)
        
        return result

# Usage
integration = RFShipmentIntegration()
result = integration.create_shipment_from_scan({
    'order_number': 'ORD-12345',
    'customer_name': 'John Doe',
    'ship_to_address': '123 Customer St',
    'ship_to_city': 'Montreal',
    'ship_to_province': 'QC',
    'ship_to_postal': 'H3B1A1',
    'customer_phone': '514-555-1234',
    'weight': '3.5'
})

if result['status'] == 'Success':
    print(f"Shipment created: {result['shipment_pin']}")
    # Store PIN in your database/WMS
else:
    print(f"Error: {result['message']}")
```

### Pattern 2: Batch Queue Integration

**Use Case**: Scanner adds to queue, batch processes periodically

```python
import sqlite3
import json
from datetime import datetime

class ShipmentQueue:
    def __init__(self, db_path='shipments.db'):
        self.db_path = db_path
        self.init_database()
        
    def init_database(self):
        """Create shipment queue table"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS shipment_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number TEXT UNIQUE,
                shipment_data TEXT,
                status TEXT DEFAULT 'pending',
                shipment_pin TEXT,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP
            )
        ''')
        conn.commit()
        conn.close()
        
    def add_to_queue(self, order_number, shipment_data):
        """Add shipment to processing queue"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        try:
            c.execute('''
                INSERT INTO shipment_queue (order_number, shipment_data)
                VALUES (?, ?)
            ''', (order_number, json.dumps(shipment_data)))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False  # Duplicate order number
        finally:
            conn.close()
            
    def get_pending_shipments(self, limit=50):
        """Get pending shipments for batch processing"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            SELECT id, order_number, shipment_data
            FROM shipment_queue
            WHERE status = 'pending'
            LIMIT ?
        ''', (limit,))
        rows = c.fetchall()
        conn.close()
        
        return [
            {
                'id': row[0],
                'order_number': row[1],
                'data': json.loads(row[2])
            }
            for row in rows
        ]
        
    def mark_processed(self, id, shipment_pin=None, error=None):
        """Mark shipment as processed"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        if error:
            c.execute('''
                UPDATE shipment_queue
                SET status = 'error', error_message = ?, processed_at = ?
                WHERE id = ?
            ''', (error, datetime.now(), id))
        else:
            c.execute('''
                UPDATE shipment_queue
                SET status = 'completed', shipment_pin = ?, processed_at = ?
                WHERE id = ?
            ''', (shipment_pin, datetime.now(), id))
            
        conn.commit()
        conn.close()

# Usage in RF Scanner
queue = ShipmentQueue()

# When scanning an order
queue.add_to_queue('ORD-12345', {
    'customer_name': 'John Doe',
    'ship_to_address': '123 Customer St',
    # ... rest of data
})

# Batch processor (runs every 5 minutes)
def process_queue():
    integration = RFShipmentIntegration()
    queue = ShipmentQueue()
    
    pending = queue.get_pending_shipments()
    
    for item in pending:
        result = integration.create_shipment_from_scan(item['data'])
        
        if result['status'] == 'Success':
            queue.mark_processed(item['id'], shipment_pin=result['shipment_pin'])
        else:
            queue.mark_processed(item['id'], error=result['message'])
```

### Pattern 3: CSV Export/Import

**Use Case**: Export scanner data to CSV, process batch

```python
import csv
from pathlib import Path

class CSVShipmentExporter:
    def __init__(self):
        self.export_dir = Path('exports')
        self.export_dir.mkdir(exist_ok=True)
        
    def export_orders_to_csv(self, orders, filename=None):
        """
        Export orders from RF scanner to Purolator CSV format
        
        Args:
            orders: List of order dictionaries
            filename: Optional filename
            
        Returns:
            Path to created CSV file
        """
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'shipments_{timestamp}.csv'
            
        filepath = self.export_dir / filename
        
        fieldnames = [
            'sender_name', 'sender_street', 'sender_city', 'sender_province',
            'sender_postal', 'sender_phone', 'receiver_name', 'receiver_street',
            'receiver_city', 'receiver_province', 'receiver_postal',
            'receiver_country', 'receiver_phone', 'service_id', 'weight',
            'length', 'width', 'height', 'payment_type', 'reference'
        ]
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for order in orders:
                # Map scanner data to CSV format
                csv_row = {
                    'sender_name': 'Your Warehouse',
                    'sender_street': '123 Warehouse St',
                    'sender_city': 'Toronto',
                    'sender_province': 'ON',
                    'sender_postal': 'M5J2R8',
                    'sender_phone': '416-555-1234',
                    
                    'receiver_name': order.get('customer_name'),
                    'receiver_street': order.get('ship_to_address'),
                    'receiver_city': order.get('ship_to_city'),
                    'receiver_province': order.get('ship_to_province'),
                    'receiver_postal': order.get('ship_to_postal'),
                    'receiver_country': 'CA',
                    'receiver_phone': order.get('customer_phone'),
                    
                    'service_id': order.get('shipping_method', 'PurolatorExpress'),
                    'weight': order.get('weight', '2.5'),
                    'length': order.get('length', '30'),
                    'width': order.get('width', '20'),
                    'height': order.get('height', '10'),
                    'payment_type': 'Sender',
                    'reference': order.get('order_number')
                }
                writer.writerow(csv_row)
                
        return filepath

# Usage
exporter = CSVShipmentExporter()

# Orders from RF scanner
orders = [
    {'order_number': 'ORD-001', 'customer_name': 'John Doe', ...},
    {'order_number': 'ORD-002', 'customer_name': 'Jane Smith', ...},
]

csv_file = exporter.export_orders_to_csv(orders)
print(f"Exported to: {csv_file}")

# Then process with batch app
# python batch_shipping_app.py -> load CSV -> process
```

---

## Data Structures

### Input Data Format

```python
ShipmentData = {
    # Sender (your warehouse)
    'sender_name': str,          # Required
    'sender_street': str,         # Required (will be parsed)
    'sender_city': str,           # Required
    'sender_province': str,       # Required (2-letter code)
    'sender_postal': str,         # Required (A1A1A1 format)
    'sender_phone': str,          # Required (any format)
    
    # Receiver (customer)
    'receiver_name': str,         # Required
    'receiver_street': str,       # Required (will be parsed)
    'receiver_city': str,         # Required
    'receiver_province': str,     # Required (2-letter code)
    'receiver_postal': str,       # Required
    'receiver_country': str,      # Required (CA, US, etc.)
    'receiver_phone': str,        # Required (any format)
    
    # Package
    'service_id': str,            # Required (PurolatorExpress, PurolatorGround)
    'weight': str,                # Required (kg)
    'length': str,                # Required (cm)
    'width': str,                 # Required (cm)
    'height': str,                # Required (cm)
    'payment_type': str,          # Required (Sender, Receiver, ThirdParty)
    'reference': str              # Required (your order/tracking number)
}
```

### Response Data Format

```python
ShipmentResult = {
    'reference': str,              # Your order number
    'status': str,                 # 'Success' or 'Error'
    'http_status': int,            # HTTP status code
    'shipment_pin': str,           # Purolator tracking number (if success)
    'message': str                 # Success/error message
}
```

### Validation Rules

```python
# Phone Numbers - All these formats work:
"416-123-4567"
"(416) 123-4567"
"4161234567"
"1-416-123-4567"

# Street Addresses - Will be parsed automatically:
"123 Main St" → StreetNumber: "123", StreetName: "Main St"
"123A Main St" → StreetNumber: "123A", StreetName: "Main St"
"123-125 Main St" → StreetNumber: "123", StreetName: "Main St"

# Postal Codes:
# Canadian: A1A1A1 or A1A 1A1 (both work)
# US: 12345 or 12345-6789

# Service IDs:
"PurolatorExpress"      # Standard express
"PurolatorGround"       # Ground shipping
"PurolatorExpress9AM"   # 9 AM delivery

# Provinces:
"ON", "QC", "BC", "AB", "MB", "SK", "NS", "NB", "PE", "NL"

# Weight: String number in kg (e.g., "2.5")
# Dimensions: String numbers in cm (e.g., "30", "20", "10")
```

---

## Code Examples

### Example 1: Minimal Integration

```python
"""
Minimal integration example - create one shipment
"""

import os
from dotenv import load_dotenv
from batch_shipping_app import BatchShippingApp

load_dotenv()

# Initialize
app = BatchShippingApp.__new__(BatchShippingApp)
app.username = os.getenv("PUROLATOR_API_USERNAME")
app.password = os.getenv("PUROLATOR_API_PASSWORD")
app.account = os.getenv("PUROLATOR_API_ACCOUNT")
app.shipment_url = "https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx"

# Create shipment
data = {
    'sender_name': 'Your Warehouse',
    'sender_street': '123 Warehouse St',
    'sender_city': 'Toronto',
    'sender_province': 'ON',
    'sender_postal': 'M5J2R8',
    'sender_phone': '416-555-1234',
    'receiver_name': 'Customer Name',
    'receiver_street': '456 Customer Ave',
    'receiver_city': 'Montreal',
    'receiver_province': 'QC',
    'receiver_postal': 'H3B1A1',
    'receiver_country': 'CA',
    'receiver_phone': '514-555-5678',
    'service_id': 'PurolatorExpress',
    'weight': '2.5',
    'length': '30',
    'width': '20',
    'height': '10',
    'payment_type': 'Sender',
    'reference': 'ORDER-001'
}

result = app.create_shipment_from_data(data)

if result['status'] == 'Success':
    print(f"✓ Shipment created: {result['shipment_pin']}")
else:
    print(f"✗ Error: {result['message']}")
```

### Example 2: Batch Processing

```python
"""
Batch processing example - process multiple orders
"""

from batch_shipping_app import BatchShippingApp
import os

class BatchProcessor:
    def __init__(self):
        self.app = BatchShippingApp.__new__(BatchShippingApp)
        self.app.username = os.getenv("PUROLATOR_API_USERNAME")
        self.app.password = os.getenv("PUROLATOR_API_PASSWORD")
        self.app.account = os.getenv("PUROLATOR_API_ACCOUNT")
        self.app.shipment_url = "https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx"
        
    def process_orders(self, orders):
        """Process list of orders"""
        results = []
        
        for order in orders:
            result = self.app.create_shipment_from_data(order)
            results.append({
                'order_number': order['reference'],
                'shipment_pin': result.get('shipment_pin'),
                'status': result['status'],
                'message': result['message']
            })
            
        return results

# Usage
processor = BatchProcessor()

orders = [
    {
        'sender_name': 'Warehouse',
        'sender_street': '123 Warehouse St',
        # ... sender details
        'receiver_name': 'Customer 1',
        'receiver_street': '456 Customer St',
        # ... receiver details
        'reference': 'ORD-001',
        # ... package details
    },
    # ... more orders
]

results = processor.process_orders(orders)

# Save results
with open('shipment_results.csv', 'w') as f:
    import csv
    writer = csv.DictWriter(f, fieldnames=['order_number', 'shipment_pin', 'status', 'message'])
    writer.writeheader()
    writer.writerows(results)
```

### Example 3: Real-time RF Scanner Integration

```python
"""
Real-time RF scanner integration
"""

class RFScannerShipping:
    def __init__(self):
        self.app = BatchShippingApp.__new__(BatchShippingApp)
        # ... initialize app
        
    def on_order_scanned(self, scanned_barcode):
        """Called when order is scanned"""
        # 1. Look up order in database
        order_data = self.get_order_from_database(scanned_barcode)
        
        # 2. Validate can ship
        if not self.can_ship_order(order_data):
            return {'error': 'Order not ready to ship'}
            
        # 3. Create shipment
        shipment_data = self.map_order_to_shipment(order_data)
        result = self.app.create_shipment_from_data(shipment_data)
        
        # 4. Update database
        if result['status'] == 'Success':
            self.update_order_status(
                order_data['id'],
                shipment_pin=result['shipment_pin'],
                status='shipped'
            )
            return {
                'success': True,
                'shipment_pin': result['shipment_pin'],
                'message': 'Shipment created'
            }
        else:
            return {
                'success': False,
                'error': result['message']
            }
            
    def map_order_to_shipment(self, order_data):
        """Map database order to Purolator format"""
        return {
            'sender_name': 'Your Warehouse',
            'sender_street': order_data.get('warehouse_address', '123 Default St'),
            # ... use your database fields
            'receiver_name': order_data['shipping_name'],
            'receiver_street': order_data['shipping_address'],
            'receiver_city': order_data['shipping_city'],
            'receiver_province': order_data['shipping_province'],
            'receiver_postal': order_data['shipping_postal'],
            'receiver_country': 'CA',
            'receiver_phone': order_data['shipping_phone'],
            'service_id': self.get_shipping_method(order_data),
            'weight': order_data['package_weight'],
            'length': order_data.get('package_length', '30'),
            'width': order_data.get('package_width', '20'),
            'height': order_data.get('package_height', '10'),
            'payment_type': 'Sender',
            'reference': order_data['order_number']
        }
        
    def get_shipping_method(self, order_data):
        """Map your shipping methods to Purolator services"""
        method_map = {
            'express': 'PurolatorExpress',
            'ground': 'PurolatorGround',
            'overnight': 'PurolatorExpress9AM'
        }
        return method_map.get(
            order_data.get('shipping_method', 'express'),
            'PurolatorExpress'
        )
```

---

## Error Handling

### Common Errors and Solutions

```python
# Error 1: Missing PhoneNumber
# Solution: Ensure phone is parsed and included
from purolator_utils import parse_phone_number
phone = parse_phone_number(raw_phone)  # Always use utility function

# Error 2: Invalid postal code
# Solution: Validate before sending
from purolator_utils import validate_postal_code
if not validate_postal_code(postal, country):
    raise ValueError(f"Invalid postal code: {postal}")

# Error 3: Unserviceable address
# Solution: Verify postal code exists and is serviceable
# Some postal codes are valid but not serviced by Purolator

# Error 4: Authentication failed
# Solution: Verify credentials in .env file
# Username: 714d0583f90941ada8d2175bdc4452bb
# Password: 6qDJZ0Ph
# Account: 7254525

# Error 5: Missing PickupInformation
# Solution: Always include PickupInformation in SOAP
<v2:PickupInformation>
    <v2:PickupType>DropOff</v2:PickupType>
</v2:PickupInformation>
```

### Error Response Handling

```python
def handle_shipment_result(result):
    """Proper error handling"""
    if result['status'] == 'Success':
        # Success path
        shipment_pin = result['shipment_pin']
        # Store in database
        save_shipment_pin(shipment_pin)
        return {'success': True, 'pin': shipment_pin}
        
    else:
        # Error path
        error_msg = result['message']
        
        # Log error
        log_error(error_msg)
        
        # Categorize error
        if 'postal code' in error_msg.lower():
            return {'error': 'invalid_address', 'message': error_msg}
        elif 'authentication' in error_msg.lower():
            return {'error': 'auth_failed', 'message': error_msg}
        elif 'unserviceable' in error_msg.lower():
            return {'error': 'unserviceable', 'message': error_msg}
        else:
            return {'error': 'unknown', 'message': error_msg}
```

---

## Production Configuration

### Environment Setup

```bash
# .env file
PUROLATOR_API_USERNAME=714d0583f90941ada8d2175bdc4452bb
PUROLATOR_API_PASSWORD=6qDJZ0Ph
PUROLATOR_API_ACCOUNT=7254525

# Production endpoints (already configured)
# https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx
```

### Tested Production Status

```
✅ Account: 7254525 (Active)
✅ Shipment API: Working
✅ Test shipment created: PIN 520138418055
✅ Authentication: Verified
✅ Endpoints: Production
⚠️ Label Download: Requires additional API permission
```

### Performance Considerations

```python
# Recommended batch size
BATCH_SIZE = 50  # Process 50 shipments at a time

# Timeout settings
REQUEST_TIMEOUT = 30  # seconds

# Retry logic
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds

# Rate limiting (if needed)
REQUESTS_PER_MINUTE = 60
```

---

## Security

### Credential Management

```python
# ✅ GOOD: Use environment variables
import os
username = os.getenv("PUROLATOR_API_USERNAME")

# ❌ BAD: Hardcode credentials
username = "714d0583f90941ada8d2175bdc4452bb"  # Don't do this!
```

### Data Protection

```python
# Sensitive data should be:
# 1. Never logged in plain text
# 2. Encrypted at rest
# 3. Transmitted over HTTPS only

# Example: Safe logging
def safe_log(data):
    """Log data without sensitive info"""
    safe_data = data.copy()
    # Mask sensitive fields
    if 'receiver_phone' in safe_data:
        safe_data['receiver_phone'] = safe_data['receiver_phone'][:3] + '***'
    return safe_data
```

---

## Testing

### Test Script

```python
"""
test_integration.py - Test your integration
"""

def test_shipment_creation():
    """Test creating a shipment"""
    from batch_shipping_app import BatchShippingApp
    import os
    
    app = BatchShippingApp.__new__(BatchShippingApp)
    app.username = os.getenv("PUROLATOR_API_USERNAME")
    app.password = os.getenv("PUROLATOR_API_PASSWORD")
    app.account = os.getenv("PUROLATOR_API_ACCOUNT")
    app.shipment_url = "https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx"
    
    test_data = {
        'sender_name': 'Test Sender',
        'sender_street': '123 Bay Street',
        'sender_city': 'Toronto',
        'sender_province': 'ON',
        'sender_postal': 'M5J2R8',
        'sender_phone': '416-555-1234',
        'receiver_name': 'Test Receiver',
        'receiver_street': '456 Saint-Catherine Street',
        'receiver_city': 'Montreal',
        'receiver_province': 'QC',
        'receiver_postal': 'H3B1A1',
        'receiver_country': 'CA',
        'receiver_phone': '514-555-5678',
        'service_id': 'PurolatorExpress',
        'weight': '2.5',
        'length': '30',
        'width': '20',
        'height': '10',
        'payment_type': 'Sender',
        'reference': 'TEST-001'
    }
    
    result = app.create_shipment_from_data(test_data)
    
    assert result['status'] == 'Success', f"Failed: {result['message']}"
    assert result['shipment_pin'] is not None
    
    print(f"✓ Test passed! Shipment PIN: {result['shipment_pin']}")
    return result['shipment_pin']

if __name__ == '__main__':
    test_shipment_creation()
```

---

## Quick Start Checklist

- [ ] Copy `purolator_utils.py` to your project
- [ ] Copy `batch_shipping_app.py` to your project
- [ ] Create `.env` with production credentials
- [ ] Install dependencies: `pip install requests python-dotenv`
- [ ] Test with one shipment
- [ ] Implement integration pattern (direct/queue/CSV)
- [ ] Add error handling
- [ ] Test with real data
- [ ] Deploy to production

---

## Support & Troubleshooting

### Testing Checklist

1. ✅ Credentials loaded from .env
2. ✅ Phone numbers parse correctly
3. ✅ Addresses parse correctly
4. ✅ Postal codes validate
5. ✅ Shipment creates successfully
6. ✅ Shipment PIN returned
7. ⚠️ Label download (requires Purolator permission)

### Common Integration Issues

**Issue**: "Module not found"
**Solution**: Ensure `purolator_utils.py` is in the same directory or in Python path

**Issue**: "Authentication failed"
**Solution**: Verify `.env` credentials match production credentials

**Issue**: "Unserviceable postal code"
**Solution**: Verify postal code is valid and serviced by Purolator

**Issue**: "Label download 403 error"
**Solution**: Contact Purolator to enable GetDocuments API access

---

## Files Required for Integration

```
your_project/
├── .env                          # Credentials (create this)
├── purolator_utils.py            # Utility functions (copy from puro/04_Automation_Scripts/)
├── batch_shipping_app.py         # Shipment engine (copy from puro/04_Automation_Scripts/)
├── requirements.txt              # Dependencies
└── your_rf_integration.py        # Your integration code
```

### requirements.txt

```
requests>=2.31.0
python-dotenv>=1.0.0
```

---

## Next Steps

1. **Copy the utility files** to your RF scanner project
2. **Choose an integration pattern** (Direct API, Queue, or CSV)
3. **Map your data** to Purolator format
4. **Test with one shipment**
5. **Implement error handling**
6. **Deploy to production**
7. **Contact Purolator** for label download API access (optional)

---

## Appendix: Complete Working Example

See `test_production_auto.py` for a complete working example that:
- ✅ Loads production credentials
- ✅ Creates a real shipment
- ✅ Returns shipment PIN
- ✅ Handles errors

**Last Updated**: Based on successful production test (Shipment PIN: 520138418055)
**Account**: 7254525 (Production, Active)
**Status**: Ready for integration

---

For questions or issues, refer to the troubleshooting section or test scripts in `puro/04_Automation_Scripts/`.

