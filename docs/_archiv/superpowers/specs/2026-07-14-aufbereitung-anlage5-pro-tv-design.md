# Antrag-Aufbereitung: Anlage 5 (Arbeitsplan) pro Teilvorhaben

**Datum:** 2026-07-14
**Status:** Design freigegeben — bereit für Implementierungsplan
**Modul:** Antrag-Aufbereitung (dev-Flag `antragAufbereitung`), Zeitplan-Tab

## Problem

Die Anlage 5 (Arbeitsplan) ist **teilvorhaben-spezifisch**: ein ZIM-Verbund mit 3 TVs bringt 3× eine Anlage 5 mit (jede Datei trägt das FKZ ihres TV im Dateinamen). Die Aufbereitung wurde aber als „ein Arbeitsplan pro Vorhaben" gebaut:

- `resolveAnlage5` liefert per `treffer[0]` genau **eine** Anlage 5 (die jüngste). `baueRun` erhält ein einziges `anlage`-Objekt und erzeugt daraus **einen** Gantt + Kapazitätsprüfung.
- Lädt der Gutachter alle 3 Anlagen hoch, werden sie zwar korrekt am Verbund getaggt (FKZ-Erkennung akzeptiert jedes TV-FKZ, weil alle TV-Aktenzeichen in `knownIds` stehen), aber **nur eine wird ausgewertet** — die anderen zwei verschwinden still (weder im Zeitplan noch als Warnung).

Das ist ein echtes Konzept-Gap, kein Bug: das Datenmodell kennt nur eine Anlage 5 pro Verbund.

## Ziel

Ein Verbund mit N TVs zeigt im Zeitplan-Tab **pro TV eine eigene Gantt-Sektion** aus der jeweiligen Anlage 5 (mit Kapazitätsprüfung je TV), plus eine schlanke Verbund-Summenzeile. Fehlt für ein TV die Anlage 5, ist die Lücke pro TV sichtbar und direkt behebbar. Der Einzelvorhaben-Fall (1 TV) bleibt **exakt** wie heute.

## Getroffene Entscheidungen (mit dem Nutzer abgestimmt)

1. **Zuordnung TV ↔ Anlage 5:** zur Auflösungszeit deterministisch aus dem Dateinamen (`classifyFkz`). Kein Tagging-Umbau, keine Migration, wirkt sofort auf bereits hochgeladene Dateien. Nicht zuordenbare Dokumente landen in einem sichtbaren „ohne TV-Zuordnung"-Hinweis (Ansatz A gegen B=Tag-beim-Upload / C=manuelles Dropdown).
2. **Plausibilitäts-Abgleich Text vs. Anlage 5:** bei **1 TV** unverändert (VB-Text-Projektplan ↔ Anlage 5). Bei echtem **Verbund (≥2 TV)** entfällt der Text-Abgleich — pro TV nur Gantt + Kapazität aus dessen Anlage 5 (die gemeinsame VB trägt keine TV-genauen Textpläne → Text-Abgleich pro TV wäre Rauschen).
3. **Fehlende Anlage 5:** immer eine Sektion pro TV; fehlt die Anlage 5, steht dort „Anlage 5 fehlt" mit direkter Drop-Zone (generalisiert den ursprünglichen Auslöser: vergessene Anlage 5).
4. **Kennzahlen:** pro TV eigene Kennzahlen-Karte (wie heute) **plus** oben eine schlanke Verbund-Summenzeile (Σ PM, Σ MA, längster Horizont).
5. **Kalender-Achse:** v1 nutzt pro TV-Sektion eine eigenständige Achse (jedes TV rechnet M1 = frühester Beginn in seiner Anlage 5, wie heute). Kein Eingriff in `normalisiereAnlage5`. Gemeinsame Kalender-Ausrichtung = spätere Verfeinerung.

## Architektur

Leitprinzip: **rein additiv**. Der Solo-Pfad (1 TV) bleibt Byte-genau der heutige Code; der Verbund-Pfad kommt als neue optionale Felder + neuer Render-Zweig dazu. `AufbereitungRun.version` bleibt `1` (alte Runs laden unverändert).

