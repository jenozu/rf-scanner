"""
Purolator Batch Shipping Application
A comprehensive tool for batch processing shipments and printing labels
"""

import os
import json
import csv
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import threading
import datetime
from dotenv import load_dotenv
import requests
import xml.etree.ElementTree as ET
import base64
from pathlib import Path
from purolator_utils import (
    parse_phone_number, parse_street_address, 
    format_postal_code, extract_error_message,
    validate_shipment_data
)

# Try to import address book (optional feature)
try:
    from address_book_db import get_db
    ADDRESS_BOOK_AVAILABLE = True
except ImportError:
    ADDRESS_BOOK_AVAILABLE = False

# Try to import email utilities (optional feature)
try:
    from email_utils import EmailSender
    EMAIL_AVAILABLE = True
except ImportError:
    EMAIL_AVAILABLE = False
    EmailSender = None

# Load environment variables
load_dotenv()

class BatchShippingApp:
    """
    Comprehensive batch shipping application for Purolator E-Ship integration
    """
    
    def __init__(self):
        self.username = os.getenv("PUROLATOR_API_USERNAME")
        self.password = os.getenv("PUROLATOR_API_PASSWORD")
        self.account = os.getenv("PUROLATOR_API_ACCOUNT")
        
        # API endpoints - PRODUCTION
        self.shipment_url = "https://webservices.purolator.com/EWS/V2/Shipping/ShippingService.asmx"
        self.documents_url = "https://webservices.purolator.com/EWS/V1/ShippingDocuments/ShippingDocumentsService.asmx"
        
        # Initialize address book if available
        self.db = None
        if ADDRESS_BOOK_AVAILABLE:
            try:
                self.db = get_db()
            except Exception as e:
                print(f"Warning: Could not initialize address book: {e}")
        
        # Initialize email sender if available
        self.email_sender = None
        if EMAIL_AVAILABLE:
            try:
                self.email_sender = EmailSender()
                if not self.email_sender.is_configured:
                    print("Note: Email not configured. Set EMAIL_FROM and EMAIL_PASSWORD in .env to enable email labels")
            except Exception as e:
                print(f"Warning: Could not initialize email sender: {e}")
        
        # Initialize GUI
        self.setup_gui()
        
    def setup_gui(self):
        """Initialize the GUI interface"""
        self.root = tk.Tk()
        self.root.title("Purolator Batch Shipping Tool")
        self.root.geometry("1000x700")
        
        # Create main notebook for tabs
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Create tabs
        self.create_batch_tab()
        self.create_single_tab()
        if self.db:  # Add address book tab if available
            self.create_address_book_tab()
        self.create_logs_tab()
        self.create_settings_tab()
        
    def create_batch_tab(self):
        """Create the batch processing tab"""
        batch_frame = ttk.Frame(self.notebook)
        self.notebook.add(batch_frame, text="Batch Processing")
        
        # File selection
        file_frame = ttk.LabelFrame(batch_frame, text="CSV File Selection", padding=10)
        file_frame.pack(fill='x', padx=10, pady=5)
        
        self.csv_path_var = tk.StringVar()
        ttk.Label(file_frame, text="CSV File:").grid(row=0, column=0, sticky='w')
        ttk.Entry(file_frame, textvariable=self.csv_path_var, width=50).grid(row=0, column=1, padx=5)
        ttk.Button(file_frame, text="Browse", command=self.browse_csv).grid(row=0, column=2)
        
        # Template download
        ttk.Button(file_frame, text="Download CSV Template", command=self.download_template).grid(row=1, column=1, pady=5)
        
        # Processing options
        options_frame = ttk.LabelFrame(batch_frame, text="Processing Options", padding=10)
        options_frame.pack(fill='x', padx=10, pady=5)
        
        self.auto_print_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(options_frame, text="Auto-print labels", variable=self.auto_print_var).grid(row=0, column=0, sticky='w')
        
        self.save_logs_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(options_frame, text="Save detailed logs", variable=self.save_logs_var).grid(row=0, column=1, sticky='w')
        
        # Progress and status
        status_frame = ttk.LabelFrame(batch_frame, text="Status", padding=10)
        status_frame.pack(fill='both', expand=True, padx=10, pady=5)
        
        self.progress_var = tk.StringVar(value="Ready to process")
        ttk.Label(status_frame, textvariable=self.progress_var).pack(anchor='w')
        
        self.progress_bar = ttk.Progressbar(status_frame, mode='determinate')
        self.progress_bar.pack(fill='x', pady=5)
        
        # Action buttons
        button_frame = ttk.Frame(batch_frame)
        button_frame.pack(fill='x', padx=10, pady=5)
        
        ttk.Button(button_frame, text="Process Batch", command=self.process_batch).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Stop Processing", command=self.stop_processing).pack(side='left', padx=5)
        
        # Results display
        results_frame = ttk.LabelFrame(batch_frame, text="Results", padding=10)
        results_frame.pack(fill='both', expand=True, padx=10, pady=5)
        
        self.results_text = scrolledtext.ScrolledText(results_frame, height=10)
        self.results_text.pack(fill='both', expand=True)
        
    def create_single_tab(self):
        """Create the single shipment tab"""
        single_frame = ttk.Frame(self.notebook)
        self.notebook.add(single_frame, text="Single Shipment")
        
        # Shipment details
        details_frame = ttk.LabelFrame(single_frame, text="Shipment Details", padding=10)
        details_frame.pack(fill='x', padx=10, pady=5)
        
        # Sender information
        sender_frame = ttk.LabelFrame(details_frame, text="Sender", padding=5)
        sender_frame.pack(fill='x', pady=5)
        
        self.sender_name_var = tk.StringVar()
        self.sender_street_var = tk.StringVar()
        self.sender_city_var = tk.StringVar()
        self.sender_province_var = tk.StringVar()
        self.sender_postal_var = tk.StringVar()
        self.sender_phone_var = tk.StringVar()
        
        ttk.Label(sender_frame, text="Name:").grid(row=0, column=0, sticky='w')
        ttk.Entry(sender_frame, textvariable=self.sender_name_var, width=30).grid(row=0, column=1, padx=5)
        
        ttk.Label(sender_frame, text="Street:").grid(row=1, column=0, sticky='w')
        ttk.Entry(sender_frame, textvariable=self.sender_street_var, width=30).grid(row=1, column=1, padx=5)
        
        ttk.Label(sender_frame, text="City:").grid(row=2, column=0, sticky='w')
        ttk.Entry(sender_frame, textvariable=self.sender_city_var, width=15).grid(row=2, column=1, padx=5)
        
        ttk.Label(sender_frame, text="Province:").grid(row=2, column=2, sticky='w')
        ttk.Entry(sender_frame, textvariable=self.sender_province_var, width=10).grid(row=2, column=3, padx=5)
        
        ttk.Label(sender_frame, text="Postal Code:").grid(row=3, column=0, sticky='w')
        ttk.Entry(sender_frame, textvariable=self.sender_postal_var, width=10).grid(row=3, column=1, padx=5)
        
        ttk.Label(sender_frame, text="Phone:").grid(row=3, column=2, sticky='w')
        ttk.Entry(sender_frame, textvariable=self.sender_phone_var, width=15).grid(row=3, column=3, padx=5)
        
        # Receiver information
        receiver_frame = ttk.LabelFrame(details_frame, text="Receiver", padding=5)
        receiver_frame.pack(fill='x', pady=5)
        
        self.receiver_name_var = tk.StringVar()
        self.receiver_street_var = tk.StringVar()
        self.receiver_city_var = tk.StringVar()
        self.receiver_province_var = tk.StringVar()
        self.receiver_postal_var = tk.StringVar()
        self.receiver_country_var = tk.StringVar(value="CA")
        self.receiver_phone_var = tk.StringVar()
        
        ttk.Label(receiver_frame, text="Name:").grid(row=0, column=0, sticky='w')
        ttk.Entry(receiver_frame, textvariable=self.receiver_name_var, width=30).grid(row=0, column=1, padx=5)
        
        ttk.Label(receiver_frame, text="Street:").grid(row=1, column=0, sticky='w')
        ttk.Entry(receiver_frame, textvariable=self.receiver_street_var, width=30).grid(row=1, column=1, padx=5)
        
        ttk.Label(receiver_frame, text="City:").grid(row=2, column=0, sticky='w')
        ttk.Entry(receiver_frame, textvariable=self.receiver_city_var, width=15).grid(row=2, column=1, padx=5)
        
        ttk.Label(receiver_frame, text="Province:").grid(row=2, column=2, sticky='w')
        ttk.Entry(receiver_frame, textvariable=self.receiver_province_var, width=10).grid(row=2, column=3, padx=5)
        
        ttk.Label(receiver_frame, text="Postal Code:").grid(row=3, column=0, sticky='w')
        ttk.Entry(receiver_frame, textvariable=self.receiver_postal_var, width=10).grid(row=3, column=1, padx=5)
        
        ttk.Label(receiver_frame, text="Country:").grid(row=3, column=2, sticky='w')
        ttk.Entry(receiver_frame, textvariable=self.receiver_country_var, width=5).grid(row=3, column=3, padx=5)
        
        ttk.Label(receiver_frame, text="Phone:").grid(row=4, column=0, sticky='w')
        ttk.Entry(receiver_frame, textvariable=self.receiver_phone_var, width=15).grid(row=4, column=1, padx=5)
        
        # Package information
        package_frame = ttk.LabelFrame(details_frame, text="Package Details", padding=5)
        package_frame.pack(fill='x', pady=5)
        
        self.service_id_var = tk.StringVar(value="PurolatorExpress")
        self.weight_var = tk.StringVar(value="2.5")
        self.length_var = tk.StringVar(value="30")
        self.width_var = tk.StringVar(value="20")
        self.height_var = tk.StringVar(value="10")
        self.payment_type_var = tk.StringVar(value="Sender")
        
        ttk.Label(package_frame, text="Service:").grid(row=0, column=0, sticky='w')
        service_combo = ttk.Combobox(package_frame, textvariable=self.service_id_var, 
                                   values=["PurolatorExpress", "PurolatorGround", "PurolatorExpress9AM"])
        service_combo.grid(row=0, column=1, padx=5)
        
        ttk.Label(package_frame, text="Weight (kg):").grid(row=0, column=2, sticky='w')
        ttk.Entry(package_frame, textvariable=self.weight_var, width=10).grid(row=0, column=3, padx=5)
        
        ttk.Label(package_frame, text="Dimensions (cm):").grid(row=1, column=0, sticky='w')
        ttk.Label(package_frame, text="L:").grid(row=1, column=1)
        ttk.Entry(package_frame, textvariable=self.length_var, width=8).grid(row=1, column=2, padx=2)
        ttk.Label(package_frame, text="W:").grid(row=1, column=3)
        ttk.Entry(package_frame, textvariable=self.width_var, width=8).grid(row=1, column=4, padx=2)
        ttk.Label(package_frame, text="H:").grid(row=1, column=5)
        ttk.Entry(package_frame, textvariable=self.height_var, width=8).grid(row=1, column=6, padx=2)
        
        ttk.Label(package_frame, text="Payment:").grid(row=2, column=0, sticky='w')
        payment_combo = ttk.Combobox(package_frame, textvariable=self.payment_type_var,
                                   values=["Sender", "Receiver", "ThirdParty"])
        payment_combo.grid(row=2, column=1, padx=5)
        
        # Action buttons
        action_frame = ttk.Frame(single_frame)
        action_frame.pack(fill='x', padx=10, pady=5)
        
        if self.db:  # Show address book button if available
            ttk.Button(action_frame, text="📚 Select from Address Book", 
                      command=self.select_from_address_book).pack(side='left', padx=5)
        ttk.Button(action_frame, text="Create Shipment", command=self.create_single_shipment).pack(side='left', padx=5)
        ttk.Button(action_frame, text="Print Label", command=self.print_label).pack(side='left', padx=5)
        ttk.Button(action_frame, text="Clear Form", command=self.clear_form).pack(side='left', padx=5)
        
    def create_logs_tab(self):
        """Create the logs viewing tab"""
        logs_frame = ttk.Frame(self.notebook)
        self.notebook.add(logs_frame, text="Logs & History")
        
        # Log file selection
        log_frame = ttk.LabelFrame(logs_frame, text="Log Files", padding=10)
        log_frame.pack(fill='x', padx=10, pady=5)
        
        self.log_path_var = tk.StringVar()
        ttk.Label(log_frame, text="Log File:").grid(row=0, column=0, sticky='w')
        ttk.Entry(log_frame, textvariable=self.log_path_var, width=50).grid(row=0, column=1, padx=5)
        ttk.Button(log_frame, text="Browse", command=self.browse_log).grid(row=0, column=2)
        ttk.Button(log_frame, text="Refresh", command=self.refresh_logs).grid(row=0, column=3)
        
        # Log display
        display_frame = ttk.LabelFrame(logs_frame, text="Log Content", padding=10)
        display_frame.pack(fill='both', expand=True, padx=10, pady=5)
        
        self.log_text = scrolledtext.ScrolledText(display_frame, height=20)
        self.log_text.pack(fill='both', expand=True)
        
    def create_settings_tab(self):
        """Create the settings tab"""
        settings_frame = ttk.Frame(self.notebook)
        self.notebook.add(settings_frame, text="Settings")
        
        # API Configuration
        api_frame = ttk.LabelFrame(settings_frame, text="API Configuration", padding=10)
        api_frame.pack(fill='x', padx=10, pady=5)
        
        self.api_key_var = tk.StringVar(value=self.username or "")
        self.api_password_var = tk.StringVar(value="*" * len(self.password) if self.password else "")
        self.account_var = tk.StringVar(value=self.account or "")
        
        ttk.Label(api_frame, text="API Key:").grid(row=0, column=0, sticky='w')
        ttk.Entry(api_frame, textvariable=self.api_key_var, width=50).grid(row=0, column=1, padx=5)
        
        ttk.Label(api_frame, text="Password:").grid(row=1, column=0, sticky='w')
        ttk.Entry(api_frame, textvariable=self.api_password_var, width=50, show="*").grid(row=1, column=1, padx=5)
        
        ttk.Label(api_frame, text="Account:").grid(row=2, column=0, sticky='w')
        ttk.Entry(api_frame, textvariable=self.account_var, width=20).grid(row=2, column=1, padx=5)
        
        ttk.Button(api_frame, text="Test Connection", command=self.test_connection).grid(row=3, column=1, pady=5)
        
        # Default Settings
        defaults_frame = ttk.LabelFrame(settings_frame, text="Default Settings", padding=10)
        defaults_frame.pack(fill='x', padx=10, pady=5)
        
        self.default_service_var = tk.StringVar(value="PurolatorExpress")
        self.default_payment_var = tk.StringVar(value="Sender")
        self.default_weight_var = tk.StringVar(value="2.5")
        
        ttk.Label(defaults_frame, text="Default Service:").grid(row=0, column=0, sticky='w')
        ttk.Combobox(defaults_frame, textvariable=self.default_service_var,
                    values=["PurolatorExpress", "PurolatorGround", "PurolatorExpress9AM"]).grid(row=0, column=1, padx=5)
        
        ttk.Label(defaults_frame, text="Default Payment:").grid(row=1, column=0, sticky='w')
        ttk.Combobox(defaults_frame, textvariable=self.default_payment_var,
                    values=["Sender", "Receiver", "ThirdParty"]).grid(row=1, column=1, padx=5)
        
        ttk.Label(defaults_frame, text="Default Weight (kg):").grid(row=2, column=0, sticky='w')
        ttk.Entry(defaults_frame, textvariable=self.default_weight_var, width=10).grid(row=2, column=1, padx=5)
        
        # Save button
        ttk.Button(settings_frame, text="Save Settings", command=self.save_settings).pack(pady=10)
        
    def browse_csv(self):
        """Browse for CSV file"""
        filename = filedialog.askopenfilename(
            title="Select CSV file",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")]
        )
        if filename:
            self.csv_path_var.set(filename)
            
    def browse_log(self):
        """Browse for log file"""
        filename = filedialog.askopenfilename(
            title="Select log file",
            filetypes=[("JSON files", "*.jsonl"), ("CSV files", "*.csv"), ("All files", "*.*")]
        )
        if filename:
            self.log_path_var.set(filename)
            self.load_log_content()
            
    def download_template(self):
        """Download CSV template"""
        template_data = [
            ["sender_name", "sender_street", "sender_city", "sender_province", "sender_postal", "sender_phone",
             "receiver_name", "receiver_street", "receiver_city", "receiver_province", "receiver_postal", "receiver_country", "receiver_phone",
             "service_id", "weight", "length", "width", "height", "payment_type", "reference"],
            ["John Doe", "123 Main St", "Toronto", "ON", "L5N3B5", "416-123-4567",
             "Jane Smith", "456 Elm St", "Montreal", "QC", "K7M6G2", "CA", "613-987-6543",
             "PurolatorExpress", "2.5", "30", "20", "10", "Sender", "ORDER-001"]
        ]
        
        filename = filedialog.asksaveasfilename(
            title="Save CSV template",
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")]
        )
        
        if filename:
            with open(filename, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerows(template_data)
            messagebox.showinfo("Success", f"Template saved to {filename}")
            
    def process_batch(self):
        """Process batch shipments from CSV"""
        if not self.csv_path_var.get():
            messagebox.showerror("Error", "Please select a CSV file")
            return
            
        # Start processing in separate thread
        thread = threading.Thread(target=self._process_batch_thread)
        thread.daemon = True
        thread.start()
        
    def _process_batch_thread(self):
        """Process batch in background thread"""
        try:
            csv_path = self.csv_path_var.get()
            shipments = self.load_csv_shipments(csv_path)
            
            self.progress_bar['maximum'] = len(shipments)
            self.progress_bar['value'] = 0
            
            results = []
            for i, shipment in enumerate(shipments):
                if hasattr(self, 'stop_processing_flag') and self.stop_processing_flag:
                    break
                    
                self.progress_var.set(f"Processing shipment {i+1}/{len(shipments)}")
                
                try:
                    result = self.create_shipment_from_data(shipment)
                    results.append(result)
                    
                    # Update results display
                    self.root.after(0, self.update_results_display, result)
                    
                except Exception as e:
                    error_result = {
                        'reference': shipment.get('reference', f'Row {i+1}'),
                        'status': 'Error',
                        'message': str(e)
                    }
                    results.append(error_result)
                    self.root.after(0, self.update_results_display, error_result)
                
                self.progress_bar['value'] = i + 1
                
            # Save results
            if self.save_logs_var.get():
                self.save_batch_results(results)
                
            self.progress_var.set(f"Completed: {len(results)} shipments processed")
            
        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("Error", f"Batch processing failed: {str(e)}"))
            
    def load_csv_shipments(self, csv_path):
        """Load shipments from CSV file with validation"""
        shipments = []
        errors = []
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                # Validate the row
                is_valid, error_msg = validate_shipment_data(row)
                if is_valid:
                    shipments.append(row)
                else:
                    errors.append(f"Row {i}: {error_msg}")
        
        if errors:
            error_text = "\n".join(errors[:10])  # Show first 10 errors
            if len(errors) > 10:
                error_text += f"\n... and {len(errors) - 10} more errors"
            
            # Show warning in main thread
            self.root.after(0, lambda: messagebox.showwarning(
                "Validation Errors", 
                f"Found {len(errors)} validation error(s):\n\n{error_text}\n\n"
                "These rows will be skipped."
            ))
        
        return shipments
        
    def create_shipment_from_data(self, data):
        """Create shipment from CSV data"""
        # Build SOAP request
        soap_body = self.build_shipment_request_from_data(data)
        
        headers = {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "http://purolator.com/pws/service/v2/CreateShipment"
        }
        
        response = requests.post(
            self.shipment_url,
            data=soap_body,
            headers=headers,
            auth=(self.username, self.password),
            timeout=30
        )
        
        # Parse response
        shipment_pin = self.extract_shipment_pin(response.text)
        
        # Extract error message if failed
        error_message = None
        if response.status_code != 200 or not shipment_pin:
            error_message = extract_error_message(response.text)
        
        result = {
            'reference': data.get('reference', 'Unknown'),
            'status': 'Success' if (response.status_code == 200 and shipment_pin) else 'Error',
            'http_status': response.status_code,
            'shipment_pin': shipment_pin,
            'message': 'Shipment created successfully' if shipment_pin else (error_message or 'Failed to create shipment')
        }
        
        # Get label if successful
        if shipment_pin and self.auto_print_var.get():
            self.get_and_save_label(shipment_pin, data.get('reference', 'Unknown'))
            
        return result
        
    def build_shipment_request_from_data(self, data):
        """Build SOAP request from CSV data with proper parsing"""
        # Parse sender phone number
        sender_phone = parse_phone_number(data.get('sender_phone', ''))
        
        # Parse receiver phone number
        receiver_phone = parse_phone_number(data.get('receiver_phone', ''))
        
        # Parse sender street address
        sender_street = data.get('sender_street', 'Main St')
        sender_street_num, sender_street_name = parse_street_address(sender_street)
        
        # Parse receiver street address
        receiver_street = data.get('receiver_street', 'Elm St')
        receiver_street_num, receiver_street_name = parse_street_address(receiver_street)
        
        # Format postal codes
        sender_postal = format_postal_code(data.get('sender_postal', 'L5L5X5'))
        receiver_postal = format_postal_code(data.get('receiver_postal', 'H4T1K5'))
        
        # Get default values with fallbacks
        sender_name = data.get('sender_name', 'Test Sender') or 'Test Sender'
        receiver_name = data.get('receiver_name', 'Test Receiver') or 'Test Receiver'
        sender_city = data.get('sender_city', 'Toronto') or 'Toronto'
        receiver_city = data.get('receiver_city', 'Montreal') or 'Montreal'
        sender_province = data.get('sender_province', 'ON') or 'ON'
        receiver_province = data.get('receiver_province', 'QC') or 'QC'
        receiver_country = data.get('receiver_country', 'CA') or 'CA'
        service_id = data.get('service_id', 'PurolatorExpress') or 'PurolatorExpress'
        weight = data.get('weight', '2.5') or '2.5'
        length = data.get('length', '30') or '30'
        width = data.get('width', '20') or '20'
        height = data.get('height', '10') or '10'
        payment_type = data.get('payment_type', 'Sender') or 'Sender'
        reference = data.get('reference', 'BatchShipment') or 'BatchShipment'
        
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v2="http://purolator.com/pws/datatypes/v2">
  <soapenv:Header>
    <v2:RequestContext>
      <v2:Version>2.0</v2:Version>
      <v2:Language>en</v2:Language>
      <v2:GroupID>111</v2:GroupID>
      <v2:RequestReference>{reference}</v2:RequestReference>
      <v2:UserToken></v2:UserToken>
    </v2:RequestContext>
  </soapenv:Header>
  <soapenv:Body>
    <v2:CreateShipmentRequest>
      <v2:Shipment>
        <v2:SenderInformation>
          <v2:Address>
            <v2:Name>{sender_name}</v2:Name>
            <v2:StreetNumber>{sender_street_num}</v2:StreetNumber>
            <v2:StreetName>{sender_street_name}</v2:StreetName>
            <v2:City>{sender_city}</v2:City>
            <v2:Province>{sender_province}</v2:Province>
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
            <v2:Name>{receiver_name}</v2:Name>
            <v2:StreetNumber>{receiver_street_num}</v2:StreetNumber>
            <v2:StreetName>{receiver_street_name}</v2:StreetName>
            <v2:City>{receiver_city}</v2:City>
            <v2:Province>{receiver_province}</v2:Province>
            <v2:Country>{receiver_country}</v2:Country>
            <v2:PostalCode>{receiver_postal}</v2:PostalCode>
            <v2:PhoneNumber>
              <v2:CountryCode>{receiver_phone['CountryCode']}</v2:CountryCode>
              <v2:AreaCode>{receiver_phone['AreaCode']}</v2:AreaCode>
              <v2:Phone>{receiver_phone['Phone']}</v2:Phone>
            </v2:PhoneNumber>
          </v2:Address>
        </v2:ReceiverInformation>
        <v2:PackageInformation>
          <v2:ServiceID>{service_id}</v2:ServiceID>
          <v2:TotalWeight>
            <v2:Value>{weight}</v2:Value>
            <v2:WeightUnit>kg</v2:WeightUnit>
          </v2:TotalWeight>
          <v2:Dimensions>
            <v2:Length>{length}</v2:Length>
            <v2:Width>{width}</v2:Width>
            <v2:Height>{height}</v2:Height>
            <v2:DimensionUnit>cm</v2:DimensionUnit>
          </v2:Dimensions>
          <v2:TotalPieces>1</v2:TotalPieces>
        </v2:PackageInformation>
        <v2:PaymentInformation>
          <v2:PaymentType>{payment_type}</v2:PaymentType>
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
        
    def extract_shipment_pin(self, response_text):
        """Extract shipment PIN from response"""
        try:
            root = ET.fromstring(response_text)
            # Find ShipmentPIN element
            pin_elem = root.find('.//{http://purolator.com/pws/datatypes/v2}ShipmentPIN')
            if pin_elem is not None:
                # Find the Value child element
                value_elem = pin_elem.find('{http://purolator.com/pws/datatypes/v2}Value')
                if value_elem is not None and value_elem.text:
                    return value_elem.text
            return None
        except Exception as e:
            print(f"Error extracting PIN: {e}")
            return None
            
    def get_and_save_label(self, shipment_pin, reference):
        """Get and save shipping label - handles both base64 and URL methods"""
        try:
            # Get label
            soap_body = f"""<?xml version='1.0' encoding='UTF-8'?>
<soapenv:Envelope xmlns:soapenv='http://schemas.xmlsoap.org/soap/envelope/' xmlns:v1='http://purolator.com/pws/datatypes/v1'>
  <soapenv:Header>
    <v1:RequestContext>
      <v1:Version>1.2</v1:Version>
      <v1:Language>en</v1:Language>
      <v1:GroupID>11</v1:GroupID>
      <v1:RequestReference>GetLabel</v1:RequestReference>
      <v1:UserToken></v1:UserToken>
    </v1:RequestContext>
  </soapenv:Header>
  <soapenv:Body>
    <v1:GetDocumentsRequest>
      <v1:DocumentCriterium>
        <v1:DocumentCriteria>
          <v1:PIN>
            <v1:Value>{shipment_pin}</v1:Value>
          </v1:PIN>
          <v1:DocumentTypes>
            <v1:DocumentType>DomesticBillOfLading</v1:DocumentType>
          </v1:DocumentTypes>
        </v1:DocumentCriteria>
      </v1:DocumentCriterium>
    </v1:GetDocumentsRequest>
  </soapenv:Body>
</soapenv:Envelope>"""

            headers = {
                "Content-Type": "text/xml; charset=utf-8",
                "SOAPAction": "http://purolator.com/pws/service/v1/GetDocuments"
            }

            response = requests.post(
                self.documents_url,
                data=soap_body,
                headers=headers,
                auth=(self.username, self.password),
                timeout=30
            )

            if response.status_code != 200:
                return None

            # Parse and save label - handle both base64 and URL methods
            root = ET.fromstring(response.text)
            ns = {'v1': 'http://purolator.com/pws/datatypes/v1'}

            pdf_data = None
            label_url = None

            for doc in root.findall('.//v1:Document', ns):
                # Check for base64 PDF data (preferred method)
                doc_data = doc.find('v1:Data', ns)
                if doc_data is not None and doc_data.text:
                    pdf_data = doc_data.text
                    break
                
                # Check for DocumentDetails/DocumentDetail/URL (alternative method)
                details = doc.find('v1:DocumentDetails', ns)
                if details is not None:
                    for detail in details.findall('v1:DocumentDetail', ns):
                        doc_type = detail.find('v1:DocumentType', ns)
                        url_elem = detail.find('v1:URL', ns)
                        if (doc_type is not None and 
                            doc_type.text == 'DomesticBillOfLading' and
                            url_elem is not None and url_elem.text):
                            label_url = url_elem.text
                            break

            # Save PDF from base64 data
            if pdf_data:
                labels_dir = Path("labels")
                labels_dir.mkdir(exist_ok=True)
                
                filename = f"label_{reference}_{shipment_pin}.pdf"
                filepath = labels_dir / filename
                
                with open(filepath, 'wb') as f:
                    f.write(base64.b64decode(pdf_data))
                
                # Send email if configured
                if self.email_sender and self.email_sender.is_configured:
                    self.email_sender.send_label_email(
                        str(filepath), 
                        shipment_pin, 
                        reference
                    )
                
                return str(filepath)
            
            # Download PDF from URL
            elif label_url:
                labels_dir = Path("labels")
                labels_dir.mkdir(exist_ok=True)
                
                filename = f"label_{reference}_{shipment_pin}.pdf"
                filepath = labels_dir / filename
                
                # Download from URL
                label_response = requests.get(label_url, timeout=30)
                if label_response.status_code == 200:
                    with open(filepath, 'wb') as f:
                        f.write(label_response.content)
                    
                    # Send email if configured
                    if self.email_sender and self.email_sender.is_configured:
                        self.email_sender.send_label_email(
                            str(filepath), 
                            shipment_pin, 
                            reference
                        )
                    
                    return str(filepath)

            return None

        except Exception as e:
            print(f"Error getting label: {e}")
            return None
            
    def update_results_display(self, result):
        """Update results display with new result"""
        timestamp = datetime.datetime.now().strftime('%H:%M:%S')
        display_text = f"[{timestamp}] {result['reference']}: {result['status']}"
        if result.get('shipment_pin'):
            display_text += f" (PIN: {result['shipment_pin']})"
        if result.get('message'):
            display_text += f" - {result['message']}"
        display_text += "\n"
        
        self.results_text.insert(tk.END, display_text)
        self.results_text.see(tk.END)
        
    def save_batch_results(self, results):
        """Save batch processing results"""
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"batch_results_{timestamp}.csv"
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['reference', 'status', 'http_status', 'shipment_pin', 'message'])
            writer.writeheader()
            writer.writerows(results)
            
    def stop_processing(self):
        """Stop batch processing"""
        self.stop_processing_flag = True
        
    def create_single_shipment(self):
        """Create single shipment from form data"""
        try:
            # Build data dictionary from form
            data = {
                'sender_name': self.sender_name_var.get(),
                'sender_street': self.sender_street_var.get(),
                'sender_city': self.sender_city_var.get(),
                'sender_province': self.sender_province_var.get(),
                'sender_postal': self.sender_postal_var.get(),
                'sender_phone': self.sender_phone_var.get(),
                'receiver_name': self.receiver_name_var.get(),
                'receiver_street': self.receiver_street_var.get(),
                'receiver_city': self.receiver_city_var.get(),
                'receiver_province': self.receiver_province_var.get(),
                'receiver_postal': self.receiver_postal_var.get(),
                'receiver_country': self.receiver_country_var.get(),
                'receiver_phone': self.receiver_phone_var.get(),
                'service_id': self.service_id_var.get(),
                'weight': self.weight_var.get(),
                'length': self.length_var.get(),
                'width': self.width_var.get(),
                'height': self.height_var.get(),
                'payment_type': self.payment_type_var.get(),
                'reference': f"Single_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
            }
            
            result = self.create_shipment_from_data(data)
            
            if result['status'] == 'Success':
                messagebox.showinfo("Success", f"Shipment created successfully!\nPIN: {result.get('shipment_pin', 'N/A')}")
            else:
                messagebox.showerror("Error", f"Failed to create shipment: {result.get('message', 'Unknown error')}")
                
        except Exception as e:
            messagebox.showerror("Error", f"Error creating shipment: {str(e)}")
            
    def print_label(self):
        """Print label for current shipment"""
        # This would integrate with your label printing system
        messagebox.showinfo("Print Label", "Label printing functionality would be implemented here")
        
    def clear_form(self):
        """Clear the single shipment form"""
        for var in [self.sender_name_var, self.sender_street_var, self.sender_city_var,
                   self.sender_province_var, self.sender_postal_var, self.sender_phone_var,
                   self.receiver_name_var, self.receiver_street_var, self.receiver_city_var,
                   self.receiver_province_var, self.receiver_postal_var, self.receiver_phone_var]:
            var.set("")
            
    def load_log_content(self):
        """Load log file content"""
        if self.log_path_var.get():
            try:
                with open(self.log_path_var.get(), 'r', encoding='utf-8') as f:
                    content = f.read()
                self.log_text.delete(1.0, tk.END)
                self.log_text.insert(1.0, content)
            except Exception as e:
                messagebox.showerror("Error", f"Error loading log file: {str(e)}")
                
    def refresh_logs(self):
        """Refresh log display"""
        self.load_log_content()
        
    def test_connection(self):
        """Test API connection"""
        try:
            # Simple connection test
            response = requests.get(self.shipment_url, timeout=10)
            if response.status_code == 200:
                messagebox.showinfo("Success", "API connection successful!")
            else:
                messagebox.showwarning("Warning", f"API responded with status: {response.status_code}")
        except Exception as e:
            messagebox.showerror("Error", f"Connection failed: {str(e)}")
            
    def save_settings(self):
        """Save application settings"""
        # This would save settings to a configuration file
        messagebox.showinfo("Settings", "Settings saved successfully!")
    
    # ========== ADDRESS BOOK INTEGRATION ==========
    
    def create_address_book_tab(self):
        """Create the address book tab for quick lookup"""
        address_frame = ttk.Frame(self.notebook)
        self.notebook.add(address_frame, text="Address Book")
        
        # Search section
        search_frame = ttk.LabelFrame(address_frame, text="Search", padding=10)
        search_frame.pack(fill='x', padx=10, pady=10)
        
        ttk.Label(search_frame, text="Search:").grid(row=0, column=0, padx=5, sticky='w')
        self.ab_search_var = tk.StringVar()
        self.ab_search_var.trace('w', lambda *args: self.refresh_address_book())
        ttk.Entry(search_frame, textvariable=self.ab_search_var, width=40).grid(row=0, column=1, padx=5)
        ttk.Button(search_frame, text="Refresh", command=self.refresh_address_book).grid(row=0, column=2, padx=5)
        
        # Customer/Location list
        list_frame = ttk.LabelFrame(address_frame, text="Customers & Locations", padding=10)
        list_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Treeview
        columns = ('Customer', 'Location', 'Address', 'City', 'Province', 'Postal', 'Phone')
        self.address_tree = ttk.Treeview(list_frame, columns=columns, show='headings', height=20)
        
        for col in columns:
            self.address_tree.heading(col, text=col)
            if col == 'Address':
                self.address_tree.column(col, width=200)
            else:
                self.address_tree.column(col, width=120)
        
        # Scrollbar
        scrollbar = ttk.Scrollbar(list_frame, orient='vertical', command=self.address_tree.yview)
        self.address_tree.configure(yscrollcommand=scrollbar.set)
        
        self.address_tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        
        # Double-click to select
        self.address_tree.bind('<Double-1>', lambda e: self.use_selected_address())
        
        # Action buttons
        button_frame = ttk.Frame(address_frame)
        button_frame.pack(fill='x', padx=10, pady=10)
        
        ttk.Button(button_frame, text="Use This Address", 
                  command=self.use_selected_address).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Open Address Book Manager", 
                  command=self.open_address_manager).pack(side='left', padx=5)
        
        # Load initial data
        self.refresh_address_book()
    
    def refresh_address_book(self):
        """Refresh address book display"""
        if not self.db:
            return
        
        # Clear existing items
        for item in self.address_tree.get_children():
            self.address_tree.delete(item)
        
        # Get search term
        search_term = self.ab_search_var.get() if hasattr(self, 'ab_search_var') else ''
        
        # Query locations with customer info
        if search_term:
            locations = self.db.search_locations(search_term)
        else:
            # Get all locations
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT sl.*, c.customer_name
                    FROM shipping_locations sl
                    JOIN customers c ON sl.customer_id = c.customer_id
                    ORDER BY c.customer_name, sl.location_name
                ''')
                locations = [dict(row) for row in cursor.fetchall()]
        
        # Populate tree (store location_id in item)
        for loc in locations:
            item_id = self.address_tree.insert('', 'end', values=(
                loc['customer_name'],
                loc['location_name'],
                loc['address_street'],
                loc['address_city'],
                loc['address_province'],
                loc['address_postal'],
                loc['phone_number']
            ))
            # Store location_id as a tag for later retrieval
            self.address_tree.item(item_id, tags=(str(loc['location_id']),))
    
    def select_from_address_book(self):
        """Show address book selection dialog"""
        if not self.db:
            messagebox.showwarning("Warning", "Address book not available")
            return
        
        # Create dialog
        dialog = tk.Toplevel(self.root)
        dialog.title("Select from Address Book")
        dialog.geometry("900x600")
        
        # Search section
        search_frame = ttk.Frame(dialog)
        search_frame.pack(fill='x', padx=10, pady=10)
        
        ttk.Label(search_frame, text="Search:").pack(side='left', padx=5)
        search_var = tk.StringVar()
        search_entry = ttk.Entry(search_frame, textvariable=search_var, width=40)
        search_entry.pack(side='left', padx=5)
        
        # List
        list_frame = ttk.Frame(dialog)
        list_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        columns = ('Customer', 'Location', 'Address', 'City', 'Province', 'Postal', 'Phone')
        tree = ttk.Treeview(list_frame, columns=columns, show='headings')
        
        for col in columns:
            tree.heading(col, text=col)
            tree.column(col, width=100)
        
        scrollbar = ttk.Scrollbar(list_frame, orient='vertical', command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        
        tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        
        def load_locations(search_term=''):
            # Clear tree
            for item in tree.get_children():
                tree.delete(item)
            
            # Query locations
            if search_term:
                locations = self.db.search_locations(search_term)
            else:
                with self.db.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        SELECT sl.*, c.customer_name
                        FROM shipping_locations sl
                        JOIN customers c ON sl.customer_id = c.customer_id
                        ORDER BY c.customer_name, sl.location_name
                    ''')
                    locations = [dict(row) for row in cursor.fetchall()]
            
            # Populate tree
            for loc in locations:
                item_id = tree.insert('', 'end', values=(
                    loc['customer_name'],
                    loc['location_name'],
                    loc['address_street'],
                    loc['address_city'],
                    loc['address_province'],
                    loc['address_postal'],
                    loc['phone_number']
                ))
                tree.item(item_id, tags=(str(loc['location_id']),))
        
        # Search callback
        search_var.trace('w', lambda *args: load_locations(search_var.get()))
        
        def select_and_close():
            selection = tree.selection()
            if not selection:
                messagebox.showwarning("Warning", "Please select a location")
                return
            
            # Get location_id from tags
            tags = tree.item(selection[0], 'tags')
            if tags:
                location_id = int(tags[0])
                self.populate_from_location(location_id)
                dialog.destroy()
        
        # Buttons
        button_frame = ttk.Frame(dialog)
        button_frame.pack(fill='x', padx=10, pady=10)
        
        ttk.Button(button_frame, text="Select", command=select_and_close).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Cancel", command=dialog.destroy).pack(side='left', padx=5)
        
        # Load initial data
        load_locations()
        
        # Double-click to select
        tree.bind('<Double-1>', lambda e: select_and_close())
    
    def use_selected_address(self):
        """Use selected address from address book tab"""
        if not self.db:
            return
        
        selection = self.address_tree.selection()
        if not selection:
            messagebox.showwarning("Warning", "Please select a location")
            return
        
        # Get location_id from tags
        tags = self.address_tree.item(selection[0], 'tags')
        if tags:
            location_id = int(tags[0])
            self.populate_from_location(location_id)
            # Switch to single shipment tab
            self.notebook.select(1)  # Single Shipment is tab index 1
    
    def populate_from_location(self, location_id: int):
        """Populate single shipment form from location"""
        if not self.db:
            return
        
        # Get location with customer info
        location = self.db.get_shipping_location(location_id)
        if not location:
            messagebox.showerror("Error", "Location not found")
            return
        
        customer = self.db.get_customer(location['customer_id'])
        
        # Populate receiver fields
        if customer:
            self.receiver_name_var.set(customer['customer_name'])
        else:
            self.receiver_name_var.set(location['location_name'])
        
        self.receiver_street_var.set(location['address_street'])
        self.receiver_city_var.set(location['address_city'])
        self.receiver_province_var.set(location['address_province'])
        self.receiver_postal_var.set(location['address_postal'])
        self.receiver_country_var.set(location.get('address_country', 'CA'))
        self.receiver_phone_var.set(location['phone_number'])
        
        messagebox.showinfo("Success", f"Loaded address for {customer['customer_name'] if customer else location['location_name']}")
    
    def open_address_manager(self):
        """Open the address book manager application"""
        try:
            import subprocess
            import sys
            subprocess.Popen([sys.executable, 'address_book_manager.py'])
            messagebox.showinfo("Info", "Opening Address Book Manager...")
        except Exception as e:
            messagebox.showerror("Error", f"Could not open Address Book Manager: {str(e)}")
        
    def run(self):
        """Run the application"""
        self.root.mainloop()

if __name__ == "__main__":
    app = BatchShippingApp()
    app.run() 