# TeamFlow Local — Phase 5: Editor, Versioning, Review, Sync, Shortcuts

Ausführen NACH Refactoring + MVP-Prompts (14–16).
Reihenfolge ist wichtig — jedes Feature baut auf dem vorherigen auf.

---

## Prompt 17 — Keyboard Shortcuts + Command Palette

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Implementiere globale Keyboard Shortcuts und eine Command Palette (Cmd+K).
Das ist unabhängig von anderen Features und gibt sofortigen Mehrwert.

### Keyboard Service

1. src/core/services/keyboard.ts:
   - KeyboardService Klasse (Singleton)
   - register(combo, handler, options?): Shortcut registrieren
     combo: String wie 'mod+k', 'mod+n', 'mod+shift+s', 'escape'
     'mod' = Cmd auf Mac, Ctrl auf Windows/Linux
     options: { context?: string, description: string, global?: boolean }
   - unregister(combo): Shortcut entfernen
   - getAll(): Alle registrierten Shortcuts mit Beschreibungen
   - Internes keydown Listener auf document
   - Combo-Parsing: 'mod+shift+k' → prüft event.metaKey||event.ctrlKey + event.shiftKey + event.key==='k'
   - Verhindert Konflikte: Wenn CodeMirror fokussiert ist, nur globale Shortcuts ausführen
     (nicht 'mod+b' etc. — das gehört dem Editor)
   - preventDefault() für registrierte Shortcuts

2. src/core/hooks/useKeyboard.ts:
   - useKeyboardShortcut(combo, handler, deps): Hook für komponentenspezifische Shortcuts
   - Registriert bei Mount, unregistriert bei Unmount
   - useGlobalShortcuts(): Registriert alle App-weiten Shortcuts

### Globale Shortcuts registrieren

3. src/core/App.tsx oder Shell.tsx — Globale Shortcuts:
   - mod+k → Command Palette öffnen/schließen
   - mod+/ → Sidebar toggle
   - mod+1 bis mod+7 → Plugin wechseln (Sidebar-Reihenfolge)
   - mod+shift+d → Dark Mode toggle
   - escape → Dialog schließen (wenn offen), sonst Command Palette schließen

4. Plugin-spezifische Shortcuts (in den jeweiligen Plugins registrieren):
   - Bauanträge/Forschung: mod+n → Neuer Vorgang Dialog
   - Bauantrag-Detail: mod+e → Bearbeiten, mod+backspace → Löschen (mit Bestätigung)
   - Chat: mod+enter → Nachricht senden (ergänzend zu Enter)

### Command Palette

5. src/ui/CommandPalette.tsx:
   - Overlay-Dialog, zentriert oben (wie VS Code / Linear: oben im Viewport, nicht mittig)
   - Suchfeld: Groß, autofocus, sofortige Filterung
   - Ergebnis-Liste darunter:
     - Kategorie-Headers als SectionHeader-Style (klein, grau)
     - Jeder Eintrag: Icon + Beschreibung + Shortcut-Hint rechts
     - Pfeil-Tasten zur Navigation, Enter zum Ausführen
     - Maximal 8-10 sichtbare Einträge, dann scrollen
   - Kategorien:
     - "Navigation": Alle Plugins (Home, Bauanträge, Dokumente, Suche, Chat, Einstellungen...)
     - "Aktionen": Neuer Bauantrag, Neuer Forschungsantrag, Dokument importieren
     - "Einstellungen": Dark Mode toggle, Farbe wechseln, File Server verbinden
     - "Suche": Freitext → leitet zur Suche-Seite weiter mit dem Suchbegriff
   - Fuzzy-Matching: "baua" findet "Bauanträge", "dkm" findet "Dark Mode"
   - Styling: bg var(--tf-bg), border 0.5px, border-radius 12px,
     shadow 0 8px 30px rgba(0,0,0,0.12) (wie Dialog, aber breiter: max-w-lg)
     Aktiver Eintrag: bg var(--tf-hover)

6. useNavigation Hook erweitern:
   - Shortcut-Hints in Plugin-Definitionen: shortcutHint?: string ('⌘1', '⌘2', etc.)
   - Command Palette nutzt navigate() für Plugin-Wechsel

### Shortcut-Hilfe

