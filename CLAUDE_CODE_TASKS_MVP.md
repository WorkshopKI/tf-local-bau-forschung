# TeamFlow Local — MVP Vervollständigung

Ausführen NACH Phase-2-Prompts (9–13) und Design-Fix.
Diese 3 Prompts machen aus dem technischen Prototyp eine benutzbare App.

---

## Prompt 14 — Dashboard (echte Home-Seite)

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Die Home-Seite zeigt aktuell einen Component Showcase. Ersetze sie durch ein
echtes Dashboard das dem Sachbearbeiter morgens sofort zeigt was ansteht.

### Datenquellen

Das Dashboard liest aus den bestehenden Stores (Bauanträge, Forschung, Dokumente, Artefakte).
Kein neuer Store nötig — nur ein Hook der die Daten aggregiert.

1. src/plugins/home/useDashboardData.ts:
   - Liest aus allen Vorgang-Stores (bauantraege + forschung)
   - Berechnet:
     - offeneVorgaenge: Alle mit Status != 'genehmigt'|'abgelehnt'|'archiviert'
     - dringend: Frist in den nächsten 7 Tagen, sortiert nach Frist
     - naechsterSchritt: Der Vorgang mit der nächsten ablaufenden Frist
     - fristenDieseWoche: Count der Fristen in den nächsten 7 Tagen
     - letzteArtefakte: Die 5 neuesten Artefakte über alle Vorgänge
     - letzteAenderungen: Die 5 zuletzt geänderten Vorgänge
     - stats: { total, offen, inPruefung, nachforderung, genehmigt }
   - AI-Status: Liest aus AIBridge ob Streamlit/llama.cpp/Cloud verbunden
   - Suchindex-Status: Liest aus HybridSearch (Chunk-Count, letztes Update)

### Layout (wie im Mockup von vorher)

2. src/plugins/home/HomePage.tsx — KOMPLETT NEU:

   Header:
   - "Guten [Morgen/Tag/Abend], {Name}" (zeitbasiert)
   - Darunter: Abteilung in text-secondary
   - Darunter: "{X} offene Vorgänge · {Y} Fristen diese Woche" in text-secondary

   Callout (nur wenn dringender Vorgang existiert):
   - Border-left 3px solid var(--tf-border-hover)
   - "Nächster Schritt · Frist in {N} Tagen"
   - Vorgang-ID + Titel bold
   - [Öffnen →] Button rechts (Secondary)
   - Klick navigiert zum Vorgang-Detail

   Zwei-Spalten Grid (Hauptbereich 1fr + Sidebar-Cards 260px):

   Links — Hauptbereich:
     SectionHeader "Aktuelle Vorgänge" mit Action "Alle →"
     - ListItems: Die 5-8 zuletzt geänderten offenen Vorgänge
     - Jeder: Icon-Circle (B für Bauantrag, F für Forschung), Titel, Status-Badge + ID
     - Klick → navigiert zum Plugin + Detail

     SectionHeader "Letzte Artefakte"
     - ListItems: Die 5 neuesten generierten Artefakte
     - Jeder: Typ-Badge (Email/Gutachten/Nachforderung), Titel, Datum
     - Klick → navigiert zum Vorgang Artefakte-Tab

   Rechts — Sidebar-Cards (3 Karten):
     Card "Offene Fristen":
     - Liste: Vorgang-ID + "in X Tagen", sortiert nach Dringlichkeit
     - Dot-Indikator: Rot wenn <3 Tage, Gelb wenn <7, Grau sonst
     - Max 5 Einträge

     Card "AI-Assistent":
     - Status-Dot (grün/rot) + "Streamlit Bridge aktiv" / "Nicht verbunden"
     - "Chat öffnen →" Link

     Card "Suchindex":
     - "{N} Dokumente · {M} Chunks"
     - "Letztes Update: {Datum}"

### Navigation von Dashboard zu Detail

3. Das Plugin-System muss jetzt Cross-Plugin Navigation unterstützen:
   - Erstelle src/core/hooks/useNavigation.ts:
     - navigate(pluginId, params?): Wechselt das aktive Plugin und übergibt optional Parameter
     - Beispiel: navigate('bauantraege', { selectedId: 'BA-2026-001' })
   - Shell.tsx: Hält navigationParams State, übergibt an aktives Plugin
   - Bauanträge/Forschung Plugins: Lesen selectedId aus navigationParams falls vorhanden

4. "Alle →" Links bei SectionHeaders:
   - "Aktuelle Vorgänge → Alle" → navigiert zu Bauanträge-Plugin
   - "Letzte Artefakte → Alle" → navigiert zu Dokumente-Plugin

