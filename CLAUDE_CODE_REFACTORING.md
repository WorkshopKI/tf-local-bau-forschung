# TeamFlow Local — Code Refactoring & Cleanup

Ausführen NACH den 8 Basis-Prompts (und optional nach Design-Fix).
Ziel: Codebase stabilisieren bevor weitere Features gebaut werden.

**Plan Mode AN empfohlen** — Claude soll erst analysieren, dann einen Plan vorlegen.

---

## Prompt: Refactoring & Cleanup

```
Lies CLAUDE.md, DESIGN_GUIDE.md und ARCHITECTURE.md.

Die App wurde in 8 schnellen Feature-Prompts gebaut. Bevor weitere Features kommen,
muss die Codebase gründlich aufgeräumt werden. Gehe systematisch durch ALLE Schritte.

═══════════════════════════════════════════════════
SCHRITT 1: AUDIT — Bestandsaufnahme (NICHT fixen, nur dokumentieren)
═══════════════════════════════════════════════════

Führe folgende Checks aus und erstelle eine Liste aller Probleme:

### 1a. TypeScript Strict Check
Führe aus: npx tsc --noEmit --strict
Dokumentiere ALLE Errors. Kategorisiere:
- Fehlende Typen (any, implicit any)
- Falsche Typen (Argument type mismatch)
- Fehlende null-checks
- Unused variables/imports

### 1b. Dateigrößen-Check
Führe aus: find src -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head -30
Dokumentiere alle Dateien über 300 Zeilen — diese MÜSSEN aufgeteilt werden.
Dokumentiere auch Dateien zwischen 200-300 Zeilen die logisch trennbar sind.

### 1c. Code-Duplikation
Prüfe manuell auf doppelten oder sehr ähnlichen Code:
- Bauanträge vs andere Plugins: Gibt es kopierte Komponenten die abstrahiert werden könnten?
- Storage-Aufrufe: Wird das gleiche Load/Save Pattern überall wiederholt?
- UI-Patterns: Gibt es wiederkehrende Layouts die eine Komponente sein sollten?
- Status-Logik: Wird Status-Mapping (Status → Badge-Farbe) an mehreren Stellen definiert?

### 1d. Architektur-Check
Prüfe gegen CLAUDE.md und ARCHITECTURE.md:
- Nutzen alle Dateien CSS Variables statt hartcodierte Farben?
- Nutzen alle Worker ?worker&inline?
- Gibt es fetch() Aufrufe zu relativen Pfaden? (würden unter file:// brechen)
- Gibt es dynamische import() Aufrufe? (würden im Single-File Build brechen)
- Gibt es localStorage Nutzung? (sollte IndexedDB sein)
- Gibt es BroadcastChannel? (sollte postMessage sein)

### 1e. Konsistenz-Check
- Nutzen alle Komponenten die ui/ Shared Components (Button, Card, Badge, etc.)?
  Oder gibt es inline-gestylte Buttons/Badges in Plugins?
- Sind alle Plugin-Definitionen konsistent (gleiche Felder, gleiche Struktur)?
- Nutzen alle Stores das gleiche Pattern (Zustand mit Actions)?
- Sind Error-States überall behandelt (Loading, Error, Empty)?
- Gibt es console.log/console.error die in Produktion nicht sein sollten?

### 1f. Build-Check
Führe aus: npm run build:single
- Kompiliert es ohne Errors?
- Kompiliert es ohne Warnings? (dokumentiere Warnings)
- Wie groß ist dist-single/index.html?
- Öffne die Datei per file:// — gibt es Console Errors?

### 1g. Dependency-Check
Führe aus: npx depcheck (oder manuell package.json vs tatsächliche imports prüfen)
- Ungenutzte Dependencies?
- Fehlende Dependencies (importiert aber nicht in package.json)?
- Dependencies die in devDependencies statt dependencies sein sollten (oder umgekehrt)?

ERSTELLE EINE ZUSAMMENFASSUNG aller gefundenen Probleme, kategorisiert nach Schwere:
- KRITISCH: Bricht den Build oder die file:// Funktionalität
- HOCH: TypeScript Errors, fehlende Typen, Architektur-Verstöße
- MITTEL: Dateien zu groß, Code-Duplikation, Inkonsistenzen
- NIEDRIG: Unused imports, console.logs, Styling-Inkonsistenzen

═══════════════════════════════════════════════════
SCHRITT 2: KRITISCHE FIXES
═══════════════════════════════════════════════════

Fixe zuerst alles aus Kategorie KRITISCH:

- Build-Errors beheben
- file:// Inkompatibilitäten (fetch relativ, dynamic import, localStorage, BroadcastChannel)
- Worker ohne ?worker&inline
- Fehlende Dependencies installieren

Nach jedem Fix: `npm run build:single` um sicherzustellen dass nichts neues bricht.

═══════════════════════════════════════════════════
SCHRITT 3: TYPESCRIPT STRICT COMPLIANCE
═══════════════════════════════════════════════════

### 3a. Alle 'any' Typen eliminieren
- Ersetze jedes `any` durch den korrekten Typ
- Wenn der Typ komplex ist: Erstelle ein Interface in src/core/types/
- Wenn der Typ wirklich unknown ist: Nutze `unknown` mit Type-Guards

### 3b. Fehlende Return-Types
- Alle exportierten Funktionen und Hooks brauchen explizite Return-Types
- Interne Hilfsfunktionen dürfen inferred bleiben

### 3c. Null-Safety
- Prüfe alle optionalen Zugriffe: obj?.prop, array?.[0]
- Storage-Rückgaben sind IMMER nullable (IDB kann leer sein)
- File System Operationen können fehlschlagen (Permission, Not Found)
- AI Bridge Responses können null/error sein

### 3d. Strikte Event-Handler
- onClick, onChange etc. müssen korrekt getypt sein
- React.MouseEvent<HTMLButtonElement>, React.ChangeEvent<HTMLInputElement>, etc.

Ziel: `npx tsc --noEmit --strict` muss mit ZERO Errors durchlaufen.

═══════════════════════════════════════════════════
SCHRITT 4: DATEIEN AUFTEILEN (300-Zeilen-Limit)
═══════════════════════════════════════════════════

Für jede Datei über 300 Zeilen:

1. Identifiziere logische Abschnitte (Typen, Hilfsfunktionen, Sub-Komponenten, Hooks)
2. Extrahiere jeden Abschnitt in eigene Datei
3. Aktualisiere Imports in allen konsumierenden Dateien
4. Stelle sicher dass jede neue Datei unter 300 Zeilen ist
5. Aktualisiere barrel exports (index.ts) wenn vorhanden

Typische Splits:
- Große Komponente → Haupt-Komponente + Sub-Komponenten (ListItem, Header, Filter)
- Großer Store → Store + Selectors + Actions in getrennten Dateien
- Großer Service → Service + Helper-Funktionen + Types

═══════════════════════════════════════════════════
SCHRITT 5: CODE-DUPLIKATION ELIMINIEREN
═══════════════════════════════════════════════════

### 5a. Shared Patterns extrahieren

Wenn Bauanträge und andere Plugins ähnliche Patterns haben:

Status-zu-Badge Mapping:
- Erstelle src/core/utils/status.ts:
  - getStatusBadgeVariant(status): 'info'|'success'|'warning'|'error'|'default'
  - getStatusLabel(status): Übersetzter Label-Text
  - STATUS_CONFIG Map mit allen Varianten

Datum-Formatierung:
- Erstelle src/core/utils/date.ts:
  - formatDate(iso): "27.03.2026"
  - formatDateTime(iso): "27.03.2026, 14:30"
  - formatRelative(iso): "vor 3 Tagen" / "in 5 Tagen"
  - getDaysSince(iso) / getDaysUntil(iso): number

ID-Generierung:
- Erstelle src/core/utils/id.ts:
  - generateVorgangId(prefix, existingIds): "BA-2026-001"
  - Falls das Pattern in mehreren Stores dupliziert ist

### 5b. Shared UI Patterns

Listen-mit-Filter Pattern (kommt in Bauanträge, Dokumente, Suche vor):
- Prüfe ob ein generisches FilteredList Wrapper-Pattern sinnvoll ist
- Oder mindestens: Gleicher Filter-Leisten-Aufbau über Plugins hinweg

Detail-Seite Pattern (kommt in Bauanträge, evtl. Forschung vor):
- Zurück-Link + Titel + ID + Actions als wiederverwendbare DetailHeader Komponente
- Tab-basiertes Layout als wiederverwendbares Pattern

### 5c. Store-Pattern vereinheitlichen

Wenn Stores ähnlich aufgebaut sind:
- Prüfe ob ein createVorgangStore() Factory sinnvoll ist
- Mindestens: Gleiches Interface für loadAll, add, update, remove
- Type-sichere generische Basis: BaseVorgangStore<T extends Vorgang>

═══════════════════════════════════════════════════
SCHRITT 6: ERROR-HANDLING VERVOLLSTÄNDIGEN
═══════════════════════════════════════════════════

Prüfe JEDE Komponente und jeden Service auf korrektes Error-Handling:

### Services
- Storage: try/catch um JEDEN IDB und FS Zugriff
- AI Bridge: Timeout-Handling, Netzwerk-Fehler, ungültige Responses
- Converter Worker: Worker-Crash-Recovery, Format-Fehler
- Search: Leerer Index, Modell-Load-Fehler

### Komponenten — Drei States überall
Jede Daten-ladende Komponente MUSS drei States haben:
1. Loading: Dezenter Spinner oder "Laden..." Text
2. Error: Fehlermeldung mit [Erneut versuchen] Button
3. Empty: Freundlicher Text mit einer Aktion

Prüfe dass diese States in ALLEN folgenden Komponenten existieren:
- BauantraegeListe (Loading, Error, Empty "Noch keine Bauanträge")
- BauantragDetail (Loading, Error "Vorgang nicht gefunden")
- DokumenteListe (Loading, Error, Empty)
- DokumentPreview (Loading, Error)
- ChatView (Error bei AI-Aufruf, Empty initial state)
- SuchSeite (Loading, No Results, Error)
- IndexManager (Loading, Error bei Worker)
- EinstellungenPage (Loading beim Laden der Config)

### Global Error Boundary
- Erstelle src/core/ErrorBoundary.tsx:
  - React Error Boundary Klasse
  - Fängt unbehandelte Render-Errors
  - Zeigt: "Etwas ist schiefgelaufen" + Error-Details (collapsible) + [Seite neu laden]
  - Wrappen in App.tsx um die Shell

═══════════════════════════════════════════════════
SCHRITT 7: PERFORMANCE QUICK-WINS
═══════════════════════════════════════════════════

### Unnötige Re-Renders vermeiden
- Prüfe Zustand Store Selektoren: Nutzen Komponenten den GANZEN Store
  oder nur die Felder die sie brauchen?
  SCHLECHT: const store = useBauantraegeStore()
  GUT: const bauantraege = useBauantraegeStore(s => s.bauantraege)
- Callbacks in Props: useMemo/useCallback wo nötig (NICHT überall — nur bei
  teuren Kindern die re-rendern)

### Schwere Imports
- Werden mammoth, marked, minisearch nur dort importiert wo sie gebraucht werden?
  Oder werden sie global geladen obwohl nur ein Plugin sie nutzt?
- Wenn ja: Imports in die Dateien verschieben die sie tatsächlich nutzen
  (Vite tree-shaked trotzdem, aber es hält die Abhängigkeiten klar)

### IndexedDB Zugriffe
- Werden bei jedem Render IDB-Zugriffe gemacht? (SCHLECHT)
- Zugriffe sollten einmalig beim Mount passieren, danach aus dem Zustand-Store lesen

═══════════════════════════════════════════════════
SCHRITT 8: KONSISTENZ-CLEANUP
═══════════════════════════════════════════════════

### Console.log entfernen
Führe aus: grep -rn "console\.\(log\|warn\|error\|debug\)" src/
- Entferne alle console.log (Debug-Output)
- console.warn darf bleiben wenn es einen echten Warning-Fall gibt
- console.error darf bleiben in catch-Blöcken
- Ersetze debug-logging durch nichts (oder einen optionalen Debug-Flag)

### Unused Imports entfernen
Führe aus: npx tsc --noEmit (zeigt unused imports als Warnings)
Oder nutze: grep -Prn "^import .+ from" src/ und prüfe ob der Import verwendet wird.
Entferne jeden ungenutzten Import.

### Kommentare aufräumen
- Entferne TODO/FIXME Kommentare die erledigt sind
- Entferne auskommentierten Code (Git hat die Historie)
- Behalte erklärende Kommentare die WARUM erklären (nicht WAS)

### Styling-Konsistenz
- Suche nach hartcodierten Hex-Farben: grep -rn "#[0-9a-fA-F]\{3,6\}" src/
  Ersetze durch CSS Variables (ausser in theme.css selbst)
- Suche nach border: 1px: grep -rn "border.*1px\|border-\[1px\]" src/
  Ersetze durch 0.5px
- Suche nach font-weight: 600/700/bold: grep -rn "font-\(weight.*[67]00\|bold\)" src/
  Ersetze durch 500 (oder 400 für Body-Text)

### Barrel Exports prüfen
- Hat jedes Verzeichnis mit mehreren Exporten eine index.ts?
- src/ui/index.ts: Exportiert alle UI Components?
- src/core/types/index.ts: Exportiert alle Types?
- src/core/hooks/index.ts: Exportiert alle Hooks?

═══════════════════════════════════════════════════
SCHRITT 9: TESTS & FINAL VERIFICATION
═══════════════════════════════════════════════════

### TypeScript
npx tsc --noEmit --strict → ZERO Errors

### Build
npm run build:single → ZERO Errors, ZERO Warnings (oder nur bekannte Warnings)

### Dateigröße
find src -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head -10
→ Keine Datei über 300 Zeilen

### Hartcodierte Werte
grep -rn "#[0-9a-fA-F]\{6\}" src/ --include="*.tsx" --include="*.ts" | grep -v theme | grep -v ".css"
→ Keine Treffer (außer in theme.css/theme.ts)

### Console
grep -rn "console\.log" src/
→ Keine Treffer

### Bundle-Größe
ls -la dist-single/index.html
→ Dokumentiere die Größe

### file:// Funktionstest
Öffne dist-single/index.html per file:// im Browser:
- [ ] App startet ohne Console Errors
- [ ] Onboarding oder Dashboard wird angezeigt
- [ ] Bauanträge: CRUD funktioniert
- [ ] Dokumente: Upload + Konvertierung
- [ ] Chat: Öffnet sich (Error bei fehlender AI-Verbindung ist OK)
- [ ] Suche: Keyword-Suche funktioniert
- [ ] Einstellungen: Theme-Wechsel, Dark Mode
- [ ] Browser Reload: Alles bleibt

═══════════════════════════════════════════════════
SCHRITT 10: REFACTORING-REPORT
═══════════════════════════════════════════════════

Erstelle REFACTORING_REPORT.md im Repo-Root mit:

1. Zusammenfassung: Was wurde gefunden, was wurde gefixt
2. Statistik vorher/nachher:
   - TypeScript Errors: X → 0
   - Dateien über 300 Zeilen: X → 0
   - Hartcodierte Farben: X → 0
   - Console.logs: X → 0
   - Bundle-Größe: X MB
3. Neue Dateien/Module die durch Aufspaltung entstanden sind
4. Extrahierte Utility-Module (status.ts, date.ts, id.ts, etc.)
5. Bekannte verbleibende Warnings (falls vorhanden, mit Begründung)
6. Empfehlungen für zukünftige Entwicklung

Committe: "Refactoring: strict TypeScript, file splits, shared utils, error handling, cleanup"
```
