# UI/UX-Analyse & Brainstorming (Prompting Tutor)

> Erweiterter Fokus: Nicht nur Lern-App, sondern auch interne Nutzung in Organisationen (Enablement, Wissensarbeit, Team-Standards).

Stand: Analyse auf Basis des aktuellen Live-Standes und bereitgestelltem Screenshot.



## 0) Erweiterter Produktfokus: Lern-App + interne Organisationsplattform

Damit die App professionell im **Unternehmenskontext** funktioniert, sollte sie zwei Modi unterstützen:
- **Lernmodus** (Onboarding, Methodik, Übungen)
- **Arbeitsmodus** (konkrete Firmen-Use-Cases, Vorlagen, Team-Standards, Qualitätssicherung)

Zusätzliche Anforderungen für Organisationen:
- **Use-Case-Bibliothek aus dem Firmenumfeld** (z. B. Vertrieb, HR, Support, PM, Legal).
- **Rollen & Rechte** (Mitarbeitende, Teamlead, Admin).
- **Governance & Compliance** (freigegebene Prompt-Templates, sensible Daten-Hinweise, Logging).
- **Wiederverwendbarkeit** (eigene Prompts speichern, teilen, versionieren).
- **Messbarkeit auf Team-Ebene** (Adoption, Qualität, Zeitersparnis).


## 1) Gesamtbild: Wo die App heute steht

**Positiv**
- Klare Lernlogik mit gut erkennbaren Bereichen (Einstieg, Methode, Übungen, Ressourcen).
- Konsistente Farbwelt mit warmer Markenanmutung.
- Solide Kartenstruktur für Inhalte.

**Herausforderungen**
- Sehr lange One-Page mit hoher kognitiver Last.
- Visuelle Hierarchie wirkt stellenweise flach (zu ähnliche Gewichte zwischen Sektionen, Karten, Metadaten).
- Interaktive Elemente (CTA, Tabs, Eingaben) heben sich teilweise nicht stark genug ab.
- Lesbarkeit leidet in dichten Kartenbereichen (viel Text auf engem Raum).

## 2) Professionelleres Design: Priorisierte Hebel

## P0 (hoher Impact, schnell umsetzbar)

1. **Typografische Hierarchie schärfen**
   - Klarer Scale (z. B. 48/36/28/22/18/16/14).
   - Mehr Zeilenhöhe bei Fließtext.
   - Konsistente maximale Zeilenlänge (60–80 Zeichen) im Content.

2. **Spacing-System vereinheitlichen**
   - 8px/4px Raster und klare Sektion-Rhythmen (z. B. 96px Desktop / 64px Tablet / 48px Mobile).
   - Mehr „Atemraum“ zwischen Sektionen und in Cards.

3. **Kontrast & Lesbarkeit verbessern**
   - Textfarben leicht dunkler auf hellem Background.
   - Sekundärtexte klar vom Primärtext absetzen.
   - Interaktive Zustände (hover/focus/active) sichtbarer machen.

4. **CTA-Strategie reduzieren**
   - Pro Sektion 1 primärer CTA, sekundäre Aktionen als Text-/Ghost-Buttons.
   - Einheitliche Button-Hierarchie (Primary/Secondary/Tertiary).

## P1 (mittlerer Aufwand, großer UX-Gewinn)

5. **Page-Architektur in „Lern- & Arbeitspfad“ umstellen**
   - Hero + 3 Kern-CTAs („Lernen starten“, „Use Cases“, „Im Team anwenden“).
   - Komplexe Bereiche (Ressourcen, fortgeschrittene Techniken) einklappbar/optional.
   - Sticky Progress-Navigation (Anker + Status).

6. **Card-Design modernisieren**
   - Einheitliche Kartenhöhe je Grid-Reihe.
   - Klare Informationsblöcke: Titel, Kurzbeschreibung, Meta, Aktion.
   - Weniger dekorative Linien, mehr funktionale Trennung.

7. **Form-UX (Prompt-Eingabe & Übungen)**
   - Größere Eingabefelder mit „Prompt-Vorlage“-Buttons.
   - Inline-Hinweise statt langer erklärender Textblöcke.
   - Sofort-Feedback kompakter (Score + 2 konkrete Verbesserungsvorschläge).

## P2 (strategisch, differenzierend)

8. **Design-Token-System ausbauen**
   - Semantische Tokens (`surface-1`, `surface-2`, `text-muted`, `border-subtle`).
   - Konsistente Schatten-/Radius-Skala.

9. **Microinteractions**
   - Sanfte Transitionen (150–250ms).
   - Progress-Animationen beim Üben.
   - „Erfolg“-Momente bei abgeschlossenen Schritten.

10. **Trust, Governance & Professionalität**
   - Referenzen/Firmen-Use-Cases im Hero oder unterhalb des Folds.
   - „Für wen ist das?“ klarer segmentieren (Alltag/Beruf/Forschung).

## 3) UI/UX-Baustellen entlang der vorhandenen Seite

1. **Hero-Bereich**
   - Nutzenversprechen kürzer, konkreter, ergebnisorientiert.
   - Primärer CTA visuell stärker.
   - Sekundär-CTA (z. B. „Beispiele ansehen“) dezenter.

2. **„Prompting in vier Stufen“**
   - Die vier Karten stärker unterscheiden (Icons, Farbakzent, Reihenfolge klar).
   - Jede Karte mit „Dauer/Outcome“ ergänzen.

