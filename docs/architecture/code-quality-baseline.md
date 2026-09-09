# Codequalitäts-Baseline — TeamFlow (GENERIERT)

> **GENERIERT — nicht von Hand editieren.** Aktualisieren: `npm run qualitaet`.
> Quelle: `scripts/code-quality-metrics.mjs` · versioniert, ohne Lauf-Datum.
>
> Diese Datei **misst**, sie verbietet nichts. Eine Zahl wird erst dadurch zur Regel,
> dass ein Guard unter `src/__tests__/` sie einfriert — und der misst selbst nach,
> statt diese Datei zu lesen.

**Umfang:** 2.878 Dateien unter `src/` (2.067 Produktion / 327.780 LOC · 811 Test / 120.698 LOC). `src/generated/` ist ausgeschlossen.

## Größe

| | Dateien | LOC | p50 | p90 | p99 | max | >400 | >500 | >800 | >1000 |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Produktion | 2.067 | 327.780 | 116 | 335 | 749 | 1.232 | 133 | 74 | 15 | 6 |
| Test | 811 | 120.698 | 115 | 274 | 568 | 1.915 | 29 | 16 | 4 | 3 |

Größte Produktionsdateien:

1. `src/plugins/suche/SuchSeite.tsx` — 1.232 LOC
2. `src/plugins/antraege/services/antraege-search-service.ts` — 1.175 LOC
3. `src/plugins/status-cockpit/useStatusCockpit.ts` — 1.162 LOC
4. `src/plugins/antraege/tableColumns.tsx` — 1.154 LOC
5. `src/core/services/skills/registry/migrations.ts` — 1.083 LOC
6. `src/plugins/antraege/AntraegeMain.tsx` — 1.075 LOC
7. `src/plugins/csv-sources-kuration/services/auto-refresh.ts` — 881 LOC
8. `src/core/services/skills/registry/check-engine.ts` — 848 LOC
9. `src/plugins/antraege/gutachten/GutachtenSection.tsx` — 840 LOC
10. `src/core/services/search/frageplan.ts` — 838 LOC

## Typsicherheit

| Kennzahl | Ist |
|---|--:|
| `as any` (Produktion) | 25 |
| `: any` (Produktion) | 7 |
| `@ts-ignore` / `@ts-nocheck` | 7 |
| `@ts-expect-error` | 10 |
| `eslint-disable` gesamt | 75 |
| davon **wirksam** (Regel ist aktiv) | 0 |
| davon **inert** (Regel gar nicht aktiv) | 75 |

**Inerte Direktiven sind Vorab-Stummschaltung.** Sie unterdrücken eine Regel, die
`eslint.config.js` nicht aktiviert — wer die Regel je einschaltet, bekommt null Treffer
und hält das für ein sauberes Ergebnis. Verteilung:

- `react-hooks/exhaustive-deps` — 50×
- `no-console` — 14×
- `@typescript-eslint/no-explicit-any` — 8×
- `@typescript-eslint/no-implied-eval` — 1×
- `@typescript-eslint/no-this-alias` — 1×
- `max-len` — 1×

## Fehlerbehandlung

`catch`-Blöcke im Produktionscode: **883**, davon **0** vollständig leer und **33** mit genau einem erklärenden Kommentar als Rumpf.

## Schulden-Marker

`TODO`/`FIXME`/`HACK`/`XXX`: **3** · `TODO(refactor …)`: **7**

Die `TODO(refactor …)`-Köpfe werden getrennt geführt, weil sie im Projekt eine
Geschichte haben: gesetzt in v2.3 an die damalige Top-10-Liste, seither mehrfach
angefasst, ohne dass die vorgeschlagene Aufteilung kam.

- `src/plugins/auslastung/components/KalibrierungsReport.tsx:1`
- `src/plugins/auslastung/views/ZuweisungsCockpit.tsx:1`
- `src/plugins/auslastung/views/admin/SetupWizard.tsx:1`
- `src/plugins/csv-sources-kuration/wizard/Step1Metadata.tsx:1`
- `src/plugins/dokumente/DokumentSidePanel.tsx:1`
- `src/plugins/dokumente/DokumenteListe.tsx:1`
- `src/plugins/kuration/foerderprogramme/filter/dialogs/FilterEditDialog.tsx:1`

## Guard-Ausnahmen (`// allow-…`)

**49** Ausnahmen über **14** Regeln, außerhalb der Guard-Dateien selbst (dort sind gleichlautende Vorkommen Fehlermeldungs-Text und Fixtures).

