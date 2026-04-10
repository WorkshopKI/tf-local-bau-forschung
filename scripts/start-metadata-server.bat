@echo off
echo TeamFlow Local — Metadata-Server wird gestartet...
powershell -ExecutionPolicy Bypass -File "%~dp0start-metadata-server.ps1" %*
pause
