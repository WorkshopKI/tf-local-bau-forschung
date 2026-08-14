# Layout-Audit — kanonische Layout-Schicht (Primitive + Archetypen)

> **Stand:** v2.143.x · Read-before-write-Inventar der fünf Referenzmodule (Förderanträge, Auslastung, Einstellungen, Suche, Chat).
> **Zweck:** Drift-Evidenz dokumentieren + festhalten, was an der „kanonischen Schicht" bereits existiert und was wirklich fehlt. Grundlage für den schlanken Umbau (siehe „Umfang" unten).

## Kernbefund: ein Großteil der Schicht existiert bereits

Der ursprüngliche Phasen-Prompt nahm eine Extraktion „von Grund auf" an. Das Audit zeigt: vieles ist schon da und domänenfrei.

| Muster (Spec-Zielname) | Realität | Pfad |
|---|---|---|
| `MasterDetailShell` | **existiert** als `MasterDetailLayout` (6 rendernde Konsumenten) | [src/components/master-detail/MasterDetailLayout.tsx](../src/components/master-detail/MasterDetailLayout.tsx) |
| `SortableColumnHeader` / `ColumnConfigDropdown` | **existiert** als `SortableTable` + `SortIcon` + `ColumnPicker` | [src/components/data-table/](../src/components/data-table/) |
| `SectionHeader` | **existiert** (domänenfrei, collapsible) | [src/components/ui/SectionHeader.tsx](../src/components/ui/SectionHeader.tsx) |
| `PrimaryButton` | **existiert** (shadcn `default`-Variante) — nur Token koppeln | [src/components/ui/button.tsx](../src/components/ui/button.tsx) |
| generische Tabs | **existiert** | [src/components/ui/tabs.tsx](../src/components/ui/tabs.tsx) |
| Badge | **existiert** (shadcn) | [src/components/ui/badge.tsx](../src/components/ui/badge.tsx) |
| **`PageHeader`** | **fehlt** — 5× hand-rolled `<h1 className="text-[22px] font-medium …">` | — |
| **`StatusBadge` / `StatusDot`** | **fehlt** — `StatusBarRow`/`StatusDotRow`/`KategoriePill`, domänen-gekoppelt | — |
| **`FilterChip`** | **fehlt** — `ActiveFilterChips`, `CollapsibleSeg`, Chat-`sf-chip` | — |
| **`ScopeTabs`** (variant tabs/pills) | **fehlt** — Förderanträge-Inline-Tabs + Chat-Pills driften auseinander | — |

## Drift-Evidenz pro Muster

### PageHeader (großer Seitentitel)
Fünfmal hand-rolled, jeweils leicht abweichend (Margins, Subtitle ja/nein):
- [src/plugins/antraege/AntraegeHeader.tsx](../src/plugins/antraege/AntraegeHeader.tsx) (~Z. 112) — `text-[22px] font-medium`
- [src/plugins/auslastung/views/AuslastungView.tsx](../src/plugins/auslastung/views/AuslastungView.tsx) (~Z. 91) — H1 + Subtitle
- [src/components/settings/SettingsHubPage.tsx](../src/components/settings/SettingsHubPage.tsx) — H1 + `mb-6`; trägt seit v4.33 **beide** Hub-Seiten (Einstellungen, Kuration)
- [src/plugins/dokument-review/DokumentReviewPage.tsx](../src/plugins/dokument-review/DokumentReviewPage.tsx) — seit v4.39 dieselbe Kopfzeile wie der Hub daneben (`px-8 pt-4 pb-6`, Titel links, Hilfe-Knopf am Blattrand); vorher stand dort nur der Knopf
- Chat `ConversationHeader` — Titel in der Konversations-Kopfzeile
- Suche — **kein** H1 (Abweichung; bleibt vorerst so)

