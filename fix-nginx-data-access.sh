#!/bin/bash
# Fix nginx config and permissions for /data/pos/ access

echo "🔍 Step 1: Checking nginx config..."
nginx -t

echo ""
echo "🔍 Step 2: Checking current nginx config for /data/ location..."
grep -A 5 "location /data" /etc/nginx/sites-available/rf-scanner || echo "⚠️  /data/ location block not found!"

echo ""
echo "🔧 Step 3: Fixing ALL directory permissions from root up..."
chown -R www-data:www-data /var/www/rf-scanner
chmod 755 /var/www
chmod 755 /var/www/rf-scanner
chmod 755 /var/www/rf-scanner/data
chmod 755 /var/www/rf-scanner/data/pos

echo ""
echo "🔧 Step 4: Fixing file permissions..."
chmod 644 /var/www/rf-scanner/data/pos/*.csv 2>/dev/null || true
chmod 644 /var/www/rf-scanner/data/pos/*.xlsx 2>/dev/null || true

echo ""
echo "✅ Step 5: Verifying ownership..."
ls -la /var/www/rf-scanner/data/pos/

echo ""
echo "🔄 Step 6: Reloading nginx..."
systemctl reload nginx

echo ""
echo "✅ Done! Test: https://rf.andel-vps.space/data/pos/"

