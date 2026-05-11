<# : batch header
@echo off
chcp 65001 >nul 2>&1
title TeamFlow - Nemotron Benchmark
set "BATDIR=%~dp0"
set "BENCH_BACKENDS=%~1"
powershell -ExecutionPolicy Bypass -NoProfile -Command "& ([ScriptBlock]::Create((Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8)))"
echo.
echo   Benchmark beendet. Fenster kann geschlossen werden.
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
$BenchBinDir = Join-Path $FilesDir 'bench-binaries'
$ResultsDir = Join-Path $FilesDir 'bench-results'

# --- Header ---
Write-Host ''
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host '    Nemotron Benchmark (CUDA vs. Vulkan)' -ForegroundColor Cyan
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host ''

# --- Sanity-Checks ---
if (-not (Test-Path $FilesDir)) {
    Write-Host '  Ordner dokumentenindex-dateien fehlt — bitte zuerst Dokumentenindex-aktualisieren.bat ausfuehren.' -ForegroundColor Red
    return
}
if (-not (Test-Path $ResultsDir)) { New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null }
if (-not (Test-Path $BenchBinDir)) { New-Item -ItemType Directory -Path $BenchBinDir -Force | Out-Null }

# --- Modell-Pfad ermitteln ---
# config.json ist optional — wenn nicht da, Default-Modellname nemotron.gguf nutzen.
$ModelDatei = 'nemotron.gguf'
if (Test-Path $ConfigFile) {
    try {
        $cfg = @{}
        (ConvertFrom-Json (Get-Content $ConfigFile -Raw)).PSObject.Properties | ForEach-Object { $cfg[$_.Name] = $_.Value }
        if ($cfg['modell_datei']) { $ModelDatei = [string]$cfg['modell_datei'] }
    } catch {
        Write-Host '  Hinweis: config.json konnte nicht gelesen werden, nutze Default nemotron.gguf.' -ForegroundColor DarkGray
    }
} else {
    Write-Host '  Hinweis: keine config.json — nutze Default-Modellname nemotron.gguf.' -ForegroundColor DarkGray
}
$ModelFile = Join-Path $FilesDir $ModelDatei
if (-not (Test-Path $ModelFile)) {
    Write-Host "  Modell nicht gefunden: $ModelFile" -ForegroundColor Red
    Write-Host '  Bitte zuerst Dokumentenindex-aktualisieren.bat ausfuehren (laedt nemotron.gguf herunter).' -ForegroundColor Red
    return
}

