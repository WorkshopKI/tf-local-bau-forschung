# Home

**Zweck:** Startseite — Arbeitseinstieg: oben ein **Hero-Band**, darunter ein persönliches Dashboard aus konfigurierbaren **Widgets** (seit v2.227): eigene offene Förderanträge, Antragseingang, Notizen, KI-Status.

**UI-Elemente & Begriffe:**
- **Begrüßung:** „X offene Vorgänge …".
- **Hero-Band** (zwei flache Karten): „Weiter, wo du aufgehört hast" (jüngste Arbeit, „Weiter →") und „Braucht heute Aufmerksamkeit" (drei klickbare Chips: über 90-Tage-Frist / nähern sich / QS-Freigaben offen → gefilterte Liste).
- **Zwei Spalten mit Widgets:** jedes mit Kopfzeile (Chevron ein-/ausklappen; Stift „Widget anpassen" nur bei einstellbaren — Kanban und Antragseingang; Modus „Kürzel THU" vs. „Alle Bearbeiter"). Ein ziehbarer Griff verbreitert die Hauptspalte. Reihenfolge und Sichtbarkeit stehen in Einstellungen › Widgets.
- **Widgets** (read-only + Navigation):
  - **Meine Anträge:** Liste + Rückstands-Balken.
  - **Kanban:** Förderanträge ODER Feedback, farbige Lanes, 1–2 Spalten.
  - **Antragseingang-Ampel:** Schwellen einstellbar, Zeile → gefilterte Liste.
  - **AI-Assistent** und **Notizen** („nur lokal").
  - **Feedback-Neuigkeiten:** seit dem letzten „Alles gelesen" — Antworten aufs eigene Feedback, **Statuswechsel** an Tickets, an denen man beteiligt ist (eigenes, kommentiertes, mitgestimmtes oder gesponsertes), neue Team-Tickets, Stimmen-Zuwachs; Klick öffnet das Ticket im Feedback-Board.
  - **Auslastung:** Ich-/Team-Sicht; nur wo aktiv.
  - **QS-Freigaben offen:** Artefakt-Entwürfe → „Freigeben/Prüfen →"; gibt nie frei.
  - **Registry-Änderungen:** nur Kurator.
  - **Neue Anträge für dich:** Selbsteintragung; nur wo Auslastung aktiv.
  - **Weitermachen:** Opt-in — das Hero-Band ersetzt es im Default.
- **Programm-Übersichtskarten** unterhalb der Widgets.

**Typische Aktionen:**
- Über das Hero-Band weitermachen oder zu kritischen/QS-Punkten springen
- Widgets ein-/ausklappen, per Stift anpassen (Kanban-Lanes/Farben, Ampel-Schwellen)
- Auf Antrag-/Ampel-Zeile springen (→ gefilterte Liste), Kanban-Karte öffnen
- Notiz festhalten, KI verbinden, Selbsteintragung annehmen

## Technik

**Datenmodell dahinter:** Widget-Config gerätelokal (IDB-Key `home-widgets-config` v2, gespiegelt in PersonalEinstellungen, nie im Snapshot; v1→v2 blendet ein sichtbares „Weitermachen"-Widget aus); Inhalte aggregiert aus `useAntraegeStore` über `dashboardAggregate.ts`/`kanbanLanes.ts`; Profil (Bearbeiter-Kürzel), aktives Programm. Notizen nur in der IDB.

**Code:** `src/plugins/home/` — `HomePage.tsx`, `HomeHero.tsx` (Hero-Band), `widgets/` (Katalog, Config-Store, `WidgetShell`, `HomeWidgetStack`, Kanban/Notizen, `useQsFreigaben`, `WidgetQuickEdit`), `dashboardAggregate.ts`, `MeineAntraegeSection.tsx`/`EingangAmpelCard.tsx`/`AiAssistantCard.tsx`/`WeitermachenSection.tsx`.
