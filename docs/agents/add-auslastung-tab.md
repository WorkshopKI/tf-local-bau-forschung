# Neuen Tab im Auslastungs-Plugin hinzufügen

Das Auslastungs-Plugin (`src/plugins/auslastung/`) hat aktuell 3 Tabs (Klassifizierung / Zuweisung / Übersicht — v1.17). Neue Tabs werden in [AuslastungView.tsx](../../src/plugins/auslastung/views/AuslastungView.tsx) eingehängt; alle 3 Tabs werden eager gemountet und per CSS-Toggle umgeschaltet (v2.9), damit `computeQuartalsAuslastung` nur einmal pro Mount läuft.

## Touch-Points (Pflicht)

1. **Tab-Komponente** unter `src/plugins/auslastung/views/<TabName>.tsx`:
   - Top-Level-Layout mit einer einzigen View-Funktion. Daten via `useAuslastungData(s => s.data)` lesen.
   - Wenn der Tab schwere Berechnungen macht (Aggregate, Embedding-Reads): `useMemo` + `AuslastungIndexProvider`-Kontext nutzen.
   - Empty-State bei fehlendem `activeProgrammId` oder `!loaded` rendern (Pattern in [KlassifizierungsReview.tsx](../../src/plugins/auslastung/views/KlassifizierungsReview.tsx) abgucken).

2. **`AuslastungView.tsx`** — drei Stellen:
   - `TabId`-Union (Z. 34) ergänzen: `'klassifizierung' | 'zuweisung' | 'uebersicht' | 'mein-tab'`.
   - `ALL_TABS`-Set ergänzen.
   - `tabs`-Array im `useMemo` ergänzen (Z. 71–78): Label + optional `badge: () => count`.
   - Im Render-Block einen `<div style={{ display: tab === 'mein-tab' ? 'block' : 'none' }}><MeinTab /></div>` ergänzen (Pattern eager + CSS-toggle beibehalten, KEINE Conditional-Mount-Logik einführen).

3. **Default-Tab-Logik** (Z. 65–69): wenn der neue Tab in einem bestimmten Zustand der Default sein soll (z.B. wenn Setup nicht abgeschlossen), die `setTab('uebersicht')`-Logik analog erweitern.

## Optional

- **Persistenter UI-State** (z.B. Sortierung, Filter): in einem eigenen Zustand-Slot in [useAuslastungData.ts](../../src/plugins/auslastung/hooks/useAuslastungData.ts) ablegen, **nicht** in `localStorage` (User-Settings sind dort, persistente Tabs-States gehören in den App-Store).

- **Tab-spezifische Store-Action**: wenn der Tab Datenmutationen triggert, neue Action in `auslastung-store.ts` als `(state, …args) => …` ergänzen. **WICHTIG**: alle Mutationen in EINEM finalen `setState`-Block sammeln und EINEM `persist(storage)`-Call abschließen — siehe CLAUDE.md Pitfall #16+#20.

- **Direkt-Route** (`/auslastung/mein-tab`): nur nötig wenn der Tab tief verlinkbar sein soll. In `routes.ts` Sub-Route ergänzen + URL-Param in `useEffect` lesen.

- **Tests** unter `src/plugins/auslastung/__tests__/`: mindestens ein Snapshot-Test des leeren Tabs, falls Berechnungen drinstecken zusätzlich Unit-Tests der Aggregate-Funktion.

## Nicht ändern

- **Plugin-Registrierung** in `src/plugins/auslastung/index.ts` — Tabs sind kein eigenes Plugin, sondern Sub-Views.
- **Sidebar-Order** — der Tab erscheint *innerhalb* des Plugins, nicht in der App-Sidebar.

## Verifikation

- `npm run typecheck` — `TabId`-Union erzwingt die drei `display`-Checks.
- `npm run test` — vorhandene Auslastungs-Tests bleiben grün.
- `npm run build:devprod` + dev-HTML öffnen — Auslastungs-Plugin → neuer Tab sichtbar, Wechsel ist <100 ms (CSS-Toggle), kein Re-Mount.