7. Einstellungen erweitern — neuer Tab "Tastatur":
   - Liste aller Shortcuts: Beschreibung + Combo
   - Gruppiert nach Kategorie (Global, Navigation, Editor)
   - Nicht editierbar (für jetzt), nur Referenz
   - Link dorthin auch in der Command Palette: "Tastaturkürzel anzeigen"

### Test + Fix

1. `npm run dev`:
   a) Cmd/Ctrl+K → Command Palette öffnet sich
   b) "bau" tippen → "Bauanträge" erscheint → Enter → Plugin wechselt
   c) "dark" tippen → "Dark Mode" → Enter → Modus wechselt
   d) Escape → Palette schließt
   e) Cmd/Ctrl+1 → erstes Plugin, Cmd/Ctrl+2 → zweites, etc.
   f) Cmd/Ctrl+/ → Sidebar toggled
   g) Cmd/Ctrl+N in Bauanträge → Neuer Antrag Dialog
   h) Einstellungen → Tastatur-Tab zeigt alle Shortcuts
   i) Kein Shortcut-Konflikt mit Browser-Defaults (Cmd+T, Cmd+W bleiben Browser)
2. `npm run build:single`
3. file:// Test — Shortcuts funktionieren
4. `npx tsc --noEmit`

Committe.
```

---

## Prompt 18 — CodeMirror Markdown Editor

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Installiere:
npm install @uiw/react-codemirror @codemirror/lang-markdown @codemirror/language-data
npm install @codemirror/merge diff-match-patch
npm install -D @types/diff-match-patch

Ersetze die Textareas durch einen richtigen Markdown-Editor mit CodeMirror 6.

### Zwei Editor-Varianten

1. src/ui/MarkdownEditor.tsx — Voller Markdown-Editor:
   - Nutzt @uiw/react-codemirror als React-Wrapper
   - Extensions:
     - markdown({ base: markdownLanguage, codeLanguages: languages })
     - Custom Theme das zu unserem Design Guide passt:
       - Hintergrund: transparent (erbt vom Container)
       - Text: var(--tf-text) / var(--tf-text-secondary) für Syntax
       - Cursor: var(--tf-text)
       - Selection: var(--tf-hover) mit etwas mehr Opacity
       - Gutter (Zeilennummern): var(--tf-text-tertiary), bg transparent
       - Active Line: var(--tf-hover)
       - Keine Borders um den Editor selbst — der Container hat den Border
     - Zeilennummern (optional, prop showLineNumbers)
     - Line wrapping (EditorView.lineWrapping)
     - Placeholder-Text
   - Props:
     - value: string
     - onChange: (value: string) => void
     - placeholder?: string
     - showLineNumbers?: boolean (default false)
     - readOnly?: boolean
     - minHeight?: string (default '200px')
     - maxHeight?: string (optional)
     - className?: string
   - MUSS in Dark Mode korrekt aussehen (Custom Theme mit CSS Variables)
   - Debounced onChange: Nicht bei jedem Keystroke onChange aufrufen,
     sondern nach 300ms Ruhe (oder via CodeMirror's updateListener)

2. src/ui/MarkdownEditorWithPreview.tsx — Editor + Side-by-Side Preview:
   - Nutzt react-resizable-panels ODER einfaches Flex-Layout mit Toggle
   - Links: MarkdownEditor
   - Rechts: MarkdownRenderer (bestehende Komponente)
   - Toggle-Buttons: "Editor" | "Preview" | "Split"
   - Split: 50/50, resizable
   - Default: Split-View
   - Styling: Dünner Divider (0.5px) zwischen den Panels

### Custom Extension: Template-Variablen Highlighting

3. src/ui/codemirror/variable-highlight.ts:
   - CodeMirror Extension die {{variablenname}} Muster farbig hervorhebt
   - Nutze ViewPlugin + Decoration
   - Styling: Hintergrund var(--tf-info-bg), Text var(--tf-info-text), border-radius 3px
   - Regex: /\{\{([^}]+)\}\}/g
   - Im MarkdownEditor als optionale Extension (prop highlightVariables?: boolean)

### Integration in bestehende App

4. Artefakt-Bearbeitung (ArtefakteTab.tsx):
   - Ersetze die Textarea für Artefakt-Editing durch MarkdownEditorWithPreview
   - Beim Generieren: Editor zeigt den AI-Output, User kann bearbeiten
   - Preview zeigt live das gerenderte Markdown

5. Vorgang-Notizen (BauantragDetail.tsx, ForschungDetail.tsx):
   - Ersetze die Notizen-Textarea durch MarkdownEditor (ohne Preview, kompakter)
   - Auto-save bleibt (debounced onChange → Storage)

6. Dokument-Preview/Edit (DokumentPreview.tsx):
   - MarkdownEditorWithPreview statt nur MarkdownRenderer
   - Toggle: "Ansicht" (nur Preview) | "Bearbeiten" (Editor + Preview)
   - Beim Speichern: Aktualisierte MD-Datei schreiben

7. Prompt-Templates (wenn vorhanden):
   - MarkdownEditor mit highlightVariables=true
   - {{vorgang.id}}, {{user.name}} etc. werden farbig hervorgehoben

### WICHTIG: Textarea als Fallback behalten

8. Erstelle NICHT überall CodeMirror. Behalte einfache Textareas für:
   - Kommentar-Eingabefelder (kurze Texte, <5 Zeilen)
   - Dialog-Felder (Vorgang-Form, Suche)
   - Chat-Input
   CodeMirror ist nur für echte Dokumenten-Bearbeitung.

### Test + Fix

1. `npm run dev`:
   a) Bauantrag → Artefakte → Artefakt bearbeiten → CodeMirror Editor sichtbar
   b) Markdown tippen: # Heading, **bold**, - Liste → Syntax-Highlighting funktioniert
   c) Preview rechts zeigt gerendertes HTML live
   d) Toggle: Editor Only / Preview Only / Split
   e) Notizen-Feld im Bauantrag-Detail: Kompakter Editor, auto-save funktioniert
   f) Dokument-Preview: "Bearbeiten" Button → Editor erscheint
   g) Dark Mode: Editor-Theme passt zum Warm-grau Design
   h) Zeilennummern (wenn aktiviert) sind subtil und lesbar
   i) Template-Variable {{test}} wird farbig hervorgehoben (wenn highlightVariables)
   j) Performance: Kein Lag beim Tippen, auch bei längeren Dokumenten
2. `npm run build:single`
3. KRITISCH: file:// Test — CodeMirror muss im Single-File Build funktionieren
   CodeMirror lädt keine externen Ressourcen, also sollte es gehen.
   Falls Probleme: Prüfe ob @uiw/react-codemirror korrekt gebundelt wird.
4. Bundle-Größe prüfen: CodeMirror addiert ~150KB. Dokumentiere die neue Gesamtgröße.
5. `npx tsc --noEmit`

Committe.
```

