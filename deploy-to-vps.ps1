# Deploy RF Scanner app to VPS
# Run this from PowerShell in the project root

$vpsHost = "root@72.60.170.192"
$remotePath = "/var/www/rf-scanner"

Write-Host "📦 Deploying to $vpsHost:$remotePath" -ForegroundColor Cyan
Write-Host ""

# Copy all files from dist/ to VPS
Write-Host "📤 Uploading files..." -ForegroundColor Green
scp -r dist/* "${vpsHost}:${remotePath}/"

if ($LASTEXITCODE -eq 0) {
    # Verify deployment - check that index.html references compiled assets, not source files
    Write-Host "🔍 Verifying deployment..." -ForegroundColor Yellow
    $indexCheck = ssh $vpsHost "grep -q '/src/main.tsx' ${remotePath}/index.html && echo 'ERROR' || echo 'OK'"
    if ($indexCheck -match 'ERROR') {
        Write-Host "⚠️  WARNING: index.html still references source files!" -ForegroundColor Red
        Write-Host "This might indicate a deployment issue." -ForegroundColor Yellow
    } else {
        Write-Host "✅ Verified: index.html references compiled assets" -ForegroundColor Green
    }
    Write-Host ""
}

Write-Host "🔧 Setting permissions..." -ForegroundColor Yellow
ssh $vpsHost "chown -R www-data:www-data $remotePath && systemctl reload nginx"

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "🌐 Your app is live at: https://rf.andel-vps.space" -ForegroundColor Cyan

