<# : batch header
@echo off
chcp 65001 >nul 2>&1
title TeamFlow - Dokumentenindex aktualisieren
set "BATDIR=%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -Command "& ([ScriptBlock]::Create((Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8)))"
echo.
echo   Dokumentenindex aktualisieren wurde beendet. Fenster kann geschlossen werden.
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
$BackendMarker = Join-Path $FilesDir '.backend'

# --- Defaults ---
$ModelUrl = 'https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF/resolve/main/NVIDIA-Nemotron3-Nano-4B-Q4_K_M.gguf'
$ModelDatei = 'nemotron.gguf'
$KontextGroesse = 8192
$GpuLayers = 99
$Threads = 4
$Port = 9090
$BatchSize = $null
$UBatchSize = $null
$NParallel = $null
$Backend = 'vulkan'
$ResolvedBackend = $null
$NCpuMoe = $null
$CacheK = 'q4_0'
$CacheV = 'q4_0'
$FlashAttn = $true
$Reasoning = 'off'
$ExtraArgs = @()
$AutoUpdate = $true

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
  "kontext_groesse": 32768,
  "gpu_layers": 99,
  "threads": 4,
  "batch_size": 2048,
  "ubatch_size": 2048,
  "n_parallel": 4,
  "port": 9090,
  "backend": "vulkan"
}
'@
    Set-Content -Path $ConfigFile -Value $defaultCfg -Encoding UTF8
}

# --- Config laden (Hashtable-Workaround fuer PS 5.1) ---
# Bei JSON-Fehlern wird abgebrochen statt stillschweigend auf Defaults zurueckzufallen
# (sonst denkt der User die Config wirkt, in Wahrheit greifen PowerShell-Defaults).
$cfg = @{}
$cfgRaw = $null
try {
    $cfgRaw = Get-Content $ConfigFile -Raw -ErrorAction Stop
} catch {
    Write-Host ''
    Write-Host '  =====================================================' -ForegroundColor Red
    Write-Host '  FEHLER: config.json kann nicht gelesen werden' -ForegroundColor Red
    Write-Host "  Pfad: $ConfigFile" -ForegroundColor Red
    Write-Host "  Detail: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host '  =====================================================' -ForegroundColor Red
    Write-Host ''
    return
}
try {
    (ConvertFrom-Json $cfgRaw).PSObject.Properties | ForEach-Object { $cfg[$_.Name] = $_.Value }
} catch {
    Write-Host ''
    Write-Host '  =====================================================' -ForegroundColor Red
    Write-Host '  FEHLER: config.json ist kein gueltiges JSON' -ForegroundColor Red
    Write-Host "  Pfad: $ConfigFile" -ForegroundColor Red
    Write-Host "  Detail: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host '' -ForegroundColor Red
    Write-Host '  Haeufige Ursachen:' -ForegroundColor Yellow
    Write-Host '   - doppelter Schluessel (z.B. zwei Zeilen "n_parallel": ...)' -ForegroundColor Yellow
    Write-Host '   - zweite schliessende Klammer } am Dateiende' -ForegroundColor Yellow
    Write-Host '   - fehlendes Komma zwischen zwei Feldern' -ForegroundColor Yellow
    Write-Host '   - smart-quotes statt ASCII-Anfuehrungszeichen' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  Pruefe die Datei in einem Editor, korrigiere und starte erneut.' -ForegroundColor Yellow
    Write-Host '  =====================================================' -ForegroundColor Red
    Write-Host ''
    return
}
if ($cfg['modell_url']) { $ModelUrl = $cfg['modell_url'] }
if ($cfg['modell_datei']) { $ModelDatei = $cfg['modell_datei'] }
if ($cfg['kontext_groesse']) { $KontextGroesse = $cfg['kontext_groesse'] }
if ($cfg.ContainsKey('gpu_layers')) { $GpuLayers = $cfg['gpu_layers'] }
if ($cfg['threads']) { $Threads = $cfg['threads'] }
if ($cfg['port']) { $Port = $cfg['port'] }
if ($cfg.ContainsKey('n_cpu_moe') -and $null -ne $cfg['n_cpu_moe']) { $NCpuMoe = [int]$cfg['n_cpu_moe'] }
if ($cfg['cache_type_k']) { $CacheK = [string]$cfg['cache_type_k'] }
if ($cfg['cache_type_v']) { $CacheV = [string]$cfg['cache_type_v'] }
if ($cfg.ContainsKey('flash_attention')) { $FlashAttn = [bool]$cfg['flash_attention'] }
if ($cfg['reasoning']) { $Reasoning = [string]$cfg['reasoning'] }
if ($cfg['extra_args']) { $ExtraArgs = @($cfg['extra_args']) }
if ($cfg.ContainsKey('auto_update')) { $AutoUpdate = [bool]$cfg['auto_update'] }
if ($cfg.ContainsKey('batch_size') -and $null -ne $cfg['batch_size']) { $BatchSize = [int]$cfg['batch_size'] }
if ($cfg.ContainsKey('ubatch_size') -and $null -ne $cfg['ubatch_size']) { $UBatchSize = [int]$cfg['ubatch_size'] }
if ($cfg.ContainsKey('n_parallel') -and $null -ne $cfg['n_parallel']) { $NParallel = [int]$cfg['n_parallel'] }
if ($cfg['backend']) { $Backend = [string]$cfg['backend'] }

$ModelFile = Join-Path $FilesDir $ModelDatei

