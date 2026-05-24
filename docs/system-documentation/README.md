# Da'wah Desk System Documentation

This folder is the authoritative system documentation set for the live app.

Purpose:
- document the current production baseline clearly enough for a new developer, team, or AI tool to understand, recreate, maintain, and extend the app
- preserve product rules and workflow decisions that should not be lost between iterations
- provide a stable place to update during version upgrades and major feature changes

Current documented version:
- `Da'wah Desk v1.1.8`
- last documentation refresh: `2026-05-23`

How to use this folder:
1. Read [`01-product-and-scope.md`](./01-product-and-scope.md) first.
2. Read [`02-architecture-and-modules.md`](./02-architecture-and-modules.md) for code structure.
3. Read [`03-data-model-and-state.md`](./03-data-model-and-state.md) before changing persistence, cases, bites, or sources.
4. Read [`04-user-workflows.md`](./04-user-workflows.md) before touching UX flows.
5. Read [`05-backend-ai-and-connectors.md`](./05-backend-ai-and-connectors.md) before changing retrieval, AI, translation, or external services.
6. Read [`06-operations-and-update-protocol.md`](./06-operations-and-update-protocol.md) before releases, resets, or environment changes.
7. Read [`07-installation-and-machine-setup.md`](./07-installation-and-machine-setup.md) before moving the app to another machine or Windows account.
8. Read [`08-case-export-import.md`](./08-case-export-import.md) before changing the export/import flow, file format, or import preview logic.

In-app help:
- In-app help is available from every screen via the `?` button in the top bar (added in Phase 6). It covers what the app is, a 5-step quick start, key concepts, and troubleshooting. This is the primary onboarding resource for new users.

Self-serve package status:
- `docs/self-serve-package/` is partially outdated — it predates the Phase 6 in-app help and does not reflect the current credential and data architecture. It will be reviewed and archived before the Phase 7 GitHub release. Do not distribute it to users in its current state.

Authoritative references inside the repo:
- current project plan and phase history: [`DawahDesk-ProjectPlan.md`](../../DawahDesk-ProjectPlan.md)
- current runnable scripts and app version: [`package.json`](../../package.json)

Documentation maintenance rule:
- update this folder whenever a feature changes behavior, a new integration is added, or the app version is increased
- at minimum, update:
  - this index
  - the affected section file(s)
  - the version/date note in [`06-operations-and-update-protocol.md`](./06-operations-and-update-protocol.md)
