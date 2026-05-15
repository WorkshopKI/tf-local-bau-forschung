# Kompetenz-Onboarding (Standalone HTML)

Single-File-App für neue Mitarbeiter, die das TeamFlow-Auslastungs-Modul noch
nicht nutzen können (kein SMB-Zugang, kein Profil).

## Workflow

1. **PL erzeugt die HTML:** TeamFlow → Auslastung → Admin → Mitarbeiter →
   „Onboarding-HTML generieren". Eine `kompetenz-onboarding.html` (~250 KB) wird
   heruntergeladen.
2. **PL schickt die HTML** per E-Mail an den neuen MA.
3. **MA öffnet die HTML lokal** (Doppelklick — funktioniert unter `file://`
   ohne Netzwerk oder Server).
4. **MA durchläuft den Wizard:**
   - Welcome → Kürzel eintragen
   - Profil → Fachrichtung, Abschluss, Freitext-Beschreibung
   - Swipe → 30-60 Beispiel-Anträge mit „Kann ich" / „Teilweise" / „Nicht meins" bewerten
     (adaptive Verkürzung: einheitlich bewertete Kategorien werden übersprungen)
   - Zusammenfassung → Überkategorien manuell anpassen, optionale Technologien ergänzen
   - „XLSX herunterladen" → `onboarding-<KUERZEL>.xlsx` wird im Download-Ordner abgelegt
5. **MA schickt die XLSX zurück** per E-Mail an die PL.
6. **PL importiert die XLSX:** TeamFlow → Auslastung → Admin → Mitarbeiter →
   „Onboarding-XLSX importieren". Mehrere Dateien gleichzeitig möglich.
7. **MA ist im Matching aktiv** — virtuelle Projekte (Confidence 0.7 für „Kann
   ich", 0.3 für „Teilweise") werden in der Embedding-Stufe genau wie echte
   historische Projekte ausgewertet.

## Technisches

- **Single-File HTML**, vollständig offline-fähig nach dem ersten Öffnen
- **Vanilla JS**, kein Framework, kein CDN
- **Inline SheetJS** (`xlsx.mini.min.js`) für den XLSX-Export
- **Eingebetteter JSON-Blob** mit Beispiel-Anträgen + Überkategorie-Konfiguration
  aus dem aktiven Förderprogramm

Der Generator-Service liegt unter
[src/plugins/auslastung/services/onboarding-html-generator.ts](../../src/plugins/auslastung/services/onboarding-html-generator.ts).
Das Template `template.html` wird vom Generator zur Build-Zeit via Vite-`?raw`-
Import gelesen und die zwei Platzhalter `{{XLSX_SCRIPT}}` und `{{ONBOARDING_DATA}}`
werden ersetzt.

## Kalibrierung

Bevor der Import-Pfad produktiv genutzt wird, empfiehlt sich eine Kalibrierung
mit 5-10 bestehenden MAs:

1. PL lässt die HTML auch von bestehenden MAs (die schon historische Anträge
   haben) ausfüllen.
2. PL importiert deren XLSX über den gleichen Dialog → der wechselt automatisch
   in den Kalibrierungs-Modus.
3. Der Kalibrierungs-Report vergleicht „Onboarding-Ranking" gegen
   „Historisches Ranking" → Spearman-Korrelation + Top-3-Overlap +
   Klassifizierungs-Accuracy.
4. Grid-Search über Confidence-Faktoren (0.1..1.0 in 0.1-Schritten) findet die
   optimalen Werte → „Übernehmen" schreibt sie als Default in
   `auslastung.json`.

Ziel: Spearman > 0.7 + Top-3-Overlap > 70% bevor neue MAs damit arbeiten.

## Anpassen des Templates

Bei UI-Änderungen am Template:
- Editiere `template.html` (Vanilla JS + Inline CSS)
- Neuer Build von TeamFlow (`npm run build:dev`) reicht — Vite liest das
  Template via `?raw` zur Build-Zeit
- Smoke-Test: TeamFlow → „Onboarding-HTML generieren" → Datei doppelklicken
  → durchklicken → XLSX-Download prüfen