---

## Prompt 19 — Version History (Diff-basiert)

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Implementiere ein Versionierungs-System das Textänderungen als kompakte Diffs speichert
und jede frühere Version rekonstruieren kann.

### Version Service

1. src/core/services/versioning/version-service.ts:
   - VersionService Klasse
   - Nutzt diff-match-patch (bereits installiert in Prompt 18)

   createVersion(documentId, currentText, message?, author?):
   - Lädt die letzte bekannte Version aus IDB
   - Berechnet Diff: dmp.patch_make(currentText, previousText) → Reverse-Patch
     (Reverse-Patch: Von AKTUELL nach ALT, nicht umgekehrt.
      So können wir vom aktuellen Text rückwärts jede Version rekonstruieren.)
   - Speichert: { version: number, timestamp, author, message, patch: patchString }
   - Patch-String: dmp.patch_toText(patches) — kompaktes Text-Format

   getHistory(documentId): VersionEntry[]
   - Alle Versionen eines Dokuments, neueste zuerst

   reconstructVersion(documentId, targetVersion):
   - Lädt aktuellen Text
   - Wendet Reverse-Patches rückwärts an bis zur Zielversion
   - dmp.patch_apply(patches, text) → rekonstruierter Text
   - Return: { text, version, timestamp, author }

   getDiff(documentId, versionA, versionB):
   - Rekonstruiert beide Versionen
   - dmp.diff_main(textA, textB) → Diff-Array
   - dmp.diff_prettyHtml(diffs) → HTML mit farbigen Markierungen
   - Return: { diffs, htmlA, htmlB }

   restoreVersion(documentId, targetVersion, storage):
   - Rekonstruiert die Zielversion
   - Überschreibt den aktuellen Text
   - Erstellt automatisch eine neue Version ("Wiederhergestellt von v{X}")

   pruneHistory(documentId, keepLastN):
   - Behält nur die letzten N Versionen (z.B. 50)
   - Konsolidiert ältere Patches in einen Gesamt-Patch

