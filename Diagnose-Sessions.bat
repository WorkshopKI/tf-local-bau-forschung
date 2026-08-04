<# : batch header
@echo off
chcp 65001 >nul 2>&1
title Diagnose - Claude Sessions
set "BATDIR=%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -Command "& ([ScriptBlock]::Create((Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8)))"
echo.
pause
exit /b
: end batch header #>

# ============================================================================
#  Diagnose: Wo liegen die Claude-Code-Sessions dieses Projekts und wie sieht
#  der Session-Index aus? Nur lesend. Ausgabe in Konsole + diagnose-sessions.txt
# ============================================================================
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = $env:BATDIR
if (-not $Root) { $Root = (Get-Location).Path }
$Root = $Root.TrimEnd('\')
$AusgabeDatei = Join-Path $Root 'diagnose-sessions.txt'
$zeilen = @()
function Sag([string]$t) { Write-Host $t; $script:zeilen += $t }

Sag "=== Diagnose Claude-Sessions ==="
Sag "Arbeitsverzeichnis : $Root"

$basis = Join-Path $env:USERPROFILE '.claude\projects'
Sag "Projekte-Basis     : $basis  (existiert: $(Test-Path $basis))"
if (-not (Test-Path $basis)) { Set-Content $AusgabeDatei ($zeilen -join "`r`n") -Encoding UTF8; return }

$gemunged = ($Root -replace '[^A-Za-z0-9]', '-')
Sag "Erwarteter Ordner  : $gemunged"
Sag ""
Sag "--- Vorhandene Projektordner (neueste zuerst) ---"
$ordner = @(Get-ChildItem $basis -Directory | Sort-Object LastWriteTime -Descending)
for ($i = 0; $i -lt [Math]::Min($ordner.Count, 12); $i++) {
  $o = $ordner[$i]
  $anz = @(Get-ChildItem $o.FullName -Filter '*.jsonl' -File -ErrorAction SilentlyContinue).Count
  $treffer = ''
  if ($o.Name -eq $gemunged) { $treffer = '   <== Treffer' }
  Sag ("  [{0,2}] {1}  ({2} Sessions, {3}){4}" -f ($i+1), $o.Name, $anz, $o.LastWriteTime.ToString('dd.MM. HH:mm'), $treffer)
}

# Ordner bestimmen
$ziel = Join-Path $basis $gemunged
if (-not (Test-Path $ziel)) {
  Sag ""
  $wahl = Read-Host "Kein automatischer Treffer. Nummer des richtigen Ordners (leer = Ende)"
  if ($wahl -match '^\d+$' -and [int]$wahl -ge 1 -and [int]$wahl -le $ordner.Count) {
    $ziel = $ordner[[int]$wahl-1].FullName
  } else { Set-Content $AusgabeDatei ($zeilen -join "`r`n") -Encoding UTF8; return }
}
Sag ""
Sag "Verwendeter Ordner : $ziel"

Sag ""
Sag "--- 8 neueste .jsonl-Dateien (Sortierbasis der Plan-Queue) ---"
$js = @(Get-ChildItem $ziel -Filter '*.jsonl' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 8)
foreach ($f in $js) {
  Sag ("  {0}  {1}  {2:N1} MB" -f $f.LastWriteTime.ToString('dd.MM. HH:mm'), $f.BaseName, ($f.Length/1MB))
}

Sag ""
$idx = Join-Path $ziel 'sessions-index.json'
Sag "sessions-index.json: $(Test-Path $idx)"
if (Test-Path $idx) {
  try {
    $roh = Get-Content $idx -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($roh -is [System.Array]) {
      Sag "Top-Level          : Array mit $(@($roh).Count) Eintraegen"
      $eintraege = $roh
    } else {
      Sag "Top-Level-Felder   : $(($roh.PSObject.Properties.Name) -join ', ')"
      $eintraege = $null
      foreach ($k in $roh.PSObject.Properties.Name) {
        if ($roh.$k -is [System.Array]) { $eintraege = $roh.$k; Sag "Eintraege in Feld  : $k ($(@($eintraege).Count))"; break }
      }
    }
    if ($null -ne $eintraege -and @($eintraege).Count -gt 0) {
      $e0 = @($eintraege)[0]
      Sag ""
      Sag "--- Felder eines Eintrags ---"
      foreach ($p in $e0.PSObject.Properties) {
        $v = "$($p.Value)"
        if ($v.Length -gt 70) { $v = $v.Substring(0,70) + '…' }
        Sag ("  {0,-20} = {1}" -f $p.Name, $v)
      }
      # Passt ein Eintrag zur neuesten Datei?
      if ($js.Count -gt 0) {
        $neuesteId = $js[0].BaseName
        $treffer = @($eintraege) | Where-Object { ($_.PSObject.Properties.Value -contains $neuesteId) } | Select-Object -First 1
        Sag ""
        if ($treffer) {
          Sag "--- Eintrag zur NEUESTEN Session ($neuesteId) ---"
          foreach ($p in $treffer.PSObject.Properties) {
            $v = "$($p.Value)"
            if ($v.Length -gt 70) { $v = $v.Substring(0,70) + '…' }
            Sag ("  {0,-20} = {1}" -f $p.Name, $v)
          }
        } else {
          Sag "Kein Index-Eintrag enthaelt die ID der neuesten Session -> Index veraltet oder andere ID-Form."
        }
      }
    }
  } catch {
    Sag "Index nicht parsebar: $($_.Exception.Message)"
  }
}

Sag ""
Sag "--- Claude-CLI ---"
try { Sag ("claude gefunden: " + (Get-Command claude -ErrorAction Stop).Source) } catch { Sag "claude NICHT im PATH!" }
try { Sag ("Version: " + (& claude --version 2>&1 | Out-String).Trim()) } catch { }

Set-Content -Path $AusgabeDatei -Value ($zeilen -join "`r`n") -Encoding UTF8
Write-Host ""
Write-Host "Ausgabe gespeichert: $AusgabeDatei"
