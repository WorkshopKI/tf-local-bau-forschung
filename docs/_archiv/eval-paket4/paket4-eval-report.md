# Journey-Paket 4 — Phase 5 Eval-Gate: Bericht

**Datum:** 2026-07-07 · **Modell (Generierung):** gpt-oss-120b (OpenRouter, **Proxy** — nicht das Prod-Qwen) · **Judge:** Claude Sonnet 4.6 (OpenRouter) · **Fixtures:** 6 fiktive EP-VBs (`--limit 6`) · **Kontext:** voll · **Abschnitte:** A, B

> ⚠️ **Reduzierter Lauf.** Der interne Prod-Generator (localhost:9090) lieferte im Test „fetch failed" nach ~5 min; daher OpenRouter-Proxy-Generierung bei kleinem n. n=6 liegt im Rausch-Boden (MoE nicht bit-deterministisch). Ein Voll-Eval auf dem Prod-Qwen (`--limit 20`) bleibt als Bestätigung offen.

## Judge-Mittelwerte (1–5)

| Abschnitt | Baseline (alt) | Kandidat V1 (neu) | Δ V1 | Retry V2 | Δ V2 |
|---|---|---|---|---|---|
| A gesamt | 3.25 | **3.33** | +0.08 ✓ | 2.67 | −0.58 ✗ |
| B gesamt | 4.29 | **4.04** | −0.25 ✗ | 3.96 | −0.33 ✗ |
| A check_ok | 0.70 | 0.73 | ✓ | 0.70 | — |
| B check_ok | 0.88 | 0.79 | ✗ | 0.83 | ✗ |

## Beleg-Mapping-Metriken (Kandidat)

| | V1 A | V1 B | V2 A | V2 B |
|---|---|---|---|---|
| Zitate mit Satz-Ref | 95 % | 95 % | 65 % | 98 % |
| **Gültige Referenzen (im Bereich)** | **97 %** | **95 %** | 74 % | 96 % |
| Satz-Abdeckung | 95 % | 94 % | 76 % | 91 % |

Gate-Kriterium „≥ 80 % gültige Referenzen": **V1 erfüllt (A 97 %, B 95 %)**; V2 verfehlt A (74 %).

## Gate-Verdikt

- **V1:** A besteht (verbessert sogar); B verfehlt Kriterium 1 (−0.25 > 0.2) + Kriterium 2 (check-rate) — getrieben von **1 Ausreißer-Fixture** (003: −1.25); 4 von 6 B-Fixtures flach/besser. Belege-Validität exzellent.
- **V2 (einziger erlaubter Retry, „nur Kernstellen zitieren"):** verschlechtert A deutlich (Coverage 65 %/74 %, Judge −0.58). **Verworfen.**

## Entscheidung

**V1 akzeptiert** (Nutzer-Entscheidung): Der B-Miss ist ausreißer-/rausch-getrieben bei n=6 auf einem Proxy-Modell; der Kontrakt-Mechanismus funktioniert nachweislich. Rollout vollzogen (marker-gesicherte Migration `GA_BELEG_KONTRAKT_MIGRATION`, überschreibt nur pristine A/B-Templates). **Offen / empfohlen:** Voll-Eval auf dem Prod-Qwen (`--limit 20`) zur Bestätigung, sobald der interne Generator gesund ist.

## Reproduktion

```bash
export OPENROUTER_API_KEY=sk-...
# Baseline-Registry (alte A/B-Templates):
npx vite-node --config vitest.config.mts eval/make-paket4-baseline-registry.ts
# Baseline:
npm run eval:skills -- --fixtures ./eval-fixtures-out/fixtures.json --models ./eval/models.or.json \
  --judge ./eval/judge.json --registry ./eval/paket4-baseline-registry.json \
  --sections A,B --kontext voll --limit 6 --concurrency 4 --out ./eval-out/paket4-baseline
# Kandidat (Code-Seed = neu, OHNE --registry):
npm run eval:skills -- --fixtures ./eval-fixtures-out/fixtures.json --models ./eval/models.or.json \
  --judge ./eval/judge.json --sections A,B --kontext voll --limit 6 --concurrency 4 --out ./eval-out/paket4-kandidat
# Beleg-Metriken:
npx vite-node --config vitest.config.mts eval/paket4-belege-metrics.ts eval-out/paket4-kandidat/results.jsonl
```
Für den Prod-Lauf `eval/models.local.json` (Qwen an localhost:9090) statt `models.or.json` verwenden und `--limit 20`.