### Datenmodell (`aufbereitung/types.ts` + `tabellen.ts`)

Neuer Typ `TvPlan` und zwei optionale Run-Felder:

```ts
interface TvPlan {
  nr: number;                 // 1-basiert, Lead-TV zuerst (wie teilvorhaben-Reihenfolge)
  tvAz: string;               // Aktenzeichen des TV
  tvAkronym: string | null;
  tvTitel: string | null;
  anlage: QuelleRef | null;   // gestempelte Quelle (name+hash) oder null = Anlage 5 fehlt
  zeitplan: { zeilen: ApZeile[]; achseMax: number } | null;  // reine Anlage-5-Ernte
}
```

- `AufbereitungRun.teilplaene?: TvPlan[]` — gesetzt **nur** im echten Verbund (≥2 TV); im Solo-Fall `undefined`.
- `QuelleRef.tvAz?: string` — markiert eine `rolle:'anlage5'`-Quelle mit ihrem TV (additiv; VB/Verwertung tragen es nicht).
- `Befund.tvAz?: string` (in `tabellen.ts`) — welcher TV den Kapazitäts-Befund trägt.

**Harte Invariante:** `run.befunde` bleibt die **einzige** Befund-Liste — im Verbund die geflachten Kapazitäts-Befunde aller TVs (je mit `tvAz` + TV-Kürzel im Text, damit `befundKey` eindeutig bleibt). So funktionieren Fragen-Tab + „offene Punkte" ohne Änderung; die TV-Sektionen filtern `run.befunde` nur nach `tvAz`. `teilplaene[].zeitplan` trägt keine Befunde doppelt.

### Auflösung (`aufbereitung/quellen.ts`)

- Neu `resolveAnlagenProTv(idb, ctx)`: **ein** `doc:`-Scan; für jedes Anlage-5-Dokument (Tag `arbeitsplan` ODER Dateiname-Regex `ANLAGE5_RE`, getaggt mit Verbund-Key) den TV per Dateiname-Match gegen die TV-Aktenzeichen bestimmen, newest-wins **pro TV**. Liefert `{ proTv: Map<tvAz, AnlageAufloesung>; unzugeordnet: AnlageAufloesung[] }`.
- Kleiner reiner Helfer `matchTvAusDateiname(filename, tvAzListe): string | null` — Normalisierung wie `normId`/`classifyFkz`, matcht **nur** gegen TV-Aktenzeichen (nicht gegen die Verbund-ID), damit eine Datei mit Verbund- **und** TV-FKZ dem TV zugeordnet wird statt dem Verbund.
- `resolveAnlage5` (Einzel-Auflösung, inkl. persönlicher Ordner-Fallback) bleibt **unverändert** für den Solo-Pfad.
- `AufbereitungContext` wird um `teilvorhaben: { nr; aktenzeichen; akronym; titel }[]` erweitert (Labels + TV-Liste). Die Daten kommen bereits aus `buildKurzfassungContext` (`KurzfassungContext.teilvorhaben`); `AufbereitungPage` reicht sie durch.

### Assemblierung (`aufbereitung/store.ts`)

`baueRun` verzweigt an der TV-Zahl:

- **1 TV (Solo/Einzel/Pseudo-Verbund):** exakt heutiger Code — ein `zeitplan` (`anlage5`/`vb`/`beide`) + Text-vs-Anlage-5-Befunde (`verglichZeitplaene`) + Kapazität. `teilplaene` bleibt `undefined`. Byte-gleich zum heutigen Verhalten.
- **≥2 TV (Verbund):** je TV die Anlage-5-Ernte (`ernteTabellen` → filtern `klasse==='anlage5'` → `normalisiereAnlage5` → `pruefeKapazitaet`, alles wiederverwendet) zu einem `TvPlan`. Kapazitäts-Befunde mit `tvAz` + TV-Kürzel gestempelt und in `run.befunde` **flach** gesammelt. Top-Level `zeitplan = null` (keine irreführende Einzel-Anzeige), `tabellen`/`risiken` weiter aus VB (unverändert). Eine gemeinsame Ernte-Helferfunktion `ernteAnlagePlan(anlageMarkdown)` speist beide Pfade.

