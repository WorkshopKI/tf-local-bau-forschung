# TeamFlow Local — Ergänzende Prompts (Phase 2+3 Vervollständigung)

Ausführen NACH den 8 Basis-Prompts und dem Design-Fix.
Diese Prompts vervollständigen Phase 2 und 3 aus der ARCHITECTURE.md.

---

## Prompt 9 — PDF → Markdown Konvertierung

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Installiere: npm install pdfjs-dist

Erweitere die Dokument-Konvertierung um PDF-Support.

### PDF Worker

1. src/workers/converter.worker.ts erweitern:
   - Neuen case 'pdf' im onmessage Handler
   - Importiere pdfjs-dist (bzw. den Worker-kompatiblen Teil)
   - PDF Konvertierung:
     - getDocument({data: arrayBuffer})
     - Für jede Seite: getPage(i) → getTextContent()
     - TextContent Items intelligent zusammenbauen:
       Nicht einfach alle Strings konkatenieren, sondern Y-Position prüfen —
       wenn Y-Versatz > 5px → neuer Absatz (\n\n), sonst Leerzeichen
     - Seitenumbrüche als Markdown HR (---) zwischen Seiten
   - Frontmatter: converted, source_format: 'pdf', pages: Anzahl
   - Antwortet: { type: 'result', markdown, warnings: [], pages }
   - Bei Error: { type: 'error', error: 'PDF Konvertierung fehlgeschlagen: ...' }

   WICHTIG: pdfjs-dist braucht einen PDF Worker. Für den Inline-Worker-Kontext:
   - Setze pdfjsLib.GlobalWorkerOptions.workerSrc auf '' (leerer String)
   - Oder nutze pdfjsLib.getDocument() ohne separaten Worker (single-threaded, OK für unseren Use Case)
   - Falls Import-Probleme im Worker: Teste mit dem 'pdfjs-dist/legacy/build/pdf' Entry-Point

2. src/core/services/converter/index.ts:
   - DocConverter.convert() unterstützt jetzt auch .pdf Dateien
   - Prüfe file.name Endung und setze format: 'pdf'

3. src/plugins/dokumente/ erweitern:
   - FileDropZone akzeptiert jetzt auch .pdf (.docx,.pdf,.md,.txt)
   - PDF-Dokumente zeigen Seiten-Anzahl als Meta-Info
   - Badge: "PDF · X Seiten" statt nur "PDF"

4. Bauanträge Detail → Dokumente-Tab:
   - PDF Upload funktioniert jetzt auch hier

### Test + Fix

1. `npm run dev`:
   a) Erstelle eine einfache Test-PDF oder nutze eine vorhandene
   b) Dokumente-Plugin → PDF hochladen → Konvertierung startet
   c) Ergebnis: Markdown mit Text-Inhalt, Seitenumbrüche als ---
   d) Preview: MarkdownRenderer zeigt den konvertierten Text
   e) Seiten-Anzahl wird angezeigt
   f) Auch .docx und .md Upload funktionieren weiterhin (Regression-Check!)
2. `npm run build:single`
3. KRITISCH: dist-single/index.html per file:// → PDF Upload testen
   Der converter Worker (Blob URL) muss mit pdfjs-dist zusammenarbeiten!
   Falls Error: pdfjs-dist Import-Pfad im Worker anpassen
4. `npx tsc --noEmit`