| Regel | Ausnahmen | ohne Begründung |
|---|--:|--:|
| `raw-modal` | 21 | 0 |
| `anfrage-export` | 4 | 0 |
| `direct-kuerzel` | 4 | 0 |
| `import-no-refresh` | 3 | 0 |
| `oeffnender-ping` | 3 | 0 |
| `sichtbarkeit-eine-mechanik` | 3 | 0 |
| `elidierte-wortlaut-vorgabe` | 2 | 0 |
| `raw-active-transport` | 2 | 0 |
| `raw-clipboard` | 2 | 0 |
| `blanket-idb-wipe` | 1 | 0 |
| `cta-fill` | 1 | 0 |
| `inline-frist-arithmetik` | 1 | 0 |

## Kopplung

Importe aus `src/core/` zurück nach `src/plugins/` — eine Schichtumkehr, weil der Kern seine Features nicht kennen soll: **47**

Plugin greift auf ein fremdes Plugin (Top 10):

| Kante | Importzeilen |
|---|--:|
| home → antraege | 34 |
| map-foerderfaehig → antraege | 24 |
| home → auslastung | 23 |
| auslastung → antraege | 15 |
| antraege → skill-verwaltung-kuration | 14 |
| suche → antraege | 13 |
| antraege → dokumente | 9 |
| antraege → meilensteine | 9 |
| chat → antraege | 8 |
| skill-verwaltung-kuration → antraege | 8 |

Höchster Fan-out (Importzeilen je Datei):

- `src/plugins/suche/SuchSeite.tsx` — 72
- `src/core/ShellLayout.tsx` — 57
- `src/plugins/antraege/AntraegeMain.tsx` — 55
- `src/core/App.tsx` — 48
- `src/plugins/feedback-board/FeedbackBoardPage.tsx` — 48

## Duplikate

Wörtlich geteilte Blöcke von **15** bedeutsamen Zeilen (ohne Leerzeilen, Kommentare und Zeilen unter 12 Zeichen). Die Fenstergröße ist die entscheidende Stellschraube: bei 6 Zeilen dominieren absichtlich parallele Familien das Bild.

Dateipaare mit mindestens einem geteilten Fenster: **7**

| Paar | geteilte Fenster |
|---|--:|
| src/plugins/antraege/aufbereitung/eval-panel/AufbereitungEvalPanel.tsx  ⇄  src/plugins/einstellungen/GedaechtnisEvalPanel.tsx | 26 |
| src/plugins/csv-sources-kuration/CsvSchemaDetailDialog.tsx  ⇄  src/plugins/csv-sources-kuration/wizard/Step2GroupSection.tsx | 14 |
| src/plugins/antraege/filter/facets/MultiSelectFacet.tsx  ⇄  src/plugins/antraege/filter/facets/SingleSelectFacet.tsx | 8 |
| src/core/services/csv/merger/batched.ts  ⇄  src/core/services/csv/merger/single.ts | 6 |
| src/plugins/anfragen/services/anonymisierung.ts  ⇄  src/plugins/anfragen/services/metadaten.ts | 5 |
| src/plugins/skill-verwaltung-kuration/SkillImportDialog.tsx  ⇄  src/plugins/skill-verwaltung-kuration/WorkflowImportDialog.tsx | 3 |
| src/plugins/csv-sources-kuration/CsvAddColumnsDialog.tsx  ⇄  src/plugins/csv-sources-kuration/CsvSourceReimportDialog.tsx | 1 |

## Testbezug

**313** von 1.330 reinen `.ts`-Modulen (23.5 %) werden in keiner Testdatei auch nur genannt.

> Bewusst kein Abdeckungsmaß: ein Modul ohne Erwähnung ist sicher ungetestet — eines
> mit Erwähnung ist damit noch nicht geprüft. Für die `.tsx`-Schicht existiert gar
> keine Zahl: `vitest.config.mts` fährt `environment: 'node'`, es gibt keine
> `.test.tsx`. Diese Lücke ist durch die manuelle `dev:local`-Abnahme ersetzt.

| Bereich | Produktion | Test | Test/Produktion |
|---|--:|--:|--:|
| `plugins/kuration` | 8.655 | 76 | 0.01 |
| `plugins/einstellungen` | 5.591 | 111 | 0.02 |
| `core/hooks` | 4.649 | 510 | 0.11 |
| `plugins/skill-verwaltung-kuration` | 9.103 | 1.169 | 0.13 |
| `plugins/meilensteine` | 4.201 | 648 | 0.15 |
| `components` | 21.428 | 3.329 | 0.16 |
| `plugins/feedback-board` | 4.890 | 832 | 0.17 |
| `core/components` | 3.412 | 613 | 0.18 |
| `plugins/status-cockpit` | 12.815 | 2.507 | 0.20 |
| `plugins/anfragen` | 3.156 | 689 | 0.22 |
| `plugins/csv-sources-kuration` | 11.227 | 2.816 | 0.25 |
| `plugins/suche` | 11.217 | 3.164 | 0.28 |

