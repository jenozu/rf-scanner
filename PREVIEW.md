# RF Scanner Premium Redesign Preview

This branch is an isolated UI/UX redesign experiment for RF Scanner. It does not change the production branch, production VPS, SAP connection, carrier credentials, or production data.

## Preview mode

The Vercel preview automatically enters demo mode on `.vercel.app` when `VITE_DEMO_MODE` is not explicitly set.

Demo mode:
- seeds synthetic purchase orders, sales orders, bins, inventory, cycle counts, and transactions in browser storage;
- routes the app API client to an in-browser demo adapter instead of making production API requests;
- simulates shipping and tracking numbers locally;
- blocks unsupported API operations instead of falling back to localhost or a production endpoint;
- provides a Reset demo data action in navigation.

To force demo mode in any environment:

```bash
VITE_DEMO_MODE=true
```

## Real backend mode

For an approved real deployment, explicitly disable demo mode and provide the intended backend URL:

```bash
VITE_DEMO_MODE=false
VITE_API_URL=https://approved-rf-backend.example.com/api
```

Do not set real SAP, Purolator, JWT, or warehouse credentials in frontend `VITE_*` variables. Sensitive integrations remain server-side.

## Verification

Production builds run:
1. preview isolation checks;
2. strict TypeScript verification;
3. Vite production build.

A feature-branch GitHub Actions smoke test also launches the app locally in demo mode, exercises all major navigation destinations with Playwright, checks storage and horizontal overflow, simulates a shipping action, verifies no unexpected external network requests, and captures desktop/mobile screenshots.

## Merge policy

Do not merge this branch into `main` until the redesign, workflow behavior, and backend integration strategy have been reviewed and explicitly approved.
