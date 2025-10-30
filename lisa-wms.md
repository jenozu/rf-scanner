## LISA WMS Master Task List

### Scope and Approach
- This roadmap is organized into phases with actionable tasks and subtasks.
- Immediate adoption workstreams are prioritized first: Receiving (PO-based) and Inventory Control (Cycle Counting + Bin Inquiry).
- Each phase includes dependencies and acceptance criteria to keep implementation verifiable.

---

## Phase 1 — Immediate Adoption Workstreams

### 1. Receiving (PO-based, auditable)
- Tasks
  - [ ] Implement PO lookup and line presentation
    - [ ] Scan/enter PO or container to load expected lines with remaining qty
    - [ ] Show line status, remaining qty, target bin (if available)
  - [ ] Enforce scan-to-validate against PO line
    - [ ] Block receiving if scanned item not on PO
    - [ ] Show helpful error and quick search for close matches
  - [ ] Quantity + Lot/Serial capture
    - [ ] Modal to enter qty (default = remaining)
    - [ ] Mandatory lot/serial capture when flagged on item/PO line
    - [ ] Support multiple serials and lot attributes (code, mfg/exp dates if provided)
  - [ ] LP creation and staging
    - [ ] Generate LP ID on line/PO completion
    - [ ] Attach received lines to LP
    - [ ] Assign default `STAGING` bin (configurable)
  - [ ] Printing (stub first)
    - [ ] Add "Print LP" action (stub via PDF/download)
    - [ ] Abstract print provider for later Zebra/Honeywell integration
  - [ ] Status and transactions
    - [ ] Mark items as "Received - Staging"
    - [ ] Write `ReceivingTransaction` with PO, item, qty, lots/serials, LP, bin, timestamp

- Data Model Updates
  - [ ] Extend `POItem`: `RemainingQty`, `RequiresLotSerial`, `Lots|Serials[]`
  - [ ] Add `LicensePlate`: `lpId`, `items[]`, `createdAt`, `binCode`, `labels[]`
  - [ ] Add `ReceivingTransaction` log entity

- Acceptance Criteria
  - [ ] Only items on the PO can be received
  - [ ] Lot/serial is mandatory when required
  - [ ] LP is created on completion and tied to received items
  - [ ] Items are staged (status + bin) and transactions logged

### 2. Inventory Control (Count now, fix scattered stock)
- Tasks
  - [ ] Cycle Count fast-start
    - [ ] Start by scanning a bin (or pick from task list)
    - [ ] Scan item → enter counted qty → compute variance
    - [ ] Commit variance to bin inventory; log transaction
    - [ ] Allow adding missing items to a bin during count
  - [ ] Bin Inquiry (visibility first)
    - [ ] Scan any bin and display items with Qty, Lot/Serial, LPs
    - [ ] CTA: "Start count on this bin"
  - [ ] Optional: Inventory Transfer (helpful during move)
    - [ ] Scan item/LP → scan source bin → scan destination bin → enter qty → move

- Data Model Updates
  - [ ] `BinLocation.Items[]` support lots/serials and LP links
  - [ ] Add `CycleCountTransaction` (expected, counted, variance)
  - [ ] Add `TransferTransaction` (item/LP, source, dest, qty)

- Acceptance Criteria
  - [ ] Can initiate counts by scanning bins
  - [ ] Variances update inventory and are logged
  - [ ] Bin Inquiry shows item, lot/serial, LP, qty accurately

---

## Phase 2 — Putaway (Directed, LP-first)
- Tasks
  - [ ] Create `Putaway` module
    - [ ] Start by scanning LP or item
    - [ ] Show system-suggested destination (primary/nearest/empty heuristic)
    - [ ] Require destination bin scan to confirm
    - [ ] Log putaway transaction, move inventory from staging

- Data Model Updates
  - [ ] `PutawayTask` (optional) to pre-generate directed moves
  - [ ] Putaway transaction log

- Acceptance Criteria
  - [ ] LP/item scan starts a putaway
  - [ ] Destination confirmation requires bin scan
  - [ ] Inventory moved out of staging and transactions recorded

---

## Phase 3 — Picking (Guided with scan validation)
- Tasks
  - [ ] Task selection (SO/Wave)
  - [ ] Directed path (bin sequence by strategy)
  - [ ] Enforce scan order: bin → item → qty
  - [ ] Carton/LP assignment before shipping
  - [ ] Progress and short-pick handling

- Data Model Updates
  - [ ] `Carton`/`ShipmentContainer` entity
  - [ ] Pick transaction log (bin, item, qty)

- Acceptance Criteria
  - [ ] Users must scan correct bin and item before qty entry
  - [ ] Carton/LP assigned to contents and persisted

---

## Phase 4 — Shipping (Verification + Docs)
- Tasks
  - [ ] Load audit: verify orders/waves
  - [ ] LP/Carton verification by scan
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
- [ ] Seed test POs, items, bins (include `STAGING`)
- [ ] Enable scan-to-validate on Receiving lines
- [ ] Add lot/serial capture modal
- [ ] Create LP on receive completion; mark items as staged
- [ ] Add scan-to-start Cycle Count and Bin Inquiry

---

## Milestone Targets
- Milestone A: Receiving + Inventory (Cycle Count, Bin Inquiry) usable end-to-end
- Milestone B: Putaway (LP-first) live, removes staging backlog
- Milestone C: Picking with scan validation + carton assignment
- Milestone D: Shipping verification + documents
- Milestone E: Device SDK + Sync layer


