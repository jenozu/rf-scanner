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
