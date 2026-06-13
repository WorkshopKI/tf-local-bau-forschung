# Anonymisierte Real-Fixtures

Dieser Ordner enthaelt **anonymisierte Auszuege aus echten Foyer-CSVs**, die im
Dev-Build als Seed-Daten und in Unit-Tests als Real-World-Fixtures dienen.

## Wichtig: CSVs sind lokal-only

Die `*.csv` Dateien in diesem Ordner sind via `.gitignore` (`*.csv` Pattern in
Repo-Root) **nicht im Remote-Repo**. Sie enthalten zwar keine Klarnamen mehr,
aber die Datenstrukturen (FKZ-Formate, Status-Verteilungen, Spaltenheader) sind
sensibel genug, um sie nicht auf GitHub zu pushen.

Die **`schema-*.ts`-Dateien werden committet** — die enthalten nur
Spalten-Mapping-Definitionen, keine Daten.

Wenn das Repo frisch geklont wird und die CSVs fehlen:
- App startet trotzdem, Foerderantraege-Seed bleibt einfach leer
- Unit-Tests, die die Fixtures brauchen, werden via `describe.skip` uebersprungen

## Erwartete Dateien

| Datei | Rolle | Schema |
| --- | --- | --- |
| `sample_9097_AnB_AitisiGPT.csv` | Master (Antragsbasis) | [schema-a.ts](./schema-a.ts) |
| `sample_7737_Bgl.csv` | Secondary (Bewilligungsdetails) | [schema-b.ts](./schema-b.ts) |
| `sample_9052_PrjBsp_AitisiGPT.csv` | Secondary (Projektbeschreibung) | [schema-c.ts](./schema-c.ts) |

Alle drei joinen ueber `FKZ` (= `aktenzeichen`-Canonical). Master fuehrt die
Antrags-Liste; Secondaries reichern Felder an, die im Master nicht oder leerer
befuellt sind (Priority-basierte Merge — Master gewinnt bei Konflikten).

## Anonymisierungs-Konvention

Was **bleibt** wie im Original (strukturell wichtig):
- Spaltenheader (`AKZ`, `FKZ`, `STATUS_VB`, `VB_PHASE`, `TIB_KUERZ`, ...)
- Status-Werte exakt (`beantragt`, `bewilligt`, `VN geprüft`, `NF gestellt`,
  `Schlussvermerk`, `abgelehnt/zurückgezogen`, ...)
- Datumsformat `DD.MM.YYYY`
- VB_PHASE-Werte 1–5 + 9 (Irrlaeufer)
- FKZ-Format `16XX######` mit den echten Praefixen
- Encoding (Windows-1252 — Parser hat Auto-Detection)
- Separator (`;`)

Was wird **getauscht** (anonymisiert):
- Klarnamen → "Mustermann", "Muster GmbH", "Fachhochschule Muster N"
- Adressen → "Heinrich-Muster-Str. N", "10000"
- FKZ-Suffixe → realistische aber andere Nummern
- Akronyme → erfunden ("SmartAlyse", "PLaNet")
- Volltext-Inhalte → ggf. ueberschrieben oder verkuerzt
- Email-Adressen → `mario.muster@muster.de`
- Beachte: Beträge sollten realistische Verteilungen haben, koennen aber
  leicht verschoben werden

## Re-Generation

Die CSVs werden manuell von einem Kurator aus einem echten Foyer-Export
erstellt. Beim Anonymisieren UTF-8 oder Windows-1252 als Encoding behalten —
beide werden vom Parser auto-detected.

Wer auf eine neue Foyer-Schema-Version aktualisiert: Spalten in `schema-*.ts`
anpassen, Re-Anonymisierung als neue CSV ablegen.

## Verwendung im Code

Der Seed-Loader unter [src/core/services/seed/fixture-loader.ts](../../src/core/services/seed/fixture-loader.ts)
liest die CSVs ueber Vite's `import.meta.glob` (Pattern
`@/../docs/fixtures/*.csv`, `query: '?raw', eager: true`). Wenn der Glob keine
Files findet, returned der Loader 0 — der Seed-Lauf laeuft graceful weiter ohne
Foerderantraege.

Unit-Tests unter [src/plugins/antraege/__tests__/](../../src/plugins/antraege/__tests__/)
nutzen denselben Glob-Mechanismus mit `describe.skip` als Fallback.

---

## CLAUDE.md-Pitfalls (Detail)

### Pitfall #13 — Förderantrag-Seeds kommen aus echten CSVs

Die Dev-Seed-Anträge werden nicht in TypeScript handgeschrieben, sondern als anonymisierte Real-Foyer-CSVs in diesem Ordner abgelegt (siehe oben). Der Seed-Loader [fixture-loader.ts](../../src/core/services/seed/fixture-loader.ts) durchläuft den vollen `importCsvSource`-Pfad — Bugs im Parser, Column-Mapping oder Merger werden so im Seed-Lauf sichtbar. Schemas (`schema-*.ts`) sind committet, die CSVs via globalem `*.csv`-Pattern in `.gitignore` lokal-only. Fehlende CSVs → Loader liefert graceful 0 Anträge, App startet trotzdem. Seed-Flag: `seed-complete-v2`. Encoding-Pipeline: `scripts/normalize-fixture-csvs.mjs` (windows-1252 → UTF-8, idempotent als `prebuild`/`predev`).
