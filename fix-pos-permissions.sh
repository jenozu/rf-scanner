#!/bin/bash
# Fix permissions for /data/pos/ directory so nginx can serve files

# Set ownership to www-data
chown -R www-data:www-data /var/www/rf-scanner/data/pos

# Set directory permissions (755 = rwxr-xr-x)
chmod 755 /var/www/rf-scanner/data
chmod 755 /var/www/rf-scanner/data/pos

# Set file permissions (644 = rw-r--r--)
chmod 644 /var/www/rf-scanner/data/pos/*.csv 2>/dev/null || true
chmod 644 /var/www/rf-scanner/data/pos/*.xlsx 2>/dev/null || true

# Verify
echo "✅ Permissions set. Listing files:"
ls -la /var/www/rf-scanner/data/pos/

echo ""
echo "✅ Reloading nginx..."
systemctl reload nginx

echo ""
echo "✅ Done! Try 'Fetch' again in the app."

