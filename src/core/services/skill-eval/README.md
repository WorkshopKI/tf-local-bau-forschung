# skill-eval — Skill×Modell-Eval-Harness

Repo-internes **Dev-Tool** (Node, läuft **nicht** unter `file://`, **kein** App-Feature, landet **nicht** im Production-Bundle). Es fährt die fiktiven Fixtures (`fixtures.json` aus dem [`eval-fixtures`](../eval-fixtures/README.md)-Generator) durch die Gutachten-Skills — pro **Modell** — und liefert je Abschnitt/Modell eine Qualitätsbewertung:

- **deterministische Check-Pass-Raten** (billig, immer da) aus `runRegelChecks`, und
- optionale **LLM-Judge-Scores** (1–5) + konkrete Prompt-Verbesserungsvorschläge.

Ergebnis ist eine **Skill×Modell-Matrix** (`matrix.json` / `matrix.csv` / `report.html`).

Die Produktions-Pfade werden **wiederverwendet** (`runSkill`, `runRegelChecks`, `buildStammdaten`) — kein Reimplementieren, kein Drift.

## Aufbau

| Datei | Verantwortung |
|-------|---------------|
| `node-transport.ts` | Node-tauglicher `AITransport` (OpenAI-kompatibel, non-streaming; kein `window`). |
| `types.ts` | `EvalModelConfig`, `EvalRunResult`, `JudgeScores`/`JudgeResult`; Re-Export des `Fixture`-Typs aus `eval-fixtures`. |
| `registry-load.ts` | Registry normalisieren (oder `SEED_REGISTRY`) + Abschnitts-Liste (`ZIM_EP_WORKFLOW`). |
| `eval-run.ts` | `runOneSection` — ein Fixture×Abschnitt×Transport über `buildStammdaten`+`runSkill`+`runRegelChecks`. |
| `judge.ts` | `buildJudgePrompt` / `parseJudgeResult` (tolerant) / `runJudge`. |
| `aggregate.ts` | `EvalRunResult[]`+`JudgeResult[]` → Skill×Modell-Matrix. |
| `report.ts` | `toJson` / `toCsv` / `toHtml` (eigenständiges statisches HTML). |
| `orchestration.ts` | Pure Resume-/JSONL-/Kombinations-Helfer (getestet). |
| `cli.ts` | I/O-Shell (Flags, JSONL-Append+Resume, Concurrency, Report-Schreiben). **Aus `tsconfig.app.json` ausgeschlossen** (Node-Kontext). |

## Lauf

Über `vite-node` (liefert die Vite-`define`-Vars, die der Produktions-Import-Graph braucht — ein nackter `node`/`tsx`-Lauf reicht hier **nicht**):

```bash
# Dry-Run (Stub-Transport, KEIN Endpunkt nötig) — Pipeline-Smoke-Test:
npm run eval:skills -- --fixtures ./eval-fixtures-out/fixtures.json --models ./models.json --dry-run

# Live gegen interne Endpunkte, ohne Judge:
npm run eval:skills -- --fixtures ./fixtures.json --models ./models.json --no-judge

# Voll: interne Modelle + OpenRouter-Judge (nur fiktive Fixtures!):
OPENROUTER_API_KEY=sk-... npm run eval:skills -- --fixtures ./fixtures.json --models ./models.json --judge ./judge.json

# Nur Abschnitte A+D, erste 5 Fixtures, 4 parallel:
npm run eval:skills -- --fixtures ./fixtures.json --models ./models.json --sections A,D --limit 5 --concurrency 4

# A/B: voller VB vs. Relevanz-Auszug nebeneinander (Spalten je Zelle „voll" + „relevant"):
npm run eval:skills -- --fixtures ./fixtures.json --models ./models.json --kontext both
```

### Flags

| Flag | Default | Bedeutung |
|------|---------|-----------|
| `--fixtures <pfad>` | — (Pflicht) | `fixtures.json` (Array `{ vbFile, antragstyp, context, vbMarkdown }`). |
| `--models <pfad>` | — (Pflicht) | JSON-Array von `EvalModelConfig` (s. unten). |
| `--judge <pfad>` | aus | Eine `EvalModelConfig` (`klasse: "extern"`) für den LLM-Judge. |
| `--registry <pfad>` | Seed | Kuratierte `registry.json`; fehlt sie → eingebautes `SEED_REGISTRY`. |
| `--out <ordner>` | `./skill-eval-out` | Zielordner für `results.jsonl`, `judge.jsonl`, `matrix.*`, `report.html`. |
| `--sections A,B,…` | alle (A–G) | Teilmenge der ZIM-EP-Abschnitte. |
| `--limit N` | alle | Nur die ersten N Fixtures. |
| `--concurrency N` | `1` | Parallele Läufe (s. Hinweis unten). |
| `--no-judge` | — | Judge abschalten (Judge-Spalten bleiben leer). |
| `--dry-run` | — | Stub-Transport (kein Netz) — verifiziert die Pipeline offline. |
| `--kontext voll\|relevant\|both` | `voll` | VB-Kontext-Variante. `relevant` = nur der per **Relevanz-Map** ausgewählte VB-Auszug; `both` fährt je Skill×Abschnitt **beide** und stellt sie im Report gegenüber. |