Committe.
```

---

## Prompt 10 — Tag-System mit Management-UI

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Implementiere ein vollständiges Tag-System das sich durch die gesamte App zieht.

### Tag-Service

1. src/core/services/tags.ts:
   - TagService Klasse
   - Verwaltet eine zentrale Tag-Registry: { name: string, color?: string, count: number }[]
   - loadTags(storage): Aus IDB laden (und FS wenn connected: data/.teamflow/tags.json)
   - saveTags(storage): In IDB + FS speichern
   - addTag(name): Tag hinzufügen (normalisiert: lowercase, trimmed, Duplikate vermeiden)
   - removeTag(name): Tag entfernen (aus Registry, NICHT aus Vorgängen)
   - getPopularTags(limit): Meistgenutzte Tags
   - getAllTags(): Alle Tags sortiert nach Name
   - recountTags(vorgaenge, dokumente): Zählt Tag-Nutzung über alle Vorgänge und Dokumente

2. src/core/hooks/useTags.ts:
   - TagContext + TagProvider + useTags Hook
   - Initialisiert TagService, lädt Tags
   - Stellt bereit: allTags, popularTags, addTag, removeTag

### Tag-Input Komponente

3. src/ui/TagInput.tsx:
   - Props: value (string[]), onChange (tags: string[]) , placeholder?
   - Zeigt bestehende Tags als kleine Pills mit X-Button zum Entfernen
   - Input-Feld dahinter: Tippen + Enter oder Komma → Tag hinzufügen
   - Autocomplete-Dropdown: Zeigt vorhandene Tags aus Registry die zum Tipp-Text passen
   - Dropdown: Einfache Liste unter dem Input, bg-[var(--tf-bg)], border, max 5 Vorschläge
   - Styling: Konsistent mit Badge-Component (Pill-Shape), neutral-Variante
   - Leerer Zustand: Nur das Input-Feld mit Placeholder

### Integration überall

4. Bauanträge:
   - BauantragForm.tsx: TagInput statt komma-separiertem Text-Input für Tags
   - BauantragDetail.tsx → Übersicht: Tags als klickbare Badges (Klick → Suche mit Tag-Filter)
   - BauantraegeListe.tsx: Tag-Filter zusätzlich zum Status-Filter
     (Dropdown oder Chips mit vorhandenen Tags)

5. Dokumente:
   - DokumentPreview.tsx: TagInput für Tag-Bearbeitung
   - DokumenteListe.tsx: Tag-Filter

6. Suche:
   - SuchSeite.tsx: Tag-Chips als zusätzliche Filter-Option
   - Klick auf ein Tag-Badge überall in der App → öffnet Suche gefiltert auf diesen Tag

7. Einstellungen (neuer Tab "Tags"):
   - Liste aller Tags mit Nutzungs-Count
   - Tags umbenennen (ändert überall)
   - Ungenutzte Tags löschen
   - [Tags neu zählen] Button (recountTags)

### App.tsx: TagProvider wrappen

### Auto-Tagging bei Import
8. Wenn ein Dokument importiert wird: Extrahiere potenzielle Tags aus dem Inhalt
   (einfache Heuristik: Wörter die in der Tag-Registry vorkommen → automatisch vorschlagen,
   NICHT automatisch setzen — User muss bestätigen)

### Test + Fix

1. `npm run dev`:
   a) Bauantrag erstellen → Tags über TagInput eingeben → Autocomplete funktioniert
   b) Zweiten Antrag → gleiche Tags werden vorgeschlagen
   c) Bauanträge-Liste → Tag-Filter zeigt vorhandene Tags → Filtern funktioniert
   d) Dokument importieren → Tags bearbeiten in Preview
   e) Tag-Badge in Bauantrag-Detail klicken → Suche öffnet sich mit Tag-Filter
   f) Einstellungen → Tags-Tab → Liste mit Counts
   g) Tag umbenennen → ändert sich überall
   h) Browser Reload → Tags bleiben erhalten
2. `npm run build:single` — durchlaufen
3. file:// Test: Tags funktionieren
4. `npx tsc --noEmit`

Committe.
```

---

## Prompt 11 — Artefakt-Generierung mit AI

