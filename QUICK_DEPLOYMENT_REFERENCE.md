# ⚡ Quick Deployment Reference

## One-Line Setup (After Uploading Server)

```bash
# On VPS, after uploading server folder:
cd /var/www/rf-scanner/server && chmod +x setup-server.sh && ./setup-server.sh
```

## Manual Quick Steps

### 1. Upload Server
```powershell
# From local machine (PowerShell)
scp -r server root@72.60.170.192:/var/www/rf-scanner/
```

### 2. Setup on VPS
```bash
# SSH into VPS
ssh root@72.60.170.192

# Run setup script
cd /var/www/rf-scanner/server
chmod +x setup-server.sh
./setup-server.sh
```

### 3. Configure PM2 Startup
```bash
pm2 startup
# Copy and run the output command, then:
pm2 save
```

### 4. Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/rf-scanner
```

Add this block **BEFORE** `location /`:
```nginx
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

Then:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Initialize Admin
```bash
curl -X POST http://localhost:3001/api/users/init-admin
```

### 6. Verify
```bash
# Test API
curl http://localhost:3001/api/health
curl http://localhost/api/health

# Check PM2
pm2 status
pm2 logs rf-api
```

## Common Commands

```bash
# PM2
pm2 status              # View status
pm2 logs rf-api         # View logs
pm2 restart rf-api      # Restart
pm2 stop rf-api         # Stop
pm2 monit               # Monitor dashboard

# Nginx
sudo nginx -t           # Test config
sudo systemctl reload nginx  # Reload

# API
curl http://localhost:3001/api/health
curl -X POST http://localhost:3001/api/users/init-admin
```

## Troubleshooting

```bash
# API not working?
pm2 logs rf-api --lines 50
curl http://localhost:3001/api/health

# Nginx not proxying?
sudo tail -f /var/log/nginx/error.log
sudo nginx -T | grep -A 10 "location /api"

# Permissions?
sudo chown -R www-data:www-data /var/www/rf-scanner/data
```

