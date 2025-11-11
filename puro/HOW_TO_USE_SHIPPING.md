# How to Use the Shipping Module - Step by Step Guide

## Overview
This guide explains how to take orders from your RF Scanner web app and create Purolator shipping labels.

---

## The Complete Workflow

### Step 1: Export Orders from Web App ✅ (You already did this!)
1. Open your RF Scanner web app
2. Click the "Shipping" button (📦 icon in footer)
3. Select orders you want to ship (check the boxes)
4. Click "Export CSV"
5. Save the file somewhere you can find it (like Desktop)

**What you get**: A CSV file with order information like:
```
order_id,customer_name,order_number,status,created_date
"ORD-12345","ABC Company","SO-001","picked","2025-11-15"
```

---

## Step 2: Prepare Your Address Book (First Time Only)

Before you can ship orders, you need to add customer addresses to the system.

### Option A: Use the Address Book Manager (GUI - Easy!)

1. **Open the Address Book Manager**:
   - Open Terminal/Command Prompt
   - Navigate to the `puro` folder:
     ```
     cd "C:\Users\andel\Desktop\Marind\rf scanner\puro"
     ```
   - Run:
     ```
     python address_book_manager.py
     ```
   - A window will open with tabs for managing customers

2. **Add a Customer**:
   - Click the "Customers" tab
   - Click "Add New Customer"
   - Enter customer name (e.g., "ABC Company")
   - Optionally enter Purolator account number
   - Click "Save"

3. **Add Shipping Location**:
   - Click the "Shipping Locations" tab
   - Select the customer from dropdown
   - Click "Add Location"
   - Fill in:
     - Location name (e.g., "Main Warehouse")
     - Street address
     - City
     - Province (e.g., "ON" for Ontario)
     - Postal code (e.g., "M5J2R8")
     - Country (usually "CA")
     - Phone number
   - Check "Set as default" if this is their main address
   - Click "Save"

4. **Repeat for each customer** you need to ship to

### Option B: Import from CSV (Faster if you have many customers)

1. **Prepare your CSV file** with customer addresses:
   - Use the sample file `sample_locations.csv` as a template
   - Format should be:
     ```
     customer_name,location_name,address_street,address_city,address_province,address_postal,address_country,phone_number,is_default
     "ABC Company","Main Office","123 Main St","Toronto","ON","M5J2R8","CA","416-555-1234","1"
     ```

2. **Import it**:
   - In Address Book Manager, go to "Import/Export" tab
   - Click "Import Locations"
   - Select your CSV file
   - Click OK

---

## Step 3: Process the Exported Orders

Now you have:
- ✅ Orders exported from web app (CSV file)
- ✅ Customer addresses in the address book

### Method 1: Using Batch Shipping App (Best for Multiple Orders)

1. **Open the Batch Shipping App**:
   - Open Terminal/Command Prompt
   - Navigate to puro folder:
     ```
     cd "C:\Users\andel\Desktop\Marind\rf scanner\puro"
     ```
   - Run:
     ```
     python batch_shipping_app.py
     ```
   - A window will open with multiple tabs

2. **Go to "Batch Processing" Tab**:
   - Click the "Batch Processing" tab at the top

3. **Select Your CSV File**:
   - Click "Browse" button next to "CSV File"
   - Navigate to where you saved the CSV from Step 1
   - Select the file and click "Open"

4. **Configure Options** (optional):
   - Check "Auto-print labels" if you want labels printed automatically
   - Check "Save detailed logs" to keep a record

5. **Process the Batch**:
   - Click "Process Batch" button
   - Watch the progress bar
   - Results will appear in the "Results" section
   - Each order will show:
     - ✅ Success: Tracking PIN (e.g., "520138418055")
     - ❌ Error: Error message

6. **Save Results** (if enabled):
   - A CSV file with results will be saved
   - Shows which orders shipped successfully and their tracking numbers

### Method 2: Using Single Shipment Tab (Best for One Order at a Time)

1. **Open Batch Shipping App** (same as above)

2. **Go to "Single Shipment" Tab**:
   - Click the "Single Shipment" tab

