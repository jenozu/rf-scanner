## 📝 Product Requirements Document (PRD) / README: RF Scanning Tool (LISA WMS Inspired)

### 🎯 1. Project Goal

The primary goal of this project is to develop a **real-time, mobile, Radio Frequency (RF) scanning application** that provides core Warehouse Management System (WMS) functionality for Shipping, Receiving, and Inventory Control. The system must eliminate paper-based processes and ensure **99.9% inventory accuracy** by enforcing system-validated workflows based on industry best practices, as seen in professional WMS solutions like LISA WMS.

| Deliverable | Description |
| :--- | :--- |
| **RF Application** | A mobile app that runs on industrial handheld scanners (or ruggedized smartphones). |
| **Core Functions** | Receiving, Putaway, Picking, Shipping, and Inventory Control. |
| **Key Requirement** | All transactions must update the central database in **real-time**. |

***

### 🛠️ 2. Suggested Technology Stack

A modern RF scanning system requires a robust backend (the WMS logic) and a fast, reliable mobile front-end for the scanners.

| Component | Suggested Technology | Rationale |
| :--- | :--- | :--- |
| **Mobile App (Front-end)** | **React Native** or **Flutter** | Cross-platform compatibility (iOS/Android) for modern handheld scanners, faster development time, and a single codebase. |
| **Backend / WMS Logic** | **Python (Django)** or **Node.js (Express)** | Reliable and scalable framework for handling complex WMS business logic and high-volume transactions. |
| **Database** | **PostgreSQL** or **MySQL** | Robust, ACID-compliant databases necessary for reliable inventory and financial data. |
| **API/Communication** | **RESTful API** (JSON) | Standard, stateless communication layer for reliable, real-time data transfer between the mobile scanners and the WMS server. |
| **Barcoding / Hardware**| **Scanner SDK Integration** | Use the manufacturer's SDK (e.g., Zebra, Honeywell) to ensure robust and fast scanning performance within the mobile app. |

***

### ⚙️ 3. Functional Requirements (Features)

The mobile application will be structured around a Main Menu, which branches into four key functional areas.

#### A. Receiving Module (Inbound)
| Screen/Function | User Action & Requirements | LISA WMS Inspiration |
| :--- | :--- | :--- |
| **PO Lookup** | Scan/Enter **Purchase Order (PO) Number** or **Container ID**. The system displays expected items. | **Container/Manifest Tracking** |
| **Item Scan & Validation** | Scan **Item Barcode**. System verifies the item against the PO. | **System Validation** |
| **Quantity & Lot/Serial**| User enters quantity received. **Mandatory** field for capturing Lot/Batch or Serial numbers. | **Full Traceability** |
| **LP Creation/Print** | Option to print a **License Plate (LP) label** for the pallet/carton immediately upon completion. | **LP Management** |
| **Confirm Receive** | Final confirmation that updates the item's status to **'Received - Staging'**. | **Real-Time Update** |

#### B. Putaway Module (Movement)
| Screen/Function | User Action & Requirements | LISA WMS Inspiration |
| :--- | :--- | :--- |
| **LP/Item Scan** | Scan the **License Plate (LP)** or the individual item to be put away. | **Efficiency via LP** |
| **Directed Location** | The WMS logic determines and displays the **optimal destination bin** (e.g., nearest empty, primary location). | **Directed Putaway Logic** |
| **Location Confirmation** | User scans the **Destination Bin Location** barcode to confirm placement. | **Accuracy Enforcement** |

#### C. Picking Module (Outbound)
| Screen/Function | User Action & Requirements | LISA WMS Inspiration |
| :--- | :--- | :--- |
| **Task Selection** | Select or Scan a **Sales Order (SO) Number** or **Pick Wave ID**. | **Wave Picking** |
| **System Guidance** | The system directs the user through an **optimized path** (Bin 1 $\rightarrow$ Bin 2 $\rightarrow$ Bin 3). | **Directed Picking** |
| **Pick Validation** | Scan **Bin Location** $\rightarrow$ Scan **Item Barcode** $\rightarrow$ Enter **Quantity Picked**. | **Pick Strategy (FIFO/FEFO)** |
| **Carton/LP Assignment** | After picking, the system prompts the user to assign the picked items to a **Shipping Carton ID**. | **Shipping Prep** |

