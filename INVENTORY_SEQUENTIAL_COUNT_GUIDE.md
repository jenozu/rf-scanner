# 📋 RF Scanner: Sequential Inventory Counting Guide

## Overview

The RF Scanner now supports **Sequential Inventory Counting** - a mode designed for counting inventory throughout the day in 5-10 minute sessions. This mode lists items one by one from a bin range, allowing you to confirm or adjust quantities with an on-screen numpad. All counts are logged with user information for audit trails.

## ✨ Key Features

- **📦 Bin Range Filtering**: Choose start and end bins to count only specific aisles or lanes
- **📱 One-by-One Item Display**: Items are presented sequentially with expected quantities
- **🔢 Built-in Numpad**: Enter counts directly without external keyboard
- **✅ Quick Confirm**: One-tap to confirm expected quantity
- **👤 User Tracking**: Every count is logged with username and timestamp
- **💾 Session Persistence**: Pause and resume counting sessions anytime
- **📊 CSV Export**: Export detailed count logs for master inventory tracking
- **🔄 Navigation**: Skip items, go back, or move forward at your own pace

---

## 🚀 Quick Start Workflow

### 1. Prepare Your Data

First, export your inventory data from SAP B1:

```bash
# Using the new Python script
python inventory_export_for_rf.py --warehouse 01 --mode recent --cutoff-date 2024-01-01

# Or use the existing stock.py
python stock.py --warehouse 01 --cutoff-date 2024-01-01
```

This creates a CSV file with all your bin locations and items.

### 2. Import Data to RF Scanner

1. Open the RF Scanner app
2. Go to **Setup** page
3. Use the CSV import feature to load your bin/item data
4. Verify data is loaded (check bins and items appear)

### 3. Start a Counting Session

1. Navigate to **Inventory** page
2. Click **"Start Session"** button
3. Enter a session name (e.g., "Morning Count - Aisle A")
4. Click **"Create"**

> 💡 **Tip**: Use descriptive names like "2024-11-10 AM - Zone A" to track when and where you counted

### 4. Begin Sequential Counting

1. Click **"Sequential Count (Bin Range)"** button
2. Enter your bin range:
   - **Start Bin**: e.g., `A-01-01`
   - **End Bin**: e.g., `A-01-10`
3. Click **"Start Counting"**

The system will load all items within that bin range and present them one by one.

### 5. Count Items

For each item, you'll see:
- **Bin Code** and Zone
- **Item Code** and Description
- **Expected Quantity** (large blue number)
- **Progress Bar** (Item X of Y)

#### Counting Options:

**Option A: Quantity Matches**
- Click the green **"Confirm"** button to accept the expected quantity

**Option B: Quantity Different**
- Use the on-screen **numpad** to enter the actual count
- Click **"Submit Count"** button
- The system shows variance (+ or -)

**Option C: Skip Item**
- Click **"Skip"** button to move to next item without counting
- Useful if item is inaccessible or needs special handling

#### Navigation:
- **Previous**: Go back to previous item
- **Next**: Move forward (only works if current item has been counted)
- **Skip**: Skip current item and move forward

### 6. Export Session Log

When you're done (or want to save progress):

1. Click the **"Export"** button (top right) OR
2. Return to main menu and click **"Export Session Log"**

This downloads a CSV file with:
- Session ID and Name
- Username
- Timestamp
- Bin Code
- Item Code and Description
- Expected Qty
- Counted Qty
- Variance

### 7. Pause and Resume

**To Pause:**
- Click **"Pause Session"** button (top right, floppy disk icon)
- Or simply close the app - progress is auto-saved

**To Resume:**
- Open RF Scanner
- Go to **Inventory** page
- Click **"Start Session"** or **"Switch Session"**
- Find your session and click **"Resume"**
- Continue where you left off

---

## 📊 Session Log Format

The exported CSV contains these columns:

| Column | Description | Example |
|--------|-------------|---------|
| Session ID | Unique session identifier | `session-1699123456789` |
| Session Name | Your custom session name | `Morning Count - Zone A` |
| Username | User who counted the item | `john.smith` |
| Timestamp | When the count was recorded | `2024-11-10T09:15:32.123Z` |
| Bin Code | Bin location | `A-01-05` |
| Item Code | SKU/Item code | `ITEM-12345` |
| Description | Item name | `Widget Blue 10mm` |
| Expected Qty | System quantity before count | `50` |
| Counted Qty | Actual physical count | `48` |
| Variance | Difference (Counted - Expected) | `-2` |

---

## 💡 Best Practices

### Session Management

