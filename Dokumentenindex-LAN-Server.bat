<# : batch header
@echo off
chcp 65001 >nul 2>&1
title TeamFlow - LAN Dokumentenindex-Server
set "BATDIR=%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -Command "& ([ScriptBlock]::Create((Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8)))"
echo.
echo   LAN-Server wurde beendet. Fenster kann geschlossen werden.
echo.
pause >nul
exit /b
: end batch #>

# ====== PowerShell-Code ======

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# --- Download-Funktion mit Fortschrittsanzeige ---
function Download-WithProgress {
    param([string]$Url, [string]$OutFile)
    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.UserAgent = 'TeamFlow/1.0'
    $resp = $req.GetResponse()
    $totalBytes = $resp.ContentLength
    $totalMB = [math]::Round($totalBytes / 1MB, 0)
    $stream = $resp.GetResponseStream()
    $fs = [System.IO.File]::Create($OutFile)
    $buffer = New-Object byte[] 65536
    $downloaded = 0
    $lastPct = -1
    while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $fs.Write($buffer, 0, $read)
        $downloaded += $read
        if ($totalBytes -gt 0) {
            $pct = [math]::Floor($downloaded * 100 / $totalBytes)
            if ($pct -ne $lastPct) {
                $lastPct = $pct
                $dlMB = [math]::Round($downloaded / 1MB, 0)
                $filled = [math]::Floor($pct / 2.5)
                $empty = 40 - $filled
                $bar = ('=' * $filled) + (' ' * $empty)
                Write-Host ("`r        [{0}] {1}% - {2}/{3} MB" -f $bar, $pct, $dlMB, $totalMB) -NoNewline
            }
        }
    }
    $fs.Close(); $stream.Close(); $resp.Close()
    Write-Host ''
}

# --- Pfade ---
$BaseDir = ($env:BATDIR).TrimEnd('\')
$FilesDir = Join-Path $BaseDir 'dokumentenindex-dateien'
$ConfigFile = Join-Path $FilesDir 'config.json'
$ServerExe = Join-Path $FilesDir 'llama-server.exe'
$ZipFile = Join-Path $FilesDir 'llama-cpp.zip'

# --- Defaults ---
$ModelUrl = 'https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF/resolve/main/NVIDIA-Nemotron3-Nano-4B-Q4_K_M.gguf'
$ModelDatei = 'nemotron.gguf'
$KontextGroesse = 8192
$GpuLayers = 99
$Threads = 4
$Port = 9090

# --- Ordner erstellen ---
if (-not (Test-Path $FilesDir)) {
    New-Item -ItemType Directory -Path $FilesDir -Force | Out-Null
}

# --- Config erstellen falls nicht vorhanden ---
if (-not (Test-Path $ConfigFile)) {
    $defaultCfg = @'
{
  "modell_url": "https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF/resolve/main/NVIDIA-Nemotron3-Nano-4B-Q4_K_M.gguf",
  "modell_datei": "nemotron.gguf",
  "kontext_groesse": 8192,
  "gpu_layers": 99,
  "threads": 4,
  "port": 9090
}
'@
    Set-Content -Path $ConfigFile -Value $defaultCfg -Encoding UTF8
}

# --- Config laden (Hashtable-Workaround fuer PS 5.1) ---
$cfg = @{}
try {
    (ConvertFrom-Json (Get-Content $ConfigFile -Raw)).PSObject.Properties | ForEach-Object { $cfg[$_.Name] = $_.Value }
} catch {
    Write-Host '  Konfigurationsdatei konnte nicht gelesen werden.' -ForegroundColor Red
}
if ($cfg['modell_url']) { $ModelUrl = $cfg['modell_url'] }
if ($cfg['modell_datei']) { $ModelDatei = $cfg['modell_datei'] }
if ($cfg['kontext_groesse']) { $KontextGroesse = $cfg['kontext_groesse'] }
if ($cfg.ContainsKey('gpu_layers')) { $GpuLayers = $cfg['gpu_layers'] }
if ($cfg['threads']) { $Threads = $cfg['threads'] }
if ($cfg['port']) { $Port = $cfg['port'] }

$ModelFile = Join-Path $FilesDir $ModelDatei

# --- Header ---
Write-Host ''
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host '    LAN Dokumentenindex-Server' -ForegroundColor Cyan
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host ''

# --- Schritt 1: Analyseprogramm (llama.cpp) ---
$RequiredVersion = '2'
$VersionFile = Join-Path $FilesDir 'llama-version.txt'
$needsDownload = -not (Test-Path $ServerExe)
try {
    if (-not $needsDownload) {
        $installed = if (Test-Path $VersionFile) { (Get-Content $VersionFile -Raw).Trim() } else { '0' }
        if ($installed -ne $RequiredVersion) {
            Write-Host '  Neue Version verfuegbar — Update...' -ForegroundColor Yellow
            Get-ChildItem $FilesDir -Filter '*.exe' | Remove-Item -Force
            Get-ChildItem $FilesDir -Filter '*.dll' | Remove-Item -Force
            $needsDownload = $true
        }
    }
} catch { Write-Host '  Update-Pruefung uebersprungen.' -ForegroundColor DarkGray }
if ($needsDownload) {
    Write-Host '  [1/2] Lade Analyseprogramm herunter...' -ForegroundColor Yellow
    try {
        $releaseJson = Invoke-RestMethod -Uri 'https://api.github.com/repos/ggml-org/llama.cpp/releases/latest' -UseBasicParsing
        $asset = $releaseJson.assets | Where-Object { $_.name -match 'bin-win-cuda-12.*x64\.zip$' -and $_.name -notmatch 'cudart' } | Select-Object -First 1
        if (-not $asset) {
            Write-Host '  Download fehlgeschlagen: Kein passendes Paket gefunden.' -ForegroundColor Red
            Write-Host '  Bitte Internetverbindung pruefen und erneut starten.' -ForegroundColor Red
            return
        }
        Download-WithProgress $asset.browser_download_url $ZipFile
    } catch {
        Write-Host '  Download fehlgeschlagen. Bitte Internetverbindung pruefen.' -ForegroundColor Red
        return
    }

    Write-Host '        Wird eingerichtet...' -ForegroundColor DarkGray
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipFile)
        foreach ($entry in $zip.Entries) {
            $name = $entry.Name
            if ($name -eq 'llama-server.exe' -or $name -match '\.dll$') {
                $destPath = Join-Path $FilesDir $name
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destPath, $true)
            }
        }
        $zip.Dispose()
    } catch {
        Write-Host '  Einrichtung fehlgeschlagen. Bitte erneut starten.' -ForegroundColor Red
        return
    }
    Remove-Item $ZipFile -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path $ServerExe)) {
        Write-Host '  Einrichtung fehlgeschlagen. Bitte erneut starten.' -ForegroundColor Red
        return
    }
    Set-Content -Path $VersionFile -Value $RequiredVersion -Encoding UTF8
    Write-Host '        Analyseprogramm bereit.' -ForegroundColor Green
} else {
    Write-Host '  Analyseprogramm ist vorhanden.' -ForegroundColor Green
}

