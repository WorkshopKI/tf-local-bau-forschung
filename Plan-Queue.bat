<# : batch header
@echo off
chcp 65001 >nul 2>&1
title TeamFlow - Plan-Queue
set "BATDIR=%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -Command "& ([ScriptBlock]::Create((Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8)))"
echo.
echo   Plan-Queue beendet. Fenster kann geschlossen werden.
pause >nul
exit /b
: end batch header #>

# ============================================================================
#  TeamFlow Plan-Queue  (v2 — mit Session-Auswahl)
#
#  Ablauf beim Start:
#   1. Zeigt die juengsten Claude-Code-Sessions dieses Projekts mit Titel
#      (gleiche Titel wie im `claude --resume`-Picker; Quelle: sessions-index.json).
#   2. Nummern in gewuenschter AUSFUEHRUNGS-Reihenfolge eingeben (z. B. "3 1 4"),
#      leer + Enter = keine neuen Auftraege, nur bestehende Queue abarbeiten.
#   3. Arbeitet _plans/queue.txt sequenziell ab: Headless-Resume pro Session,
#      hartes Gate (npm run check) nach jedem Lauf, Protokoll + .result nach done/.
#
#  queue.txt-Zeilenformat (wird von der Auswahl automatisch befuellt):
#   - Session-ID (UUID)  -> claude -p --resume <id>
#   - Pfad zu einer .md  -> claude -p "Lies <datei> und setze den Plan um"
#   - Leerzeilen / #-Kommentare werden ignoriert
#
#  Hinweis: sessions-index.json ist ein INTERNES Format von Claude Code und kann
#  sich mit Updates aendern. Bei Parse-Problemen faellt das Skript auf eine
#  einfache Dateiliste (UUID + Datum) zurueck — die Queue-Abarbeitung selbst
#  haengt nicht am Index.
# ============================================================================

# ---- Konfiguration ---------------------------------------------------------
$MaxTurns       = 120              # Schutz gegen Endlos-Laeufe pro Auftrag
$PermissionMode = 'acceptEdits'    # keine interaktiven Permission-Prompts
$GateBefehl     = 'npm run check'  # hartes Gate NACH jedem Lauf (unabhaengig vom Agenten)
$MaxAuftraege   = 20               # Notbremse pro Skript-Lauf
$MaxAnzeige     = 20               # wie viele Sessions im Picker zeigen

$ErrorActionPreference = 'Continue'   # externe Tools schreiben nach stderr — das ist kein Fehler
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = $env:BATDIR
if (-not $Root) { $Root = (Get-Location).Path }
Set-Location $Root
$Root = (Get-Location).Path.TrimEnd('\')

$PlansDir  = Join-Path $Root '_plans'
$QueueFile = Join-Path $PlansDir 'queue.txt'
$DoneDir   = Join-Path $PlansDir 'done'
$LogsDir   = Join-Path $PlansDir 'logs'
New-Item -ItemType Directory -Force -Path $PlansDir, $DoneDir, $LogsDir | Out-Null
if (-not (Test-Path $QueueFile)) {
  @(
    '# TeamFlow Plan-Queue — eine Zeile = ein Auftrag, oben = zuerst.',
    '# Session-ID (UUID) ODER Pfad zu einer Plan-Datei (.md).',
    ''
  ) | Set-Content -Path $QueueFile -Encoding UTF8
}

# ---- Hilfsfunktionen -------------------------------------------------------
function Show-Toast([string]$Titel, [string]$Text) {
  try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $tpl = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $txt = $tpl.GetElementsByTagName('text')
    $txt.Item(0).AppendChild($tpl.CreateTextNode($Titel)) | Out-Null
    $txt.Item(1).AppendChild($tpl.CreateTextNode($Text))  | Out-Null
    $toast = New-Object Windows.UI.Notifications.ToastNotification($tpl)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('TeamFlow Plan-Queue').Show($toast)
  } catch { [console]::Beep(880, 300) }
  Write-Host ""
  Write-Host ">> $Titel — $Text"
}

