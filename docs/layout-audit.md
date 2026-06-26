# Layout-Audit — kanonische Layout-Schicht (Primitive + Archetypen)

> **Stand:** v2.143.x · Read-before-write-Inventar der fünf Referenzmodule (Förderanträge, Auslastung, Einstellungen, Suche, Chat).
> **Zweck:** Drift-Evidenz dokumentieren + festhalten, was an der „kanonischen Schicht" bereits existiert und was wirklich fehlt. Grundlage für den schlanken Umbau (siehe „Umfang" unten).

## Kernbefund: ein Großteil der Schicht existiert bereits

Der ursprüngliche Phasen-Prompt nahm eine Extraktion „von Grund auf" an. Das Audit zeigt: vieles ist schon da und domänenfrei.

| Muster (Spec-Zielname) | Realität | Pfad |
|---|---|---|
| `MasterDetailShell` | **existiert** als `MasterDetailLayout` (6 Konsumenten) | [src/components/master-detail/MasterDetailLayout.tsx](../src/components/master-detail/MasterDetailLayout.tsx) |
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
- [src/plugins/einstellungen/EinstellungenPage.tsx](../src/plugins/einstellungen/EinstellungenPage.tsx) (~Z. 67) — H1 + `mb-6`
- Chat `ConversationHeader` — Titel in der Konversations-Kopfzeile
- Suche — **kein** H1 (Abweichung; bleibt vorerst so)

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

## Regressions-Anker (Tests, die nicht inhaltlich angefasst werden)

- [src/components/master-detail/__tests__/masterDetailLayout-logic.test.ts](../src/components/master-detail/__tests__/masterDetailLayout-logic.test.ts)
- `src/plugins/antraege/__tests__/{filterViewInteraction,views,buildDisplayRows,listCollapse,dashboardCounts}.test.ts` + `filter/__tests__/statusQuickChips.test.ts`
- `src/plugins/chat/__tests__/{conversation-groups,store,format-stats}.test.ts`
- `src/plugins/auslastung/__tests__/*` (Zuweisungs-Pipeline)
