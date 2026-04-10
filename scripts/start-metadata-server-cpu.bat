@echo off
echo TeamFlow Local — Metadata-Server (CPU) wird gestartet...
powershell -ExecutionPolicy Bypass -File "%~dp0start-metadata-server-cpu.ps1"
pause
