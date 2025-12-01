# Warehouse Bin Location Structure Documentation

## Overview
This document outlines the complete bin location structure used in Warehouse 01. All bin locations follow the format: **01-[BIN_CODE]**

---

## 1. SMALL PARTS AREA (Sequential Numeric System)

### Range: 01-0001 to 01-1153 AND 01-100 to 01-999

**Description:** Two aisles dedicated to small parts inventory with sequential numbering. This includes both the four-digit format (0001-1153) and the three-digit "hundreds series" (100-999).

**Formats:**
- `01-####` where #### is a 4-digit number from 0001 to 1153
- `01-###` where ### is a 3-digit number from 100 to 999

**Examples:**
- 01-0001, 01-0525, 01-1153 (four-digit format)
- 01-125, 01-435, 01-789 (three-digit format)

**Total Locations:** ~2,053 bins (1,153 + 900)

**Usage:** Small parts, fasteners, and miscellaneous items

---

## 2. STANDARD GRID AISLES (Letter-Number Grid System)

### Aisles: 1 through 7

**Format:** `01-#XYZ` where:
- `#` = Aisle number (1-7)
- `X` = Column letter (A-J, where A is column 1, J is column 10)
- `YZ` = Row number (01-10)

### Layout Description:
Each aisle has a **10 × 10 grid structure**:
- **10 Columns** (left to right): A, B, C, D, E, F, G, H, I, J
- **10 Rows** (numbered): 01, 02, 03, 04, 05, 06, 07, 08, 09, 10

### Reading a Bin Location:
**Example: 01-2F02**
- **2** = Aisle 2
- **F** = Column F (6th column from left)
- **02** = Row 2

**Example: 01-3A10**
- **3** = Aisle 3
- **A** = Column A (1st column from left)
- **10** = Row 10 (top row)

### Aisle Breakdown:

#### **Aisle 1: 01-1XYZ**
- Range: 01-1A01 to 01-1J10
- Grid: 10 columns × 10 rows = 100 locations

#### **Aisle 2: 01-2XYZ**
- Range: 01-2A01 to 01-2J10
- Grid: 10 columns × 10 rows = 100 locations

#### **Aisle 3: 01-3XYZ**
- Range: 01-3A01 to 01-3J10
- Grid: 10 columns × 10 rows = 100 locations

#### **Aisle 4: 01-4XYZ**
- Range: 01-4A01 to 01-4J09
- Grid: 10 columns × ~10 rows = ~100 locations

#### **Aisle 5: 01-5XYZ**
- Range: 01-5A to 01-5D
- Note: Some bins use simplified format (e.g., 01-5A, 01-5B)
- Grid structure present but with variations

#### **Aisle 6: 01-6XYZ**
- Range: 01-6A01 to 01-6J05
- Grid: 10 columns × varies by section
- Note: Some columns use simplified format (e.g., 01-6A, 01-6H)

#### **Aisle 7: 01-7XYZ**
- Range: 01-7A1 to 01-7B6
- Simplified format with fewer rows

---

## 3. SPECIAL AISLES WITH "0" PREFIX (High-Density Storage)

### Aisles: 02, 03, 04, 05, 06, 07, 08, 09

**Format:** `01-0#XYZ` where:
- `0#` = Aisle number with leading zero (02, 03, 04, 05, 06, 07, 08, 09)
- `X` = Column letter (A-J)
- `YZ` = Position number (02-120, varies by aisle)

### Key Difference from Standard Aisles:
The "0" prefix differentiates these from regular aisles. For example:
- **01-2F02** = Standard Aisle 2, Column F, Row 02
- **01-02F02** = Special Aisle 02, Column F, Position 02

### Layout Description:
These aisles use a **different physical layout** from standard aisles:
- **Columns (X):** Letters A-J represent positions (bottom to top OR section markers)
- **Positions (YZ):** Even numbers (02, 04, 06... up to 120) indicating specific locations
- **Navigation:** From left to right, numbers ascend; vertical position indicated by letter

### Visual Reference:
According to the provided screenshot, these aisles have:
- Letters (A-J) indicating vertical columns
- Even numbers indicating horizontal positions
- Much higher density than standard aisles (up to 120 positions)

### Aisle Breakdown:

#### **Aisle 02: 01-02XYZ**
- Range: 01-02A02 to 01-02J120
- Pattern: Letters A-J with even numbers from 02 to 120
- Example: 01-02C52, 01-02F72, 01-02H82

#### **Aisle 03: 01-03XYZ**
- Range: 01-03A02 to 01-03J120
- Pattern: Similar to Aisle 02
- Example: 01-03D40, 01-03G50, 01-03I18

#### **Aisle 04: 01-04XYZ**
- Range: 01-04A02 to 01-04J64
- Pattern: Letters A-J with even numbers, maximum ~64
- Example: 01-04B12, 01-04F26

#### **Aisle 05: 01-05XYZ**
- Range: 01-05A02 to 01-05J70
- Pattern: Letters A-J with even numbers, maximum ~70
- Example: 01-05C08, 01-05E26

#### **Aisle 06: 01-06XYZ**
- Range: 01-06A02 to 01-06J16
- Pattern: Letters A-J with even numbers, maximum ~16
- Example: 01-06B08, 01-06F14