`istVeraltet`: im Verbund das **Multiset** der Anlage-5-Hashes vergleichen (analog zur bestehenden `verwertungHashes`-Logik), im Solo-Fall wie heute (Einzel-Hash).

`computeAufbereitung` nutzt `resolveAnlagenProTv` zusätzlich zu `resolveKorpus`/`resolveAnlage5` und übergibt die TV-Liste + Anlagen an `baueRun`.

### UI

**`aufbereitung/ZeitplanTab.tsx`** — wenn `run.teilplaene` gesetzt:
- Oben schlanke **Verbund-Summenzeile**: Σ PM über alle TV (`summePm` je TV summiert), Σ eingesetzte MA (Summe der TV-internen Distinct-Zahlen — MA-Nummern sind TV-lokal, werden NICHT global dedupliziert), längster Horizont (`max` der `achseMax`).
- Darunter je TV eine **Sektion** (`nr · Akronym · FKZ`): hat der TV eine Anlage 5 → `GanttZeitplan`/`PersonenZeitplan` (Nach-AP/Nach-Person-Toggle pro Sektion) + `KennzahlenKarte` + Kapazitäts-Hinweise (`BefundZeile`, gefiltert nach `tvAz`). Fehlt sie → Platzhalter „Anlage 5 fehlt" mit kompakter Drop-Zone (`DokumentAufnahme`, `defaultTyp='arbeitsplan'`, `onIngested={requestRecompute}`).
- „ohne TV-Zuordnung"-Anlagen → dezenter Hinweis am Ende der Liste.
- Ohne `teilplaene` → heutiges Single-Rendering unverändert.

Um `ZeitplanTab` schlank zu halten, wandert die TV-Sektion in eine neue `aufbereitung/TvZeitplanSektion.tsx` (präsentational, wiederverwendet `GanttZeitplan`/`PersonenZeitplan`/`KennzahlenKarte`/`BefundZeile`).

**`aufbereitung/QuellenPanel.tsx`** — im Verbund pro TV eine Anlage-5-Zeile (✓ Dateiname / ⚠ fehlt), plus eine „ohne TV-Zuordnung"-Zeile falls vorhanden. VB + Marketing-Zeile wie heute. Die inline `DokumentAufnahme` bleibt (fehlende Doku direkt nachreichen). Ohne `teilplaene` (Solo) → heutige Einzel-Anlage-5-Zeile.

## Scope-Grenzen (bewusst NICHT dabei)