### Responsive

5. Auf schmalen Screens (<1024px): Sidebar-Cards unter dem Hauptbereich statt daneben

### Test + Fix

1. `npm run dev`:
   a) Zeitbasierte Begrüßung korrekt (Morgen/Tag/Abend)
   b) Stats stimmen (zähle manuell nach)
   c) Callout zeigt den dringendsten Vorgang (oder verschwindet wenn keiner dringend)
   d) Klick auf Vorgang im Dashboard → Detail-Ansicht öffnet sich im richtigen Plugin
   e) Klick auf "Alle →" → wechselt zum Plugin
   f) Klick auf "Chat öffnen →" → Chat Plugin öffnet sich
   g) Fristen-Card: Sortierung stimmt, Farbcodierung der Dots
   h) Leerer Zustand: Keine Vorgänge → freundliche Nachricht + [Ersten Antrag erstellen]
   i) Dark Mode: Dashboard sieht im Warm-grau-Theme korrekt aus
2. `npm run build:single`
3. file:// Test
4. `npx tsc --noEmit`

Committe.
```

---

## Prompt 15 — DOCX-Export für Artefakte

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Installiere: npm install docx file-saver
Installiere: npm install -D @types/file-saver

Sachbearbeiter müssen generierte Artefakte als Word-Dokument herunterladen können
um sie per Email zu versenden oder auszudrucken.

### Export-Service

1. src/core/services/export/docx-export.ts:
   - DocxExportService Klasse
   - Nutzt die 'docx' Library (npm package) für programmatische .docx Erstellung
   - markdownToDocx(markdown: string, meta: ExportMeta): Promise<Blob>
     - ExportMeta: { title, author, date, vorgangId, type }
     - Parsed den Markdown (via marked AST oder einfaches Regex-Parsing)
     - Mapped auf docx Elemente:
       - # → Heading Level 1 (HeadingLevel.HEADING_1)
       - ## → Heading Level 2
       - **text** → Bold Run
       - Normaler Text → Paragraph
       - Nummerierte Liste → Numbered list
       - Aufzählung → Bullet list
       - --- → Page Break oder Horizontal Rule
     - Setzt Dokument-Properties: title, author, created date
     - Standard-Formatierung: Schrift Calibri 11pt, 1.15 Zeilenabstand,
       Heading 1: 16pt bold, Heading 2: 13pt bold
     - Optional: Behörden-Briefkopf als Header (Platzhalter-Text, später konfigurierbar)
   - downloadBlob(blob, filename): Nutzt file-saver saveAs()
   - exportArtifact(artifact, vorgang): Convenience-Methode
     - Generiert Dateiname: {type}_{vorgangId}_{datum}.docx
     - Ruft markdownToDocx + downloadBlob auf

### UI Integration

2. Artefakte-Tab (ArtefakteTab.tsx) erweitern:
   - Jedes gespeicherte Artefakt bekommt einen [↓ DOCX] Button neben [Kopieren]
   - Klick → docxExport.exportArtifact() → Browser-Download startet
   - Loading-State auf dem Button während Generierung (~1s)

3. Artefakt-Vollansicht erweitern:
   - Oben rechts: [↓ Als Word herunterladen] Button (Secondary)
   - Generiert DOCX und startet Download

4. Batch-Export (optional aber nützlich):
   - In Bauantrag/Forschung Detail → Artefakte-Tab:
   - [↓ Alle Artefakte als DOCX] Button
   - Exportiert jedes Artefakt als separate .docx Datei
   - (Kein ZIP nötig — einfach mehrere Downloads nacheinander)

### Auf File Server speichern statt Download

5. Wenn File Server connected:
   - Zusätzliche Option: [Auf File Server speichern]
   - Speichert die .docx in: vorgaenge/{type}/{id}/export/{filename}.docx
   - Bestätigung: "Gespeichert unter export/{filename}.docx ✓"
   - So können Kollegen die Datei direkt vom Netzlaufwerk öffnen

### Template-Konfiguration (einfach)

6. src/core/services/export/docx-templates.ts:
   - STANDARD_TEMPLATE: Default-Formatierung (Calibri, Behörden-Look)
   - Briefkopf-Platzhalter: "Gemeinde Musterstadt · Bauamt · Musterstraße 1"
   - Fußzeile: Aktenzeichen (Vorgang-ID) + Seite X von Y
   - Später erweiterbar: User kann eigene .docx als Template hochladen

### Test + Fix

1. `npm run dev`:
   a) Bauantrag → Artefakte-Tab → ein Artefakt anlegen (manuell oder via AI)
   b) [↓ DOCX] Button klicken → Browser-Download startet
   c) Heruntergeladene .docx in Word/LibreOffice öffnen:
      - Überschriften sind formatiert
      - Listen sind korrekt (nummeriert / Aufzählung)
      - Text ist Calibri 11pt
      - Datei-Properties: Titel + Autor gesetzt
   d) [Auf File Server speichern] (wenn FS connected) → Datei liegt im export/ Ordner
   e) Forschungsantrag: Gleicher Test
   f) Leeres Artefakt: Exportiert ohne Error (leeres Dokument)
   g) Artefakt mit viel Formatierung: Headings, Listen, Bold — alles korrekt in DOCX
2. `npm run build:single`
3. KRITISCH: file:// Test — docx Library + file-saver müssen unter file:// funktionieren
   Die 'docx' Library generiert einen Blob, file-saver nutzt URL.createObjectURL —
   beides sollte unter file:// funktionieren, aber testen!
4. `npx tsc --noEmit`

Committe.
```

