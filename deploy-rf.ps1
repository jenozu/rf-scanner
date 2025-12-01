# PowerShell deployment script for RF Scanner
Write-Host "Starting deployment to VPS..." -ForegroundColor Cyan

$vpsHost = "root@72.60.170.192"
$remotePath = "/var/www/rf-scanner"

# Test SSH connection first
Write-Host ""
Write-Host "Testing SSH connection..." -ForegroundColor Yellow
$testConnection = ssh -o BatchMode=yes -o ConnectTimeout=5 $vpsHost "echo 'OK'" 2>&1
if ($LASTEXITCODE -ne 0 -or $testConnection -notmatch "OK") {
    Write-Host "ERROR: SSH connection failed!" -ForegroundColor Red
    Write-Host "Make sure SSH keys are set up correctly." -ForegroundColor Yellow
    Write-Host "Test manually with: ssh $vpsHost" -ForegroundColor Gray
    exit 1
}
Write-Host "SSH connection successful (using SSH keys)" -ForegroundColor Green

# Build the app
Write-Host ""
Write-Host "Building production version..." -ForegroundColor Yellow
Set-Location "c:\Users\andel\Desktop\Marind\rf scanner"
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build completed successfully!" -ForegroundColor Green
    
    # Deploy using scp
    Write-Host ""
    Write-Host "Deploying to server 72.60.170.192..." -ForegroundColor Yellow
    
    # Clean old build files (preserve /data and /server folders)
    Write-Host ""
    Write-Host "Cleaning old build files (preserving /data and /server folders)..." -ForegroundColor Yellow
    ssh -o BatchMode=yes $vpsHost "cd $remotePath; find . -mindepth 1 -maxdepth 1 ! -name 'data' ! -name 'server' -exec rm -rf {} +"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ERROR: Failed to clean old files" -ForegroundColor Red
        exit 1
    }
    
    # Copy files
    Write-Host ""
    Write-Host "Uploading new build..." -ForegroundColor Yellow
    scp -o BatchMode=yes -r dist/* "${vpsHost}:${remotePath}/"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Setting permissions and reloading nginx..." -ForegroundColor Yellow
        ssh -o BatchMode=yes $vpsHost "chown -R www-data:www-data $remotePath; systemctl reload nginx"
        
        Write-Host ""
        Write-Host "Deployment complete!" -ForegroundColor Green
        Write-Host "Your app is live at: https://rf.andel-vps.space" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "ERROR: Deployment failed during file transfer" -ForegroundColor Red
        Write-Host "Check SSH key authentication: ssh $vpsHost" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
}
