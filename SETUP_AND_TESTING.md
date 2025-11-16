# Setup and Testing Guide

## Step 1: Verify Python Dependencies

First, make sure all Python dependencies are installed:

```bash
cd puro
pip install -r requirements.txt
```

Or if you're using Python 3 specifically:

```bash
cd puro
pip3 install -r requirements.txt
```

**Required packages:**
- `requests>=2.31.0`
- `python-dotenv>=1.0.0`

## Step 2: Verify .env Configuration

Check if you have a `.env` file in the `puro` folder. If not, create one:

```bash
cd puro
# Create .env file (or edit existing)
```

**Required environment variables:**

```env
# Purolator API Credentials (Production)
PUROLATOR_API_USERNAME=your_username
PUROLATOR_API_PASSWORD=your_password
PUROLATOR_API_ACCOUNT=your_account_number

# Default Sender Information
DEFAULT_SENDER_NAME=Your Warehouse Name
DEFAULT_SENDER_STREET=123 Warehouse Street
DEFAULT_SENDER_CITY=Toronto
DEFAULT_SENDER_PROVINCE=ON
DEFAULT_SENDER_POSTAL=M5J2R8
DEFAULT_SENDER_PHONE=416-555-1234

# Email Configuration (for sending labels)
EMAIL_FROM=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_TO=recipient@example.com
EMAIL_SMTP_SERVER=smtp.gmail.com
EMAIL_SMTP_PORT=587
```

**Note:** Replace the placeholder values with your actual credentials.

## Step 3: Initialize Address Book Database

Make sure the address book database exists:

```bash
cd puro
python address_book_db.py
```

Or:

```bash
cd puro
python3 address_book_db.py
```

This will create `customer_addresses.db` if it doesn't exist.

## Step 4: Add Test Customer to Address Book

Before testing shipments, add at least one customer to the address book:

**Option A: Using the GUI Manager**
```bash
cd puro
python address_book_manager.py
```

Then:
1. Go to "Customers" tab
2. Click "Add New Customer"
3. Enter customer name (e.g., "Test Customer")
4. Save

Then:
1. Go to "Shipping Locations" tab
2. Select the customer
3. Click "Add Location"
4. Fill in address details:
   - Location name: "Main Office"
   - Street: "123 Test St"
   - City: "Toronto"
   - Province: "ON"
   - Postal: "M5J2R8"
   - Phone: "416-555-1234"
   - Check "Set as default"
5. Save

**Option B: Using Python API** (see Step 5 for testing)

## Step 5: Test Python API Server

Test the Python API server directly:

```bash
cd puro
```

**Test 1: Search Customers**
```bash
echo '{"action":"search_customers","search_term":"Test"}' | python shipping_api_server.py
```

**Test 2: Get Customer Locations**
```bash
echo '{"action":"get_customer_locations","customer_id":1}' | python shipping_api_server.py
```

**Expected output:** JSON with `{"status":"success","data":[...]}`

If you get errors, check:
- Python version: `python --version` (should be 3.7+)
- Dependencies: `pip list | grep requests`
- Database exists: `ls customer_addresses.db`

## Step 6: Install Node.js Dependencies

Make sure Node.js server dependencies are installed:

```bash
cd server
npm install
```

Verify installed packages:
```bash
npm list
```

You should see:
- express
- cors
- bcryptjs

## Step 7: Test Node.js Server

Start the Node.js server:

```bash
cd server
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

You should see:
```
🚀 RF Scanner API server running on port 3001
📁 Data directory: /var/www/rf-scanner/data
```

**Test the health endpoint:**

Open a new terminal and run:
```bash
curl http://localhost:3001/api/health
```

Or visit in browser: `http://localhost:3001/api/health`

**Expected response:**
```json
{"status":"ok","timestamp":"2024-..."}
```

## Step 8: Test Shipping API Endpoints

With the Node.js server running, test the shipping endpoints:

**Test 1: Search Customers**
```bash
curl "http://localhost:3001/api/shipping/customers/search?q=Test"
```

**Test 2: Search Locations**
```bash
curl "http://localhost:3001/api/shipping/locations/search?q=Toronto"
```

