<# : batch header
@echo off
chcp 65001 >nul 2>&1
title TeamFlow - Dokumentenindex aktualisieren
set "BATDIR=%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -Command "& ([ScriptBlock]::Create((Get-Content -LiteralPath '%~f0' -Raw)))"
pause
exit /b
: end batch #>

# ====== PowerShell-Code ======

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# --- Download-Funktion mit Fortschrittsanzeige ---
function Download-WithProgress {
    param([string]$Url, [string]$OutFile)
    $wc = New-Object System.Net.WebClient
    $done = $false
    $timer = $null
    $lastPct = -1
    Register-ObjectEvent $wc DownloadProgressChanged -Action {
        $script:dlPct = $EventArgs.ProgressPercentage
        $script:dlMB = [math]::Round($EventArgs.BytesReceived / 1MB, 0)
        $script:dlTotalMB = [math]::Round($EventArgs.TotalBytesToReceive / 1MB, 0)
    } | Out-Null
    Register-ObjectEvent $wc DownloadFileCompleted -Action {
        $script:done = $true
    } | Out-Null
    $wc.DownloadFileAsync((New-Object System.Uri($Url)), $OutFile)
    while (-not $done) {
        Start-Sleep -Milliseconds 500
        if ($null -ne $dlPct -and $dlPct -ne $lastPct) {
            $lastPct = $dlPct
            $filled = [math]::Floor($dlPct / 2.5)
            $empty = 40 - $filled
            $bar = ('=' * $filled) + (' ' * $empty)
            Write-Host ("`r        [{0}] {1}% — {2}/{3} MB" -f $bar, $dlPct, $dlMB, $dlTotalMB) -NoNewline
        }
    }
    Write-Host ''
    Get-EventSubscriber | Where-Object { $_.SourceObject -eq $wc } | Unregister-Event
    $wc.Dispose()
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
$Port = 8081

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
  "port": 8081
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
Write-Host '    TeamFlow Local - KI-Dokumentenanalyse' -ForegroundColor Cyan
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host ''

# --- Schritt 1: Analyseprogramm (llama.cpp) ---
if (-not (Test-Path $ServerExe)) {
    Write-Host '  [1/2] Lade Analyseprogramm herunter...        (einmalig)' -ForegroundColor Yellow
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
        $targets = @('llama-server.exe', 'llama.dll', 'ggml.dll', 'ggml-base.dll', 'ggml-cuda.dll')
        foreach ($entry in $zip.Entries) {
            $name = $entry.Name
            if (($targets -contains $name) -or ($name -match '^ggml-cpu-.*\.dll$')) {
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
    Write-Host '        Analyseprogramm bereit.' -ForegroundColor Green
} else {
    Write-Host '  Analyseprogramm ist vorhanden.' -ForegroundColor Green
}

# --- Schritt 2: KI-Modell ---
if (-not (Test-Path $ModelFile)) {
    Write-Host '  [2/2] Lade KI-Modell herunter...              (einmalig, ca. 3 GB)' -ForegroundColor Yellow
    try {
        Download-WithProgress $ModelUrl $ModelFile
    } catch {
        Write-Host '  Download fehlgeschlagen. Bitte Internetverbindung pruefen.' -ForegroundColor Red
        Remove-Item $ModelFile -Force -ErrorAction SilentlyContinue
        return
    }
    $actualMB = [math]::Round((Get-Item $ModelFile).Length / 1MB, 0)
    Write-Host "        KI-Modell bereit (${actualMB} MB)." -ForegroundColor Green
} else {
    $actualMB = [math]::Round((Get-Item $ModelFile).Length / 1MB, 0)
    Write-Host "  KI-Modell ist vorhanden (${actualMB} MB)." -ForegroundColor Green
}

# --- Bereit ---
Write-Host ''
Write-Host '  Bereit! Wechsle jetzt zu TeamFlow' -ForegroundColor Green
Write-Host '  und starte die Indexierung.' -ForegroundColor Green
Write-Host ''
Write-Host '  ----------------------------------------------------' -ForegroundColor DarkGray
Write-Host '  Dieses Fenster offen lassen!' -ForegroundColor Yellow
Write-Host '  Zum Beenden: Fenster schliessen oder Strg+C' -ForegroundColor DarkGray
Write-Host '  ----------------------------------------------------' -ForegroundColor DarkGray
Write-Host ''

# --- Server starten ---
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
    '--jinja'
)
& $ServerExe @serverArgs
