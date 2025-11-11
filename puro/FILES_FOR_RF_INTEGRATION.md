# Files Required for RF Scanner Integration

## Core Files to Copy

### 1. **purolator_utils.py** ⭐ REQUIRED
**Purpose**: Parses phone numbers, addresses, validates data

**Functions you'll use:**
- `parse_phone_number(phone)` - Handles any phone format
- `parse_street_address(address)` - Splits street number/name
- `validate_shipment_data(data)` - Validates before sending
- `extract_error_message(response)` - Gets error from API

**Size**: ~8 KB
**Dependencies**: None (pure Python)

---

### 2. **batch_shipping_app.py** ⭐ REQUIRED
**Purpose**: Main shipment creation engine

**Key class: `BatchShippingApp`**

**Methods you'll use:**
```python
app = BatchShippingApp.__new__(BatchShippingApp)
app.username = "your_username"
app.password = "your_password"
app.account = "7254525"
app.shipment_url = "https://webservices.purolator.com/..."

# Create shipment
result = app.create_shipment_from_data(data)
# Returns: {'status': 'Success', 'shipment_pin': '520138418055', ...}
```

**Size**: ~25 KB
**Dependencies**: requests, python-dotenv

---

### 3. **.env** ⭐ REQUIRED
**Purpose**: Store production credentials securely

**Contents:**
```env
PUROLATOR_API_USERNAME=714d0583f90941ada8d2175bdc4452bb
PUROLATOR_API_PASSWORD=6qDJZ0Ph
PUROLATOR_API_ACCOUNT=7254525
```

**Size**: < 1 KB
**Security**: ⚠️ Never commit to git! Add to .gitignore

---

### 4. **requirements.txt** ⭐ REQUIRED
**Purpose**: Python dependencies

**Contents:**
```
requests>=2.31.0
python-dotenv>=1.0.0
```

**Install**: `pip install -r requirements.txt`

---

## Optional Files (for testing/reference)

### 5. **test_production_auto.py** (optional)
**Purpose**: Test production API works

**Usage:**
```bash
python test_production_auto.py
```

**When to use**: Before integrating, to verify credentials work

---

### 6. **INTEGRATION_GUIDE.md** (optional)
**Purpose**: Complete technical documentation

**Contains:**
- API reference
- Integration patterns
- Code examples
- Error handling

---

## Minimal Setup (3 files only)

For the absolute minimum integration, you only need:

1. **purolator_utils.py** - Copy as-is
2. **Simplified API wrapper** - See below
3. **.env** - Your credentials

### Simplified API Wrapper (alternative to batch_shipping_app.py)

If you don't want the full GUI app, here's a minimal version:

**File: `purolator_api.py`** (create this)

