#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RF Scanner Inventory Export Script
===================================
Exports all bin locations and items from SAP B1 database for the RF Scanner inventory module.
This script generates a CSV file that can be imported into the RF Scanner app for sequential counting.

Based on the stock.py script but optimized for RF Scanner app format.
"""

import os
import argparse
import pyodbc
import pandas as pd
from dotenv import load_dotenv
from datetime import datetime

# ==============================
# .env loader (search upwards)
# ==============================
def load_env_upwards(start_dir: str):
    """Search for .env file starting from start_dir and moving up to root."""
    cur = os.path.abspath(start_dir)
    root = os.path.abspath(os.path.sep)
    while True:
        candidate = os.path.join(cur, ".env")
        if os.path.isfile(candidate):
            load_dotenv(dotenv_path=candidate, override=True)
            return candidate
        if cur == root:
            return None
        cur = os.path.dirname(cur)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FOUND_ENV = load_env_upwards(SCRIPT_DIR)

# ==============================
# DB connection
# ==============================
def pick_driver() -> str:
    """Select the best available ODBC driver for SQL Server."""
    try:
        drivers = [d.lower() for d in pyodbc.drivers()]
        for name in ["odbc driver 18 for sql server", "odbc driver 17 for sql server"]:
            for d in drivers:
                if name in d:
                    return "{" + d.replace("{", "").replace("}", "") + "}"
    except Exception:
        pass
    return "{SQL Server}"

def build_conn_str() -> str:
    """Build connection string from environment variables."""
    server = os.getenv("SQL_SERVER")
    database = os.getenv("SQL_DATABASE")
    user = os.getenv("SQL_USER")
    password = os.getenv("SQL_PASSWORD")

    missing = [k for k, v in [
        ("SQL_SERVER", server),
        ("SQL_DATABASE", database),
        ("SQL_USER", user),
        ("SQL_PASSWORD", password),
    ] if not v]

    if missing:
        where = FOUND_ENV if FOUND_ENV else "(no .env found)"
        raise RuntimeError(
            "Missing DB credentials. Missing: " + ", ".join(missing) + f". Looked in: {where}"
        )

    driver = pick_driver()
    return (
        f"DRIVER={driver};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={user};"
        f"PWD={password};"
        "TrustServerCertificate=Yes;"
    )

# ==============================
# Query Functions
# ==============================
def fetch_bins_and_items(warehouse="01", cutoff_date="2024-01-01") -> pd.DataFrame:
    """
    Fetch all bins and items with inventory movements since cutoff_date.
    Returns data formatted for RF Scanner app import.
    
    Output columns: BinCode, Zone, ItemCode, Description, Quantity, Status
    """
    sql = f"""
    WITH RecentActivity AS (
        SELECT DISTINCT T0.ItemCode
        FROM dbo.OIVL T0
        WHERE T0.DocDate >= ?
    )
    SELECT
        B.WhsCode   AS Warehouse,
        B.BinCode,
        COALESCE(B.Attr1Val, 'General') AS Zone,
        Q.ItemCode,
        I.ItemName AS Description,
        ISNULL(Q.OnHandQty, 0) AS Quantity,
        CASE 
            WHEN I.frozenFor = 'N' THEN 'active'
            ELSE 'inactive'
        END AS Status
    FROM dbo.OITM I
    LEFT JOIN dbo.OIBQ Q
      ON Q.ItemCode = I.ItemCode
    LEFT JOIN dbo.OBIN B
      ON B.AbsEntry = Q.BinAbs
     AND B.WhsCode = Q.WhsCode
    INNER JOIN RecentActivity RA
      ON RA.ItemCode = I.ItemCode
    WHERE
        Q.WhsCode = ?
        AND I.frozenFor = 'N'
    ORDER BY B.BinCode ASC, Q.ItemCode ASC;
    """

    with pyodbc.connect(build_conn_str()) as conn:
        df = pd.read_sql(sql, conn, params=[cutoff_date, warehouse])
    
    return df

def fetch_all_bins(warehouse="01") -> pd.DataFrame:
    """
    Fetch all bins in the warehouse with their current inventory.
    This includes bins with zero quantity items.
    
    Output columns: BinCode, Zone, ItemCode, Description, Quantity, Status
    """
    sql = f"""
    SELECT
        B.WhsCode   AS Warehouse,
        B.BinCode,
        COALESCE(B.Attr1Val, 'General') AS Zone,
        Q.ItemCode,
        I.ItemName AS Description,
        ISNULL(Q.OnHandQty, 0) AS Quantity,
        CASE 
            WHEN I.frozenFor = 'N' THEN 'active'
            ELSE 'inactive'
        END AS Status
    FROM dbo.OBIN B
    LEFT JOIN dbo.OIBQ Q
      ON B.AbsEntry = Q.BinAbs
     AND B.WhsCode = Q.WhsCode
    LEFT JOIN dbo.OITM I
      ON I.ItemCode = Q.ItemCode
    WHERE
        B.WhsCode = ?
        AND (I.frozenFor = 'N' OR I.frozenFor IS NULL)
    ORDER BY B.BinCode ASC, Q.ItemCode ASC;
    """

    with pyodbc.connect(build_conn_str()) as conn:
        df = pd.read_sql(sql, conn, params=[warehouse])
    
    # Remove rows where ItemCode is NULL (empty bins)
    df = df[df['ItemCode'].notna()]
    
    return df

# ==============================
# Main
# ==============================
def main():
    parser = argparse.ArgumentParser(
        description="Export SAP B1 inventory for RF Scanner sequential counting."
    )
    parser.add_argument(
        "--warehouse", 
        default="01", 
        help="Warehouse code (default: 01)"
    )
    parser.add_argument(
        "--mode", 
        choices=["recent", "all"], 
        default="recent",
        help="Export mode: 'recent' (items with movements since cutoff) or 'all' (all items)"
    )
    parser.add_argument(
        "--cutoff-date", 
        default="2024-01-01",
        help="Only include items with movements on/after this date (YYYY-MM-DD). Used in 'recent' mode."
    )
    parser.add_argument(
        "--out-base", 
        default="rf_inventory",
        help="Output filename base (CSV + XLSX). Default: 'rf_inventory'"
    )
    args = parser.parse_args()

    print(f"🔄 Fetching inventory data...")
    print(f"   Warehouse: {args.warehouse}")
    print(f"   Mode: {args.mode}")
    
    if args.mode == "recent":
        print(f"   Cutoff Date: {args.cutoff_date}")
        df = fetch_bins_and_items(warehouse=args.warehouse, cutoff_date=args.cutoff_date)
    else:
        df = fetch_all_bins(warehouse=args.warehouse)

    if df.empty:
        print("⚠️  No data found. Check warehouse code and date range.")
        return

    # Select and order columns for RF Scanner
    cols = ["Warehouse", "BinCode", "Zone", "ItemCode", "Description", "Quantity", "Status"]
    df = df[cols]

    # Generate output filenames with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_csv = os.path.join(SCRIPT_DIR, f"{args.out_base}_{timestamp}.csv")
    out_xlsx = os.path.join(SCRIPT_DIR, f"{args.out_base}_{timestamp}.xlsx")

    # Save files
    df.to_csv(out_csv, index=False, encoding="utf-8-sig")
    df.to_excel(out_xlsx, index=False)

    # Statistics
    num_bins = df['BinCode'].nunique()
    num_items = len(df)
    total_qty = df['Quantity'].sum()

    print(f"\n✅ Export Complete!")
    print(f"   📦 Bins: {num_bins}")
    print(f"   📋 Items: {num_items}")
    print(f"   🔢 Total Quantity: {total_qty:,.0f}")
    print(f"\n📄 Files saved:")
    print(f"   CSV:   {out_csv}")
    print(f"   Excel: {out_xlsx}")
    
    if FOUND_ENV:
        print(f"\nℹ️  Loaded .env from: {FOUND_ENV}")

    print(f"\n💡 Next Steps:")
    print(f"   1. Import the CSV file into RF Scanner app (Setup page)")
    print(f"   2. Start an inventory counting session")
    print(f"   3. Select 'Sequential Count' and choose your bin range")
    print(f"   4. Count items one by one using the numpad")
    print(f"   5. Export the session log CSV when done")

if __name__ == "__main__":
    main()

