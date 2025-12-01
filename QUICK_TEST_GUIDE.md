# Quick Test Guide

## Before You Start
1. Open browser console (F12 → Console tab)
2. Keep it open while testing
3. Look for the console.log messages I added

---

## Test 1: Check If Bins Are Loaded
**Do this FIRST!**

1. Open console
2. Go to Inventory page
3. Look for this message:
   ```
   Total bins available: XX
   Sample bin codes: ["...", "...", ...]
   ```

**If you see "Total bins available: 0":**
- Go to Setup page
- Import your bins CSV
- Come back to Inventory

**If you see bin codes:**
- Note the format! (e.g., "01-0001" or "01-1001")
- This tells you what prefix to use

---

## Test 2: Continue Counting Button

### If you have NO bin range yet:
1. Look at session card
2. Button should say: **"Start Counting"**
3. NO "Bins: XX to YY" text shown
4. Click button → Opens bin selection modal ✅

### If you DO have a bin range:
1. Look at session card
2. Should show: **"Bins: 01-1001 to 01-1050"** (example)
3. Button should say: **"Continue Counting"**
4. Click button → Should go directly to counting screen ✅
5. Console should show:
   ```
   Restoring sequential mode: 01-1001 to 01-1050
   Rebuilt items: 47
   Setting countingMode to sequential
   ```

---

## Test 3: Aisle Filter

1. Click "Start Counting" (or "Sequential Count")
2. Make sure **"By Aisle"** is selected (green button)
3. Look at your sample bin codes from Test 1
4. Enter matching prefix:
   - If bins are "01-0001", "01-0002" → Enter "01-"
   - If bins are "01-1001", "01-1002" → Enter "01-1"
   - If bins are "A-01-01", "A-01-02" → Enter "A-01-"
5. Click "Start Counting"
6. Console should show:
   ```
   Filtering by aisle prefix: 01-1
   Filtered bins count: 50
   First 5 filtered bins: ["01-1001", "01-1002", ...]
   Range for aisle: 01-1001 to 01-1050
   Checking bin availability...
   Locking bins...
   Bins locked successfully
   Total items to count: 120
   Setting counting mode to sequential
   Sequential count started successfully
   ```
7. Should go to counting screen ✅

---

## What To Send Me If It Fails

1. **Screenshot of session card** (shows what button says)
2. **Full console output** (copy/paste all messages)
3. **Exact text you typed** in aisle field
4. **Which test failed** (Test 1, 2, or 3)

---

## Expected Results (Summary)

✅ Test 1: See bin count and samples
✅ Test 2: Button text changes based on session state
✅ Test 3: Aisle filter logs everything and works

If ALL THREE pass → Everything works! 🎉
If ANY fail → Send me the info above and I'll fix it immediately.

