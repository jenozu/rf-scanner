# Shipping API Documentation

## Overview

This document describes the backend API endpoints that connect the React web app to the Python shipping tools for creating Purolator shipments.

## Architecture

```
React Web App → Express API (Node.js) → Python API Server → Python Shipping Tools → Purolator API
```

## API Endpoints

### Base URL
- Development: `http://localhost:3001`
- Production: Set via `REACT_APP_API_URL` environment variable

### 1. Search Customers

**GET** `/api/shipping/customers/search?q={search_term}`

Search for customers in the address book database.

**Parameters:**
- `q` (query string): Search term (customer name)

**Response:**
```json
[
  {
    "customer_id": 1,
    "customer_name": "Acme Corp",
    "purolator_account_number": "123456"
  }
]
```

### 2. Search Locations

**GET** `/api/shipping/locations/search?q={search_term}`

Search for shipping locations across all customers.

**Parameters:**
- `q` (query string): Search term (location name, city, postal code, etc.)

**Response:**
```json
[
  {
    "location_id": 5,
    "customer_id": 1,
    "location_name": "Toronto Warehouse",
    "address_street": "123 Main St",
    "address_city": "Toronto",
    "address_province": "ON",
    "address_postal": "M5J2R8",
    "is_default": 1
  }
]
```

### 3. Get Customer Locations

**GET** `/api/shipping/customers/:customerId/locations`

Get all shipping locations for a specific customer.

**Parameters:**
- `customerId` (path): Customer ID

**Response:**
```json
[
  {
    "location_id": 5,
    "location_name": "Toronto Warehouse",
    "address_street": "123 Main St",
    "address_city": "Toronto",
    "address_province": "ON",
    "address_postal": "M5J2R8",
    "is_default": 1
  }
]
```

### 4. Get Shipping Address

**GET** `/api/shipping/address?customerId={id}&locationId={id}`

Get formatted shipping address for a customer or location.

**Parameters:**
- `customerId` (query, optional): Customer ID (uses default location)
- `locationId` (query, optional): Specific location ID (takes precedence)

**Response:**
```json
{
  "receiver_name": "Acme Corp",
  "receiver_street": "123 Main St",
  "receiver_city": "Toronto",
  "receiver_province": "ON",
  "receiver_postal": "M5J2R8",
  "receiver_country": "CA",
  "receiver_phone": "416-555-1234"
}
```

### 5. Create Shipment (Single Order)

**POST** `/api/shipping/shipments/create`

Create a Purolator shipment for a single order.

**Request Body:**
```json
{
  "orderId": "so-1234567890-0",
  "customerName": "Acme Corp",
  "customerId": 1,  // Optional: if provided, uses this customer
  "locationId": 5,  // Optional: if provided, ships directly to this location
  "packageData": {
    "weight": "2.5",
    "service_id": "PurolatorExpress",
    "reference": "SO-12345",
    "length": "30",
    "width": "20",
    "height": "10"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "shipmentPin": "329847293847",
  "message": "Shipment created successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Customer \"Acme Corp\" not found in address book. Please add them first."
}
```

**Workflow:**
1. If `locationId` provided → Ship directly to location
2. Else if `customerId` provided → Ship to customer's default location
3. Else if `customerName` provided → Search for customer, ship to default location
4. Else → Try to ship by order ID (if order exists in Python DB)

### 6. Create Batch Shipments

**POST** `/api/shipping/shipments/batch`

Create shipments for multiple orders at once.

**Request Body:**
```json
{
  "orderIds": ["so-1234567890-0", "so-1234567891-0"],
  "packageData": {
    "weight": "2.5",
    "service_id": "PurolatorExpress"
  }
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "order_id": "so-1234567890-0",
      "status": "Success",
      "shipment_pin": "329847293847",
      "message": "Shipment created successfully"
    },
    {
      "order_id": "so-1234567891-0",
      "status": "Error",
      "message": "Customer \"XYZ Corp\" not found in address book"
    }
  ],
  "total": 2,
  "successful": 1,
  "failed": 1
}
```

