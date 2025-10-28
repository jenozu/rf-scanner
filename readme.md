Here’s your **updated `README.md`** — same professional layout, but now includes a full **“Troubleshooting & Known Issues”** section that documents the scan-page blank screen bug, its cause, and the correct post-scan behavior.

You can drop this directly into your repo and it’ll give Cursor or any dev full context.

---

```markdown
# 📦 RF Inventory Counter (Web App)

A mobile-optimized **React + TypeScript** web app for warehouse inventory counting and bin verification.

Built for internal warehouse use at Marind to streamline **RF scanner workflows**, verify stock accuracy, and update count data against exported SAP warehouse CSVs.

---

## 🚀 Overview

This app allows warehouse staff to:

- Scan bin or item barcodes using the device camera (Code128, EAN, UPC)
- Automatically match scanned codes to a master inventory CSV
- Review or correct quantities directly from a phone or tablet
- Save progress locally and resume counting later
- Export a CSV file of updated counts and variances for SAP updates

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | React + TypeScript (Vite) |
| **Styling** | TailwindCSS |
| **Barcode Scanner** | [`@ericblade/quagga2`](https://github.com/ericblade/quagga2) |
| **CSV Handling** | [`papaparse`](https://www.papaparse.com/) |
| **Persistence** | Browser `localStorage` (offline-ready) |
| **Hosting** | Nginx static server on Ubuntu VPS |
| **SSL** | Let’s Encrypt (`certbot`) |

---

## 📂 Folder Structure

```

rf-inventory-app/
│
├── public/
│   └── index.html
│
├── src/
│   ├── main.tsx
│   ├── app.tsx
│   │
│   ├── components/
│   │   ├── header.tsx
│   │   ├── footer-nav.tsx
│   │   ├── item-table.tsx
│   │   ├── progress-bar.tsx
│   │   └── item-card.tsx
│   │
│   ├── pages/
│   │   ├── setup-page.tsx
│   │   ├── home-page.tsx
│   │   ├── scan-page.tsx
│   │   ├── export-page.tsx
│   │   └── numpad-modal.tsx
│   │
│   ├── data/
│   │   └── csv-utils.ts
│   │
│   ├── hooks/
│   │   └── use-local-storage.ts
│   │
│   ├── index.css
│   └── tailwind.css
│
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── .env.example

````

---

## 🧩 Features

### ✅ **1. CSV Integration**
- Imports warehouse master list from `/data/master_inventory.csv`  
- Creates a working clone (`rf_active`) in browser storage
- Automatically calculates `Variance = CountedQty - ExpectedQty`
- Exports updated CSV with timestamp

### ✅ **2. Barcode Scanning**
- Uses `@ericblade/quagga2` for real-time camera scanning
- Recognizes Code128, EAN, and UPC barcodes
- Displays item information instantly after a scan
- Smooth “toast” feedback system (no reloads)

### ✅ **3. Counting Workflow**
- Manual correction via **Numpad modal**
- Local progress save (auto-persist between sessions)
- Optional “last 5 scans” log for quick review (future enhancement)

### ✅ **4. Offline-First**
- Works even without an internet connection after initial load
- All counting data saved in `localStorage`

---

## 🧮 CSV Format Specification

| Column | Example | Description |
|---------|----------|-------------|
| `BinCode` | 01-0528 | Physical warehouse bin |
| `ItemCode` | GEN5000 | SKU or part number |
| `Description` | Power Generator 5000W | Product name |
| `ExpectedQty` | 12 | Stock from SAP |
| `CountedQty` | *(blank initially)* | Entered by user |
| `Variance` | *(auto)* | Difference between expected & counted |

---

## 🧰 Installation

### 1️⃣ Clone or copy the repository
```bash
git clone https://github.com/<your-org>/rf-inventory-app.git
cd rf-inventory-app
````

### 2️⃣ Install dependencies

```bash
npm install
```

### 3️⃣ Run locally

```bash
npm run dev
```

Your app will open at [http://localhost:5173](http://localhost:5173)

---

## 🏗️ Build for Production

```bash
npm run build
```

Output will be created in the `/dist` folder.

---

## 🌍 Deployment (Ubuntu + Nginx)

1️⃣ **Copy build to VPS**

```bash
scp -r dist/* root@<server-ip>:/var/www/rf-scanner/
```

2️⃣ **Nginx Config (`/etc/nginx/sites-available/rf-scanner`):**

```nginx
server {
    listen 80;
    server_name rf.andel-vps.space;
    root /var/www/rf-scanner;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /data/ {
        autoindex on;
    }
}
```

3️⃣ **Enable site & reload**

```bash
sudo ln -s /etc/nginx/sites-available/rf-scanner /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

4️⃣ **Enable SSL**

```bash
sudo certbot --nginx -d rf.andel-vps.space
```

---

## 🔐 .env Example

```bash
VITE_APP_TITLE="RF Inventory Counter"
VITE_DATA_PATH="/data/master_inventory.csv"
```

---

## ⚠️ Troubleshooting & Known Issues

### ❌ **Issue: Screen goes blank after scanning a barcode**

**Symptoms:**

* The camera activates correctly.
* The barcode beeps once (indicating a successful scan).
* A split second later, the screen turns completely white and reloads.

**Cause:**

* The original `scan-page.tsx` used `alert()` and `confirm()` dialogs after each scan.
* On mobile browsers (especially Safari/Chrome), these dialogs **break the React render tree**, unmounting the video stream and leaving the app blank.
* Additionally, it navigated to the Export page immediately after scanning, which had no data yet — showing an empty page.

**Fix Implemented:**

* Removed all blocking dialogs (`alert`, `confirm`).
* Replaced them with **non-blocking “toast” pop-ups** that fade out automatically.
* Camera feed remains active.
* Export navigation is now **manual** from the bottom tab, not automatic.

**Expected Behavior (After Fix):**

1. Camera view stays open.
2. Toast pops up → ✅ “Scanned: 01-0528”
3. Matching item card appears below:

   ```
   Power Generator 5000W
   Item: GEN5000 | Expected: 12
   [ Enter Counted Qty ] [ Save ]
   ```
4. When saved → 💾 “Saved GEN5000”
5. Camera remains active, ready for next scan.
6. Export page accessed manually to review saved counts.

---

## 🧾 Roadmap / Future Enhancements

* [ ] Auto-load CSV from server instead of manual upload
* [ ] Add timestamped versioning for every export
* [ ] Implement scan history (last 5 scans)
* [ ] Add PWA mode for offline installability
* [ ] Integrate export upload back to SAP via API

---

## 👨‍🔧 Maintainer

**Developer:** Andel O’Bryan
**Company:** Marind Industrial
**Server:** Ubuntu 22.04 VPS (Hostinger)
**Domain:** [https://rf.andel-vps.space](https://rf.andel-vps.space)

---

## 🧠 Developer Notes for Cursor

* Cursor can safely infer TypeScript types from existing `.tsx` components.
* App state lives in `app.tsx` → pages receive `setPage()` and `onAdjustItem()` props.
* CSV parsing and local storage logic live in `csv-utils.ts` and `use-local-storage.ts`.
* Quagga barcode scanner is initialized in `scan-page.tsx`.
* All data flows through the `rf_active` object in localStorage.

---

**💾 TL;DR**
This app helps warehouse staff perform **cycle counts** and **bin verification** quickly using a smartphone or RF scanner, syncing with SAP data via CSV export/import.
Fully offline-capable, mobile-first, and deployed via Nginx on a secured VPS.
