@echo off
setlocal

rem ---------------------------------------------------------------
rem  Family Calendar (Kazoku Calendar) - launcher for Windows
rem  Japanese instructions: see README.md
rem  This file is intentionally written in ASCII only, because
rem  cmd.exe mis-parses some multi-byte characters in batch files.
rem ---------------------------------------------------------------

rem Use the folder that contains this file as the working folder
cd /d "%~dp0"

echo ==========================================
echo   Family Calendar / kazoku calendar
echo ==========================================
echo.

rem --- Check Node.js and npm --------------------------------------
where node >nul 2>&1
if errorlevel 1 goto NO_NODE

where npm >nul 2>&1
if errorlevel 1 goto NO_NODE

for /f "delims=" %%v in ('node -v') do echo Node.js: %%v
echo.

rem --- Install dependencies on first run ---------------------------
if not exist "node_modules" (
    echo First run: installing dependencies. This may take a few minutes...
    echo.
    call npm install
    if errorlevel 1 goto INSTALL_FAILED
    echo.
)

rem --- Start the Vite dev server in a separate window ---------------
echo Starting the dev server...
start "Family Calendar dev server" cmd /k "npm run dev"

echo Waiting for the server to start...
timeout /t 6 /nobreak >nul

start "" "http://localhost:5173/family-calendar/"

echo.
echo ------------------------------------------
echo  The app should now be open in your browser.
echo  If not, open this URL manually:
echo.
echo      http://localhost:5173/family-calendar/
echo.
echo  To stop the app, close the window titled
echo  "Family Calendar dev server".
echo ------------------------------------------
echo.
pause
exit /b 0

:NO_NODE
echo.
echo [ERROR] Node.js or npm was not found.
echo.
echo   Please install Node.js from https://nodejs.org/
echo   then restart your PC and try again.
echo.
pause
exit /b 1

:INSTALL_FAILED
echo.
echo [ERROR] "npm install" failed.
echo.
echo   Please check your internet connection and the
echo   messages shown above, then try again.
echo.
pause
exit /b 1
