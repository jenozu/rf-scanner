# Fast deployment script with better error handling
Write-Host "Starting fast deployment..." -ForegroundColor Cyan

. "$PSScriptRoot/deploy-config.ps1"

# Test connection
Write-Host "`nTesting connection..." -ForegroundColor Yellow
$test = ssh -o BatchMode=yes -o ConnectTimeout=5 $vpsHost "echo OK" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cannot connect to server" -ForegroundColor Red
    exit 1
}
Write-Host "Connected!" -ForegroundColor Green

# Build
Write-Host "`nBuilding..." -ForegroundColor Yellow
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "Build complete!" -ForegroundColor Green

# Deploy with compression (faster)
Write-Host "`nUploading (this may take 30-60 seconds)..." -ForegroundColor Yellow
Write-Host "Please wait, do not interrupt..." -ForegroundColor Gray

# Create tar locally, upload, extract remotely (much faster than scp -r)
tar -czf dist.tar.gz -C dist .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create archive" -ForegroundColor Red
    exit 1
}

Write-Host "Uploading compressed file..." -ForegroundColor Gray
scp -o BatchMode=yes -o Compression=yes dist.tar.gz "${vpsHost}:/tmp/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Upload failed" -ForegroundColor Red
    Remove-Item dist.tar.gz -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "Extracting on server..." -ForegroundColor Gray
ssh -o BatchMode=yes $vpsHost @"
cd $remotePath && \
find . -mindepth 1 -maxdepth 1 ! -name 'data' ! -name 'server' -exec rm -rf {} + && \
tar -xzf /tmp/dist.tar.gz -C $remotePath && \
rm /tmp/dist.tar.gz && \
sudo chown -R www-data:www-data $remotePath && \
sudo systemctl reload nginx
"@

if ($LASTEXITCODE -eq 0) {
    Remove-Item dist.tar.gz -ErrorAction SilentlyContinue
    Write-Host "`nDEPLOYED!" -ForegroundColor Green
    Write-Host "Live at: http://$SERVER_IP" -ForegroundColor Cyan
} else {
    Write-Host "ERROR: Server commands failed" -ForegroundColor Red
    Remove-Item dist.tar.gz -ErrorAction SilentlyContinue
    exit 1
}

