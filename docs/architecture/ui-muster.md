# UI-Muster / Layout-Schicht

Die App hat eine **geteilte, domänenfreie Layout-Schicht** in `src/components/` — neue Module bauen Layout **nicht** selbst nach. Erst die Schicht prüfen, dann das passende Bauteil verwenden. Inventar + Drift-Evidenz + Adoptions-Status: [docs/layout-audit.md](../layout-audit.md).

**Entscheidungstabelle:**

| Brauche ich… | nimm |
|---|---|
| Liste + Detail (+ optional Aufnahme) | `MasterDetailLayout` ([src/components/master-detail/](../../src/components/master-detail/MasterDetailLayout.tsx)) — reich (Förderanträge) wie schlank über denselben Detail-Slot |
| Ergebnis-/Datentabelle (sortierbar, Spalten-Konfig) | `SortableTable` + `SortIcon` + `ColumnPicker` ([src/components/data-table/](../../src/components/data-table/)) |
| Vordefinierte **Listen-Sichten mit Zähler** | `ScopeTabs` ([src/components/ui/ScopeTabs.tsx](../../src/components/ui/ScopeTabs.tsx)) — `variant='tabs'` (breit/unterstrichen) · `variant='pills'` (kompakt) |
| Generische Section-/Settings-Navigation (ohne Zähler-Sichten) | `Tabs` ([src/components/ui/tabs.tsx](../../src/components/ui/tabs.tsx)) |
| Seitenkopf (großer Titel + Meta/Aktionen) | `PageHeader` ([src/components/ui/PageHeader.tsx](../../src/components/ui/PageHeader.tsx)) |
| „Hilfe"-Knopf im Seitenkopf (Kurzanleitung aus dem Kontext-Doc) | `SeitenHilfeButton` ([src/components/help/SeitenHilfeButton.tsx](../../src/components/help/SeitenHilfeButton.tsx)) — gehört auf **jede** Seite mit `docs/feedback-kontext/<id>.md`, rechtsbündig als letztes Element der Kopf-Aktionen; Guard `seitenHilfe.test.ts` |
| Caps-Abschnitts-Label | `SectionHeader` ([src/components/ui/SectionHeader.tsx](../../src/components/ui/SectionHeader.tsx)) |
| Status als Pill / farbiger Punkt | `StatusBadge` / `StatusDot` ([src/components/ui/StatusBadge.tsx](../../src/components/ui/StatusBadge.tsx)) — Farbe kommt vom Aufrufer |
| Filter-Chip „Label: Wert" (optional entfernbar) | `FilterChip` ([src/components/ui/FilterChip.tsx](../../src/components/ui/FilterChip.tsx)) |
| Primär-CTA | shadcn `Button` `variant='default'` ([src/components/ui/button.tsx](../../src/components/ui/button.tsx)) — trägt seit v2.144 die wählbare `--tf-primary` |

**Tabellenbreite:** `SortableTable` rendert die `<col>` als **Prozent** ihrer Pixel-Summe und passt sich damit der Container-Breite an — erst unter der Lesbarkeitsgrenze (`RESPONSIVE_MIN_WIDTH`, 720px) scrollt sie horizontal. Pixel-`<col>` wären ein harter Boden für die Tabellenbreite (CSS 2.1 §17.5.2.1: genutzte Breite = das Größere aus `width` und Spaltensumme); Begründung + Messung in [tableSizing.ts](../../src/components/data-table/tableSizing.ts). Wer bewusst **scrollen statt stauchen** will (viele Spalten, z.B. Förderanträge), setzt `fitContentWidth`; wer den Nutzer die Gesamtbreite pinnen lassen will, reicht `totalWidth`/`onTotalWidthChange` aus `useTotalTableWidth` durch.

**Harte Regel:** Neue Module bauen **KEIN** eigenes Layout. Kein paralleles Master/Detail, **keine eigene Listen-Sicht-Tab-Leiste** (gehört in `ScopeTabs`), kein eigener Page-Header/Badge. Förderanträge (reich) und Auslastung (schlank) sind dieselbe `MasterDetailLayout`. Der Guard `no-parallel-scope-tabs` ([codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts)) fängt neue hand-gebaute Unterstrich-Tabs.

**Bewusste Ausnahme:** `AntraegePage` nutzt für Master/Detail noch eine eigene Implementierung (Filter-Sidebar-Drittpane) statt `MasterDetailLayout` — Migration als spätere Phase offen (siehe [docs/layout-audit.md](../layout-audit.md)). Bei **offenem Detail** rendert die Liste die schmale Kompakt-Spalte ([KompaktListe.tsx](../../src/plugins/antraege/KompaktListe.tsx), feste ~230px, VM aus [kompaktRows.ts](../../src/plugins/antraege/kompaktRows.ts)) statt der Voll-Tabelle; die Detailseite selbst ist ein schlanker Orchestrator ([VerbundDetail.tsx](../../src/plugins/antraege/VerbundDetail.tsx)) über Kopf+Stepper ([VerbundKopf.tsx](../../src/plugins/antraege/VerbundKopf.tsx) / [statusZuStepperPosition.ts](../../src/plugins/antraege/statusZuStepperPosition.ts), amtlicher Status → Stepper-Position, **nie** Status-Literal-Vergleich · Pitfall #12), Artefakt-Leiste ([artefakte/](../../src/plugins/antraege/artefakte/)) und kollabierte Daten-Sektionen ([CollapsibleDataSection.tsx](../../src/plugins/antraege/CollapsibleDataSection.tsx)). Terminal-Prädikat + relative Frist: `isTerminalStatus` ([status-canonical.ts](../../src/core/utils/status-canonical.ts)) → [fristAnzeige.ts](../../src/plugins/antraege/fristAnzeige.ts). Nächster-Schritt-Formel (PreCheck-bewusst) im Core: [naechsterSchritt.ts](../../src/core/utils/naechsterSchritt.ts). Geschichte: CHANGELOG „Journey-Paket 2" (v2.175–v2.182).
