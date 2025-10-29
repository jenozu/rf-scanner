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
    
    # Copy files
    scp -r dist/* root@72.60.170.192:/var/www/rf-scanner/
    
    if ($LASTEXITCODE -eq 0) {
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

