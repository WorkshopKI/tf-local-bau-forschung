# TeamFlow Local — Claude Code Task Prompts

Dieses Dokument enthält Copy-Paste-fertige Prompts für Claude Code.
Führe sie in der angegebenen Reihenfolge aus. Jeder Prompt baut auf dem vorherigen auf.

---

## Phase 1: Grundgerüst

### Task 1.1 — Projekt Setup

```
Lies ARCHITECTURE.md und CLAUDE.md.

Initialisiere das TeamFlow Local Projekt:

1. Vite + React 19 + TypeScript Setup (template react-ts)
2. Installiere: zustand, lucide-react, mammoth, turndown, marked, minisearch
3. Installiere dev: tailwindcss, @tailwindcss/vite, vite-plugin-singlefile, @types/turndown
4. Konfiguriere vite.config.ts:
   - @vitejs/plugin-react
   - @tailwindcss/vite
   - vite-plugin-singlefile im mode 'single'
   - base: './' (normal) bzw '' (single mode)
   - build.target: 'esnext'
   - worker.format: 'es'
5. Konfiguriere tsconfig.json: strict mode, path aliases (@/ → src/)
6. Erstelle die komplette Verzeichnisstruktur laut CLAUDE.md
7. Erstelle package.json scripts:
   - dev, build, build:single
   - build:single soll mit --mode single bauen
8. Erstelle eine minimale src/main.tsx die "TeamFlow" rendert
9. Verifiziere: npm run build:single erzeugt EINE index.html
10. Verifiziere: dist-single/index.html öffnet sich per file:// im Browser ohne Fehler

Kein Styling nötig, nur das technische Grundgerüst das kompiliert und als Single-File funktioniert.
```

### Task 1.2 — Theme System

```
Lies ARCHITECTURE.md Abschnitt 11 (UI & Theming).

Implementiere das CSS Variable Theme System:

1. Erstelle src/theme.css mit allen CSS Custom Properties:
   - Light mode als :root defaults
   - Dark mode als [data-theme="dark"]
   - Primärfarbe HSL-basiert (--tf-primary-h, --tf-primary-s, --tf-primary-l)
   - Alle Farben aus ARCHITECTURE.md: bg, bg-secondary, bg-sidebar, text, text-secondary, border, hover
   - Spacing: sidebar-w, radius, radius-sm
2. Erstelle src/ui/theme.ts:
   - PRESET_COLORS Array: Blau(221), Grün(142), Violett(262), Orange(25), Teal(174), Rot(0), Neutral(220/10%)
   - applyThemeColor(hue, saturation?) Funktion
   - toggleDarkMode() Funktion
   - getThemeFromStorage() / saveThemeToStorage() mit localStorage-Fallback auf IndexedDB
3. Importiere theme.css in main.tsx
4. Tailwind Config: Erweitere NICHT die Tailwind-Config mit den Farben — wir nutzen sie als
   arbitrary values: bg-[var(--tf-bg)], text-[var(--tf-primary)], etc.

Teste: Farben sind sichtbar, Dark Mode toggle funktioniert.
```

### Task 1.3 — App Shell mit Sidebar und Plugin Router

