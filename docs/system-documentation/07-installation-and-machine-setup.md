# Da'wah Desk — Installation & Machine Setup

**Applies to:** Da'wah Desk v1.1.9 and later  
**Last updated:** May 2026

---

## Overview

Da'wah Desk is installed by running a single batch file. The installer handles all technical steps automatically. Non-technical users need no command-line interaction.

---

## What the installer does

`DawahDesk_install.bat` performs the following steps in order:

1. **Checks for Node.js** — if not installed, opens the Node.js download page and exits with a clear message. The user installs Node.js and re-runs the installer.
2. **Runs `npm install`** — downloads and installs all app components. Requires an internet connection. Takes about a minute.
3. **Creates a desktop shortcut** — uses the Windows Shell API (`SHGetFolderPathW`) to locate the correct desktop folder, even when the desktop is synced to OneDrive. The shortcut is named `DawahDesk` and uses the app icon.
4. **Opens a completion window** (`zzSUCCESSNOTE.bat`) — a friendly summary confirming success and explaining how to start the app. This window only appears if all previous steps completed without error.

The installer does **not** launch the app. The user starts the app using the desktop shortcut.

---

## Installation log

Every installer run writes a full log to:

```
%TEMP%\DawahDesk_install_log.txt
```

On a typical machine this resolves to:

```
C:\Users\[username]\AppData\Local\Temp\DawahDesk_install_log.txt
```

If the installer closes unexpectedly, open this file for a complete record of what happened.

---

## First-run credential setup

The first time the app opens it shows a credential setup screen. The user pastes the full contents of the Vertex AI service account JSON file provided by the system administrator and clicks **Save and open Da'wah Desk**.

Credentials are stored at:

```
%USERPROFILE%\DawahDeskData\credentials.json
%USERPROFILE%\DawahDeskData\vertex-service-account.json
```

The setup screen does not reappear after credentials are saved. They survive app updates.

**To update credentials:** delete both files above and restart the app — the setup screen reappears.

---

## Starting the app after installation

Double-click the **DawahDesk** shortcut on the desktop.

The shortcut launches `_CCode_run-dawah-desk.bat` in the repo folder. This starts the backend and opens the frontend in the default browser.

---

## Files delivered by the installer

| File | Purpose |
|------|---------|
| `DawahDesk_install.bat` | One-click installer — run once to set up the app |
| `zzSUCCESSNOTE.bat` | Completion summary window — launched automatically by the installer on success |
| `INSTALL.txt` | Plain-English 4-step guide for non-technical users |

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Windows 10 or later | Required |
| Node.js (latest LTS) | Installer checks and opens download page if missing |
| Internet connection | Required for `npm install` step only |
| Credential file | Provided by system administrator — needed on first run |

---

## Troubleshooting

**Installer window closes immediately with no output**
- Open `%TEMP%\DawahDesk_install_log.txt` to see the full output.
- If the log file does not exist, the installer did not execute at all. Right-click the file → Properties → check for an **Unblock** option at the bottom (Windows security block on downloaded files).

**npm install fails**
- Check internet connection and try again.
- If on a corporate network, a proxy may be blocking npm. Contact your IT department.

**Desktop shortcut not created**
- The installer will show a note and suggest running `_CCode_run-dawah-desk.bat` directly from the repo folder instead.
- The shortcut can be created manually: right-click `_CCode_run-dawah-desk.bat` → Send to → Desktop (create shortcut).

**App opens but shows credential setup screen unexpectedly**
- This means `DawahDeskData\credentials.json` is missing or was deleted. Paste the credential JSON again to proceed.

---

## Manual setup (advanced / troubleshooting)

If the installer cannot be used, the app can be set up manually:

1. Install Node.js from https://nodejs.org
2. Open a command prompt in the repo folder
3. Run `npm install`
4. Double-click `_CCode_run-dawah-desk.bat` to launch the app
5. Complete the credential setup screen on first run

---

## Distributing to new users (system administrator)

1. Provide the user with the repo zip (from GitHub Releases — see Phase 4 docs).
2. Instruct the user to unzip and double-click `DawahDesk_install.bat`.
3. Send the user their Vertex AI service account JSON file separately — never include it in the zip.
4. Direct the user to `INSTALL.txt` inside the zip for step-by-step guidance.
