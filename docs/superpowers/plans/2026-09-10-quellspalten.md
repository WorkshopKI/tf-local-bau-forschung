# Quellspalten sichtbar machen — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHER SUB-SKILL: `superpowers:executing-plans` (Schritte mit Checkboxen). Gate/Abnahme/Commit bleiben im Hauptlauf.

**Grundlage:** [docs/superpowers/specs/2026-09-10-quellspalten-design.md](../specs/2026-09-10-quellspalten-design.md)

## Ziel

Wo die App ein Feld, einen Status oder eine Bedingung aus CSV-Spalten ableitet, nennt ein Tooltip die **Quellspalten** (Code + Label) — aufgelöst aus denselben Schemas, die die Rechnung benutzt. Vorab wird der Meilenstein-Anker auf den wirksamen Eingang angeglichen, damit die Erklärung eine richtige Rechnung beschreibt.

## Architektur

```
Schemas (column_mapping + Label-XLS)
   │
   ├─ baueQuellSpaltenIndex ──▶ quellSpaltenVon(feldId) ──▶ SpaltenHilfeInhalt (Tooltip)
   │        ▲                                   ▲
   │        └── rohSpaltenJeFeld (Projektion)   └── bedingungQuellen(b) ◀── bedingungFeldRefs + bedingungSatz
   │
   └─ baueAnkerLeser ──▶ verbundWirksamerEingang ──▶ bewerteVerbund (Soll · Woche · Frist)
```

## Tech-Stack

TypeScript, React 19, Vitest (node). Tooltip = `Tooltip` aus `@/components/ui/Tooltip` + `SpaltenHilfeInhalt`.

## Global Constraints

- Pitfall #44 (Tooltips erklären, leiten nichts ab), #12 (keine Rohstatus-Vergleiche), #55 (Konfiguration zeigt den Entwurf), Bug-Klasse 5 (Record-Key über das Schema), „Ein Name, vier Verhalten" (ein Index für alle Schlüssel).
- Innerer Loop `npm run check:quick`, Phasen-Gate `npm run check`, dann `npm run build:devpl` im Hintergrund.
- Windows-Shell: keine Heredocs; Commit-Message per Write nach `.git/COMMIT_MSG.tmp`.
- Parallele Sessions: nur eigene Dateien stagen.

## Dateien im Überblick

| Datei | Rolle |
|---|---|
| `src/core/services/csv/frist.ts` | `verbundWirksamerEingang` |
| `src/core/meilensteine/anker.ts` | `baueAnkerLeser`, `ANKER_SPALTEN` |
| `src/core/meilensteine/{bewertung,projektion,auswertung,typen}.ts` | Anker statt Antragsdatum |
| `src/core/services/csv/spalten-inventar.ts` | `baueQuellSpaltenIndex` |
| `src/core/status/bedingung-herkunft.ts` | `bedingungQuellen` |
| `src/components/data-table/{types.ts,SpaltenHilfeInhalt.tsx}` | `fuer`-Gruppierung |
| `src/plugins/meilensteine/*`, `src/plugins/status-cockpit/TodoRegelSatz.tsx`, `src/components/vorgang/TodoAnzeige.tsx` | Flächen Stufe B |
| `src/plugins/antraege/{fristAnzeige,spaltenHilfe}.ts`, Home-Widgets, `AlleFelderSection.tsx`, `StatusFilterFacet.tsx` | Flächen Stufe C |

## Stufe A — ein Anker (v6.49)

- [x] Vorher-Stand der Projektion + Auswertung in dev:local gesichert
- [x] `verbundWirksamerEingang` + Tests
- [x] `baueAnkerLeser` (D_XTE über `loeseFelderAuf`) + Tests; Projektion und Verbund-Detailseite nutzen ihn
- [x] Auswertung: `AbschlussFall.anker` aus `alle_antraege_da`
- [x] `anker` neben `antragsdatum` (Jahresfilter bleibt beim Antragsdatum); `BEWERTUNGS_VERSION` 3
- [x] Texte: „ab wirksamem Eingang", `ANKER_ERKLAERUNG`, `VOR_EINGANG_HINWEIS`
- [x] Gepaarte Messung auf denselben Daten → meilensteine.md
- [x] Gate, Build, Commit (`0b1e770b`)

## Stufe B — Baustein + Meilensteine + To-do (v6.50)

- [x] `baueQuellSpaltenIndex` + Tests; `rohSpaltenJeFeld` als Projektion (bestehende Tests grün)
- [x] `bedingungQuellen` + Tests (inkl. `datumNachFeld` mit zwei Feldern)
- [x] `SpaltenHilfe.felder[].fuer` + Gruppierung in `SpaltenHilfeInhalt`
- [x] Konfigurations-Zeile, `FeldWaehler`-Auslöser (inline `← Code`), Gesamtfrist
- [x] Leiste, Diese Woche — die Übersicht bekommt den Tooltip **nicht** an jedem Zustandspunkt (≈ 2 000 Zeilen × Knoten), sondern über die Leiste im Detailbereich
- [x] `TodoRegelSatz`, `TodoHerleitung`
- [x] Guard (Ist-Wert 2 Dateien, beide abgedeckt → Verbot; mit Wegwerf-Datei ROT gesehen)
- [x] Abnahme dev:local (Codes + Labels gegen `column_mapping`, `fehler()` = 0), Doku (ui-muster, feedback-kontext), Gate, Build, Commit

## Stufe C — restliche Flächen (v6.51)

- [x] Frist-Zelle (`FRIST_GRUND` + Zellen-Tooltip mit Code und Klartext), `FESTE_FELDER.frist`-Labels aus dem Index
- [x] Home-Fristen (Meilenstein über den Knoten, Zieltag über `STATUS_VB`; Kürzel-Paar bewusst ohne), StatusVerlauf-Widget
- [x] „Alle Felder" (Code inline, `frist_datum` mit Herleitung), Status-Filter (Zeile „Spalte")
- [x] Abnahme dev:local nach sauberem Reload (`fehler()` = 0; 20 „IDBStore not opened" zuvor waren ein HMR-Artefakt der Zwischenstände), Doku, Gate, Build, Commit
