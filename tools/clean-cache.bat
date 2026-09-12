@echo off
setlocal
echo Running Safe Cache Cleanup for Tauri Installer...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0clean-cache.ps1" -Target midikey
endlocal