#### **Aisle 07: 01-07XYZ**
- Range: 01-07A02 to 01-07I28
- Pattern: Letters A-I with even numbers, maximum ~48
- Example: 01-07B24, 01-07D30

#### **Aisle 08: 01-08XYZ**
- Range: 01-08A2 to 01-08I02
- Pattern: Simplified numbering
- Example: 01-08C10, 01-08E14

#### **Aisle 09: 01-09XYZ**
- Range: 01-09A04 to 01-09D22
- Pattern: Letters A-D with even numbers
- Example: 01-09B16, 01-09C24

---


## 4. SPECIALIZED LOCATION CODES

### Bulk Display (BD) Series
**Format:** `01-BD##X` where ## is a number and X is an optional letter suffix

**Examples:**
- 01-BD01, 01-BD01C
- 01-BD02A, 01-BD02B
- 01-BD03A, 01-BD03B, 01-BD03C
- 01-BD04, 01-BD04A, 01-BD04B, 01-BD04C

**Usage:** Bulk display areas, possibly for high-visibility or promotional items

### Peg Board Locations
**Format:** `01-PEG##` or `01-PEG [LETTER]`

**Examples:**
- 01-PEG A, 01-PEG B, 01-PEG C, 01-PEG D
- 01-PEG01, 01-PEG02, 01-PEG03, 01-PEG04
- 01-PEG1, 01-PEG3, 01-PEG4
- 01-PEGB, 01-PEGC
- 01-PEG TD (Tool Display)

**Usage:** Peg board displays for hanging items, tools, or packaged goods

### Cabinet Storage
**Format:** `01-CAB #`

**Examples:**
- 01-CAB 1
- 01-CAB 2

**Usage:** Cabinet storage for small or secured items

### Special Areas
- **01-FLOOR** - Floor storage area
- **01-DFLOOR** - Display floor
- **01-BACK** - Back storage area
- **01-RACKS** - General rack storage
- **01-SHOWROOM** - Showroom display
- **01-SHOPSHELF** - Shop shelf display

### Miscellaneous Codes
- **01-XXX** - Unspecified or temporary location
- **01-SYSTEM-BIN-LOCATION** - System-designated location (often for items with zero quantity or in transit)

### Alphanumeric Combinations
Various special codes exist for unique storage needs:
- 01-A-01, 01-A-02, 01-A-03
- 01-B-03, 01-B01I
- 01-C-01, 01-C-02, 01-C02/03, 01-C02J
- And many more specialized codes

---

## 5. SUMMARY OF BIN LOCATION TYPES

| **Type** | **Format** | **Example** | **Quantity Range** |
|----------|------------|-------------|-------------------|
| Small Parts (Combined) | 01-#### or 01-### | 01-0525, 01-435 | ~2,053 locations |
| Standard Aisles 1-7 | 01-#XYZ | 01-2F02 | ~700 locations |
| Special Aisles 02-09 | 01-0#XYZ | 01-03G50 | ~2,000+ locations |
| Bulk Display | 01-BD##X | 01-BD04A | ~30 locations |
| Peg Boards | 01-PEG## | 01-PEG03 | ~15 locations |
| Special Areas | 01-[NAME] | 01-FLOOR | ~20 locations |

**Total Unique Bin Locations:** Over 4,800 distinct locations

---

## 6. NAVIGATION GUIDE

### Finding Standard Grid Aisle Locations (01-#XYZ):

1. **Identify the Aisle Number** (#) - This is the first digit (1-7)
2. **Locate the Column Letter** (X) - A is leftmost, J is rightmost (columns 1-10)
3. **Find the Row Number** (YZ) - 01 is bottom row, 10 is top row

**Example: Finding 01-3D05**
- Go to **Aisle 3**
- Find **Column D** (4th column from the left)
- Locate **Row 05** (5th row from bottom)

### Finding Special "0" Prefix Aisle Locations (01-0#XYZ):

1. **Identify the Aisle Number** (0#) - This has a leading zero (02-09)
2. **Locate the Column/Section Letter** (X) - A-J
3. **Find the Position Number** (YZ) - Even numbers typically (02, 04, 06... up to 120)

**Example: Finding 01-02C52**
- Go to **Special Aisle 02**
- Find **Section/Column C**
- Locate **Position 52**

### Finding Sequential Locations (Small Parts Area):

Simply navigate to the numbered sequence in the small parts area. This includes both four-digit (01-0001 to 01-1153) and three-digit (01-100 to 01-999) formats, all located in the same two-aisle section.

---

## 7. BEST PRACTICES

1. **Always include the "01-" prefix** when documenting bin locations
2. **Use uppercase letters** for column designations (A-J)
3. **Use leading zeros** for row numbers in grid aisles (01, 02, not 1, 2)
4. **Distinguish between regular and "0" prefix aisles** - 01-2F02 ≠ 01-02F02
5. **Verify aisle type** before navigation - standard grid vs. high-density special aisles

---

## 8. MAINTENANCE AND UPDATES

This document reflects the current bin location structure as of the inventory snapshot. Any additions or modifications to the warehouse layout should be documented and this guide updated accordingly.

For questions or clarifications regarding specific bin locations, please consult the warehouse management system or warehouse supervisor.

---

**Document Version:** 1.0  
**Last Updated:** November 30, 2025  
**Warehouse:** 01