# --- Schritt 2: Metadaten-Modell ---
if (-not (Test-Path $ModelFile)) {
    Write-Host '  [2/2] Lade Metadaten-Modell herunter...              (einmalig, ca. 3 GB)' -ForegroundColor Yellow
    try {
        Download-WithProgress $ModelUrl $ModelFile
    } catch {
        Write-Host '  Download fehlgeschlagen. Bitte Internetverbindung pruefen.' -ForegroundColor Red
        Remove-Item $ModelFile -Force -ErrorAction SilentlyContinue
        return
    }
    $actualMB = [math]::Round((Get-Item $ModelFile).Length / 1MB, 0)
    Write-Host "        Metadaten-Modell bereit (${actualMB} MB)." -ForegroundColor Green
} else {
    $actualMB = [math]::Round((Get-Item $ModelFile).Length / 1MB, 0)
    Write-Host "  Metadaten-Modell ist vorhanden (${actualMB} MB)." -ForegroundColor Green
}

# --- LAN-IP + Ports ---
$ProxyPort = $Port + 1
$lanIPs = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -ExpandProperty IPAddress
Write-Host ''
Write-Host '  Bereit! CORS-Proxy lauscht auf allen Netzwerk-Interfaces.' -ForegroundColor Green
Write-Host ''
if ($lanIPs) {
    Write-Host '  Erreichbar unter:' -ForegroundColor Cyan
    foreach ($ip in $lanIPs) {
        Write-Host "    http://${ip}:${ProxyPort}/v1" -ForegroundColor White
    }
}
Write-Host ''
Write-Host "  LLM-Server: 127.0.0.1:${Port} (lokal)" -ForegroundColor DarkGray
Write-Host "  CORS-Proxy: 0.0.0.0:${ProxyPort} (LAN)" -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Diese Adresse in der App unter Verwaltung > Metadaten-Extraktion' -ForegroundColor DarkGray
Write-Host '  > LAN KI (Nemotron) > Server-Adresse eintragen.' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  ----------------------------------------------------' -ForegroundColor DarkGray
Write-Host '  Dieses Fenster offen lassen!' -ForegroundColor Yellow
Write-Host '  Zum Beenden: Fenster schliessen oder Strg+C' -ForegroundColor DarkGray
Write-Host '  ----------------------------------------------------' -ForegroundColor DarkGray
Write-Host ''

