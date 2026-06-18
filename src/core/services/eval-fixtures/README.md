# eval-fixtures — Stammdaten-Generator für die Skill-Eval

Repo-internes **Dev-Tool** (Node, läuft **nicht** unter `file://`, ist **kein** App-Feature und landet nicht im Production-Bundle). Es macht aus einem Ordner mit **fiktiven** Vorhabensbeschreibungen (VBs, `.md`/`.txt`) je einen schmalen **Stammdaten-Block** — exakt in der Form `KurzfassungContext`, die der Gutachten-/Kurzfassungs-Skill produktiv aus dem CSV bekäme. So werden die fiktiven VBs zu vollwertigen „Anträgen" für die Skill-Eval, ohne das 461-Feld-CSV-Format nachzubauen.

## Aufbau

| Datei | Verantwortung |
|-------|---------------|
| `sha1.ts` | Pure-TS-SHA-1 (synchron, zero-dep) — deterministischer Seed-Hash für stabile Verwaltungsnummern. |
| `fixture-build.ts` | Pure-Logik: synthetisiert Admin-Felder (FKZ/Aktenzeichen, EP/KN), baut `KurzfassungContext`, Akronym-Dedup, CSV. |
| `extract.ts` | Inhaltliche Felder: `extractHeuristisch` (offline) + `ExtractFn`-Naht für die injizierte LLM-Variante. |
| `cli.ts` | I/O-Shell (Ordner-IO, OpenRouter-`fetch`, Flag-Parsing, Fallback). **Aus `tsconfig.app.json` ausgeschlossen** (Node-Kontext). |
| `__tests__/fixture-build.test.ts` | Vitest über die Pure-Logik + Heuristik (kein LLM). |

## Lauf

Voraussetzung: **Node ≥ 18** (globales `fetch`). Es wird **kein** TS-Runner als devDependency installiert — der Lauf geht über `npx tsx` (holt `tsx` beim ersten Mal in den npx-Cache).

```bash
# Heuristik (offline, kein API-Key nötig):
npm run generate:eval-fixtures -- --in ./meine-vbs --out ./eval-fixtures-out --dry-run

# oder direkt:
npx tsx src/core/services/eval-fixtures/cli.ts --in ./meine-vbs --dry-run

# Mit LLM-Extraktion (fiktive VBs → OpenRouter erlaubt):
OPENROUTER_API_KEY=sk-... npm run generate:eval-fixtures -- --in ./meine-vbs
```

### Flags

| Flag | Default | Bedeutung |
|------|---------|-----------|
| `--in <ordner>` | — (Pflicht) | Ordner mit VBs (`.md`/`.txt`). |
| `--out <ordner>` | `./eval-fixtures-out` | Zielordner für `fixtures.json` + `stammdaten.csv`. |
| `--typ auto\|ep\|kn` | `auto` | `auto` = ≥2 Partner ⇒ Verbund (KN), sonst Einzelprojekt (EP). `ep`/`kn` erzwingen. |
| `--model <id>` | `anthropic/claude-3.5-sonnet` | OpenRouter-Modell-ID (nur LLM-Modus). |
| `--dry-run` | aus | Erzwingt den heuristischen Offline-Extraktor (keine LLM-Calls). |

Ohne `OPENROUTER_API_KEY` (oder mit `--dry-run`) läuft automatisch der heuristische Fallback. Schlägt ein einzelner LLM-Call fehl, fällt **nur diese Datei** auf die Heuristik zurück (kein Abbruch).

## Output

- **`fixtures.json`** — Array `{ vbFile, antragstyp: 'EP'|'KN', context: KurzfassungContext, vbMarkdown }`.
- **`stammdaten.csv`** — Spalten `vb_datei;antragstyp;aktenzeichen;akronym;titel;antragsteller;anzahl_tv` (`;`-getrennt, RFC-Quoting).

**Nach dem ersten Lauf prüfen:** Spalte `anzahl_tv` in der CSV — Einzelprojekte (EP) haben `0`, Verbünde (KN) genau die Anzahl der beteiligten Organisationen.

## Grenzen / Designentscheidungen

- **Inhaltliche Felder** (Titel, Akronym, Partner) werden aus dem VB **extrahiert**, nie erfunden — sonst widerspräche der Stammdaten-Block dem VB-Volltext im selben Eval-Prompt.
- **Admin-Felder** (FKZ, Verbund-Key, EP/KN) stehen nicht im VB → deterministisch synthetisiert. Seed = VB-Dateiname ⇒ wiederholte Läufe liefern byte-identische FKZ.
- FKZ-Format `(16EP|16KN)\d{6}` deckt sich mit `extractFkzStrict` (`src/phase2/matcher/fkz-extractor.ts`); FKZ werden hier selbst geprägt (kein Runtime-Import aus phase2).
- Import-Richtung ist strikt `eval-fixtures → src/...` (nur `import type` aus dem App-Code, zur Laufzeit erased). **Kein** App-/Plugin-Code importiert aus diesem Ordner — sonst wandert das Tool in den Bundle.
