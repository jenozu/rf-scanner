# PowerShell script to upload PO CSV/XLSX files to VPS
# Usage: Run this from PowerShell in the project root

$localFolder = "C:\Users\andel\Desktop\Marind\rf scanner\PO"
$vpsHost = "root@72.60.170.192"
$remotePath = "/var/www/rf-scanner/data/pos"

Write-Host "📤 Uploading PO files from: $localFolder" -ForegroundColor Cyan
Write-Host "📥 Destination: $vpsHost:$remotePath" -ForegroundColor Cyan
Write-Host ""

# Ensure remote directory exists and has correct permissions (one-time setup)
Write-Host "🔧 Setting up remote directory..." -ForegroundColor Yellow
ssh $vpsHost "mkdir -p $remotePath && chown -R www-data:www-data /var/www/rf-scanner/data"

Write-Host ""
Write-Host "📦 Uploading all CSV files..." -ForegroundColor Green
scp "$localFolder\*.csv" "${vpsHost}:${remotePath}/"

Write-Host ""
Write-Host "📦 Uploading all XLSX files..." -ForegroundColor Green
scp "$localFolder\*.xlsx" "${vpsHost}:${remotePath}/"

Write-Host ""
Write-Host "✅ Upload complete! Check your Receive tab -> 'Load POs from Server' -> 'Fetch'" -ForegroundColor Green