2. src/core/types/version.ts:
   - VersionEntry: { version, timestamp, author, message, patchText, documentId }
   - VersionableDocument: { id, type, currentText, path? }

### Speicherung

3. Dual-Layer wie alles andere:
   - IndexedDB: versions:{documentId} → VersionEntry[]
   - File Server: Neben der .md Datei eine .history.json Datei
     z.B. nachforderung_01.md → nachforderung_01.history.json
   - Format der .history.json:
     {
       "documentId": "BA-2026-001:nachforderung_01",
       "currentVersion": 5,
       "versions": [ ...VersionEntry[] ]
     }

### Auto-Versioning Logik

4. src/core/services/versioning/auto-version.ts:
   - shouldCreateVersion(lastVersionTimestamp, lastVersionText, currentText): boolean
     - Mindestens 5 Minuten seit letzter Version
     - UND mindestens 50 Zeichen Unterschied (Levenshtein-Approximation via diff length)
   - Wird aufgerufen wenn:
     - Editor-Blur (User verlässt den Editor)
     - Explizit: [Version speichern] Button
     - App-Wechsel: Wenn Plugin gewechselt wird und ungespeicherte Änderungen existieren

### UI: History Panel

5. src/ui/VersionHistoryPanel.tsx:
   - Seitenleiste die rechts neben dem Editor aufklappt (240px breit)
   - Trigger: "Verlauf" Button oder Shortcut (mod+shift+h)
   - Header: "Versionen" + Close-Button
   - Liste:
     - Jeder Eintrag: Version-Nummer, Zeitstempel relativ ("vor 2 Stunden"),
       Author, Message (truncated), Klick → Diff-View
     - Aktive/aktuelle Version hervorgehoben
     - Styling: Timeline-artig, kleine Dots links, Linie vertikal
   - Footer: [Version speichern] Button mit Message-Input

6. src/ui/DiffView.tsx:
   - Side-by-Side Diff-Ansicht
   - Props: textA (string), textB (string), labelA, labelB
   - Nutze diff-match-patch für Diff-Berechnung
   - Rendering: Inline-Diff (Deletions rot durchgestrichen, Insertions grün hinterlegt)
     ODER Side-by-Side (zwei Spalten, synchron scrollend)
   - Toggle: Inline / Side-by-Side
   - Farben: Warm-grau-kompatibel!
     - Insertions: var(--tf-success-bg) Hintergrund, var(--tf-success-text) Text
     - Deletions: var(--tf-danger-bg) Hintergrund, var(--tf-danger-text) Text + line-through
   - Stats oben: "+X Zeilen, -Y Zeilen, Z geändert"
   - [Wiederherstellen] Button: Stellt die ausgewählte Version wieder her (mit Bestätigung)

### Integration

7. MarkdownEditorWithPreview erweitern:
   - Neuer Button in der Toolbar: "Verlauf" (History-Icon)
   - Klick → VersionHistoryPanel öffnet sich als dritte Spalte rechts
   - Layout wird: Editor | Preview | History (oder Editor | History ohne Preview)

8. ArtefakteTab.tsx:
   - Artefakte sind versioniert: Jedes Mal wenn der User ein Artefakt speichert,
     wird automatisch eine Version erstellt
   - "Verlauf" Button im Artefakt-Header

9. DokumentPreview.tsx:
   - Wenn Dokument bearbeitet wird: "Verlauf" Button verfügbar
   - Importierte Dokumente starten mit Version 1

### WAS WIRD NICHT VERSIONIERT (explizit)
   - Vorgang-Notizen: Zu flüchtig, kein History-Bedarf
   - meta.json: Workflow-History (aus Prompt 16) deckt Status-Änderungen ab
   - Chat-Nachrichten: Ephemeral
   - Einstellungen: Kein Bedarf

### Test + Fix

