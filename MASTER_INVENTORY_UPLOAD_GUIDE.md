# 📤 Master Inventory Upload Guide

## 🎯 How It Works Now

Your app now follows the **Master/Clone pattern**:

1. **Master File** (`/data/master_inventory.xlsx`) on VPS → **Read-only**, never changes
2. **Clone** (`rf_active` in localStorage) → **Working copy**, all changes go here
3. **Exports** → Based on the clone (with counts/variances)

---

## 📤 Step 1: Upload Master File to VPS

### **Method 1: Using SCP (Recommended)**

```powershell
# Create the data folder on VPS (if it doesn't exist)
ssh root@72.60.170.192 "mkdir -p /var/www/rf-scanner/data"

# Upload your master inventory file
scp "C:\Users\andel\Desktop\Marind\rf scanner\master_inventory.xlsx" root@72.60.170.192:/var/www/rf-scanner/data/

# Set correct permissions
ssh root@72.60.170.192 "chown -R www-data:www-data /var/www/rf-scanner/data"
```

**You'll be prompted for your VPS password 3 times** (once per command)

---

### **Method 2: All-in-One Script**

Create a file `upload-inventory.ps1`:

```powershell
# Upload inventory to VPS
Write-Host "📤 Uploading master_inventory.xlsx to VPS..." -ForegroundColor Cyan

# Create data directory
ssh root@72.60.170.192 "mkdir -p /var/www/rf-scanner/data"

# Upload file
scp "C:\Users\andel\Desktop\Marind\rf scanner\master_inventory.xlsx" root@72.60.170.192:/var/www/rf-scanner/data/

# Set permissions
ssh root@72.60.170.192 "chown -R www-data:www-data /var/www/rf-scanner/data"

Write-Host "✅ Master inventory uploaded!" -ForegroundColor Green
```

Then run:
```powershell
.\upload-inventory.ps1
```

---

## 🔄 Step 2: How Auto-Load Works

### **First Time User Login:**

```
1. User visits: https://rf.andel-vps.space
2. Sees: Login screen
3. Enters: admin / admin123
4. App checks: Do we have data in localStorage?
   └─ NO → Go to Setup page
5. Setup page runs:
   └─ Fetches: /data/master_inventory.xlsx
   └─ Parses: 7,054 items
   └─ Saves as:
      • rf_master (read-only copy)
      • rf_active (working copy)
6. Status: "✅ Loaded 7,054 items from master inventory"
7. Redirects to: Home page
8. ✅ Ready to use!
```

---

### **Returning User:**

```
1. User visits: https://rf.andel-vps.space
2. Sees: Login screen (or auto-logs in if session active)
3. App checks: localStorage has rf_active?
   └─ YES → Go directly to Home page
4. User continues with their work
5. ✅ All changes stay in rf_active (clone)
```

---

## 📊 Master vs Clone Explained

### **Master File (rf_master)**
```javascript
localStorage.getItem("rf_master")
// Contains: Original 7,054 items
// CountedQty: undefined (blank)
// Variance: undefined (blank)
// Purpose: Reference / Backup
// Changes: NEVER modified
```

### **Working Clone (rf_active)**
```javascript
localStorage.getItem("rf_active")
// Contains: 7,054 items (initially same as master)
// CountedQty: Gets filled as users count
// Variance: Auto-calculated when counting
// Purpose: Day-to-day operations
// Changes: Updated constantly
```

### **Example After Counting:**

**Master (unchanged):**
```json
{
  "BinCode": "01-0002",
  "ItemCode": "4252237-DTZ",
  "Description": "PROFILE WASHER",
  "ExpectedQty": 4,
  "CountedQty": undefined,
  "Variance": undefined
}
```

**Clone (working copy):**
```json
{
  "BinCode": "01-0002",
  "ItemCode": "4252237-DTZ",
  "Description": "PROFILE WASHER",
  "ExpectedQty": 4,
  "CountedQty": 5,        ← User counted this
  "Variance": 1           ← Auto-calculated
}
```

---

## 🔄 Refresh from Master

If you need to reset and reload from master:

### **Method 1: Clear All Data (Settings)**
1. Go to **Settings** tab
2. Scroll to bottom
3. Click **"Clear All Data"**
4. Logout / Login again
5. App auto-fetches master file from VPS
6. Fresh clone created ✅

### **Method 2: Clear Browser Storage**
1. Open browser DevTools (F12)
2. Go to: Application → Local Storage
3. Clear all `rf_*` keys
4. Refresh page
5. Login
6. Auto-loads from master ✅

---

## 📁 VPS File Structure

After upload, your VPS should look like:

