# PowerShell deployment script for RF Scanner
Write-Host "🚀 Starting deployment to VPS..." -ForegroundColor Cyan

# Build the app
Write-Host "`n📦 Building production version..." -ForegroundColor Yellow
Set-Location "c:\Users\andel\Desktop\Marind\rf scanner"
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
    
    # Deploy using scp
    Write-Host "`n🌐 Deploying to server 72.60.170.192..." -ForegroundColor Yellow
    Write-Host "Please enter your server password when prompted." -ForegroundColor Gray
    
    # Clean old build files (preserve /data and /server folders)
    Write-Host "`n🧹 Cleaning old build files (preserving /data and /server folders)..." -ForegroundColor Yellow
    ssh root@72.60.170.192 "cd /var/www/rf-scanner; find . -mindepth 1 -maxdepth 1 ! -name 'data' ! -name 'server' -exec rm -rf {} +"
    
    # Copy files
    Write-Host "`n📤 Uploading new build..." -ForegroundColor Yellow
    scp -r dist/* root@72.60.170.192:/var/www/rf-scanner/
    
    if ($LASTEXITCODE -eq 0) {
        # Verify deployment - check that index.html references compiled assets, not source files
        Write-Host "`n🔍 Verifying deployment..." -ForegroundColor Yellow
        $indexCheck = ssh root@72.60.170.192 "grep -q '/src/main.tsx' /var/www/rf-scanner/index.html && echo 'ERROR' || echo 'OK'"
        if ($indexCheck -match 'ERROR') {
            Write-Host "⚠️  WARNING: index.html still references source files!" -ForegroundColor Red
            Write-Host "This might indicate a deployment issue." -ForegroundColor Yellow
        } else {
            Write-Host "✅ Verified: index.html references compiled assets" -ForegroundColor Green
        }
        
        Write-Host "`n🔧 Setting permissions and reloading nginx..." -ForegroundColor Yellow
        ssh root@72.60.170.192 "chown -R www-data:www-data /var/www/rf-scanner; systemctl reload nginx"
        
        Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
        Write-Host "🌍 Your app is live at: https://rf.andel-vps.space" -ForegroundColor Cyan
    } else {
        Write-Host "`n❌ Deployment failed during file transfer" -ForegroundColor Red
    }
} else {
    Write-Host "`n❌ Build failed!" -ForegroundColor Red
}

