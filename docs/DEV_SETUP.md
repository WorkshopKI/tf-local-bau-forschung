# Dev-Setup TeamFlow

Kurz-Anleitung für Entwickler. Voraussetzung: Dev-Build (`npm run build:dev`) oder
Dev-Server (`npm run dev`), also eine Variante mit `features.devFixtures: true`.

## Einmaliges Setup

1. **Dev-Daten-Ordner anlegen** irgendwo im Dateisystem, z.B.
   `C:\01b-code\fzd\teamflow-dev-daten\`. Der Ordner bleibt über alle
   Iterations hinweg bestehen.
2. **Pfad** in [`configs/dev.config.json`](../configs/dev.config.json) unter
   `dev.dataSharePath` eintragen (rein informativ — der File-System-Access-
   API-Picker muss trotzdem einmal manuell auf den Ordner gesteuert werden,
   Browser-Sicherheit).
3. **Erstes Starten:** App öffnen, einmal im Welcome-Screen `Ordner auswählen`
   klicken und den Dev-Daten-Ordner wählen. Danach persistiert die App das
   Handle in IndexedDB.
4. **Einmal Kurator einrichten:** Entweder über das Szenario-Menü `Kurator
   bereit` (legt Kurator-Config mit Default-Passwort `dev` an) oder manuell
   im Dev-Infra-Test-Panel.

## Dev-Quick-Bar

Oben in der App (schmale gelbe Leiste) — nur sichtbar bei `devFixtures: true`:

- **Szenario-Dropdown:** vier Basis-Zustände zum Wiederherstellen:
  - `Frisch` – alle IDB-Stores leeren (SMB-Handle bleibt erhalten)
  - `Kurator bereit` – Reset + aktive Kurator-Session, noch keine Daten
  - `Mit Testdaten` – Kurator + 3 Mini-CSVs (~20 Anträge)
  - `Voll populiert` – Kurator + Big-Korpus (5000+3000 Zeilen)
- **Spezialfälle-Dropdown:**
  - `Encoding-Tests` – DE-Format-CSVs (Windows-1252 + Semikolon + Umlaute + €)
  - `Unterprogramm-Vielfalt` – Master-CSV mit 4 Unterprogrammen (40 Anträge)
- **Offline 60s** – simuliert temporär SMB-Offline-Status
- **State** – Dumpt kompletten IDB-State als JSON in die Zwischenablage
- **Inspector** – öffnet den State-Inspector
- **Infra** – öffnet das Dev-Infra-Test-Panel

## State-Inspector

Route `#/dev-state-inspector`. Zeigt:

- IDB-Store-Counts mit Sample-Ansicht (erste 20 Items als JSON)
- SMB-Handle-Status + Permission
- Kurator-Session-Status, Name, Ablauf-Countdown
- Feature-Flag-Tabelle der aktuellen Runtime-Config
- Build-Info (Variant, Git-Hash, Build-Zeit)

## 30-Tage-Session

Bei `dev.sessionTtlDays: 30` (Default in Dev-Config) wird die Kurator-Session-
TTL auf 30 Tage gesetzt, sobald ein Dev-Szenario die Session aktiviert. Danach
hält die Session über App-Restarts und Browser-Neustarts hinweg — kein
Passwort-Reentry zwischen Patch-Tests.

## Auto-SMB-Permission-Refresh

Bei `dev.autoRefreshSmbPermission: true` (Default in Dev-Config) wird beim
ersten User-Click nach App-Start automatisch `requestPermission()` auf das
SMB-Handle aufgerufen. Damit entfällt das manuelle „Zugriff erneuern" nach
Browser-Restarts. Das geht nur in User-Gesture-Kontext, daher an den
allerersten Click gekoppelt.

## Was Fixtures NICHT können

- **Kein File-System-Access-API-Bypass:** Der allererste Ordner-Picker beim
  Welcome-Screen bleibt manuell. Das ist Browser-Sicherheit, kein Fixture-Bug.
- **Kein Time-Travel:** Das Szenario-System manipuliert keine Zeit-Offsets
  (Backup-Timestamps, Historie). Für Zeit-abhängige Tests System-Uhr
  umstellen oder das entsprechende Datum manuell in IDB überschreiben.
- **Kein Dokument-Scan:** Phase 2 ist nicht implementiert. Fixtures beziehen
  sich nur auf CSV-basierte Anträge.
- **Keine Echt-Daten-Sicherheit:** Fixture-Aufrufe sind destruktiv.
  `resetAll()` leert alle IDB-Stores — der SMB-Handle bleibt zwar erhalten,
  aber alle Anträge, Schemas, Sessions, Filter sind danach weg. In Prod-Builds
  ist der ganze Code-Pfad strukturell blockiert (Schema-Validation + Tree-
  Shaking).

## Strukturelle Blockade in Demo/Prod

`features.devFixtures: true` in `configs/demo.config.json` oder
`configs/foerderprogramm.config.json` bricht den Build mit KRITISCH-Fehler ab
(siehe [`scripts/config-schema.mjs`](../scripts/config-schema.mjs)).

Zusätzlich verifiziert `grep` im Prod-Bundle, dass kein Fixture-Symbol
(`applyScenario`, `FIXTURE_SCHEMAS`, `importTestCsv`, `FixturesPanel`, …)
enthalten ist. Der Vite-Compile-Time-Define `__TEAMFLOW_DEV_FIXTURES__`
erlaubt Rollup dead-code elimination.
