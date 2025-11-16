# Next Steps - Shipping Integration Setup

## ✅ What's Already Done

- ✓ Python 3.12.10 is installed and working
- ✓ Address book database exists (`puro/customer_addresses.db`)
- ✓ Server Node.js dependencies installed
- ✓ All code files created and ready

## 🎯 What You Need to Do Now

### Step 1: Create .env File (REQUIRED)

Create `puro/.env` file with your Purolator credentials:

```powershell
cd puro
notepad .env
```

**Copy this template** (credentials from your guide):

```env
# Purolator API Credentials (Production)
PUROLATOR_API_USERNAME=your_purolator_username
PUROLATOR_API_PASSWORD=your_purolator_password
PUROLATOR_API_ACCOUNT=your_account_number

# Default Sender Information (Your Warehouse)
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

**Important:** Update the email settings if you want labels emailed automatically.

### Step 2: Install Python Dependencies

```powershell
cd puro
pip install requests python-dotenv
```

### Step 3: Test Python API

```powershell
cd puro
echo '{"action":"search_customers","search_term":"Test"}' | python shipping_api_server.py
```

**Expected:** JSON output like `{"status":"success","data":[]}`

### Step 4: Start Node.js Server

Open a **new terminal window** and run:

```powershell
cd server
npm start
```

**Keep this running!** You should see:
```
🚀 RF Scanner API server running on port 3001
```

### Step 5: Add Test Customer to Address Book

**Option A: GUI (Recommended)**

```powershell
cd puro
python address_book_manager.py
```

1. **Customers Tab:**
   - Click "Add New Customer"
   - Name: `Test Customer`
   - Save

2. **Shipping Locations Tab:**
   - Select "Test Customer"
   - Click "Add Location"
   - Fill in:
     - Location name: `Main Office`
     - Street: `123 Test Street`
     - City: `Toronto`
     - Province: `ON`
     - Postal: `M5J2R8`
     - Phone: `416-555-1234`
     - ✅ **Check "Set as default"**
   - Save

### Step 6: Test the Integration

With the Node.js server running (Step 4), open **another terminal** and test:

```powershell
# Test health endpoint
curl http://localhost:3001/api/health

# Test customer search
curl "http://localhost:3001/api/shipping/customers/search?q=Test"

# Test shipment creation (replace "Test Customer" with your customer name)
curl -X POST http://localhost:3001/api/shipping/shipments/create -H "Content-Type: application/json" -d "{\"orderId\":\"test-123\",\"customerName\":\"Test Customer\",\"packageData\":{\"weight\":\"2.5\",\"service_id\":\"PurolatorExpress\",\"reference\":\"TEST\"}}"
```

### Step 7: Test in React App

1. **Start React app** (in project root):
   ```powershell
   npm start
   ```

2. **Navigate to Shipping page**

3. **Create a test order** or use existing orders

4. **Click "Create Shipment"** on an order

5. **Watch for:**
   - Loading spinner
   - Success message with tracking PIN
   - Order status changes to "shipped"

## 🔍 Troubleshooting

### Issue: "Customer not found"
**Solution:** Add customer to address book first (Step 5)

### Issue: "Python API call failed"
**Solution:** 
- Check Python: `python --version`
- Test Python API: `echo '{"action":"search_customers","search_term":"Test"}' | python shipping_api_server.py`

### Issue: "Cannot connect to server"
**Solution:**
- Make sure Node.js server is running (Step 4)
- Check port 3001: `netstat -ano | findstr :3001`

### Issue: "Module not found" (Python)
**Solution:** `pip install requests python-dotenv`

### Issue: "Module not found" (Node.js)
**Solution:** `cd server && npm install` (already done ✓)

## 📋 Quick Checklist

- [ ] Create `puro/.env` file with credentials
- [ ] Install Python dependencies (`pip install requests python-dotenv`)
- [ ] Test Python API (Step 3)
- [ ] Start Node.js server (Step 4)
- [ ] Add test customer to address book (Step 5)
- [ ] Test API endpoints (Step 6)
- [ ] Test in React app (Step 7)

## 📚 Documentation

- **Quick Start:** `QUICK_START.md`
- **Full Setup Guide:** `SETUP_AND_TESTING.md`
- **API Documentation:** `SHIPPING_API_DOCUMENTATION.md`
- **Address Book Guide:** `puro/ADDRESS_BOOK_GUIDE.md`

## 🚀 After Everything Works

1. Add real customers to address book
2. Configure email settings for label delivery
3. Test with real orders
4. Deploy to production

---

**Need help?** Check the error messages in:
- Node.js server console
- Browser developer console (F12)
- Python error output

