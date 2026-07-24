# Status-System neu — Bestandsaufnahme (Phase 0)

Verifizierter Ist-Stand vor dem Umbau (App-Version `2.309.0`). Beschreibt, worauf die drei neuen
Schichten (Katalog / Historie / Ableitung) aufsetzen. Ist-Zustand-Doku — bei Änderungen umschreiben,
nicht anhängen.

## 1. Statusfeld-Inventar (Fixtures + Kanon)

Die „Wahrheit" über die Position eines Antrags liegt im **Ensemble** mehrerer Statusfelder, nicht in
einem. Beobachtete Felder in den Fixture-Schemas (`docs/fixtures/schema-a|b|c.ts`, Rohdaten-CSVs
lokal/gitignored) und ihr Kanon:

| CSV-Roh-Spalte | Canonical-Feld | Typ | Beobachtete / kanonische Rohwerte |
|---|---|---|---|
| `STATUS_TV` | `status` | Wert | `bewilligt`, `Schlussvermerk` (Fixtures); Kanon zusätzlich: `beantragt`, `bearbeitungsreif`, `NL eingegangen`, `techn geprüft`, `kaufm geprüft`, `Gutachten fertig`, `VN geprüft`, `VN techn. geprüft`, `Widerruf`, `Anhörung zum Widerruf`, `bewilligungsreif`, `Bewilligungsentwurf VDI/VDE-IT`, `ablehnungsreif`, `Ablehnung`, `Rücknahmeempfehlung`, `Stellungnahme zur Rücknahmeempf.`, `Widerspruch zur Ablehnung`, `NF gestellt`, `keine weiteren NF`, `beendet`, `abgelehnt/zurückgezogen`, `abgebrochen`, `Irrläufer`, `unvollständig` |
| `STATUS_VB` | `verbund_status` | Wert | `bewilligt`, `Schlussvermerk`, `VN geprüft` (TV- und VB-Status divergieren real, z. B. TV=`Schlussvermerk` / VB=`VN geprüft`) |
| `VB_PHASE` | `vb_phase` | Wert (num.) | `3` (Fixtures); Domäne: 1=NW1, 2=NW2, 3=FuE, 4=DL, 5=DS, 9=Irrläufer |
| `D_AAE` | `antragsdatum` | Datum | Antragseingang |
| `D_ABB` | `bewilligung_datum` | Datum | Bewilligung |
| `D_AZ1_1` | `erstentscheidung` | Datum | vorläufige Erstentscheidung/Ablehnung (nur Master) |
| `D_VBE` | `vn_eingang_datum` | Datum | VN-Eingang Begleitphase (nur Bgl-Schema) |

