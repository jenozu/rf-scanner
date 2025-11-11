# Quick Start Guide - Shipping Integration

## ✅ Current Status

Based on automated checks:
- ✓ Python 3.12.10 installed
- ✓ Address book database exists
- ✓ Server dependencies installed
- ✗ .env file needs to be created

## Step 1: Create .env File

Copy the example file and add your credentials:

```powershell
cd puro
copy .env.example .env
notepad .env
```

Then edit the `.env` file with your actual:
- Purolator API credentials
- Warehouse address (sender information)
- Email settings (for sending labels)

**Note:** If you already have credentials from the guide, you can use those directly.

## Step 2: Install Python Dependencies

```powershell
cd puro
pip install -r requirements.txt
```

## Step 3: Test Python API

Test the Python API server directly:

```powershell
cd puro
echo '{"action":"search_customers","search_term":"Test"}' | python shipping_api_server.py
```

You should see JSON output like:
```json
{"status":"success","data":[]}
```

## Step 4: Start Node.js Server

In a new terminal window:

```powershell
cd server
npm start
```

You should see:
```
🚀 RF Scanner API server running on port 3001
📁 Data directory: /var/www/rf-scanner/data
```

**Keep this terminal open** - the server needs to stay running.

## Step 5: Test API Endpoints

In another terminal, test the health endpoint:

```powershell
curl http://localhost:3001/api/health
```

Or open in browser: http://localhost:3001/api/health

Expected response:
```json
{"status":"ok","timestamp":"..."}
```

## Step 6: Add a Test Customer

Before creating shipments, you need at least one customer in the address book:

**Option A: Using GUI (Easiest)**
```powershell
cd puro
python address_book_manager.py
```

1. Go to "Customers" tab
2. Click "Add New Customer"
3. Enter name: "Test Customer"
4. Save

5. Go to "Shipping Locations" tab
6. Select "Test Customer"
7. Click "Add Location"
8. Fill in:
   - Location name: "Main Office"
   - Street: "123 Test St"
   - City: "Toronto"
   - Province: "ON"
   - Postal: "M5J2R8"
   - Phone: "416-555-1234"
   - ✅ Check "Set as default"
9. Save

**Option B: Using Python Script** (Advanced)
```powershell
cd puro
python example_usage.py
```

## Step 7: Test Shipment Creation

With the Node.js server running, test creating a shipment:

```powershell
curl -X POST http://localhost:3001/api/shipping/shipments/create -H "Content-Type: application/json" -d '{\"orderId\":\"test-123\",\"customerName\":\"Test Customer\",\"packageData\":{\"weight\":\"2.5\",\"service_id\":\"PurolatorExpress\",\"reference\":\"TEST\"}}'
```

**Expected Results:**
- ✅ Success: `{"success":true,"shipmentPin":"...","message":"..."}`
- ❌ Error: `{"success":false,"error":"Customer not found..."}` (if customer not added)

## Step 8: Test in React App

1. Start React app (in project root):
   ```powershell
   npm start
   ```

2. Navigate to Shipping page

3. Click "Create Shipment" on an order

4. Watch for:
   - Loading spinner
   - Success message with tracking PIN
   - Order status changes to "shipped"

## Troubleshooting

### "Customer not found" Error
→ Add customer to address book first (Step 6)

### "Python API call failed"
→ Check Python is in PATH: `python --version`
→ Test Python API directly (Step 3)

### "Cannot connect to server"
→ Make sure Node.js server is running (Step 4)
→ Check port 3001 is not in use

### "Module not found" (Python)
→ Install dependencies: `pip install -r requirements.txt`

### "Module not found" (Node.js)
→ Install dependencies: `cd server && npm install`

## Next Steps

Once basic testing works:

1. ✅ Add real customers to address book
2. ✅ Configure email for label delivery
3. ✅ Test with real orders
4. ✅ Set up production deployment

## Full Documentation

- **Setup Guide:** `SETUP_AND_TESTING.md`
- **API Docs:** `SHIPPING_API_DOCUMENTATION.md`
- **Address Book Guide:** `puro/ADDRESS_BOOK_GUIDE.md`

## Quick Test Script

Run the automated test script:

```powershell
node test-shipping-integration.js
```

This will test all API endpoints automatically.