```
/var/www/rf-scanner/
├── index.html
├── assets/
│   ├── index-xxxxx.js
│   └── index-xxxxx.css
└── data/
    └── master_inventory.xlsx  ← Your uploaded file
```

---

## 🌐 Nginx Configuration (Already Set)

Your nginx is already serving static files, so `/data/master_inventory.xlsx` will be accessible at:

```
https://rf.andel-vps.space/data/master_inventory.xlsx
```

The app automatically fetches from this URL!

---

## 🔧 Update Master File

When you need to update the master inventory:

### **Option 1: Re-upload (Recommended)**
```powershell
# Upload new version
scp "C:\Users\andel\Desktop\Marind\rf scanner\master_inventory.xlsx" root@72.60.170.192:/var/www/rf-scanner/data/

# Users just need to Clear Data → Reload
```

### **Option 2: Export from SAP**
```powershell
# If using Python script from SAP:
python master_inventory.py

# Then upload to VPS:
scp master_inventory.xlsx root@72.60.170.192:/var/www/rf-scanner/data/
```

---

## 📤 Export Results

Users export their **counted data** (the clone):

```csv
BinCode,ItemCode,Description,ExpectedQty,CountedQty,Variance
01-0002,4252237-DTZ,PROFILE WASHER,4,5,1
01-0004,1182349-DTZ,O-SEAL,1,1,0
...
```

- Master remains untouched ✅
- Clone contains all count data ✅
- Export shows variances ✅

---

## 🎯 Complete Workflow

### **1. Setup (You - Admin)**
```powershell
# Create data directory
ssh root@72.60.170.192 "mkdir -p /var/www/rf-scanner/data"

# Upload master inventory
scp master_inventory.xlsx root@72.60.170.192:/var/www/rf-scanner/data/

# Deploy app
.\deploy-rf.ps1
```

### **2. First User**
```
1. Visit: https://rf.andel-vps.space
2. Login: admin / admin123
3. App auto-loads master (7,054 items)
4. Start scanning/counting
5. All changes go to clone
6. Export results when done
7. Master stays clean ✅
```

### **3. Next User (Same Day)**
```
1. Login with their account
2. Sees existing data (clone)
3. Continues where others left off
4. All working from same clone
5. Master still untouched ✅
```

### **4. Next Day / New Count**
```
1. Admin: Clear All Data
2. Users: Login
3. App: Re-fetches master
4. Fresh clone created
5. Start new count ✅
```

---

## ⚠️ Important Notes

### **Browser Storage (Not Server)**
- `rf_master` and `rf_active` are stored in **browser localStorage**
- Each user has their own copy in their browser
- NOT shared between users automatically
- For multi-user same-session: need to export/import between users

### **Permissions**
```bash
# Make sure data folder is readable by nginx:
chown -R www-data:www-data /var/www/rf-scanner/data
chmod 755 /var/www/rf-scanner/data
chmod 644 /var/www/rf-scanner/data/master_inventory.xlsx
```

### **File Size**
Your file (7,054 items) is ~500KB, loads in 1-2 seconds ✅

---

## 🧪 Testing

### **Test 1: Upload File**
```powershell
scp master_inventory.xlsx root@72.60.170.192:/var/www/rf-scanner/data/
```

### **Test 2: Verify on VPS**
```bash
ssh root@72.60.170.192
ls -lh /var/www/rf-scanner/data/
# Should show: master_inventory.xlsx
exit
```

### **Test 3: Test Auto-Load**
```
1. Open: https://rf.andel-vps.space
2. Login: admin / admin123
3. Watch for: "📥 Loading master inventory from server..."
4. Should see: "✅ Loaded 7,054 items from master inventory"
5. Redirected to Home ✅
```

---

## 📋 Quick Command Reference

```powershell
# Upload master file
scp master_inventory.xlsx root@72.60.170.192:/var/www/rf-scanner/data/

# Check if file exists on VPS
ssh root@72.60.170.192 "ls -lh /var/www/rf-scanner/data/"

# Set permissions
ssh root@72.60.170.192 "chown -R www-data:www-data /var/www/rf-scanner/data"

# Deploy app after upload
.\deploy-rf.ps1
```

---

## ✅ Summary

| Component | Location | Changes? |
|-----------|----------|----------|
| **Master File** | VPS: `/data/master_inventory.xlsx` | ❌ Never |
| **Master Copy** | Browser: `localStorage.rf_master` | ❌ Never |
| **Working Clone** | Browser: `localStorage.rf_active` | ✅ Yes |
| **Exports** | Downloads from clone | ✅ Yes |

**Result:** Master stays pristine, all work happens in clone! 🎉

---

**Ready to upload your master file?** Run the SCP command above! 🚀

