<# : batch header
@echo off
chcp 65001 >nul 2>&1
title Fortschritt - laufende Session
set "BATDIR=%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -Command "& ([ScriptBlock]::Create((Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8)))"
echo.
pause
exit /b
: end batch header #>

# ============================================================================
#  Live-Monitor (v2): folgt der Session, die die Plan-Queue gerade ausfuehrt.
#  Quelle: _plans/aktuell.txt (von Plan-Queue.bat geschrieben).
#  Faellt zurueck auf die zuletzt beschriebene Session, wenn keine Queue laeuft.
#  Wechselt automatisch mit, wenn die Queue zum naechsten Auftrag springt.
#  Liest NUR. Abbruch mit Strg+C.
# ============================================================================
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = $env:BATDIR; if (-not $Root) { $Root = (Get-Location).Path }
$Root = $Root.TrimEnd('\')
$AktuellDatei = Join-Path $Root '_plans\aktuell.txt'

$gemunged = ($Root -replace '[^A-Za-z0-9]', '-')
$ZielOrdner = Join-Path (Join-Path $env:USERPROFILE '.claude\projects') $gemunged
if (-not (Test-Path $ZielOrdner)) {
  $merker = Join-Path $Root '_plans\projektordner.txt'
  if (Test-Path $merker) { $ZielOrdner = (Get-Content $merker -Encoding UTF8 | Select-Object -First 1).Trim() }
}
if (-not (Test-Path $ZielOrdner)) { Write-Host "Projektordner nicht gefunden."; return }

function Hole-Ziel {
  # 1. Wahl: die von der Queue gemeldete Session
  if (Test-Path $AktuellDatei) {
    $z = @(Get-Content $AktuellDatei -Encoding UTF8)
    $id = ''; if ($z.Count -ge 1) { $id = $z[0].Trim() }
    $titel = ''; if ($z.Count -ge 2) { $titel = $z[1].Trim() }
    if ($id) {
      $p = Join-Path $ZielOrdner ($id + '.jsonl')
      if (Test-Path $p) { return [pscustomobject]@{ Pfad = $p; Id = $id; Titel = $titel; Quelle = 'Queue' } }
    }
  }
  # Fallback: zuletzt beschriebene Session
  $f = Get-ChildItem $ZielOrdner -Filter '*.jsonl' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($f) { return [pscustomobject]@{ Pfad = $f.FullName; Id = $f.BaseName; Titel = ''; Quelle = 'neueste Datei' } }
  return $null
}

function Zeige-Eintrag($o) {
  $zeit = ''
  try { if ($o.timestamp) { $zeit = ([datetime]$o.timestamp).ToString('HH:mm:ss') } } catch { }
  if (-not $zeit) { $zeit = (Get-Date).ToString('HH:mm:ss') }
  $typ = "$($o.type)"

  if ($typ -eq 'assistant') {
    try {
      foreach ($blk in $o.message.content) {
        switch ("$($blk.type)") {
          'text' {
            $t = ("$($blk.text)" -replace '\s+', ' ').Trim()
            if ($t) {
              if ($t.Length -gt 160) { $t = $t.Substring(0, 160) + '…' }
              Write-Host "[$zeit] $t"
            }
          }
          'tool_use' {
            $detail = ''
            $i = $blk.input
            if ($i) {
              foreach ($feld in @('file_path','path','command','pattern','description')) {
                if ($i.PSObject.Properties[$feld] -and $i.$feld) {
                  $detail = ("$($i.$feld)" -replace '\s+', ' ')
                  if ($detail.Length -gt 90) { $detail = $detail.Substring(0, 90) + '…' }
                  break
                }
              }
            }
            Write-Host "[$zeit]   -> $($blk.name)  $detail" -ForegroundColor DarkCyan
          }
          'thinking' { Write-Host "[$zeit]   (denkt nach…)" -ForegroundColor DarkGray }
        }
      }
    } catch { }
  }
  elseif ($typ -eq 'user') {
    try {
      foreach ($blk in $o.message.content) {
        if ("$($blk.type)" -eq 'tool_result' -and $blk.is_error) {
          $t = ("$($blk.content)" -replace '\s+', ' ').Trim()
          if ($t.Length -gt 140) { $t = $t.Substring(0, 140) + '…' }
          Write-Host "[$zeit]   !! Fehler: $t" -ForegroundColor Red
        }
      }
    } catch { }
  }
  elseif ($typ -eq 'summary') {
    Write-Host "[$zeit] == $($o.summary) ==" -ForegroundColor Yellow
  }
}

Write-Host "Warte auf laufenden Auftrag… (Abbruch mit Strg+C, nur lesend)"
$aktuellePfad = $null
$sr = $null; $fs = $null

try {
  while ($true) {
    $ziel = Hole-Ziel

    if ($ziel -and $ziel.Pfad -ne $aktuellePfad) {
      if ($sr) { $sr.Dispose() }; if ($fs) { $fs.Dispose() }
      $aktuellePfad = $ziel.Pfad
      Write-Host ""
      Write-Host ("=" * 78) -ForegroundColor Yellow
      $bez = $ziel.Titel; if (-not $bez) { $bez = $ziel.Id }
      Write-Host ("  $bez   [Quelle: $($ziel.Quelle)]") -ForegroundColor Yellow
      Write-Host ("  $($ziel.Id)") -ForegroundColor DarkGray
      Write-Host ("=" * 78) -ForegroundColor Yellow
      $fs = [System.IO.File]::Open($aktuellePfad, 'Open', 'Read', 'ReadWrite')
      # ca. 60 KB zurueck fuer etwas Kontext, dann live
      $start = [Math]::Max(0, $fs.Length - 60KB)
      [void]$fs.Seek($start, 'Begin')
      $sr = New-Object System.IO.StreamReader($fs, [Text.Encoding]::UTF8)
      if ($start -gt 0) { [void]$sr.ReadLine() }   # angeschnittene Zeile verwerfen
    }

    if ($sr) {
      while ($null -ne ($zeile = $sr.ReadLine())) {
        if (-not $zeile -or $zeile.Trim() -eq '') { continue }
        $o = $null
        try { $o = $zeile | ConvertFrom-Json } catch { continue }
        Zeige-Eintrag $o
      }
    }
    Start-Sleep -Milliseconds 800
  }
} finally {
  if ($sr) { $sr.Dispose() }
  if ($fs) { $fs.Dispose() }
}