function Relatives-Alter($zeit) {
  try {
    $t = [datetime]$zeit
    $d = (Get-Date) - $t
    if ($d.TotalMinutes -lt 60)  { return ("{0} min" -f [int]$d.TotalMinutes) }
    if ($d.TotalHours   -lt 24)  { return ("{0} h"   -f [int]$d.TotalHours) }
    return ("{0} d" -f [int]$d.TotalDays)
  } catch { return '?' }
}

function Hole-Eigenschaft($obj, [string[]]$namen) {
  foreach ($n in $namen) {
    $p = $obj.PSObject.Properties[$n]
    if ($null -ne $p -and $null -ne $p.Value -and "$($p.Value)" -ne '') { return $p.Value }
  }
  return $null
}

# ---- Projektordner unter ~\.claude\projects finden -------------------------
function Finde-ProjektOrdner {
  $basis = Join-Path $env:USERPROFILE '.claude\projects'
  if (-not (Test-Path $basis)) { return $null }

  # Gemerkte Wahl?
  $merker = Join-Path $PlansDir 'projektordner.txt'
  if (Test-Path $merker) {
    $p = (Get-Content $merker -Encoding UTF8 | Select-Object -First 1).Trim()
    if ($p -and (Test-Path $p)) { return $p }
  }

  # Doku: Projektname = Arbeitsverzeichnis, Nicht-Alphanumerisches durch '-' ersetzt
  $gemunged = ($Root -replace '[^A-Za-z0-9]', '-')
  $kandidat = Join-Path $basis $gemunged
  if (Test-Path $kandidat) { return $kandidat }

  # Fallback: Ordner anbieten, Wahl merken
  $ordner = @(Get-ChildItem $basis -Directory | Sort-Object LastWriteTime -Descending)
  if ($ordner.Count -eq 0) { return $null }
  Write-Host ""
  Write-Host "Projektordner nicht automatisch gefunden (erwartet: $gemunged)."
  Write-Host "Bitte auswaehlen:"
  for ($i = 0; $i -lt [Math]::Min($ordner.Count, 10); $i++) {
    Write-Host ("  [{0}] {1}" -f ($i + 1), $ordner[$i].Name)
  }
  $wahl = Read-Host "Nummer (leer = abbrechen)"
  if ($wahl -match '^\d+$' -and [int]$wahl -ge 1 -and [int]$wahl -le $ordner.Count) {
    $gewaehlt = $ordner[[int]$wahl - 1].FullName
    Set-Content -Path $merker -Value $gewaehlt -Encoding UTF8
    return $gewaehlt
  }
  return $null
}

# ---- Dateinamen aus Session-Titel ------------------------------------------
function Mache-Slug([string]$titel, [int]$maxLaenge = 40) {
  if (-not $titel) { return 'ohne-titel' }
  $s = $titel
  $s = $s -replace 'ä','ae' -replace 'ö','oe' -replace 'ü','ue'
  $s = $s -replace 'Ä','Ae' -replace 'Ö','Oe' -replace 'Ü','Ue' -replace 'ß','ss'
  $s = $s -replace '[^A-Za-z0-9]+','-'          # alles Uebrige zu Bindestrichen
  $s = $s -replace '-+','-'
  $s = $s.Trim('-').ToLower()
  if ($s.Length -gt $maxLaenge) { $s = $s.Substring(0, $maxLaenge).Trim('-') }
  if (-not $s) { return 'ohne-titel' }
  return $s
}