1. `npm run dev`:
   a) Artefakt erstellen → Text bearbeiten → [Version speichern] → Message eingeben
   b) Text weiter bearbeiten → nochmal speichern
   c) "Verlauf" Button → History Panel öffnet sich
   d) 2 Versionen sichtbar mit Timestamps und Messages
   e) Klick auf ältere Version → Diff-View zeigt Unterschiede
   f) Grün = hinzugefügt, Rot = entfernt — korrekt?
   g) [Wiederherstellen] → Bestätigung → Text wird auf alte Version zurückgesetzt
   h) Neue Version wird automatisch erstellt ("Wiederhergestellt von v1")
   i) Dokument bearbeiten → Verlauf funktioniert auch hier
   j) Auto-Versioning: 5 Minuten warten, viel ändern → automatische Version erstellt
   k) Dark Mode: Diff-Farben (Insertions/Deletions) sind lesbar im Warm-grau-Theme
   l) File Server: .history.json Dateien werden neben den .md Dateien gespeichert
   m) Browser Reload: History bleibt erhalten (aus IDB)
2. `npm run build:single`
3. file:// Test
4. Prüfe Patch-Größe: Öffne .history.json — Patches sollten deutlich kleiner sein
   als der volle Text (typisch 2-5% pro Version)
5. `npx tsc --noEmit`

Committe.
```

---

## Prompt 20 — Offline-Sync mit Dirty Queue

```
Lies CLAUDE.md und ARCHITECTURE.md.

Implementiere eine robuste Offline-Sync-Schicht. Das Grundprinzip:
IndexedDB ist IMMER die Wahrheit. File Server ist das Sync-Ziel.
Wenn der File Server nicht erreichbar ist, arbeitet die App weiter.
Sobald er erreichbar ist, werden ausstehende Änderungen synchronisiert.

WICHTIG: Wir haben KEINEN Service Worker (file:// Protokoll).
Offline-Sync passiert im Main Thread via setInterval.

### Sync Service

1. src/core/services/sync/sync-service.ts:
   - SyncService Klasse

   Queue-Management:
   - enqueue(operation): Schreib-Operation in Queue
     Operation: { id: string, type: 'write'|'delete', path: string,
                  data: any, timestamp: string, retries: number }
   - Queue in IndexedDB Store 'sync-queue'
   - Jede Schreib-Operation die bisher direkt auf den FS ging,
     geht jetzt ZUERST in IDB, DANN in die Queue

   Sync-Loop:
   - start(): setInterval alle 30 Sekunden
   - stop(): clearInterval
   - processQueue():
     - Prüfe: Ist File Server connected? (storage.isFileServerConnected())
     - Wenn nein: return (nächster Versuch in 30s)
     - Wenn ja: Queue-Items chronologisch abarbeiten
     - Für jedes Item:
       - Versuche FS-Write
       - Erfolg → Item aus Queue entfernen
       - Fehler → retries++, wenn retries > 5 → als 'failed' markieren
     - Batch-artig: Nicht alle auf einmal, sondern mit 100ms Pause dazwischen
       (SMB-Verbindungen mögen keine Floods)

   Conflict Detection:
   - Vor jedem Write: Prüfe modified-Timestamp der Datei auf FS
   - Wenn FS-Datei neuer als unsere Version:
     → ConflictError werfen, Item NICHT schreiben, als 'conflict' markieren
   - User muss Konflikt manuell lösen

   Status:
   - getStatus(): { pending: number, syncing: boolean, lastSync: string|null,
                     conflicts: SyncConflict[], failed: SyncFailure[] }
   - onStatusChange(callback): Subscriber-Pattern für UI-Updates

2. src/core/services/sync/sync-queue-store.ts:
   - Dedizierter IndexedDB Store 'sync-queue' (getrennt vom Daten-Store)
   - add(item), remove(id), getAll(), getByStatus(status), clear()

### StorageService Refactoring

3. src/core/services/storage/index.ts UMBAUEN:
   - Bisher: saveVorgang() schreibt direkt in IDB + FS
   - NEU: saveVorgang() schreibt in IDB + enqueued FS-Write
   - Gleich für: saveArtifact, saveDocument, saveTags, saveConfig
   - Alle FS-Writes gehen jetzt durch die Sync-Queue

   Pattern:
   async saveVorgang(vorgang: Vorgang): Promise<void> {
     vorgang.modified = new Date().toISOString();
     // 1. Sofort in IDB (immer, synchron zur User-Aktion)
     await this.idb.set(`vorgang:${vorgang.id}`, vorgang);
     // 2. FS-Write in Queue (asynchron, wird bald gesyncht)
     if (this.fs) {
       await this.syncService.enqueue({
         id: crypto.randomUUID(),
         type: 'write',
         path: `vorgaenge/${vorgang.type}/${vorgang.id}/meta.json`,
         data: vorgang,
         timestamp: vorgang.modified,
         retries: 0,
       });
     }
   }

### App-Start: Merge-Logik

4. Beim App-Start, NACH dem FS-Permission-Request:
   - Queue aus IDB laden — gibt es ausstehende Items?
   - Wenn ja: Sofort versuchen zu synchen (processQueue)
   - Parallel: FS-Daten lesen und mit IDB vergleichen
   - Wenn FS neuer: FS-Version in IDB übernehmen (FS = Source of Truth für Reads)
   - Wenn IDB neuer (Items in Queue): IDB behalten, Queue abarbeiten

### UI: Sync-Status Indicator

5. src/ui/SyncStatusIndicator.tsx:
   - Kleine Komponente, wird in der Sidebar ganz unten platziert
   - 3 Zustände:
     a) Synced: Grüner Dot (●) + "Synchronisiert" in text-tertiary
     b) Pending: Gelber Dot (●) + "{N} ausstehend" in text-secondary
        Zeigt sich auch wenn FS connected und Queue wird abgearbeitet
     c) Offline: Grauer Dot (●) + "Offline ({N} ausstehend)" in text-tertiary
   - Klick → Sync-Detail Dialog:
     - Letzter Sync: Zeitstempel
     - Ausstehende Operationen: Liste mit Pfad + Timestamp
     - Konflikte: Liste mit [Meine Version / Server-Version / Überspringen] Aktionen
     - Fehler: Liste mit [Erneut versuchen / Verwerfen] Aktionen
     - [Jetzt synchronisieren] Button
   - Pulsierender Dot wenn gerade gesyncht wird