#### D. Inventory Control Module
| Screen/Function | User Action & Requirements | LISA WMS Inspiration |
| :--- | :--- | :--- |
| **Cycle Count** | Scan a **Bin Location** to initiate a count. Scan **Item** and enter **Count Quantity**. | **Accuracy Reconciliation** |
| **Inventory Transfer**| Scan an Item/LP $\rightarrow$ Scan **Source Bin** $\rightarrow$ Scan **Destination Bin**. | **Ad-Hoc Movement** |
| **Bin Inquiry** | Scan any **Bin Location** to display all inventory (Item, Lot, Qty, LP) currently stored there. | **Inventory Visibility** |

Okay, this is an excellent idea for visualizing the flow\! Using Mermaid, I'll create a flowchart that illustrates the connections between the different screens and modules of your RF Scanning application, heavily inspired by the LISA WMS structure.

Here's the Mermaid diagram for your RF Scanning application:

```mermaid
graph TD
    A[Main Menu] --> B{Receiving}
    A --> C{Putaway}
    A --> D{Picking}
    A --> E{Shipping}
    A --> F{Inventory Control}

    B -- "Select PO/Container" --> B1[PO Lookup / Expected Receipts]
    B1 -- "Scan Item & Qty" --> B2[Item Scan & Validation]
    B2 -- "Enter Lot/Serial" --> B3[Quantity & Lot/Serial Capture]
    B3 -- "Optional: Print Label" --> B4[LP Creation / Label Print]
    B4 -- "Confirm Receive" --> B5[Confirm & Route to Staging]
    B5 --> A

    C -- "Scan LP / Item" --> C1[LP/Item Scan for Putaway]
    C1 -- "System Suggests Bin" --> C2[Directed Location Display]
    C2 -- "Scan Dest. Bin" --> C3[Location Confirmation]
    C3 -- "Confirm Putaway" --> A

    D -- "Select Order/Wave" --> D1[Task Selection / Pick List]
    D1 -- "System Guides" --> D2[Directed Picking (Location Guidance)]
    D2 -- "Scan Bin & Item" --> D3[Pick Validation (Bin, Item, Qty)]
    D3 -- "Assign to Carton" --> D4[Carton/LP Assignment for Shipping]
    D4 -- "Complete Pick" --> A

    E -- "Scan Order/Load" --> E1[Load Audit / Verify Order]
    E1 -- "Scan LP/Carton" --> E2[LP/Carton Verification]
    E2 -- "Confirm Shipment" --> E3[Ship Confirmation & BOL Print]
    E3 --> A

    F -- "Select Function" --> F1{Inventory Sub-Menu}
    F1 -- "Start Count" --> F1A[Cycle Count (Scan Bin, Item, Qty)]
    F1 -- "Transfer Item" --> F1B[Inventory Transfer (Scan Source, Dest.)]
    F1 -- "Lookup Bin" --> F1C[Bin Inquiry (Scan Bin, View Contents)]
    F1A --> A
    F1B --> A
    F1C --> A
```

Here's a breakdown of the diagram and how to interpret it:

  * **`graph TD`**: This defines a flowchart with a top-down direction.
  * **`A[Main Menu]`**: `A` is the ID for the node, `[Main Menu]` is the text displayed in the node.
  * **`-->`**: Represents a connection or flow from one screen to another.
  * **`{}`**: Denotes a decision point or a primary module that branches into further steps.

**Explanation of Flow:**

1.  **Main Menu (A)** is the central hub.
2.  From the **Main Menu**, you can navigate to:
      * **Receiving (B)**
      * **Putaway (C)**
      * **Picking (D)**
      * **Shipping (E)**
      * **Inventory Control (F)**
3.  Each of these primary modules (B, C, D, E, F) then details its specific screens and the sequential flow a user would follow.
4.  After completing a process within a module (e.g., `B5[Confirm & Route to Staging]`, `C3[Location Confirmation]`), the flow typically returns to the **Main Menu (A)**, indicating the completion of a transaction or task.
5.  **Inventory Control (F)** has a sub-menu (`F1{Inventory Sub-Menu}`) because it contains multiple distinct functions (Cycle Count, Transfer, Bin Inquiry), each leading back to the Main Menu.