# ---- Session-Liste bauen (Index bevorzugt, Dateiliste als Fallback) --------
function Hole-TitelAusTranskript([string]$pfad) {
  # Titel/Zusammenfassung stehen als eigene Eintraege im Transkript.
  # Nur Kopf + Ende lesen (Dateien werden bis 20 MB gross).
  $kandidat = $null
  $notnagel = $null
  $zeilen = @()
  try { $zeilen += Get-Content -LiteralPath $pfad -TotalCount 8 -Encoding UTF8 } catch { }
  try { $zeilen += Get-Content -LiteralPath $pfad -Tail 25 -Encoding UTF8 } catch { }

  foreach ($z in $zeilen) {
    if (-not $z -or $z.Trim() -eq '') { continue }
    $o = $null
    try { $o = $z | ConvertFrom-Json } catch { continue }

    # 1. Wahl: explizite Titel-/Summary-Eintraege (spaeterer gewinnt)
    $t = Hole-Eigenschaft $o @('customTitle','custom_title','title','summary')
    if ($t -and "$t".Trim() -ne '') { $kandidat = "$t" }

    # Notnagel: erste echte Nutzer-Nachricht
    if (-not $notnagel -and "$($o.type)" -eq 'user') {
      $inhalt = $null
      try {
        $c = $o.message.content
        if ($c -is [string]) { $inhalt = $c }
        elseif ($c -is [System.Array]) {
          foreach ($blk in $c) { if ("$($blk.type)" -eq 'text' -and $blk.text) { $inhalt = "$($blk.text)"; break } }
        }
      } catch { }
      if ($inhalt) {
        $inhalt = ($inhalt -replace '\s+', ' ').Trim()
        if ($inhalt -notmatch '^(/|\[|<)' -and $inhalt.Length -gt 2) {
          if ($inhalt.Length -gt 60) { $inhalt = $inhalt.Substring(0, 60) + '…' }
          $notnagel = $inhalt
        }
      }
    }
  }
  if ($kandidat) { return $kandidat }
  if ($notnagel) { return $notnagel }
  return '(ohne Titel)'
}

