# 06. Operations And Update Protocol

## Current Version
- app version: `1.1.9`
- documentation baseline date: `2026-04-18`

## How To Run Locally
Primary local launcher:
- [`_run-dawah-desk.bat`](../../_run-dawah-desk.bat)

Current launcher behavior:
- checks port 8788 before starting — if already listening, opens the browser and exits (prevents duplicate backend processes)
- starts the backend, then polls `http://localhost:8788/api/health` every second until ready (30-second timeout)
- only starts the frontend and opens the browser once the backend confirms ready
- opens `http://localhost:5152` automatically in the default browser

Shared backend credential launcher source:
- local-only secrets file: [`secrets/backend.env.local.bat`](../../secrets/backend.env.local.bat)
- setup template: [`secrets/backend.env.example.bat`](../../secrets/backend.env.example.bat)

Manual commands from the project root:
```powershell
npm.cmd run dev:server
npm.cmd run dev
```

## Core Verification Commands
Typecheck:
```powershell
npx.cmd tsc -b
```

Production verification:
```powershell
npm.cmd run verify
```

Additional useful backend checks after retrieval changes:
```powershell
node --check server/quranFoundation.js
node --check server/webFallback.js
```

## Safe Update Checklist
When changing the app:
1. Update code.
2. Run typecheck.
3. Run production verification.
4. Restart frontend and backend if routes or runtime state behavior changed.
5. Verify affected user flow manually.
6. Update this documentation folder.

## Required Documentation Update Points
Update this folder whenever any of these change:
- page or navigation structure
- major workflow behavior
- saved data shape
- connector logic
- AI provider setup
- translation behavior
- runtime persistence or recovery behavior
- version number

## Recommended Documentation Update Pattern
For a normal feature update:
- update the relevant section file
- update this file's version/date note if behavior materially changed
- update the main documentation index if a new area or file was added

For a version upgrade:
1. bump `package.json`
2. update this file
3. update the documentation index
4. note any new migration, reset, or recovery behavior
5. update the installation guide if setup, secrets, or launcher behavior changed

## Reset And Recovery Notes
Current state can live in:
- frontend persisted state
- backend runtime state
- backend operation log files
- backend snapshot backups

User data location (Phase 1 — Data Separation):
All backend user data now lives outside the repo at:
- `C:\Users\[username]\DawahDeskData\runtime-state.json` — main state snapshot
- `C:\Users\[username]\DawahDeskData\ops\` — append-only operation log
- `C:\Users\[username]\DawahDeskData\backups\` — rolling snapshot backups

The old `server/data/` location contains only `.migrated` marker files after first run and is no longer used for active data.

Important account-scope behavior:
- backend credentials are intended to be shared through the repo-local local-only launcher secret file
- frontend drafts, active tabs, and usage history remain local to each Windows/browser account because they are stored in profile-local browser storage
- saved shared records are additionally protected by backend operation files in `DawahDeskData\ops\`

If data appears missing:
1. confirm backend is running
2. confirm bootstrap recovery is still wired
3. inspect `C:\Users\[username]\DawahDeskData\runtime-state.json`
4. inspect `C:\Users\[username]\DawahDeskData\ops\` and `DawahDeskData\backups\`
5. inspect whether data was only local and never saved

## Known Operational Facts For V1
- saved cases are backend-recoverable
- saved sources are backend-recoverable when directly persisted
- some older saved sources may need reconstruction from saved bite traceability
- workspace-only unsaved changes are not guaranteed to survive resets if never saved
- shared backend state is refreshed on startup, on window focus, on visibility return, and on a short polling interval while the app is open
- deleting a saved case must succeed against backend persistence or the case can return on bootstrap recovery
- bite IDs are normalized on load/save so old duplicate IDs do not keep causing workspace UI collisions
- active AI provider health can fail independently of saved default-provider configuration
- Vertex AI currently depends on local service-account credential wiring through the launcher
- translation now depends entirely on the active AI provider/model and no longer has a separate Google Translate fallback path

## GitHub Release Process

### Repository
`https://github.com/HilaalMoon/dawah-desk`

### How to create a new release

**1. Bump the version in `package.json`**

Open `package.json` and update the `version` field:
```json
"version": "1.3.0"
```

**2. Commit the version bump**

```powershell
git add package.json
git commit -m "Da'wah Desk v1.3.0 — release"
git push origin main
```

**3. Create and push an annotated tag**

```powershell
git tag -a v1.3.0 -m "Da'wah Desk v1.3.0 — <short description>"
git push origin v1.3.0
```

**4. Create the GitHub Release**

1. Go to `https://github.com/HilaalMoon/dawah-desk/releases`
2. Click **Draft a new release**
3. Under **Choose a tag**, select the tag you just pushed (e.g. `v1.3.0`)
4. Set the release title to `Da'wah Desk v1.3.0`
5. Write release notes summarising what changed
6. Click **Publish release**

GitHub automatically generates a source zip from the tag. No manual zip step is needed.

**5. Download the zip for distribution**

On the release page, under **Assets**, GitHub provides:
- `Source code (zip)` — this is the file to send to users

Download it, verify it extracts cleanly, then distribute it.

**What users do with the zip**

Users unzip the file, open the extracted folder, and double-click `DawahDesk_install.bat`. The installer handles `npm install`, building the frontend, and creating the desktop shortcut. No manual setup steps are required beyond running the installer.

---

## Future Documentation Recommendation
When V1 is used in production for a while, add:
- a release history file
- a known issues / caveats file
- a migration log for data-shape changes
