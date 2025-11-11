# Deploy Shipping Module Changes - Quick Guide

## What Changed

### Frontend (React App)
- ✅ New Shipping page (`src/pages/shipping-page.tsx`)
- ✅ Updated navigation (footer nav + home page)
- ✅ Updated types (`src/types/index.ts`)

### Backend (Python Shipping Tools)
- ✅ New email utility (`puro/email_utils.py`)
- ✅ Updated batch shipping app (`puro/batch_shipping_app.py`)
- ✅ Email setup documentation (`puro/EMAIL_SETUP.md`)

---

## Deployment Steps

### Step 1: Deploy Frontend Changes (Shipping Page)

The shipping page is part of your React app, so you need to rebuild and deploy:

#### Option A: Using PowerShell (Windows)

```powershell
# Navigate to project root
cd "C:\Users\andel\Desktop\Marind\rf scanner"

# Run deployment script
.\deploy-rf.ps1
```

This will:
1. Build the React app (includes new Shipping page)
2. Upload to your VPS server
3. Restart nginx

#### Option B: Manual Deployment

```bash
# 1. Build the app
npm run build

# 2. Upload to server (replace with your server details)
scp -r dist/* root@72.60.170.192:/var/www/rf-scanner/

# 3. Set permissions and reload
ssh root@72.60.170.192 "chown -R www-data:www-data /var/www/rf-scanner; systemctl reload nginx"
```

**Result**: The Shipping page will now appear in your web app! 🎉

---

### Step 2: Deploy Python Shipping Tools (Optional)

The Python shipping tools can run **locally** on your computer OR on the server.

#### Option A: Run Locally (Recommended)

**No deployment needed!** The Python tools run on your computer:

1. Make sure you have the latest files in `puro/` folder
2. Set up `.env` file with email settings (see `EMAIL_SETUP.md`)
3. Run the tools locally:
   ```bash
   cd "C:\Users\andel\Desktop\Marind\rf scanner\puro"
   python batch_shipping_app.py
   ```

**Pros**: 
- ✅ No server setup needed
- ✅ Easy to update
- ✅ Can test locally

#### Option B: Deploy to Server

If you want to run the Python tools on your server:

```bash
# 1. Upload puro folder to server
scp -r puro root@72.60.170.192:/var/www/rf-scanner/

# 2. SSH into server
ssh root@72.60.170.192

# 3. Install Python dependencies (if not already installed)
cd /var/www/rf-scanner/puro
pip3 install -r requirements.txt

# 4. Set up .env file on server
nano .env
# Add your Purolator and email credentials

# 5. Test
python3 batch_shipping_app.py
```

**Note**: You'll need Python 3.7+ and the required packages on the server.

---

## Quick Deployment Checklist

### Frontend (Required)
- [ ] Run `npm run build` or `.\deploy-rf.ps1`
- [ ] Verify Shipping page appears in web app
- [ ] Test clicking Shipping button in footer

### Python Tools (Optional - depends on where you run them)
- [ ] If running locally: No deployment needed ✅
- [ ] If running on server: Upload `puro/` folder
- [ ] Set up `.env` file with email settings
- [ ] Install Python dependencies (`pip install -r requirements.txt`)

---

## Verification

### After Frontend Deployment:

1. **Open your web app**: https://rf.andel-vps.space (or your URL)
2. **Check footer**: Should see "Shipping" button (📦 icon)
3. **Check home page**: Should see "Shipping" quick action button
4. **Click Shipping**: Should see the shipping page with order list

### After Python Tools Setup:

1. **Test email configuration**:
   ```bash
   cd puro
   python email_utils.py
   ```
   Should show: `✓ Email configuration found`

2. **Test shipping app**:
   ```bash
   python batch_shipping_app.py
   ```
   Should open without errors

---

## What Gets Deployed Where

### Frontend (React App) → VPS Server
- ✅ `src/pages/shipping-page.tsx` → Built into `dist/`
- ✅ `src/app.tsx` → Built into `dist/`
- ✅ `src/components/footer-nav.tsx` → Built into `dist/`
- ✅ `src/types/index.ts` → Built into `dist/`

**Location on server**: `/var/www/rf-scanner/`

### Python Tools → Local OR Server (Your Choice)
- ✅ `puro/email_utils.py`
- ✅ `puro/batch_shipping_app.py`
- ✅ `puro/address_book_db.py`
- ✅ `puro/email_utils.py`
- ✅ All other `puro/` files

**Location**: Wherever you want to run them (local recommended)

---

## Common Deployment Issues

### Problem: "Shipping page not showing"

**Solution**:
1. Make sure you ran `npm run build`
2. Check that deployment completed successfully
3. Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)
4. Check browser console for errors

### Problem: "Python tools not working on server"

**Solution**:
1. Check Python version: `python3 --version` (need 3.7+)
2. Install dependencies: `pip3 install -r requirements.txt`
3. Check `.env` file exists and has correct settings
4. Check file permissions: `chmod +x batch_shipping_app.py`

### Problem: "Email not sending"

**Solution**:
1. Check `.env` file has email settings
2. Verify Gmail App Password (not regular password)
3. Test with: `python email_utils.py`
4. Check console output for error messages

---

## Recommended Setup

**For Most Users**:

1. **Frontend**: Deploy to VPS (web app)
2. **Python Tools**: Run locally on your computer
3. **Workflow**:
   - Use web app to select/export orders
   - Run Python tools locally to create shipments
   - Labels automatically emailed to aobryan@marind.ca

**Why this setup?**
- ✅ Web app accessible from anywhere
- ✅ Python tools easy to update locally
- ✅ No need to install Python on server
- ✅ Simpler maintenance

---

## Quick Commands Reference

### Deploy Frontend
```powershell
# Windows
.\deploy-rf.ps1

# Or manual
npm run build
scp -r dist/* root@72.60.170.192:/var/www/rf-scanner/
```

### Update Python Tools Locally
```bash
# Just make sure files are in puro/ folder
# No deployment needed - they run locally!
cd "C:\Users\andel\Desktop\Marind\rf scanner\puro"
python batch_shipping_app.py
```

### Update Python Tools on Server (if needed)
```bash
scp -r puro root@72.60.170.192:/var/www/rf-scanner/
ssh root@72.60.170.192
cd /var/www/rf-scanner/puro
pip3 install -r requirements.txt
```

---

## Summary

**To see the Shipping page in your web app**:
1. Run `.\deploy-rf.ps1` (or `npm run build` + upload)
2. Done! ✅

**To use email labels**:
1. Set up `.env` file in `puro/` folder
2. Run Python tools locally (no deployment needed)
3. Done! ✅

The frontend changes (Shipping page) need to be deployed. The Python tools run locally, so no deployment needed for those!

---

**Questions?** Check:
- `EMAIL_SETUP.md` - Email configuration
- `HOW_TO_USE_SHIPPING.md` - How to use the shipping system
- `ADDRESS_BOOK_README.md` - Complete shipping guide

