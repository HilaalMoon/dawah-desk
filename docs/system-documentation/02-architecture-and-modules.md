# 02. Architecture And Modules

## Stack
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand for client state
- lightweight Node HTTP backend

## Frontend Structure
Main frontend code lives in [`src`](../../src).

Important folders:
- [`src/components`](../../src/components): UI components grouped by area
- [`src/services`](../../src/services): backend client and mock AI helpers
- [`src/state`](../../src/state): Zustand app store
- [`src/types`](../../src/types): domain and backend types
- [`src/data`](../../src/data): seed data and preserved mock backups

Key frontend entry points:
- [`src/App.tsx`](../../src/App.tsx): view routing and top-level orchestration
- [`src/components/layout/AppShell.tsx`](../../src/components/layout/AppShell.tsx): shell layout
- [`src/components/layout/TopBar.tsx`](../../src/components/layout/TopBar.tsx): sticky top bar and active case/search area
- [`src/components/layout/SidebarNav.tsx`](../../src/components/layout/SidebarNav.tsx): left navigation
- [`src/components/quick-assist/QuickAissistPanel.tsx`](../../src/components/quick-assist/QuickAissistPanel.tsx): lightweight text-only AI utility chat

## Backend Structure
Backend code lives in [`server`](../../server).

Important files:
- [`server/index.js`](../../server/index.js): route surface and orchestration entry
- [`server/store.js`](../../server/store.js): runtime state persistence
- [`server/defaults.js`](../../server/defaults.js): default settings, providers, connector definitions
- [`server/orchestrator.js`](../../server/orchestrator.js): source search and retrieval orchestration
- [`server/connectors.js`](../../server/connectors.js): connector registry
- [`server/quranFoundation.js`](../../server/quranFoundation.js): Quran Foundation integration
- [`server/ai`](../../server/ai): AI provider registry, adapters, and service layer

## Persistence Model
V1 uses two persistence layers:
- frontend Zustand persistence for quick local continuity
- backend runtime JSON state for saved entities and integrations

Important scope note:
- backend credentials are now expected through a local-only secrets file in the repo
- frontend local persistence remains account/profile-specific by design

Current backend runtime files (Phase 1 — Data Separation):
User data now lives outside the repo in a dedicated folder resolved dynamically via `os.homedir()`:
- `C:\Users\[username]\DawahDeskData\runtime-state.json` — main state snapshot
- `C:\Users\[username]\DawahDeskData\ops\` — append-only operation log
- `C:\Users\[username]\DawahDeskData\backups\` — rolling snapshot backups

The old `server/data/` folder remains in the repo after first run but contains only `.migrated` marker files (`runtime-state.json.migrated`, `ops.migrated/`, `backups.migrated/`). These are safe to ignore and must not be deleted. New installs with no legacy data start fresh in `DawahDeskData\` automatically.

## Recovery Model
The app now supports backend bootstrap recovery on startup.

Purpose:
- restore saved cases
- restore saved bites
- restore saved sources
- reconstruct some source records from bite traceability if earlier versions did not persist them directly

This logic is split across:
- backend bootstrap endpoint in [`server/index.js`](../../server/index.js)
- frontend bootstrap client in [`src/services/backendApi.ts`](../../src/services/backendApi.ts)
- frontend merge hydration in [`src/state/useAppStore.ts`](../../src/state/useAppStore.ts)

## Key Module Responsibilities
### App store
The Zustand store is the main client-side source of truth for:
- current view
- case draft and classification state
- active case tabs
- saved cases
- workspace bites
- selected sources
- source library
- session-only Quick AIssist messages
- translation modal state
- save review state

### Backend API client
The backend API client is responsible for:
- backend HTTP calls
- surfacing backend/model errors clearly where silent fallback would be misleading
- keeping UI code mostly unaware of transport details

### Components
Component design is feature-oriented, not purely atomic. Major flows live in focused panels:
- new case
- workspace
- save review
- case library
- sources
- settings
