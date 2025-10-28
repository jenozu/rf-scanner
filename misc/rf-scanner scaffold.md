Perfect 👌 — here’s a **clean, production-ready React component structure** you can feed directly into **V0.dev**, **Google Stitch**, **Cursor**, or even a React scaffold generator.

This structure exactly matches your **RF Inventory Counting App** flow — including scanning, lookup, caching, and CSV export.

---

# ⚛️ **RF Inventory Counting App – React Component Structure**

Below is a full breakdown you can paste into a builder or manually scaffold from.

---

## 🗂️ **Folder Layout**

```
rf-inventory-app/
│
├── src/
│   ├── App.js
│   ├── index.js
│   ├── data/
│   │   └── csvUtils.js
│   ├── hooks/
│   │   └── useLocalStorage.js
│   ├── pages/
│   │   ├── SetupPage.js
│   │   ├── ScanPage.js
│   │   ├── NumpadModal.js
│   │   ├── ExportPage.js
│   └── components/
│       ├── ItemTable.js
│       ├── ProgressBar.js
│       └── Header.js
│
├── public/
│   └── index.html
│
└── package.json
```

---

## ⚙️ **App.js**

```jsx
import React, { useState } from "react";
import SetupPage from "./pages/SetupPage";
import ScanPage from "./pages/ScanPage";
import ExportPage from "./pages/ExportPage";
import NumpadModal from "./pages/NumpadModal";

function App() {
  const [step, setStep] = useState("setup");
  const [data, setData] = useState([]);
  const [currentBin, setCurrentBin] = useState(null);
  const [showNumpad, setShowNumpad] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <div className="app-container">
      {step === "setup" && (
        <SetupPage setStep={setStep} setData={setData} />
      )}
      {step === "scan" && (
        <ScanPage
          data={data}
          setData={setData}
          setStep={setStep}
          setCurrentBin={setCurrentBin}
          setSelectedItem={setSelectedItem}
          setShowNumpad={setShowNumpad}
        />
      )}
      {step === "export" && (
        <ExportPage data={data} setStep={setStep} />
      )}
      {showNumpad && (
        <NumpadModal
          selectedItem={selectedItem}
          setShowNumpad={setShowNumpad}
          setData={setData}
        />
      )}
    </div>
  );
}

export default App;
```

---

## 📁 **pages/SetupPage.js**

```jsx
import React, { useRef } from "react";
import Papa from "papaparse";

export default function SetupPage({ setStep, setData }) {
  const fileInput = useRef();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        setData(results.data);
        localStorage.setItem("rf_data", JSON.stringify(results.data));
        setStep("scan");
      },
    });
  };

  return (
    <div className="setup-page">
      <h2>📦 Load Stock CSV</h2>
      <input
        type="file"
        accept=".csv"
        ref={fileInput}
        onChange={handleFileUpload}
      />
      <button onClick={() => setStep("scan")}>Resume Previous Session</button>
    </div>
  );
}
```

---

## 📁 **pages/ScanPage.js**

```jsx
import React, { useState, useEffect } from "react";
import ItemTable from "../components/ItemTable";
import ProgressBar from "../components/ProgressBar";

export default function ScanPage({
  data,
  setData,
  setStep,
  setCurrentBin,
  setSelectedItem,
  setShowNumpad,
}) {
  const [binCode, setBinCode] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);

  const handleScan = (e) => {
    if (e.key === "Enter") {
      const bin = e.target.value.trim();
      const matches = data.filter((d) => d.BinCode === bin);
      setFilteredItems(matches);
      setCurrentBin(bin);
      setBinCode("");
    }
  };

  return (
    <div className="scan-page">
      <h2>Scan or Enter Bin</h2>
      <input
        type="text"
        placeholder="Scan bin barcode..."
        value={binCode}
        onChange={(e) => setBinCode(e.target.value)}
        onKeyPress={handleScan}
        autoFocus
      />

      <ItemTable
        items={filteredItems}
        setData={setData}
        setSelectedItem={setSelectedItem}
        setShowNumpad={setShowNumpad}
      />

      <ProgressBar data={data} />
      <button onClick={() => setStep("export")}>Finish & Export</button>
    </div>
  );
}
```

---

## 📁 **components/ItemTable.js**

```jsx
import React from "react";

export default function ItemTable({ items, setData, setSelectedItem, setShowNumpad }) {
  const updateCount = (item, newCount) => {
    item.CountedQty = Number(newCount);
    localStorage.setItem("rf_data", JSON.stringify(items));
    setData([...items]);
  };

  return (
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Description</th>
          <th>Qty</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={`${item.BinCode}_${item.ItemCode}`}>
            <td>{item.ItemCode}</td>
            <td>{item.Description}</td>
            <td>{item.QtyInBin}</td>
            <td>
              <input
                type="number"
                value={item.CountedQty || item.QtyInBin}
                onChange={(e) => updateCount(item, e.target.value)}
              />
              <button
                onClick={() => {
                  setSelectedItem(item);
                  setShowNumpad(true);
                }}
              >
                ✏️
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 📁 **pages/NumpadModal.js**

```jsx
import React, { useState } from "react";

export default function NumpadModal({ selectedItem, setShowNumpad, setData }) {
  const [value, setValue] = useState("");

  const handleKey = (num) => setValue(value + num);
  const handleClear = () => setValue("");
  const handleSave = () => {
    selectedItem.CountedQty = Number(value);
    setData((prev) => [...prev]);
    setShowNumpad(false);
  };

  return (
    <div className="numpad-modal">
      <h3>Edit {selectedItem.ItemCode}</h3>
      <div className="display">{value || selectedItem.CountedQty}</div>
      <div className="keys">
        {[1,2,3,4,5,6,7,8,9,0].map((n) => (
          <button key={n} onClick={() => handleKey(n)}>{n}</button>
        ))}
        <button onClick={handleClear}>Clear</button>
        <button onClick={handleSave}>Save</button>
      </div>
    </div>
  );
}
```

---

## 📁 **pages/ExportPage.js**

```jsx
import React from "react";
import Papa from "papaparse";

export default function ExportPage({ data, setStep }) {
  const handleExport = () => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "counted_stock.csv";
    a.click();
  };

  return (
    <div className="export-page">
      <h2>✅ Counting Complete</h2>
      <p>You can export your results below:</p>
      <button onClick={handleExport}>⬇ Download CSV</button>
      <button onClick={() => setStep("scan")}>Back to Counting</button>
    </div>
  );
}
```

---

## 📁 **components/ProgressBar.js**

```jsx
import React from "react";

export default function ProgressBar({ data }) {
  const counted = data.filter((d) => d.CountedQty !== undefined).length;
  const total = data.length;
  const percent = ((counted / total) * 100).toFixed(1);

  return (
    <div className="progress">
      <p>Bins Counted: {counted} / {total}</p>
      <div className="bar">
        <div className="fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
```

---

## 📁 **hooks/useLocalStorage.js**

```jsx
import { useState, useEffect } from "react";

export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
```

---

## 🧱 **Style Notes (for Stitch / V0)**

Use a **minimalist mobile layout** with:

* TailwindCSS or ShadCN UI components
* Buttons: large, rounded, full-width
* Inputs: large font, clear borders
* Use icons (✅ ❌ ✏️ 📦) for quick recognition

Color palette:
🟦 Blue for action
🟩 Green for confirmed
🟥 Red for errors