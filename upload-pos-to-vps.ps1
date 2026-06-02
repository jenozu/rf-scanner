# PowerShell script to upload PO CSV/XLSX files to VPS
# Usage: Run this from PowerShell in the project root

. "$PSScriptRoot/deploy-config.ps1"
$localFolder = "C:\Users\andel\Desktop\Marind\rf scanner\PO"
$remotePath  = "/var/www/rf-scanner/data/pos"

Write-Host "📤 Uploading PO files from: $localFolder" -ForegroundColor Cyan
Write-Host "📥 Destination: $vpsHost:$remotePath" -ForegroundColor Cyan
Write-Host ""

# Ensure remote directory exists and has correct permissions (one-time setup)
Write-Host "🔧 Setting up remote directory..." -ForegroundColor Yellow
ssh $vpsHost "mkdir -p $remotePath && sudo chown -R www-data:www-data /var/www/rf-scanner/data"

Write-Host ""
Write-Host "📦 Uploading all CSV files..." -ForegroundColor Green
scp "$localFolder\*.csv" "${vpsHost}:${remotePath}/"

Write-Host ""
Write-Host "📦 Uploading all XLSX files..." -ForegroundColor Green
scp "$localFolder\*.xlsx" "${vpsHost}:${remotePath}/"

Write-Host ""
Write-Host "✅ Upload complete! Check your Receive tab -> 'Load POs from Server' -> 'Fetch'" -ForegroundColor Green