# --- llama.cpp auf localhost starten (Hintergrund) ---
$serverArgs = @(
    '-m', $ModelFile,
    '-c', $KontextGroesse,
    '-ngl', $GpuLayers,
    '-t', $Threads,
    '--port', $Port,
    '--host', '127.0.0.1',
    '--cache-type-k', 'q4_0',
    '--cache-type-v', 'q4_0',
    '-fa', 'on',
    '--jinja',
    '--reasoning', 'off'
)
$argString = ($serverArgs | ForEach-Object { if ($_ -match ' ') { "`"$_`"" } else { $_ } }) -join ' '
$llamaProc = Start-Process -FilePath $ServerExe -ArgumentList $argString -PassThru -NoNewWindow
Write-Host "  llama.cpp gestartet (PID $($llamaProc.Id))" -ForegroundColor DarkGray
Start-Sleep -Seconds 2

# --- CORS-Proxy (TcpListener, kein Admin noetig) ---
Write-Host "  CORS-Proxy gestartet auf Port ${ProxyPort}" -ForegroundColor DarkGray
$backendUrl = "http://127.0.0.1:${Port}"
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $ProxyPort)
$listener.Start()

try {
    while ($true) {
        if ($llamaProc.HasExited) { Write-Host '  llama.cpp beendet.' -ForegroundColor Yellow; break }
        if (-not $listener.Pending()) { Start-Sleep -Milliseconds 50; continue }
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream)
            $requestLine = $reader.ReadLine()
            if (-not $requestLine) { $client.Close(); continue }
            $parts = $requestLine -split ' '
            $method = $parts[0]
            $path = $parts[1]
            $headers = @{}
            $contentLength = 0
            while ($true) {
                $line = $reader.ReadLine()
                if ([string]::IsNullOrEmpty($line)) { break }
                $idx = $line.IndexOf(':')
                if ($idx -gt 0) {
                    $hName = $line.Substring(0, $idx).Trim()
                    $hVal = $line.Substring($idx + 1).Trim()
                    $headers[$hName] = $hVal
                    if ($hName -eq 'Content-Length') { $contentLength = [int]$hVal }
                }
            }
            $body = ''
            if ($contentLength -gt 0) {
                $buf = New-Object char[] $contentLength
                [void]$reader.Read($buf, 0, $contentLength)
                $body = [string]::new($buf)
            }

            # CORS Preflight
            if ($method -eq 'OPTIONS') {
                $resp = "HTTP/1.1 204 No Content`r`nAccess-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type, Authorization`r`nAccess-Control-Max-Age: 86400`r`nContent-Length: 0`r`n`r`n"
                $respBytes = [System.Text.Encoding]::UTF8.GetBytes($resp)
                $stream.Write($respBytes, 0, $respBytes.Length)
                $client.Close()
                continue
            }

            # Forward to llama.cpp
            $targetUrl = "${backendUrl}${path}"
            try {
                $webReq = [System.Net.HttpWebRequest]::Create($targetUrl)
                $webReq.Method = $method
                $webReq.Timeout = 120000
                if ($headers['Content-Type']) { $webReq.ContentType = $headers['Content-Type'] }
                if ($headers['Authorization']) { $webReq.Headers.Add('Authorization', $headers['Authorization']) }
                if ($body.Length -gt 0) {
                    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
                    $webReq.ContentLength = $bodyBytes.Length
                    $reqStream = $webReq.GetRequestStream()
                    $reqStream.Write($bodyBytes, 0, $bodyBytes.Length)
                    $reqStream.Close()
                }
                $webResp = $webReq.GetResponse()
                $respStream = $webResp.GetResponseStream()
                $respReader = [System.IO.StreamReader]::new($respStream)
                $respBody = $respReader.ReadToEnd()
                $respReader.Close()
                $respBytes = [System.Text.Encoding]::UTF8.GetBytes($respBody)
                $statusCode = [int]$webResp.StatusCode
                $respContentType = $webResp.ContentType
                $webResp.Close()
                $httpResp = "HTTP/1.1 ${statusCode} OK`r`nAccess-Control-Allow-Origin: *`r`nAccess-Control-Allow-Headers: Content-Type, Authorization`r`nContent-Type: ${respContentType}`r`nContent-Length: $($respBytes.Length)`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($httpResp)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                $stream.Write($respBytes, 0, $respBytes.Length)
            } catch {
                $errBody = "{`"error`": `"$($_.Exception.Message)`"}"
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errBody)
                $errResp = "HTTP/1.1 502 Bad Gateway`r`nAccess-Control-Allow-Origin: *`r`nContent-Type: application/json`r`nContent-Length: $($errBytes.Length)`r`n`r`n"
                $errHeaderBytes = [System.Text.Encoding]::UTF8.GetBytes($errResp)
                $stream.Write($errHeaderBytes, 0, $errHeaderBytes.Length)
                $stream.Write($errBytes, 0, $errBytes.Length)
            }
        } catch {} finally { $client.Close() }
    }
} finally {
    $listener.Stop()
    if (-not $llamaProc.HasExited) { $llamaProc.Kill(); Write-Host '  llama.cpp beendet.' -ForegroundColor DarkGray }
}
