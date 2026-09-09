# Tagesbrief — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHER SUB-SKILL: `superpowers:executing-plans` (Schritte mit Checkboxen). Gate/Abnahme/Commit bleiben im Hauptlauf.

**Grundlage:** [docs/superpowers/specs/2026-09-09-tagesbrief-design.md](../specs/2026-09-09-tagesbrief-design.md) · Umgesetzt am 2026-09-09.

## Ziel

Ein neues Home-Widget **Tagesbrief** auf Position 0 der Hauptspalte: ein deterministisch
gebauter Kurztext, der über Quellengrenzen hinweg rankt, was zuerst dran ist. Klickbare
Stellen im Satz, „dazu nachfragen" öffnet das bestehende Assistent-Dock. Kein LLM beim
Laden.

## Architektur

```
Quellen-Hooks (unrein)  →  useTagesbrief  →  baueBrief (REIN)  →  TagesbriefWidget
   bestehende, gecachte     sammelt Rohdaten   rankt + deckelt      rendert Segmente
```

Der Brief **leitet nichts Neues ab** — jedes Thema konsumiert eine bestehende reine bzw.
gecachte Quelle. Rangfolge nur über die Uhr-Themen (normiert auf Tage bis/seit
Fälligkeit), Neuigkeiten als ein Nachsatz.

## Tech-Stack

React 19 + TypeScript, Zustand-Store der Widget-Config, bestehende Hooks
(`useBestandsAufgaben`, `useEingangAmpelCounts`, `useQsFreigaben`, `useWeitermachenRows`),
Vitest für den reinen Kern.

## Global Constraints

- **Pitfall #11** — neues optionales Feature hinter ein Flag (`config-schema.mjs` +
  `feature-flags.ts` + Gating); OpenRouter in Prod-Builds bleibt verboten.
- **Pitfall #12** — nie Roh-Status vergleichen; Kategorie-Helfer bzw. `aufgabenAnzeige`.
- **Pitfall #16/#20** — jede Config-Mutation ist EIN `setState` + EIN `persist`.
- **Pitfall #48** — keine Personen-Achse im Nachtlauf-Thema.
- **Pitfall #54** — vier Sichtbarkeits-Achsen; der Brief bleibt **unmarkiert**, weil eine
  Marke die Selbst-Einblendung stilllegte (v6.19).
- **Home-Widgets-Invariante** — Config IDB-primär + Personal-Mirror, NIE registry.json,
  NIE Share, NIE Snapshot (Guard `home-widgets-local-only`).
- **Shell (Windows)** — keine Heredocs; Dateien nur per Write/Edit; Commit-Message über
  `.git/COMMIT_MSG.tmp`.
- **Parallele Sessions** — nur eigene Dateien stagen (Pathspec), `git status --short` vor
  `git add`.
- **Gate** — `check:docs` nach Doc/Guard, `check:quick` im inneren Loop, `npm run check`
  vor Commit, danach `build:devpl` mit geprüftem Exit-Code.
- **Neuen Guard einmal ROT sehen**, bevor er als grün gilt.

## Dateien im Überblick

| Datei | Rolle |
|---|---|
| `src/plugins/home/tagesbrief/typen.ts` | `Segment`, `BriefPunkt`, `Brief`, `ThemaId`, Config |
| `src/plugins/home/tagesbrief/themen.ts` | Themen-Katalog als Code (id, Label, Familie, Uhr) |
| `src/plugins/home/tagesbrief/baueBrief.ts` | Rein, `now` injiziert: ranken, deckeln, Nachsatz |
| `src/plugins/home/tagesbrief/useTagesbrief.ts` | Unrein: Quellen-Hooks verdrahten |
| `src/plugins/home/tagesbrief/TagesbriefWidget.tsx` | `WidgetShell` + Segmente + Rückfrage |
| `src/plugins/home/tagesbrief/TagesbriefConfigForm.tsx` | Themenwahl je Familie |
| `src/plugins/home/widgets/types.ts` | `WidgetTyp`, Config-Union, `hatWidgetDetailConfig` |
| `src/plugins/home/widgets/widgetCatalog.ts` | Katalog-Eintrag |
| `src/plugins/home/widgets/HomeWidgetStack.tsx` | `RENDERERS`-Zeile |
| `src/plugins/home/widgets/homeWidgetsStore.ts` | `ENTDECKUNG_WIDGETS`, Default v6, Migration |
| `src/plugins/home/widgets/useHomeWidgets.ts` | Versions-Stempel |
| `src/plugins/home/widgets/WidgetConfigForm.tsx` | Zweig |
| `src/core/sichtbarkeit/katalog.ts` | `widget('tagesbrief', 'Tagesbrief')` ohne Marke |
| `src/config/feature-flags.ts` · `scripts/config-schema.mjs` · `configs/*.json` | Flag |
| `src/__tests__/conventions-ui.test.ts` | Guard `entdeckung-ohne-marke` |
| `docs/architecture/home-widgets.md` · `CONTEXT.md` · `CLAUDE.md` · `docs/feedback-kontext/home.md` | Doku |

## Tasks

- [ ] **T1 — Spec + Glossar.** Spec mit `## 0. Anlass`; CONTEXT.md-Einträge „Tagesbrief"
      und „Thema (Tagesbrief)" mit *Nicht sagen: Baustein*. Verifikation: `check:docs`.
- [ ] **T2 — Flag `tagesbrief`.** `config-schema.mjs` (Default false), `isTagesbriefEnabled()`,
      an in dev/pl/local/local-fiktiv. Verifikation: `check:quick`.
- [ ] **T3 — Reiner Kern (Test zuerst).** `typen.ts`, `themen.ts`, `baueBrief.ts` +
      `__tests__/baueBrief.test.ts`. Kein `Date.now()` in `baueBrief`.
- [ ] **T4 — Am echten Bestand messen, DANN deckeln.** Verteilung der `tage`-Werte und die
      Punktzahl eines normalen Tages ausgeben, bevor Deckel und Schwellen festgezurrt werden.
- [ ] **T5 — Hook + Widget.** `useTagesbrief` (`'leerlauf'`), `TagesbriefWidget`
      (Segmente, `aria-label`, `laedt`, Leerfall, Rückfrage hinter `isAssistentPanelEnabled()`).
- [ ] **T6 — Registrierung.** `WidgetTyp`, Katalog, `RENDERERS`, Sichtbarkeits-Katalog
      **ohne Marke**, `ENTDECKUNG_WIDGETS`.
- [ ] **T7 — Config v6 + Migration.** `migriereV5Tagesbrief`: Reconcile zuerst, dann
      einblenden, dann einmalig Position 0. Idempotent; Versions-Stempel mitziehen.
- [ ] **T8 — Themenwahl-UI.** `TagesbriefConfigForm`, Zweig in `WidgetConfigForm`,
      `hatWidgetDetailConfig`.
- [ ] **T9 — Guard `entdeckung-ohne-marke`.** Erst rot sehen (probeweise `BETA`), dann grün.
- [ ] **T10 — Docs + Changelog.** home-widgets.md, CLAUDE.md, `docs/feedback-kontext/home.md`,
      `npm run version:bump -- minor "Tagesbrief" --user`.

## Verifikation

`npm run check` grün, `npm run build:devpl` Exit-Code 0. Abnahme in `dev:local` nach
Abschnitt 4 der Spec — insbesondere: keine Überschneidung mit der Alert-Karte, Klick landet
bei genau der genannten Menge, Abnahme mit ausgeschaltetem Beta-Schalter,
`window.__tf.fehler()` = 0.