6. Shell.tsx: SyncStatusIndicator am unteren Ende der Sidebar einbauen

### Sync für Version History

7. .history.json Dateien werden genauso gesyncht:
   - Version erstellen → IDB sofort + FS-Write enqueuen
   - Beim Laden: .history.json aus IDB-Cache, bei App-Start vom FS aktualisieren

### Test + Fix

1. `npm run dev`:
   a) App starten MIT File Server → Sync-Status "Synchronisiert" (grün)
   b) Vorgang anlegen → Sync-Status blinkt kurz gelb → dann wieder grün
   c) Prüfe: meta.json auf dem File Server wurde geschrieben
   d) App starten OHNE File Server (Permission verweigern oder Ordner nicht freigeben)
   e) Sync-Status: "Offline (0 ausstehend)"
   f) Vorgang anlegen → "Offline (1 ausstehend)"
   g) Zweiten Vorgang → "Offline (2 ausstehend)"
   h) File Server verbinden (Einstellungen → Speicher → Verbinden)
   i) Queue wird abgearbeitet → "Synchronisiert"
   j) Prüfe: Beide Vorgänge auf dem File Server vorhanden
   k) Browser Reload: Daten noch da (IDB), Sync-Status korrekt
   l) Klick auf Sync-Status → Detail-Dialog mit Queue-Info
2. Konflikt-Test:
   a) Vorgang in App ändern (offline bleiben)
   b) meta.json auf dem File Server manuell editieren (simuliert anderen User)
   c) App online bringen → Sync meldet Konflikt
   d) Konflikt-Dialog: Optionen korrekt angezeigt
3. `npm run build:single`
4. file:// Test: Sync-Indicator sichtbar, funktional
5. `npx tsc --noEmit`

