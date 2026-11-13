# Parking lot

Ideas that are not part of the current plan. Review at the end of each phase: promote, defer or drop.

- 2026-10-29: Direct SAP integration (Service Layer / DI-API) once access exists (audit "Later").
- 2026-10-29: Deeper lot/serial handling, putaway suggestions, wave-picking improvements, label printing (audit "Later").
- 2026-10-29: Replace JSON files with SQLite/Postgres if Phase 2 shows volume or concurrency problems (audit "Later").
- 2026-10-29: Split the 3,136-line inventory-page.tsx. Already scheduled inside Phase 7, kept here as a reminder not to do it earlier.

- (task 9, 2026-10-29) Root `npm audit` still reports 7 issues; every one needs a decision, none is fixable without --force:
  - `xlsx` (high, runtime, parses uploaded SAP/master files): prototype pollution + ReDoS, no fix on npm (maintainer publishes fixes only from cdn.sheetjs.com). Options: vendor SheetJS's CDN tarball, or swap library. Both are a dependency change the PRD didn't choose -> needs user decision; natural fit for Phase 3 (import rewrite). Mitigation until then: uploads are done by logged-in staff only.
  - `vite` 5 -> 8 and `vitest` 2 -> 5 (high/critical/moderate: vite, esbuild, vitest, tinypool, @vitest/mocker, vite-node): dev/build tooling only, not shipped in the production bundle. Major upgrades; do in Phase 8 or a dedicated task and re-check the build + preview workflow.
  - Server: 0 vulnerabilities after `npm audit fix` (express 4.22.3, proxy-addr 2.0.8 which fixes the critical IP-spoofing advisory relevant to `trust proxy`).