1. **Short Sessions**: 
   - Count for 5-10 minutes at a time
   - Pause and resume throughout the day
   - Over a month, you'll count everything

2. **Descriptive Names**:
   - Include date: `2024-11-10 AM Count`
   - Include location: `Aisle A Rows 1-5`
   - Include shift: `Evening Shift - Zone B`

3. **Regular Exports**:
   - Export session logs daily
   - Keep a master folder of all count CSVs
   - Review variances weekly

### Counting Tips

1. **Use Bin Ranges Strategically**:
   - Count one aisle at a time
   - Use logical start/end points
   - Match your physical layout

2. **Quick Confirm**:
   - If quantity looks right, tap **"Confirm"**
   - Much faster than typing the number

3. **Mark Discrepancies**:
   - Count carefully when variance is detected
   - Recount if variance is large
   - Export log shows all variances for review

4. **Skip Wisely**:
   - Skip items that are blocked/inaccessible
   - Come back later with a new session for those bins
   - Don't skip just because it's tedious!

---

## 🔧 Troubleshooting

### "No bins found in the specified range"

**Problem**: Your bin codes don't match the filter range.

**Solution**:
- Check your bin naming convention (case-sensitive)
- View existing bins in the Scan page first
- Ensure bins are loaded from CSV import

### "No active session"

**Problem**: You tried to count without starting a session.

**Solution**:
- Click **"Start Session"** button first
- Create or resume a session
- Then start sequential counting

### Lost Progress

**Problem**: Closed app and can't find your counts.

**Solution**:
- Session data is saved in browser localStorage
- Resume your session from the session modal
- Export logs regularly to avoid data loss
- Don't clear browser data without exporting first

### CSV Export Empty

**Problem**: Export shows 0 counts.

**Solution**:
- Make sure you've submitted at least one count
- Check you're in the correct session
- Verify session is active (not completed prematurely)

---

## 🔄 Integration with Master Inventory

### Recommended Workflow

1. **Daily**:
   - Multiple users count different zones/aisles
   - Each exports their session log at end of shift

2. **Weekly**:
   - Consolidate all session CSVs into one master file
   - Review variances > threshold (e.g., ±5%)
   - Investigate large discrepancies

3. **Monthly**:
   - Analyze coverage: have all bins been counted?
   - Generate variance reports by zone/item
   - Adjust expected quantities in SAP B1
   - Re-export fresh data for next month

### Excel/Python Processing

You can merge multiple session CSVs:

```python
import pandas as pd
import glob

# Read all session CSVs
files = glob.glob("inventory_session_*.csv")
dfs = [pd.read_csv(f) for f in files]

# Combine into master log
master = pd.concat(dfs, ignore_index=True)

# Save master inventory log
master.to_csv("master_inventory_log_nov2024.csv", index=False)

# Analysis: Items with variances
variances = master[master['Variance'] != 0]
print(f"Items with discrepancies: {len(variances)}")

# Analysis: Coverage
unique_items_counted = master['Item Code'].nunique()
print(f"Unique items counted: {unique_items_counted}")
```

---

## 📝 Example Use Case

**Scenario**: Warehouse with 500 bin locations, need monthly full count

**Strategy**:
- 3 workers
- Each counts 1-2 aisles per day (10 mins)
- 20 working days per month

**Execution**:
- **Week 1**: Aisles A-D
- **Week 2**: Aisles E-H
- **Week 3**: Aisles I-L
- **Week 4**: Aisles M-P, catch-up

**Daily**:
- Worker 1: Morning - Bins A-01 to A-10 (session "2024-11-10 AM Worker1 AisleA")
- Worker 1: Afternoon - Bins A-11 to A-20 (session "2024-11-10 PM Worker1 AisleA")
- Worker 2: Morning - Bins B-01 to B-10 (session "2024-11-10 AM Worker2 AisleB")

**Result**: 100% coverage in one month with minimal disruption to daily operations

---

## 🆘 Need Help?

- Check existing data in **Setup** page (verify bins loaded)
- Test with a small bin range first (e.g., 2-3 bins)
- Export logs frequently to avoid losing data
- Review the session statistics panel while counting

---

## 🎯 Summary

The Sequential Counting mode transforms inventory counting from a dreaded monthly event into a manageable daily task. By breaking counts into small sessions with bin range filtering, you can:

✅ Count anytime with 5-10 minute sessions  
✅ Track who counted what with automatic logging  
✅ Export detailed audit trails in CSV format  
✅ Achieve monthly full counts without disruption  
✅ Identify and correct variances systematically  

**Start small, count often, stay accurate!** 📦✨

