# 🚀 RF Scanner: Sequential Count - Quick Reference

## 📋 Step-by-Step Checklist

### One-Time Setup
- [ ] Export inventory from SAP B1: `python inventory_export_for_rf.py --warehouse 01`
- [ ] Import CSV into RF Scanner (Setup page)
- [ ] Verify bins and items loaded correctly

### Daily Counting Routine

#### Start Session (Once per shift/zone)
1. Open **Inventory** page
2. Click **"Start Session"** 
3. Name it: `[Date] [Shift] [Zone]` (e.g., "2024-11-10 AM Aisle-A")
4. Click **"Create"**

#### Count Items
1. Click **"Sequential Count (Bin Range)"**
2. Enter **Start Bin** (e.g., `A-01-01`)
3. Enter **End Bin** (e.g., `A-01-10`)
4. Click **"Start Counting"**

#### For Each Item:
- **Matches?** → Click **"Confirm"** (green button)
- **Different?** → Use numpad → Click **"Submit Count"** (blue button)
- **Can't access?** → Click **"Skip"** (yellow button)

#### End Session
1. Click **"Export"** button (downloads CSV)
2. Click **"Pause Session"** to save progress
3. Or continue counting later - it auto-saves!

---

## 🎯 Quick Actions

| Action | Button | When to Use |
|--------|--------|-------------|
| **Confirm** | Green checkmark | Quantity matches expected |
| **Submit Count** | Blue button | Entered different quantity |
| **Skip** | Yellow forward | Can't count this item now |
| **Previous** | Gray left | Go back one item |
| **Next** | Gray right | Move forward (if counted) |
| **Export** | Blue download | Save session log to CSV |
| **Pause** | Floppy disk icon | Save and exit |

---

## 📊 CSV Export Columns

Your session log CSV includes:
- Session ID, Session Name, Username
- Timestamp, Bin Code, Item Code, Description
- Expected Qty, Counted Qty, Variance

---

## 💡 Pro Tips

### ⚡ Speed Tips
- Use **"Confirm"** button when qty matches (no typing!)
- Count small ranges (5-10 bins) for quick sessions
- Skip blocked items, count them later

### 📦 Organization Tips
- Name sessions by date + location
- Count same zone/aisle in one session
- Export logs daily (don't lose data!)

### 🎯 Accuracy Tips
- Recount if large variance detected
- Double-check numpad entry before submit
- Use "Previous" to fix mistakes immediately

### 🔄 Session Strategy
- **Short bursts**: 5-10 mins throughout day
- **One zone**: Count complete aisles/lanes
- **Monthly coverage**: ~20 sessions = full warehouse

---

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| No bins found | Check bin codes match exactly (case-sensitive) |
| No active session | Click "Start Session" first |
| Can't submit | Enter qty with numpad first |
| Lost progress | Resume session from session modal |
| Export empty | Count at least one item before export |

---

## 📱 Mobile Workflow

1. **Morning**: Start session for your zone
2. **Between tasks**: Count 5-10 items (2-3 bins)
3. **Breaks**: Count another batch
4. **End of shift**: Export log, pause session
5. **Next day**: Resume and continue

---

## 🏆 Best Practice Example

**Goal**: Count 200-bin warehouse monthly

**Strategy**:
- 2 workers × 2 sessions/day × 5 items/session × 20 days
- = 400 items counted (with overlap for accuracy)

**Daily**:
```
Worker 1 AM:  Bins A-01 to A-05  (10 mins)
Worker 1 PM:  Bins A-06 to A-10  (10 mins)
Worker 2 AM:  Bins B-01 to B-05  (10 mins)
Worker 2 PM:  Bins B-06 to B-10  (10 mins)
```

**Result**: Full warehouse counted in 1 month, ~20 mins/worker/day!

---

## 🔗 Related Files

- **Full Guide**: `INVENTORY_SEQUENTIAL_COUNT_GUIDE.md`
- **Export Script**: `inventory_export_for_rf.py`
- **Original Script**: `stock.py`

---

## ⚡ Ultra Quick Start

```bash
# 1. Export data
python inventory_export_for_rf.py

# 2. Import CSV (in app)
Setup page → Import CSV

# 3. Count
Inventory → Start Session → Sequential Count → Enter bins → Count!
```

**That's it!** 🎉