```
Lies CLAUDE.md, ARCHITECTURE.md und DESIGN_GUIDE.md.

Implementiere die AI-gestützte Generierung von Artefakten (Emails, Gutachten, Nachforderungen).
Das ist das Kern-Feature für die tägliche Arbeit der Sachbearbeiter.

### Template-System

1. src/core/services/templates.ts:
   - TemplateService Klasse
   - Templates sind Markdown-Dateien mit Platzhaltern: {{vorgang.titel}}, {{vorgang.bauherr}}, etc.
   - Eingebaute Default-Templates (als String-Konstanten):

     NACHFORDERUNG:
     ```
     Betreff: Nachforderung zum {{vorgang.type}} {{vorgang.id}}

     Sehr geehrte/r {{vorgang.bauherr}},

     im Rahmen der Prüfung Ihres Antrags {{vorgang.id}} ({{vorgang.titel}})
     wurden folgende fehlende Unterlagen festgestellt:

     {{fehlende_unterlagen}}

     Bitte reichen Sie die genannten Unterlagen bis zum {{frist}} ein.

     Mit freundlichen Grüßen
     {{user.name}}
     ```

     EMAIL_STANDARD, GUTACHTEN, PRUEFBERICHT, BEWILLIGUNG — ähnliche Templates

   - loadTemplates(storage): Aus FS laden (data/templates/*.md), Fallback auf Defaults
   - fillTemplate(template, variables): Platzhalter ersetzen
   - listTemplates(): Verfügbare Templates

2. src/core/services/artifacts.ts:
   - ArtifactService Klasse
   - generateWithAI(type, vorgang, context, aiBridge): 
     - Baut Prompt aus Template + Vorgang-Kontext + optionalem User-Input
     - Sendet an AI Bridge
     - Ergebnis als Markdown-Artefakt
   - saveArtifact(vorgang, artifact, storage):
     - Speichert als .md mit YAML Frontmatter
     - In IDB + auf FS (vorgaenge/{type}/{id}/artefakt_name.md)
     - Aktualisiert vorgang.artifacts Liste in meta.json
   - loadArtifacts(vorgangId, storage): Alle Artefakte eines Vorgangs laden
   - Artifact Interface (aus types/vorgang.ts): id, type, filename, content, created, author, tags

### Artefakt-UI in Bauantrag-Detail

3. src/plugins/bauantraege/ArtefakteTab.tsx — Neuer Tab "Artefakte":
   
   Oberer Bereich — Generierung:
   - Dropdown: Artefakt-Typ wählen (Nachforderung, Email, Gutachten, Prüfbericht, Bewilligung)
   - Kontext-Textarea: "Zusätzliche Hinweise für die AI" (optional)
   - [Mit AI generieren] Button (Primary)
   - Loading-State: "AI generiert..." mit Spinner
   - Ergebnis: Markdown-Preview des generierten Artefakts
   - Unter der Preview: [Übernehmen & Speichern] + [Neu generieren] + [Verwerfen] Buttons
   - Vor dem Speichern: User kann den generierten Text im Markdown bearbeiten
     (einfache Textarea mit dem Markdown-Inhalt, KEIN Rich-Editor nötig)

   Unterer Bereich — Gespeicherte Artefakte:
   - SectionHeader "Gespeicherte Artefakte"
   - Liste als ListItems: Typ-Badge + Titel + Datum
   - Klick → Vollansicht des Artefakts (MarkdownRenderer)
   - Aktionen: [Kopieren] (Markdown in Clipboard), [Löschen]

4. BauantragDetail.tsx:
   - Artefakte-Tab aktivieren (war bisher Platzhalter)
   - Tab-Badge: Anzahl gespeicherter Artefakte

### Prompt-Engineering

5. src/core/services/ai/prompts.ts:
   - Vorgefertigte System-Prompts je Artefakt-Typ:

   NACHFORDERUNG_PROMPT:
   "Du bist ein Sachbearbeiter in einer deutschen Baubehörde. Erstelle ein formelles
    Nachforderungsschreiben. Verwende Amtsdeutsch, sei sachlich und präzise.
    Formatiere als Markdown. Nenne die fehlenden Unterlagen als nummerierte Liste."

   EMAIL_PROMPT:
   "Du bist ein Sachbearbeiter. Erstelle eine sachliche Email zum folgenden Vorgang.
    Kurz, höflich, formal. Keine Floskeln. Relevante Informationen aus dem Kontext nutzen."

   GUTACHTEN_PROMPT:
   "Du bist ein Fachgutachter. Erstelle eine strukturierte Bewertung des Antrags.
    Gliedere nach: 1. Zusammenfassung, 2. Prüfpunkte, 3. Feststellungen, 4. Empfehlung.
    Sachlich, fachlich korrekt, Amtsdeutsch."

   Jeder Prompt bekommt den Vorgang-Kontext (Titel, ID, Bauherr, zugehörige Dokumente)
   automatisch angehängt.

### Test + Fix

1. `npm run dev`:
   a) Bauantrag öffnen → Artefakte-Tab → "Gespeicherte Artefakte" ist leer
   b) Typ "Nachforderung" wählen → Kontext eingeben → [Mit AI generieren]
   c) OHNE AI-Verbindung: Fehler wird angezeigt mit Retry — das ist OK
   d) Template-Fallback testen: Wenn AI nicht verfügbar, zeige ausgefülltes Template
      mit Platzhalter-Markierungen wo der User selbst ausfüllen muss
   e) Manuell: Artefakt-Text in Textarea eingeben → [Übernehmen & Speichern]
   f) Artefakt erscheint in der Liste unten
   g) Klick → Vollansicht mit gerenderten Markdown
   h) [Kopieren] → Clipboard hat den Markdown-Text
   i) Zweites Artefakt anlegen → Badge am Tab zeigt "2"
   j) Browser Reload → Artefakte noch da
   k) Wenn File Server connected: Prüfe ob .md Dateien im Vorgang-Ordner liegen
2. `npm run build:single`
3. file:// Test
4. `npx tsc --noEmit`

Committe.
```