Größte Module ohne jeden Testbezug:

- `src/plugins/kuration/suche-index/hooks/useKorpusBau.ts` — 819 LOC
- `src/plugins/dev-infrastructure-test/panels/useTriagePanel.ts` — 646 LOC
- `src/core/services/skills/registry/gutachten-bg.seed.ts` — 582 LOC
- `src/core/services/csv/importer-schritte.ts` — 478 LOC
- `src/plugins/vorgangs-board/useVorgangsBoard.ts` — 446 LOC
- `src/plugins/doppelfoerderung/useDoppelfoerderung.ts` — 435 LOC
- `src/core/services/skills/registry/gutachten-kurzfassung.seed.ts` — 431 LOC
- `src/core/glossar/abkuerzungen.seed.ts` — 407 LOC
- `src/plugins/csv-sources-kuration/hooks/useCsvAutoRefreshCheck.ts` — 387 LOC
- `src/plugins/antraege/kurzfassung/useKurzfassung.ts` — 369 LOC

## Exporte ohne Nutzer

**339** von 5.959 exportierten Werten (5.7 %) kommen im ganzen Baum nur in ihrer eigenen Datei vor.

> Näherung per Token-Index. Sie ist genau deshalb ergiebig, weil `noUnusedLocals` alles
> *unterhalb* der Export-Grenze sauber hält — das hier ist der Blindfleck, den der
> Compiler nicht sehen kann. Ein ungenutztes `is…Enabled()` kann allerdings auch heißen,
> dass ein Modul **gar nicht** gated ist: das ist ein fachlicher Befund, kein Aufräumfall.

Dichteste Nester:

- `src/config/feature-flags.ts` — 11
- `src/core/services/skill-feedback/maturity.ts` — 7
- `src/core/services/feedback/feedbackLlm.ts` — 5
- `src/plugins/einstellungen/_shared/settings-primitives.tsx` — 5
- `src/plugins/antraege/aufbereitung/aufbereitung-settings.ts` — 4
- `src/plugins/antraege/filter/projektartQuickfilter.ts` — 4
- `src/plugins/antraege/nachforderungen/nf-service.ts` — 4
- `src/plugins/auslastung/services/matching/verbund-embedding.ts` — 4
- `src/plugins/auslastung/services/verbund/verbund-aggregation.ts` — 4
- `src/plugins/status-cockpit/klaerfragenExport.ts` — 4

## Die Guard-Suite über sich selbst

| Kennzahl | Ist |
|---|--:|
| Guard-Dateien unter `src/__tests__/` | 9 |
| `describe`-Blöcke | 104 |
| davon zeilenweise scannend | 61 |
| mit Positiv-/Musterkontrolle | 22 |
| **ohne Kontrolle** | 82 |
| Dateien in `ISOLATED_TESTS` | 51 |
| Testdateien mit `vi.mock` | 55 |
| davon **ohne** Isolationseintrag | 11 |

> Ein zeilenweise scannender Guard ohne Kontrolle ist die stillste Fehlerquelle der
> Suite: bricht ein Ausdruck über zwei Zeilen um, wird er nicht rot, sondern grün —
> ein funktionierender und ein entwaffneter Guard sehen dann gleich aus.

`vi.mock` auf Modulebene ohne Eintrag in `ISOLATED_TESTS` — die vorhergesagten
nächsten Ausfälle im Suite-Lauf:

- `src/core/__tests__/routes.test.ts`
- `src/core/services/ai/__tests__/bridge-assistent.test.ts`
- `src/core/services/ai/__tests__/bridge.test.ts`
- `src/core/services/assistent/gedaechtnis/__tests__/konsolidierung.test.ts`
- `src/core/services/assistent/gedaechtnis/__tests__/store.test.ts`
- `src/core/services/infrastructure/__tests__/connect-data-share.test.ts`
- `src/core/services/search/__tests__/embedding-tensor-freigabe.test.ts`
- `src/core/services/skill-feedback/__tests__/identity.test.ts`
- `src/core/services/skill-feedback/__tests__/write.test.ts`
- `src/plugins/auslastung/services/matching/__tests__/korpus-bau-fehler.test.ts`
- `src/plugins/zu-klaeren/__tests__/klaerung-share.test.ts`

