# Feedback

## Zweck

Öffentliche Übersicht aller gemeldeten Probleme, Ideen und Lob: Fortschritt verfolgen, per Stimme („Ich auch") Nachfrage zeigen, kommentieren und Ideen mit einem Punkte-Budget sponsern (priorisieren). Seit v2.364 **die einzige Feedback-Seite** — der frühere Menüpunkt „Kuration → Feedback" ist hier aufgegangen: Verwalten, Ergänzen und Löschen passieren direkt auf dieser Seite.

## UI-Elemente & Begriffe

- **Kopf:** Titel „Feedback", Zähler (Probleme/Ideen), Benachrichtigungs-Glocke (ungelesene Team-Antworten → springt zu „Von mir"), Budget-Badge „Budget Q3 · N/10 Pkt".
- **Filterzeile:** Scope-Segmente „Alle / Von mir / Vom Team", Suchfeld, Sortier-Dropdown (5 Ordnungen), Umschalter Board (Standard)/Liste, Dichte-Knopf (Komfort/Kompakt, gerätelokal gemerkt), Typ-Filter-Chips „Alle · Problem · Idee · Lob · Frage", Status-Filter (Liste), Checkbox **„Archivierte einblenden"** (Aufräum-Sicht). In „Von mir" zusätzlich eine „Dein Fortschritt"-Leiste.
- **Liste:** Karten mit Typ-Icon, Titel (+ „Antwort"-Marker bei neuer Team-Antwort, + blauer „+N"-Marker bei neuen Kommentaren), Vorschauzeile (kompakt: einzeilig), Status-Pill, Mini-Stepper (eigene), Bereich, Autor, Aufwand, Kommentare; rechts Sponsoring-Leiste „X/Y Pkt · N Sponsoren" (Ideen mit Aufwand) oder Vote-Pill + Screenshot-Thumbnail (Lightbox). Eigenes Feedback trägt einen Akzentstrich.
- **Board:** farbige Kanban-Spalten mit Status-Symbol (Neu · Abgelehnt · Geplant · In Bearbeitung · Umgesetzt); Lob hat keinen Workflow und erscheint nur in der Liste; leere Spalten klappen zusammen. Board-Karten: Typ-Farbkante + Typ-Label, oben rechts „Antwort"- und „+N"-Marker, Datum, Titel, optionales Vorschaubild, unten Autor („Du" bei eigenen) + Datei-/Kommentar-Zähler + Punkte bzw. Vote-Pill.
- **Kommentare beim Überfahren:** Wer mit der Maus auf dem Sprechblasen-Zähler einer Karte stehen bleibt, sieht die letzten vier Kommentare (Name, Datum, Text; lange Beiträge gekürzt, ältere als „+N ältere Kommentare" angedeutet) — ohne die Karte zu öffnen. Bei viel Text lässt sich die Vorschau scrollen; ein Klick öffnet weiterhin das Detail.
- **Neue Kommentare:** Tickets, an denen seit dem letzten Öffnen jemand anderes kommentiert hat, tragen ein blaues **„+N"** (Kopfzeile der Karte bzw. neben dem Titel), und der Sprechblasen-Zähler färbt sich blau. In der Vorschau und im Kommentar-Thread sind die neuen Beiträge blau hinterlegt und mit „neu" beschriftet. Der Marker verschwindet, sobald das Ticket geöffnet wurde. Eigene Kommentare zählen nicht mit; wer die App zum ersten Mal öffnet, bekommt keinen Schwall — gemerkt wird ab dem ersten Besuch, gerätelokal.
- **„Board anpassen"** (Regler-Knopf rechts neben dem Dichte-Knopf, nur in der Board-Ansicht): Popover mit einer Zeile je Lane — Häkchen blendet die Lane ein/aus, rechts ein 1/2-Schalter für die Kartenspalten innerhalb der Lane (zweispaltig = doppelt so breite Spur, halbiert das Scrollen bei vollen Lanes wie „Neu"); darunter „Farben der Köpfe" Bunt/Einfarbig.
  - Ausgeblendete Lanes zeigen ihre Tickets nicht im Board, wohl aber in der Liste (Hinweiszeile im Popover).
  - Die Einstellung gilt nur auf diesem Gerät und ist unabhängig vom Kanban-Widget der Startseite.
- **Detail-Panel rechts** (Klick auf eine Karte): voller Stepper, alle Antworten, Downloads, „Antwort vom Team" (ungelesen rot + „Neu"), Sponsoring-Panel (X/Y Pkt, +/−, Budget-Hinweis), Kommentar-Thread + Vote.
  - Das Kommentar-Eingabefeld ist drei Zeilen hoch und wächst beim Schreiben mit (Return macht eine neue Zeile, gesendet wird über den Pfeil-Knopf). Am Anfasser unten rechts lässt es sich größer ziehen; diese Höhe gilt dann als Mindesthöhe und bleibt auf diesem Gerät erhalten.