---

## Prompt 12 — Forschungsanträge Plugin (Phase 4 Vorgriff)

```
Lies CLAUDE.md und DESIGN_GUIDE.md.

Implementiere das Forschungsanträge-Plugin als Kopie des Bauanträge-Plugins
mit angepassten Feldern und Workflows.

### Prinzip: Maximale Code-Wiederverwendung

Das Bauanträge-Plugin hat die Struktur bereits etabliert. Forschungsanträge
nutzen dieselben Core-Components (ListItem, Badge, Card, Tabs, SectionHeader)
und dieselben Services (Storage, AI, Search, Tags).

### Forschungs-spezifische Felder

1. src/plugins/forschung/types.ts:
   - ForschungsantragMeta (ergänzt Vorgang):
     - foerderprogramm (string): Name des Förderprogramms
     - foerdersumme (number): Beantragte Summe in Euro
     - laufzeit (string): z.B. "24 Monate"
     - projektleiter (string)
     - institution (string)
     - forschungsgebiet (string)
   - ForschungStatus: 'eingereicht'|'in_begutachtung'|'nachbesserung'|
     'bewilligt'|'abgelehnt'|'abgeschlossen'

2. src/plugins/forschung/store.ts:
   - Wie Bauanträge-Store, aber:
   - ID-Prefix: 'FA-{YYYY}-{NNN}'
   - type: 'forschung'
   - Eigene Filter (Status, Forschungsgebiet)

3. src/plugins/forschung/ForschungListe.tsx:
   - Wie BauantraegeListe, aber:
   - Zeigt Förderprogramm + Fördersumme in jeder Zeile
   - Status-Badges mit Forschungs-Status-Werten
   - Filter: Status + Forschungsgebiet

4. src/plugins/forschung/ForschungDetail.tsx:
   - Wie BauantragDetail, aber:
   - Übersicht: Projektleiter, Institution, Förderprogramm, Fördersumme, Laufzeit,
     Forschungsgebiet, Erstellt, Geändert, Tags
   - Tabs: Übersicht | Dokumente | Artefakte | Notizen (gleiche Struktur)
   - Artefakte-Tab: Gleiche Komponente, aber andere Prompt-Templates:
     FORSCHUNG_GUTACHTEN, FORSCHUNG_BEWILLIGUNG, FORSCHUNG_NACHBESSERUNG

5. src/plugins/forschung/ForschungForm.tsx:
   - Dialog mit Forschungs-spezifischen Feldern

6. src/plugins/forschung/index.ts:
   - Plugin: id 'forschung', name 'Forschungsanträge', icon 'FlaskConical',
     category 'workflow', order 20

### AI Prompt-Templates für Forschung

7. src/core/services/ai/prompts.ts erweitern:
   - FORSCHUNG_GUTACHTEN_PROMPT: Wissenschaftliches Gutachten
   - FORSCHUNG_BEWILLIGUNG_PROMPT: Bewilligungsbescheid
   - FORSCHUNG_NACHBESSERUNG_PROMPT: Nachbesserungsaufforderung

### Suche + Tags

8. Forschungsanträge werden automatisch in den Suchindex aufgenommen
   (FulltextSearch + bei nächstem Admin-Indexing auch Vektor-Index)
9. Tags funktionieren übergreifend (gleiche Tag-Registry)

### plugins.config.ts: forschung hinzufügen

### Test + Fix

1. `npm run dev`:
   a) Forschungsanträge in Sidebar sichtbar
   b) Neuen Forschungsantrag erstellen mit allen Feldern
   c) Liste zeigt Förderprogramm + Summe
   d) Detail: Alle Metadaten korrekt angezeigt
   e) Dokument hochladen in Forschungsantrag
   f) Artefakt generieren (oder manuell anlegen)
   g) Suche: Forschungsantrag wird gefunden
   h) Tags: Funktionieren übergreifend mit Bauanträgen
   i) Filter: Status-Filter mit Forschungs-Werten
   j) Browser Reload: Alles noch da
   k) Bauanträge funktionieren weiterhin (Regression!)
2. `npm run build:single`
3. file:// Test
4. `npx tsc --noEmit`

Committe.
```

