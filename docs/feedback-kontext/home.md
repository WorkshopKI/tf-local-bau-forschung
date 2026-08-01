# Home

## Zweck

Startseite — Arbeitseinstieg: oben ein **Hero-Band**, darunter ein persönliches Dashboard aus konfigurierbaren **Widgets** (seit v2.227): eigene offene Förderanträge, Antragseingang, Notizen, KI-Status.

## UI-Elemente & Begriffe

- **Begrüßung:** „X offene Vorgänge …".
- **Hero-Band** (zwei flache Karten): „Weiter, wo du aufgehört hast" (jüngste Arbeit, „Weiter →") und „Braucht heute Aufmerksamkeit" (klickbare Chips: älter als 90 Tage / zwischen 31 und 90 Tagen → gefilterte Liste, QS-Freigaben offen → erster offener Entwurf). Die Tage-Grenzen kommen aus der Widget-Config; Chips mit Zähler 0 werden nicht gezeigt, ohne Chip entfällt die Karte.
- **Zwei Spalten mit Widgets:** jedes mit Kopfzeile (Chevron ein-/ausklappen; Stift „Widget anpassen" nur bei einstellbaren — Kanban und Antragseingang; Modus „Kürzel THU" vs. „Alle Bearbeiter"). Ein ziehbarer Griff verbreitert die Hauptspalte. Reihenfolge und Sichtbarkeit stehen in Einstellungen › Widgets.
- **Widgets** (read-only + Navigation):
  - **Meine Anträge:** Liste + Rückstands-Balken.
  - **Kanban:** Förderanträge ODER Feedback, farbige Lanes, 1–2 Spalten.
  - **Antragseingang-Ampel:** Schwellen einstellbar, Zeile → gefilterte Liste.
  - **KI-Assistent** und **Notizen** („nur lokal").
  - **Feedback-Neuigkeiten:** seit dem letzten „Alles gelesen" — Antworten aufs eigene Feedback, **Statuswechsel** an Tickets, an denen man beteiligt ist (eigenes, kommentiertes, mitgestimmtes oder gesponsertes), neue Team-Tickets, Stimmen-Zuwachs; Klick öffnet das Ticket im Feedback-Board.
  - **Auslastung:** Ich-/Team-Sicht; nur wo aktiv.
  - **QS-Freigaben offen:** Artefakt-Entwürfe → „Freigeben/Prüfen →"; gibt nie frei.
  - **Registry-Änderungen:** nur Kurator.
  - **Neue Anträge für dich:** Selbsteintragung; nur wo Auslastung aktiv.
  - **Weitermachen:** Opt-in — das Hero-Band ersetzt es im Default.
  - **Hängt fest:** Opt-in — eigene Vorgänge, an denen seit länger als den Zieltagen ihres Status nichts passiert ist, der längste zuerst; wo ein Kürzel-Paar halb offen ist, steht die hängende Rolle daneben. Vorgänge ohne gepflegte Zieltage zählt es als „nicht bewertbar" mit, statt sie als unauffällig zu führen.
- **Programm-Übersichtskarten** unterhalb der Widgets.

## Typische Aktionen

- Über das Hero-Band weitermachen oder zu kritischen/QS-Punkten springen
- Widgets ein-/ausklappen, per Stift anpassen (Kanban-Lanes/Farben, Ampel-Schwellen)
- Auf Antrag-/Ampel-Zeile springen (→ gefilterte Liste), Kanban-Karte öffnen
- Notiz festhalten, KI verbinden, Selbsteintragung annehmen

## Technik

**Datenmodell dahinter:** Widget-Config gerätelokal (IDB-Key `home-widgets-config` v2, gespiegelt in PersonalEinstellungen, nie im Snapshot; v1→v2 blendet ein sichtbares „Weitermachen"-Widget aus); Inhalte aggregiert aus `useAntraegeStore` über `dashboardAggregate.ts`/`kanbanLanes.ts`; Profil (Bearbeiter-Kürzel), aktives Programm. Notizen nur in der IDB.

**Code:** `src/plugins/home/` — `HomePage.tsx`, `HomeHero.tsx` (Hero-Band), `widgets/` (Katalog, Config-Store, `WidgetShell`, `HomeWidgetStack`, Kanban/Notizen, `useQsFreigaben`, `WidgetQuickEdit`), `dashboardAggregate.ts`, `MeineAntraegeSection.tsx`/`EingangAmpelCard.tsx`/`AiAssistantCard.tsx`/`WeitermachenSection.tsx`.
