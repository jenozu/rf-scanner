"""
Utility functions for Purolator batch shipping
Handles parsing and formatting of addresses, phone numbers, and other data
"""

import re
from typing import Dict, Optional, Tuple


def parse_phone_number(phone_str: str) -> Dict[str, str]:
    """
    Parse a phone number string into country code, area code, and phone number.
    Handles various formats: "416-123-4567", "(416) 123-4567", "4161234567", etc.
    
    Args:
        phone_str: Phone number string from CSV
        
    Returns:
        Dictionary with CountryCode, AreaCode, and Phone
    """
    if not phone_str:
        return {"CountryCode": "1", "AreaCode": "416", "Phone": "1234567"}
    
    # Remove all non-digit characters
    digits = re.sub(r'\D', '', phone_str)
    
    # If it's 10 digits, assume North American format
    if len(digits) == 10:
        area_code = digits[0:3]
        phone = digits[3:]
        return {"CountryCode": "1", "AreaCode": area_code, "Phone": phone}
    
    # If it's 11 digits and starts with 1, remove the leading 1
    elif len(digits) == 11 and digits[0] == '1':
        area_code = digits[1:4]
        phone = digits[4:]
        return {"CountryCode": "1", "AreaCode": area_code, "Phone": phone}
    
    # If it's 7 digits, assume it's just the phone part (use default area code)
    elif len(digits) == 7:
        return {"CountryCode": "1", "AreaCode": "416", "Phone": digits}
    
    # Default fallback
    return {"CountryCode": "1", "AreaCode": "416", "Phone": "1234567"}


def parse_street_address(street_str: str) -> Tuple[str, str]:
    """
    Parse a street address into StreetNumber and StreetName.
    Handles formats like: "123 Main St", "123-125 Main St", "123A Main St"
    
    Args:
        street_str: Street address string from CSV
        
    Returns:
        Tuple of (StreetNumber, StreetName)
    """
    if not street_str:
        return ("123", "Main St")
    
    street_str = street_str.strip()
    
    # Try to match number at the start
    match = re.match(r'^(\d+[A-Za-z]?)(?:\s*[-–]\s*\d+[A-Za-z]?)?\s+(.+)$', street_str)
    if match:
        street_number = match.group(1)
        street_name = match.group(2).strip()
        return (street_number, street_name)
    
    # If no number found, assume it's all street name
    # Extract any leading numbers as street number
    match = re.match(r'^(\d+)\s*(.+)$', street_str)
    if match:
        return (match.group(1), match.group(2).strip())
    
    # Fallback: assume first word is number, rest is street name
    parts = street_str.split(None, 1)
    if len(parts) == 2:
        return (parts[0], parts[1])
    
    # Last resort: use as street name with default number
    return ("123", street_str)


def validate_postal_code(postal_code: str, country: str = "CA") -> bool:
    """
    Validate postal code format.
    
    Args:
        postal_code: Postal code to validate
        country: Country code (CA, US, etc.)
        
    Returns:
        True if format looks valid
    """
    if not postal_code:
        return False
    
    postal_code = postal_code.replace(" ", "").upper()
    
    if country == "CA":
        # Canadian postal code: A1A1A1
        return bool(re.match(r'^[A-Z]\d[A-Z]\d[A-Z]\d$', postal_code))
    elif country == "US":
        # US ZIP code: 12345 or 12345-6789
        return bool(re.match(r'^\d{5}(-\d{4})?$', postal_code))
    
    return True  # For other countries, just check it's not empty


def format_postal_code(postal_code: str) -> str:
    """
    Format postal code by removing spaces and converting to uppercase.
    
    Args:
        postal_code: Postal code to format
        
    Returns:
        Formatted postal code
    """
    if not postal_code:
        return ""
    
    # Remove spaces and convert to uppercase
    formatted = postal_code.replace(" ", "").upper()
    
    # For Canadian postal codes, add space: A1A1A1 -> A1A 1A1
    if len(formatted) == 6 and re.match(r'^[A-Z]\d[A-Z]\d[A-Z]\d$', formatted):
        return f"{formatted[0:3]} {formatted[3:6]}"
    
    return formatted


def extract_error_message(response_text: str) -> str:
    """
    Extract error message from Purolator SOAP response.
    
    Args:
        response_text: XML response from API
        
    Returns:
        Error message string
    """
    try:
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response_text)
        
        # Look for common error elements
        namespaces = {
            'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
            'v2': 'http://purolator.com/pws/datatypes/v2'
        }
        
        # Check for SOAP fault
        fault = root.find('.//soap:Fault', namespaces)
        if fault is not None:
            fault_string = fault.find('soap:faultstring', namespaces)
            if fault_string is not None:
                return fault_string.text or "Unknown error"
        
        # Check for error messages in response
        error = root.find('.//v2:Error', namespaces)
        if error is not None:
            description = error.find('v2:Description', namespaces)
            if description is not None:
                return description.text or "Unknown error"
        
        # Check for response errors
        errors = root.findall('.//v2:Error', namespaces)
        if errors:
            error_messages = []
            for err in errors:
                code = err.find('v2:Code', namespaces)
                desc = err.find('v2:Description', namespaces)
                if code is not None and desc is not None:
                    error_messages.append(f"{code.text}: {desc.text}")
            return "; ".join(error_messages)
        
    except Exception as e:
        return f"Error parsing response: {str(e)}"
    
    return "Unknown error occurred"


def validate_shipment_data(data: Dict) -> Tuple[bool, Optional[str]]:
    """
    Validate shipment data from CSV before processing.
    
    Args:
        data: Dictionary of shipment data from CSV
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    required_fields = [
        'receiver_name', 'receiver_street', 'receiver_city', 
        'receiver_province', 'receiver_postal', 'receiver_country'
    ]
    
    for field in required_fields:
        if not data.get(field):
            return (False, f"Missing required field: {field}")
    
    # Validate postal code
    postal_code = data.get('receiver_postal', '')
    country = data.get('receiver_country', 'CA')
    if not validate_postal_code(postal_code, country):
        return (False, f"Invalid postal code format: {postal_code}")
    
    # Validate weight
    try:
        weight = float(data.get('weight', 0))
        if weight <= 0:
            return (False, "Weight must be greater than 0")
        if weight > 75:
            return (False, "Weight exceeds maximum (75 kg)")
    except ValueError:
        return (False, f"Invalid weight value: {data.get('weight')}")
    
    # Validate dimensions
    for dim in ['length', 'width', 'height']:
        try:
            value = float(data.get(dim, 0))
            if value <= 0:
                return (False, f"{dim.capitalize()} must be greater than 0")
        except ValueError:
            return (False, f"Invalid {dim} value: {data.get(dim)}")
    
    return (True, None)

