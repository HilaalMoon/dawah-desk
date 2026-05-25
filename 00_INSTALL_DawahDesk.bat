@echo off
IF "%INSTALL_LOGGING%"=="" (
    SET INSTALL_LOGGING=1
    "%~f0" %* > "%TEMP%\DawahDesk_install_log.txt" 2>&1
    EXIT /B %ERRORLEVEL%
)
setlocal

pushd "%~dp0"

echo.
echo  =======================================
echo   Dawah Desk Installer
echo  =======================================
echo.
echo If anything goes wrong, open the log file for details:
echo   %TEMP%\DawahDesk_install_log.txt
echo.

REM -- Step 1: Check for Node.js --------------------------------------------
echo Checking for Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Node.js is not installed on your computer.
    echo  Dawah Desk needs Node.js to run.
    echo.
    echo  Please install it from:
    echo    https://nodejs.org
    echo.
    echo  The download page will open in your browser now.
    echo  Once Node.js is installed, run this installer again.
    echo.
    start "" "https://nodejs.org"
    pause
    exit /b 1
)
echo Node.js found.
echo.

REM -- Step 2: Install components -------------------------------------------
echo Installing components... this may take 1-2 minutes. Please wait. > CON
echo.
cmd /c "npm.cmd install --no-audit"
if errorlevel 1 (
    echo.
    echo  Installation failed.
    echo  Please check your internet connection and try again.
    echo  If the problem continues, contact your system administrator.
    echo.
    pause
    exit /b 1
)
echo.
echo Installation complete. > CON
echo.

REM -- Step 3: Create desktop shortcut --------------------------------------
echo Creating desktop shortcut...

set "REPO_DIR=%CD%"
set "LAUNCHER=%REPO_DIR%\run-dawah-desk.bat"
set "ICO=%REPO_DIR%\Logos\Dawa-Desk-Logo-03.ico"
set "SHORTCUT=%USERPROFILE%\Desktop\DawahDesk.lnk"
set "PS_TEMP=%TEMP%\dawah-desk-shortcut.ps1"

REM Write the PowerShell script using Python.
REM SHGetFolderPathW resolves the real desktop path even when synced to OneDrive.
python -c "import os, ctypes, ctypes.wintypes; s=chr(39); buf=ctypes.create_unicode_buffer(ctypes.wintypes.MAX_PATH); ctypes.windll.shell32.SHGetFolderPathW(0,0x0000,0,0,buf); shortcut=os.path.join(buf.value,'DawahDesk.lnk'); content='try {\n    $ws = New-Object -ComObject WScript.Shell\n    $s = $ws.CreateShortcut('+s+shortcut+s+')\n    $s.TargetPath = '+s+os.environ['LAUNCHER']+s+'\n    $s.WorkingDirectory = '+s+os.environ['REPO_DIR']+s+'\n    $s.IconLocation = '+s+os.environ['ICO']+s+'\n    $s.Save()\n} catch {\n    Write-Error $_\n    exit 1\n}\n'; open(os.environ['PS_TEMP'],'w').write(content)"
if not errorlevel 1 goto ps1_written

REM Python not available -- write PS1 using individual >> appends, no parenthesised block.
echo $ws = New-Object -ComObject WScript.Shell > "%PS_TEMP%"
echo $s = $ws.CreateShortcut('%SHORTCUT%') >> "%PS_TEMP%"
echo $s.TargetPath = '%LAUNCHER%' >> "%PS_TEMP%"
echo $s.WorkingDirectory = '%REPO_DIR%' >> "%PS_TEMP%"
echo $s.IconLocation = '%ICO%' >> "%PS_TEMP%"
echo $s.Save() >> "%PS_TEMP%"

:ps1_written
powershell -NonInteractive -ExecutionPolicy Bypass -File "%PS_TEMP%"
set "PS_EXIT=%errorlevel%"
del "%PS_TEMP%" >nul 2>&1

if %PS_EXIT% neq 0 (
    echo.
    echo  Note: Could not create the desktop shortcut automatically.
    echo  You can still start Dawah Desk by opening:
    echo    run-dawah-desk.bat
    echo.
    pause
) else (
    echo Desktop shortcut created.
    echo.
)

REM -- Step 4: Open completion summary in a new window ---------------------
start "Da'wah Desk - Installation Complete" cmd /c ""%~dp0zzSUCCESSNOTE.bat""
