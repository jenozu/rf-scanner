# Phase 2 design: one source of truth (DRAFT, awaiting owner approval)

## Problem (audit 4a, 4d, 5.1-5.3)
Receive/Pick/Home/Inventory read and write `localStorage` (about 150 call sites in 12 files). Only Setup, bin locks and Export touch the server. Server saves replace a whole file, non-atomically, with silent failures.

## Design
1. **Server writes become safe.** Atomic write (temp file + rename), one in-process write queue per file so read-modify-write cycles cannot interleave, a `revision` per collection, and 409 on a stale whole-collection save. Files stay JSON (PRD non-goal: no database yet).
2. **Operations instead of "replace everything".** New endpoints that change one thing under the write queue: append a transaction (receiving, picking, count), adjust a bin quantity by a delta, update one PO/SO line, upsert/delete one record by id. Two handhelds receiving into the same bin then add up instead of overwriting. Existing `/api/data/:key` stays for pages not yet converted.
3. **One frontend data layer.** `src/data/` with `useCollection(name)` and typed mutation functions. The server is the source of truth; memory is the cache; `localStorage` is no longer read for business data. Mutations wait for the server, show a visible error with retry, and a small sync-status indicator shows saved / saving / failed. Data refreshes on page focus and every 30 s. No offline queue yet (listed as "should have" later).
4. **Conversion order** (each step its own sub-task, app stays working): server foundation -> Receive -> Pick -> Home + Export -> Setup/Settings -> Inventory/counting (storage calls only, no restructuring; the 3,136-line file review is Phase 7) -> demo-mode backend updated alongside so the Vercel demo keeps working.
5. **Migration of existing browser data (needs your OK).** A manual admin-only "Upload this device's data" button in Settings, run on the device that holds the real data. It uploads only into collections that are empty on the server, shows a summary first, and never deletes the browser copy.
6. **Backups.** A backup script (timestamped copy of the data folder, keep last 14) plus cron instructions. I do not install it on the VPS; you do.

## Not in Phase 2
Line identity by DocNum + LineNum, over-receipt caps and scan confirmation (Phases 3-4); SAP exports (5); shipping (6); a database.

## Tests
Two-client concurrency (parallel receipts on one bin sum correctly), atomic write (interrupted write leaves the old file readable), revision conflict returns 409, migration only fills empty collections, receiving on client A visible to client B after refresh.

## Decisions needed
- Refresh: focus + 30 s polling (proposed) or manual refresh only?
- Migration: manual admin button (proposed) or automatic on first login?
- OK to write the backup script and docs while you install the cron job?