```
Lies ARCHITECTURE.md Abschnitte 2 (High-Level), 7 (Plugin-System) und CLAUDE.md.

Baue die App Shell — das Hauptlayout mit Sidebar und Plugin-Routing:

1. src/core/types/plugin.ts — TeamFlowPlugin Interface:
   - id, name, icon, category ('workflow'|'tools'|'admin'), order, component
   - Optional: adminOnly, badge (()=>number|null), onInit
2. src/plugins.config.ts:
   - Importiert alle Plugins, exportiert enabledPlugins Array
   - Unterstützt VITE_PLUGINS env var Filter
   - Für jetzt: nur home und einstellungen Plugin als Platzhalter
3. src/core/Shell.tsx — Hauptlayout:
   - Sidebar links (var(--tf-sidebar-w) breit, collapsible auf 0)
   - Sidebar zeigt: Logo/Titel oben, dann nav mit Plugin-Einträgen (Icon + Name), Settings/Admin unten
   - Content area rechts, flex-1, overflow-auto
   - Active plugin wird als State gehalten, default = erstes Plugin
   - Sidebar-Einträge gruppiert nach category
   - Toggle-Button zum Ein-/Ausklappen der Sidebar
   - Design: Clean wie ChatGPT — minimaler Chrome, kein visuelles Rauschen
   - Nutze lucide-react Icons
4. src/plugins/home/index.ts + HomePage.tsx:
   - Einfache Willkommensseite: "TeamFlow" Titel, kurze Beschreibung
   - Plugin-Definition exportieren
5. src/plugins/einstellungen/index.ts + EinstellungenPage.tsx:
   - Platzhalter mit Überschrift "Einstellungen"
   - Plugin-Definition exportieren
6. src/core/App.tsx:
   - Rendert Shell mit enabledPlugins
7. Aktualisiere src/main.tsx

Styling: Tailwind + CSS Variables. ChatGPT-inspiriert: Sidebar mit hover-States, aktives Plugin
hervorgehoben mit primary-light Background und primary Text.
Mobile: Sidebar standardmäßig eingeklappt unter 768px.
```

### Task 1.4 — Shared UI Components

```
Erstelle die grundlegenden wiederverwendbaren UI-Komponenten in src/ui/.
Alle Komponenten nutzen Tailwind + CSS Custom Properties für Theming.
Design: Clean, minimal, ChatGPT-inspiriert. Keine überladenen Styles.

1. Button.tsx:
   - Varianten: primary, secondary, ghost, danger
   - Größen: sm, md, lg
   - Props: loading (zeigt Spinner), disabled, icon (Lucide Icon), children
   - Primary: bg primary, hover primary-dark, white text
   - Secondary: bg transparent, border, hover bg-secondary
   - Ghost: kein Border, hover bg-hover

2. Card.tsx:
   - Einfacher Container: bg-[var(--tf-bg)], border, rounded-[var(--tf-radius)], padding
   - Optional: title prop (rendert h3 im Header)

3. Input.tsx:
   - Wrapper um <input> mit Label, Error-State, Beschreibung
   - Styling konsistent mit Theme

4. Dialog.tsx:
   - Modal-Dialog mit Overlay (bg-black/50)
   - Props: open, onClose, title, children, footer
   - Escape-Key und Overlay-Click zum Schließen
   - Animiert: fade-in, scale-in

5. Badge.tsx:
   - Kleine Status-Badges: Farbe + Text
   - Varianten: default, success, warning, error, info

6. Tabs.tsx:
   - Tab-Navigation: horizontal, underline-style
   - Props: tabs Array, activeTab, onChange

7. Select.tsx:
   - Styled <select> Wrapper, konsistent mit Input

8. FileDropZone.tsx:
   - Drag & Drop Area für Datei-Upload
   - Visual feedback beim Hover
   - Props: onFiles(File[]), accept string, multiple boolean

9. MarkdownRenderer.tsx:
   - Nimmt markdown string, rendert als HTML via marked
   - Styled Headings, Lists, Code-Blocks, Tabellen
   - Sanitized output (kein dangerouslySetInnerHTML ohne Sanitizing)

Jede Komponente in eigener Datei, unter 100 Zeilen.
Exportiere alles über src/ui/index.ts Barrel-Export.
```

### Task 1.5 — Storage Service