3. **Beispiel-Prompts**
   - Prompt und Output tabellarisch/zweispaltig, besser scanbar.
   - „Copy“- und „Anpassen“-Aktionen prominenter.

4. **ACTA-Methode**
   - Als horizontaler Stepper (A→C→T→A) mit Fortschrittszustand.
   - Pro Schritt 1 Satz + „Mehr anzeigen“ statt Volltext.

5. **Prompt-Bibliothek**
   - Bessere Filterbarkeit (Use Case, Schwierigkeit, Fachbereich).
   - Tags als visuelle Chips mit klaren Zuständen.

6. **Übungsbereich**
   - Split-View: links Aufgabe, rechts Eingabe + Feedback.
   - Persistenter „Bewerten“-Button und klarer Lade-/Ergebniszustand.

7. **Ressourcen/Best Practices**
   - Weniger Fließtext, mehr checklistenartige Patterns.
   - Priorisierung: „Top 5 zuerst“.

8. **Fortgeschrittene Techniken**
   - Standardmäßig collapsed.
   - Je Technik: Wann nutzen? Mini-Beispiel. Typische Fehler.

## 4) Konkrete Design-Richtlinien (Quick-Wins)

- **Container-Breite:** 1200px max, Content-Spalten enger (720–860px).
- **Cards:** Radius 12–16, Border subtil, Shadow sehr sparsam.
- **Section-Hintergründe:** Alternierende Tints für bessere Segmentierung.
- **Iconographie:** Einheitliche Strichstärke/Größe.
- **Textdichte:** Max. 3–4 Zeilen pro Erklärung im Erstkontakt.
- **Responsiveness:** Mobil zuerst „single-column journey“ statt komplexe Grids.

## 5) UX-Heuristiken (Nielsen) – Kurzbewertung

- **Visibility of system status:** Teilweise gut, kann im Übungsfeedback klarer werden.
- **Recognition over recall:** Potenzial bei Prompt-Vorlagen und Pattern-Library.
- **Aesthetic & minimalist design:** Aktuell inhaltlich stark, visuell etwas überladen.
- **Consistency & standards:** Solide Basis, aber Hierarchie/Abstände inkonsistent.

## 6) Vorschlag: 3-Wochen-Umsetzungsplan

### Woche 1 – Foundations
- Typo-/Spacing-System festziehen.
- Button- und Card-Hierarchie vereinheitlichen.
- Hero + erste zwei Sektionen überarbeiten.

### Woche 2 – Lernfluss & Interaktion
- Sticky Step-Navigation.
- Übungsbereich auf Split-Layout umstellen.
- Prompt-Bibliothek mit besseren Filtern/Chips.

### Woche 3 – Polish & Validierung
- Microinteractions + States (empty/loading/success/error).
- Accessibility-Pass (Kontrast, Focus, Keyboard).
- 5 User-Tests (15–20 Min) + schnelle Iteration.

## 7) Messbare Ziele (damit „professioneller“ objektiv wird)

- +20% mehr Starts von Übungen pro Session.
- -25% geringere Absprungrate bis zum Übungsbereich.
- +15% Abschlussrate pro Lernstufe.
- SUS-Score > 75 in Kurztest.

## 8) Backlog-Ideen für Brainstorming (inkl. Organisation)

- Guided „Prompt Builder“ (Schritt-für-Schritt Assistent).
- Persona-Modus (Schüler:in, Berufseinsteiger:in, Research).
- Vorher/Nachher-Vergleich für Prompts als Kern-Feature.
- „Save & Reuse“-Bibliothek für eigene Prompts.
- Gamification light: Streaks, Milestones, Badges.
- Team-/Kursmodus mit geteilten Beispielen.
- Organisations-Template-Katalog (nach Abteilung/Funktion filterbar).
- Freigabe-Workflow für „offizielle“ Unternehmens-Prompts.
- Review-Modus: Prompt-Qualität im Team bewerten und verbessern.
- KPI-Dashboard für Führungskräfte (Nutzung, Qualität, Zeitgewinn).

## 9) Entscheidungsvorlage (was ich zuerst tun würde, mit Organisationsfokus)

1. IA auf zwei Modi erweitern: „Lernen“ und „Use Cases im Unternehmen“.
2. Prompt-Bibliothek als Firmen-Use-Case-Katalog ausbauen (Abteilung, Rolle, Ziel, Risiko-Level).
3. Übungsbereich um Team-Feedback/Review und wiederverwendbare Templates ergänzen.

Diese drei Maßnahmen erzeugen meist den sichtbarsten Professionalitätsgewinn bei überschaubarem Aufwand.


## 10) Vorbereitung für kommende Firmen-Use-Cases

Sobald weitere interne Use Cases ergänzt werden, sollten sie nach einheitlichem Schema gepflegt werden:
- **Kontext:** In welchem Team/Prozess wird es genutzt?
- **Zielbild:** Welches Ergebnis wird erwartet?
- **Prompt-Template:** Ausgangsprompt mit Platzhaltern.
- **Qualitätskriterien:** Woran erkennt man einen guten Output?
- **Risiken/Guardrails:** Was darf nicht in den Prompt/Output?
- **Messung:** Welche KPI verbessert sich dadurch (Zeit, Qualität, Durchlaufzeit)?

So bleibt die App skalierbar: vom Lernprodukt hin zu einer internen Prompting-Enablement-Plattform.