# --- Backend-Auswahl: CLI-Override oder Auto-Detect ---
# Aufruf "Nemotron-Bench.bat vulkan" -> nur Vulkan; "cuda,vulkan" -> beide; default: beide
# Auto-Skip: ohne nvidia-smi oder Treiber < 525 wird CUDA uebersprungen
# (CUDA-12-Binaries laufen sonst nicht und der Bench haengt).
$requestedBackends = if ($env:BENCH_BACKENDS) {
    @($env:BENCH_BACKENDS.ToLower() -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
} else {
    @('cuda', 'vulkan')
}
if ($requestedBackends -contains 'cuda') {
    $cudaSupported = $false
    $nvSmi = Join-Path $env:SystemRoot 'System32\nvidia-smi.exe'
    if (Test-Path $nvSmi) {
        try {
            $driverLine = & $nvSmi --query-gpu=driver_version --format=csv,noheader 2>$null | Select-Object -First 1
            if ($driverLine) {
                $majorVer = [int]($driverLine.Trim() -split '\.')[0]
                if ($majorVer -ge 525) {
                    $cudaSupported = $true
                } else {
                    Write-Host "  Hinweis: NVIDIA-Treiber $($driverLine.Trim()) < 525 — CUDA-Bench wird uebersprungen." -ForegroundColor Yellow
                }
            }
        } catch {}
    } else {
        Write-Host '  Hinweis: nvidia-smi nicht gefunden — CUDA-Bench wird uebersprungen.' -ForegroundColor Yellow
    }
    if (-not $cudaSupported) {
        $requestedBackends = @($requestedBackends | Where-Object { $_ -ne 'cuda' })
    }
}
if ($requestedBackends.Count -eq 0) {
    Write-Host '  Keine Backends zum Benchen ausgewaehlt — Abbruch.' -ForegroundColor Red
    return
}
Write-Host "  Backends zum Benchen: $($requestedBackends -join ', ')" -ForegroundColor DarkGray

# --- Beide Backends bereitstellen (separat von Produktiv-Installation) ---
$availableBackends = @()
$backendVersions = @{}
foreach ($backend in $requestedBackends) {
    $bDir = Join-Path $BenchBinDir $backend
    $bExe = Join-Path $bDir 'llama-bench.exe'
    $vFile = Join-Path $bDir '.version'

    $needsDownload = -not (Test-Path $bExe)
    if (-not $needsDownload -and (Test-Path $vFile)) {
        if (((Get-Date) - (Get-Item $vFile).LastWriteTime).TotalDays -gt 30) { $needsDownload = $true }
    }

    if ($needsDownload) {
        if (-not (Test-Path $bDir)) { New-Item -ItemType Directory -Path $bDir -Force | Out-Null }
        Write-Host "  Lade $backend-Backend fuer Bench..." -ForegroundColor Yellow
        try {
            $releaseJson = Invoke-RestMethod -Uri 'https://api.github.com/repos/ggml-org/llama.cpp/releases/latest' -UseBasicParsing
            $pattern = if ($backend -eq 'cuda') { 'bin-win-cuda-12.*x64\.zip$' } else { 'bin-win-vulkan-x64\.zip$' }
            $asset = $releaseJson.assets | Where-Object { $_.name -match $pattern -and $_.name -notmatch 'cudart' } | Select-Object -First 1
            if (-not $asset) { throw "Kein passendes Asset fuer $backend gefunden" }
            $tmpZip = Join-Path $bDir 'tmp.zip'
            Download-WithProgress $asset.browser_download_url $tmpZip

            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $zip = [System.IO.Compression.ZipFile]::OpenRead($tmpZip)
            foreach ($entry in $zip.Entries) {
                $n = $entry.Name
                if ($n -eq 'llama-bench.exe' -or $n -match '\.dll$') {
                    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $bDir $n), $true)
                }
            }
            $zip.Dispose()
            Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
            Set-Content -Path $vFile -Value $releaseJson.tag_name -Encoding ASCII -NoNewline
            if (Test-Path $bExe) {
                $availableBackends += $backend
                $backendVersions[$backend] = $releaseJson.tag_name
                Write-Host "        $backend-Backend bereit ($($releaseJson.tag_name))." -ForegroundColor Green
            } else {
                Write-Host "  $backend-Backend: llama-bench.exe nicht im Asset enthalten." -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  $backend-Backend nicht verfuegbar: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        $availableBackends += $backend
        $tag = if (Test-Path $vFile) { (Get-Content $vFile -Raw).Trim() } else { 'unbekannt' }
        $backendVersions[$backend] = $tag
        Write-Host "  $backend-Backend ist vorhanden ($tag)." -ForegroundColor Green
    }
}

if ($availableBackends.Count -eq 0) {
    Write-Host ''
    Write-Host '  Kein Backend verfuegbar — Abbruch.' -ForegroundColor Red
    return
}

# --- Output-Parser: Markdown-Tabelle aus llama-bench -o md ---
# Robust gegen Encoding-Unterschiede (± kommt als UTF-8-Bytes 0xC2 0xB1, was
# unter PS 5.1 mit Default-Encoding als 'Â±' gelesen wird). Wir splitten die
# Zeile am '|' und parsen Zahlen aus der t/s-Zelle.
function Parse-BenchRow {
    param([string]$Line, [string]$TestName)
    if (-not $Line.Contains('|')) { return $null }
    $cells = $Line -split '\|'
    $testIdx = -1
    for ($i = 0; $i -lt $cells.Count; $i++) {
        if ($cells[$i].Trim() -eq $TestName) { $testIdx = $i; break }
    }
    if ($testIdx -lt 0 -or ($testIdx + 1) -ge $cells.Count) { return $null }
    $tsCell = $cells[$testIdx + 1]
    $nums = @([regex]::Matches($tsCell, '\d+\.\d+') | ForEach-Object { [double]$_.Value })
    if ($nums.Count -lt 1) { return $null }
    return @{
        ts  = $nums[0]
        std = if ($nums.Count -ge 2) { $nums[1] } else { 0.0 }
    }
}

function Parse-BenchOutput {
    param([string]$Output, [string]$Backend, [int]$FA, [int]$UB)
    $ppTs = $null; $ppStd = $null; $tgTs = $null; $tgStd = $null
    foreach ($line in ($Output -split "`n")) {
        if (-not $line.Contains('|')) { continue }
        $pp = Parse-BenchRow -Line $line -TestName 'pp7000'
        if ($pp) { $ppTs = $pp.ts; $ppStd = $pp.std; continue }
        $tg = Parse-BenchRow -Line $line -TestName 'tg256'
        if ($tg) { $tgTs = $tg.ts; $tgStd = $tg.std }
    }
    $status = if ($null -ne $ppTs -and $null -ne $tgTs) { 'OK' } else { 'PARSE_FAILED' }
    return @{
        backend = $Backend
        fa = $FA
        ub = $UB
        prefill_ts = $ppTs
        prefill_std = $ppStd
        decode_ts = $tgTs
        decode_std = $tgStd
        status = $status
    }
}

# --- 8 Bench-Laeufe (4 Configs x 2 Backends) ---
$results = @()
$configs = @(
    @{ fa = 0; ub = 512  },
    @{ fa = 1; ub = 512  },
    @{ fa = 0; ub = 2048 },
    @{ fa = 1; ub = 2048 }
)

Write-Host ''
Write-Host '  Starte Bench-Laeufe (4 Configs x 2 Backends, jeweils 3 Iterationen)...' -ForegroundColor Cyan
foreach ($backend in $availableBackends) {
    $bExe = Join-Path $BenchBinDir "$backend\llama-bench.exe"
    foreach ($c in $configs) {
        Write-Host ''
        Write-Host "  Lauf: $backend | FA=$($c.fa) | -ub $($c.ub)" -ForegroundColor Cyan
        $benchArgs = @(
            '-m', $ModelFile,
            '-p', '7000',
            '-n', '256',
            '-ngl', '99',
            '-t', '4',
            '-r', '3',
            '-fa', "$($c.fa)",
            '-ub', "$($c.ub)",
            '-b', '2048',
            '-o', 'md'
        )
        # stderr/stdout in Temp-Files schreiben — llama-bench schreibt Init-Logs auf
        # stderr, was sonst in der PS-Pipeline als Fehler interpretiert wird.
        $stdoutFile = [System.IO.Path]::GetTempFileName()
        $stderrFile = [System.IO.Path]::GetTempFileName()
        $argString = ($benchArgs | ForEach-Object {
            $s = [string]$_
            if ($s -match '\s') { '"' + $s + '"' } else { $s }
        }) -join ' '
        $exitCode = -1
        $startError = $null
        $timedOut = $false
        $timeoutMs = 300000  # 5 min pro Lauf — schuetzt vor CUDA-Init-Hang bei zu altem Treiber
        try {
            $proc = Start-Process -FilePath $bExe -ArgumentList $argString -NoNewWindow `
                -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile -PassThru
            $completed = $proc.WaitForExit($timeoutMs)
            if (-not $completed) {
                $timedOut = $true
                try { $proc.Kill() } catch {}
                [void]$proc.WaitForExit(2000)
            } else {
                $exitCode = $proc.ExitCode
            }
        } catch {
            $startError = $_.Exception.Message
        }
        $out = if (Test-Path $stdoutFile) { Get-Content -LiteralPath $stdoutFile -Raw -Encoding UTF8 } else { '' }
        $errOut = if (Test-Path $stderrFile) { Get-Content -LiteralPath $stderrFile -Raw -Encoding UTF8 } else { '' }
        Remove-Item -LiteralPath $stdoutFile, $stderrFile -Force -ErrorAction SilentlyContinue

        if ($startError) {
            $results += @{
                backend = $backend; fa = $c.fa; ub = $c.ub
                prefill_ts = $null; prefill_std = $null
                decode_ts = $null; decode_std = $null
                status = 'FAILED'; error = $startError
            }
            Write-Host "        FAILED: $startError" -ForegroundColor Red
            continue
        }
        if ($timedOut) {
            $results += @{
                backend = $backend; fa = $c.fa; ub = $c.ub
                prefill_ts = $null; prefill_std = $null
                decode_ts = $null; decode_std = $null
                status = 'TIMEOUT'; error = "Lauf > $($timeoutMs/1000)s, abgebrochen"
            }
            Write-Host "        TIMEOUT nach $($timeoutMs/1000)s — Backend dieses Laufs wird uebersprungen." -ForegroundColor Red
            continue
        }

        $parsed = Parse-BenchOutput -Output $out -Backend $backend -FA $c.fa -UB $c.ub
        if ($parsed.status -ne 'OK' -and $exitCode -ne 0) {
            $errLine = ($errOut -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 1)
            if (-not $errLine) { $errLine = "ExitCode $exitCode" }
            $parsed.status = 'FAILED'
            $parsed.error = $errLine.Trim()
        }
        $results += $parsed
        if ($parsed.status -eq 'OK') {
            Write-Host ("        OK | pp7000 {0:N2} t/s | tg256 {1:N2} t/s" -f $parsed.prefill_ts, $parsed.decode_ts) -ForegroundColor Green
        } elseif ($parsed.status -eq 'FAILED') {
            Write-Host "        FAILED: $($parsed.error)" -ForegroundColor Red
        } else {
            Write-Host '        PARSE_FAILED: Konnte pp7000/tg256 nicht aus Output lesen.' -ForegroundColor Yellow
        }
    }
}

# --- GPU-Info (best effort) ---
$gpuName = 'n/a'
$gpuFreeMb = $null
$nvSmi = Join-Path $env:SystemRoot 'System32\nvidia-smi.exe'
if (Test-Path $nvSmi) {
    try {
        $smiLine = & $nvSmi --query-gpu=name,memory.free --format=csv,noheader,nounits 2>$null | Select-Object -First 1
        if ($smiLine) {
            $smiParts = $smiLine -split ','
            if ($smiParts.Length -ge 1) { $gpuName = $smiParts[0].Trim() }
            if ($smiParts.Length -ge 2) { $gpuFreeMb = $smiParts[1].Trim() }
        }
    } catch {}
}

# --- Hilfs-Funktionen fuer Tabellen-Render ---
function Format-TsCell {
    param($Result, [string]$Field)
    if (-not $Result -or $Result.status -ne 'OK') { return 'n/a' }
    $val = $Result.$Field
    $stdField = $Field -replace '_ts$', '_std'
    $std = $Result.$stdField
    if ($null -eq $val) { return 'n/a' }
    return ('{0:N2} ± {1:N2}' -f $val, $std)
}
function Get-Result {
    param([array]$All, [string]$Backend, [int]$FA, [int]$UB)
    return ($All | Where-Object { $_.backend -eq $Backend -and $_.fa -eq $FA -and $_.ub -eq $UB } | Select-Object -First 1)
}
function Calc-DokPerMin {
    param($PrefillTs, $DecodeTs, [int]$MaxSlots)
    if (-not $PrefillTs -or -not $DecodeTs -or $PrefillTs -le 0 -or $DecodeTs -le 0) { return $null }
    $secPerDoc = (7000.0 / $PrefillTs) + (256.0 / $DecodeTs)
    if ($secPerDoc -le 0) { return $null }
    return [math]::Round((60.0 / $secPerDoc) * $MaxSlots, 1)
}

# --- Markdown-Output zusammenbauen ---
$timestamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$resultsFile = Join-Path $ResultsDir "bench-$timestamp.md"

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# Nemotron Bench-Ergebnisse — $timestamp")
[void]$sb.AppendLine('')
[void]$sb.AppendLine("**Modell**: $ModelDatei (Q4_K_M)  ")
[void]$sb.AppendLine("**GPU**: $gpuName  ")
if ($gpuFreeMb) {
    [void]$sb.AppendLine("**Freier VRAM beim Bench-Start**: $gpuFreeMb MB  ")
}
$cudaVer = if ($backendVersions.ContainsKey('cuda')) { $backendVersions['cuda'] } else { 'nicht getestet' }
$vulkanVer = if ($backendVersions.ContainsKey('vulkan')) { $backendVersions['vulkan'] } else { 'nicht getestet' }
[void]$sb.AppendLine("**llama.cpp Version CUDA**: $cudaVer  ")
[void]$sb.AppendLine("**llama.cpp Version Vulkan**: $vulkanVer  ")
[void]$sb.AppendLine('**Iterationen pro Lauf**: 3')
[void]$sb.AppendLine('')

# Baseline = CUDA, FA=0, UB=512
$baseline = Get-Result $results 'cuda' 0 512
$baselinePp = if ($baseline -and $baseline.status -eq 'OK') { $baseline.prefill_ts } else { $null }
$baselineTg = if ($baseline -and $baseline.status -eq 'OK') { $baseline.decode_ts } else { $null }

function Calc-Delta {
    param($Value, $Base)
    if (-not $Value -or -not $Base -or $Base -le 0) { return '—' }
    $delta = (($Value - $Base) / $Base) * 100.0
    if ([math]::Abs($delta) -lt 0.05) { return '±0.0%' }
    $sign = if ($delta -gt 0) { '+' } else { '' }
    return ('{0}{1:N1}%' -f $sign, $delta)
}

# Prefill-Tabelle
[void]$sb.AppendLine('## Prefill (pp7000, hoeher = besser)')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('| Backend | FA | -ub | t/s | vs CUDA-Baseline |')
[void]$sb.AppendLine('|---|---|---|---|---|')
foreach ($backend in @('cuda', 'vulkan')) {
    foreach ($c in $configs) {
        $r = Get-Result $results $backend $c.fa $c.ub
        $faLabel = if ($c.fa -eq 1) { 'an' } else { 'aus' }
        $tsCell = Format-TsCell $r 'prefill_ts'
        $isBaseline = ($backend -eq 'cuda' -and $c.fa -eq 0 -and $c.ub -eq 512)
        $deltaCell = if ($isBaseline) {
            '— (Baseline)'
        } elseif ($r -and $r.status -eq 'OK') {
            Calc-Delta $r.prefill_ts $baselinePp
        } else {
            'n/a'
        }
        [void]$sb.AppendLine("| $backend | $faLabel | $($c.ub) | $tsCell | $deltaCell |")
    }
}
[void]$sb.AppendLine('')

# Decode-Tabelle
[void]$sb.AppendLine('## Decode (tg256, hoeher = besser)')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('| Backend | FA | -ub | t/s | vs CUDA-Baseline |')
[void]$sb.AppendLine('|---|---|---|---|---|')
foreach ($backend in @('cuda', 'vulkan')) {
    foreach ($c in $configs) {
        $r = Get-Result $results $backend $c.fa $c.ub
        $faLabel = if ($c.fa -eq 1) { 'an' } else { 'aus' }
        $tsCell = Format-TsCell $r 'decode_ts'
        $isBaseline = ($backend -eq 'cuda' -and $c.fa -eq 0 -and $c.ub -eq 512)
        $deltaCell = if ($isBaseline) {
            '— (Baseline)'
        } elseif ($r -and $r.status -eq 'OK') {
            Calc-Delta $r.decode_ts $baselineTg
        } else {
            'n/a'
        }
        [void]$sb.AppendLine("| $backend | $faLabel | $($c.ub) | $tsCell | $deltaCell |")
    }
}
[void]$sb.AppendLine('')

# Aggregat-Tabelle: Dok/Min
[void]$sb.AppendLine('## Aggregierter Indexierungs-Durchsatz')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('**Workload-Annahme**: ~7000 Token Prefill + ~256 Token Decode pro Dokument (Smart-Trim deutscher Text + Metadaten-JSON-Antwort).')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('**Slot-Annahme** (RTX A3000 6 GB, 1-Monitor-Betrieb):')
[void]$sb.AppendLine('- CUDA: ~1.3 GB frei fuer KV -> max **4 parallele Slots** (~250 MB je 8K-Slot bei q4_0)')
[void]$sb.AppendLine('- Vulkan: ~1.9 GB frei fuer KV -> max **6 parallele Slots** (~600 MB weniger Backend-Overhead)')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('| Backend | Beste Config | Sek/Dok einzeln | Max Slots | Dok/Min aggregiert |')
[void]$sb.AppendLine('|---|---|---|---|---|')

$slotMap = @{ 'cuda' = 4; 'vulkan' = 6 }
$bestPerBackend = @{}
foreach ($backend in @('cuda', 'vulkan')) {
    $slots = $slotMap[$backend]
    $candidate = $null
    foreach ($c in $configs) {
        $r = Get-Result $results $backend $c.fa $c.ub
        if (-not $r -or $r.status -ne 'OK') { continue }
        $dpm = Calc-DokPerMin $r.prefill_ts $r.decode_ts $slots
        if ($null -eq $dpm) { continue }
        if (-not $candidate -or $dpm -gt $candidate.dpm) {
            $candidate = @{
                backend = $backend
                fa = $c.fa
                ub = $c.ub
                slots = $slots
                prefill_ts = $r.prefill_ts
                decode_ts = $r.decode_ts
                dpm = $dpm
            }
        }
    }
    if ($candidate) {
        $bestPerBackend[$backend] = $candidate
        $secPerDoc = (7000.0 / $candidate.prefill_ts) + (256.0 / $candidate.decode_ts)
        $faLabel = if ($candidate.fa -eq 1) { 'an' } else { 'aus' }
        $cfgLabel = "FA=$faLabel, ub=$($candidate.ub)"
        [void]$sb.AppendLine(("| $backend | $cfgLabel | {0:N2} s | $($candidate.slots) | **{1:N1} Dok/Min** |" -f $secPerDoc, $candidate.dpm))
    } else {
        [void]$sb.AppendLine("| $backend | n/a | n/a | $slots | nicht verfuegbar |")
    }
}
[void]$sb.AppendLine('')
[void]$sb.AppendLine('**Formel**: `Dok/Min = (60 / (7000/prefill_ts + 256/decode_ts)) * max_slots`')
[void]$sb.AppendLine('')

# Empfehlung
[void]$sb.AppendLine('## Empfehlung fuer Kurator-Indexierung')
[void]$sb.AppendLine('')
$winner = $null
if ($bestPerBackend.ContainsKey('cuda') -and $bestPerBackend.ContainsKey('vulkan')) {
    $winner = if ($bestPerBackend['vulkan'].dpm -ge $bestPerBackend['cuda'].dpm) { 'vulkan' } else { 'cuda' }
} elseif ($bestPerBackend.ContainsKey('vulkan')) {
    $winner = 'vulkan'
} elseif ($bestPerBackend.ContainsKey('cuda')) {
    $winner = 'cuda'
}

if ($winner) {
    $w = $bestPerBackend[$winner]
    $other = if ($winner -eq 'vulkan') { 'cuda' } else { 'vulkan' }
    $faBool = if ($w.fa -eq 1) { 'true' } else { 'false' }
    $ctx = if ($winner -eq 'vulkan') { 49152 } else { 32768 }
    $emojiCheck = [char]0x2705
    if ($bestPerBackend.ContainsKey($other)) {
        $deltaPct = (($w.dpm - $bestPerBackend[$other].dpm) / $bestPerBackend[$other].dpm) * 100.0
        $deltaLabel = ('{0:N1}%' -f [math]::Abs($deltaPct))
        $relation = if ($deltaPct -ge 0) { 'mehr' } else { 'weniger' }
        [void]$sb.AppendLine("$emojiCheck **$winner empfohlen** — liefert ca. $deltaLabel $relation Dokumente pro Stunde als $other.")
    } else {
        [void]$sb.AppendLine("$emojiCheck **$winner empfohlen** — einziges verfuegbares Backend.")
    }
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('Empfohlene `config.json`:')
    [void]$sb.AppendLine('```json')
    [void]$sb.AppendLine('{')
    [void]$sb.AppendLine("  ""backend"": ""$winner"",")
    [void]$sb.AppendLine("  ""flash_attention"": $faBool,")
    [void]$sb.AppendLine("  ""ubatch_size"": $($w.ub),")
    [void]$sb.AppendLine("  ""batch_size"": 2048,")
    [void]$sb.AppendLine("  ""n_parallel"": $($w.slots),")
    [void]$sb.AppendLine("  ""kontext_groesse"": $ctx")
    [void]$sb.AppendLine('}')
    [void]$sb.AppendLine('```')
} else {
    [void]$sb.AppendLine('Keine verwertbaren Bench-Ergebnisse — bitte Logs pruefen und erneut starten.')
}
[void]$sb.AppendLine('')

# Multi-Monitor-Hinweis
[void]$sb.AppendLine('### Bei Multi-Monitor-Betrieb (1.6 GB statt 1.2 GB belegt):')
[void]$sb.AppendLine('- CUDA: `n_parallel` auf 2 reduzieren, `kontext_groesse` auf 16384')
[void]$sb.AppendLine('- Vulkan: `n_parallel` auf 4 reduzieren, `kontext_groesse` auf 32768')
[void]$sb.AppendLine('')

# Warnzeilen fuer nicht-getestete Backends
foreach ($backend in @('cuda', 'vulkan')) {
    if ($availableBackends -notcontains $backend) {
        [void]$sb.AppendLine("> Hinweis: $backend-Backend wurde nicht getestet (Download fehlgeschlagen).")
    }
}

Set-Content -Path $resultsFile -Value $sb.ToString() -Encoding UTF8

Write-Host ''
Write-Host "  Ergebnisse: $resultsFile" -ForegroundColor Green
try {
    Start-Process notepad.exe $resultsFile
} catch {}
