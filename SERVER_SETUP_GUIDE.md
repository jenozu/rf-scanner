# 🚀 Server-Side Storage Setup Guide

This guide will help you set up the backend API server to store users and data on your VPS instead of in browser localStorage.

## ✅ What This Changes

- **Users**: Stored on server, accessible to all devices/browsers
- **Inventory Data**: Stored on server, shared across all users
- **Admin Control**: You can create users and they'll be available to everyone immediately

## 📋 Prerequisites

- Ubuntu VPS (already set up)
- Node.js installed (check with `node --version`)
- Nginx configured (already set up)

## 🔧 Step 1: Install Node.js (if not already installed)

```bash
# On your VPS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

## 🔧 Step 2: Install PM2 (Process Manager)

PM2 will keep your API server running 24/7:

```bash
sudo npm install -g pm2
```

## 🔧 Step 3: Upload and Install Backend

From your local machine, upload the server folder:

```powershell
# From PowerShell in project root
scp -r server root@72.60.170.192:/var/www/rf-scanner/
```

Then on your VPS:

```bash
cd /var/www/rf-scanner/server
npm install
```

## 🔧 Step 4: Configure Environment Variables

Create a `.env` file in `/var/www/rf-scanner/server/`:

```bash
cd /var/www/rf-scanner/server
nano .env
```

Add:
```
PORT=3001
DATA_DIR=/var/www/rf-scanner/data
NODE_ENV=production
```

Save (Ctrl+O, Enter, Ctrl+X)

## 🔧 Step 5: Set Permissions

```bash
# Ensure data directory exists and has correct permissions
sudo mkdir -p /var/www/rf-scanner/data
sudo chown -R www-data:www-data /var/www/rf-scanner/data
sudo chmod -R 755 /var/www/rf-scanner/data
```

## 🔧 Step 6: Start the API Server with PM2

```bash
cd /var/www/rf-scanner/server
pm2 start index.js --name rf-api
pm2 save
pm2 startup
```

The last command will give you a command to run with sudo - copy and run it.

## 🔧 Step 7: Update Nginx Configuration

Edit your Nginx config:

```bash
sudo nano /etc/nginx/sites-available/rf-scanner
```

Add this inside the `server` block (before the `location /` block):

```nginx
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
```

Your full config should look like:

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

Test and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 🔧 Step 8: Build and Deploy Frontend

From your local machine:

```powershell
# Build the app
npm run build

# Deploy (this will use the updated deploy script)
.\deploy-rf.ps1
```

## ✅ Step 9: Verify Everything Works

1. Visit `https://rf.andel-vps.space`
2. Login with `admin/admin123`
3. Check that users can be created and are visible across devices
4. Check that inventory data loads from server

## 🛠️ Useful PM2 Commands

```bash
# View logs
pm2 logs rf-api

# Restart server
pm2 restart rf-api

# Stop server
pm2 stop rf-api

# View status
pm2 status

# Monitor
pm2 monit
```

## 📁 Data Storage Location

All data is stored in `/var/www/rf-scanner/data/`:
- `users.json` - User accounts
- `rf_active.json` - Active inventory
- `rf_master.json` - Master inventory
- `rf_purchase_orders.json` - Purchase orders
- And other data files...

## 🔒 Security Notes

- Passwords are hashed using bcrypt
- Users are stored server-side (not in browser)
- API runs on localhost (only accessible via Nginx proxy)

## 🐛 Troubleshooting

### API not responding?

1. Check if PM2 is running: `pm2 status`
2. Check logs: `pm2 logs rf-api`
3. Test API directly: `curl http://localhost:3001/api/health`

### Can't login?

1. Initialize admin user: Visit `/api/users/init-admin` (POST request)
2. Or check data directory permissions

### Data not saving?

1. Check `/var/www/rf-scanner/data` permissions
2. Check PM2 logs for errors
3. Verify Nginx proxy is working

## 🎉 That's It!

Your app now stores everything on the server. Users you create will be available to everyone, and all inventory data is shared across all devices!