- **Feedback geben** liegt auf dem globalen Button unten rechts (optionaler Titel + Datei-Anhänge).

## Eigenes Feedback ergänzen

- Beim eigenen Ticket steht neben dem Titel **„Ergänzen"** (Stift). Damit lassen sich Titel und die Antwortfelder nachträglich überarbeiten und weitere Screenshots oder Dateien anhängen — gedacht für **ein** Ticket je Themenkomplex, das man fortschreibt, statt für jede Präzisierung ein neues aufzumachen.
- Unter dem Autor steht dann „bearbeitet <Datum>". Der Diskussionsverlauf bleibt der Kommentar-Thread.
- Wer nur Leserechte auf dem Datenspeicher hat, sieht „Ergänzen" nicht und schreibt seine Ergänzung als Kommentar.

## Verwalten (nur mit Schreibrecht — PL, Kurator, Entwicklung)

- Am geöffneten Ticket ein ausklappbarer Abschnitt **„Verwaltung"**: Status, Kategorie, Priorität, Aufwand, interne Notizen, öffentliche Antwort („für alle auf dem Board sichtbar"), FAQ-Markierung mit Antwort und Stichwörtern, „Claude Code Prompt" (kopieren / .md-Export) und — wo freigeschaltet — „Löschen" mit Rückfrage.
- Bei Ideen mit Aufwand steht darüber der Sponsoring-Fortschritt samt Hinweis „Schwelle erreicht".
- Im Seitenkopf ein **Zahnrad** → Dialog „Feedback-Verwaltung" mit vier Reitern: **Inbox** (Feedback der Nutzer ohne Schreibrecht einsammeln, einmaliger Ordner-Connect), **FAQ**, **Sponsoring** (Ranking, Schwellen, Budget), **Einstellungen** (Modell, System-Prompt, Status der geteilten Datei).

## Typische Aktionen

- Filtern, sortieren, Ansicht/Dichte wechseln, Board-Lanes und deren Kartenspalten anpassen
- Fortschritt/Antworten verfolgen, stimmen, kommentieren, Idee sponsern
- Detail öffnen, eigenes Feedback ergänzen, neues Feedback melden
- Mit Schreibrecht zusätzlich: Status/Antwort/Aufwand setzen, als FAQ markieren, löschen, Nutzer-Feedback einsammeln, Sponsoring-Schwellen pflegen

## Technik

**Datenmodell dahinter:** `FeedbackItem` (title, category, kurator_status, context.page, effort_estimate, votes[], comments[], sponsors[], kurator_response, updated_at); Titel notfalls aus der Hauptantwort abgeleitet; Votes/Kommentare team-geteilt (Merge + Outbox), getrennt vom Sponsoring. Stepper aus `kurator_status` abgeleitet (kein Verlauf); Ungelesen-Status gerätelokal.

**Code:** `plugins/feedback-board/FeedbackBoardPage.tsx` + `boardFilter.ts` (Filter/Sortierung) + `verwaltung/` (Dialog, Inbox/FAQ/Sponsoring/Einstellungen, `useAutoCollectFeedback`); Komponenten `components/feedback/` (`FeedbackCard`, `FeedbackKanban`, `FeedbackBoardDetail`, `FeedbackVerwaltungBlock`, `FeedbackErgaenzenForm`, Stepper/SponsorBar/VotePill u.a.); Service `core/services/feedback/`; Rechte-Gate `canManageFeedback` in `config/feature-flags.ts`.
