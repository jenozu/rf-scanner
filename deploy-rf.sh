#!/bin/bash
cd /var/www/rf-scanner
echo "Cleaning old build..."
sudo rm -rf ./*
echo "Copying new build..."
scp -r "C:\Users\andel\Desktop\Marind\rf scanner\dist\*" root@72.60.170.192:/var/www/rf-scanner/
sudo chown -R www-data:www-data /var/www/rf-scanner
sudo systemctl reload nginx
echo "✅  Deployment complete!"
