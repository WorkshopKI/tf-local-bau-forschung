# Prompt: Vorgangssystem — Status-Erklärung, To-do-Board, Wächter, Cockpit (Phasen 0–6)

**Modus:** Plan Mode, Effort High. Arbeite die Phasen 0–6 nacheinander ab. Jede Phase endet mit `npm run check` (typecheck + test + build:dev). Grün → Git-Commit → Protokollblock → `/compact` → nächste Phase, ohne Rückfrage. STOPP nur, wenn kein sinnvoller Default existiert (jeder gewählte Default kommt ins Protokoll).

---

## Vorbereitung (READ-BEFORE-WRITE, Pflicht)

Lies vor jeder Code-Änderung:

1. `CLAUDE.md` — insbesondere Critical Constraints, Pitfalls #9, #10, #11, #12, #15, #22, #23, #24, #25, #27
2. `DESIGN_GUIDE.md`
3. `docs/architecture/vorgangssystem.md` (= Konzept, liegt bereit) und `docs/architecture/todo-regeln-ab-seed.md` (= Regel-Seed) — **fachliche Quelle der Wahrheit für diesen Prompt**
4. `docs/agents/add-plugin.md`, `add-idb-store.md`, `add-sidecar-persistence.md`, `add-feature-flag.md`, `async-error-pattern.md`
5. Bestandscode: `src/core/utils/status-canonical.ts`, `src/core/status/` (Snapshot/Katalog), das bestehende Status-Katalog-Plugin (Tabs Katalog/Felder/Regeln), `src/plugins/antraege/` (Views, Filter, `bearbeiterFilter.ts`), das Plugin „Fristen & Meilensteine", `src/core/types/csv/types.ts` (Antrag-Modell, wie die 512 Felder am Antrag hängen), `src/core/hooks/useMeinKuerzel.ts`, Kompetenz-XLSX-Import als Referenz für XLSX-Parsing (`kompetenz-import.ts`)

## Globale Leitplanken

