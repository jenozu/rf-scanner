#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SAP Business One Purchase Order Export Script
Exports PO data in format compatible with RF Warehouse Management System

Usage:
    python export_po_from_sap.py --format csv --output po_export.csv
    python export_po_from_sap.py --format xlsx --po-number 12345
    python export_po_from_sap.py --vendor "Tech Supplies" --date-from 2025-01-01
"""

import pyodbc
import pandas as pd
import argparse
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()


def build_connection_string():
    """Build SQL Server connection string from environment variables"""
    server = os.getenv('DB_SERVER', 'localhost')
    database = os.getenv('DB_NAME', 'SBO_DEMO_US')
    username = os.getenv('DB_USER', 'sa')
    password = os.getenv('DB_PASSWORD', '')
    driver = os.getenv('DB_DRIVER', '{ODBC Driver 17 for SQL Server}')
    
    conn_str = (
        f"DRIVER={driver};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        f"TrustServerCertificate=yes;"
    )
    return conn_str


def build_query(po_number=None, vendor=None, date_from=None, date_to=None):
    """Build SQL query with optional filters"""
    base_query = """
    SELECT 
        OP.DocNum AS DocNum,
        OP.CardName AS CardName,
        CONVERT(VARCHAR(10), OP.ReqDate, 120) AS ReqDate,
        PL.ItemCode AS ItemCode,
        ISNULL(PL.Dscription, '') AS Dscription,
        ISNULL(PL.Quantity, 0) AS Quantity,
        ISNULL(PL.OpenQty, 0) AS OpenQty
    FROM OPOR OP
    INNER JOIN POR1 PL ON OP.DocEntry = PL.DocEntry
    WHERE OP.DocStatus = 'O'
      AND OP.CANCELED = 'N'
      AND PL.Quantity > 0
    """
    
    conditions = []
    params = []
    
    if po_number:
        conditions.append("OP.DocNum = ?")
        params.append(str(po_number))
    
    if vendor:
        conditions.append("(OP.CardName LIKE ? OR OP.CardCode LIKE ?)")
        vendor_pattern = f"%{vendor}%"
        params.extend([vendor_pattern, vendor_pattern])
    
    if date_from:
        conditions.append("OP.ReqDate >= ?")
        params.append(date_from)
    
    if date_to:
        conditions.append("OP.ReqDate <= ?")
        params.append(date_to)
    
    if conditions:
        base_query += " AND " + " AND ".join(conditions)
    
    base_query += " ORDER BY OP.DocNum, PL.LineNum"
    
    return base_query, params


def export_po_data(output_file, file_format='csv', po_number=None, vendor=None, 
                   date_from=None, date_to=None):
    """Export Purchase Order data to CSV or XLSX"""
    
    print("🔌 Connecting to SAP Business One database...")
    try:
        conn_str = build_connection_string()
        conn = pyodbc.connect(conn_str)
        print("✅ Connected successfully!")
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        sys.exit(1)
    
    print("📊 Querying Purchase Order data...")
    query, params = build_query(po_number, vendor, date_from, date_to)
    
    try:
        df = pd.read_sql(query, conn, params=params if params else None)
        conn.close()
    except Exception as e:
        print(f"❌ Query execution error: {e}")
        conn.close()
        sys.exit(1)
    
    if df.empty:
        print("⚠️  No Purchase Orders found matching the criteria.")
        sys.exit(0)
    
    # Ensure column order matches required format
    required_columns = ['DocNum', 'CardName', 'ReqDate', 'ItemCode', 'Dscription', 'Quantity', 'OpenQty']
    df = df[required_columns]
    
    # Format data
    df['Quantity'] = pd.to_numeric(df['Quantity'], errors='coerce').fillna(0)
    df['OpenQty'] = pd.to_numeric(df['OpenQty'], errors='coerce').fillna(0)
    df['ReqDate'] = pd.to_datetime(df['ReqDate'], errors='coerce').dt.strftime('%Y-%m-%d')
    df['Dscription'] = df['Dscription'].fillna('')
    
    # Export to file
    print(f"💾 Exporting {len(df)} line items to {output_file}...")
    
    try:
        if file_format.lower() == 'xlsx':
            df.to_excel(output_file, index=False, engine='openpyxl')
        else:
            df.to_csv(output_file, index=False)
        print(f"✅ Export completed: {output_file}")
    except Exception as e:
        print(f"❌ File write error: {e}")
        sys.exit(1)
    
    # Print summary statistics
    print("\n📈 Export Summary:")
    print(f"   • Total POs: {df['DocNum'].nunique()}")
    print(f"   • Total Line Items: {len(df)}")
    print(f"   • Total Ordered Quantity: {df['Quantity'].sum():,.0f}")
    print(f"   • Total Remaining (OpenQty): {df['OpenQty'].sum():,.0f}")
    print(f"   • Total Received: {(df['Quantity'].sum() - df['OpenQty'].sum()):,.0f}")
    
    if not df['ReqDate'].isna().all():
        date_range = f"{df['ReqDate'].min()} to {df['ReqDate'].max()}"
        print(f"   • Date Range: {date_range}")
    
    print("\n✅ Ready to upload to RF Warehouse Management System!")


def main():
    parser = argparse.ArgumentParser(
        description='Export Purchase Orders from SAP Business One',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Export all open POs to CSV
  python export_po_from_sap.py --format csv
  
  # Export specific PO to Excel
  python export_po_from_sap.py --format xlsx --po-number 12345
  
  # Export by vendor and date range
  python export_po_from_sap.py --vendor "Tech Supplies" --date-from 2025-01-01
        """
    )
    
    parser.add_argument(
        '--format',
        choices=['csv', 'xlsx'],
        default='csv',
        help='Output file format (default: csv)'
    )
    
    parser.add_argument(
        '--output',
        type=str,
        help='Output file path (default: auto-generated with timestamp)'
    )
    
    parser.add_argument(
        '--po-number',
        type=str,
        help='Filter by specific Purchase Order number'
    )
    
    parser.add_argument(
        '--vendor',
        type=str,
        help='Filter by vendor name or code (partial match)'
    )
    
    parser.add_argument(
        '--date-from',
        type=str,
        help='Filter POs from this date (YYYY-MM-DD)'
    )
    
    parser.add_argument(
        '--date-to',
        type=str,
        help='Filter POs to this date (YYYY-MM-DD)'
    )
    
    args = parser.parse_args()
    
    # Generate output filename if not provided
    if not args.output:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        extension = 'xlsx' if args.format == 'xlsx' else 'csv'
        args.output = f"po_export_{timestamp}.{extension}"
    
    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    export_po_data(
        output_file=args.output,
        file_format=args.format,
        po_number=args.po_number,
        vendor=args.vendor,
        date_from=args.date_from,
        date_to=args.date_to
    )


if __name__ == '__main__':
    main()