Zusätzlich trägt der Master-Header FB-Status- und PreCheck-Status-Datumscodes (`D_XPC+`, `D_ALS`,
`D_ART`, `D_ABLT`, … + Text `T_XPC+` „Termin für Nachlieferung"), die
`src/core/services/csv/status-datum-gruppen.ts` per „jüngstes Datum gewinnt" zu
`fb_status_label`/`fb_status_datum` bzw. `precheck_status_label`/`precheck_status_datum` projiziert.
Diese Datumsfelder sind Kandidaten für Timeline-Events (Phase 2/5).

**Kanon-Quelle:** `src/core/utils/status-canonical.ts` — `FOERDERANTRAG_STATUSES` (Z. 42-90) +
`BAUANTRAG_STATUSES` (Z. 92-112) → `CATEGORY_MAP` (Z. 114-119); Pattern-Fallback
`BEGLEITUNG_PATTERN = /^(vn|zb)[\s.]/` (Z. 132) fängt ungelistete VN-/ZB-Werte → `begleitung`.

## 2. Historie-Mechanik — STOPP-Bedingung geprüft, NICHT ausgelöst

**Befund:** Die Import-Historie ist am Merge rekonstruierbar. Der Merger verwirft den Alt-Wert
**nicht**, bevor ein Diff möglich ist.

- `recomputeMultipleBatched` (`src/core/services/csv/merger/batched.ts:469`) lädt alle
  Bestands-Antraege/Verbuende **vor** dem Schreiben in In-Memory-Caches (`loadRecomputeCaches`, Z. 115).
- Pro Antrag: `existing` = Alt-Record aus dem Cache; ein frischer `merged`-Record wird per
  Zwei-Pass-Priority-Merge aufgebaut (Alt-Record wird nie in-place mutiert).
- Der Diff `alt→neu` läuft an **`batched.ts:263-289`**, **erst danach** setzt
  `batch.antraegeUpsert.set(...)` / `caches.antraegeByAz.set(...)` den Neu-Stand. Verbund-Diff analog
  `:357-377`. Single-Pfad identisch: `merger/single.ts:117-141`.
- Geschrieben wird beides (Antrag + Historie) in **einer** Multi-Store-Transaktion (`flushRecomputeBatch`).

Das ist der **Emissions-Hook** für die neuen Status-Events (Phase 2) — parallel zur bestehenden
`trackHistory`-Schleife, aber **katalog-getrieben** statt flag-getrieben.

**Heutige Historie (bleibt unangetastet):** zwei dedizierte append-only IDB-Stores
`antrag_historie` (keyPath `id`, Index `aktenzeichen`, `idb-store.ts:103-106`) +
`verbund_historie` (keyPath `id`, Index `verbund_id`). Writer `appendHistory`/`appendVerbundHistory`
(`idb-csv.ts:361,396`). Entry-Shape `AntragHistorieEntry {id, aktenzeichen, feld, alt_wert, neu_wert,
geaendert_am, csv_schema_id}` (`types.ts:314`). UI „↻ N Änderungen": `FieldHistoryModal.tsx` +
`AlleFelderSection.tsx:250-259` + `TvDetailBlock.tsx:54-58`. Gate heute: per-Spalte
`ColumnMappingEntry.trackHistory` (`types.ts:111`) — real nur in dev-fixtures für `status`/`vb_phase` an.

## 3. Consumer von `getStatusCategory` / Prädikaten (unverändert zu halten)

`getStatusCategory` + Prädikate sind **synchron/rein** und werden breit konsumiert. Der Refactor
(Phase 1) macht `getStatusCategory` snapshot-first **mit eingebautem `CATEGORY_MAP`-Fallback** — bei
fehlendem Snapshot bitweise identisch. Keine Signatur, kein Consumer-Verhalten ändert sich.

- **Ableitung/nächster Schritt:** `src/core/utils/naechsterSchritt.ts:117` (Home + Fördertabelle) —
  **lebendes** Modul, bleibt (der tote `src/plugins/home/naechsterSchritt.ts` ist bereits gelöscht).
- **Views/Prädikate:** `plugins/antraege/views.ts` (6 View-Prädikate + Zähler), `arbeitsvorrat.ts`,
  `eingangAmpel.ts`, `tableColumns.tsx` (kombinierte „Status und nächster Schritt"-Spalte),
  `bearbeiterFilter.ts`, `vorgaengerAntraege.ts`, `fristAnzeige.ts`, `csv/frist.ts`,
  `csv/merger/helpers.ts`.
- **Spine/Stepper:** `plugins/antraege/statusZuStepperPosition.ts` (`STEPPER_STATIONS`,
  5-Stationen-Ableitung aus der Kategorie) → `WorkflowStepper.tsx`, `useArtefaktLeiste.ts`.
- **Dashboard/Home/Suche:** `plugins/home/dashboardAggregate.ts`, `home/widgets/kanbanLanes.ts`,
  `chat/assistent/kontextSnapshot.ts`, `core/hooks/useUnifiedSearch.ts`,
  `core/services/assistent/kontext/assembliere.ts`.
- **Auslastung:** `plugins/auslastung/services/kapazitaet/altlast.ts`.
- **Gruppen/Farben/Chips:** `plugins/antraege/groupAggregates.ts` (`getStatusCategoryColor/Label`),
  `antragGroups.ts`, `StatusBarRow.tsx`, `suche/columns.tsx`, `filter/statusQuickChips.ts`,
  `filter/phaseQuickfilter.ts`, `home/widgets/*` (Lane-Config/Icons).

## 4. Drei orthogonale Achsen heute (Kontext, nicht zu vermischen)

1. **Amtlicher Status / Spine** — Roh-Status → `StatusCategory` (9 Werte, `status-canonical.ts`) →
   5-Stationen-Spine (`statusZuStepperPosition.ts`). **Die neue `SpinePhase` ist diese Spine (1:1).**
2. **Filter-Sidebar-Phase** — `PhaseId` (7 Werte, `plugins/antraege/filter/statusGroups.ts`,
   `getPhaseForStatus`), zeigt rohe CSV-Werte gruppiert. Bleibt eigenständig + unverändert.
3. **Artefakt-Achse** — `ArtefaktTyp` (ga/nf/abl/rne, `skills/registry/types.ts`) × `WorkflowEbene`,
   orthogonal zum amtlichen Status. Plus Regel-/Skill-Kategorie (`effektiveKategorie`,
   `kategorien.ts`) — QS-Klassifikation, kein Status.

Der neue Katalog vereinheitlicht **nicht** diese drei in v1; er trägt `spinePhase`+`rang` pro Wert und
speist ausschließlich die neue Ableitungs-Engine + Timeline + Cockpit. Katalog-getriebene
Vereinheitlichung des Steppers = v2.

## 5. IDB / Feature-Flags / Widget / Tests (Aufsetzpunkte)

- **IDB:** `IDBStore` v10 (`idb-store.ts:55`), Migration = sequentielle `if (oldVersion < N)`-Blöcke
  (`onupgradeneeded`, Z. 72 ff.). DB-Name pro Variante `getVariantDbName()` (`runtime-config.ts:282`).
  Vorbild append-only + Zeit-Index: `assistent_ereignisprotokoll` (`idb-store.ts:195-205`,
  Store-Wrapper `assistent/protokoll/store.ts`). → Phase 1 bumpt auf **v11** (zwei neue Stores
  `status_katalog` + `status_event`).
- **Feature-Flag-Kette (Vorbild `mapFoerderfaehig`):** `runtime-config.ts` (`TeamflowFeatures`) →
  `scripts/config-schema.mjs` (`DEFAULT_CONFIG.features`, nicht in `requiredFlags`) →
  `config/feature-flags.ts` (`isXEnabled()`) → `core/types/plugin.ts` (`PluginFeatureKey`) →
  `plugins/*/index.ts` → `plugins.config.ts`. → Phase 4 führt `statusCockpit` ein.
- **Widget-System:** `home/widgets/widgetCatalog.ts` (`WIDGET_KATALOG`, `sichtbarWenn`),
  `homeWidgetsStore.ts` (`reconcileVerfuegbareWidgets` → neue Typen `sichtbar:false`),
  `WidgetShell.tsx`, Dispatch `HomeWidgetStack.tsx` (`RENDERERS`), Guard `home-widgets-local-only`.
- **Konventionstests:** eine Datei `src/__tests__/codebase-conventions.test.ts` (Regeln inline),
  Tooling in `src/__tests__/conventions-lib.ts` (`ALL_TS_FILES`, `findInFile`, `findFilesViolating`).
  Modul-lokaler-Guard-Vorbild: `plugins/map-foerderfaehig/__tests__/konventionen.test.ts`.
  Vitest-Split `vitest.config.mts` (`ISOLATED_TESTS`).

## 6. Randnotiz — parallele Session

Der Arbeitsbaum trägt bei Phase-0-Start uncommittete Fremdänderungen (`skills/index.ts`,
`gutachten/types.ts`, `nachforderungen/*`, `map-foerderfaehig/abschluss/nf-suche.ts`, untracked
`docs/konzepte/`, `skills/textbausteine/`). Diese gehören einer parallelen Session — nicht anfassen,
nie mit-committen. Die Status-System-Commits enthalten ausschließlich Status-System-Dateien.