```
Lies ARCHITECTURE.md Abschnitt 9 (Storage-Architektur).

Implementiere den Dual-Layer Storage Service:

1. src/core/services/storage/idb-store.ts:
   - Generischer IndexedDB Wrapper
   - Methods: get(key), set(key, value), delete(key), keys(prefix?)
   - Nutze 'idb-keyval' Pattern (ein Object Store, key-value)
   - Database name: 'teamflow', Store name: 'kv'
   - Handles serialization (JSON für Objekte, raw für Strings/Buffers)

2. src/core/services/storage/fs-store.ts:
   - File System Access API Wrapper
   - Constructor nimmt DirectoryHandle
   - Methods:
     - readFile(path): string
     - writeFile(path, content): void
     - readJSON(path): T
     - writeJSON(path, data): void
     - exists(path): boolean
     - listFiles(path, extension?): string[]
     - ensureDirectory(path): void
   - Pfade sind relativ zum Root-Handle (z.B. 'vorgaenge/bauantraege/BA-2025-001/meta.json')
   - Erstelle Unterverzeichnisse automatisch wenn nötig

3. src/core/services/storage/index.ts — StorageService Facade:
   - Properties: idb (IDBStore), fs (FileServerStore | null)
   - init(): Öffnet IDB, prüft gespeicherten FS-Handle, requested permission
   - connectFileServer(): showDirectoryPicker, Handle in IDB speichern
   - isFileServerConnected(): boolean
   - Methoden für Vorgänge: loadVorgang(id), saveVorgang(vorgang), listVorgaenge(type)
   - Methoden für Artefakte: saveArtifact(vorgangId, artifact), loadArtifacts(vorgangId)
   - Optimistic Locking via modified Timestamp bei saveVorgang

4. src/core/hooks/useStorage.ts:
   - React Hook der StorageService aus Context bereitstellt
   - StorageProvider in App.tsx

5. src/core/types/vorgang.ts:
   - Vorgang Interface: id, type, title, status, priority, assignee, created, modified, deadline, tags, artifacts, notes
   - Artifact Interface: id, type, filename, content, created, author, tags, vorgangId
   - VorgangStatus: 'neu'|'in_bearbeitung'|'nachforderung'|'in_pruefung'|'genehmigt'|'abgelehnt'|'archiviert'

Teste: IDB speichern/laden funktioniert. FileServer connect öffnet Dialog.
```

### Task 1.6 — Onboarding Flow

```
Lies ARCHITECTURE.md Abschnitt 13 (Onboarding-Flow).

Implementiere den Erststart-Onboarding-Dialog:

1. src/core/services/storage/idb-store.ts muss schon existieren (Task 1.5)

2. src/core/Onboarding.tsx — Multi-Step Dialog:
   Step 1: Willkommen
   - "Willkommen bei TeamFlow!" Überschrift
   - Input: Name (required)
   - Select: Abteilung (Bauanträge / Forschung / Beide)
   - Farbauswahl: 7 Preset-Farben als klickbare Kreise, ausgewählt = Check-Icon
   - [Weiter →] Button

   Step 2: Datenverzeichnis
   - Erklärungstext: "TeamFlow speichert Daten auf eurem File Server..."
   - [📁 Verzeichnis wählen] Button → showDirectoryPicker()
   - Zeigt gewählten Ordnernamen an
   - Optional: [Ohne File Server starten] Link (nur IndexedDB)
   - [Weiter →] Button

   Step 3: Fertig
   - "Alles eingerichtet!" mit Zusammenfassung
   - Hinweis auf Bookmarklet (kommt in Phase 2)
   - [Los geht's →] Button

3. Logik:
   - Profil in IndexedDB speichern: { name, department, theme: { hue, dark } }
   - FS-Handle in IndexedDB speichern
   - Theme sofort anwenden
   - Flag 'onboarding-complete' in IndexedDB setzen

4. src/core/App.tsx:
   - Prüft 'onboarding-complete' in IDB
   - Wenn nicht vorhanden → Onboarding anzeigen
   - Wenn vorhanden → Shell anzeigen, Theme + Profil laden

Design: Zentrierter Dialog, max-w-md, saubere Typographie, Farbkreise für Theme-Auswahl.
Kein komplexer Wizard — einfach, freundlich, schnell durch.
```

### Task 1.7 — Einstellungen Plugin

