# TeamFlow Local — E2E-Test mit Claude Code Desktop Preview

Claude Code Desktop hat ein eingebautes Preview-MCP. Es startet den Dev-Server,
öffnet einen headless Browser und kann Screenshots machen, DOM inspizieren,
klicken, tippen und die Console lesen — alles direkt in der Desktop-App.

Starte die App-Preview mit name="teamflow" und führe dann ALLE folgenden Tests durch.

Für JEDEN Test:
- Führe die Aktion im Preview-Browser aus
- Mache einen Screenshot des Ergebnisses
- Prüfe die Console auf Errors
- Dokumentiere: ✅ Bestanden / ❌ Fehlgeschlagen + was genau schiefging

Am Ende: Erstelle TEST_REPORT.md mit allen Ergebnissen, Screenshots und Zusammenfassung.

═══════════════════════════════════════════════════
TESTBLOCK 1: APP-START & NAVIGATION
═══════════════════════════════════════════════════

TEST 1.1 — App lädt
- Öffne http://localhost:5173
- Erwartung: App rendert, Sidebar sichtbar ODER Onboarding-Dialog
- Prüfe Console: Keine Errors
- Screenshot: Initiale Ansicht

TEST 1.2 — Onboarding (falls noch nicht durchlaufen)
- Wenn Onboarding-Dialog sichtbar:
  - Name eingeben: "Test User"
  - Abteilung wählen: "Bauanträge"
  - Farbe wählen: Erste Farbe klicken
  - [Weiter] klicken
  - Verzeichnis-Schritt: [Ohne File Server starten] klicken (oder überspringen)
  - [Los geht's] klicken
- Erwartung: Shell mit Sidebar und Dashboard erscheint
- Screenshot: Dashboard nach Onboarding

TEST 1.3 — Sidebar Navigation
- Klick auf jeden Sidebar-Eintrag nacheinander:
  Home, Bauanträge, Forschung, Dokumente, Suche, AI Chat, Einstellungen, Admin
- Erwartung: Jeder Klick wechselt den Content-Bereich, kein Fehler
- Prüfe: Aktiver Eintrag ist visuell hervorgehoben
- Screenshot: Mindestens 3 verschiedene Plugins

TEST 1.4 — Sidebar Collapse
- Hamburger-Icon klicken → Sidebar klappt ein
- Nochmal klicken → Sidebar klappt aus
- Erwartung: Transition smooth, Content passt sich an
- Screenshot: Eingeklappter Zustand

═══════════════════════════════════════════════════
TESTBLOCK 2: BAUANTRÄGE CRUD
═══════════════════════════════════════════════════

TEST 2.1 — Leerer Zustand
- Bauanträge Plugin öffnen
- Erwartung: Empty State mit Hinweis "Noch keine Bauanträge" oder ähnlich
- Screenshot

TEST 2.2 — Neuen Bauantrag erstellen
- [+ Neuer Antrag] Button klicken
- Dialog: Titel eingeben "Neubau EFH Teststraße 1"
- Priorität: "Hoch" wählen
- [Speichern] klicken
- Erwartung: Dialog schließt, Antrag erscheint in der Liste
- Screenshot: Liste mit neuem Antrag

TEST 2.3 — Zweiten Bauantrag erstellen
- Nochmal [+ Neuer Antrag]
- Titel: "Anbau Dachgeschoss Musterweg 5"
- Priorität: "Normal"
- [Speichern]
- Erwartung: Zwei Anträge in der Liste, verschiedene IDs (BA-20XX-001, BA-20XX-002)
- Screenshot

TEST 2.4 — Detail-Ansicht
- Ersten Antrag in der Liste klicken
- Erwartung: Detail-Ansicht mit Titel, ID, Status-Dropdown, Tabs
- Prüfe: Tabs vorhanden (Übersicht, Dokumente, Artefakte, Notizen)
- Screenshot: Detail-Ansicht

TEST 2.5 — Status ändern
- Status-Dropdown auf "In Bearbeitung" ändern
- Erwartung: Status wird aktualisiert, Badge in der Liste ändert sich
- Zurück zur Liste gehen
- Prüfe: Status-Badge zeigt neuen Status
- Screenshot

TEST 2.6 — Notizen
- Detail-Ansicht öffnen → Notizen-Tab
- Text eingeben: "Testnotiz: Grundstück im Hochwassergebiet"
- Kurz warten (auto-save)
- Erwartung: "Gespeichert" Indikator erscheint
- Seite neu laden (oder Plugin wechseln und zurück)
- Notizen-Tab öffnen
- Erwartung: Text ist noch da
- Screenshot

TEST 2.7 — Bearbeiten
- Detail-Ansicht → [Bearbeiten] Button
- Titel ändern auf "Neubau EFH Teststraße 1 (geändert)"
- [Speichern]
- Erwartung: Titel aktualisiert sich überall
- Screenshot

TEST 2.8 — Löschen
- Detail-Ansicht → [Löschen] Button
- Bestätigungs-Dialog erscheint
- [Bestätigen/Löschen]
- Erwartung: Zurück zur Liste, Antrag ist weg
- Screenshot

TEST 2.9 — Filter
- Mindestens 2 Anträge mit verschiedenen Status anlegen
- Status-Filter auf einen bestimmten Status setzen
- Erwartung: Nur passende Anträge sichtbar
- Suchfeld: Teilstring eines Titels eingeben
- Erwartung: Nur passender Antrag sichtbar
- Screenshot

═══════════════════════════════════════════════════
TESTBLOCK 3: DOKUMENTE
═══════════════════════════════════════════════════

TEST 3.1 — Dokumente-Plugin
- Dokumente-Plugin öffnen
- Erwartung: Upload-Zone sichtbar, leere Liste (oder vorhandene Docs)
- Screenshot

TEST 3.2 — Markdown Upload
- Eine .md Datei erstellen (echo "# Test\nDies ist ein Test" > /tmp/test.md)
- Datei in die Upload-Zone ziehen/hochladen
  (Falls Drag&Drop im Preview nicht geht: Prüfe ob ein Datei-Input existiert)
- Erwartung: Dokument erscheint in der Liste
- Screenshot

TEST 3.3 — Dokument Preview
- Auf das hochgeladene Dokument klicken
- Erwartung: Markdown wird gerendert angezeigt
- Screenshot

═══════════════════════════════════════════════════
TESTBLOCK 4: EINSTELLUNGEN & THEME
═══════════════════════════════════════════════════

TEST 4.1 — Darstellung: Farbwechsel
- Einstellungen öffnen → Darstellung Tab
- Andere Farbe klicken (z.B. Grün oder Violett)
- Erwartung: Akzentfarbe ändert sich sofort (Focus-States, Links, etc.)
- Screenshot vorher + nachher

TEST 4.2 — Dark Mode
- Dark Mode Toggle aktivieren
- Erwartung: Gesamte App wechselt in Warm-grau Dark Mode
- Prüfe: Hintergrund ist warm-dunkel (#2a2a28 Bereich), nicht kalt-schwarz
- Prüfe: Text ist warm-hell, nicht reines Weiß
- Prüfe: Badges sind gedämpft, nicht knallig
- Screenshot: Dark Mode Gesamtansicht
- Screenshot: Dark Mode Bauanträge-Liste (falls Anträge vorhanden)

TEST 4.3 — Dark Mode Details
- Im Dark Mode: Buttons prüfen
- Primary Button: Heller Text auf dunklem Hintergrund (oder umgekehrt)?
- Danger Button: Nur roter Rand, nicht roter Hintergrund?
- Tabs: Heller Underline, nicht farbiger?
- Inputs: Transparenter Hintergrund, subtile Borders?
- Screenshot: Komponenten im Dark Mode

TEST 4.4 — Theme Persistenz
- Seite neu laden
- Erwartung: Dark Mode und gewählte Farbe bleiben erhalten
- Screenshot

═══════════════════════════════════════════════════
TESTBLOCK 5: SUCHE
═══════════════════════════════════════════════════

TEST 5.1 — Keyword-Suche
- Suche-Plugin öffnen
- Suchbegriff eingeben der in einem Bauantrag vorkommt (z.B. "Neubau")
- Erwartung: Ergebnis erscheint mit Titel/Snippet
- Screenshot

TEST 5.2 — Leere Suche
- Suchbegriff eingeben der nichts findet: "xyznonexistent"
- Erwartung: "Keine Ergebnisse" Hinweis
- Screenshot

═══════════════════════════════════════════════════
TESTBLOCK 6: AI CHAT
═══════════════════════════════════════════════════

TEST 6.1 — Chat öffnen
- Chat-Plugin öffnen
- Erwartung: Begrüßungstext oder leerer Chat, Input-Feld sichtbar
- Screenshot

TEST 6.2 — Nachricht senden (erwartet Fehler)
- "Hallo Test" eintippen und senden
- Erwartung: Loading-State → Error "Nicht verbunden" oder ähnlich
  (Da kein AI-Provider konfiguriert ist, ist ein Fehler das korrekte Verhalten!)
- Prüfe: Retry-Button oder Fehlermeldung sichtbar
- Screenshot

═══════════════════════════════════════════════════
TESTBLOCK 7: KEYBOARD SHORTCUTS
═══════════════════════════════════════════════════

TEST 7.1 — Command Palette
- Cmd/Ctrl+K drücken
- Erwartung: Command Palette öffnet sich
- "bau" tippen → "Bauanträge" in der Liste
- Enter drücken → Plugin wechselt zu Bauanträge
- Screenshot: Command Palette offen

TEST 7.2 — Sidebar Toggle
- Cmd/Ctrl+/ drücken
- Erwartung: Sidebar toggled
- Screenshot

═══════════════════════════════════════════════════
TESTBLOCK 8: CONSOLE-CHECK
═══════════════════════════════════════════════════

TEST 8.1 — Console Errors
- Öffne die Console und prüfe auf Error-Level Einträge
- Dokumentiere JEDEN Console Error mit der Meldung
- Warnings separat auflisten
- Erwartung: Keine Console Errors (Warnings sind OK)

═══════════════════════════════════════════════════
TESTBLOCK 9: DATENPERSISTENZ
═══════════════════════════════════════════════════

TEST 9.1 — Reload-Test
- Mehrere Bauanträge anlegen (falls nicht schon vorhanden)
- Seite komplett neu laden
- Erwartung: Alle Daten (Anträge, Notizen, Theme, Profil) sind noch da
- Screenshot: Nach Reload

═══════════════════════════════════════════════════
TESTPROTOKOLL ERSTELLEN
═══════════════════════════════════════════════════

Erstelle TEST_REPORT.md im Projekt-Root mit folgendem Format:

# TeamFlow E2E-Testprotokoll

**Datum**: {aktuelles Datum}
**Getestet von**: Claude Code (automatisiert)
**App-Version**: (aus package.json)
**Browser**: Claude Code Desktop Preview (Chromium)
**Modus**: Dev-Server (npm run dev)

## Zusammenfassung

| Kategorie | Bestanden | Fehlgeschlagen | Übersprungen |
|---|---|---|---|
| App-Start & Navigation | X/4 | X/4 | X/4 |
| Bauanträge CRUD | X/9 | X/9 | X/9 |
| Dokumente | X/3 | X/3 | X/3 |
| Einstellungen & Theme | X/4 | X/4 | X/4 |
| Suche | X/2 | X/2 | X/2 |
| AI Chat | X/2 | X/2 | X/2 |
| Keyboard Shortcuts | X/2 | X/2 | X/2 |
| Console-Check | X/1 | X/1 | X/1 |
| Datenpersistenz | X/1 | X/1 | X/1 |
| **Gesamt** | **X/28** | **X/28** | **X/28** |

## Ergebnis: ✅ BESTANDEN / ❌ FEHLGESCHLAGEN / ⚠ TEILWEISE

## Details

### Testblock 1: App-Start & Navigation
(Pro Test: Status-Emoji, was getestet wurde, was beobachtet wurde, ggf. Fehler)

### Testblock 2: Bauanträge CRUD
...

(Für jeden Testblock)

## Console Errors
(Liste aller gefundenen Console Errors, oder "Keine Console Errors gefunden")

## Console Warnings
(Liste aller Warnings, gruppiert)

## Screenshots
(Referenzen auf die gespeicherten Screenshots)

## Empfehlungen
(Was sollte gefixt werden? Priorisiert nach Schwere)

---

Speichere die Screenshots als Dateien im Projekt unter tests/screenshots/.
Committe TEST_REPORT.md und die Screenshots.
```
