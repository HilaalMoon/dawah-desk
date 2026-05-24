@echo off
setlocal

cd /d "%~dp0"

echo Starting Da'wah Desk...
echo %CD%
echo.

REM Instance check -- if port 8788 is already listening, the app is already running.
netstat -ano | findstr ":8788" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo Da'wah Desk is already running. Opening browser...
    start "" "http://localhost:5152"
    exit /b 0
)

REM Start backend in this window (no separate window).
echo Starting backend...
start /b "" npm.cmd run dev:server

REM Poll /api/health every second until the backend is ready, with a 30-second timeout.
echo Waiting for backend on http://localhost:8788/api/health ...
set /a ATTEMPTS=0
:WAIT_LOOP
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 30 (
    echo ERROR: Backend did not respond within 30 seconds.
    pause
    exit /b 1
)
curl -s -f http://localhost:8788/api/health >nul 2>&1
if not errorlevel 1 goto BACKEND_READY
timeout /t 1 /nobreak >nul
goto WAIT_LOOP

:BACKEND_READY
echo Backend is ready.
echo.

REM Start frontend in this window (no separate window).
echo Starting frontend...
start /b "" npm.cmd run dev -- --host localhost --port 5152 --strictPort

REM Give Vite a moment to start, then open the browser.
timeout /t 2 /nobreak >nul
start "" "http://localhost:5152"

echo.
echo -----------------------------------------------
echo   Da'wah Desk is running.
echo   Frontend: http://localhost:5152
echo   Backend:  http://localhost:8788
echo   Close this window to stop the app.
echo -----------------------------------------------
echo.

:RUNNING
timeout /t 60 /nobreak >nul 2>&1
goto RUNNING
