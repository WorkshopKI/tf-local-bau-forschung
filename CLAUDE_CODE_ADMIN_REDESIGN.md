# Prompt: Admin-Panel Redesign — Kompakt, Collapsible, Verständlich

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Das Admin-Panel ist unübersichtlich geworden. Redesign mit folgenden Zielen:
- Vertikalen Platz sparen (Header-Redundanz eliminieren)
- Collapsible Sections für lange Bereiche
- Metriken für Fach-Admins verständlich, ML-Details aufklappbar
- Konsistentes Naming

═══════════════════════════════════════════════════
TEIL 1: Naming und Header aufräumen
═══════════════════════════════════════════════════

1a. Sidebar-Eintrag:
  Aktuell: "Admin" → Ändere zu: "Suchindex"
  In plugins.config.ts und dem Admin-Plugin index.ts: label = 'Suchindex'

1b. Seitentitel:
  Aktuell: Breadcrumb "≡ Admin" + Überschrift "Index-Verwaltung" = 2 Zeilen
  
  Nachher: EINE kompakte Zeile als Status-Header:
    <h1>Suchindex</h1>
    <span class="text-[13px] text-[var(--tf-text-secondary)]">
      {docCount} Dokumente · {chunkCount} Chunks · {lastUpdate ? formatDate(lastUpdate) : 'Noch nicht indexiert'}
    </span>

  Die Breadcrumb "≡ Admin" oben NICHT mehr rendern wenn wir schon den
  Seitentitel haben. Prüfe Shell.tsx ob das Breadcrumb für alle Plugins
  kommt — wenn ja, kann es für die Admin-Seite ausgeblendet werden oder
  der Titel wird als Breadcrumb-Replacement genutzt.

═══════════════════════════════════════════════════
TEIL 2: Collapsible Section Komponente
═══════════════════════════════════════════════════

Erstelle src/ui/CollapsibleSection.tsx:

interface CollapsibleSectionProps {
  label: string;
  subtitle?: string;          // Grauer Text rechts neben dem Label
  defaultOpen?: boolean;
  children: React.ReactNode;
}

Verhalten:
- Klick auf Header togglet open/closed
- ▸ (geschlossen) / ▾ (offen) Pfeil links vom Label
- Label in 13px font-weight 500
- Subtitle in 13px var(--tf-text-tertiary) rechts
- Trennlinie (0.5px border-bottom) unter jeder Section
- Smooth Transition: max-height oder CSS grid trick (grid-template-rows: 0fr → 1fr)
- Content hat padding-top 12px wenn offen

Styling gemäß DESIGN_GUIDE: Monochrom, 0.5px Borders, kein Farbakzent.

═══════════════════════════════════════════════════
TEIL 3: Admin-Seite neu strukturieren
═══════════════════════════════════════════════════

Datei: src/plugins/admin/IndexManager.tsx

Die Seite besteht aus diesen Sections (von oben nach unten):

SECTION 1: "Testdaten" — defaultOpen={false}
  Subtitle: "{seeded ? '40 Vorgänge, 60 Dokumente' : 'Keine Testdaten'}"
  Content: Info-Text + Buttons [Testdaten generieren] / [Testdaten löschen]
  Nur relevant für Entwickler/Test — daher standardmäßig geschlossen.

SECTION 2: "Indexierung" — defaultOpen={true}
  Subtitle: "{hasGPU ? 'WebGPU' : 'CPU (WASM)'}"
  Content:
  - Einzeiler: "WebGPU verfügbar" oder "Kein GPU — Indexierung läuft auf CPU"
  - Wenn File Server nicht verbunden: Hinweis-Banner (wie bisher)
  - Buttons: [Aktualisieren] (= nur neue) und [Komplett neu]
  - Fortschrittsanzeige (wie im Main-Thread-Embedding Prompt gebaut)

SECTION 3: "Suchqualität prüfen" — defaultOpen={true}
  Subtitle: "{lastEval ? `${lastEval.summary.passed}/${lastEval.summary.total} bestanden` : 'Noch nicht geprüft'}"
  Content:
  
  3a. Trigger-Zeile:
    [Qualität prüfen] Button
    Wenn kein Index: Button disabled, Hinweis "Erst indexieren"

  3b. Ergebnis-Dashboard (nur sichtbar wenn ein Eval existiert):
  
    Zwei Metric Cards nebeneinander:
    ┌──────────────┐ ┌──────────────┐
    │ 85%          │ │ 75%          │
    │ Trefferquote │ │ Genauigkeit  │
    └──────────────┘ └──────────────┘

    Erklärung der Begriffe (für den Fach-Admin):
    - "Trefferquote" = Anteil der Tests wo das richtige Dokument in den
      Top 5 gefunden wurde (= pass rate, summary.passed / summary.total * 100)
    - "Genauigkeit" = Anteil der Tests wo das richtige Dokument an erster
      Stelle steht (= top1Accuracy * 100)

    Darunter Balken:
    Exakte Suche        ████████████████████ 5/5
    Bedeutungssuche     ████████████████     12/15

    Erklärung:
    - "Exakte Suche" = keyword-Tests (User tippt genau den Fachbegriff)
    - "Bedeutungssuche" = semantic-Tests (User beschreibt mit eigenen Worten)

    Unter den Balken, klein und grau (für ML-Experten):
    "Fachdetail: P@3 50% · P@5 61% · Top-1 Accuracy 75%"

  3c. Unterhalb: Nested CollapsibleSection "Einzelergebnisse"
    defaultOpen={false}
    Subtitle: "{passed} bestanden, {failed} offen"
    Content: Die Tabelle mit allen 20 Tests (wie bisher)
    
    Aber mit verbessertem Wording:
    - Statt "Pass" Spaltenheader → "Gefunden?"  (✅ / ❌)
    - Statt "P@5" Spaltenheader → "In Top 5" (z.B. "3/5" oder "100%")
    - Query-Spalte: Volle Query anzeigen (nicht truncated)

  3d. Nested CollapsibleSection "Nach Schwierigkeit"
    defaultOpen={false}
    Content: Die 3 Balken (einfach/mittel/schwierig)
    
    Wording:
    - "easy" → "Einfach (exakte Fachbegriffe)"
    - "medium" → "Mittel (verwandte Begriffe)"  
    - "hard" → "Schwierig (Umgangssprache)"