**Test 3: Create Shipment** (requires customer in address book)
```bash
curl -X POST http://localhost:3001/api/shipping/shipments/create \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test-order-123",
    "customerName": "Test Customer",
    "packageData": {
      "weight": "2.5",
      "service_id": "PurolatorExpress",
      "reference": "TEST-ORDER"
    }
  }'
```

**Expected response:**
- Success: `{"success":true,"shipmentPin":"...","message":"..."}`
- Error: `{"success":false,"error":"Customer not found..."}`

## Step 9: Test React Frontend

### 9a. Update API URL (if needed)

The React app uses `REACT_APP_API_URL` or defaults to `http://localhost:3001`.

If running locally, the default should work. If deployed, set the environment variable:

```bash
# In your .env file in the project root
REACT_APP_API_URL=http://localhost:3001
```

### 9b. Start React App

```bash
npm start
```

### 9c. Test in Browser

1. Navigate to the Shipping page
2. You should see orders (if any exist)
3. Click "Create Shipment" on an order
4. Watch for:
   - Loading spinner
   - Success message with tracking PIN
   - Order status changes to "shipped"
   - Tracking PIN displayed

## Step 10: End-to-End Testing Workflow

1. **Add a test customer:**
   - Use Address Book Manager or Python API
   - Add customer: "Test Customer"
   - Add location with full address

2. **Create a test order in React app:**
   - Go to Shipping page
   - Or import a test CSV with orders

3. **Test single shipment:**
   - Find an order with customer "Test Customer"
   - Click "Create Shipment"
   - Verify success message appears
   - Check email for label (if email configured)

4. **Test batch shipment:**
   - Select multiple orders (checkboxes)
   - Click "Create Shipments"
   - Verify success/failure counts
   - Check order statuses updated

## Troubleshooting

### Python API Issues

**Error: "ModuleNotFoundError: No module named 'requests'"**
```bash
pip install requests python-dotenv
```

**Error: "No such file or directory: 'customer_addresses.db'"**
```bash
cd puro
python address_book_db.py
```

**Error: "Python API call failed"**
- Check Python path: `which python` or `which python3`
- Verify script exists: `ls puro/shipping_api_server.py`
- Check file permissions

### Node.js Server Issues

**Error: "Cannot find module 'express'"**
```bash
cd server
npm install
```

**Error: "Port 3001 already in use"**
```bash
# Find process using port 3001
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Kill the process or change PORT in .env
```

**Error: "Python API call failed"**
- Verify Python is in PATH
- Test Python API directly (Step 5)
- Check file paths in server/index.js

### React Frontend Issues

**Error: "Failed to fetch"**
- Check if Node.js server is running
- Verify API URL in browser console
- Check CORS settings (should be enabled)

**Error: "Customer not found"**
- Add customer to address book first
- Verify customer name matches exactly
- Check address book database

**Orders not showing**
- Check if orders exist in localStorage or server storage
- Verify data is loaded on page mount
- Check browser console for errors

## Quick Verification Checklist

- [ ] Python dependencies installed (`pip list | grep requests`)
- [ ] `.env` file exists in `puro/` with credentials
- [ ] Address book database exists (`puro/customer_addresses.db`)
- [ ] At least one customer added to address book
- [ ] Node.js dependencies installed (`cd server && npm install`)
- [ ] Node.js server starts without errors
- [ ] Health endpoint responds (`/api/health`)
- [ ] Python API server responds to test commands
- [ ] React app connects to API server
- [ ] Test shipment creation works

## Next Steps After Testing

Once everything is working:

1. **Add real customers** to the address book
2. **Configure email settings** for label delivery
3. **Test with real orders** from your system
4. **Monitor logs** for any issues
5. **Set up production deployment** if needed

## Getting Help

If you encounter issues:

1. Check the error messages in:
   - Node.js server console
   - Browser developer console
   - Python API stderr

2. Verify each component separately:
   - Python API (Step 5)
   - Node.js server (Step 7)
   - React frontend (Step 9)

3. Check logs:
   - Server logs in console
   - Browser Network tab for API calls
   - Python error output

4. Review documentation:
   - `SHIPPING_API_DOCUMENTATION.md`
   - `puro/ADDRESS_BOOK_GUIDE.md`