3. **Select from Address Book**:
   - Click "📚 Select from Address Book" button
   - A search window opens
   - Type customer name or order number
   - Double-click the correct address
   - Form auto-fills with address!

4. **Enter Package Details**:
   - Weight (kg): e.g., "2.5"
   - Dimensions (cm): Length, Width, Height
   - Service: Choose PurolatorExpress, PurolatorGround, etc.
   - Payment: Usually "Sender"

5. **Create Shipment**:
   - Click "Create Shipment" button
   - Wait a few seconds
   - Success message shows tracking PIN!

---

## Step 4: Understanding the Results

### What Happens When You Ship:

1. **System creates a shipment** with Purolator
2. **Purolator returns a tracking PIN** (e.g., "520138418055")
3. **Label is created** (PDF file)
4. **Label is saved** in a `labels` folder (if auto-print enabled)

### Tracking PIN:
- This is the Purolator tracking number
- Use it to track the package on Purolator's website
- Store it in your system to track shipments

### Label File:
- Saved as PDF in `labels` folder
- Named like: `label_ORD-12345_520138418055.pdf`
- Print this label and attach to package

---

## Common Scenarios

### Scenario 1: First Time Setup

**You have**: Orders from web app, but no customer addresses yet

**Steps**:
1. Export orders from web app (get CSV)
2. Open Address Book Manager
3. Add customers one by one (or import CSV)
4. Open Batch Shipping App
5. Process the orders CSV

### Scenario 2: Regular Daily Shipping

**You have**: Orders + existing customer addresses

**Steps**:
1. Export new orders from web app
2. Open Batch Shipping App
3. Process the CSV directly
4. Done!

### Scenario 3: One-Off Shipment

**You have**: One order to ship right now

**Steps**:
1. Open Batch Shipping App
2. Go to Single Shipment tab
3. Click "Select from Address Book"
4. Find customer, enter package details
5. Create shipment
6. Print label

---

## Troubleshooting

### Problem: "Address not found"
**Solution**: Customer/address not in address book. Add it first using Address Book Manager.

### Problem: "Order already shipped"
**Solution**: Order was already processed. Check tracking PIN in results.

### Problem: "CSV import fails"
**Solution**: 
- Check CSV format matches template
- Make sure all required columns are present
- Check for empty cells in required fields

### Problem: "Shipment creation failed"
**Solution**:
- Verify `.env` file has correct Purolator credentials
- Check address postal code is valid
- Ensure weight and dimensions are reasonable

---

## Quick Reference

### File Locations:
- **Address Book Manager**: `puro/address_book_manager.py`
- **Batch Shipping App**: `puro/batch_shipping_app.py`
- **Database**: `puro/customer_addresses.db` (auto-created)
- **Labels**: `puro/labels/` folder (auto-created)

### Commands:
```bash
# Navigate to puro folder
cd "C:\Users\andel\Desktop\Marind\rf scanner\puro"

# Open Address Book Manager
python address_book_manager.py

# Open Batch Shipping App
python batch_shipping_app.py
```

### Environment File (.env):
Make sure this file exists in the `puro` folder with your Purolator credentials:
```
PUROLATOR_API_USERNAME=your_username
PUROLATOR_API_PASSWORD=your_password
PUROLATOR_API_ACCOUNT=your_account
```

---

## Summary

**The Flow**:
```
Web App → Export Orders (CSV)
    ↓
Address Book → Add Customer Addresses
    ↓
Batch Shipping App → Import CSV → Create Shipments
    ↓
Get Tracking PINs → Print Labels → Ship Packages!
```

**Three Main Tools**:
1. **Web App Shipping Page**: Select and export orders
2. **Address Book Manager**: Manage customer addresses
3. **Batch Shipping App**: Create shipments and labels

**Key Points**:
- First time: Add customer addresses first
- Regular use: Export orders, process in batch
- One-off: Use Single Shipment tab with address book

---

Need help? Check:
- `ADDRESS_BOOK_README.md` - Quick start guide
- `ADDRESS_BOOK_GUIDE.md` - Complete documentation
- `QUICK_REFERENCE.md` - Cheat sheet

