# RF Scanner (Marindustrial): Completion PRD

Source: `.taskmaster/docs/audit-2026-10-22.md` (audit of `main` @ `4073d33`). The audit's evidence and line references live there; this document is the scope and order we hold the work to.

## Goal
Turn the RF/WMS app from a per-device demo-grade tool into a shared, secure warehouse system: every receiving, picking and counting transaction is saved on the server and visible to every handheld, imports from SAP are exact and repeatable, and results can be exported back in SAP-ready form. Done means the MVP "must have" list below is met and verified by automated tests, not by hand.

## Non-goals (for now)
- No rewrite of the app. Fix and consolidate what exists (React/Vite frontend, Node/Express API, Docker + Traefik on the VPS).
- No direct SAP connection (Service Layer or DI-API). Staff keep importing and exporting files.
- No move from JSON files to SQLite/Postgres in this plan. Revisit only if Phase 2 shows volume or concurrency needs it.
- No new warehouse features beyond the audit (putaway suggestions, wave picking, label printing, deeper lot/serial handling). Those go to the parking lot.
- No scrubbing of git history until the open question below is answered.
- Demo mode stays as-is (Vercel demo only); it is not part of the production path.

## Success criteria (MVP "must have")
1. POs, SOs, bins, inventory and all transactions are stored on the server and identical on every device.
2. Roles are enforced by the server; no default or guessable admin; `JWT_SECRET` is required.
3. PO/SO import keeps SAP DocNum + LineNum as line identity, handles Excel dates and number formats, keeps Warehouse and Bin separate, and a re-import updates an order without losing received history.
4. Receiving and picking act on the specific line, never over-receive, and write a transaction record. Picking has scan confirmation.
5. Exports for receipts, picks/deliveries and count results are shaped for SAP and include DocNum and LineNum.
6. Server data is backed up and there is one documented deploy and restore procedure.
7. Parsers and quantity math have automated tests, and CI runs on `main` and pull requests.

## Structure (where the work lands)
- `server/index.js`: users, auth, generic data endpoints, bin locks, shipping routes (becomes per-record endpoints in Phase 2).
- `src/services/`, `src/hooks/`: data access (to be unified in Phase 2).
- `src/utils/csv-utils.ts` and `src/types/`: import parsing (Phase 3).
- `src/pages/` (receive, pick, setup, inventory, shipping, export, home): behaviour fixes per phase.
- `puro/`, `Dockerfile`, `Dockerfile.nginx`, `nginx-docker.conf`: shipping and deployment.
- `.github/workflows/`: CI.

## Dependency order and phases
Each phase ends with something observable.

- **Phase 1: Safety and baseline.** Server-side admin checks, no public `init-admin`, required `JWT_SECRET`, login rate limit and stronger passwords, corrected key allow-list, stop tracking company data, tests + CI. *Exit:* the audit's 12 hand-run checks now fail correctly and run in CI.
- **Phase 2: One source of truth.** Per-record server endpoints, atomic writes, one frontend data layer, visible sync errors, migration of browser data (with the owner's OK), nightly backup. *Exit:* receiving on one device appears on another after a refresh; clearing a browser loses nothing. Depends on Phase 1.
- **Phase 3: SAP import fidelity.** Needs real SAP XLSX exports. *Exit:* importing the same file twice gives identical results; a changed file updates open quantities. Depends on Phase 2.
- **Phase 4: Receiving and picking correctness.** Depends on Phase 3.
- **Phase 5: SAP-ready exports.** Needs the target SAP import templates from the owner. Depends on Phase 4.
- **Phase 6: Shipping.** Depends on Phase 1 only; can run any time after it, lower priority than Phases 2-5.
- **Phase 7: Counting, bins, dashboard.** Depends on Phase 2.
- **Phase 8: Deployment and documentation.** Last.

## Test strategy
Vitest for frontend utilities and parsers; API tests against the Express app for permissions and persistence; a two-client concurrency test in Phase 2. Run with `npm test` (frontend) and the server test script. CI runs build, typecheck and tests on `main` and PRs.

## Architecture and stack
Keep React + TypeScript + Vite + Tailwind, Express, JSON files in a Docker volume. Why: the audit found the structure sound; the problems are where data is saved and who may change it.

## Risks and open questions
- **Deploy risk:** requiring `JWT_SECRET` (Phase 1) will stop the API starting on the VPS if the variable is not set there. Confirm before deploying.
- **Deploy risk:** untracking `data/` must not delete data on the VPS. Check how `./data` is mounted first.
- **Open:** does the VPS `server/.env` set `JWT_SECRET`, and has the redesign been deployed?
- **Open:** scrub the public repo's history (master inventory, POs, old admin hash) or only stop tracking them going forward? History rewrite needs everyone to re-clone.
- **Open:** one real SAP XLSX export each for POs and Sales Orders (values blanked if needed), needed for Phase 3.
- **Open:** target SAP import templates (GRPO, Delivery, Inventory Counting), needed for Phase 5.

## Decision log
- 2026-10-29: Plan adopted from the 2026-10-22 audit. Phase 1 first because every later phase writes more real data through an API that currently lets any operator become admin.
- 2026-10-29: Storage stays JSON-on-disk for now (see non-goals).
