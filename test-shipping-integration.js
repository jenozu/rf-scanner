/**
 * Test script for shipping integration
 * Run with: node test-shipping-integration.js
 */

const API_BASE = 'http://localhost:3001';

async function testEndpoint(name, method, path, body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const url = `${API_BASE}${path}`;
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   ${method} ${url}`);
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Success`);
      console.log(`   Response:`, JSON.stringify(data, null, 2).substring(0, 200));
      return { success: true, data };
    } else {
      console.log(`   ❌ Failed (${response.status})`);
      console.log(`   Error:`, data.error || data.message);
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Shipping Integration Tests\n');
  console.log('=' .repeat(60));
  
  // Test 1: Health Check
  await testEndpoint('Health Check', 'GET', '/api/health');
  
  // Test 2: Search Customers
  await testEndpoint('Search Customers', 'GET', '/api/shipping/customers/search?q=Test');
  
  // Test 3: Search Locations
  await testEndpoint('Search Locations', 'GET', '/api/shipping/locations/search?q=Toronto');
  
  // Test 4: Quick Lookup
  await testEndpoint('Quick Lookup', 'GET', '/api/shipping/lookup?q=Test');
  
  // Test 5: Create Shipment (will fail if customer not found - that's OK)
  await testEndpoint(
    'Create Shipment',
    'POST',
    '/api/shipping/shipments/create',
    {
      orderId: 'test-order-123',
      customerName: 'Test Customer',
      packageData: {
        weight: '2.5',
        service_id: 'PurolatorExpress',
        reference: 'TEST-ORDER'
      }
    }
  );
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Tests completed!');
  console.log('\nNote: If shipment creation failed with "Customer not found",');
  console.log('      add a test customer to the address book first.');
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ or install node-fetch');
  console.error('   Install: npm install node-fetch');
  process.exit(1);
}

runTests().catch(console.error);

