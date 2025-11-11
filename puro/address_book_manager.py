"""
Address Book Manager - GUI Application
Standalone tool for managing customer addresses and shipping locations
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import os
from address_book_db import get_db
from purolator_utils import validate_postal_code


class AddressBookManager:
    """GUI application for managing customer addresses"""
    
    def __init__(self):
        self.db = get_db()
        self.root = tk.Tk()
        self.root.title("Address Book Manager - Purolator Shipping")
        self.root.geometry("1200x800")
        
        # Selected customer and location
        self.selected_customer_id = None
        self.selected_location_id = None
        
        self.setup_gui()
    
    def setup_gui(self):
        """Initialize the GUI interface"""
        # Create main notebook
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Create tabs
        self.create_customers_tab()
        self.create_locations_tab()
        self.create_import_export_tab()
        self.create_orders_tab()
    
    def create_customers_tab(self):
        """Create the customers management tab"""
        customer_frame = ttk.Frame(self.notebook)
        self.notebook.add(customer_frame, text="Customers")
        
        # Search and add section
        top_frame = ttk.Frame(customer_frame)
        top_frame.pack(fill='x', padx=10, pady=10)
        
        # Search
        ttk.Label(top_frame, text="Search:").pack(side='left', padx=5)
        self.customer_search_var = tk.StringVar()
        self.customer_search_var.trace('w', lambda *args: self.refresh_customer_list())
        ttk.Entry(top_frame, textvariable=self.customer_search_var, width=30).pack(side='left', padx=5)
        
        ttk.Button(top_frame, text="Add New Customer", command=self.add_customer_dialog).pack(side='left', padx=20)
        ttk.Button(top_frame, text="Edit Customer", command=self.edit_customer_dialog).pack(side='left', padx=5)
        ttk.Button(top_frame, text="Delete Customer", command=self.delete_customer).pack(side='left', padx=5)
        
        # Customer list
        list_frame = ttk.LabelFrame(customer_frame, text="Customers", padding=10)
        list_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Treeview for customers
        columns = ('ID', 'Customer Name', 'Purolator Account', 'Created')
        self.customer_tree = ttk.Treeview(list_frame, columns=columns, show='headings', height=20)
        
        for col in columns:
            self.customer_tree.heading(col, text=col)
            self.customer_tree.column(col, width=150)
        
        # Scrollbar
        scrollbar = ttk.Scrollbar(list_frame, orient='vertical', command=self.customer_tree.yview)
        self.customer_tree.configure(yscrollcommand=scrollbar.set)
        
        self.customer_tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        
        # Bind selection
        self.customer_tree.bind('<<TreeviewSelect>>', self.on_customer_select)
        
        # Load initial data
        self.refresh_customer_list()
    
    def create_locations_tab(self):
        """Create the shipping locations management tab"""
        location_frame = ttk.Frame(self.notebook)
        self.notebook.add(location_frame, text="Shipping Locations")
        
        # Top section
        top_frame = ttk.Frame(location_frame)
        top_frame.pack(fill='x', padx=10, pady=10)
        
        # Customer selection
        ttk.Label(top_frame, text="Customer:").pack(side='left', padx=5)
        self.location_customer_var = tk.StringVar()
        self.location_customer_combo = ttk.Combobox(top_frame, textvariable=self.location_customer_var, 
                                                     width=30, state='readonly')
        self.location_customer_combo.pack(side='left', padx=5)
        self.location_customer_combo.bind('<<ComboboxSelected>>', lambda e: self.refresh_location_list())
        
        ttk.Button(top_frame, text="Add Location", command=self.add_location_dialog).pack(side='left', padx=20)
        ttk.Button(top_frame, text="Edit Location", command=self.edit_location_dialog).pack(side='left', padx=5)
        ttk.Button(top_frame, text="Delete Location", command=self.delete_location).pack(side='left', padx=5)
        
        # Location list
        list_frame = ttk.LabelFrame(location_frame, text="Locations", padding=10)
        list_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Treeview for locations
        columns = ('ID', 'Location Name', 'Address', 'City', 'Province', 'Postal', 'Phone', 'Default')
        self.location_tree = ttk.Treeview(list_frame, columns=columns, show='headings', height=20)
        
        for col in columns:
            self.location_tree.heading(col, text=col)
            if col == 'Address':
                self.location_tree.column(col, width=200)
            else:
                self.location_tree.column(col, width=100)
        
        # Scrollbar
        scrollbar = ttk.Scrollbar(list_frame, orient='vertical', command=self.location_tree.yview)
        self.location_tree.configure(yscrollcommand=scrollbar.set)
        
        self.location_tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        
        # Bind selection
        self.location_tree.bind('<<TreeviewSelect>>', self.on_location_select)
        
        # Load customer list for combo
        self.refresh_customer_combo()
    
    def create_import_export_tab(self):
        """Create import/export tab"""
        ie_frame = ttk.Frame(self.notebook)
        self.notebook.add(ie_frame, text="Import/Export")
        
        # Import section
        import_frame = ttk.LabelFrame(ie_frame, text="Import Data", padding=20)
        import_frame.pack(fill='x', padx=10, pady=10)
        
        ttk.Label(import_frame, text="Import customers or locations from CSV file").pack(anchor='w', pady=5)
        
        button_frame = ttk.Frame(import_frame)
        button_frame.pack(fill='x', pady=10)
        
        ttk.Button(button_frame, text="Import Customers", command=self.import_customers).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Import Locations", command=self.import_locations).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Download Template", command=self.download_import_template).pack(side='left', padx=20)
        
        # Export section
        export_frame = ttk.LabelFrame(ie_frame, text="Export Data", padding=20)
        export_frame.pack(fill='x', padx=10, pady=10)
        
        ttk.Label(export_frame, text="Export customers or locations to CSV file").pack(anchor='w', pady=5)
        
        button_frame2 = ttk.Frame(export_frame)
        button_frame2.pack(fill='x', pady=10)
        
        ttk.Button(button_frame2, text="Export Customers", command=self.export_customers).pack(side='left', padx=5)
        ttk.Button(button_frame2, text="Export Locations", command=self.export_locations).pack(side='left', padx=5)
        
        # Instructions
        instructions_frame = ttk.LabelFrame(ie_frame, text="CSV Format Guide", padding=20)
        instructions_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        instructions_text = tk.Text(instructions_frame, height=15, wrap='word')
        instructions_text.pack(fill='both', expand=True)
        
        instructions = """