---

## Prompt 16 — Workflow-Engine (Fristen, Status-Regeln, Historie)

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Implementiere grundlegende Workflow-Funktionalität die dem Sachbearbeiter
hilft den Überblick über Fristen und Statusänderungen zu behalten.

### Workflow-Service

1. src/core/services/workflow/engine.ts:
   - WorkflowEngine Klasse
   
   Status-Transitions (welcher Status darf auf welchen folgen):
   Bauanträge:
     neu → in_bearbeitung, abgelehnt
     in_bearbeitung → in_pruefung, nachforderung, abgelehnt
     nachforderung → in_bearbeitung (Unterlagen nachgereicht)
     in_pruefung → genehmigt, nachforderung, abgelehnt
     genehmigt → archiviert
     abgelehnt → archiviert, in_bearbeitung (Widerspruch)

   Forschung:
     eingereicht → in_begutachtung, abgelehnt
     in_begutachtung → bewilligt, nachbesserung, abgelehnt
     nachbesserung → in_begutachtung
     bewilligt → abgeschlossen
     abgelehnt → eingereicht (Neueinreichung)

   - canTransition(currentStatus, targetStatus, type): boolean
   - getAvailableTransitions(currentStatus, type): Status[]
   - transition(vorgang, targetStatus, comment?): Vorgang
     - Prüft ob Transition erlaubt
     - Setzt neuen Status + modified Timestamp
     - Erstellt History-Eintrag
     - Automatische Aktionen (siehe unten)

   Automatische Aktionen bei Status-Wechsel:
   - → nachforderung: Setzt Standard-Frist (+4 Wochen)
   - → genehmigt/bewilligt: Entfernt Frist
   - → abgelehnt: Entfernt Frist
   - → archiviert: Markiert als abgeschlossen

2. src/core/services/workflow/history.ts:
   - HistoryEntry: { timestamp, fromStatus, toStatus, user, comment? }
   - Wird als Array in vorgang.history gespeichert (neues Feld)
   - loadHistory(vorgangId): HistoryEntry[]
   - addEntry(vorgangId, entry): void
   - Persistenz: In meta.json auf File Server

3. src/core/services/workflow/deadlines.ts:
   - DeadlineService Klasse
   - getUpcomingDeadlines(vorgaenge, days): Vorgänge mit Frist in den nächsten N Tagen
   - getOverdueDeadlines(vorgaenge): Vorgänge deren Frist überschritten ist
   - getDaysUntilDeadline(vorgang): number | null
   - isUrgent(vorgang): boolean (Frist < 3 Tage)
   - isWarning(vorgang): boolean (Frist < 7 Tage)

### UI: Status-Dropdown mit Regeln

4. src/ui/StatusSelect.tsx:
   - Props: currentStatus, type ('bauantrag'|'forschung'), onChange, disabled?
   - Zeigt NUR die erlaubten Transitions als Optionen
   - Aktueller Status ist selected, nicht änderbar (disabled option)
   - Nicht-erlaubte Status werden gar nicht angezeigt
   - Beim Wechsel: Bestätigungs-Dialog mit optionalem Kommentar-Feld
     "Status ändern zu '{neuer Status}'?"
     [Kommentar (optional): ________________]
     [Abbrechen] [Bestätigen]

5. Bauantrag/Forschung Detail → Status-Select ersetzen:
   - Nutzt jetzt StatusSelect Komponente
   - Nach Statuswechsel: Historie wird aktualisiert

