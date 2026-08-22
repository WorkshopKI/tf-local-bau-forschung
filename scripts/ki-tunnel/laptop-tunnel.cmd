@echo off
setlocal
rem ===================================================================
rem  TeamFlow - Tunnel zur internen KI
rem
rem  LAEUFT AUF DEM FIRMENLAPTOP, nicht auf der Dev-Maschine.
rem  Diese Datei einmal auf den Laptop kopieren und per Doppelklick
rem  starten, solange das VPN steht. Sie installiert nichts und braucht
rem  keine Admin-Rechte - ssh.exe ist in Windows enthalten, und der
rem  Laptop baut ausschliesslich eine AUSGEHENDE Verbindung auf.
rem
rem  Weitergeleitet wird genau ein Ziel: gpt.vdivde-it.de:443.
rem  Kein SOCKS, kein allgemeiner Weg ins Firmennetz.
rem
rem  Anleitung + Fehlersuche: docs/architecture/ki-tunnel-dev.md
rem ===================================================================

rem --- Anzupassen, wenn sich die Adresse der Dev-Maschine aendert. ---
rem Die IP kommt dort per DHCP. Aendert sie sich, zeigt diese Zeile ins
rem Leere und ssh meldet "Connection timed out". Im Router reservieren
rem oder hier nachziehen.
set ZIEL=tom@192.168.2.125
set KI_HOST=gpt.vdivde-it.de

title TeamFlow KI-Tunnel  --^>  %ZIEL%

echo.
echo   TeamFlow - Tunnel zur internen KI
echo   ---------------------------------
echo   Ziel        : %ZIEL%
echo   Weiterleitung: %KI_HOST%:443  ist auf der Dev-Maschine 127.0.0.1:443
echo.
echo   Fenster offen lassen. Strg+C beendet den Tunnel.
echo.

:schleife
echo [%time:~0,8%] verbinde ...

rem ExitOnForwardFailure ist der wichtigste Schalter: ohne ihn kommt die
rem SSH-Sitzung zustande, waehrend die Weiterleitung still scheitert
rem (Port belegt). Das Ergebnis waere eine lebende Verbindung mit totem
rem Tunnel - der Fehler faellt dann erst in der App auf, als "die KI
rem antwortet nicht". Mit dem Schalter bricht ssh sofort sichtbar ab.
rem
rem ServerAlive* erkennt einen abgerissenen Link (VPN-Neuaufbau,
rem Standby), statt in einer Zombie-Sitzung haengen zu bleiben.
ssh -N ^
    -o ExitOnForwardFailure=yes ^
    -o ServerAliveInterval=30 ^
    -o ServerAliveCountMax=3 ^
    -R 443:%KI_HOST%:443 ^
    %ZIEL%

echo [%time:~0,8%] Verbindung beendet (Code %errorlevel%). Neuer Versuch in 5 s.
timeout /t 5 /nobreak >nul
goto schleife