function Lade-Sessions([string]$projektOrdner) {
  # Dateizeit = Sortierbasis, Titel aus dem Transkript (Index-Feldnamen sind intern/instabil)
  $dateien = @(Get-ChildItem $projektOrdner -Filter '*.jsonl' -File -ErrorAction SilentlyContinue |
               Sort-Object LastWriteTime -Descending | Select-Object -First ($MaxAnzeige + 6))

  # Optional: Titel aus dem Index, falls dort brauchbare Werte stehen
  $indexTitel = @{}
  $indexPfad = Join-Path $projektOrdner 'sessions-index.json'
  if (Test-Path $indexPfad) {
    try {
      $roh = Get-Content $indexPfad -Raw -Encoding UTF8 | ConvertFrom-Json
      $eintraege = $null
      if ($roh -is [System.Array]) { $eintraege = $roh }
      else { foreach ($k in $roh.PSObject.Properties.Name) { if ($roh.$k -is [System.Array]) { $eintraege = $roh.$k; break } } }
      if ($null -ne $eintraege -and @($eintraege).Count -gt 0) {
        Set-Content -Path (Join-Path $LogsDir 'sessions-index-felder.txt') -Encoding UTF8 `
          -Value ((@($eintraege)[0].PSObject.Properties.Name) -join ', ')
        foreach ($e in $eintraege) {
          $id = Hole-Eigenschaft $e @('sessionId','session_id','id','uuid')
          $t  = Hole-Eigenschaft $e @('customTitle','custom_title','title','summary','name')
          if ($id -and $t) { $indexTitel["$id"] = "$t" }
        }
      }
    } catch { }
  }

  Write-Host "Lese Session-Titel…"
  $liste = @()
  foreach ($f in $dateien) {
    if ($f.Length -lt 60KB) {
      $probe = Hole-TitelAusTranskript $f.FullName
      if ($probe -like '*Antworte nur mit*') { continue }   # Wegwerf-Session des Vorab-Checks
    }
    $id = $f.BaseName
    $titel = $null
    if ($indexTitel.ContainsKey($id)) { $titel = $indexTitel[$id] }
    if (-not $titel -or $titel -eq '(ohne Titel)') { $titel = Hole-TitelAusTranskript $f.FullName }
    $liste += [pscustomobject]@{
      Id = $id; Titel = $titel; Modified = $f.LastWriteTime; Branch = ''
      Groesse = ('{0:N1} MB' -f ($f.Length / 1MB))
    }
  }
  return ($liste | Select-Object -First $MaxAnzeige)
}

# ---- Interaktive Auswahl -> Queue befuellen --------------------------------
$ProjektOrdnerGlobal = $null
function Session-Auswahl {
  $projektOrdner = Finde-ProjektOrdner
  $script:ProjektOrdnerGlobal = $projektOrdner
  if (-not $projektOrdner) {
    Write-Host "Kein Claude-Projektordner gefunden — nur bestehende Queue wird abgearbeitet."
    return
  }

  $sessions = @(Lade-Sessions $projektOrdner | Select-Object -First $MaxAnzeige)
  if ($sessions.Count -eq 0) {
    Write-Host "Keine Sessions gefunden — nur bestehende Queue wird abgearbeitet."
    return
  }

  $queueInhalt = @()
  if (Test-Path $QueueFile) {
    foreach ($z in (Get-Content $QueueFile -Encoding UTF8)) {
      $t = $z.Trim()
      if ($t -eq '' -or $t.StartsWith('#')) { continue }
      $queueInhalt += ($t -split '#')[0].Trim()
    }
  }

  Write-Host ""
  Write-Host "Sessions in diesem Projekt (neueste zuerst):"
  for ($i = 0; $i -lt $sessions.Count; $i++) {
    $s = $sessions[$i]
    $alter = Relatives-Alter $s.Modified
    $marke = ''
    if ($queueInhalt -contains $s.Id) { $marke = '  [schon in Queue]' }
    $branchTxt = ''
    if ($s.Groesse) { $branchTxt = " · $($s.Groesse)" }
    Write-Host ("  [{0,2}] {1}  ({2}{3}){4}" -f ($i + 1), $s.Titel, $alter, $branchTxt, $marke)
  }
  Write-Host ""
  Write-Host "Nummern in AUSFUEHRUNGS-Reihenfolge, durch Leerzeichen getrennt (z. B. '3 1 4')."
  $eingabe = Read-Host "Auswahl (leer = keine neuen Auftraege)"
  if (-not $eingabe.Trim()) { return }

  $nummern = $eingabe -split '[\s,;]+' | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ }
  $neu = 0
  foreach ($n in $nummern) {
    if ($n -lt 1 -or $n -gt $sessions.Count) { Write-Host "  (Nummer $n ignoriert — ausserhalb der Liste)"; continue }
    $s = $sessions[$n - 1]
    if ($queueInhalt -contains $s.Id) { Write-Host "  ($($s.Titel) ist schon in der Queue — uebersprungen)"; continue }
    Add-Content -Path $QueueFile -Encoding UTF8 -Value ("{0}  # {1}" -f $s.Id, $s.Titel)
    $queueInhalt += $s.Id
    $neu++
  }
  Write-Host "$neu Auftrag/Auftraege in die Queue uebernommen."
}

# ---- Queue-Verarbeitung ----------------------------------------------------
function Get-NaechsterAuftrag {
  if (-not (Test-Path $QueueFile)) { return $null }
  foreach ($z in (Get-Content $QueueFile -Encoding UTF8)) {
    $t = $z.Trim()
    if ($t -ne '' -and -not $t.StartsWith('#')) { return $z }
  }
  return $null
}

function Entferne-AusQueue([string]$RawZeile) {
  $alle = @(Get-Content $QueueFile -Encoding UTF8)
  $entfernt = $false
  $neu = foreach ($z in $alle) {
    if (-not $entfernt -and $z -eq $RawZeile) { $entfernt = $true; continue }
    $z
  }
  Set-Content -Path $QueueFile -Value ($neu -join "`r`n") -Encoding UTF8
}

function Baue-Prompt([string]$Art, [string]$Wert, [string]$ProtokollPfad) {
  $regeln = @(
    "Arbeitsweise: CLAUDE.md gilt. Read-before-write. Effort High.",
    "Gate: '$GateBefehl' selbst ausfuehren; nur bei Gruen committen (git commit -F mit Message-Datei, danach Message-Datei loeschen; keine Heredocs).",
    "Keine Rueckfragen moeglich (Headless): wenn kein sinnvoller Default existiert, brich sauber ab und schreibe STOPP mit Begruendung ins Protokoll.",
    "Keine Schreibzugriffe auf registry.json oder Dateien auf dem SMB-Share.",
    "Abschlussprotokoll zwingend nach $ProtokollPfad schreiben: umgesetzte Punkte, gewaehlte Defaults, Abweichungen vom Plan, offene Punkte, Gate-Ergebnis."
  ) -join ' '
  if ($Art -eq 'session') {
    return "Der Plan aus dieser Session ist freigegeben. Beginne SOFORT mit der Umsetzung, plane nicht erneut. $regeln"
  } else {
    return "Lies die Plan-Datei '$Wert' und setze den Plan vollstaendig um. $regeln"
  }
}

# ---- Auth: Token laden + Vorab-Check ---------------------------------------
function Pruefe-Auth {
  # Optional: Token aus _plans/oauth-token.txt (gitignoren!), falls keine Umgebungsvariable gesetzt
  $tokenDatei = Join-Path $PlansDir 'oauth-token.txt'
  if (-not $env:CLAUDE_CODE_OAUTH_TOKEN -and (Test-Path $tokenDatei)) {
    $t = (Get-Content $tokenDatei -Encoding UTF8 | Where-Object { $_.Trim() -ne '' } | Select-Object -First 1).Trim()
    if ($t) { $env:CLAUDE_CODE_OAUTH_TOKEN = $t; Write-Host "Token aus _plans/oauth-token.txt geladen." }
  }
  if ($env:CLAUDE_CODE_OAUTH_TOKEN) { Write-Host "Auth: CLAUDE_CODE_OAUTH_TOKEN gesetzt." }
  elseif ($env:ANTHROPIC_API_KEY)   { Write-Host "Auth: ANTHROPIC_API_KEY gesetzt." }
  else { Write-Host "Auth: keine Automatisierungs-Variable gesetzt — nutze gespeicherten Login (laeuft headless oft ab)." }

  Write-Host "Vorab-Check (kurzer Testlauf)…"
  $test = (& claude -p 'Antworte nur mit: OK' --max-turns 1 --output-format json 2>&1 | Out-String)
  $exit = $LASTEXITCODE
  $fehler = $false
  try { $o = $test | ConvertFrom-Json; if ($o.PSObject.Properties.Name -contains 'is_error') { $fehler = [bool]$o.is_error } } catch { }
  if ($exit -ne 0 -or $fehler) {
    Write-Host ""
    Write-Host "--- Vorab-Check fehlgeschlagen ---"
    $test -split "`n" | Select-Object -First 12 | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "Wahrscheinlich abgelaufene Anmeldung. Einmalig einrichten:"
    Write-Host "   claude setup-token"
    Write-Host "   setx CLAUDE_CODE_OAUTH_TOKEN \"sk-ant-oat01-...\""
    Write-Host "   (danach PowerShell neu oeffnen)"
    Show-Toast 'Plan-Queue: Auth fehlt' 'Vorab-Check fehlgeschlagen — keine Auftraege gestartet.'
    return $false
  }
  Write-Host "Vorab-Check OK."
  return $true
}

# ---- Hauptablauf ------------------------------------------------------------
Write-Host ''
Write-Host '--- Plan-Queue v9 ---'
if (-not (Pruefe-Auth)) { return }
Session-Auswahl

$fertig = 0
$startZeit = Get-Date

while ($fertig -lt $MaxAuftraege) {
  $rawZeile = Get-NaechsterAuftrag
  if ($null -eq $rawZeile) { break }
  $teile = $rawZeile -split '#', 2
  $eintrag = $teile[0].Trim()
  $zeilenTitel = ''
  if ($teile.Count -gt 1) { $zeilenTitel = $teile[1].Trim() }

  $istSession = $eintrag -match '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  if (-not $istSession -and -not (Test-Path $eintrag)) {
    Show-Toast 'Plan-Queue: STOPP' "Eintrag weder Session-ID noch existierende Datei: $eintrag"
    return
  }

  $stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
  if ($istSession) {
    $titelFuerName = $zeilenTitel
    if (-not $titelFuerName -and $ProjektOrdnerGlobal) {
      $jsonl = Join-Path $ProjektOrdnerGlobal ($eintrag + '.jsonl')
      if (Test-Path $jsonl) { $titelFuerName = Hole-TitelAusTranskript $jsonl }
    }
    $name = (Mache-Slug $titelFuerName) + '-' + $eintrag.Substring(0, 8)
  } else {
    $name = [IO.Path]::GetFileNameWithoutExtension($eintrag)
  }
  $logDatei      = Join-Path $LogsDir "$stamp-$name.json"
  $gateLog       = Join-Path $LogsDir "$stamp-$name.gate.log"
  $resultDatei   = Join-Path $DoneDir "$stamp-$name.result.md"
  $protokollPfad = "_plans/done/$stamp-$name.protokoll.md"

  Write-Host ""
  if ($zeilenTitel) { Write-Host "=== Auftrag: $zeilenTitel ===" } else { Write-Host "=== Auftrag: $eintrag ===" }
  Write-Host "    Session: $eintrag"
  Write-Host "    Log: $logDatei"
  $t0 = Get-Date

  # Aktuell laufenden Auftrag melden (Fortschritt.bat folgt dieser Datei)
  $aktuellDatei = Join-Path $PlansDir 'aktuell.txt'
  if ($istSession) { Set-Content -Path $aktuellDatei -Encoding UTF8 -Value @("$eintrag", "$zeilenTitel") }
  else             { Set-Content -Path $aktuellDatei -Encoding UTF8 -Value @('', "$eintrag") }

  $prompt = Baue-Prompt $(if ($istSession) { 'session' } else { 'datei' }) $eintrag $protokollPfad
  $claudeArgs = @('-p', $prompt, '--permission-mode', $PermissionMode, '--max-turns', "$MaxTurns", '--output-format', 'json')
  if ($istSession) { $claudeArgs += @('--resume', $eintrag) }

  $out = (& claude @claudeArgs 2>&1 | Out-String)
  $claudeExit = $LASTEXITCODE
  Set-Content -Path $logDatei -Value $out -Encoding UTF8

  $isError = $false
  try {
    $obj = $out | ConvertFrom-Json
    if ($null -ne $obj.result) { Set-Content -Path $resultDatei -Value $obj.result -Encoding UTF8 }
    if ($obj.PSObject.Properties.Name -contains 'is_error') { $isError = [bool]$obj.is_error }
  } catch {
    Write-Host "    (Hinweis: JSON-Output nicht parsebar — Rohlog liegt unter $logDatei)"
  }

  if ($claudeExit -ne 0 -or $isError) {
    Write-Host ""
    Write-Host "--- Ausgabe des fehlgeschlagenen Laufs (erste 30 Zeilen) ---"
    $out -split "`n" | Select-Object -First 30 | ForEach-Object { Write-Host "  $_" }
    Write-Host "--- Ende Ausgabe (vollstaendig in $logDatei) ---"
    Show-Toast 'Plan-Queue: STOPP' "Claude-Lauf fehlgeschlagen bei '$name' (Exit $claudeExit). Eintrag bleibt in der Queue."
    return
  }

  Write-Host "    Gate: $GateBefehl"
  & cmd /c "$GateBefehl 2>&1" | Out-File -FilePath $gateLog -Encoding UTF8
  $gateExit = $LASTEXITCODE
  if ($gateExit -ne 0) {
    Write-Host ""
    Write-Host "--- Gate-Ausgabe (letzte 25 Zeilen) ---"
    Get-Content $gateLog -Tail 25 -Encoding UTF8 | ForEach-Object { Write-Host "  $_" }
    Write-Host "--- Ende (vollstaendig in $gateLog) ---"
    Show-Toast 'Plan-Queue: GATE ROT' "'$GateBefehl' rot nach '$name'. Eintrag bleibt in der Queue. Log: $gateLog"
    return
  }

  Entferne-AusQueue $rawZeile
  $dauer = [int]((Get-Date) - $t0).TotalMinutes
  Add-Content -Path (Join-Path $DoneDir 'verlauf.log') -Encoding UTF8 -Value "$stamp  OK  ($dauer min)  $eintrag  $zeilenTitel"
  Write-Host "    OK ($dauer min) — Eintrag aus Queue entfernt."
  $fertig++
}

Remove-Item (Join-Path $PlansDir 'aktuell.txt') -ErrorAction SilentlyContinue

$gesamt = [int]((Get-Date) - $startZeit).TotalMinutes
$rest = Get-NaechsterAuftrag
if ($null -eq $rest) {
  Show-Toast 'Plan-Queue: fertig' "$fertig Auftrag/Auftraege gruen in $gesamt min. Queue ist leer."
} else {
  Show-Toast 'Plan-Queue: Limit erreicht' "$fertig Auftraege erledigt, Queue nicht leer (MaxAuftraege=$MaxAuftraege)."
}