### Kontext-A/B (`--kontext`)

Misst, ob das Füttern nur der **relevanten** VB-Sektionen (statt des vollen VB) die Abschnitts-Qualität hält oder verbessert. `both` erzeugt je Zelle eine `voll`- und eine `relevant`-Zeile (CSV-Spalte `kontext`; HTML zeigt sie untereinander). Den Auszug liefert die [Relevanz-Map](../../../plugins/antraege/gutachten/relevanz-map.ts): die Map wird **einmal pro Fixture** über das **erste** Modell berechnet (identischer Auszug für alle Modelle = fairer Vergleich) und je Abschnitt zusammengesetzt; ist der Auszug leer (z. B. im Dry-Run mit Stub-Transport) → Volltext-Fallback. Der Judge erdet immer gegen den **vollen** VB (Quelle der Wahrheit).

> **Vor dem Umschalten:** Einen Workflow-Schritt erst dann produktiv auf `kontextBedarf: 'relevant'` stellen, wenn `--kontext both` für diesen Abschnitt **keine Regression** zeigt (Judge-Scores + Check-Pass-Raten ≥ `voll`). Default bleibt `voll`.

### Config-Schema

`models.json` — Array:

```json
[
  { "id": "gpt-oss-120b", "name": "gpt-oss 120B", "baseUrl": "http://localhost:8081", "model": "gpt-oss-120b", "klasse": "intern" },
  { "id": "qwen35-35b",   "name": "Qwen 3.5 35B", "baseUrl": "http://localhost:8082", "model": "qwen3.5-35b",  "klasse": "intern" }
]
```

`judge.json` — ein Objekt (API-Key kommt aus `process.env[apiKeyEnv]`):

```json
{ "id": "judge-sonnet", "name": "Claude Sonnet", "baseUrl": "https://openrouter.ai/api",
  "model": "anthropic/claude-3.5-sonnet", "apiKeyEnv": "OPENROUTER_API_KEY", "klasse": "extern" }
```

## Resume

Jedes Ergebnis wird **sofort** als JSONL-Zeile nach `<out>/results.jsonl` (bzw. `judge.jsonl`) angehängt. Beim Start liest die CLI die vorhandenen Zeilen und **überspringt erledigte** `(vbFile × modell × abschnitt × kontext)`-Kombinationen — der (riesige) reale Lauf ist so crash-sicher fortsetzbar. Der Kontext `voll` hängt **kein** Suffix an den Resume-Schlüssel → Alt-Ergebnisdateien (vor der Kontext-Achse) bleiben gültig. **Fehlgeschlagene** Läufe gelten NICHT als erledigt und werden bei einem erneuten Aufruf erneut versucht. `matrix.*` + `report.html` werden bei jedem Lauf aus dem vollständigen Stand neu erzeugt.

Ein unerreichbarer Endpunkt führt zu **sauberem Abbruch** mit Resume-Hinweis (kein endloses Retry).

## Concurrency

Default `--concurrency 1` (sequenziell, debuggbar, schont einen Single-Slot-`llama-server`). Höher setzen, wenn der lokale Server mehrere Slots hat bzw. für API-Modelle (vertragen Parallelität). JSONL-Append + Resume-Schlüssel sind gegen Interleaving robust.

## Grenzen / Hinweise

- **DSGVO:** Die Fixtures sind **fiktiv** → der Judge **darf** extern (OpenRouter) laufen. Ohne Judge-Config/-Key läuft die Harness als `--no-judge`. (Die App-Transport-Policy `enthaeltDokumentInhalte` ist ein separates Thema und betrifft dieses Dev-Tool nicht.)
- **KN noch nicht unterstützt:** Es gibt nur den `ZIM_EP_WORKFLOW` (A–G). KN-Fixtures werden **übersprungen und geloggt** (kein stiller Drop) — bis ein `ZIM_KN_WORKFLOW` existiert.
- **Import-Richtung** strikt `skill-eval → src/…`. **Kein** App-/Plugin-Code importiert aus diesem Ordner → bleibt aus dem Single-File-Bundle.