SECTION 4: "Modell & Konfiguration" — defaultOpen={false}
  Subtitle: "Xenova/all-MiniLM-L6-v2 · 384 Dimensionen"
  Content:
  - Modellname (read-only für jetzt, später Dropdown)
  - Dimensionen: 384
  - Backend: WebGPU / WASM
  - Chunk-Größe: 200 Wörter, Overlap: 50

SECTION 5: "Export & Verlauf" — defaultOpen={false}
  Subtitle: "{evalHistory.length} Evaluierungen gespeichert"
  Content:
  - [↓ Markdown] und [↓ JSON] Download-Buttons
  - Verlauf: Dropdown mit vorherigen Evaluierungen
  - Wenn vorheriger Report existiert: Delta anzeigen
    "Trefferquote: 85% (+5% seit 28.3.2026)"

═══════════════════════════════════════════════════
TEIL 4: Fortschrittsbalken-Styling
═══════════════════════════════════════════════════

Erstelle eine wiederverwendbare ProgressBar-Komponente in src/ui/ProgressBar.tsx:

interface ProgressBarProps {
  value: number;    // 0-1
  label?: string;   // z.B. "12/15"
}

Styling:
- Track: 4px Höhe, var(--tf-bg-secondary), border-radius 2px
- Fill: var(--tf-text), gleiche Höhe und Radius
- Fill-Breite: value * 100%
- Label rechts neben dem Balken: 13px var(--tf-text-secondary)
- Transition: width 0.3s ease

Exportiere aus src/ui/index.ts.

═══════════════════════════════════════════════════
TEIL 5: Status-Badge im Header
═══════════════════════════════════════════════════

Der Status-Header soll auf einen Blick zeigen ob alles OK ist:

Wenn Index aktuell UND Eval bestanden > 80%:
  "Suchindex" · "60 Dokumente · 460 Chunks · Aktuell" (normaler Text)

Wenn kein Index:
  "Suchindex" · "Noch nicht indexiert" (mit warning-Farbe)

Wenn Eval bestanden < 60%:
  "Suchindex" · "460 Chunks · Suchqualität niedrig" (mit warning-Farbe)

═══════════════════════════════════════════════════
TEIL 6: Responsive Verhalten
═══════════════════════════════════════════════════

Die Metric Cards (Trefferquote / Genauigkeit) sollen nebeneinander
stehen ab 500px Breite, untereinander darunter.

Die CollapsibleSections funktionieren auf jeder Breite.

═══════════════════════════════════════════════════
TEST
═══════════════════════════════════════════════════

1. npm run dev → Chrome → localhost:5173
2. Sidebar zeigt "Suchindex" statt "Admin"
3. Klick auf Suchindex:
   - Header: "Suchindex" mit Status-Inline
   - KEIN doppeltes "Admin" / "Index-Verwaltung"
4. "Testdaten" Section: Geschlossen, Klick öffnet sie
5. "Indexierung" Section: Offen, Buttons sichtbar
6. "Suchqualität prüfen" Section: Offen
   - Zeigt "Trefferquote 85%" und "Genauigkeit 75%"
   - Balken: "Exakte Suche 5/5" und "Bedeutungssuche 12/15"
   - Klein darunter: "Fachdetail: P@3 50% · P@5 61% · Top-1 Accuracy 75%"
7. "Einzelergebnisse" (nested): Geschlossen, Klick öffnet Tabelle
8. "Nach Schwierigkeit" (nested): Geschlossen
9. "Modell & Konfiguration": Geschlossen, Subtitle zeigt Modellname
10. "Export & Verlauf": Geschlossen
11. Alle Sections smooth auf/zuklappen (kein Flackern)
12. Console: Keine Errors
13. Eval starten → Ergebnisse erscheinen in den neuen Cards
14. [↓ Markdown] → Download funktioniert noch

Committe und pushe: "refactor: admin panel redesign - collapsible sections, user-friendly metrics"
```