- (10.1, 2026-10-29) Bin locking is check-availability then lock (two calls): two people can both pass the check. Make /api/bins/lock re-check conflicts atomically. Also lock range comparison is text-based. Both belong to Phase 7.
- (10.2, 2026-10-29) /api/data/:key POST still lets a viewer-role user write any key. Once every page uses the ops endpoints (end of Phase 2), restrict writes there to admin/operator. Check no viewer workflow relies on writing first.
- (10.4, 2026-10-29) PO/SO ids are time-based (`po-<Date.now()>-<n>`), so the same file imported on two devices at once can create the same PO twice (the page only skips PO numbers it already sees). Phase 3: deterministic ids / server-side dedupe by SAP DocNum on import.
- (10.4, 2026-10-29) Legacy wave picking (rf_waves/rf_orders, only in sample/demo data) saves the order and then the bin in two calls; if the second fails the user is told to tell a supervisor. Fold into one server op if waves are kept (Phase 4/7), or retire the wave flow.
- (10.4, 2026-10-29) Receive/pick still have no over-receipt / over-pick cap on the server and pick clamps bin stock at zero silently (today's behavior). Phase 4.
- (10.5, 2026-10-29) Setup page: 'Initialize Sample Data' overwrites the shared inventory, bins and master with 7 sample laptops and 'Clear all data' empties the shared rf_active, each after at most one confirm dialog (audit 4l). With shared data one tap affects every device. Not changed in 10.5; see task 17.
- (10.6, 2026-10-29) inventory-page looks up the counter's name in localStorage `rf_users`, which nothing fills any more (users live on the server), so count logs record username "Unknown". Fix: keep the logged-in user's name from the login response and use it in the count log. Small; fits Phase 7.
- (10.6, 2026-10-29) "Replace master inventory" (Settings) and "Load from Server" (Setup) rebuild ALL bins from the file, discarding receipt/pick/count changes to bin quantities. Existing behavior (there is a confirm dialog on Settings), more consequential now that bins are shared. Consider a clearer warning or a "merge" mode (Phase 3/7).
- (10.6, 2026-10-29) shipping-page still sends its label requests without the login token (Phase 6, task 14); only its order loading/saving moved to the shared data layer.
- (10.6, 2026-10-29) The sync indicator and error banner (src/components/sync-status.tsx) are verified only by tsc/build and the demo smoke test. No React component tests exist (jsdom + testing-library would be new dependencies).
- (18, 2026-10-30) inventory-page has TWO blocks for sequential counting with the same condition (~lines 1426 and 2336+). The first (bare layout with an Export button, no Confirm-expected / Submit Count buttons) always returns first, so the second (toast, Confirm (expected qty), Submit Count, backspace) is unreachable dead code (~150 lines). Phase 7: pick one screen on purpose, merge the Export button, delete the other, as part of splitting this file.
- (owner, 2026-10-30) KEEP ON THE LIST, raised priority: duplicate orders from simultaneous imports and any multi-picker conflicts. The owner wants larger warehouses with multiple pickers using this tool, so these are scheduled work (tasks 11 and 12 carry the requirement), not nice-to-haves.

## Added 2026-11-06 (Phase 3/4)
- RESOLVED in 11/12: PO/SO deterministic ids + server-side dedupe by DocNum (10.4); no over-receipt/over-pick cap and silent clamp of bin stock (10.4).
- The legacy routes `POST /api/records/:key/upsert-many` and `/apply` still exist for non-order keys; orders are blocked from them. The older whole-collection writer (`/api/data/:key`, used by `saveCollection` for master/bins/sample data) can still write rf_purchase_orders/rf_sales_orders in full. Restrict it together with 10.2 (viewer writes).
- `xlsx` advisory still open (see task 9 note). Not swapped or vendored: owner decision pending.
- Lines missing from a re-import are flagged `SapClosed`, never deleted; orders missing from a whole file are untouched. Decide whether to auto-close/clean old orders (e.g. after N days with nothing open).
- Receipts are not re-checked against SAP: `max(app, SAP-derived)` means a goods receipt posted in SAP for stock the app also received can under-count open quantity. Needs a real example to tune.
- Shipping legacy wave orders (`rf_orders`) only update their own record; the shipping screen's carrier calls still carry no login token (Phase 6, task 14).
- No supervisor override for over-receipt/over-pick (kept simple on purpose). If wanted: a `supervisorOverride` flag checked against admin role, logged.
- Scan confirmation compares the scan to SAP's ItemCode. If handhelds scan a different barcode (UPC), add a barcode field to the master and compare against both.
- Short pick has no follow-up workflow (no replenishment task or supervisor list); open short lines are just visible on the line. Phase 7 candidate: "short picks" report.
- UI verified in demo mode in Chrome only; no React component tests (see 10.6 note).


## Owner decisions 2026-11-06
- DECIDED, xlsx: vendor SheetJS's fixed release (published only from cdn.sheetjs.com) into the repo, so the code behaves the same. NOT DONE YET: the build workspace cannot reach cdn.sheetjs.com (403 from the network allowlist), and npm only has 0.18.5 (the vulnerable one). Needs the release tarball supplied or the host allowed. Then: re-run `src/data/real-files-e2e.test.ts` with `RF_REAL_PO_XLSX` / `RF_REAL_SO_XLSX` before and after the swap and compare the results; record the version and update steps in `.taskmaster/docs`. Tracked as task 23. Until then the 0.18.5 advisory stays open (mitigation: uploads are by logged-in staff only).
- DECIDED, no supervisor override for over-receipt / over-pick. Over-receipt and over-pick stay hard refusals (`OVER_RECEIPT`, `OVER_PICK`). Not planned.
- DECIDED, lines missing from a re-import stay `SapClosed`, never deleted, and there is no automatic cleanup or auto-close of old orders. Supersedes the "decide whether to auto-close/clean" item above.
- DECIDED, leave the older whole-collection writer `POST /api/data/:key` as it is for now (only one person picks today). It can still write rf_purchase_orders/rf_sales_orders in full and viewer-role users can write there. Revisit with item 10.2 before a second picker is added.
- STILL ASSUMED, not confirmed against the files in this session: a blank LineNumber is SAP line 0 (see task 23 log).
