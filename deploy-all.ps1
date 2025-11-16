# Complete deployment script for RF Scanner (Frontend + Backend)
# Run this from PowerShell in the project root

$vpsHost = "root@72.60.170.192"
$remotePath = "/var/www/rf-scanner"
$projectPath = "C:\Users\andel\Desktop\Marind\rf scanner"

Write-Host "Starting complete deployment to VPS..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Build frontend
Write-Host "Step 1: Building frontend..." -ForegroundColor Yellow
Set-Location $projectPath
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed! Aborting deployment." -ForegroundColor Red
    exit 1
}

Write-Host "Frontend build completed!" -ForegroundColor Green
Write-Host ""

# Step 2: Deploy frontend
Write-Host "Step 2: Deploying frontend (dist folder)..." -ForegroundColor Yellow
Write-Host "Please enter your server password when prompted." -ForegroundColor Gray

# Clean old build files (preserve /data and /server folders)
Write-Host "Cleaning old build files (preserving /data and /server folders)..." -ForegroundColor Yellow
ssh $vpsHost "cd $remotePath; find . -mindepth 1 -maxdepth 1 ! -name 'data' ! -name 'server' -exec rm -rf {} +"

# Copy frontend files
Write-Host "Uploading frontend build..." -ForegroundColor Yellow
scp -r dist/* "${vpsHost}:${remotePath}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend deployment failed!" -ForegroundColor Red
    exit 1
}

# Verify frontend deployment - check that index.html references compiled assets, not source files
Write-Host "Verifying frontend deployment..." -ForegroundColor Yellow
$indexCheck = ssh $vpsHost "grep -q '/src/main.tsx' ${remotePath}/index.html && echo 'ERROR' || echo 'OK'"
if ($indexCheck -match 'ERROR') {
    Write-Host "WARNING: index.html still references source files!" -ForegroundColor Red
    Write-Host "This might indicate a deployment issue." -ForegroundColor Yellow
} else {
    Write-Host "Verified: index.html references compiled assets" -ForegroundColor Green
}
Write-Host ""

# Step 3: Deploy backend
Write-Host "Step 3: Deploying backend (server folder)..." -ForegroundColor Yellow
scp -r server "${vpsHost}:${remotePath}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Backend deployed!" -ForegroundColor Green
Write-Host ""

# Step 4: Install dependencies and restart backend
Write-Host "Step 4: Installing dependencies and restarting backend..." -ForegroundColor Yellow
ssh $vpsHost "cd ${remotePath}/server; npm install; pm2 restart rf-api"

if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Backend restart may have failed. Check PM2 status manually." -ForegroundColor Yellow
} else {
    Write-Host "Backend restarted!" -ForegroundColor Green
}

Write-Host ""

# Step 5: Set permissions and reload nginx
Write-Host "Step 5: Setting permissions and reloading nginx..." -ForegroundColor Yellow
ssh $vpsHost "chown -R www-data:www-data $remotePath; systemctl reload nginx"

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "App is live at: https://rf.andel-vps.space" -ForegroundColor Cyan
Write-Host ""
Write-Host "To check backend status:" -ForegroundColor Yellow
$statusCmd = "ssh $vpsHost pm2 status"
$logsCmd = "ssh $vpsHost pm2 logs rf-api --lines 20"
Write-Host "   $statusCmd" -ForegroundColor Gray
Write-Host "   $logsCmd" -ForegroundColor Gray

