# RF Scanner Integration Package

This folder contains everything you need to integrate Purolator shipping into your RF scanning tool.

## 📂 Files in This Folder

### 📖 Documentation (Read These First)

1. **RF_INTEGRATION_SUMMARY.md** ⭐ **START HERE**
   - Quick overview of what you have
   - 3-step quick start
   - Integration patterns explained
   - Next steps checklist
   - **Read time: 5 minutes**

2. **INTEGRATION_GUIDE.md** - Complete Technical Documentation
   - Full API reference
   - 3 integration patterns with complete code
   - Data structures
   - Error handling
   - Security best practices
   - **Read time: 30 minutes**

3. **FILES_FOR_RF_INTEGRATION.md** - File Reference
   - What each file does
   - Setup instructions
   - Minimal configuration
   - **Read time: 10 minutes**

---

### 💻 Code Files (Copy These to Your Project)

4. **purolator_utils.py** ✅ REQUIRED
   - Parses phone numbers (any format)
   - Parses street addresses
   - Validates postal codes
   - Validates shipment data

5. **batch_shipping_app.py** ✅ REQUIRED
   - Main shipment creation engine
   - Handles API communication
   - Returns shipment PINs

6. **requirements.txt** ✅ REQUIRED
   - Python dependencies
   - Install with: `pip install -r requirements.txt`

---

### 🧪 Testing

7. **test_production_auto.py** - Production API Test
   - Tests your production credentials
   - Creates a real test shipment
   - Verifies everything works
   - Run with: `python test_production_auto.py`

---

## 🚀 Quick Start

### Step 1: Read the Summary (5 min)
```
Open: RF_INTEGRATION_SUMMARY.md
```

### Step 2: Set Up Environment
```bash
# Copy files to your project
cp purolator_utils.py /path/to/your/rf/project/
cp batch_shipping_app.py /path/to/your/rf/project/
cp requirements.txt /path/to/your/rf/project/

# Install dependencies
cd /path/to/your/rf/project/
pip install -r requirements.txt
```

### Step 3: Create .env file
```bash
# In your project folder, create .env:
PUROLATOR_API_USERNAME=714d0583f90941ada8d2175bdc4452bb
PUROLATOR_API_PASSWORD=6qDJZ0Ph
PUROLATOR_API_ACCOUNT=7254525
```

### Step 4: Test
```bash
python test_production_auto.py
```

If you see "SUCCESS! Shipment PIN: ..." then you're ready to integrate!

---

## ✅ What's Working

- ✅ Production API (Account 7254525) - Active
- ✅ Shipment creation - Tested (PIN: 520138418055)
- ✅ Phone number parsing - All formats
- ✅ Address parsing - Automatic
- ✅ Postal code validation - CA + US
- ✅ Error handling - Meaningful messages
- ⚠️ Label download - Requires Purolator permission (workaround available)

---

## 📋 Integration Checklist

- [ ] Read RF_INTEGRATION_SUMMARY.md
- [ ] Choose integration pattern (Real-time, Queue, or CSV)
- [ ] Copy 3 required files to your project
- [ ] Create .env with production credentials
- [ ] Install dependencies
- [ ] Test with test_production_auto.py
- [ ] Read INTEGRATION_GUIDE.md for your chosen pattern
- [ ] Implement integration code
- [ ] Test with real RF scanner data
- [ ] Deploy to production

---

## 🎯 Integration Patterns

### Option 1: Real-time (Recommended for RF Scanners)
**When**: Scan barcode → Create shipment immediately
**Best for**: Individual order processing
**Code**: See INTEGRATION_GUIDE.md - Pattern 1

### Option 2: Queue-based
**When**: Scan → Queue → Batch process every X minutes
**Best for**: High-volume warehouses
**Code**: See INTEGRATION_GUIDE.md - Pattern 2

### Option 3: CSV Export/Import
**When**: Export all orders → Process batch → Import results
**Best for**: End-of-day batch processing
**Code**: See INTEGRATION_GUIDE.md - Pattern 3

---

## 📊 Data Flow

```
RF Scanner → Your Code → Purolator API → Shipment PIN
                ↓
        purolator_utils.py (validates/parses)
                ↓
        batch_shipping_app.py (creates shipment)
                ↓
        Returns: {'status': 'Success', 'shipment_pin': '520138418055'}
```

---

## 🔑 Your Production Credentials

```
Username: 714d0583f90941ada8d2175bdc4452bb
Password: 6qDJZ0Ph
Account:  7254525
Status:   ✅ Active and tested
```

---

## 🆘 Need Help?

1. **Quick questions**: Check RF_INTEGRATION_SUMMARY.md
2. **Technical details**: Check INTEGRATION_GUIDE.md
3. **File setup**: Check FILES_FOR_RF_INTEGRATION.md
4. **Testing**: Run test_production_auto.py

---

## 📁 Original Location

These files are copied from: `puro/04_Automation_Scripts/`

If you need other files (test scripts, examples), they're still available there.

---

**Everything you need is in this folder. Start with RF_INTEGRATION_SUMMARY.md!** 🚀

