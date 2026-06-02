# Complete deployment script for RF Scanner (Frontend + Backend)
# Run this from PowerShell in the project root

. "$PSScriptRoot/deploy-config.ps1"
$projectPath = "C:\Users\andel\Desktop\Marind\rf scanner"

Write-Host "Starting complete deployment to VPS..." -ForegroundColor Cyan
Write-Host ""

# Test SSH connection first
Write-Host "🔌 Testing SSH connection..." -ForegroundColor Yellow
$testConnection = ssh -o BatchMode=yes -o ConnectTimeout=5 $vpsHost "echo 'OK'" 2>&1
if ($LASTEXITCODE -ne 0 -or $testConnection -notmatch "OK") {
    Write-Host "❌ SSH connection failed!" -ForegroundColor Red
    Write-Host "Make sure SSH keys are set up correctly." -ForegroundColor Yellow
    Write-Host "Test manually with: ssh $vpsHost" -ForegroundColor Gray
    exit 1
}
Write-Host "✅ SSH connection successful (using SSH keys)" -ForegroundColor Green
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

# Clean old build files (preserve /data and /server folders)
Write-Host "Cleaning old build files (preserving /data and /server folders)..." -ForegroundColor Yellow
ssh -o BatchMode=yes $vpsHost "cd $remotePath; find . -mindepth 1 -maxdepth 1 ! -name 'data' ! -name 'server' -exec rm -rf {} +"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to clean old files!" -ForegroundColor Red
    exit 1
}

# Copy frontend files
Write-Host "Uploading frontend build..." -ForegroundColor Yellow
scp -o BatchMode=yes -r dist/* "${vpsHost}:${remotePath}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Frontend deployed!" -ForegroundColor Green
Write-Host ""

# Step 3: Deploy backend
Write-Host "Step 3: Deploying backend (server folder)..." -ForegroundColor Yellow
scp -o BatchMode=yes -r server "${vpsHost}:${remotePath}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Backend deployed!" -ForegroundColor Green
Write-Host ""

# Step 4: Install dependencies and restart backend
Write-Host "Step 4: Installing dependencies and restarting backend..." -ForegroundColor Yellow
ssh -o BatchMode=yes $vpsHost "cd ${remotePath}/server; npm install; sudo pm2 restart rf-api"

if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Backend restart may have failed. Check PM2 status manually." -ForegroundColor Yellow
} else {
    Write-Host "Backend restarted!" -ForegroundColor Green
}

Write-Host ""

# Step 5: Set permissions and reload nginx
Write-Host "Step 5: Setting permissions and reloading nginx..." -ForegroundColor Yellow
ssh -o BatchMode=yes $vpsHost "sudo chown -R www-data:www-data $remotePath; sudo systemctl reload nginx"

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "App is live at: http://$SERVER_IP" -ForegroundColor Cyan
Write-Host ""
Write-Host "To check backend status:" -ForegroundColor Yellow
$statusCmd = "ssh $vpsHost pm2 status"
$logsCmd = "ssh $vpsHost pm2 logs rf-api --lines 20"
Write-Host "   $statusCmd" -ForegroundColor Gray
Write-Host "   $logsCmd" -ForegroundColor Gray