- **LLM-Bausteine unberührt:** Steckbrief/Abdeckung/Zahlen/Verwertung/Glossar laufen weiter auf dem VB-+-Marketing-Korpus. Anlage-5-Tabellentext fließt **nicht** in den LLM-Korpus (wäre Rauschen). Nur der deterministische Zeitplan-Tab wird TV-fähig.
- **Kein Tagging-Umbau, keine Migration, kein neuer IDB-Store** (weiter `aufbereitung:<verbundKey>` im `kv`-Store, Pitfall #29).
- **Kein Text-Abgleich im Verbund** (Entscheidung 2).
- **Keine gemeinsame Kalender-Achse** in v1 (Entscheidung 5).

## Pitfalls / Konventionen

- **#29:** alles im `kv`-Store unter `aufbereitung:<verbundKey>`, kein neuer Object-Store.
- **#15 (async-error):** die per-TV Drop-Zone nutzt `DokumentAufnahme` (self-catching) + `requestRecompute` (coalesced), wie heute.
- **Reine Funktionen zuerst:** `matchTvAusDateiname` + `ernteAnlagePlan` + der `baueRun`-Verbund-Zweig sind rein und Node-testbar (keine IO).
- **Datei-Kohäsion:** neue `TvZeitplanSektion.tsx` statt `ZeitplanTab.tsx` zu überladen.
- **feedback-kontext-Pflege:** sichtbare UI ändert sich (per-TV Sektionen, Verbund-Summenzeile, per-TV Quellenzeilen) → `docs/feedback-kontext/antraege.md` nach Umsetzung via Skill nachziehen.

## Tests

Node/Vitest (reine Funktionen):
- `matchTvAusDateiname`: TV-FKZ im Dateinamen → richtiger TV; Datei mit Verbund- **und** TV-FKZ → TV (nicht Verbund); ohne erkennbares TV-FKZ → `null`.
- `resolveAnlagenProTv`: 3 Anlagen → 3 TV-Gruppen; zwei Dateien für dasselbe TV → newest-wins; nicht zuordenbare Datei → `unzugeordnet`.
- `baueRun` Verbund: per-TV `TvPlan` mit Zeitplan/Kennzahl; `run.befunde` geflacht mit `tvAz`; `zeitplan===null`; `teilplaene.length === TV-Zahl` (inkl. fehlende TVs als `anlage:null`).
- **Regression:** 1 TV → `teilplaene===undefined`, `zeitplan`/`befunde` byte-gleich zum heutigen Lauf.
- `istVeraltet`: Verbund erkennt hinzugefügte/geänderte/entfernte Anlage 5 (Multiset).

## Verifikation

1. `npm run typecheck` (Variant-Builds transpilen nur).
2. Unit-Tests grün (inkl. Regressions-Test).
3. `npm run build:dev`, `file://` (`dist-single/dev/zah-dev.html`):
   - Verbund mit 3 TVs, 3 Anlage-5-Dateien (TV-FKZ im Namen) laden → 3 TV-Sektionen mit je eigenem Gantt + Kapazität; Verbund-Summenzeile stimmt.
   - Nur 1 von 3 Anlagen geladen → 3 Sektionen, 2 mit „Anlage 5 fehlt" + Drop-Zone; Nachreichen → Auto-Recompute füllt die Sektion.
   - Gegenprobe Solo: Einzelantrag mit 1 Anlage 5 → unverändert (eine Sektion, Text-vs-Anlage-5-Abgleich vorhanden).
4. Commit + Push, `build:dev && build:pl` (Projekt-Konvention).

## Versionierung

**MINOR** (additives Feature, bestehende Runs bleiben funktional). CHANGELOG.md + changelog-user.md + `package.json`.

## Betroffene Dateien

**Neu**
- `src/plugins/antraege/aufbereitung/TvZeitplanSektion.tsx` — präsentationale TV-Sektion.

**Ändern**
- `src/plugins/antraege/aufbereitung/types.ts` — `TvPlan`, `AufbereitungRun.teilplaene?`, `QuelleRef.tvAz?`.
- `src/plugins/antraege/aufbereitung/tabellen.ts` — `Befund.tvAz?` (additiv).
- `src/plugins/antraege/aufbereitung/quellen.ts` — `resolveAnlagenProTv`, `matchTvAusDateiname`.
- `src/plugins/antraege/aufbereitung/store.ts` — `AufbereitungContext.teilvorhaben`, `baueRun`-Verzweigung, `ernteAnlagePlan`, `istVeraltet` Multiset, `computeAufbereitung`.
- `src/plugins/antraege/aufbereitung/ZeitplanTab.tsx` — Multi-TV-Render-Zweig + Verbund-Summenzeile.
- `src/plugins/antraege/aufbereitung/QuellenPanel.tsx` — per-TV Anlage-5-Zeilen + „ohne TV-Zuordnung".
- `src/plugins/antraege/aufbereitung/AufbereitungPage.tsx` — `teilvorhaben` in den Kontext reichen.
- `src/plugins/antraege/aufbereitung/useAufbereitung.ts` — Kontext-Erweiterung, veraltet-Check pro TV.
- Tests: `store.test.ts`, neue `quellen`-Tests.
- Doku: `docs/architecture/antrag-aufbereitung.md`, `docs/feedback-kontext/antraege.md`, CHANGELOG, changelog-user, `package.json`.

**Wiederverwenden (unverändert):** `ernteTabellen`/`normalisiereAnlage5`/`pruefeKapazitaet`/`summePm`/`kapazitaetProMaMonat` (tabellen.ts), `GanttZeitplan`/`PersonenZeitplan` (Gantt-/Personen-Ansicht), `DokumentAufnahme` (`defaultTyp`), `classifyFkz`/`extractFkz`, `buildKurzfassungContext`.
