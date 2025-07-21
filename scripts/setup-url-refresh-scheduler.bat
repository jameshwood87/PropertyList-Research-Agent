@echo off
echo Setting up URL refresh scheduler for 3:30 AM daily...

REM Get the current directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."

REM Create the scheduled task
schtasks /create /tn "PropertyList URL Refresh" /tr "node \"%PROJECT_DIR%\scripts\scheduled-url-refresh.js\"" /sc daily /st 04:30 /f

if %ERRORLEVEL% EQU 0 (
    echo ✅ Scheduled task created successfully!
    echo 📅 Task will run daily at 4:30 AM
    echo 📁 Script location: %PROJECT_DIR%\scripts\scheduled-url-refresh.js
    echo.
    echo To view the task:
    echo   schtasks /query /tn "PropertyList URL Refresh"
    echo.
    echo To delete the task:
    echo   schtasks /delete /tn "PropertyList URL Refresh" /f
) else (
    echo ❌ Failed to create scheduled task
    echo Please run this script as Administrator
)

pause 