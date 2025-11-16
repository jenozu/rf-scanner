#!/bin/bash
cd /var/www/rf-scanner
echo "Cleaning old build (preserving /data and /server folders)..."
# Remove everything except the data and server folders
sudo find . -mindepth 1 -maxdepth 1 ! -name 'data' ! -name 'server' -exec rm -rf {} +
echo "Copying new build..."
scp -r "C:\Users\andel\Desktop\Marind\rf scanner\dist\*" root@72.60.170.192:/var/www/rf-scanner/

# Verify deployment - check that index.html references compiled assets, not source files
echo "Verifying deployment..."
if grep -q '/src/main.tsx' /var/www/rf-scanner/index.html 2>/dev/null; then
    echo "⚠️  WARNING: index.html still references source files!"
    echo "This might indicate a deployment issue."
else
    echo "✅ Verified: index.html references compiled assets"
fi

sudo chown -R www-data:www-data /var/www/rf-scanner
sudo systemctl reload nginx
echo "✅  Deployment complete!"
