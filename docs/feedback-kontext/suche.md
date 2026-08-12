# Suche

## Zweck

Nutzer durchsucht Förderanträge und Dokumente programmweit mit einer hybriden Suche (Wortlaut + optional semantische Ähnlichkeit) und kann Treffer per KI mit Begründungen anreichern lassen.

## UI-Elemente & Begriffe

- **Suchfeld** oben — mehrzeilig und an der Ecke in beide Richtungen ziehbar (die Größe wird gemerkt). Enter startet/übernimmt, Shift+Enter macht einen Zeilenumbruch.
- **Dropdown „Ohne/Mit Ähnlichkeitssuche":** lädt bei Bedarf das Embedding-Modell.
- **Dropdown „Alle Wörter / Irgendein Wort":** verknüpft mehrere Stichwörter (UND ist Standard). Wirkt auf Wortlaut-Treffer; die Ähnlichkeitssuche vergleicht die Anfrage als Ganzes und bleibt unberührt.
- **„Mit KI analysieren":** öffnet den Assistenten rechts, der die aktuellen Treffer als Kontext kennt.
- **„Treffer begründen":** in der Filterzeile, sobald es Treffer gibt — Begründungs-Overlay je Treffer; „Begründungen entfernen" räumt sie wieder ab.
- **ASSISTENT-Streifen** am rechten Rand (auf jeder Seite): schaltet hier das andockende KI-Chat-Panel mit den Treffern als Kontext.
- **Export-Menü:** CSV / XLSX / Zwischenablage.
- **Filter:** Filter-Chips nach Treffer-Typ und ein „Antragstyp"-Filter.
- **Ergebnistabelle:** sortier-/filterbare, konfigurierbare Spalten (Spalten-Auswahl über das Spalten-Menü).
- **Status-Badges:** „Embedding-Modell lädt…" sowie die Lade-Phasen (Substring-/Embedding-/Dokumente-Treffer).
- **Leerzustand** (noch nichts getippt): Titel „{n} Anträge durchsuchbar" + kurze Feld-Erklärung + drei klickbare Beispiel-Chips (starten sofort eine Suche) + zwei dezente Hinweise. Fehlt der Dokumentenindex, steht ganz unten eine gedämpfte Info-Zeile „Volltextsuche … noch nicht eingerichtet" (kein Button — der Index ist Kurator-Aufgabe).

## Typische Aktionen

- Suchbegriff eingeben (oder Beispiel-Chip im Leerzustand klicken), Treffer aus Anträgen/Dokumenten durchsehen
- Mehrere Stichwörter eingeben und zwischen „Alle Wörter" und „Irgendein Wort" umschalten
- Ähnlichkeitssuche ein-/ausschalten für semantische Treffer
- Treffer nach Typ oder Antragstyp filtern, Spalten anpassen
- Assistenten öffnen (Streifen rechts oder „Mit KI analysieren") und zu den Treffern fragen
- Treffer per KI begründen lassen (Begründungstext je Zeile)
- Ergebnisse als CSV/XLSX exportieren oder in die Zwischenablage kopieren
- Auf einen Antrags-Treffer klicken → springt zur Antrags-Detailseite; von dort führt „Zurück zur Suche" (oder der Browser-Zurück-Knopf) auf dieselben Treffer zurück

## Technik

**Datenmodell dahinter:** Orama-Hybrid-Index (BM25 + Vektor via EmbeddingGemma) über Anträge + Dokumente; Ergebnisse als `UnifiedSearchResult`. Sucheinstellungen/Recent-Searches im `useSucheStore` (Zustand); Anfrage + Trefferfilter liegen dort sitzungs-lokal, damit sie den Sprung ins Antrags-Detail überleben. Die Wort-Verknüpfung steht in `useSuchVerknuepfung` (UND ⇒ alle Wörter im Substring-Korpus + Orama-`threshold` 0). Embedding-Korpus wird programmweit aus IndexedDB/Share geladen (`getEmbeddings`, `autoBootstrapEmbeddingMirror`).

**Code:** `src/plugins/suche/` — Hauptdateien: `index.ts` (Plugin-Registrierung), `SuchSeite.tsx` (Haupt-UI), `useSearchResults.ts` (Filter/Sort/Spalten), `SearchResultsTable.tsx` (Spalten-Menü = `ColumnPicker`), `analyse/pipeline.ts` (KI-Begründungs-Pipeline), `herkunft.ts` (Rückweg aus dem Antrags-Detail).