### 7. Quick Lookup

**GET** `/api/shipping/lookup?q={search_term}`

Quick search for customers or locations (searches both).

**Parameters:**
- `q` (query string): Search term

**Response:**
```json
{
  "status": "Success",
  "customer": {
    "customer_id": 1,
    "customer_name": "Acme Corp"
  },
  "locations": [
    {
      "location_id": 5,
      "location_name": "Toronto Warehouse",
      "address_city": "Toronto"
    }
  ],
  "default_location": {
    "location_id": 5,
    "location_name": "Toronto Warehouse"
  }
}
```

## Order Status Updates

After successful shipment creation:
- Order status is updated to `"shipped"` in the React storage
- `shipmentPin` is saved to the order
- `shippedDate` is set to current timestamp

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad Request (missing or invalid parameters)
- `404`: Not Found (customer, location, or order not found)
- `500`: Internal Server Error

Error responses include a `message` or `error` field with details.

## Python API Server

The Python API server (`puro/shipping_api_server.py`) accepts JSON commands via stdin and returns JSON responses via stdout. It's called by the Node.js server using `child_process.exec`.

**Supported Actions:**
- `search_customers`
- `search_locations`
- `get_customer_locations`
- `get_order_with_details`
- `get_pending_orders`
- `ship_order`
- `ship_to_location`
- `ship_to_customer`
- `batch_ship_orders`
- `get_shipping_address`
- `quick_lookup`

## Environment Variables

### Node.js Server
- `PORT`: Server port (default: 3001)
- `DATA_DIR`: Data storage directory (default: `/var/www/rf-scanner/data`)

### Python Tools
See `puro/.env` file for:
- `PUROLATOR_API_USERNAME`
- `PUROLATOR_API_PASSWORD`
- `PUROLATOR_API_ACCOUNT`
- `DEFAULT_SENDER_*` (sender information)
- `EMAIL_*` (email configuration)

## Testing

### Test Single Shipment
```bash
curl -X POST http://localhost:3001/api/shipping/shipments/create \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "so-123",
    "customerName": "Acme Corp",
    "packageData": {
      "weight": "2.5",
      "service_id": "PurolatorExpress"
    }
  }'
```

### Test Batch Shipment
```bash
curl -X POST http://localhost:3001/api/shipping/shipments/batch \
  -H "Content-Type: application/json" \
  -d '{
    "orderIds": ["so-123", "so-456"],
    "packageData": {
      "weight": "2.5",
      "service_id": "PurolatorExpress"
    }
  }'
```

### Test Customer Search
```bash
curl "http://localhost:3001/api/shipping/customers/search?q=Acme"
```

## Notes

1. **Customer Matching**: Orders are matched to customers in the address book by name. If a customer is not found, the shipment will fail. Ensure customers are added to the address book first.

2. **Default Weight**: If not specified, package weight defaults to 2.5 kg. This can be made configurable per order.

3. **Email Labels**: Shipping labels are automatically emailed to the configured recipient (set via `EMAIL_TO` in `.env`).

4. **Order Storage**: Orders are stored in both server storage (JSON files) and localStorage as backup.

5. **CSV Export**: The CSV export feature remains available as a backup option for manual processing.

## Troubleshooting

### "Customer not found in address book"
- Add the customer to the address book using the Address Book Manager (`puro/address_book_manager.py`)
- Or use the Python API to add customers programmatically

### "Python API call failed"
- Ensure Python 3 is installed and accessible
- Check that `puro/shipping_api_server.py` exists
- Verify Python dependencies are installed (`pip install -r puro/requirements.txt`)
- Check Python script permissions

### "Order status not updating"
- Check server storage directory permissions
- Verify `DATA_DIR` environment variable is set correctly
- Check server logs for errors

### "Shipment created but no email"
- Verify email configuration in `.env` file
- Check `EMAIL_FROM` and `EMAIL_PASSWORD` are set
- Ensure SMTP server is accessible