```
Implementiere das Einstellungen-Plugin vollständig:

src/plugins/einstellungen/EinstellungenPage.tsx:

Sections (als Tabs oder vertikales Layout):

1. Profil:
   - Name (Input, änderbar)
   - Abteilung (Select)
   - Anzeige: Profilbild-Platzhalter (Initialen-Avatar, Kreis mit Primärfarbe)

2. Darstellung:
   - Primärfarbe: 7 Preset-Kreise (wie im Onboarding) + Custom Color Picker
   - Dark/Light Mode Toggle
   - Live-Vorschau: Änderungen sofort sichtbar

3. AI-Provider:
   - Aktiver Provider: Radio-Buttons (Streamlit Bridge / llama.cpp / Cloud API)
   - Streamlit: URL Input (default: http://localhost:8501), [Bridge testen] Button
   - llama.cpp: Endpoint URL, Modell-Name, [Verbindung testen] Button
   - Cloud: Endpoint URL, Modell-Name, API Key (password input), [Testen] Button
   - Status-Badge je Provider: verbunden/nicht verbunden/nicht konfiguriert

4. Speicher:
   - File Server Status: Verbunden / Nicht verbunden
   - Ordner-Pfad anzeigen (wenn verbunden)
   - [Verzeichnis wechseln] Button
   - [Neu verbinden] Button (wenn Berechtigung abgelaufen)
   - IndexedDB Nutzung anzeigen (ungefähre Größe)

Speichere alle Settings in IndexedDB über den StorageService.
Nutze die UI Components aus src/ui/.
```

### Task 1.8 — Bauanträge Plugin (CRUD)

```
Lies ARCHITECTURE.md Abschnitte 9 (Storage) und 10 (Plugin-Skizzen).

Implementiere das Bauanträge-Plugin mit vollständigem CRUD:

1. src/plugins/bauantraege/types.ts:
   - Nutze Vorgang Interface aus core/types/vorgang.ts
   - BauantragMeta extends Vorgang mit spezifischen Feldern:
     grundstueck, bauherr, architekt, gebaeudetyp

2. src/plugins/bauantraege/BauantraegeListe.tsx:
   - Header: "Bauanträge" + [+ Neuer Antrag] Button
   - Filter-Leiste: Status-Dropdown, Tag-Filter, Freitext-Suche
   - Liste als Cards:
     - ID + Titel prominent
     - Status Badge (farbcodiert)
     - Frist-Datum, Zuständiger, Tags
     - Click → Detail-Ansicht
   - Empty State wenn keine Anträge

3. src/plugins/bauantraege/BauantragDetail.tsx:
   - Tabs: Übersicht | Dokumente | Artefakte | Notizen
   - Übersicht: Metadaten-Karte, Status-Auswahl (Dropdown), Fristen
   - Dokumente: Liste der zugehörigen .md Files, Upload-Button
   - Artefakte: Liste generierter Dokumente (Emails, Gutachten, Nachforderungen)
   - Notizen: Freitext-Feld, auto-save
   - Zurück-Button zur Liste
   - [Bearbeiten] / [Löschen] Aktionen

4. src/plugins/bauantraege/BauantragForm.tsx:
   - Dialog oder Full-Page Form
   - Felder: Titel, Grundstück-Adresse, Bauherr, Architekt, Gebäudetyp,
     Priorität (Select), Tags (Eingabe mit Komma), Deadline (Date Input), Notizen
   - Validierung: Titel required, Deadline muss in der Zukunft liegen
   - Speichert über StorageService (IDB + File Server wenn verbunden)
   - Auto-generierte ID: BA-{YYYY}-{NNN}

5. src/plugins/bauantraege/index.ts:
   - Plugin-Definition mit badge() für offene Anträge-Count

6. Zustand Store: src/plugins/bauantraege/store.ts
   - State: bauantraege[], loading, error, filters
   - Actions: load, add, update, delete, setFilters
   - Init: Laden aus StorageService

Daten-Persistenz: Erstelle meta.json auf File Server (wenn connected), immer in IndexedDB.
Design: Clean Card-basiert, Status-Badges farbig, kompaktes Layout.
```

### Task 1.9 — Single-File Build Verification