# --- Backend resolven (NVIDIA-Treiber-Check fuer 'auto', sonst gewuenschten Backend lowercased) ---
function Resolve-Backend {
    param([string]$Requested)
    if ($Requested -ne 'auto') {
        return $Requested.ToLower()
    }
    $nvSmi = Join-Path $env:SystemRoot 'System32\nvidia-smi.exe'
    if (-not (Test-Path $nvSmi)) {
        return 'vulkan'
    }
    try {
        $driverLine = & $nvSmi --query-gpu=driver_version --format=csv,noheader 2>$null | Select-Object -First 1
        if (-not $driverLine) { return 'vulkan' }
        $majorVer = [int]($driverLine.Trim() -split '\.')[0]
        if ($majorVer -ge 525) { return 'cuda' } else { return 'vulkan' }
    } catch {
        return 'vulkan'
    }
}
$ResolvedBackend = Resolve-Backend -Requested $Backend

# --- Header ---
Write-Host ''
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host '    Dokumentenindex aktualisieren' -ForegroundColor Cyan
Write-Host "    Backend: $ResolvedBackend" -ForegroundColor Cyan
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host ''

# --- Schritt 1: Analyseprogramm (llama.cpp) ---
$installedBackend = if (Test-Path $BackendMarker) {
    (Get-Content $BackendMarker -Raw).Trim()
} elseif (Test-Path $ServerExe) {
    'cuda'
} else {
    $null
}
$backendChanged = $installedBackend -and ($installedBackend -ne $ResolvedBackend)
$needsDownload = (-not (Test-Path $ServerExe)) -or $backendChanged

if ($backendChanged) {
    Write-Host "  Backend-Wechsel: $installedBackend -> $ResolvedBackend (lade neue Binaries)..." -ForegroundColor Yellow
    Get-ChildItem $FilesDir -Filter '*.exe' | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem $FilesDir -Filter '*.dll' | Remove-Item -Force -ErrorAction SilentlyContinue
}
try {
    if (-not $needsDownload -and $AutoUpdate) {
        $age = (Get-Date) - (Get-Item $ServerExe).LastWriteTime
        if ($age.TotalDays -gt 30) {
            Write-Host '  Analyseprogramm ist aelter als 30 Tage — Update...' -ForegroundColor Yellow
            Get-ChildItem $FilesDir -Filter '*.exe' | Remove-Item -Force
            Get-ChildItem $FilesDir -Filter '*.dll' | Remove-Item -Force
            $needsDownload = $true
        }
    } elseif (-not $needsDownload -and -not $AutoUpdate) {
        Write-Host '  Auto-Update deaktiviert (auto_update=false in config.json) — vorhandenes Binary wird verwendet.' -ForegroundColor DarkGray
    }
} catch { Write-Host '  Update-Pruefung uebersprungen.' -ForegroundColor DarkGray }
if ($needsDownload -and -not $AutoUpdate) {
    Write-Host '  Kein llama-server.exe vorhanden und auto_update=false — bitte Binary manuell ablegen.' -ForegroundColor Red
    return
}
if ($needsDownload) {
    Write-Host '  [1/2] Lade Analyseprogramm herunter...' -ForegroundColor Yellow
    try {
        $releaseJson = Invoke-RestMethod -Uri 'https://api.github.com/repos/ggml-org/llama.cpp/releases/latest' -UseBasicParsing
        $pattern = switch ($ResolvedBackend) {
            'cuda'   { 'bin-win-cuda-12.*x64\.zip$' }
            'vulkan' { 'bin-win-vulkan-x64\.zip$' }
            default  { 'bin-win-cuda-12.*x64\.zip$' }
        }
        $asset = $releaseJson.assets | Where-Object { $_.name -match $pattern -and $_.name -notmatch 'cudart' } | Select-Object -First 1
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
            if ($name -eq 'llama-server.exe' -or $name -eq 'llama-bench.exe' -or $name -match '\.dll$') {
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
    Set-Content -Path $BackendMarker -Value $ResolvedBackend -Encoding ASCII -NoNewline
    Write-Host '        Analyseprogramm bereit.' -ForegroundColor Green
} else {
    Write-Host '  Analyseprogramm ist vorhanden.' -ForegroundColor Green
    if (-not (Test-Path $BackendMarker)) {
        Set-Content -Path $BackendMarker -Value $ResolvedBackend -Encoding ASCII -NoNewline
    }
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

# --- Bereit ---
Write-Host ''
Write-Host '  Bereit! Wechsle jetzt zur App und starte die Indexierung.' -ForegroundColor Green
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
    '--cache-type-k', $CacheK,
    '--cache-type-v', $CacheV,
    '--jinja',
    '--reasoning', $Reasoning
)
if ($FlashAttn) { $serverArgs += @('-fa', 'on') }
if ($null -ne $NCpuMoe) { $serverArgs += @('--n-cpu-moe', $NCpuMoe) }
if ($null -ne $BatchSize) { $serverArgs += @('-b', $BatchSize) }
if ($null -ne $UBatchSize) { $serverArgs += @('-ub', $UBatchSize) }
if ($null -ne $NParallel) { $serverArgs += @('--parallel', $NParallel) }
if ($ExtraArgs.Count -gt 0) { $serverArgs += $ExtraArgs }
$argString = ($serverArgs | ForEach-Object { if ($_ -match ' ') { "`"$_`"" } else { $_ } }) -join ' '
cmd /c "`"$ServerExe`" $argString"