```python
"""
Minimal Purolator API wrapper for RF scanner integration
"""

import os
import requests
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
from purolator_utils import (
    parse_phone_number, parse_street_address,
    format_postal_code, validate_shipment_data,
    extract_error_message
)

load_dotenv()

class PurolatorAPI:
    def __init__(self):
        self.username = os.getenv("PUROLATOR_API_USERNAME")
        self.password = os.getenv("PUROLATOR_API_PASSWORD")
        self.account = os.getenv("PUROLATOR_API_ACCOUNT")
        self.url = "https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx"
        
    def create_shipment(self, data):
        """
        Create a shipment
        
        Args:
            data: Dict with shipment info (see INTEGRATION_GUIDE.md for format)
            
        Returns:
            Dict with status, shipment_pin, message
        """
        # Validate
        is_valid, error = validate_shipment_data(data)
        if not is_valid:
            return {'status': 'Error', 'message': error, 'shipment_pin': None}
        
        # Parse data
        sender_phone = parse_phone_number(data.get('sender_phone', ''))
        receiver_phone = parse_phone_number(data.get('receiver_phone', ''))
        sender_num, sender_street = parse_street_address(data.get('sender_street', ''))
        receiver_num, receiver_street = parse_street_address(data.get('receiver_street', ''))
        sender_postal = format_postal_code(data.get('sender_postal', ''))
        receiver_postal = format_postal_code(data.get('receiver_postal', ''))
        
        # Build SOAP
        soap_body = f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v2="http://purolator.com/pws/datatypes/v2">
  <soapenv:Header>
    <v2:RequestContext>
      <v2:Version>2.0</v2:Version>
      <v2:Language>en</v2:Language>
      <v2:GroupID>111</v2:GroupID>
      <v2:RequestReference>{data.get('reference', 'REF')}</v2:RequestReference>
    </v2:RequestContext>
  </soapenv:Header>
  <soapenv:Body>
    <v2:CreateShipmentRequest>
      <v2:Shipment>
        <v2:SenderInformation>
          <v2:Address>
            <v2:Name>{data.get('sender_name', '')}</v2:Name>
            <v2:StreetNumber>{sender_num}</v2:StreetNumber>
            <v2:StreetName>{sender_street}</v2:StreetName>
            <v2:City>{data.get('sender_city', '')}</v2:City>
            <v2:Province>{data.get('sender_province', '')}</v2:Province>
            <v2:Country>CA</v2:Country>
            <v2:PostalCode>{sender_postal}</v2:PostalCode>
            <v2:PhoneNumber>
              <v2:CountryCode>{sender_phone['CountryCode']}</v2:CountryCode>
              <v2:AreaCode>{sender_phone['AreaCode']}</v2:AreaCode>
              <v2:Phone>{sender_phone['Phone']}</v2:Phone>
            </v2:PhoneNumber>
          </v2:Address>
        </v2:SenderInformation>
        <v2:ReceiverInformation>
          <v2:Address>
            <v2:Name>{data.get('receiver_name', '')}</v2:Name>
            <v2:StreetNumber>{receiver_num}</v2:StreetNumber>
            <v2:StreetName>{receiver_street}</v2:StreetName>
            <v2:City>{data.get('receiver_city', '')}</v2:City>
            <v2:Province>{data.get('receiver_province', '')}</v2:Province>
            <v2:Country>{data.get('receiver_country', 'CA')}</v2:Country>
            <v2:PostalCode>{receiver_postal}</v2:PostalCode>
            <v2:PhoneNumber>
              <v2:CountryCode>{receiver_phone['CountryCode']}</v2:CountryCode>
              <v2:AreaCode>{receiver_phone['AreaCode']}</v2:AreaCode>
              <v2:Phone>{receiver_phone['Phone']}</v2:Phone>
            </v2:PhoneNumber>
          </v2:Address>
        </v2:ReceiverInformation>
        <v2:PackageInformation>
          <v2:ServiceID>{data.get('service_id', 'PurolatorExpress')}</v2:ServiceID>
          <v2:TotalWeight>
            <v2:Value>{data.get('weight', '2.5')}</v2:Value>
            <v2:WeightUnit>kg</v2:WeightUnit>
          </v2:TotalWeight>
          <v2:Dimensions>
            <v2:Length>{data.get('length', '30')}</v2:Length>
            <v2:Width>{data.get('width', '20')}</v2:Width>
            <v2:Height>{data.get('height', '10')}</v2:Height>
            <v2:DimensionUnit>cm</v2:DimensionUnit>
          </v2:Dimensions>
          <v2:TotalPieces>1</v2:TotalPieces>
        </v2:PackageInformation>
        <v2:PaymentInformation>
          <v2:PaymentType>{data.get('payment_type', 'Sender')}</v2:PaymentType>
          <v2:RegisteredAccountNumber>{self.account}</v2:RegisteredAccountNumber>
        </v2:PaymentInformation>
        <v2:PickupInformation>
          <v2:PickupType>DropOff</v2:PickupType>
        </v2:PickupInformation>
      </v2:Shipment>
      <v2:PrinterType>Regular</v2:PrinterType>
    </v2:CreateShipmentRequest>
  </soapenv:Body>
</soapenv:Envelope>"""
        
        # Send request
        headers = {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "http://purolator.com/pws/service/v2/CreateShipment"
        }
        
        try:
            response = requests.post(
                self.url,
                data=soap_body,
                headers=headers,
                auth=(self.username, self.password),
                timeout=30
            )
            
            # Extract PIN
            if response.status_code == 200:
                pin = self._extract_pin(response.text)
                if pin:
                    return {
                        'status': 'Success',
                        'shipment_pin': pin,
                        'message': 'Shipment created successfully'
                    }
                else:
                    error = extract_error_message(response.text)
                    return {
                        'status': 'Error',
                        'shipment_pin': None,
                        'message': error
                    }
            else:
                return {
                    'status': 'Error',
                    'shipment_pin': None,
                    'message': f'HTTP {response.status_code}'
                }
                
        except Exception as e:
            return {
                'status': 'Error',
                'shipment_pin': None,
                'message': str(e)
            }
    
    def _extract_pin(self, response_text):
        """Extract shipment PIN from response"""
        try:
            root = ET.fromstring(response_text)
            pin_elem = root.find('.//{http://purolator.com/pws/datatypes/v2}ShipmentPIN')
            if pin_elem is not None:
                value_elem = pin_elem.find('{http://purolator.com/pws/datatypes/v2}Value')
                if value_elem is not None and value_elem.text:
                    return value_elem.text
        except:
            pass
        return None


# Usage example
if __name__ == "__main__":
    api = PurolatorAPI()
    
    result = api.create_shipment({
        'sender_name': 'Your Warehouse',
        'sender_street': '123 Bay Street',
        'sender_city': 'Toronto',
        'sender_province': 'ON',
        'sender_postal': 'M5J2R8',
        'sender_phone': '416-555-1234',
        'receiver_name': 'Customer',
        'receiver_street': '456 Saint-Catherine Street',
        'receiver_city': 'Montreal',
        'receiver_province': 'QC',
        'receiver_postal': 'H3B1A1',
        'receiver_country': 'CA',
        'receiver_phone': '514-555-5678',
        'service_id': 'PurolatorExpress',
        'weight': '2.5',
        'length': '30',
        'width': '20',
        'height': '10',
        'payment_type': 'Sender',
        'reference': 'TEST-001'
    })
    
    print(result)
```