```
Verifiziere den gesamten Single-File Build:

1. Führe aus: npm run build:single
2. Öffne dist-single/index.html direkt per file:// Protokoll im Browser
3. Prüfe systematisch:
   - [ ] Keine Console-Errors
   - [ ] Sidebar rendert mit allen Plugin-Einträgen
   - [ ] Theme: Primärfarbe wechseln funktioniert
   - [ ] Theme: Dark/Light Toggle funktioniert
   - [ ] Onboarding: Wird beim ersten Öffnen angezeigt
   - [ ] Onboarding: Name eingeben, Farbe wählen, durchklicken
   - [ ] Einstellungen: Alle Sections erreichbar
   - [ ] Bauanträge: Neuen Antrag anlegen
   - [ ] Bauanträge: Antrag in Liste sichtbar
   - [ ] Bauanträge: Detail-Ansicht öffnen
   - [ ] Bauanträge: Status ändern
   - [ ] File Server: Verzeichnis wählen Dialog öffnet sich
   - [ ] IndexedDB: Daten überleben Browser-Reload

4. Prüfe die Dateigröße von index.html (sollte < 2MB sein ohne Embedding-Modell)
5. Wenn Fehler: Fixe sie und erkläre was das Problem war

Erstelle einen kurzen Report was funktioniert und was nicht.
```

---

## Phase 2: AI & Dokumente

### Task 2.1 — Streamlit Bookmarklet Bridge

```
Lies ARCHITECTURE.md Abschnitt 4 (AI-Bridge: postMessage).

Implementiere die Streamlit Bridge über postMessage:

1. public/bridge.js:
   - Vollständiger Bridge-Code aus ARCHITECTURE.md
   - postMessage-basiert (NICHT BroadcastChannel!)
   - Status-Badge im Streamlit-Tab
   - Ping/Pong für Verbindungstest
   - Antwort-Erkennung via Polling (MutationObserver war fragil)
   - Sauberes Error-Handling mit Timeout

2. src/core/services/ai/transports/streamlit.ts:
   - StreamlitBridgeTransport Klasse
   - window.open() mit festem Fensternamen 'teamflow-streamlit'
   - postMessage für Requests, addEventListener('message') für Responses
   - ensureConnection(), ping(), submitMessages()
   - Pending-Map mit Timeout-Handling

3. Generiere ein minifiziertes Inline-Bookmarklet aus bridge.js:
   - Build-Script das bridge.js → minified bookmarklet javascript: URL erzeugt
   - Ausgabe in public/onboarding.html (draggable Link)

4. Onboarding-Seite aktualisieren:
   - Step für Bookmarklet-Setup (optional, überspringbar)
   - Draggable Bookmarklet-Link
   - [Bridge testen] Button: sendet Ping, zeigt Ergebnis

Teste: Bookmarklet im Streamlit-Tab aktivieren, Ping von TeamFlow senden, Pong empfangen.
```

### Task 2.2 — AI Bridge Orchestrator + Direct LLM Transport

```
Lies ARCHITECTURE.md Abschnitt 4 (vollständig).

1. src/core/services/ai/transports/direct-llm.ts:
   - DirectLLMTransport Klasse
   - fetch() zu OpenAI-kompatiblem Endpoint
   - Streaming via SSE (response.body ReadableStream)
   - Constructor: endpoint, model, apiKey (optional)
   - Für llama.cpp UND Cloud APIs (gleicher Transport, andere Config)

2. src/core/services/ai/bridge.ts:
   - AIBridge Klasse: verwaltet alle Transports
   - Default: streamlit, konfigurierbar
   - switchProvider(), getTransport(), getAvailableProviders()
   - getChatConfig() für useChat Hook

3. src/core/hooks/useAIBridge.ts:
   - React Hook + Context Provider
   - AIBridgeProvider in App.tsx

4. Einstellungen-Plugin updaten:
   - AI-Provider Section nutzt echte Bridge
   - Test-Buttons rufen bridge.ping() / test-Request auf
   - Provider-Wechsel speichert in IDB

Kein useChat noch — das kommt in Task 2.3.
```

### Task 2.3 — Chat Plugin mit Vercel AI SDK

