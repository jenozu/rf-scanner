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
