# Suche
**Zweck:** Nutzer durchsucht Förderanträge und Dokumente programmweit mit einer hybriden Suche (Wortlaut + optional semantische Ähnlichkeit) und kann Treffer per KI mit Begründungen anreichern lassen.

**UI-Elemente & Begriffe:** Suchfeld oben, Dropdown „Ohne/Mit Ähnlichkeitssuche" (lädt bei Bedarf das Embedding-Modell), Button „Mit KI analysieren" (Begründungs-Overlay je Treffer), Button „Assistent" (öffnet das andockende KI-Chat-Panel rechts, kennt die aktuellen Treffer als Kontext), Export-Menü (CSV/XLSX/Zwischenablage), Filter-Chips nach Treffer-Typ, „Antragstyp"-Filter, „Begründungen entfernen". Ergebnistabelle mit sortier-/filterbaren, konfigurierbaren Spalten (Spalten-Auswahl über das Spalten-Menü). Status-Badges „Embedding-Modell lädt…", Lade-Phasen (Substring-/Embedding-/Dokumente-Treffer). **Leerzustand** (noch nichts getippt): Titel „{n} Anträge durchsuchbar" + kurze Feld-Erklärung + drei klickbare Beispiel-Chips (starten sofort eine Suche) + zwei dezente Hinweise; bei fehlendem Dokumentenindex ganz unten eine gedämpfte Info-Zeile „Volltextsuche … noch nicht eingerichtet" (kein Button — Index ist Kurator-Aufgabe).

**Typische Aktionen:**
- Suchbegriff eingeben (oder Beispiel-Chip im Leerzustand klicken), Treffer aus Anträgen/Dokumenten durchsehen
- Ähnlichkeitssuche ein-/ausschalten für semantische Treffer
- Treffer nach Typ oder Antragstyp filtern, Spalten anpassen
- Treffer per KI analysieren lassen (Begründungstext je Zeile)
- Ergebnisse als CSV/XLSX exportieren oder in die Zwischenablage kopieren
- Auf einen Antrags-Treffer klicken → springt zur Antrags-Detailseite

## Technik

**Datenmodell dahinter:** Orama-Hybrid-Index (BM25 + Vektor via EmbeddingGemma) über Anträge + Dokumente; Ergebnisse als `UnifiedSearchResult`. Sucheinstellungen/Recent-Searches im `useSucheStore` (Zustand). Embedding-Korpus wird programmweit aus IndexedDB/Share geladen (`getEmbeddings`, `autoBootstrapEmbeddingMirror`).

**Code:** `src/plugins/suche/` — Hauptdateien: `index.ts` (Plugin-Registrierung), `SuchSeite.tsx` (Haupt-UI), `useSearchResults.ts` (Filter/Sort/Spalten), `SearchResultsTable.tsx` (Spalten-Menü = `ColumnPicker`), `analyse/pipeline.ts` (KI-Begründungs-Pipeline).