```
Installiere: npm install @ai-sdk/react

Implementiere das Chat-Plugin:

1. src/plugins/chat/ChatView.tsx:
   - Nutze useChat von @ai-sdk/react mit custom transport von AIBridge
   - Chat-UI: Nachrichten-Liste + Input-Feld unten
   - User-Messages rechts (primary-light bg), AI-Messages links (bg-secondary)
   - Streaming: Text erscheint schrittweise
   - Markdown-Rendering in AI-Antworten (MarkdownRenderer Component)
   - Loading-State: Typing-Indicator
   - Error-State: Retry-Button
   - Provider-Anzeige: Kleines Badge oben "via Streamlit" / "via llama.cpp" / "via Cloud"

2. src/plugins/chat/index.ts:
   - Plugin-Definition

3. System-Prompt Handling:
   - Default System-Prompt für TeamFlow-Kontext
   - Optional: Vorgang-Kontext wenn aus Bauantrags-Detail gestartet

Design: ChatGPT-ähnlich — Messages mit Avatar-Initialen, clean, viel Whitespace.
Input: Textarea die mit Enter sendet, Shift+Enter für Newline.
```

### Task 2.4 — Dokument-Import (DOCX → MD)

```
Implementiere die Dokument-Konvertierung in einem Web Worker:

1. src/workers/converter.worker.ts:
   - Importiert mammoth und turndown
   - Empfängt: { type: 'convert', file: ArrayBuffer, filename: string, format: 'docx'|'pdf'|'md' }
   - DOCX: mammoth.convertToHtml → Turndown → Markdown + YAML Frontmatter
   - MD/TXT: Durchreichen + Frontmatter hinzufügen
   - PDF: Später (Phase 2 Erweiterung)
   - Antwortet: { type: 'result', markdown: string, warnings: string[] }

2. src/core/services/converter/index.ts:
   - DocConverter Klasse
   - Erstellt Inline Worker via import mit ?worker&inline
   - convert(file: File): Promise<ConvertedDoc>
   - Progress-Callback

3. src/plugins/dokumente/index.ts + DokumenteListe.tsx:
   - Plugin-Definition
   - Upload-Zone (FileDropZone) für DOCX/PDF/MD
   - Liste importierter Dokumente
   - Klick → Markdown-Preview (MarkdownRenderer)
   - Tags editierbar
   - Einem Vorgang zuordnen (Dropdown)

4. Bauanträge-Plugin erweitern:
   - Dokumente-Tab: Upload direkt in den Vorgang
   - Konvertierte Docs automatisch in Vorgang-Ordner speichern

Worker MUSS als ?worker&inline importiert werden für file:// Kompatibilität.
```

---

## Phase 3: Suche & Index

### Task 3.1 — MiniSearch Volltext-Index

```
Implementiere die Keyword-Suche als sofort verfügbaren Fallback:

1. src/core/services/search/fulltext.ts:
   - FulltextSearch Klasse
   - MiniSearch konfigurieren: fields ['text', 'title', 'tags'], fuzzy 0.2, prefix true
   - indexDocument(doc): Dokument zum Index hinzufügen
   - search(query, filters?): Ergebnisse mit Score
   - exportIndex() / importIndex(): JSON Serialisierung für IDB + File Server
   - Automatisch beim App-Start aus IDB laden
   - Automatisch beim Dokument-Import neue Docs indexieren

2. src/plugins/suche/SuchSeite.tsx:
   - Suchfeld prominent oben
   - Filter: Typ (Bauantrag/Forschung/Dokument), Tags, Datum
   - Ergebnis-Liste: Snippet mit Highlight, Source-Link, Score
   - Klick → öffnet Vorgang oder Dokument-Preview
   - "Powered by Keyword Search" Badge (später + "Vector Search")

Keine Embeddings in dieser Task — nur MiniSearch.
```

### Task 3.2 — Admin Plugin: Batch-Indexer

