# 🚀 Backend API Deployment Walkthrough

This guide will walk you through deploying the backend API server to your VPS at `72.60.170.192`.

## Prerequisites Check

First, let's verify your VPS is ready:

```bash
# SSH into your VPS
ssh root@72.60.170.192

# Check if Node.js is installed
node --version

# If Node.js is not installed or version is too old, install it:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

## Step 1: Upload Server Files

From your **local machine** (PowerShell), upload the server folder:

```powershell
# From PowerShell in project root
scp -r server root@72.60.170.192:/var/www/rf-scanner/
```

## Step 2: Install Dependencies

**On your VPS**, install the Node.js dependencies:

```bash
# SSH into VPS if not already
ssh root@72.60.170.192

# Navigate to server directory
cd /var/www/rf-scanner/server

# Install dependencies
npm install

# Verify installation
ls -la node_modules
```

Expected output: You should see `express`, `cors`, and `bcryptjs` installed.

## Step 3: Create Environment File

Create the `.env` file in the server directory:

```bash
# Still in /var/www/rf-scanner/server
nano .env
```

Add these lines:

```
PORT=3001
DATA_DIR=/var/www/rf-scanner/data
NODE_ENV=production
```

Save the file:
- Press `Ctrl + O` (write out)
- Press `Enter` (confirm filename)
- Press `Ctrl + X` (exit)

## Step 4: Set Up Data Directory

Create and configure the data directory:

```bash
# Create data directory
sudo mkdir -p /var/www/rf-scanner/data

# Set ownership (www-data user for Nginx)
sudo chown -R www-data:www-data /var/www/rf-scanner/data

# Set permissions
sudo chmod -R 755 /var/www/rf-scanner/data

# Verify
ls -la /var/www/rf-scanner/data
```

## Step 5: Install PM2

Install PM2 globally:

```bash
sudo npm install -g pm2

# Verify installation
pm2 --version
```

## Step 6: Start API Server with PM2

Start the server using the ecosystem configuration:

```bash
# Navigate to server directory
cd /var/www/rf-scanner/server

# Start with PM2 using ecosystem config
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs rf-api
```

You should see:
- ✅ Status: `online`
- ✅ Logs showing: `🚀 RF Scanner API server running on port 3001`

## Step 7: Configure PM2 Auto-Start

Set PM2 to start on system boot:

```bash
# Save current PM2 process list
pm2 save

# Generate startup script
pm2 startup
```

The `pm2 startup` command will output a command like:
```
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
```

**Copy and run that command** (it will be different for your system).

## Step 8: Configure Nginx Proxy

Edit your Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/rf-scanner
```

**Add this `location /api` block BEFORE the `location /` block:**

```nginx
server {
    listen 80;
    server_name rf.andel-vps.space;

    root /var/www/rf-scanner;
    index index.html;

    # Proxy API requests to Node.js backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /data/ {
        autoindex on;
    }
}
```

**Important:** The `/api` location block must come BEFORE the `/` location block.

Save and exit:
- `Ctrl + O`, `Enter`, `Ctrl + X`

Test and reload Nginx:

```bash
# Test configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

## Step 9: Initialize Admin User

Initialize the default admin user:

```bash
# Test API health first
curl http://localhost:3001/api/health

# Initialize admin user
curl -X POST http://localhost:3001/api/users/init-admin

# Expected response:
# {"message":"Admin user created","user":{"id":"user-1","username":"admin",...}}
```

## Step 10: Verify Everything Works

### Test API Directly (on VPS)

```bash
# Health check
curl http://localhost:3001/api/health

# Test login endpoint
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Test API Through Nginx (from local machine)

```bash
# From your local machine
curl http://72.60.170.192/api/health

# Or if you have DNS set up
curl http://rf.andel-vps.space/api/health
```

### Test from Browser

1. Visit `http://rf.andel-vps.space/api/health`
2. You should see: `{"status":"ok","timestamp":"..."}`
3. Visit `http://rf.andel-vps.space` and try logging in with `admin/admin123`

## Useful PM2 Commands

```bash
# View all processes
pm2 status

# View logs
pm2 logs rf-api

# View logs (last 100 lines, no streaming)
pm2 logs rf-api --lines 100

# Restart API
pm2 restart rf-api

# Stop API
pm2 stop rf-api

# Start API
pm2 start rf-api

# Delete API from PM2
pm2 delete rf-api

# Monitor (real-time dashboard)
pm2 monit

# Reload API (zero-downtime)
pm2 reload rf-api
```

## Troubleshooting

### API Not Responding?

1. **Check if PM2 is running:**
   ```bash
   pm2 status
   ```

2. **Check logs for errors:**
   ```bash
   pm2 logs rf-api --lines 50
   ```

3. **Test API directly:**
   ```bash
   curl http://localhost:3001/api/health
   ```

4. **Check if port 3001 is in use:**
   ```bash
   sudo netstat -tlnp | grep 3001
   # Or
   sudo ss -tlnp | grep 3001
   ```

### Nginx Proxy Not Working?

1. **Test Nginx configuration:**
   ```bash
   sudo nginx -t
   ```

2. **Check Nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

3. **Verify proxy configuration is loaded:**
   ```bash
   sudo nginx -T | grep -A 10 "location /api"
   ```

4. **Test from server:**
   ```bash
   curl http://localhost/api/health
   ```

### Can't Login?

1. **Re-initialize admin user:**
   ```bash
   curl -X POST http://localhost:3001/api/users/init-admin
   ```

2. **Check users file:**
   ```bash
   cat /var/www/rf-scanner/data/users.json
   ```

### Permission Errors?

```bash
# Fix data directory permissions
sudo chown -R www-data:www-data /var/www/rf-scanner/data
sudo chmod -R 755 /var/www/rf-scanner/data

# Fix server directory permissions
sudo chown -R root:root /var/www/rf-scanner/server
sudo chmod -R 755 /var/www/rf-scanner/server
```

### PM2 Not Starting on Boot?

```bash
# Re-run startup script
pm2 startup

# Copy and run the output command, then:
pm2 save
```

## Quick Verification Checklist

- [ ] Node.js installed and version ≥ 18
- [ ] Server files uploaded to `/var/www/rf-scanner/server`
- [ ] Dependencies installed (`npm install` completed)
- [ ] `.env` file created with correct values
- [ ] Data directory exists and has correct permissions
- [ ] PM2 installed globally
- [ ] API running in PM2 (`pm2 status` shows `online`)
- [ ] PM2 startup configured (`pm2 startup` run)
- [ ] Nginx configured with `/api` proxy
- [ ] Nginx reloaded (`sudo systemctl reload nginx`)
- [ ] API health check works: `curl http://localhost:3001/api/health`
- [ ] API through Nginx works: `curl http://localhost/api/health`
- [ ] Admin user initialized
- [ ] Can login via web interface

## Next Steps

Once the backend is deployed and working:

1. **Build and deploy frontend:**
   ```powershell
   # From local machine
   npm run build
   .\deploy-rf.ps1
   ```

2. **Test the full application:**
   - Visit `http://rf.andel-vps.space`
   - Login with `admin/admin123`
   - Create a test user
   - Verify data persists across page refreshes

## 🎉 Success!

Your backend API is now running on the server and accessible via Nginx proxy. All API requests from your frontend will be automatically proxied to the Node.js backend running on port 3001.

