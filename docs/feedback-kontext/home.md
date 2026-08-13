# Home

## Zweck

Startseite — Arbeitseinstieg: oben ein **Hero-Band**, darunter ein persönliches Dashboard aus konfigurierbaren **Widgets** (seit v2.227): eigene offene Förderanträge, Antragseingang, Notizen, KI-Status.

## UI-Elemente & Begriffe

- **Begrüßung:** „X offene Vorgänge …".
- **Hero-Band** (zwei flache Karten): „Weiter, wo du aufgehört hast" (jüngste Arbeit, „Weiter →") und „Braucht heute Aufmerksamkeit" (klickbare Chips: älter als 90 Tage / zwischen 31 und 90 Tagen → gefilterte Liste, QS-Freigaben offen → erster offener Entwurf). Die Tage-Grenzen kommen aus der Widget-Config; Chips mit Zähler 0 werden nicht gezeigt, ohne Chip entfällt die Karte.
- **Zwei Spalten mit Widgets:** jedes mit Kopfzeile (Chevron ein-/ausklappen; `⋯`-Menü beim Überfahren; Modus „Kürzel THU" vs. „Alle Bearbeiter"). Ein ziehbarer Griff verbreitert die Hauptspalte. Jede Spalte endet mit „Widget hinzufügen"; eine leergeräumte Spalte sagt das und bleibt bedienbar.
- **Startseite anpassen** (seit v4.7): Konfiguration direkt auf der Seite statt über die Einstellungen.
  - **Menü der freien Fläche** (Rechtsklick, oder Knopf „Startseite anpassen" oben rechts): „Widgets ▸" (Checkliste beider Spalten mit Reihenfolge-Pfeilen und „alle"-Schalter), „Darstellung ▸" (Primärfarbe, Hell/Dunkel), „Alles ein-/aufklappen", „Startseite zurücksetzen", „Alle Einstellungen öffnen".
  - **Menü eines Widgets** (Rechtsklick auf die Karte, oder `⋯` im Kopf): Ausblenden, Ein-/Aufklappen, Nach oben/unten mit Positionsanzeige „2 / 5", Widget-Einstellungen.
  - **Rückmeldung:** Das Menü bleibt beim Häkchensetzen offen. Ausblenden und Zurücksetzen bestätigen sich unten mit **Rückgängig**. In Textfeldern und bei markiertem Text bleibt das Browser-Menü.
- **Widgets** (read-only + Navigation):
  - **Meine Anträge:** Liste + Rückstands-Balken.
  - **Kanban:** Förderanträge ODER Feedback, farbige Lanes, 1–3 Kartenspalten je Lane (eine Lane mit mehr Spalten wird entsprechend breiter, die übrigen rücken zusammen). Jede Bahn lässt sich über ihre Kopfzeile zu einer schmalen Schiene einklappen und dort wieder aufklappen; der Zustand gilt nur für die laufende Ansicht.
  - **Kanban im eigenen Fenster:** Das Zeichen rechts neben dem `⋯` öffnet die Anträge in einem großen eigenen Fenster — ohne Kappung, lange Bahnen mit Scrollbalken. Beim ersten Öffnen stehen dort **alle** Status-Kategorien (auch die im Widget nicht eingestellten), volle Bahnen zweispaltig. Ein Klick auf eine Karte öffnet den Antrag in der App. Verlässt man die Startseite, sagt das Fenster, dass sein Stand einfriert.
  - **Im Fenster einrichten:** Das Zahnrad im Fensterkopf stellt die Bahnen **dieses Fensters** ein — welche zu sehen sind, in welcher Reihenfolge und mit wie vielen Kartenspalten (1–3). Die Startseite behält ihre eigene Auswahl; Farben und Datenbasis gelten für beide. Angehakte Bahnen ohne Karten stehen als schmale Schiene da, abgewählte fehlen ganz. „Anordnung zurücksetzen" stellt den Vorschlag wieder her. Eingeklappte Bahnen und die Anordnung überleben das Schließen des Fensters.
  - **Antragseingang-Ampel:** Schwellen einstellbar, Zeile → gefilterte Liste.
  - **KI-Assistent** und **Notizen** („nur lokal").
  - **Feedback-Neuigkeiten:** seit dem letzten „Alles gelesen" — Antworten aufs eigene Feedback, **Statuswechsel** an Tickets, an denen man beteiligt ist (eigenes, kommentiertes, mitgestimmtes oder gesponsertes), neue Team-Tickets, Stimmen-Zuwachs; Klick öffnet das Ticket im Feedback-Board.
  - **Auslastung:** Ich-/Team-Sicht; nur wo aktiv.
  - **QS-Freigaben offen:** Artefakt-Entwürfe → „Freigeben/Prüfen →"; gibt nie frei.
  - **Registry-Änderungen:** nur Kurator.
  - **Neue Anträge für dich:** Selbsteintragung; nur wo Auslastung aktiv.
  - **Weitermachen:** Opt-in — das Hero-Band ersetzt es im Default.
  - **Änderungen der letzten Nacht:** Opt-in — was der jüngste Export gebracht hat, gruppiert nach Feld mit Anzahl und Beispiel-Aktenzeichen. Bewusst **ohne Bearbeiter-Bezug**: das Journal hält fest, was sich geändert hat, nicht wer es war. Der Nullpunkt der Historie steht dabei; solange kein Journal geführt wird, sagt das Widget das statt eine leere Liste zu zeigen.
  - **Hängt fest:** Opt-in — eigene Vorgänge, an denen seit länger als den Zieltagen ihres Status nichts passiert ist, der längste zuerst; wo ein Kürzel-Paar halb offen ist, steht die hängende Rolle daneben. Vorgänge ohne gepflegte Zieltage zählt es als „nicht bewertbar" mit, statt sie als unauffällig zu führen.
- **Programm-Übersichtskarten** unterhalb der Widgets.

## Typische Aktionen

- Über das Hero-Band weitermachen oder zu kritischen/QS-Punkten springen
- Widgets ein-/ausblenden, sortieren, ein-/ausklappen und anpassen (Kanban-Lanes/Farben, Ampel-Schwellen) — per Rechtsklick, `⋯` oder Kopfzeilen-Knopf
- Auf Antrag-/Ampel-Zeile springen (→ gefilterte Liste), Kanban-Karte öffnen
- Kanban-Bahn ein-/ausklappen; Kanban im eigenen Fenster öffnen und dort einrichten
- Notiz festhalten, KI verbinden, Selbsteintragung annehmen

## Technik

**Datenmodell dahinter:** Widget-Config gerätelokal (IDB-Key `home-widgets-config` v2, gespiegelt in PersonalEinstellungen, nie im Snapshot; v1→v2 blendet ein sichtbares „Weitermachen"-Widget aus); Inhalte aggregiert aus `useAntraegeStore` über `dashboardAggregate.ts`/`kanbanLanes.ts`; Profil (Bearbeiter-Kürzel), aktives Programm. Notizen nur in der IDB.

**Code:** `src/plugins/home/` — `HomePage.tsx`, `HomeHero.tsx` (Hero-Band), `widgets/` (Katalog, Config-Store, `WidgetShell`, `HomeWidgetStack`, Kanban/Notizen, `useQsFreigaben`), `anpassen/` (Startseiten-Menü, Untermenüs, Rückgängig-Leiste), `dashboardAggregate.ts`, `MeineAntraegeSection.tsx`/`EingangAmpelCard.tsx`/`AiAssistantCard.tsx`/`WeitermachenSection.tsx`.
