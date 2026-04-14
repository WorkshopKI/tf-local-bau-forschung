/**
 * Statische, vorberechnete Zerlegungsergebnisse für die Beispielprojekte.
 * Diese werden sofort angezeigt, ohne einen API-Call auszulösen.
 * Nur benutzerdefinierte Projekte nutzen die LLM-API.
 */
export const staticDecompositionResults: Record<string, string> = {

"Website Redesign": `## Projekt-Zerlegung: Website Redesign

### Teilaufgabe 1: Anforderungsanalyse & Sitemap
- **Input**: Aktuelle WordPress-Seite, Stakeholder-Anforderungen
- **Output**: Dokumentierte Anforderungsliste, Sitemap für 5 Seiten
- **Abhängigkeiten**: Keine
- **Acceptance Criteria**: Alle 5 Seiten definiert, Navigation festgelegt, SEO-Anforderungen dokumentiert
- **Geschätzte Dauer**: 1,5 Stunden

### Teilaufgabe 2: Design-System & Wireframes
- **Input**: Anforderungsliste, bestehende Markenrichtlinien
- **Output**: Figma/Sketch Wireframes für alle 5 Seiten, Farbpalette, Typografie
- **Abhängigkeiten**: Teilaufgabe 1
- **Acceptance Criteria**: Wireframes für Desktop + Mobile, Design-Tokens definiert
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 3: Next.js Projekt-Setup & Grundstruktur
- **Input**: Sitemap, technische Anforderungen
- **Output**: Next.js Projekt mit Routing, Tailwind CSS, ESLint, Deployment-Config
- **Abhängigkeiten**: Teilaufgabe 1
- **Acceptance Criteria**: Projekt startet lokal, alle 5 Routen erreichbar, CI/CD Pipeline konfiguriert
- **Geschätzte Dauer**: 1 Stunde

### Teilaufgabe 4: Responsive Layouts implementieren
- **Input**: Wireframes, Design-System
- **Output**: HTML/CSS-Struktur für alle 5 Seiten (ohne Inhalte)
- **Abhängigkeiten**: Teilaufgabe 2, Teilaufgabe 3
- **Acceptance Criteria**: Pixel-genaue Umsetzung der Wireframes, responsiv ab 375px
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 5: Blog-Integration mit CMS
- **Input**: Blog-Anforderungen, bestehende WordPress-Inhalte
- **Output**: Headless CMS (z.B. Contentlayer/MDX) mit Blog-Liste, Einzelansicht, Kategorien
- **Abhängigkeiten**: Teilaufgabe 3
- **Acceptance Criteria**: Blog-Posts erstellbar, Listing-Seite mit Pagination, SEO-Meta-Tags
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 6: Kontaktformular & E-Mail-Versand
- **Input**: Formularfelder-Definition, E-Mail-Empfänger
- **Output**: Validiertes Kontaktformular mit Server Action, E-Mail-Versand via Resend/SendGrid
- **Abhängigkeiten**: Teilaufgabe 3
- **Acceptance Criteria**: Formular validiert client- und serverseitig, E-Mail kommt an, Spam-Schutz aktiv
- **Geschätzte Dauer**: 1,5 Stunden

### Teilaufgabe 7: SEO-Optimierung & Performance
- **Input**: Fertige Seiten, SEO-Anforderungen
- **Output**: Meta-Tags, Open Graph, Sitemap.xml, robots.txt, Lighthouse Score > 90
- **Abhängigkeiten**: Teilaufgabe 4, Teilaufgabe 5, Teilaufgabe 6
- **Acceptance Criteria**: Lighthouse Performance > 90, alle Seiten indexierbar, strukturierte Daten vorhanden
- **Geschätzte Dauer**: 1,5 Stunden

### Teilaufgabe 8: Content-Migration & Go-Live
- **Input**: Bestehende WordPress-Inhalte, DNS-Zugang
- **Output**: Alle Inhalte migriert, Domain umgezogen, alte Seite deaktiviert
- **Abhängigkeiten**: Teilaufgabe 7
- **Acceptance Criteria**: Alle URLs erreichbar, 301-Redirects für alte URLs, SSL aktiv
- **Geschätzte Dauer**: 1,5 Stunden

---

### Dependency-Graph

\`\`\`
[1 Anforderungen] ──┬──▶ [2 Design]  ──┐
                     │                   ├──▶ [4 Layouts] ──┐
                     └──▶ [3 Setup]  ──┬─┘                  │
                                       ├──▶ [5 Blog]  ──────┤
                                       └──▶ [6 Formular] ───┤
                                                            ▼
                                                     [7 SEO] ──▶ [8 Go-Live]
\`\`\`

### Optimaler Ausführungsplan

| Phase | Aufgaben (parallel)        | Dauer   |
|-------|---------------------------|---------|
| 1     | Anforderungsanalyse       | 1,5 Std |
| 2     | Design + Setup (parallel) | 2 Std   |
| 3     | Layouts + Blog + Formular | 2 Std   |
| 4     | SEO-Optimierung           | 1,5 Std |
| 5     | Content-Migration         | 1,5 Std |

### Gesamtschätzung
- **Sequenziell**: ~13 Stunden
- **Parallel (optimal)**: ~8,5 Stunden`,


"Mobile App": `## Projekt-Zerlegung: Fitness-Tracking-App

### Teilaufgabe 1: Anforderungsanalyse & App-Architektur
- **Input**: Feature-Liste, Zielplattformen (iOS + Android)
- **Output**: Technologie-Entscheidung (React Native/Flutter), Datenmodell, API-Spezifikation
- **Abhängigkeiten**: Keine
- **Acceptance Criteria**: Tech-Stack dokumentiert, ER-Diagramm erstellt, API-Endpunkte spezifiziert
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 2: Nutzerregistrierung & Authentifizierung
- **Input**: API-Spezifikation, Auth-Anforderungen
- **Output**: Login/Registrierung (E-Mail + Social), Token-Management, Passwort-Reset
- **Abhängigkeiten**: Teilaufgabe 1
- **Acceptance Criteria**: Registrierung + Login funktionieren, JWT-Token korrekt, Passwort-Reset per E-Mail
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 3: Trainingsplan-Erstellung
- **Input**: Datenmodell für Übungen/Pläne, UI-Wireframes
- **Output**: CRUD für Trainingspläne, Übungskatalog, Drag & Drop Reihenfolge
- **Abhängigkeiten**: Teilaufgabe 1, Teilaufgabe 2
- **Acceptance Criteria**: Pläne erstellen/bearbeiten/löschen, Übungen zuweisen, Reihenfolge ändern
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 4: Workout-Tracking & Timer
- **Input**: Trainingsplan-Daten, Timer-Logik
- **Output**: Workout-Session starten, Sätze/Wiederholungen loggen, Timer/Pausenzeiten, Session beenden
- **Abhängigkeiten**: Teilaufgabe 3
- **Acceptance Criteria**: Session startet korrekt, alle Sätze loggbar, Timer funktioniert, Daten persistent
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 5: Fortschritts-Diagramme
- **Input**: Geloggte Workout-Daten
- **Output**: Linien-/Balkendiagramme für Gewicht, Volumen, Frequenz (Victory/Recharts)
- **Abhängigkeiten**: Teilaufgabe 4
- **Acceptance Criteria**: Diagramme zeigen korrekte Daten, Zeitraum filterbar (Woche/Monat/Jahr)
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 6: Push-Benachrichtigungen
- **Input**: Trainingsplan-Zeiten, Nutzer-Präferenzen
- **Output**: Lokale + Remote Push-Notifications (Firebase/APNs), Einstellungen pro Nutzer
- **Abhängigkeiten**: Teilaufgabe 2
- **Acceptance Criteria**: Erinnerungen kommen zur richtigen Zeit, Nutzer kann deaktivieren, Hintergrund-Delivery
- **Geschätzte Dauer**: 1,5 Stunden

### Teilaufgabe 7: UI-Polish & Testing
- **Input**: Alle implementierten Features
- **Output**: Einheitliches Design, Animationen, Error States, E2E-Tests
- **Abhängigkeiten**: Teilaufgabe 3, Teilaufgabe 4, Teilaufgabe 5, Teilaufgabe 6
- **Acceptance Criteria**: Design konsistent, keine Crashes, Core-Flows getestet
- **Geschätzte Dauer**: 2 Stunden

---

### Dependency-Graph

\`\`\`
[1 Architektur] ──┬──▶ [2 Auth] ──┬──▶ [3 Trainingspläne] ──▶ [4 Tracking] ──▶ [5 Diagramme] ──┐
                  │                └──▶ [6 Push-Notif.] ─────────────────────────────────────────┤
                  │                                                                              ▼
                  └──────────────────────────────────────────────────────────────────────── [7 Polish]
\`\`\`

### Optimaler Ausführungsplan

| Phase | Aufgaben (parallel)          | Dauer   |
|-------|------------------------------|---------|
| 1     | Architektur                  | 2 Std   |
| 2     | Auth                         | 2 Std   |
| 3     | Trainingspläne + Push (par.) | 2 Std   |
| 4     | Workout-Tracking             | 2 Std   |
| 5     | Diagramme                    | 2 Std   |
| 6     | UI-Polish & Testing          | 2 Std   |

### Gesamtschätzung
- **Sequenziell**: ~13,5 Stunden
- **Parallel (optimal)**: ~10 Stunden`,


"Online-Kurs erstellen": `## Projekt-Zerlegung: Online-Kurs "KI im Marketing"

### Teilaufgabe 1: Kursstruktur & Lernziele definieren
- **Input**: Thema "KI im Marketing", Zielgruppe, 8 Wochen Rahmen
- **Output**: Detaillierter Lehrplan mit 16 Lektionen, Lernziele pro Woche, Voraussetzungen
- **Abhängigkeiten**: Keine
- **Acceptance Criteria**: 16 Lektionen mit Titel und Lernzielen, logische Progression, Zeitplanung realistisch
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 2: Video-Skripte schreiben (Woche 1-4)
- **Input**: Lehrplan (Woche 1-4)
- **Output**: 8 ausformulierte Video-Skripte mit Sprechertext, Folienhinweisen, Zeitstempeln
- **Abhängigkeiten**: Teilaufgabe 1
- **Acceptance Criteria**: Jedes Skript 10-15 Min, fachlich korrekt, didaktisch aufbereitet
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 3: Video-Skripte schreiben (Woche 5-8)
- **Input**: Lehrplan (Woche 5-8)
- **Output**: 8 ausformulierte Video-Skripte
- **Abhängigkeiten**: Teilaufgabe 1
- **Acceptance Criteria**: Jedes Skript 10-15 Min, baut auf Woche 1-4 auf
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 4: Übungsaufgaben & Quizze erstellen
- **Input**: Lernziele pro Lektion
- **Output**: 16 Übungsaufgaben (eine pro Lektion), 4 Wissens-Quizze (eines pro 2 Wochen)
- **Abhängigkeiten**: Teilaufgabe 1
- **Acceptance Criteria**: Aufgaben prüfen Lernziele ab, Quizze mit Auswertung, Musterlösungen vorhanden
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 5: Präsentationsfolien erstellen
- **Input**: Video-Skripte
- **Output**: 16 Foliensätze (je 15-25 Folien) im einheitlichen Design
- **Abhängigkeiten**: Teilaufgabe 2, Teilaufgabe 3
- **Acceptance Criteria**: Folien visuell konsistent, Kernaussagen hervorgehoben, keine Textwände
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 6: Zertifikatsvorlage & Abschlusskriterien
- **Input**: Kursname, Anforderungen für Abschluss
- **Output**: PDF-Zertifikatsvorlage (personalisierbar), Bewertungsmatrix
- **Abhängigkeiten**: Teilaufgabe 1
- **Acceptance Criteria**: Zertifikat professionell gestaltet, Name/Datum dynamisch, Kriterien dokumentiert
- **Geschätzte Dauer**: 1 Stunde

### Teilaufgabe 7: Landing Page erstellen
- **Input**: Kursdetails, Preismodell, Testimonials
- **Output**: Conversion-optimierte Landing Page mit Modulübersicht, Preistabelle, FAQ, CTA
- **Abhängigkeiten**: Teilaufgabe 1
- **Acceptance Criteria**: Mobile-responsive, Ladezeit < 3s, CTA above the fold, SEO-optimiert
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 8: Kursplattform-Setup & Upload
- **Input**: Alle Materialien (Videos, Folien, Quizze)
- **Output**: Kurs auf Plattform (Teachable/Thinkific) eingerichtet, Drip-Content konfiguriert
- **Abhängigkeiten**: Teilaufgabe 4, Teilaufgabe 5, Teilaufgabe 6
- **Acceptance Criteria**: Alle 16 Lektionen hochgeladen, Quizze funktionieren, Zertifikat wird ausgestellt
- **Geschätzte Dauer**: 1,5 Stunden

---

### Dependency-Graph

\`\`\`
                  ┌──▶ [2 Skripte 1-4] ──┐
[1 Struktur] ──┬─┤                       ├──▶ [5 Folien] ──┐
               │  └──▶ [3 Skripte 5-8] ──┘                 │
               ├──▶ [4 Übungen/Quizze] ─────────────────────┤
               ├──▶ [6 Zertifikat] ─────────────────────────┼──▶ [8 Upload]
               └──▶ [7 Landing Page]                        │
\`\`\`

### Optimaler Ausführungsplan

| Phase | Aufgaben (parallel)                       | Dauer   |
|-------|-------------------------------------------|---------|
| 1     | Kursstruktur                              | 2 Std   |
| 2     | Skripte 1-4 + Skripte 5-8 + Übungen + Zertifikat + Landing (parallel) | 2 Std   |
| 3     | Folien                                    | 2 Std   |
| 4     | Plattform-Upload                          | 1,5 Std |

### Gesamtschätzung
- **Sequenziell**: ~14,5 Stunden
- **Parallel (optimal)**: ~7,5 Stunden`,


"Daten-Pipeline": `## Projekt-Zerlegung: Automatisierte Daten-Pipeline

### Teilaufgabe 1: Datenquellen-Analyse & Schema-Design
- **Input**: 3 CSV-Quellen (Formate, Lieferwege, Häufigkeit)
- **Output**: Dokumentierte Schemata pro Quelle, Ziel-Schema in PostgreSQL, Mapping-Regeln
- **Abhängigkeiten**: Keine
- **Acceptance Criteria**: Alle 3 Quellformate dokumentiert, Ziel-Tabellen definiert, Datentypen festgelegt
- **Geschätzte Dauer**: 1,5 Stunden

### Teilaufgabe 2: PostgreSQL-Datenbank einrichten
- **Input**: Ziel-Schema, Hosting-Entscheidung
- **Output**: Datenbank erstellt, Tabellen angelegt, Indizes, Benutzer/Rollen konfiguriert
- **Abhängigkeiten**: Teilaufgabe 1
- **Acceptance Criteria**: Datenbank erreichbar, Schema migriert, Backup-Strategie dokumentiert
- **Geschätzte Dauer**: 1 Stunde

### Teilaufgabe 3: CSV-Import & Datenbereinigung
- **Input**: 3 CSV-Quellen, Mapping-Regeln
- **Output**: Python/Pandas-Skript das CSVs einliest, validiert, bereinigt (Duplikate, Nullwerte, Formate)
- **Abhängigkeiten**: Teilaufgabe 1
- **Acceptance Criteria**: Alle 3 Quellen verarbeitbar, Fehlerhafte Zeilen geloggt, Bereinigungsregeln konfigurierbar
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 4: Datenbank-Loader (ETL)
- **Input**: Bereinigte Daten, Ziel-Schema
- **Output**: Skript das bereinigte Daten in PostgreSQL lädt (Upsert-Logik, Transaktionen)
- **Abhängigkeiten**: Teilaufgabe 2, Teilaufgabe 3
- **Acceptance Criteria**: Daten korrekt in DB, Duplikate via Upsert behandelt, Rollback bei Fehler
- **Geschätzte Dauer**: 1,5 Stunden

### Teilaufgabe 5: Report-Generierung (PDF)
- **Input**: Daten aus PostgreSQL, Report-Template
- **Output**: Python-Skript das tägliche PDF-Reports generiert (Tabellen, Diagramme, Zusammenfassung)
- **Abhängigkeiten**: Teilaufgabe 4
- **Acceptance Criteria**: PDF enthält aktuelle Daten, Diagramme korrekt, Layout professionell
- **Geschätzte Dauer**: 2 Stunden

### Teilaufgabe 6: E-Mail-Versand automatisieren
- **Input**: Generierte PDFs, Empfängerliste
- **Output**: SMTP-Integration (oder SendGrid), E-Mail mit PDF-Anhang, Fehlerbenachrichtigung
- **Abhängigkeiten**: Teilaufgabe 5
- **Acceptance Criteria**: E-Mail kommt an, PDF korrekt angehängt, Fehler werden gemeldet
- **Geschätzte Dauer**: 1 Stunde

### Teilaufgabe 7: Scheduling & Orchestrierung
- **Input**: Alle Pipeline-Skripte
- **Output**: Cron-Job oder Airflow-DAG für tägliche Ausführung, Logging, Alerting
- **Abhängigkeiten**: Teilaufgabe 4, Teilaufgabe 5, Teilaufgabe 6
- **Acceptance Criteria**: Pipeline läuft täglich automatisch, Logs einsehbar, Alert bei Fehlern
- **Geschätzte Dauer**: 1,5 Stunden

---

### Dependency-Graph

\`\`\`
[1 Analyse] ──┬──▶ [2 DB-Setup] ──┐
              │                     ├──▶ [4 Loader] ──▶ [5 Reports] ──▶ [6 E-Mail] ──┐
              └──▶ [3 CSV-Import] ─┘                                                  ├──▶ [7 Scheduling]
                                                                                      │
\`\`\`

### Optimaler Ausführungsplan

| Phase | Aufgaben (parallel)           | Dauer   |
|-------|-------------------------------|---------|
| 1     | Datenquellen-Analyse          | 1,5 Std |
| 2     | DB-Setup + CSV-Import (par.)  | 2 Std   |
| 3     | Datenbank-Loader              | 1,5 Std |
| 4     | Report-Generierung            | 2 Std   |
| 5     | E-Mail-Versand                | 1 Std   |
| 6     | Scheduling                    | 1,5 Std |

### Gesamtschätzung
- **Sequenziell**: ~10,5 Stunden
- **Parallel (optimal)**: ~8 Stunden`,

};