---

## File Structure for Integration

### Option A: Full Integration (recommended)

```
your_rf_project/
├── .env                          # Your credentials
├── .gitignore                    # Add .env to this!
├── purolator_utils.py            # Copy from puro/04_Automation_Scripts/
├── batch_shipping_app.py         # Copy from puro/04_Automation_Scripts/
├── requirements.txt              # Copy from puro/04_Automation_Scripts/
├── your_rf_scanner_code.py       # Your existing code
└── rf_purolator_integration.py   # Your integration layer
```

### Option B: Minimal Integration

```
your_rf_project/
├── .env                          # Your credentials
├── .gitignore                    # Add .env to this!
├── purolator_utils.py            # Copy from puro/04_Automation_Scripts/
├── purolator_api.py              # Create minimal wrapper (see above)
├── requirements.txt              # Just requests and python-dotenv
├── your_rf_scanner_code.py       # Your existing code
└── rf_integration.py             # Your integration
```

---

## Quick Start (5 minutes)

1. **Copy 3 files:**
   ```bash
   cp puro/04_Automation_Scripts/purolator_utils.py your_project/
   cp puro/04_Automation_Scripts/batch_shipping_app.py your_project/
   cp puro/04_Automation_Scripts/requirements.txt your_project/
   ```

2. **Create .env:**
   ```bash
   echo "PUROLATOR_API_USERNAME=714d0583f90941ada8d2175bdc4452bb" > your_project/.env
   echo "PUROLATOR_API_PASSWORD=6qDJZ0Ph" >> your_project/.env
   echo "PUROLATOR_API_ACCOUNT=7254525" >> your_project/.env
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Test:**
   ```python
   from batch_shipping_app import BatchShippingApp
   import os
   
   app = BatchShippingApp.__new__(BatchShippingApp)
   app.username = os.getenv("PUROLATOR_API_USERNAME")
   app.password = os.getenv("PUROLATOR_API_PASSWORD")
   app.account = os.getenv("PUROLATOR_API_ACCOUNT")
   app.shipment_url = "https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx"
   
   result = app.create_shipment_from_data({...})
   print(result)
   ```

Done! You're ready to integrate.

---

## What Each File Does

| File | Purpose | Size | Required |
|------|---------|------|----------|
| `purolator_utils.py` | Parse phone/address, validate | 8 KB | ✅ Yes |
| `batch_shipping_app.py` | Create shipments | 25 KB | ✅ Yes |
| `.env` | Store credentials | <1 KB | ✅ Yes |
| `requirements.txt` | Dependencies | <1 KB | ✅ Yes |
| `INTEGRATION_GUIDE.md` | Documentation | 50 KB | ℹ️ Reference |
| `test_production_auto.py` | Test script | 5 KB | ℹ️ Testing |

---

## Security Checklist

- [ ] Create `.gitignore` with `.env` in it
- [ ] Never commit `.env` to version control
- [ ] Use environment variables, not hardcoded credentials
- [ ] Restrict file permissions on `.env` (chmod 600)
- [ ] Don't log sensitive data (phone numbers, addresses)
- [ ] Use HTTPS only (already configured)

---

## Next Steps

1. ✅ Copy the 3-4 required files
2. ✅ Create `.env` with your credentials
3. ✅ Test with one shipment
4. ✅ Implement RF scanner integration
5. ✅ Test with real data
6. ✅ Deploy

See `INTEGRATION_GUIDE.md` for complete technical details and code examples.