### UI: Frist-Warnungen

6. Frist-Anzeige überall wo Fristen sichtbar sind:
   - Dot-Farbkodierung:
     - Rot (●): Frist überschritten oder < 3 Tage
     - Gelb/Orange (●): Frist < 7 Tage
     - Grau (●): Frist > 7 Tage
     - Kein Dot: Keine Frist gesetzt
   - Text: "Frist in 3 Tagen" / "Frist überschritten!" / "Frist: 15.04.2026"
   - In Listen (BauantraegeListe, ForschungListe): Frist-Dot neben dem Status-Badge
   - Im Dashboard: Fristen-Card nutzt diese Farbkodierung
   - Im Detail: Frist-Feld zeigt Dot + relative Zeit

7. Banner bei überfälligen Fristen:
   - Wenn ein Vorgang eine überfällige Frist hat:
   - Kleiner roter Banner oben im Detail:
     "Frist überschritten seit {N} Tagen"
     bg var(--tf-danger-bg), text var(--tf-danger-text), border-radius 8px
   - Dezent, nicht aufdringlich, aber nicht zu übersehen

### UI: Änderungshistorie

8. Neuer Tab "Verlauf" in Bauantrag/Forschung Detail:
   - Chronologische Liste der Statusänderungen (neueste oben)
   - Jeder Eintrag:
     - Datum + Uhrzeit (12px, text-tertiary)
     - "{User} hat Status geändert" (13px)
     - Von-Badge → Nach-Badge (mit Pfeil dazwischen)
     - Kommentar darunter falls vorhanden (13px, text-secondary, italic)
   - SectionHeader "Änderungshistorie"
   - Empty State: "Noch keine Statusänderungen"

### Vorgang-Types erweitern

9. src/core/types/vorgang.ts:
   - Neues Feld: history (HistoryEntry[]), default []
   - HistoryEntry: { timestamp, fromStatus, toStatus, user, comment? }

10. Storage: history wird in meta.json mitgespeichert (neues Feld)

### Test + Fix

1. `npm run dev`:
   a) Bauantrag Status "Neu" → Dropdown zeigt nur "In Bearbeitung" und "Abgelehnt"
   b) "In Bearbeitung" wählen → Bestätigungs-Dialog → Kommentar eingeben → Bestätigen
   c) Status ist jetzt "In Bearbeitung", Dropdown zeigt neue Optionen
   d) Verlauf-Tab: Eintrag mit Timestamp, User, Von→Nach Badge, Kommentar
   e) Ungültige Transition: "Neu" → "Genehmigt" ist NICHT möglich (Option nicht sichtbar)
   f) Frist setzen → Frist-Dot erscheint (Farbe je nach Dringlichkeit)
   g) Frist auf morgen setzen → Dot wird rot
   h) Frist auf gestern setzen → "Frist überschritten" Banner im Detail
   i) Dashboard: Fristen-Card zeigt roten Dot für überfällige
   j) Forschungsantrag: Gleiche Tests mit Forschungs-Status-Werten
   k) Status → "Nachforderung": Automatisch Frist +4 Wochen gesetzt
   l) Status → "Genehmigt": Frist wird entfernt
   m) Browser Reload: Historie bleibt erhalten
   n) Dark Mode: Alle neuen Elemente sehen korrekt aus
2. `npm run build:single`
3. file:// Test
4. `npx tsc --noEmit`

Committe: "MVP complete: Dashboard, DOCX export, workflow engine with deadlines and history"
```

---

## Nach diesen 3 Prompts: MVP-Checkliste

Alles was ein Sachbearbeiter täglich braucht ist da:

- ✅ Öffnet App → Dashboard zeigt offene Vorgänge und Fristen
- ✅ Klickt auf dringenden Vorgang → Detail mit allen Infos
- ✅ Lädt Dokument hoch (DOCX/PDF/MD) → automatisch konvertiert
- ✅ Ändert Status → nur erlaubte Übergänge, mit Kommentar und Historie
- ✅ Generiert Nachforderungsschreiben → AI erstellt Entwurf
- ✅ Exportiert als Word-Dokument → per Email versendbar
- ✅ Sucht nach altem Vorgang → Keyword + Vektor findet ihn
- ✅ Wechselt zu Forschungsanträgen → gleiche Funktionalität
- ✅ Sieht auf einen Blick: Was ist überfällig, was steht an

Danach: Phase 5 (Prompt Workbench, Version History) oder Phase 6 (Polish).