- **Die App leitet keinen Status ab.** `STATUS_TV`/`STATUS_VB` werden angezeigt wie importiert. Alle neuen Berechnungen (To-do, Wächter, Fristen) sind Zusatzinformationen daneben.
- **Determinismus:** Alle Regel-/Fristen-Funktionen sind pure functions mit **injiziertem `stichtag: Date`** — niemals `new Date()` innerhalb der Engine. Der Aufrufer (Hook) liefert den Stichtag.
- **NFC überall:** Jeder Text-Join (Status-Text ↔ Katalog, Kürzel ↔ Katalog) läuft über `normalize('NFC')` + trim + lowercase. Ein zentraler Helper, ein Unit-Test mit NFD-Fixture.
- **Ehrlichkeit:** Kein stiller Fallback. Unbekannter Status-Text → sichtbar „nicht im Katalog". Kein To-do ermittelt → „kein To-do ermittelt". Nicht parsebare Trigger-Zeile → „nicht interpretiert" + Rohtext.
- **Schreibrechte:** Alle vier Pflegelisten und Referenz-Importe werden nur von PL/Kurator geschrieben (`canWriteDatenShare()` bzw. Kurator-Session, Pitfall #24/#25). prod-User lesen nur. Alle Share-Writes via `atomicWrite()` (Pitfall #10), Profil idempotent-overwrite (Pitfall #23).
- **Feature-Flag:** Neues Flag `features.vorgangssystem` (Pitfall #11): default `false`, `true` in `dev.config.json` und `pl.config.json`. Gatet alle neuen UI-Teile (Info-Icon, Glossar, Board, Wächter, Cockpit-Erweiterung).
- **Konventionen:** `useAsyncAction` für alle async UI-Aktionen (Pitfall #15). `useMeinKuerzel()` für Kürzel (Pitfall #27). Keine direkten Status-Literal-Vergleiche (Pitfall #12) — der Text→Code-Join ist eine Map-Lookup-Boundary, kein Vergleich; falls der Convention-Test anschlägt, `// allow-status-literal: Katalog-Join-Boundary` mit Begründung. 300-Zeilen-Soft-Limit; Ausnahme erlaubt für die statische Seed-Datei.
- **Windows-Shell:** keine Heredocs; mehrzeilige Commits via `git commit -F <tempfile>`.

## Anti-Patterns (in jeder Phase prüfen)

- ❌ Status aus Feldern/Rängen/Ordnern ableiten — gibt es nicht mehr
- ❌ Prioritätszahlen an Regeln — Reihenfolge = Zeilenreihenfolge, erste zutreffende Regel gewinnt
- ❌ `new Date()` in Engine-Funktionen
- ❌ Referenzdaten (Status-Codes, Kürzel, Trigger) hart im Komponenten-Code — nur Seed-Modul + Import
- ❌ Pflegelisten in localStorage oder registry — Share-Sidecar + IDB-Cache
- ❌ Erklärtexte von Hand, die veralten können — Popover rendert Daten (Trigger-Sätze, D-Felder)
- ❌ Bauantrag-Domain anfassen (dev/demo-only, bleibt auf alter Map)
- ❌ Mehrere `persist`-Aufrufe pro Aktion (Pitfall #16/#20)

---

## Seed-Daten (in Phase 0 als committete TS-Module anlegen)

### Status-Katalog (Code ↔ Text; Quelle Legacy-Parametertabelle)

11 Skizze eingegangen · 29 Irrläufer · 31 beantragt · 32 ablehnungsreif · 33 unvollständig · 34 bearbeitungsreif · 35 NF gestellt · 36 NL eingegangen · 37 keine weiteren NF · 38 techn geprüft · 39 kaufm geprüft · 40 Gutachten fertig · 50 Bewilligungsentwurf VDI/VDE-IT · 51 bewilligungsreif · 59 bewilligt · 70 Ablehnung versandt · 71 Rücknahmeempfehlung versandt · 72 Stellungnahme zur Rücknahmeempfehlung · 73 abgelehnt/zurückgezogen · 75 Widerspruch zur Ablehnung · 88 Sonderstatus · 89 Anhörung zum Widerruf · 90 abgebrochen · 91 beendet · 92 Widerruf · 93 assoziierter Partner · 94 internationaler Partner · 95 VN technisch geprüft · 97 VN geprüft · 99 Schlussvermerk

Beim Text-Join zusätzlich bekannte Varianten mitführen (z. B. „Stellungnahme zur Rücknahmeempf." = 72, „NF gestellt"/„nf gestellt", „VN geprüft"/„vn geprüft"). Varianten-Liste pro Eintrag (`varianten: string[]`), erweiterbar.

### ZAH-Phasen (Zuordnung Status-Code → Phase; Konzept Abschnitt 5, abgestimmt)

| ZAH-Phase | Codes |
|---|---|
| eingang | 11, 31 |
| vollstaendigkeit | 33, 34, 35, 36, 37 |
| pruefung | 38, 39, 40 |
| entscheidung | 32, 50, 51, 70, 71, 72, 75 |
| begleitung | 59, 89, 92, 95, 97 |
| abgeschlossen | 73, 90, 91, 99 |
| (Marker, ohne Phase) | 29, 88, 93, 94 |

### Fördervariante (`VB_PHASE`-Decode)

1 = NW 1 · 2 = NW 2 · 3 = FuE · 4 = DL · 5 = DS · 9 = Irrläufer

### Rollen

`AB` (administrativ), `FB` (fachlich), `QS`, `PA`, `Juristen`, `neutral`. Zuständigkeits-Spalten: FB = `TIB_KUERZ` (Begleitung `ZTP`), AB = `BIB_KUERZ` (bzw. BFM/PFM).

### To-do-Regeln

Vollständig in `docs/architecture/todo-regeln-ab-seed.md` (25 Regeln R1–R25, 2 Sperren S1–S2, Kaskaden-Reihenfolge). 1:1 als Seed übernehmen, inkl. der dort dokumentierten bereinigten Mappen-Fehler.

---

## Phase 0 — Fundament: Domänenmodul, Seeds, Referenz-Importe

**Ziel:** Neues Kern-Modul `src/core/services/vorgangssystem/` mit Typen, Seeds, XLSX-Importern, Trigger-Parser und Text↔Code-Join. Noch keine sichtbare UI außer Import-Panel.

1. **Typen** (`types.ts`): `StatusKatalogEintrag { code, text, varianten, zahPhaseId | null, marker, zieltage | null }`, `ZahPhase { id, label, reihenfolge }`, `KuerzelEintrag { kuerzel, beschreibung, rollen: Rolle[], relevant: boolean, dSpalte?: string, tSpalte?: string }`, `TriggerZeile { kuerzel, folge, prozedur, parameterRoh, geparst: TriggerParam | null, satz: string }`, `TodoRegel { id, reihenfolge, bedingungen: Bedingung[], todo, zustaendig: Rolle[], wartetAuf?: 'FB'|'AB'|'QS'|'ASt'|null, aktiv }`, `Bedingung` als Union der sechs Typen (feldGefuellt, feldLeer, datumNach, tageSeitFeldGroesser, heuteNachTermin, statusIst, foerdervarianteIn — statusIst und foerdervarianteIn sind zwei davon, zähle sauber). Alles mit `version`-Feld auf den Katalog-Containern.
2. **Seeds** (`seed.ts`, statische Daten-Datei, >300 Zeilen erlaubt): Status-Katalog, ZAH-Phasen, Fördervariante, To-do-Regeln R1–R25 + S1–S2 aus der Seed-Doku.
3. **Normalisierung** (`normalisierung.ts`): `normKey(s) = s.normalize('NFC').trim().toLowerCase()` + Text→Code-Join `findStatusCode(text): { code, eintrag } | null` über text + varianten. Unit-Tests inkl. NFD-Umlaut-Fixture („techn geprüft" NFD ↔ NFC) und Varianten-Treffer.
4. **Trigger-Parser** (`trigger-parser.ts`): parst die vier Prozedurtypen (`TRG_TVs_Status_TV_VB`: `<59|ABB|YIRR||||31|31`-Schema mit 8 Argumenten lt. Legacy-Doku; `TRG.VorgEintragNeu`: Code|Bezugsdatei|Tage; `TRG.VorgEintragMail`: Empfänger|Textbaustein|CC; `TRG.Status.TV.VB`: Datei|Statuskürzel). Ausgabe zusätzlich als deutscher Satz (`satz`). Nicht parsebar → `geparst: null`, `satz` = „Nicht interpretiert: <Rohtext>". Unit-Tests mit den Fixture-Zeilen aus dem Anhang von `docs/architecture/todo-regeln-ab-seed.md` (14 Zeilen inkl. erwarteter Satzformen; Parser tolerant gegenüber abweichender Anzahl leerer Pipe-Argumente).
5. **Zugriffsschicht Antrag-Felder** (`feld-zugriff.ts`): Nach Lesen des realen Antrag-Modells eine Funktion `feldDatum(antrag, 'D_ARZ'): Date | null` und `feldWert(antrag, 'T_XPC+')` definieren (Default: Zugriff über die CanonicalField-/Felder-Map des CSV-Schemas; robust gegen fehlende Spalte → null).
6. **Persistenz:** Sidecar `_intern/vorgangssystem/` mit `status-katalog.json`, `kuerzel-katalog.json`, `trigger-tabelle.json`, `pflege.json` (Relevanz, Zieltage, ZAH-Phasen-Overrides, To-do-Regeln). Profil idempotent-overwrite via `atomicWrite()`, Header-Kommentar mit Schreibprofil (Pitfall #23). IDB-Cache-Store `vorgangssystem` (Cheatsheet add-idb-store). Ladelogik: Share → IDB-Cache → Seed-Fallback, **mit sichtbarem Herkunfts-Status** (`quelle: 'share' | 'cache' | 'seed'` + Version) — kein stiller Fallback.
7. **XLSX-Importer** (`import/`): drei Importer (Kürzel-Katalog: Spalten Kürzel/Beschreibung/„wird gesetzt von" — Rollen-Split an „/", „neutral" = alle; Trigger-Tabelle: Richtlinie/Kürzel/Folge/Prozedur/Parameter; Status-Katalog: Code/Text). Header-tolerant (Spalten per Namen finden, nicht per Index); passt kein Header → Fehlermeldung mit gefundenen Headern, kein Raten. Nach Parse: **Diff-Vorschau** (neu/geändert/entfallen) vor dem Übernehmen; Übernahme schreibt neue Version (`version++`, `geaendertAm`, `geaendertVon` aus Kurator-/Build-Label).
8. **Import-Panel:** im bestehenden Status-Katalog-Plugin ein neuer Bereich „Referenzdaten" (Flag-gated): drei Import-Buttons + Versions-/Herkunfts-Anzeige + Diff-Dialog. Schreib-Buttons nur bei Schreibrecht.
9. **Tests:** Parser-Fixtures, NFC-Join, Diff-Berechnung, Ladelogik-Fallback-Kette.

Gate: `npm run check` → Commit `feat(vorgangssystem): Fundament — Typen, Seeds, Referenz-Importe, Trigger-Parser` → Protokoll → `/compact`.

## Phase 1 — Status-Erklärung (Info-Icon)

**Ziel:** Graues Info-Icon an jeder Status-Anzeige (Antragsliste Status-Spalte, Antrag-Detail, Verbund-Status, Home-Aggregate wo Status gezeigt wird), Flag-gated.

1. `HerleitungPopover`-Komponente + Hook `useStatusErklaerung(antrag, stichtag)`. Inhalt exakt nach Konzept 6.1: Code + Text + „seit" (jüngstes relevantes `D_`-Datum, das zum Status passt — wenn nicht bestimmbar: weglassen, nicht raten) + ZAH-Phase; letzter Vorgang = jüngste gefüllte relevante `D_`-Spalte mit Kürzel-Beschreibung + Rolle; „dieser Trigger löste aus" aus der Trigger-Tabelle (Satzform) falls Kürzel dort vorhanden; Verlaufs-Näherung = relevante `D_`-Spalten chronologisch absteigend (max. 5, „Verlauf ist Näherung aus Datumsspalten" als Fußnote); Datenstand (CSV-Import-Zeitpunkt) + Katalog-Version + Herkunft; Button „Herleitung kopieren" (`kopiereText`).
2. Status-Text nicht im Katalog → Popover zeigt Warnung „Statuswert nicht im Katalog (Katalog v… )" statt Phase.
3. Icon: `Info` lucide, `--tf-text-muted`, nur Hover/Fokus-Popover, kein Layout-Shift (feste Breite, Pitfall #14 sinngemäß).
4. Visueller Selbst-Check per Screenshot: Liste + Detail + ein Antrag mit unbekanntem Status (Test-Fixture).
5. Tests: Herleitungs-Aufbau aus Fixture-Antrag (bekannter Status, unbekannter Status, leere Vorgangskarte).

Gate → Commit `feat(vorgangssystem): Status-Erklärung mit Herleitungs-Popover` → Protokoll → `/compact`.

## Phase 2 — Kürzel-Glossar + Relevanz + Navigator

**Ziel:** Durchsuchbares Glossar, Relevanz-Pflege, Nächster-Schritt-Kandidaten am Antrag.

1. **Glossar-View** (neuer Tab im Status-Katalog-Plugin oder eigene Route — Default: Tab „Kürzel" ersetzt perspektivisch den Felder-Tab, hier zunächst additiv): Tabelle Kürzel / Beschreibung / Rollen (Chips AB/FB/QS/PA/Jur existieren als Muster im Felder-Tab) / Trigger-Wirkung (Satzform, expandierbar) / Relevanz-Häkchen / `D_`-Spalte vorhanden ja/nein. Suche über Kürzel + Beschreibung. Rollen-Filter, Filter „nur relevante", „nur mit D-Spalte".
2. **Relevanz-Pflege:** Häkchen editierbar nur mit Schreibrecht; Save in `pflege.json` (EIN persist pro Aktion). Seed-Default: alle `false`; zusätzlich Aktion „AB-Dashboard-Spalten als relevant markieren" (die im Regel-Seed verwendeten `D_`-Felder).
3. **Navigator** (`navigator.ts`, pure): Kandidaten-Kürzel = relevante Kürzel, deren Status-Trigger-Vorbedingung (`<x`/`>x`/`=x` gegen aktuellen Status-Code) erfüllt ist und deren ABB-/Negativ-Bedingungen gegen `D_`-Spalten nicht verletzt sind; nicht auswertbare Bedingungen → Kandidat mit Kennzeichen „Bedingung nicht prüfbar", nicht verwerfen. Ausgabe pro Kandidat: Kürzel, Beschreibung, Rolle, Wirkung (setzt Status …, Mail an … — Platzhalter #TB1 etc. unaufgelöst mit Legende).
4. **UI am Antrag:** Abschnitt „Nächste Schritte (im Foyer zu setzen)" im Antrag-Detail, Default-Filter „Meine Rolle" (neues Profil-Feld existiert — lesen, nicht neu bauen), Toggle „alle Rollen". Leerer Zustand ehrlich: „Keine Kandidaten ermittelbar (n Trigger nicht interpretierbar)".
5. Tests: Navigator gegen Fixture-Trigger (erfüllt / nicht erfüllt / nicht prüfbar), Rollen-Filter.

Gate → Commit `feat(vorgangssystem): Kürzel-Glossar, Relevanz, Nächster-Schritt-Navigator` → Protokoll → `/compact`.

## Phase 3 — To-do-Regeln + To-do-Board

**Ziel:** Regel-Engine mit AB-Seed, Board mit Rollen-Sicht.

1. **Engine** (`todo-engine.ts`, pure, `stichtag` injiziert): wertet die geordnete Regelliste aus, erste zutreffende Regel gewinnt; Sperren S1/S2 vor den gekennzeichneten Strängen; Ergebnis `{ todo, regelId, zustaendig, wartetAuf, herleitung: Bedingungs-Auswertung[] } | { todo: null }`. Optional zusätzlich `weitereTreffer` (alle weiteren zutreffenden Regeln) für Anzeige gedämpft.
2. **Seed:** R1–R25 + S1–S2 exakt aus `todo-regeln-ab-seed.md`. Tests: pro Regel mindestens ein positives Fixture, plus Kaskaden-Tests (mehrere Regeln treffen → Reihenfolge entscheidet), plus 31-Tage-Grenzfälle (Tag 31 vs. 32) mit festem Stichtag.
3. **Regel-Pflege-UI:** im Regeln-Tab des Status-Katalog-Plugins ein Bereich „To-do-Regeln": Liste in Reihenfolge, jede Regel als deutscher Satz gerendert (WENN … DANN «…», zuständig …), aktiv-Toggle, Drag-Reorder, Regel-Editor über die sechs Bedingungstypen (Formular, kein Freitext). Schreibrecht-gated, EIN persist. Versionierung wie Kataloge.
4. **To-do-Board:** neue View im Förderanträge-Plugin (oder eigenes Plugin, Default: View „To-do" in `antraege/views.ts` nach Cheatsheet add-view): Gruppierung nach To-do-Wert; Karten mit FKZ, Kurzname, Tage im To-do (sofern aus Herleitung ableitbar), Frist-Ampel. Filter: Meine Rolle (Aufgaben-Sicht: meine To-dos prominent, Fremdrollen als „wartet auf …" gedämpft), mein Kürzel (`useMeinKuerzel`; AB über `BIB_KUERZ`, FB über `TIB_KUERZ` — Bearbeiter-Filter-Erweiterung, `bearbeiterFilter.ts` lesen und rollenbewusst erweitern statt duplizieren), Jahr, Fördervariante, ZAH-Phase, Status. Gruppe „kein To-do ermittelt" immer sichtbar (einklappbar).
5. Klick auf Karte → Antrag-Detail; To-do dort ebenfalls anzeigen (mit Regel-Herleitung im Popover: welche Bedingungen trafen zu, mit Feldwerten).
6. Visueller Selbst-Check per Screenshot: Board AB-Sicht vs. FB-Sicht desselben Fixture-Bestands.

Gate → Commit `feat(vorgangssystem): To-do-Engine mit AB-Regelsatz und To-do-Board` → Protokoll → `/compact`.

## Phase 4 — Stillstands-Wächter + Zieltage

**Ziel:** Hängt-fest-Erkennung, Home-Widget, PL-Liste.

1. **Zieltage-Pflege:** Spalte „Zieltage" im Status-Katalog-Tab (editierbar mit Schreibrecht, `pflege.json`). Seed: leer. Zusatz-Aktion „Vorschlag aus Ist-Verteilung": Median-Verweildauer je Status aus dem aktuellen Bestand berechnen (Verweildauer-Näherung = Tage seit jüngster `D_`-Aktivität, gruppiert nach Status) und als Vorschlagswerte anzeigen — Übernahme nur explizit pro Zeile.
2. **Wächter** (`waechter.ts`, pure, stichtag injiziert): Stufe 1: `letzteAktivitaet = max(relevante D_-Spalten)`; `stichtag − letzteAktivitaet > zieltage(statusCode)` → hängt (Grund: „keine Vorgangs-Aktivität seit n Tagen, Ziel m"). Kein Zieltage-Wert → Ergebnis `unbewertet` (Grund „kein Ziel definiert"), nicht false. Stufe 2: liegt ein To-do mit `wartetAuf`/`zustaendig` vor, Rolle im Grund benennen („hängt bei QS seit n Tagen"); Kürzel-Paar-Fälle (AK4/AT4, ARK/ART, ABLK/ABLT, ALT/ALU) explizit: eine Seite gefüllt, Gegenseite leer seit > n Tagen → „fachlich fertig, administrativ offen (AK4 fehlt)".
3. **Home-Widget** „Hängt fest" (opt-in wie alle Widgets, `sichtbar: false` Default, Config in IDB): meine Anträge (Rolle + Kürzel) mit Grund + Tagen, sortiert nach Tagen absteigend, max. 10 + „alle anzeigen" → Board mit Hängt-Filter.
4. **PL-Liste:** im To-do-Board zusätzlicher Filter „hängt fest" + Spalte hängende Rolle; Zähler pro Rolle im Board-Kopf („12 warten auf AB · 5 auf QS · 3 unbewertet").
5. Tests: Stufe-1-Grenzfälle, unbewertet-Pfad, Paar-Erkennung, Stichtag-Determinismus.

Gate → Commit `feat(vorgangssystem): Stillstands-Wächter mit Zieltagen und Rollen-Zuordnung` → Protokoll → `/compact`.

## Phase 5 — Fristen-Cockpit

**Ziel:** Bearbeiter- und PL-Sicht im Plugin „Fristen & Meilensteine", XLSX-Export.

1. **Wirksamer Eingang** (`frist.ts` im Vorgangssystem-Modul, bestehende `computeFristDatum`-Logik lesen und erweitern, nicht duplizieren): `eingang = max(D_AAE, D_XTE)`; Antragsphase-Frist = eingang + 90 Tage; Begleitphase nach bestehender VN-Logik (D_VBE + 6 Monate) unverändert. Beide Konstanten als benannte, zentral definierte Werte.
2. **Bearbeiter-Sicht:** meine Anträge (Rolle + Kürzel) sortiert nach Restfrist, Ampel (Default-Schwellen: rot ≤ 14 Tage, gelb ≤ 30 — als Konstanten, im Protokoll dokumentieren), Hängt-Marker, To-do-Spalte, Klick → Detail.
3. **PL-Sicht:** Balken Verteilung über ZAH-Phasen (Marker separat); Tabelle Verweildauer je Status (Median + p90 der Näherungs-Verweildauer, n pro Status); Fristrisiko-Liste (Restfrist ≤ 30); Zähler je Rolle aus Phase 4. Kein Wochentrend in dieser Phase (bräuchte Historisierung — bewusst ausgelassen, ins Protokoll).
4. **XLSX-Export** beider Sichten (bestehende Export-Infrastruktur wiederverwenden; Dateiname mit Datum + Sicht).
5. Visueller Selbst-Check per Screenshot beider Sichten mit Fixtures.
6. Tests: wirksamer Eingang (D_XTE vor/nach D_AAE/leer), Ampel-Schwellen, Verweildauer-Aggregation.

Gate → Commit `feat(vorgangssystem): Fristen-Cockpit mit wirksamem Eingang und Rollen-Stau` → Protokoll → `/compact`.

## Phase 6 — Rückbau Status-Katalog-Modul + ZAH-Phasen-Umbenennung

**Ziel:** Altes Ableitungsmodell entfernen, Modul zum Spiegel machen. Erst jetzt, damit die neuen Funktionen bereits tragen.

1. **Katalog-Tab:** Spalten neu = Code, Text, Varianten, ZAH-Phase (editierbar), Zieltage (editierbar, aus Phase 4), Marker, aktiv, Vorkommen, zuletzt gesehen. **Entfernen:** Kategorie-Dropdown, Spine-Phase-Dropdown, Rang, Prominenz, terminal-Checkbox. Unkuratiert-Queue ersetzen durch Warnbanner „n Statuswerte im Export, die nicht im Katalog sind" (Klick → Liste mit Vorkommen; Übernahme legt Katalog-Eintrag ohne Phase an, `aktiv: false`).
2. **Felder-Tab → Kürzel-Tab:** Glossar aus Phase 2 wird der Tab; Ordnerbaum bleibt als Gliederungs-Filter, **Ordner-Ränge und Rang-Eingaben entfernen ersatzlos** (inkl. 999-Sentinel).
3. **Regeln-Tab:** oben To-do-Regeln (Phase 3), darunter Trigger-Viewer (read-only, Satzform, Filter Kürzel/Status/Rolle, „nicht interpretiert"-Filter). Die 5 Alt-Regeln in den To-do-Regelsatz überführen soweit nicht schon durch R1–R25 abgedeckt (prüfen, dokumentieren), dann Alt-Regel-Code löschen.
4. **`status-canonical.ts` als Fassade:** öffentliche API (`isOpenStatus`, `isBewilligtStatus`, `isBegleitungStatus`, `isClosedStatus`, `isTerminalStatus`, `getStatusCategory`, `statusRang`) bleibt unverändert — intern gespeist aus Code-Join + ZAH-Phasen-Zuordnung (Mapping ZAH-Phase → bisherige `StatusCategory` als explizite kleine Tabelle: eingang→offen, vollstaendigkeit→offen/nachforderung je Code 35–37, pruefung→in_pruefung, entscheidung→entscheidung, begleitung→bewilligt/begleitung je Code 59 vs. Rest, abgeschlossen→abgeschlossen, Marker→sonstige; jede Abweichung vom Alt-Verhalten muss ein bewusster, im Protokoll gelisteter Fall sein). Bauantrag-Werte bleiben auf der eingebauten Bauantrag-Map. `snapshotMap`-Mechanik: Setzen synchron vor erstem Render aus der Vorgangssystem-Ladelogik; ohne Katalog → Seed (nie leer). Bestehende Convention-Tests müssen unverändert grün bleiben.
5. **Umbenennung:** „Spine-Phase" → „ZAH-Phase" in UI-Texten und neuen Bezeichnern; bestehende Bezeichner opportunistisch (nur angefasste Dateien), `@deprecated`-Aliase wo extern referenziert. `VB_PHASE` in UI konsequent als „Fördervariante" labeln.
6. **Doku:** CLAUDE.md-Eintrag (neuer Abschnitt Vorgangssystem: Modul-Pfad, Sidecar-Layout, Flag, „App leitet keinen Status ab"-Grundsatz, Verweis auf `docs/architecture/vorgangssystem.md`), CHANGELOG, MINOR-Bump.
7. **Aufräum-Kontrolle:** grep nach `rang`, `prominenz`, `terminal` im Status-Katalog-Plugin — Reste entfernen oder begründen; Vorkommen-0-Seed-Einträge der Bauantrag-Domain aus dem Förder-Katalog entfernen.

Gate → Commit `refactor(vorgangssystem): Status-Katalog als Spiegel, ZAH-Phasen, Rang-Modell entfernt` → Protokoll → `/compact`.

---

## Abschluss

Gesamt-Protokoll: alle gewählten Defaults, bewusst ausgelassene Punkte (Wochentrend, Mail-Platzhalter-Auflösung, per-Rolle-Relevanz-Defaults), offene Verifikationsfragen V1–V4 aus der Seed-Doku als TODO-Liste für die Fachabstimmung. Screenshot-Serie: Info-Icon, Glossar, Board (AB/FB), Wächter-Widget, Cockpit beide Sichten, umgebauter Katalog.
