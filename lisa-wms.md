## LISA WMS Master Task List

### Scope and Approach
- This roadmap is organized into phases with actionable tasks and subtasks.
- Immediate adoption workstreams are prioritized first: Receiving (PO-based) and Inventory Control (Cycle Counting + Bin Inquiry).
- Each phase includes dependencies and acceptance criteria to keep implementation verifiable.

### Recent Updates (Latest Session)
- ✅ **Receiving Enhancements:**
  - PO search and server-based import from `/data/pos/` directory
  - SAP Business One integration (Python export script + column name support)
  - Auto-bin selection from PO data (if `BinCode` exists in PO)
  - Removed scan verification (items don't have barcodes)
  - Added numpad modal for mobile-friendly quantity entry
  - Made bin selection optional (uses PO's bin or staging if blank)
- ✅ **Transaction Logs:**
  - CSV export for receiving and cycle count transactions
  - Export page with dedicated download buttons
- ✅ **Infrastructure:**
  - Nginx configuration for serving PO files from `/data/pos/`
  - Server file upload workflow via `scp`

---

## Phase 1 — Immediate Adoption Workstreams

### 1. Receiving (PO-based, auditable)
- Tasks
  - [x] Implement PO lookup and line presentation
    - [x] PO search functionality (by PO number or vendor)
    - [x] Load POs from CSV/XLSX files (manual upload)
    - [x] Load POs from server directory (/data/pos/) via "Fetch" button
    - [x] Show line status, remaining qty, target bin (if available in PO)
  - [x] Receiving workflow (scan verification removed - items don't have barcodes)
    - [x] Quantity entry with numpad modal (mobile-friendly)
    - [x] Auto-select bin from PO if `BinCode` exists in PO data
    - [x] Optional bin selection (can leave blank to use PO's bin or staging)
    - [x] Auto-create bins if they don't exist
  - [x] Quantity + Lot/Serial capture
    - [x] Numpad modal for quantity entry (Calculator button)
    - [x] Mandatory lot/serial capture when flagged on item/PO line
    - [x] Support multiple serials and lot attributes (code, mfg/exp dates if provided)
  - [x] Receiving and staging
    - [x] Items assigned to bin (PO's bin, selected bin, or staging)
    - [x] Assign default `STAGING` bin if no bin specified
  - [x] PO File Management
    - [x] Upload PO CSV/XLSX files from Setup or Receive page
    - [x] Server-based PO storage in /data/pos/ directory
    - [x] SAP Business One column name support (DocNum, CardName, ReqDate, Dscription, etc.)
    - [x] Python script for exporting POs from SAP (`export_po_from_sap.py`)
  - [ ] Printing (future enhancement)
    - [ ] Add print functionality for labels/documents
    - [ ] Abstract print provider for later Zebra/Honeywell integration
  - [x] Status and transactions
    - [x] Mark items as "Received" with bin assignment
    - [x] Write `ReceivingTransaction` with PO, item, qty, lots/serials, bin, timestamp
    - [x] Export receiving transaction logs to CSV

- Data Model Updates
  - [x] Extend `POItem`: `RemainingQty`, `RequiresLotSerial`, `Lots|Serials[]`
  - [x] Add `ReceivingTransaction` log entity

- Acceptance Criteria
  - [x] Only items on the PO can be received
  - [x] Lot/serial is mandatory when required
  - [x] Items are staged (status + bin) and transactions logged

### 2. Inventory Control (Count now, fix scattered stock)
- Tasks
  - [x] Cycle Count fast-start
    - [x] Start by scanning a bin (or pick from task list)
    - [x] Scan item → enter counted qty → compute variance
    - [x] Commit variance to bin inventory; log transaction
    - [x] Allow adding missing items to a bin during count
  - [x] Bin Inquiry (visibility first)
    - [x] Scan any bin and display items with Qty, Lot/Serial
    - [x] CTA: "Start count on this bin"
  - [x] Transaction Log Export
    - [x] Export receiving transaction logs to CSV
    - [x] Export cycle count transaction logs to CSV
    - [x] Export page with download buttons for all log types
  - [ ] Optional: Inventory Transfer (helpful during move)
    - [ ] Scan item → scan source bin → scan destination bin → enter qty → move

- Data Model Updates
  - [x] `BinLocation.Items[]` support lots/serials
  - [x] Add `CycleCountTransaction` (expected, counted, variance)
  - [ ] Add `TransferTransaction` (item, source, dest, qty)

- Acceptance Criteria
  - [x] Can initiate counts by scanning bins
  - [x] Variances update inventory and are logged
  - [x] Bin Inquiry shows item, lot/serial, qty accurately
  - [x] Transaction logs can be exported for audit purposes

---

## Phase 2 — Putaway (Directed)
- Tasks
  - [ ] Create `Putaway` module
    - [ ] Start by scanning item or bin
    - [ ] Show system-suggested destination (primary/nearest/empty heuristic)
    - [ ] Require destination bin scan to confirm
    - [ ] Log putaway transaction, move inventory from staging

- Data Model Updates
  - [ ] `PutawayTask` (optional) to pre-generate directed moves
  - [ ] Putaway transaction log

- Acceptance Criteria
  - [ ] Item/bin scan starts a putaway
  - [ ] Destination confirmation requires bin scan
  - [ ] Inventory moved out of staging and transactions recorded

---

## Phase 3 — Picking (Guided with scan validation)
- Tasks
  - [ ] Task selection (SO/Wave)
  - [ ] Directed path (bin sequence by strategy)
  - [ ] Enforce scan order: bin → item → qty
  - [ ] Carton assignment before shipping
  - [ ] Progress and short-pick handling

- Data Model Updates
  - [ ] `Carton`/`ShipmentContainer` entity
  - [ ] Pick transaction log (bin, item, qty)

- Acceptance Criteria
  - [ ] Users must scan correct bin and item before qty entry
  - [ ] Carton assigned to contents and persisted

---

## Phase 4 — Shipping (Verification + Docs)
- Tasks
  - [ ] Load audit: verify orders/waves
  - [ ] Carton verification by scan
  - [ ] Ship confirmation; generate BOL/labels (stub → printer integration)

- Data Model Updates
  - [ ] Shipment entity (status, cartons, carrier info)
  - [ ] Shipping transactions

- Acceptance Criteria
  - [ ] Shipment only confirmable after all cartons verified
  - [ ] BOL/labels produced and archived

---

## Phase 5 — Platform & Integration
- Tasks
  - [ ] Scanner SDK integration (Zebra/Honeywell) for industrial devices
  - [ ] REST API sync layer (online-first with offline queue)
  - [ ] Audit trail export (CSV/API)
  - [ ] Role-based access and per-module permissions

- Acceptance Criteria
  - [ ] Reliable scanning performance on target devices
  - [ ] Real-time sync (with retry) and auditability

---

## Cutover Checklist (Short Term)
- [x] Seed test POs, items, bins (include `STAGING`)
- [x] PO file upload and server-based storage in `/data/pos/`
- [x] SAP Business One PO export integration
- [x] Add lot/serial capture modal
- [x] Mark items as staged on receive completion (with bin assignment)
- [x] Add scan-to-start Cycle Count and Bin Inquiry
- [x] Remove License Plate (LP) feature - simplified to direct item tracking
- [x] Remove scan verification from receiving (items don't have barcodes)
- [x] Add numpad for quantity entry
- [x] Transaction log export functionality

---

## Milestone Targets
- Milestone A: ✅ Receiving + Inventory (Cycle Count, Bin Inquiry) usable end-to-end - **COMPLETE**
- Milestone B: Putaway live, removes staging backlog
- Milestone C: Picking with scan validation + carton assignment
- Milestone D: Shipping verification + documents
- Milestone E: Device SDK + Sync layer


