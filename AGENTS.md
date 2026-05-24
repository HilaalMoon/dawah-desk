# AGENTS.md

## Project identity
This repository is **Da'wah Desk v1.1.9** — a desktop-first productivity workspace for Muslim da'ees.

It is **not** a generic Islamic chatbot and **not** a fatwa bot.

Read `docs/` for full system documentation before making changes. Start with `docs/README.md`.

---

## Non-negotiable product rules
These must remain true unless the product owner explicitly changes them.

1. Confidence is the primary value; speed serves confidence.
2. The app is case-based, not file-based.
3. Similar saved cases must be checked before deep source search.
4. Translation is optional and user-invoked only.
5. Saved outputs are English only.
6. Responses may be split into multiple short logical bites.
7. Sources, translations, AI summaries, and weak-support content must remain visually distinct.
8. AI proposes; the human validates where trust matters.
9. Do not collapse the app into a chatbot-first experience.
10. Preserve clear traceability between response bites and source support.

---

## Current stack
- React 18 + TypeScript + Vite
- Tailwind CSS
- Zustand for client state
- Lightweight Node.js HTTP backend (port 8788)
- Frontend dev port: 5152
- Vertex AI (Gemini on Vertex) as default AI provider
- Quran Foundation as primary live connector
- Approved-domain fallback adapters for Quran.com and Sunnah.com

---

## Current app areas
- Home
- New Case
- Workspace
- Case Library
- Sources
- Quick AIssist
- Settings

---

## Architecture summary
- Frontend: `src/`
- Backend: `server/`
- Persistence: `%USERPROFILE%\DawahDeskData\` (outside the repo — user data folder resolved dynamically via `os.homedir()`) containing `runtime-state.json`, `ops/`, and `backups/`
- Credentials: `secrets/backend.env.local.bat` (local only, never commit)
- Launcher: `_run-dawah-desk.bat`

Full details in `docs/02-architecture-and-modules.md`.

---

## CRITICAL — User data protection
**This is the most important constraint for autonomous operation.**

The following are user-generated and must never be overwritten, reset, deleted, or modified by code changes:

- `%USERPROFILE%\DawahDeskData\runtime-state.json` (e.g. `C:\Users\hatem\DawahDeskData\runtime-state.json`)
- `%USERPROFILE%\DawahDeskData\ops\` (all files)
- `%USERPROFILE%\DawahDeskData\backups\` (all files)
- `secrets/` (all files)

These contain each user's saved cases, response bites, and sources — the core value of the app for each individual user. The user data folder lives outside the repo at `os.homedir()/DawahDeskData/` and is resolved dynamically by `server/store.js`. Different users will have completely different libraries. No feature, migration, or refactor should ever touch or reset these files.

The legacy `server/data/` folder may contain `.migrated` marker files after Phase 1 migration. Do not delete them.

If a data shape migration is needed:
- write a migration script that transforms existing data non-destructively
- never replace or overwrite existing runtime-state.json with defaults or seed data
- always confirm with the product owner before any migration that touches saved data

---

## What Claude Code may do freely
- Add new features to any area of the app
- Refactor frontend components and backend routes
- Add new connectors or AI provider adapters
- Improve UI, UX, and layout
- Add new settings, filters, or workflow steps
- Extend types and state
- Improve error handling and loading states
- Update documentation in `docs/` to reflect changes

---

## What Claude Code must not do without explicit instruction
- Never hardcode Windows system folder paths. Paths like Desktop, Documents, AppData, and Temp vary by machine configuration and OneDrive setup. Always resolve them at runtime using the appropriate Windows API, environment variable, or shell method rather than constructing them by string concatenation from %USERPROFILE% or C:\Users\.
- Modify or delete anything in `%USERPROFILE%\DawahDeskData\` or `server/data/`
- Modify or delete anything in `secrets/`
- Reset or replace runtime state with seed or default data
- Remove the backend bootstrap recovery system
- Remove human validation steps from classification or save flows
- Collapse workspace/sources/library into a single chat-style interface
- Make translation automatic or default
- Remove the visual distinction between source types and support statuses
- Commit secrets or credentials

---

## Engineering rules
- Keep code modular and readable
- Prefer practical maintainability over clever abstractions
- Separate: types, services, state, and UI components
- Surface real errors — do not silently fall back to mock output
- Leave clear integration hooks for future real-backend or hosted deployment
- Run `npx.cmd tsc -b` after changes to verify no type errors
- Run `npm.cmd run verify` for production verification

---

## Safe update checklist (follow after any change)
1. Run typecheck: `npx.cmd tsc -b`
2. Run production verification: `npm.cmd run verify`
3. Restart frontend and backend if routes or runtime state behavior changed
4. Verify affected user flow manually
5. Update `docs/` to reflect any behavior change

---

## Documentation maintenance rule
Update `docs/` whenever a feature changes behavior, a new integration is added, or the app version changes. At minimum update the affected section file and the version/date note in `docs/06-operations-and-update-protocol.md`.