```
Lies ARCHITECTURE.md Abschnitte 6 (Embedding Client/Admin Split) und 7 (Admin-Plugin).

Implementiere das Admin-Plugin für die Batch-Indexierung:

1. src/plugins/admin/index.ts + AdminPage.tsx:
   - Plugin-Definition (adminOnly: true)
   - Tabs: Index-Verwaltung | (später: User-Verwaltung)

2. src/plugins/admin/IndexManager.tsx:
   - Status-Karte: Dokumente-Anzahl, Chunks, Letztes Update, Wer
   - GPU-Erkennung: navigator.gpu?.requestAdapter()
   - Buttons: [Nur neue Dokumente] + [Komplett neu indexieren]
   - Fortschritts-Balken mit aktuellem Dokument
   - Options: Chunk-Größe, Modell-Info

3. src/core/services/search/batch-indexer.ts:
   - BatchIndexer Klasse
   - init(): Transformers.js Pipeline laden (WebGPU wenn vorhanden, sonst WASM)
   - indexAll(storage, onStatus): Inkrementelles Indexing
   - Hash-basierte Änderungserkennung (crypto.subtle.digest SHA-256)
   - manifest.json und chunks.json auf File Server schreiben
   - Fulltext-Index (MiniSearch) ebenfalls aktualisieren

4. src/workers/embedding.worker.ts:
   - Lädt Transformers.js Pipeline
   - Empfängt Texte, gibt Vektoren zurück
   - Progress-Callbacks für Modell-Download

Installiere: npm install @huggingface/transformers
Worker MUSS als ?worker&inline importiert werden.
```

### Task 3.3 — Query Embedder + Vector Store + Hybrid Search

```
Lies ARCHITECTURE.md Abschnitte 6 und 8 (Dual-Search).

1. src/core/services/search/query-embedder.ts:
   - QueryEmbedder Klasse
   - Lädt all-MiniLM-L6-v2 im Hintergrund (WASM backend für schwache Clients)
   - embed(text): Promise<number[]> — eine Query embedden (~100ms)
   - isReady(), onProgress Callback

2. src/core/services/search/vector-store.ts:
   - VectorStore Klasse
   - init(storage): chunks.json von File Server laden → IndexedDB cachen
   - Nur neu laden wenn manifest.json neuer als Cache
   - search(queryVector, topK, filters): Cosine Similarity
   - getManifest(), getChunkCount()

3. src/core/services/search/hybrid-search.ts:
   - HybridSearch Klasse: kombiniert FulltextSearch + VectorStore + QueryEmbedder
   - search(): Keyword + Vektor parallel, Reciprocal Rank Fusion
   - getCapabilities(): { keyword: bool, vector: bool, vectorLoading: bool }

4. src/plugins/suche/SuchSeite.tsx erweitern:
   - Zeigt Capabilities an: "Keyword ✓ | Vektor ✓/laden..."
   - Search-Methode Badge pro Ergebnis: [keyword] / [vector] / [hybrid]
   - Ergebnisse mit Relevanz-Score

5. src/core/hooks/useSearch.ts:
   - React Hook für Hybrid Search
   - Debounced search, loading state, results
```

---

## Hilfs-Prompts

### Fix: Single-File Build Fehler

```
Der Single-File Build (npm run build:single) hat Fehler.
Öffne dist-single/index.html per file:// Protokoll und prüfe die Browser-Console.
Fixe alle Fehler. Häufige Probleme:
- Dynamic imports (import()) → müssen statisch sein
- fetch() zu relativen Pfaden → IndexedDB oder inline
- Web Worker ohne ?worker&inline
- ES Module Imports zur Laufzeit
Teste nach jedem Fix erneut.
```

### Fix: Theme nicht sichtbar

```
Die CSS Custom Properties werden nicht angewendet.
Prüfe:
1. Ist theme.css in main.tsx importiert?
2. Sind die Tailwind arbitrary values korrekt? bg-[var(--tf-bg)] nicht bg-tf-bg
3. Ist das [data-theme] Attribut auf <html> gesetzt?
4. Werden die Properties im Browser DevTools → Elements → Computed angezeigt?
Fixe das Problem.
```

### Refactor: Datei zu groß

```
Die Datei {DATEINAME} ist über 300 Zeilen. Refactore sie:
1. Identifiziere logische Abschnitte
2. Extrahiere jeden Abschnitt in eine eigene Datei
3. Stelle sicher dass Imports/Exports stimmen
4. Jede neue Datei unter 300 Zeilen
5. Teste dass alles noch funktioniert
```