CSV Format for Customers:
- customer_name: Name of the customer
- purolator_account_number: Purolator account (optional)

CSV Format for Locations:
- customer_name: Name of the customer (will be looked up or created)
- location_name: Name/description of this location
- address_street: Street address
- address_city: City
- address_province: Province code (ON, QC, BC, etc.)
- address_postal: Postal code
- address_country: Country code (CA, US, etc.)
- phone_number: Phone number (any format)
- is_default: 1 for default location, 0 otherwise

Use the "Download Template" button to get a properly formatted CSV template.
"""
        instructions_text.insert('1.0', instructions)
        instructions_text.config(state='disabled')
    
    def create_orders_tab(self):
        """Create sales orders tab"""
        orders_frame = ttk.Frame(self.notebook)
        self.notebook.add(orders_frame, text="Sales Orders")
        
        # Top section
        top_frame = ttk.Frame(orders_frame)
        top_frame.pack(fill='x', padx=10, pady=10)
        
        ttk.Label(top_frame, text="Status Filter:").pack(side='left', padx=5)
        self.order_status_var = tk.StringVar(value='pending')
        status_combo = ttk.Combobox(top_frame, textvariable=self.order_status_var, 
                                    values=['all', 'pending', 'shipped', 'cancelled'],
                                    width=15, state='readonly')
        status_combo.pack(side='left', padx=5)
        status_combo.bind('<<ComboboxSelected>>', lambda e: self.refresh_order_list())
        
        ttk.Button(top_frame, text="Refresh", command=self.refresh_order_list).pack(side='left', padx=20)
        ttk.Button(top_frame, text="Add Order", command=self.add_order_dialog).pack(side='left', padx=5)
        
        # Orders list
        list_frame = ttk.LabelFrame(orders_frame, text="Orders", padding=10)
        list_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Treeview for orders
        columns = ('Order ID', 'Customer', 'Location', 'Status', 'Shipment PIN', 'Created')
        self.order_tree = ttk.Treeview(list_frame, columns=columns, show='headings', height=20)
        
        for col in columns:
            self.order_tree.heading(col, text=col)
            self.order_tree.column(col, width=120)
        
        # Scrollbar
        scrollbar = ttk.Scrollbar(list_frame, orient='vertical', command=self.order_tree.yview)
        self.order_tree.configure(yscrollcommand=scrollbar.set)
        
        self.order_tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        
        # Load initial data
        self.refresh_order_list()
    
    # Customer operations
    def refresh_customer_list(self):
        """Refresh the customer list"""
        # Clear existing items
        for item in self.customer_tree.get_children():
            self.customer_tree.delete(item)
        
        # Get search term
        search_term = self.customer_search_var.get()
        
        # Query customers
        if search_term:
            customers = self.db.search_customers(search_term)
        else:
            customers = self.db.get_all_customers()
        
        # Populate tree
        for customer in customers:
            self.customer_tree.insert('', 'end', values=(
                customer['customer_id'],
                customer['customer_name'],
                customer.get('purolator_account_number', ''),
                customer.get('created_at', '')[:10] if customer.get('created_at') else ''
            ))
    
    def on_customer_select(self, event):
        """Handle customer selection"""
        selection = self.customer_tree.selection()
        if selection:
            item = self.customer_tree.item(selection[0])
            self.selected_customer_id = item['values'][0]
    
    def add_customer_dialog(self):
        """Show dialog to add new customer"""
        dialog = tk.Toplevel(self.root)
        dialog.title("Add Customer")
        dialog.geometry("400x200")
        
        # Name
        ttk.Label(dialog, text="Customer Name:").grid(row=0, column=0, padx=10, pady=10, sticky='w')
        name_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=name_var, width=30).grid(row=0, column=1, padx=10, pady=10)
        
        # Purolator Account
        ttk.Label(dialog, text="Purolator Account:").grid(row=1, column=0, padx=10, pady=10, sticky='w')
        account_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=account_var, width=30).grid(row=1, column=1, padx=10, pady=10)
        
        def save_customer():
            name = name_var.get().strip()
            if not name:
                messagebox.showerror("Error", "Customer name is required")
                return
            
            try:
                self.db.add_customer(name, account_var.get().strip() or None)
                self.refresh_customer_list()
                self.refresh_customer_combo()
                messagebox.showinfo("Success", "Customer added successfully")
                dialog.destroy()
            except Exception as e:
                messagebox.showerror("Error", f"Failed to add customer: {str(e)}")
        
        # Buttons
        button_frame = ttk.Frame(dialog)
        button_frame.grid(row=2, column=0, columnspan=2, pady=20)
        ttk.Button(button_frame, text="Save", command=save_customer).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Cancel", command=dialog.destroy).pack(side='left', padx=5)
    
    def edit_customer_dialog(self):
        """Show dialog to edit customer"""
        if not self.selected_customer_id:
            messagebox.showwarning("Warning", "Please select a customer first")
            return
        
        customer = self.db.get_customer(self.selected_customer_id)
        if not customer:
            messagebox.showerror("Error", "Customer not found")
            return
        
        dialog = tk.Toplevel(self.root)
        dialog.title("Edit Customer")
        dialog.geometry("400x200")
        
        # Name
        ttk.Label(dialog, text="Customer Name:").grid(row=0, column=0, padx=10, pady=10, sticky='w')
        name_var = tk.StringVar(value=customer['customer_name'])
        ttk.Entry(dialog, textvariable=name_var, width=30).grid(row=0, column=1, padx=10, pady=10)
        
        # Purolator Account
        ttk.Label(dialog, text="Purolator Account:").grid(row=1, column=0, padx=10, pady=10, sticky='w')
        account_var = tk.StringVar(value=customer.get('purolator_account_number', ''))
        ttk.Entry(dialog, textvariable=account_var, width=30).grid(row=1, column=1, padx=10, pady=10)
        
        def save_customer():
            name = name_var.get().strip()
            if not name:
                messagebox.showerror("Error", "Customer name is required")
                return
            
            try:
                self.db.update_customer(self.selected_customer_id, name, account_var.get().strip() or None)
                self.refresh_customer_list()
                self.refresh_customer_combo()
                messagebox.showinfo("Success", "Customer updated successfully")
                dialog.destroy()
            except Exception as e:
                messagebox.showerror("Error", f"Failed to update customer: {str(e)}")
        
        # Buttons
        button_frame = ttk.Frame(dialog)
        button_frame.grid(row=2, column=0, columnspan=2, pady=20)
        ttk.Button(button_frame, text="Save", command=save_customer).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Cancel", command=dialog.destroy).pack(side='left', padx=5)
    
    def delete_customer(self):
        """Delete selected customer"""
        if not self.selected_customer_id:
            messagebox.showwarning("Warning", "Please select a customer first")
            return
        
        customer = self.db.get_customer(self.selected_customer_id)
        if not customer:
            messagebox.showerror("Error", "Customer not found")
            return
        
        if messagebox.askyesno("Confirm Delete", 
                              f"Delete customer '{customer['customer_name']}' and all associated locations and orders?"):
            try:
                self.db.delete_customer(self.selected_customer_id)
                self.refresh_customer_list()
                self.refresh_customer_combo()
                self.refresh_location_list()
                messagebox.showinfo("Success", "Customer deleted successfully")
                self.selected_customer_id = None
            except Exception as e:
                messagebox.showerror("Error", f"Failed to delete customer: {str(e)}")
    
    # Location operations
    def refresh_customer_combo(self):
        """Refresh customer combo box"""
        customers = self.db.get_all_customers()
        customer_names = [c['customer_name'] for c in customers]
        self.location_customer_combo['values'] = customer_names
        
        # Store customer mapping
        self.customer_name_to_id = {c['customer_name']: c['customer_id'] for c in customers}
    
    def refresh_location_list(self):
        """Refresh the location list"""
        # Clear existing items
        for item in self.location_tree.get_children():
            self.location_tree.delete(item)
        
        # Get selected customer
        customer_name = self.location_customer_var.get()
        if not customer_name:
            return
        
        customer_id = self.customer_name_to_id.get(customer_name)
        if not customer_id:
            return
        
        # Query locations
        locations = self.db.get_customer_locations(customer_id)
        
        # Populate tree
        for location in locations:
            self.location_tree.insert('', 'end', values=(
                location['location_id'],
                location['location_name'],
                location['address_street'],
                location['address_city'],
                location['address_province'],
                location['address_postal'],
                location['phone_number'],
                '✓' if location['is_default'] else ''
            ))
    
    def on_location_select(self, event):
        """Handle location selection"""
        selection = self.location_tree.selection()
        if selection:
            item = self.location_tree.item(selection[0])
            self.selected_location_id = item['values'][0]
    
    def add_location_dialog(self):
        """Show dialog to add new location"""
        customer_name = self.location_customer_var.get()
        if not customer_name:
            messagebox.showwarning("Warning", "Please select a customer first")
            return
        
        customer_id = self.customer_name_to_id.get(customer_name)
        
        dialog = tk.Toplevel(self.root)
        dialog.title("Add Shipping Location")
        dialog.geometry("500x450")
        
        # Location name
        ttk.Label(dialog, text="Location Name:").grid(row=0, column=0, padx=10, pady=5, sticky='w')
        loc_name_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=loc_name_var, width=35).grid(row=0, column=1, padx=10, pady=5)
        
        # Street
        ttk.Label(dialog, text="Street Address:").grid(row=1, column=0, padx=10, pady=5, sticky='w')
        street_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=street_var, width=35).grid(row=1, column=1, padx=10, pady=5)
        
        # City
        ttk.Label(dialog, text="City:").grid(row=2, column=0, padx=10, pady=5, sticky='w')
        city_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=city_var, width=35).grid(row=2, column=1, padx=10, pady=5)
        
        # Province
        ttk.Label(dialog, text="Province:").grid(row=3, column=0, padx=10, pady=5, sticky='w')
        province_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=province_var, width=10).grid(row=3, column=1, padx=10, pady=5, sticky='w')
        
        # Postal
        ttk.Label(dialog, text="Postal Code:").grid(row=4, column=0, padx=10, pady=5, sticky='w')
        postal_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=postal_var, width=15).grid(row=4, column=1, padx=10, pady=5, sticky='w')
        
        # Country
        ttk.Label(dialog, text="Country:").grid(row=5, column=0, padx=10, pady=5, sticky='w')
        country_var = tk.StringVar(value='CA')
        ttk.Entry(dialog, textvariable=country_var, width=5).grid(row=5, column=1, padx=10, pady=5, sticky='w')
        
        # Phone
        ttk.Label(dialog, text="Phone:").grid(row=6, column=0, padx=10, pady=5, sticky='w')
        phone_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=phone_var, width=20).grid(row=6, column=1, padx=10, pady=5, sticky='w')
        
        # Default
        default_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(dialog, text="Set as default location", variable=default_var).grid(
            row=7, column=0, columnspan=2, padx=10, pady=10
        )
        
        def save_location():
            # Validate
            if not loc_name_var.get().strip():
                messagebox.showerror("Error", "Location name is required")
                return
            if not street_var.get().strip():
                messagebox.showerror("Error", "Street address is required")
                return
            if not city_var.get().strip():
                messagebox.showerror("Error", "City is required")
                return
            if not postal_var.get().strip():
                messagebox.showerror("Error", "Postal code is required")
                return
            if not phone_var.get().strip():
                messagebox.showerror("Error", "Phone number is required")
                return
            
            # Validate postal code
            if not validate_postal_code(postal_var.get(), country_var.get()):
                messagebox.showerror("Error", "Invalid postal code format")
                return
            
            try:
                self.db.add_shipping_location(
                    customer_id=customer_id,
                    location_name=loc_name_var.get().strip(),
                    street=street_var.get().strip(),
                    city=city_var.get().strip(),
                    province=province_var.get().strip(),
                    postal=postal_var.get().strip(),
                    phone=phone_var.get().strip(),
                    country=country_var.get().strip(),
                    is_default=default_var.get()
                )
                self.refresh_location_list()
                messagebox.showinfo("Success", "Location added successfully")
                dialog.destroy()
            except Exception as e:
                messagebox.showerror("Error", f"Failed to add location: {str(e)}")
        
        # Buttons
        button_frame = ttk.Frame(dialog)
        button_frame.grid(row=8, column=0, columnspan=2, pady=20)
        ttk.Button(button_frame, text="Save", command=save_location).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Cancel", command=dialog.destroy).pack(side='left', padx=5)
    
    def edit_location_dialog(self):
        """Show dialog to edit location"""
        if not self.selected_location_id:
            messagebox.showwarning("Warning", "Please select a location first")
            return
        
        location = self.db.get_shipping_location(self.selected_location_id)
        if not location:
            messagebox.showerror("Error", "Location not found")
            return
        
        dialog = tk.Toplevel(self.root)
        dialog.title("Edit Shipping Location")
        dialog.geometry("500x450")
        
        # Location name
        ttk.Label(dialog, text="Location Name:").grid(row=0, column=0, padx=10, pady=5, sticky='w')
        loc_name_var = tk.StringVar(value=location['location_name'])
        ttk.Entry(dialog, textvariable=loc_name_var, width=35).grid(row=0, column=1, padx=10, pady=5)
        
        # Street
        ttk.Label(dialog, text="Street Address:").grid(row=1, column=0, padx=10, pady=5, sticky='w')
        street_var = tk.StringVar(value=location['address_street'])
        ttk.Entry(dialog, textvariable=street_var, width=35).grid(row=1, column=1, padx=10, pady=5)
        
        # City
        ttk.Label(dialog, text="City:").grid(row=2, column=0, padx=10, pady=5, sticky='w')
        city_var = tk.StringVar(value=location['address_city'])
        ttk.Entry(dialog, textvariable=city_var, width=35).grid(row=2, column=1, padx=10, pady=5)
        
        # Province
        ttk.Label(dialog, text="Province:").grid(row=3, column=0, padx=10, pady=5, sticky='w')
        province_var = tk.StringVar(value=location['address_province'])
        ttk.Entry(dialog, textvariable=province_var, width=10).grid(row=3, column=1, padx=10, pady=5, sticky='w')
        
        # Postal
        ttk.Label(dialog, text="Postal Code:").grid(row=4, column=0, padx=10, pady=5, sticky='w')
        postal_var = tk.StringVar(value=location['address_postal'])
        ttk.Entry(dialog, textvariable=postal_var, width=15).grid(row=4, column=1, padx=10, pady=5, sticky='w')
        
        # Country
        ttk.Label(dialog, text="Country:").grid(row=5, column=0, padx=10, pady=5, sticky='w')
        country_var = tk.StringVar(value=location['address_country'])
        ttk.Entry(dialog, textvariable=country_var, width=5).grid(row=5, column=1, padx=10, pady=5, sticky='w')
        
        # Phone
        ttk.Label(dialog, text="Phone:").grid(row=6, column=0, padx=10, pady=5, sticky='w')
        phone_var = tk.StringVar(value=location['phone_number'])
        ttk.Entry(dialog, textvariable=phone_var, width=20).grid(row=6, column=1, padx=10, pady=5, sticky='w')
        
        # Default
        default_var = tk.BooleanVar(value=bool(location['is_default']))
        ttk.Checkbutton(dialog, text="Set as default location", variable=default_var).grid(
            row=7, column=0, columnspan=2, padx=10, pady=10
        )
        
        def save_location():
            # Validate
            if not postal_var.get().strip():
                messagebox.showerror("Error", "Postal code is required")
                return
            
            # Validate postal code
            if not validate_postal_code(postal_var.get(), country_var.get()):
                messagebox.showerror("Error", "Invalid postal code format")
                return
            
            try:
                self.db.update_shipping_location(
                    self.selected_location_id,
                    location_name=loc_name_var.get().strip(),
                    address_street=street_var.get().strip(),
                    address_city=city_var.get().strip(),
                    address_province=province_var.get().strip(),
                    address_postal=postal_var.get().strip(),
                    address_country=country_var.get().strip(),
                    phone_number=phone_var.get().strip(),
                    is_default=1 if default_var.get() else 0
                )
                self.refresh_location_list()
                messagebox.showinfo("Success", "Location updated successfully")
                dialog.destroy()
            except Exception as e:
                messagebox.showerror("Error", f"Failed to update location: {str(e)}")
        
        # Buttons
        button_frame = ttk.Frame(dialog)
        button_frame.grid(row=8, column=0, columnspan=2, pady=20)
        ttk.Button(button_frame, text="Save", command=save_location).pack(side='left', padx=5)
        ttk.Button(button_frame, text="Cancel", command=dialog.destroy).pack(side='left', padx=5)
    
    def delete_location(self):
        """Delete selected location"""
        if not self.selected_location_id:
            messagebox.showwarning("Warning", "Please select a location first")
            return
        
        location = self.db.get_shipping_location(self.selected_location_id)
        if not location:
            messagebox.showerror("Error", "Location not found")
            return
        
        if messagebox.askyesno("Confirm Delete", 
                              f"Delete location '{location['location_name']}'?"):
            try:
                self.db.delete_shipping_location(self.selected_location_id)
                self.refresh_location_list()
                messagebox.showinfo("Success", "Location deleted successfully")
                self.selected_location_id = None
            except Exception as e:
                messagebox.showerror("Error", f"Failed to delete location: {str(e)}")
    
    # Import/Export operations
    def import_customers(self):
        """Import customers from CSV"""
        filepath = filedialog.askopenfilename(
            title="Select CSV file",
            filetypes=[("CSV files", "*.csv")]
        )
        if filepath:
            try:
                self.db.import_from_csv(filepath, 'customers')
                self.refresh_customer_list()
                self.refresh_customer_combo()
                messagebox.showinfo("Success", "Customers imported successfully")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to import: {str(e)}")
    
    def import_locations(self):
        """Import locations from CSV"""
        filepath = filedialog.askopenfilename(
            title="Select CSV file",
            filetypes=[("CSV files", "*.csv")]
        )
        if filepath:
            try:
                self.db.import_from_csv(filepath, 'locations')
                self.refresh_location_list()
                messagebox.showinfo("Success", "Locations imported successfully")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to import: {str(e)}")
    
    def export_customers(self):
        """Export customers to CSV"""
        filepath = filedialog.asksaveasfilename(
            title="Save CSV file",
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")]
        )
        if filepath:
            try:
                self.db.export_customers_to_csv(filepath)
                messagebox.showinfo("Success", f"Customers exported to {filepath}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to export: {str(e)}")
    
    def export_locations(self):
        """Export locations to CSV"""
        filepath = filedialog.asksaveasfilename(
            title="Save CSV file",
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")]
        )
        if filepath:
            try:
                self.db.export_locations_to_csv(filepath)
                messagebox.showinfo("Success", f"Locations exported to {filepath}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to export: {str(e)}")
    
    def download_import_template(self):
        """Download import template"""
        import csv
        
        filepath = filedialog.asksaveasfilename(
            title="Save template",
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")]
        )
        if filepath:
            try:
                with open(filepath, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(['customer_name', 'location_name', 'address_street', 'address_city',
                                   'address_province', 'address_postal', 'address_country', 'phone_number', 'is_default'])
                    writer.writerow(['Example Customer', 'Main Office', '123 Main Street', 'Toronto',
                                   'ON', 'M5J2R8', 'CA', '416-555-1234', '1'])
                messagebox.showinfo("Success", f"Template saved to {filepath}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to save template: {str(e)}")
    
    # Order operations
    def refresh_order_list(self):
        """Refresh the order list"""
        # Clear existing items
        for item in self.order_tree.get_children():
            self.order_tree.delete(item)
        
        # Get orders
        status_filter = self.order_status_var.get()
        
        if status_filter == 'pending':
            orders = self.db.get_pending_orders()
        else:
            # Get all orders
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                if status_filter == 'all':
                    cursor.execute('''
                        SELECT so.*, c.customer_name, sl.location_name
                        FROM sales_orders so
                        JOIN customers c ON so.customer_id = c.customer_id
                        JOIN shipping_locations sl ON so.location_id = sl.location_id
                        ORDER BY so.created_at DESC
                    ''')
                else:
                    cursor.execute('''
                        SELECT so.*, c.customer_name, sl.location_name
                        FROM sales_orders so
                        JOIN customers c ON so.customer_id = c.customer_id
                        JOIN shipping_locations sl ON so.location_id = sl.location_id
                        WHERE so.status = ?
                        ORDER BY so.created_at DESC
                    ''', (status_filter,))
                orders = [dict(row) for row in cursor.fetchall()]
        
        # Populate tree
        for order in orders:
            self.order_tree.insert('', 'end', values=(
                order['order_id'],
                order['customer_name'],
                order['location_name'],
                order['status'],
                order.get('shipment_pin', ''),
                order.get('created_at', '')[:10] if order.get('created_at') else ''
            ))
    
    def add_order_dialog(self):
        """Show dialog to add new order"""
        messagebox.showinfo("Info", "Use the Batch Shipping App to create orders from the address book")
    
    def run(self):
        """Run the application"""
        self.root.mainloop()


if __name__ == '__main__':
    app = AddressBookManager()
    app.run()

