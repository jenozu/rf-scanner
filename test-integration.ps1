# Test Script for Shipping Integration
# Run with: .\test-integration.ps1

Write-Host "🧪 Testing Shipping Integration" -ForegroundColor Cyan
Write-Host "=" * 60

$API_BASE = "http://localhost:3001"

# Test 1: Health Check
Write-Host "`n[1/5] Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/api/health" -Method Get
    Write-Host "✅ Health check passed" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health check failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Make sure Node.js server is running (npm start in server folder)" -ForegroundColor Yellow
    exit 1
}

# Test 2: Search Customers
Write-Host "`n[2/5] Testing Customer Search..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/api/shipping/customers/search?q=Test" -Method Get
    Write-Host "✅ Customer search works" -ForegroundColor Green
    Write-Host "   Found $($response.Count) customers" -ForegroundColor Gray
} catch {
    Write-Host "❌ Customer search failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Search Locations
Write-Host "`n[3/5] Testing Location Search..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/api/shipping/locations/search?q=Toronto" -Method Get
    Write-Host "✅ Location search works" -ForegroundColor Green
    Write-Host "   Found $($response.Count) locations" -ForegroundColor Gray
} catch {
    Write-Host "❌ Location search failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Quick Lookup
Write-Host "`n[4/5] Testing Quick Lookup..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/api/shipping/lookup?q=Test" -Method Get
    if ($response.status -eq "Success") {
        Write-Host "✅ Quick lookup works" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Quick lookup returned: $($response.status)" -ForegroundColor Yellow
        Write-Host "   Message: $($response.message)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Quick lookup failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Create Shipment (Test - will fail if customer not found)
Write-Host "`n[5/5] Testing Shipment Creation..." -ForegroundColor Yellow
$testBody = @{
    orderId = "test-order-123"
    customerName = "Test Customer"
    packageData = @{
        weight = "2.5"
        service_id = "PurolatorExpress"
        reference = "TEST-ORDER"
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_BASE/api/shipping/shipments/create" -Method Post -Body $testBody -ContentType "application/json"
    if ($response.success) {
        Write-Host "✅ Shipment creation works!" -ForegroundColor Green
        Write-Host "   Tracking PIN: $($response.shipmentPin)" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  Shipment creation returned error" -ForegroundColor Yellow
        Write-Host "   Error: $($response.error)" -ForegroundColor Gray
        Write-Host "   (This is OK if customer 'Test Customer' doesn't exist)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Shipment creation failed" -ForegroundColor Red
    $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorDetails) {
        Write-Host "   Error: $($errorDetails.error)" -ForegroundColor Red
    } else {
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host "   (This is OK if customer 'Test Customer' doesn't exist)" -ForegroundColor Gray
}

Write-Host "`n" + ("=" * 60)
Write-Host "✅ Tests completed!" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. If customer search found 0 results, add a customer to address book" -ForegroundColor White
Write-Host "2. If shipment creation failed with 'customer not found', add that customer first" -ForegroundColor White
Write-Host "3. Test in React app by navigating to Shipping page" -ForegroundColor White
Write-Host "`nSee NEXT_STEPS.md for detailed setup instructions" -ForegroundColor Gray

