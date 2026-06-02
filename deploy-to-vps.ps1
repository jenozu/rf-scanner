# Deploy RF Scanner app to VPS
# Run this from PowerShell in the project root

. "$PSScriptRoot/deploy-config.ps1"

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
ssh $vpsHost "sudo chown -R www-data:www-data $remotePath && sudo systemctl reload nginx"

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "🌐 Your app is live at: http://$SERVER_IP" -ForegroundColor Cyan

