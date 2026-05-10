<# : batch header
@echo off
chcp 65001 >nul 2>&1
title TeamFlow - Dokumentenindex aktualisieren (Gemma)
set "BATDIR=%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -Command "& ([ScriptBlock]::Create((Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8)))"
echo.
echo   Gemma-Server wurde beendet. Fenster kann geschlossen werden.
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
# llama-server.exe wird mit der Nemotron- und MoE-Variante geteilt (gleicher Ordner).
# Eigene Config-Datei (config-gemma.json) damit andere Setups unangetastet bleiben.
$BaseDir = ($env:BATDIR).TrimEnd('\')
$FilesDir = Join-Path $BaseDir 'dokumentenindex-dateien'
$ConfigFile = Join-Path $FilesDir 'config-gemma.json'
$ServerExe = Join-Path $FilesDir 'llama-server.exe'
$ZipFile = Join-Path $FilesDir 'llama-cpp.zip'

# --- Defaults (Gemma 4 26B-A4B Instruct — bartowski Q4_K_M, ca. 15 GB GGUF) ---
$ModelUrl = 'https://huggingface.co/bartowski/google_gemma-4-26b-a4b-it-GGUF/resolve/main/google_gemma-4-26b-a4b-it-Q4_K_M.gguf'
$ModelDatei = 'gemma-4-26b-a4b-it-Q4_K_M.gguf'
$KontextGroesse = 8192
$GpuLayers = 99
$Threads = 4
$Port = 9092
$NCpuMoe = 26
$CacheK = 'q4_0'
$CacheV = 'q4_0'
$FlashAttn = $true
$Reasoning = 'off'
$NoMmap = $true
$Mlock = $true
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
  "modell_url": "https://huggingface.co/bartowski/google_gemma-4-26b-a4b-it-GGUF/resolve/main/google_gemma-4-26b-a4b-it-Q4_K_M.gguf",
  "modell_datei": "gemma-4-26b-a4b-it-Q4_K_M.gguf",
  "kontext_groesse": 8192,
  "gpu_layers": 99,
  "threads": 4,
  "port": 9092,
  "n_cpu_moe": 26,
  "cache_type_k": "q4_0",
  "cache_type_v": "q4_0",
  "flash_attention": true,
  "reasoning": "off",
  "no_mmap": true,
  "mlock": true,
  "extra_args": [],
  "auto_update": true
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
if ($cfg.ContainsKey('n_cpu_moe') -and $null -ne $cfg['n_cpu_moe']) { $NCpuMoe = [int]$cfg['n_cpu_moe'] }
if ($cfg['cache_type_k']) { $CacheK = [string]$cfg['cache_type_k'] }
if ($cfg['cache_type_v']) { $CacheV = [string]$cfg['cache_type_v'] }
if ($cfg.ContainsKey('flash_attention')) { $FlashAttn = [bool]$cfg['flash_attention'] }
if ($cfg['reasoning']) { $Reasoning = [string]$cfg['reasoning'] }
if ($cfg.ContainsKey('no_mmap')) { $NoMmap = [bool]$cfg['no_mmap'] }
if ($cfg.ContainsKey('mlock')) { $Mlock = [bool]$cfg['mlock'] }
if ($cfg['extra_args']) { $ExtraArgs = @($cfg['extra_args']) }
if ($cfg.ContainsKey('auto_update')) { $AutoUpdate = [bool]$cfg['auto_update'] }

$ModelFile = Join-Path $FilesDir $ModelDatei

# --- Header ---
Write-Host ''
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host '    Dokumentenindex aktualisieren (Gemma 4 26B-A4B)' -ForegroundColor Cyan
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host ''
Write-Host "  Config-Datei: $ConfigFile" -ForegroundColor DarkGray
Write-Host "  Default: Gemma 4 26B-A4B Instruct Q4_K_M, Port $Port" -ForegroundColor DarkGray
Write-Host '  Hinweis: Andere Varianten (Nemotron / Qwen-MoE) bleiben unberuehrt.' -ForegroundColor DarkGray
Write-Host ''

# --- Schritt 1: Analyseprogramm (llama.cpp, geteilt mit Nemotron/MoE-Setup) ---
$needsDownload = -not (Test-Path $ServerExe)
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
        Write-Host '  Auto-Update deaktiviert (auto_update=false in config-gemma.json) — vorhandenes Binary wird verwendet.' -ForegroundColor DarkGray
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
    Write-Host '        Analyseprogramm bereit.' -ForegroundColor Green
} else {
    Write-Host '  Analyseprogramm ist vorhanden.' -ForegroundColor Green
}

# --- Schritt 2: Gemma-Modell ---
if (-not (Test-Path $ModelFile)) {
    Write-Host '  [2/2] Lade Gemma-Modell herunter...                  (einmalig, ca. 15 GB)' -ForegroundColor Yellow
    try {
        Download-WithProgress $ModelUrl $ModelFile
    } catch {
        Write-Host '  Download fehlgeschlagen. Bitte Internetverbindung pruefen.' -ForegroundColor Red
        Remove-Item $ModelFile -Force -ErrorAction SilentlyContinue
        return
    }
    $actualGB = [math]::Round((Get-Item $ModelFile).Length / 1GB, 1)
    Write-Host "        Gemma-Modell bereit (${actualGB} GB)." -ForegroundColor Green
} else {
    $actualGB = [math]::Round((Get-Item $ModelFile).Length / 1GB, 1)
    Write-Host "  Gemma-Modell ist vorhanden (${actualGB} GB)." -ForegroundColor Green
}

# --- Bereit ---
Write-Host ''
Write-Host '  Bereit! In der App unter Verwaltung > Metadaten-Extraktion' -ForegroundColor Green
Write-Host "  > Lokale KI > Lokaler Port auf $Port stellen, dann Indexierung starten." -ForegroundColor Green
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
    '--reasoning', $Reasoning,
    '--n-cpu-moe', $NCpuMoe
)
if ($FlashAttn) { $serverArgs += @('-fa', 'on') }
if ($NoMmap) { $serverArgs += '--no-mmap' }
if ($Mlock) { $serverArgs += '--mlock' }
if ($ExtraArgs.Count -gt 0) { $serverArgs += $ExtraArgs }
$argString = ($serverArgs | ForEach-Object { if ($_ -match ' ') { "`"$_`"" } else { $_ } }) -join ' '
cmd /c "`"$ServerExe`" $argString"