Committe.
```

---

## Prompt 21 — Peer Review (Inline-Kommentare)

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Implementiere asynchrones Peer Review mit Inline-Kommentaren auf Dokumenten und Artefakten.
Braucht CodeMirror (Prompt 18) und Version History (Prompt 19) als Voraussetzung.

### Review-Datenmodell

1. src/core/types/review.ts:
   - ReviewComment:
     id: string
     documentId: string
     author: string
     timestamp: string
     text: string
     anchor: {
       from: number        // Start-Offset im Text
       to: number          // End-Offset
       quotedText: string  // Selektierter Text (Fallback für verschobene Offsets)
     }
     status: 'open' | 'resolved'
     replies: ReviewReply[]

   - ReviewReply:
     id: string
     author: string
     timestamp: string
     text: string

   - ReviewSession:
     documentId: string
     comments: ReviewComment[]
     created: string
     lastUpdated: string

### Review Service

2. src/core/services/review/review-service.ts:
   - ReviewService Klasse

   loadReviews(documentId, storage): ReviewSession | null
   - Aus IDB laden, ggf. von FS (document.reviews.json)

   saveReviews(documentId, session, storage): void
   - In IDB + FS-Queue (via SyncService)

   addComment(documentId, comment): ReviewSession
   - Fügt Kommentar hinzu, speichert

   addReply(documentId, commentId, reply): ReviewSession
   - Fügt Reply zu existierendem Kommentar hinzu

   resolveComment(documentId, commentId): ReviewSession
   - Setzt status auf 'resolved'

   reopenComment(documentId, commentId): ReviewSession

   reanchorComments(session, oldText, newText): ReviewSession
   - Wenn sich der Text geändert hat: Offsets neu berechnen
   - Nutzt diff-match-patch match_main() für Fuzzy-Matching des quotedText
   - Findet die neue Position des zitierten Texts im geänderten Dokument
   - Wenn nicht findbar: Kommentar als 'orphaned' markieren (anchor.orphaned = true)

### Speicherung auf File Server

3. Neben der Dokument-Datei:
   nachforderung_01.md              ← Text
   nachforderung_01.reviews.json   ← Kommentare
   nachforderung_01.history.json   ← Versionen (aus Prompt 19)

   reviews.json Format:
   {
     "documentId": "...",
     "comments": [...],
     "lastUpdated": "2026-03-28T14:30:00Z"
   }

### CodeMirror Extension: Review Markers

4. src/ui/codemirror/review-markers.ts:
   - CodeMirror Extension die Kommentar-Anker als Decorations zeigt
   - Kommentierter Text: Dezenter Hintergrund
     - Open comments: var(--tf-warning-bg) mit 0.3 Opacity
     - Resolved comments: var(--tf-success-bg) mit 0.15 Opacity (fast unsichtbar)
   - Hover auf markiertem Text: Tooltip mit Kommentar-Preview
   - Klick auf markierten Text: Scrollt zum Kommentar in der Sidebar

5. src/ui/codemirror/review-gutter.ts (optional):
   - Kleine farbige Dots im Gutter neben Zeilen die Kommentare haben
   - Orange Dot für offene, grüner Dot für resolved

### UI: Review Panel (Sidebar rechts)

6. src/ui/ReviewPanel.tsx:
   - Aufklappbare Seitenleiste rechts (240px), wie VersionHistoryPanel
   - Trigger: "Review" Button in der Editor-Toolbar, oder Text selektieren → Popup

   Kommentar-Erstellung:
   - User selektiert Text im Editor
   - Kleines Popup erscheint über der Selektion: [💬 Kommentieren] Button
   - Klick → Review Panel öffnet sich (falls nicht offen)
   - Neues Kommentar-Feld am Ende des Panels, fokussiert
   - Der selektierte Text wird als Zitat angezeigt (blockquote-style)
   - Textarea für den Kommentar + [Senden] Button

   Kommentar-Liste:
   - Chronologisch, neueste oben
   - Jeder Kommentar:
     - Author + relative Zeit (klein, text-tertiary)
     - Zitierter Text als dezenter Blockquote (text-secondary, border-left 2px)
     - Kommentar-Text (text primary)
     - [Antworten] Button → öffnet Reply-Textarea
     - [Erledigt] Button → markiert als resolved (durchgestrichen, gedämpft)
     - Replies: Eingerückt unter dem Kommentar, gleicher Style aber kleiner
   - Filter: [Alle] [Offen (3)] [Erledigt (2)]
   - Klick auf einen Kommentar → Editor scrollt zur markierten Stelle

   Resolved Comments:
   - Gedämpft (text-tertiary, Opacity 0.6)
   - Können wieder geöffnet werden ("Erneut öffnen")

### Integration in MarkdownEditorWithPreview

7. MarkdownEditorWithPreview.tsx erweitern:
   - Neuer Button in Toolbar: "Review" (MessageSquare Icon)
   - Wenn aktiv: Review Panel rechts + Markers im Editor
   - Layout: Editor | Preview | Review (3 Panels) oder Editor | Review (2 Panels)
   - Counter-Badge am Review Button: Anzahl offener Kommentare

8. Text-Änderungen + Kommentar-Anker:
   - Wenn der Text sich ändert während Kommentare existieren:
   - reanchorComments() aufrufen (nach dem Speichern, nicht bei jedem Keystroke)
   - Verwaiste Kommentare (quotedText nicht mehr findbar) werden mit
     ⚠ Icon markiert: "Der kommentierte Text wurde geändert"

### Integration in Artefakte und Dokumente

9. ArtefakteTab.tsx:
   - Jedes Artefakt kann reviewed werden
   - "Review" Button im Artefakt-Header (neben "Verlauf")
   - Badge: Anzahl offener Kommentare

10. DokumentPreview.tsx:
    - Im Bearbeitungsmodus: Review-Funktion verfügbar

### Multi-User Workflow (File Server basiert)

11. Der Flow:
    - User A erstellt Artefakt, klickt [Zur Review freigeben]
      (setzt ein Flag in meta.json: reviewRequested: true, reviewer: 'mueller')
    - User B öffnet den gleichen Vorgang → sieht "Review angefragt" Badge
    - User B öffnet Artefakt → Review Panel → kommentiert inline
    - User B speichert → reviews.json auf File Server
    - User A öffnet Artefakt erneut → lädt reviews.json → sieht Kommentare
    - User A bearbeitet, antwortet, markiert als erledigt
    - Kein Echtzeit — File Server ist der Austausch-Kanal

### Test + Fix

1. `npm run dev`:
   a) Artefakt erstellen und öffnen
   b) "Review" Button klicken → Panel öffnet sich rechts
   c) Text im Editor selektieren → [💬 Kommentieren] Popup erscheint
   d) Kommentar eingeben → Senden → Markierung im Editor sichtbar
   e) Zweiten Kommentar an anderer Stelle
   f) Kommentar in Panel klicken → Editor scrollt zur Stelle
   g) [Antworten] → Reply eingeben → erscheint eingerückt
   h) [Erledigt] → Kommentar wird gedämpft, Markierung wird dezenter
   i) Filter: "Offen" zeigt nur offene, "Erledigt" nur erledigte
   j) Text ändern → Anker werden re-positioniert
   k) Dark Mode: Markierungen und Panel sehen im Warm-grau korrekt aus
   l) Browser Reload: Kommentare bleiben (IDB)
   m) File Server: reviews.json wird geschrieben
   n) Counter-Badge am Review Button zeigt korrekte Anzahl
2. `npm run build:single`
3. file:// Test
4. `npx tsc --noEmit`

Committe: "Phase 5 complete: CodeMirror, version history, offline sync, peer review, shortcuts"
```

---

## Zusammenfassung der Abhängigkeiten

```
Prompt 17: Keyboard Shortcuts     ← unabhängig
Prompt 18: CodeMirror Editor      ← unabhängig
Prompt 19: Version History        ← braucht CodeMirror + diff-match-patch (aus 18)
Prompt 20: Offline-Sync           ← braucht stabiles Storage (refactored in 20 selbst)
Prompt 21: Peer Review            ← braucht CodeMirror (18) + diff-match-patch (18) + Sync (20)
```

## Neue Dependencies (gesamt für Phase 5)

```bash
npm install @uiw/react-codemirror @codemirror/lang-markdown @codemirror/language-data
npm install @codemirror/merge diff-match-patch
npm install -D @types/diff-match-patch
```

## Geschätzte Zeitrahmen

| Prompt | Feature | Komplexität | Geschätzt |
|---|---|---|---|
| 17 | Shortcuts + Command Palette | Mittel | ~45 Min |
| 18 | CodeMirror Integration | Hoch | ~60 Min |
| 19 | Version History | Hoch | ~60 Min |
| 20 | Offline-Sync | Sehr hoch | ~90 Min |
| 21 | Peer Review | Sehr hoch | ~90 Min |
