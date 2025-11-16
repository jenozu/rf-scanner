"""
Test Production API - Creates ONE real label (auto-run)
(No charge until label is scanned/shipped)
"""

import os
from dotenv import load_dotenv
from batch_shipping_app import BatchShippingApp
import tkinter as tk

# Load environment variables
load_dotenv()

def test_production():
    """Test production API with one shipment"""
    print("=" * 60)
    print("PRODUCTION API TEST")
    print("=" * 60)
    print()
    
    # Check credentials
    username = os.getenv("PUROLATOR_API_USERNAME")
    password = os.getenv("PUROLATOR_API_PASSWORD")
    account = os.getenv("PUROLATOR_API_ACCOUNT")
    
    print("Checking credentials...")
    if not all([username, password, account]):
        print("ERROR: Missing credentials in .env file")
        return False
    
    print(f"PASS: Credentials loaded")
    print(f"   Username: {username[:12]}...")
    print(f"   Account: {account}")
    print()
    
    # Verify it's production credentials
    if account == "9999999999":
        print("ERROR: Still using SANDBOX credentials!")
        return False
    
    print("PASS: Production credentials detected")
    print()
    
    # Test shipment data - using REAL valid postal codes
    test_data = {
        'sender_name': 'Test Sender Company',
        'sender_street': '123 Bay Street',
        'sender_city': 'Toronto',
        'sender_province': 'ON',
        'sender_postal': 'M5J2R8',  # Real Toronto postal code
        'sender_phone': '416-555-1234',
        'receiver_name': 'Test Receiver',
        'receiver_street': '456 Saint-Catherine Street',
        'receiver_city': 'Montreal',
        'receiver_province': 'QC',
        'receiver_postal': 'H3B1A1',  # Real Montreal postal code
        'receiver_country': 'CA',
        'receiver_phone': '514-555-5678',
        'service_id': 'PurolatorExpress',
        'weight': '2.5',
        'length': '30',
        'width': '20',
        'height': '10',
        'payment_type': 'Sender',
        'reference': 'PROD-TEST-001'
    }
    
    print("Creating test shipment with production API...")
    print(f"   From: {test_data['sender_city']}, {test_data['sender_province']}")
    print(f"   To:   {test_data['receiver_city']}, {test_data['receiver_province']}")
    print(f"   Reference: {test_data['reference']}")
    print()
    
    # Initialize app (without GUI)
    root = tk.Tk()
    root.withdraw()
    
    try:
        app = BatchShippingApp.__new__(BatchShippingApp)
        app.username = username
        app.password = password
        app.account = account
        app.shipment_url = "https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx"
        app.documents_url = "https://webservices.purolator.com/EWS/V1/ShippingDocuments/ShippingDocumentsService.asmx"
        app.root = root
        app.auto_print_var = type('obj', (object,), {'get': lambda self: True})()
        
        print("Sending request to production API...")
        result = app.create_shipment_from_data(test_data)
        
        print()
        print("=" * 60)
        print("RESULT")
        print("=" * 60)
        print(f"Status: {result['status']}")
        print(f"HTTP Status: {result['http_status']}")
        
        if result['status'] == 'Success':
            print()
            print("SUCCESS! PRODUCTION LABEL CREATED!")
            print(f"   Shipment PIN: {result['shipment_pin']}")
            print()
            print("=" * 60)
            print("NEXT STEPS")
            print("=" * 60)
            print("1. Check the labels/ folder for your PDF label:")
            print(f"   File: label_{test_data['reference']}_{result['shipment_pin']}.pdf")
            print()
            print("2. Open and review the label:")
            print("   - Verify addresses look correct")
            print("   - Check barcode is present")
            print("   - Verify service type")
            print("   - Check your account number is shown")
            print()
            print("3. IMPORTANT: Do NOT ship this test label!")
            print("   (No charge until Purolator scans it)")
            print()
            print("4. If label looks good:")
            print("   - Your production API is working!")
            print("   - Ready to process real orders")
            print("   - Run: python batch_shipping_app.py")
            print()
            print("=" * 60)
            print()
            return True
        else:
            print()
            print(f"FAILED: {result['message']}")
            print()
            print("Troubleshooting:")
            print("1. Verify password in .env is correct")
            print("2. Check account your_account_number is active")
            print("3. Verify addresses are valid Canadian addresses")
            print()
            return False
            
    except Exception as e:
        print()
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        root.destroy()


if __name__ == "__main__":
    print()
    print("*** PRODUCTION API TEST (AUTO) ***")
    print()
    print("Creating ONE test label with production API...")
    print("No charge until label is scanned/shipped.")
    print()
    
    success = test_production()
    
    if success:
        print("TEST PASSED! Your production API is working!")
    else:
        print("TEST FAILED. Check errors above.")

