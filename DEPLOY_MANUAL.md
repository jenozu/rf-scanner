# 🚀 Manual Deployment Guide

Follow these steps to deploy your changes to the VPS.

## Step 1: Build Frontend (Already Done ✅)
```powershell
cd "C:\Users\andel\Desktop\Marind\rf scanner"
npm run build
```
✅ Build completed successfully!

## Step 2: Deploy Frontend to VPS

**From PowerShell on your local machine:**

```powershell
# Clean old build files (preserving /data and /server folders)
ssh root@72.60.170.192 "cd /var/www/rf-scanner; find . -mindepth 1 -maxdepth 1 ! -name 'data' ! -name 'server' -exec rm -rf {} +"

# Upload frontend build
scp -r dist/* root@72.60.170.192:/var/www/rf-scanner/
```

## Step 3: Deploy Backend to VPS

**From PowerShell on your local machine:**

```powershell
# Upload server folder
scp -r server root@72.60.170.192:/var/www/rf-scanner/
```

## Step 4: Restart Backend on VPS

**SSH into your VPS and run:**

```bash
ssh root@72.60.170.192

# Navigate to server directory
cd /var/www/rf-scanner/server

# Install any new dependencies (if needed)
npm install

# Restart the backend service
pm2 restart rf-api

# Check status
pm2 status

# View logs to verify it's working
pm2 logs rf-api --lines 20
```

## Step 5: Set Permissions and Reload Nginx

**Still on the VPS:**

```bash
# Set permissions
chown -R www-data:www-data /var/www/rf-scanner

# Reload nginx
systemctl reload nginx
```

## Step 6: Verify Deployment

1. **Check the website:** https://rf.andel-vps.space
2. **Test login** with the fixed authentication
3. **Check backend logs** if needed:
   ```bash
   pm2 logs rf-api --lines 50
   ```

## Quick Commands Reference

**Check PM2 status:**
```bash
pm2 status
pm2 logs rf-api
pm2 restart rf-api
```

**Check Nginx:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

**View recent logs:**
```bash
pm2 logs rf-api --lines 50
```

## What Changed?

✅ **Frontend:**
- Fixed multiple bin locations showing in part lookups (deduplicated by ItemCode)
- Replaced PO receiving dropdown with simple input box
- Input box now pre-fills with default bin code

✅ **Backend:**
- Fixed login authentication (case-insensitive username matching)
- Added input trimming for usernames/passwords
- Better error handling and logging
- Improved user creation validation

---

**That's it!** Your changes should now be live on the VPS. 🎉