### Kuration (v4.33–v4.40 auditiert und bereinigt)
War nie im Audit. Neun Sidebar-Einträge mit vier Paddings, drei Rumpfbreiten,
zwei Tab-Implementierungen, null `PageHeader`, viermal derselbe Sperr-Hinweis
von Hand. Heute: **ein** Hub in der geteilten Einstellungs-Seitenform (fünf
Panels, in der Sidebar „Datenpflege"), daneben **eine** eigenständige
Arbeitsfläche (Dokument-Review, gleicher Rahmen) und die Gruppe „Developer"
für die zwei Entwickler-Panels. „Kuration" und „Developer" sind seit v4.40
zuklappbar (Standard offen, gemerkt je Gerät). Der
Sperr-Hinweis ist ein Bauteil ([KuratorGesperrtHinweis](../src/components/kurator/KuratorGesperrtHinweis.tsx)).
Offen: `src/plugins/csv-sources-kuration/wizard/` (5 Schritte, eigenes Layout) —
läuft als Dialog über dem Panel und ist nicht Teil der Seitenform.

### Tabs/Pills mit Zähler (→ ScopeTabs)
Zwei optisch ähnliche, strukturell getrennte Implementierungen + eine generische:
- **breit/unterstrichen:** [src/plugins/antraege/AntraegeHeader.tsx](../src/plugins/antraege/AntraegeHeader.tsx) (Z. ~127–150) — Inline-Render, Zähler als grauer Text, „Offen 51 · Überfällig 251 · … · Alle 387"
- **kompakt/Pills:** [src/plugins/chat/components/ConversationSidebar.tsx](../src/plugins/chat/components/ConversationSidebar.tsx) (Z. ~101–107) — `sf-chip`-Buttons + `.sf-n`-Zähler-Span (CSS in `chat.css`), „Alle / Anträge / Angeheftet"
- **generisch (bleibt):** [src/components/ui/tabs.tsx](../src/components/ui/tabs.tsx) — Section-/Settings-Navigation mit optionalem Badge (Einstellungen). **Kein** ScopeTabs-Ziel — anderes Muster (Navigation, nicht Listen-Sicht-mit-Zähler).
- **anderes Muster (bleibt):** `CollapsibleSeg`/`SegGroup` ([src/plugins/antraege/filter/CollapsibleSeg.tsx](../src/plugins/antraege/filter/CollapsibleSeg.tsx)) — Dropdown-Filter „Label: Wert ▸" mit 50+ Nutzungen; **kein** Scope-Tab.

### Status-Pill / -Dot
Domänen-gekoppelt, keine geteilte Primitive:
- [src/plugins/antraege/StatusBarRow.tsx](../src/plugins/antraege/StatusBarRow.tsx) — schmale Balken, Farbe via `getStatusCategoryColor()`
- [src/plugins/antraege/StatusDotRow.tsx](../src/plugins/antraege/StatusDotRow.tsx) — runde Punkte, gleiche Farbquelle
- [src/plugins/auslastung/components/KategoriePill.tsx](../src/plugins/auslastung/components/KategoriePill.tsx) — entfernbare Kategorie-Pill (anderes Farb-/Affordance-Modell)

### Filter-Chip
- [src/plugins/antraege/filter/ActiveFilterChips.tsx](../src/plugins/antraege/filter/ActiveFilterChips.tsx) — entfernbarer „Label: Wert ✕"-Chip
- Chat-`sf-chip` (wird in Phase 3 zu `ScopeTabs variant='pills'`)
- `CollapsibleSeg` (Dropdown — bleibt)

### Section-Header (bereits geteilt, mit Derivaten)
- Kanonisch: [src/components/ui/SectionHeader.tsx](../src/components/ui/SectionHeader.tsx)
- Derivate (außerhalb dieses schlanken Umfangs): `StatusSectionHeader`, `StatusBand` (antraege), `InlineCapsHeader` (auslastung). Konsolidierung später.

## CTA-Primärfarben-Bug (real)

In [src/theme.css](../src/theme.css):
- Z. 138 `--primary: var(--tf-text);` → CTAs erben die **Textfarbe** (anthrazit) statt der wählbaren `--tf-primary`.
- Z. 139 `--primary-foreground: var(--tf-bg);`
- Z. 288–289 mappen Tailwind `--color-primary*` → `--primary*`, d.h. alle `*-primary`-Utilities hängen daran.
- Blast-Radius in `src/**/*.tsx`: nur 4 Accent-Flächen (`button` default = CTA, `button` link, `switch` checked, `slider` range) — alle legitim „primär", aktuell fälschlich anthrazit.
- `--tf-primary-foreground` flippt im Dark-Block (Z. 222 → `var(--tf-bg)`) und wird in [Step2KindFilterToggle.tsx](../src/plugins/csv-sources-kuration/wizard/Step2KindFilterToggle.tsx) (Z. 35) genutzt → **nicht** global ändern; stattdessen neues `--tf-on-primary: #fff` (ohne Dark-Flip) für die CTA-Fläche.
- Preset „Bernstein" ([src/components/ui/theme.ts](../src/components/ui/theme.ts), `PRESET_COLORS` Index 5) liegt bei `l: '42%'` = 4,21:1 gegen Weiß (< 4,5:1) → auf `'40%'`. Die übrigen sechs Presets liegen bei 4,9–6,6:1.

## Bestehende Shell wird von Förderanträge NICHT genutzt (dokumentierte Ausnahme)

[AntraegePage.tsx](../src/plugins/antraege/AntraegePage.tsx) baut die Collapse-Leiste (Z. 142–160) und den Resize-Handler (Z. 75–96) **byte-identisch** zur [MasterDetailLayout](../src/components/master-detail/MasterDetailLayout.tsx) selbst nach (deren Docstring sagt explizit „aus dem Förderanträge-Muster destilliert, nicht kopiert"). Zusätzlich hat `AntraegePage` einen **dritten Pane** (persistente `FilterSidebar` + `FilterDrawer`-Overlay), den die Shell nicht modelliert.

→ Eine Migration auf die Shell wäre **kein No-op** und damit nicht „verhaltens-invariant" zu garantieren. **Bewusste Entscheidung:** im aktuellen schlanken Umfang **nicht** migriert. Als separate, später zu beauftragende Phase offen.

## Umfang dieses Umbaus (schlank)

**In Scope:**
1. Theme/CTA-Token-Fix + Bernstein 42→40 % + Kontrast-Guard.
2. Vier fehlende Primitive bauen (PageHeader, StatusBadge/StatusDot, FilterChip, ScopeTabs) — additiv.
3. Zwei klare ScopeTabs-Konsolidierungen: Förderanträge-Header-Tabs → `variant='tabs'`; Chat-Filter → `variant='pills'` (einzige bewusste Sichtänderung).
4. PageHeader/StatusBadge/FilterChip an klaren, invarianten Stellen adoptieren.
5. Konventions-Guard (`no-parallel-scope-tabs`) + CLAUDE.md-Muster-Katalog.

**Bewusst NICHT in Scope:** Förderanträge-Master/Detail auf die Shell (Filter-Sidebar-Drittpane); Suche/Auslastung/Einstellungen-Archetyp-Umstellung; `intake`-Slot an der Shell; Konsolidierung der SectionHeader-Derivate.

## Adoptions-Status (Phase 3 + 4)

**Migriert (byte-invariant, gleiches Aussehen):**
- `ScopeTabs variant='tabs'` ← Förderanträge-Header-Tabs ([AntraegeHeader.tsx](../src/plugins/antraege/AntraegeHeader.tsx))
- `ScopeTabs variant='pills'` ← Chat-Historie-Filter ([ConversationSidebar.tsx](../src/plugins/chat/components/ConversationSidebar.tsx)) — die eine bewusste Konsistenz-Änderung
- `PageHeader` ← Förderanträge-Titel ([AntraegeHeader.tsx](../src/plugins/antraege/AntraegeHeader.tsx)) — exakter Match (gleiche Wrapper-/H1-Klassen + Meta-Slot)
- `StatusDot` ← [StatusDotRow.tsx](../src/plugins/antraege/StatusDotRow.tsx)
- `FilterChip` ← [ActiveFilterChips.tsx](../src/plugins/antraege/filter/ActiveFilterChips.tsx)
- `MasterDetailLayout` ← To-do-Regeln im Status-Katalog ([TodoRegelnBereich.tsx](../src/plugins/status-cockpit/TodoRegelnBereich.tsx)) — Split **innerhalb eines Reiters**: der Tab-Zweig der Seite ist ein eigener `flex-1 min-h-0 flex flex-col` ohne Seiten-Scroll, der Bereichs-Kopf darüber `shrink-0`
- `ViewModeToggle` ← Feedback-Board (v3.24): die hand-gebaute Liste/Board-Segmentgruppe ist weg, die Modi sind jetzt eine Prop des geteilten Bausteins. Die vier Bestandsaufrufer blieben wortgleich

**Migriert mit bewusstem, kleinem Sicht-Delta:**
- `DarstellungDropdown` ← Förderanträge (v3.24 aus `plugins/antraege/` gehoben) → adoptiert vom **Feedback-Board** für Gruppierung · Dichte · Archivierte. Lange byte-invariant; **mit v3.35 beauftragt geändert**: das Menü-Innere ist das Zeilen-Pattern des Handoffs (`_design/handoff/dropdown/`) — eine Achse = eine Zeile, Segment bzw. Schalter statt Optionsliste mit Häkchen, Kopfzeile mit „Zurücksetzen", Knopf mit `+N` statt `·`-Kette. Gemessen: 380 × 182 px für drei Achsen statt rund 430 px Höhe. Beide Aufrufer zusammen umgestellt; die Seiten selbst (`AntraegeMain`, `FeedbackBoardPage`) blieben unangetastet, weil Props und `onChange`-Signatur gleich geblieben sind.
- `SegmentedToggle` ← trägt seit v3.35 zusätzlich die Segment-Zeilen des Darstellungs-Menüs: zwei additive Props (`rolle='auswahl'` → `radiogroup`/`radio` statt `tablist`/`tab`, `breit` → füllt die Zeile) plus ein sichtbarer Fokusring. Die Bestandsaufrufer blieben unverändert — ein zweites, menü-eigenes Segment hätte die Verdopplung nur verschoben.
- `SegmentedToggle` ← `FarbmodusOption`, die **zweimal wortgleich** existierte ([FeedbackKanbanEinstellungen](../src/components/feedback/FeedbackKanbanEinstellungen.tsx) + [WidgetConfigForm](../src/plugins/home/widgets/WidgetConfigForm.tsx)) → gemeinsamer [FarbmodusToggle](../src/components/kanban/FarbmodusToggle.tsx). Nicht byte-invariant: vorher zusammengezogene Segmentgruppe mit Trennlinie und `--tf-bg-secondary`-Füllung, jetzt Track + heller Aktiv-Chip. Beide Stellen zusammen umgestellt, sonst wandert die Verdopplung nur.
- `Popover` ← die zwei hand-gebauten `absolute`-Dropdowns in [SponsorButton](../src/components/feedback/SponsorButton.tsx) (dieselbe Datei, 12 px vs. 12,5 px). Gewinn: Esc, Klick-daneben und Portal-Platzierung, die keine der Kopien hatte.
- **`TfBoard` ← alle drei Kanbans (v3.45)** — der einzige Fall im Register, in dem eine Extraktion schon einmal da war und **wieder zerfiel**: `KanbanBoard` wurde v2.228 aus dem Feedback-Kanban gehoben, v3.17 baute das Board sie im Handoff nach. Belegte Folgen bis v3.44: Schiene 46 px (JSX) gegen 44 px (CSS), „+ N weitere" in drei Fassungen, zwei tote Flags (`layout='fest'`, `dense`) — und **`spalten: 1\|2` als totes Versprechen**: im Popover wählbar, persistiert, durchgereicht, im Nachbau nie gelesen. Konsolidiert Richtung **CSS** (nicht Tailwind-JSX), weil zwei Regeln Vorfahren-Zustands-Selektoren sind und in JSX zu Prop-Drilling bis in den Karten-Renderer würden. Alle drei Aufrufer zusammen umgestellt, sonst wandert die Verdopplung nur. Sicht-Deltas bewusst und gemessen: Kopf-Lücke 4 px statt 8 (bei „Wartet auf Antragsteller" in 170 px fehlten der Bezeichnung genau 4 px), Zähler rechtsbündig (vorher 148 px Leerraum hinter der Pille), Schiene einheitlich 44 px, `LanePills` einheitlich 120 px. Neue Guards `no-parallel-board-geometry` + `no-parallel-board-dnd`. Details: [board-komponente.md](architecture/board-komponente.md).

**Neue Fläche, die kein geteiltes Bauteil bekommt (v4.48):**
- **Chronik „nach Schritt"** ([StatusSchrittMatrix.tsx](../src/plugins/antraege/status/StatusSchrittMatrix.tsx)) — eine eigene `<table>` mit Pixel-`<colgroup>`, **nicht** `SortableTable`. Sie ist keine Liste von Datensätzen: die Spalten sind die Teilvorhaben *dieses* Verbunds (also je Vorgang andere), es gibt nichts zu sortieren, zu filtern oder zu konfigurieren, und die Zeilenmenge ist eine Ableitung. Was `SortableTable` trägt — Breitenmessung über `measureRows`, Spalten-Picker, Resize-Griffe, Sticky-Kopf, Virtualisierung — wäre hier durchweg totes Gewicht. Die Ansichts-Umschalter nutzen dagegen das Primitiv [SegmentedToggle](../src/components/ui/SegmentedToggle.tsx), die Filter-Chips [ToggleChip](../src/components/ui/ToggleChip.tsx) (additive Props: `zahl`, `tonung`, `zusatz` und die eckige, häkchenlose Form `form="marke"` für Leisten, die zugleich Legende sind). Details: [chronik-und-zeitstrahl.md](status-system/chronik-und-zeitstrahl.md).

**Gebaut, aber (noch) NICHT adoptiert — bewusst, weil nicht 1:1 invariant:**
- `PageHeader` an **Auslastung** ([AuslastungView.tsx](../src/plugins/auslastung/views/AuslastungView.tsx)) + **Einstellungen** ([EinstellungenPage.tsx](../src/plugins/einstellungen/EinstellungenPage.tsx)): deren H1 nutzt abweichendes `leading-none`/`tracking-[-0.01em]`/`gap-0` bzw. ein nacktes `<h1>` ohne `leading` — eine Umstellung würde das Aussehen minimal ändern (verboten außer Chat-Pills). Adoption erst, wenn `PageHeader` die nötigen Props bekommt oder eine bewusste Normalisierung beauftragt wird.
- `StatusBadge` (Pill mit Label): aktuell **keine** byte-invariante Fundstelle — `StatusBarRow` rendert *Balken* (kein Pill/Dot), `KategoriePill` hat ein reicheres Affordance-/Farbmodell (Ring + Häkchen + Remove). Das Primitiv steht für künftige Status-Pills bereit (smoke-getestet).

## Regressions-Anker (Tests, die nicht inhaltlich angefasst werden)

- [src/components/master-detail/__tests__/masterDetailLayout-logic.test.ts](../src/components/master-detail/__tests__/masterDetailLayout-logic.test.ts)
- `src/plugins/antraege/__tests__/{filterViewInteraction,views,buildDisplayRows,listCollapse,dashboardCounts}.test.ts` + `filter/__tests__/statusQuickChips.test.ts`
- `src/plugins/chat/__tests__/{conversation-groups,store,format-stats}.test.ts`
- `src/plugins/auslastung/__tests__/*` (Zuweisungs-Pipeline)
