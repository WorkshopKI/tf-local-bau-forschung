# Neue Tabellen-Detail-Seite (Master-Detail-Split) anlegen

Für eine neue tabellenartige Seite, bei der der User ein Item aus einer Liste
wählt und rechts daneben ein Detail/Editor öffnet. **Kein eigenes Split-Layout
bauen** — die Bausteine existieren.

## Bausteine (Pflicht)

1. **Master-Ansicht** = generische Tabelle aus [`src/components/data-table/`](../../src/components/data-table/index.ts)
   (`SortableTable`, `ColumnPicker`, `useTableSort`, `useColumnVisibility`,
   `useColumnWidths`). Spalten als `SortableColumn[]` definieren; Zeilen-Klick
   via `onRowClick`. Einzeilige Daten-Zeilen ohne Tabelle: [`ListItem`](../../src/components/ui/ListItem.tsx)
   `layout="inline"` + [`RowAction`](../../src/components/ui/RowAction.tsx).

2. **Split-Shell** = [`MasterDetailLayout`](../../src/components/master-detail/index.ts)
   (`@/components/master-detail`). Props:
   ```tsx
   <MasterDetailLayout
     list={<…Tabelle/Liste…>}
     detail={selectedId ? <…Editor/Detail…> : undefined}
     onCloseDetail={() => setSelectedId(null)}
     listWidthKey="teamflow_<feature>_narrow_width"
   />
   ```
   Defaults: `narrowDefaultWidth=460`, `narrowMinWidth=320`, `detailMinWidth=300`.
   Das Shell ist **datenagnostisch** (kein Filter-/Such-/Domänen-Wissen) — Resize,
   Breiten-Persistenz und Escape-Schließen sind eingebaut.

3. **Selektion** = reiner In-Page-React-State (`useState<…Id | null>`), KEIN
   eigener Router-Pfad pro Item. Klick auf eine Zeile setzt die Selektion →
   Detail rechts; Close/Save/Cancel/Escape setzen sie auf `null`.

4. **Höhenkontext**: Die Seite muss eine Flex-Spalte mit definierter Höhe sein,
   damit das Shell scrollen kann:
   ```tsx
   <div className="flex flex-col h-full min-h-[calc(100vh-60px)] overflow-hidden">
     <Header className="shrink-0" />          {/* Titel/Tabs/Toolbar bleiben sichtbar */}
     <MasterDetailLayout … />                 {/* füllt den Rest (flex-1 min-h-0) */}
   </div>
   ```

5. **Detail-Inhalt** bringt eigenes Scrollen mit (das Shell-Detail-Pane ist
   `overflow-hidden`): den Editor in `h-full overflow-y-auto` wickeln. Ein
   Close/Back-Button im Detail verdrahtet `onCloseDetail`.

## Nicht tun

- Kein eigenes `narrow`/`flex`-Split + Resize-Handle nachbauen — `MasterDetailLayout` nutzen.
- Keine Domänen-Logik (Filter, Suche, Aggregation) ins Shell ziehen — bleibt in der Seite.
- Detail nicht als Vollseiten-Ersatz der Liste rendern (alter Skill-Verwaltung-Antipattern).

## Referenzen

- **Förderanträge** ([AntraegePage.tsx](../../src/plugins/antraege/AntraegePage.tsx)/[AntraegeMain.tsx](../../src/plugins/antraege/AntraegeMain.tsx))
  — gewachsene Referenz-Implementierung des Musters (nicht das Shell selbst; mit
  Antrags-Spezifika verwoben, bewusst nicht extrahiert).
- **Skill-Verwaltung** ([SkillVerwaltungPage.tsx](../../src/plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx))
  — kanonischer Konsument von `MasterDetailLayout`.
- **Dokumente** ([dokumente/index.tsx](../../src/plugins/dokumente/index.tsx)) — noch hand-gerolltes Split
  (`narrow={!!selectedId}`), Migrations-Kandidat.
- **Split innerhalb eines Reiters**: To-do-Regeln im Status-Katalog
  ([TodoRegelnBereich.tsx](../../src/plugins/status-cockpit/TodoRegelnBereich.tsx)) — der Tab-Zweig
  der Seite bekommt einen eigenen `flex-1 min-h-0 flex flex-col` **ohne** `overflow-y-auto` (statt
  im gemeinsamen Seiten-Scroll zu hängen), der Bereichs-Kopf darüber ist `shrink-0`. Dort auch das
  Muster „ohne Auswahl breite Karten, mit Auswahl schlanke Zeilen" in EINEM `list`-Slot.

## Verifikation

- `npm run check` (typecheck + test + build:dev).
- HTML aus `dist-single/` öffnen: Zeilen-Klick öffnet Detail **rechts**, Liste
  schrumpft auf Sidebar; Escape/Close bringt sie voll zurück; Resize-Handle
  funktioniert, Breite überlebt Reload.