---

## Prompt 13 — File Server E2E Re-Test nach Erweiterungen

```
Alle neuen Features (PDF, Tags, Artefakte, Forschung) müssen sauber mit
dem File Server zusammenarbeiten. Prüfe und fixe die gesamte Integration.

### Prüfe für JEDES Feature:

1. PDF-Konvertierung:
   - [ ] Konvertierte PDFs werden in IDB gespeichert
   - [ ] Wenn FS connected: .md Datei wird nach dokumente/import/ geschrieben
   - [ ] Wenn FS connected und einem Vorgang zugeordnet: .md landet im Vorgang-Ordner

2. Tags:
   - [ ] tags.json wird auf FS gespeichert (data/.teamflow/tags.json)
   - [ ] Beim App-Start: tags.json vom FS laden
   - [ ] Tag-Änderungen werden in FS geschrieben
   - [ ] Tags in meta.json der Vorgänge werden korrekt geschrieben

3. Artefakte:
   - [ ] Generierte Artefakte werden als .md mit Frontmatter gespeichert
   - [ ] Pfad: vorgaenge/{type}/{id}/artefakt_name.md
   - [ ] meta.json des Vorgangs listet alle Artefakte auf
   - [ ] Artefakte überleben Browser-Reload (IDB + FS)
   - [ ] Artefakte werden bei Suche indexiert

4. Forschungsanträge:
   - [ ] Eigener Ordner: vorgaenge/forschung/FA-YYYY-NNN/
   - [ ] meta.json enthält Forschungs-spezifische Felder
   - [ ] Getrennt von Bauanträgen auf dem File Server

### Verzeichnisstruktur auf FS prüfen

5. Verbinde File Server (Einstellungen oder Onboarding)
6. Lege an: 2 Bauanträge, 1 Forschungsantrag, je 1 Dokument, je 1 Artefakt
7. Prüfe den Ordner auf der Festplatte:

   Erwartet:
   ```
   data/
   ├── .teamflow/
   │   ├── config.json
   │   └── tags.json
   ├── users/{name}/profile.json
   ├── vorgaenge/
   │   ├── bauantraege/
   │   │   ├── BA-2026-001/meta.json + *.md
   │   │   └── BA-2026-002/meta.json + *.md
   │   └── forschung/
   │       └── FA-2026-001/meta.json + *.md
   ├── dokumente/import/*.md
   └── index/ (wenn Admin-Indexierung gelaufen)
   ```

8. Datei-Inhalte stichprobenartig prüfen:
   - meta.json: Alle Felder korrekt? Tags Array? Artifacts Liste?
   - Artefakt .md: Frontmatter vorhanden? Content korrekt?
   - tags.json: Alle Tags mit Counts?

### Build + Final Check

9. `npm run build:single`
10. dist-single/index.html per file:// → kompletter Durchlauf
11. `npx tsc --noEmit`
12. Console Errors prüfen und fixen

Committe: "Phase 2+3 complete: PDF, tags, artifacts, research grants, FS integration"
```

---

## Nutzungshinweise

- Prompts 9–13 in Reihenfolge ausführen, nach jedem committen
- **Prompt 9** (PDF): Schnell, eigenständig, ~30 Min
- **Prompt 10** (Tags): Durchzieht die ganze App, ~45 Min
- **Prompt 11** (Artefakte): Das wichtigste Feature für die User, ~45 Min
- **Prompt 12** (Forschung): Weitgehend Copy+Adapt von Bauanträgen, ~30 Min
- **Prompt 13** (E2E): Integrationstest, Fixes, ~20 Min
- Danach ist Phase 1–3 komplett + Forschungsanträge aus Phase 4
