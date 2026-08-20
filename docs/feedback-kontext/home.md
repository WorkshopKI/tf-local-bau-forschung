# Home

## Zweck

Startseite — Arbeitseinstieg: oben ein **Hero-Band**, darunter ein persönliches Dashboard aus konfigurierbaren **Widgets** (seit v2.227): eigene offene Förderanträge, Antragseingang, Notizen, KI-Status.

## UI-Elemente & Begriffe

- **Begrüßung:** „X offene Vorgänge …".
- **Bearbeiter-Sicht als Chip neben der Begrüßung** („Kürzel THü" / „Alle Bearbeiter", gleiche Stelle wie im Förderanträge-Kopf; das Kürzel steht so da, wie es in den Daten geschrieben ist). Das Umschalten wirkt auf **alle** Widgets zugleich — Meine Anträge, Kanban, Antragseingang, Fristen, Änderungen der letzten Nacht — und gilt seitenübergreifend auch für die Förderanträge-Liste. Ausgenommen ist „Meine Entwürfe in dieser App": die Entwürfe liegen auf diesem Gerät und gehören ihrem Verfasser, nicht dem Kürzel am Vorgang.
  - Ein Klick öffnet die zwei Optionen; eine Zeile nennt Reichweite und Gerätebindung, darunter führt „Kürzel ändern" in die Einstellungen und springt dort die Karte „Welche Anträge du siehst" an — sie bleibt umrandet, bis Sie das nächste Mal klicken.
  - Der **Betrachtungsbereich** wirkt auf die Startseiten-Zahlen ebenfalls, hat hier aber bewusst keinen Chip: gewechselt wird er im Förderanträge-Kopf.
- **Hero-Band** (zwei flache Karten): „Weiter, wo du aufgehört hast" (jüngste Arbeit, „Weiter →") und „Braucht heute Aufmerksamkeit" (klickbare Chips: älter als 90 Tage / zwischen 31 und 90 Tagen → gefilterte Liste, eigene Entwürfe offen → erster offener Entwurf). Die Tage-Grenzen kommen aus der Widget-Config; Chips mit Zähler 0 werden nicht gezeigt, ohne Chip entfällt die Karte. Beide Karten haben beim Überfahren ein `⋯` mit ihren eigenen Einstellungen (s. u.).
- **Zwei Spalten mit Widgets:** jedes mit Kopfzeile (Chevron ein-/ausklappen; `⋯`-Menü beim Überfahren; Modus „Kürzel THu" vs. „Alle Bearbeiter"). Ein ziehbarer Griff verbreitert die Hauptspalte. Jede Spalte endet mit „Widget hinzufügen"; eine leergeräumte Spalte sagt das und bleibt bedienbar.
- **Startseite anpassen** (seit v4.7): Konfiguration direkt auf der Seite statt über die Einstellungen.
  - **Menü der freien Fläche** (Rechtsklick, oder Knopf „Startseite anpassen" oben rechts): „Widgets ▸" (Checkliste mit den zwei Karten unter „Oben" und beiden Spalten samt Reihenfolge-Pfeilen und „alle"-Schalter), „Darstellung ▸" (Primärfarbe, Hell/Dunkel), „Alles ein-/aufklappen", „Startseite zurücksetzen", „Alle Einstellungen öffnen".
  - **Menü einer Karte** (`⋯` im Kopf, sichtbar beim Überfahren): beim Widget Ausblenden, Ein-/Aufklappen, Nach oben/unten mit Positionsanzeige „2 / 5", Widget-Einstellungen. Bei „Weiter, wo du aufgehört hast" Ausblenden + „Arbeitsverlauf löschen"; bei „Braucht heute Aufmerksamkeit" Ausblenden, die drei Kacheln zum Abwählen und „Fristen-Schwellen ändern …". Nur was diese Karte betrifft — die seitenweiten Punkte stehen allein im Menü der freien Fläche.
  - **Rückmeldung:** Das Menü bleibt beim Häkchensetzen offen. Ausblenden und Zurücksetzen bestätigen sich unten mit **Rückgängig** — es nimmt genau das zurück, was in der Meldung steht, und lässt alles unberührt, was Sie danach geändert haben. Die Meldung verschwindet nach ein paar Sekunden und kommt nicht wieder, wenn Sie die Startseite zwischendurch verlassen. Eine ausgeblendete Karte kommt über „Widgets ▸" zurück; wird die letzte Kachel abgewählt, gilt die Aufmerksamkeits-Karte dort als aus und bringt ihre Kacheln beim Wiedereinschalten mit.
- **Rechtsklick in der ganzen App:** Er zeigt nur noch etwas, wo er etwas kann — das Menü der App auf der freien Startseiten-Fläche, sonst das Browser-Menü nur in Textfeldern (Einfügen), bei markiertem Text (Kopieren) und mit gedrückter Umschalt-Taste.
- **Widgets** (read-only + Navigation):
  - **Meine Anträge:** Liste + Rückstands-Balken. Sortiert nach Frist, und zwar nach derselben Rechnung wie die Förderanträge-Liste: Vorgänge, bei denen in ihrem Verfahrensschritt keine Frist mehr läuft (etwa nach einer Ablehnung), gelten nicht als überfällig und stehen am Ende. Ein Verbund ist eine Zeile und trägt die Marke „2 TV"; der Zähler sagt beim Überfahren, wie viele Teilvorhaben das in der Liste sind.
  - **Die Aufgabe je Zeile kommt aus derselben Regel-Kaskade wie das Vorgangs-Board** (seit v4.132) — mit der Adresse daneben: „in QS · wartet auf QS", „RNE ergänzen · liegt bei AB", „Abl abwarten · wartet auf Antragsteller". Betrifft sie nur einen Teil eines Verbundes, steht „3 von 4 TV" dabei. Solange gerechnet wird, steht „…"; sagt die Kaskade nichts, steht dort die frühere Ableitung aus dem Status. Dieselbe Aussage tragen die Kanban-Karten.
  - **Laut Kürzeln erledigt:** trägt ein Vorgang einen Schlussvermerk, obwohl sein Status noch offen sagt, zählt er nicht mehr als offen, steht am Ende der Liste („Keine Aufgabe mehr" + der Grund) und wird über der Liste beziffert — ein Befund für das Fachsystem, kein Anzeigefehler.
  - **Kanban:** Förderanträge ODER Feedback, farbige Lanes, 1–3 Kartenspalten je Lane (eine Lane mit mehr Spalten wird entsprechend breiter, die übrigen rücken zusammen). Jede Bahn lässt sich über ihre Kopfzeile zu einer schmalen Schiene einklappen und dort wieder aufklappen; der Zustand gilt nur für die laufende Ansicht. „+ N weitere" öffnet die Liste auf genau diese Bahn gefiltert — mit einem Chip, der sie benennt und wieder löst.
    - **Eine Karte ist ein Verbund** — das steht in der Kopfzeile, weil dieselbe Seite an anderer Stelle Teilvorhaben zählt. Die Zahl im Kopf zählt die eingerichteten Bahnen und sagt daneben, wie viele Vorgänge in Kategorien ohne Bahn liegen; der Tooltip nennt diese Kategorien beim Namen.
  - **Kanban im eigenen Fenster:** Das Zeichen rechts neben dem `⋯` öffnet die Anträge in einem großen eigenen Fenster — ohne Kappung, lange Bahnen mit Scrollbalken. Beim ersten Öffnen stehen dort **alle** Status-Kategorien (auch die im Widget nicht eingestellten), volle Bahnen zweispaltig. Ein Klick auf eine Karte öffnet den Antrag in der App. Verlässt man die Startseite, sagt das Fenster, dass sein Stand einfriert.
  - **Im Fenster einrichten:** Das Zahnrad im Fensterkopf stellt die Bahnen **dieses Fensters** ein — welche zu sehen sind, in welcher Reihenfolge und mit wie vielen Kartenspalten (1–3). Die Startseite behält ihre eigene Auswahl; Farben und Datenbasis gelten für beide. Angehakte Bahnen ohne Karten stehen als schmale Schiene da, abgewählte fehlen ganz. „Anordnung zurücksetzen" stellt den Vorschlag wieder her. Eingeklappte Bahnen und die Anordnung überleben das Schließen des Fensters.
  - **Antragseingang-Ampel:** Schwellen einstellbar, Zeile → gefilterte Liste.
  - **KI-Assistent** und **Notizen** („nur lokal").
  - **Feedback-Neuigkeiten:** seit dem letzten „Alles gelesen" — Antworten aufs eigene Feedback, **Statuswechsel** an Tickets, an denen man beteiligt ist (eigenes, kommentiertes, mitgestimmtes oder gesponsertes), neue Team-Tickets, Stimmen-Zuwachs; Klick öffnet das Ticket im Feedback-Board.
  - **Auslastung:** Ich-/Team-Sicht; nur wo aktiv.
  - **Meine Entwürfe in dieser App:** Artefakt-Entwürfe, die auf **diesem Gerät** entstanden und noch nicht freigegeben sind → „Freigeben/Prüfen →"; gibt nie frei. Ausdrücklich **nicht** die fachliche QS des Fachsystems — die steht in den Kürzeln und wird von „Meine Anträge" und dem Vorgangs-Board gesagt; der leere Zustand sagt das. Kein Bearbeiter-Filter: was hier liegt, hat der Nutzer selbst erzeugt, auch wenn der Vorgang das Kürzel eines anderen trägt.
  - **Zuletzt geändert:** nur Kurator — die jüngsten Änderungen an Skills und Qualitätsregeln; ein Klick öffnet genau diesen Eintrag in der Skill-Verwaltung, die dann „← Zurück zu Home" anbietet. In der Widget-Liste heißt der Eintrag „Zuletzt geändert: Skills & Regeln". Hieß bis v4.133 „Registry-Änderungen".
  - **Neue Anträge für dich:** Selbsteintragung; nur wo Auslastung aktiv.
  - **Weitermachen:** Opt-in — das Hero-Band ersetzt es im Default.
  - **Änderungen der letzten Nacht:** Opt-in, steht unten in seiner Spalte — was der jüngste Export an **Ihren** Vorgängen geändert hat: eine Zeile je Antrag mit Akronym, Anzahl und den geänderten Feldern; darunter, wie viele Änderungen Vorgänge außerhalb Ihres Ausschnitts betrafen. Der Ausschnitt ist derselbe wie überall (Chip im Seitenkopf). **Keine Zeile sagt, WER etwas gesetzt hat** — das Journal hält fest, was sich geändert hat, nicht wer es war.
    - Ein `~` hinter einer Zeile heißt: zwischen zwei Exporten lag mehr als ein Tag, die Änderung ist nur als Zeitraum belegt.
    - Hat der jüngste Export gar nichts geändert (das kommt regelmäßig vor), zeigt die Karte den **letzten Lauf mit Änderungen** und sagt in derselben Zeile, dass sie das tut. Der Nullpunkt der Historie steht dabei; solange kein Journal geführt wird, sagt das Widget das statt eine leere Liste zu zeigen.
  - **Fristen:** Opt-in — eine Liste für beide Arten von „zu spät", am weitesten über der Frist zuerst. Vorher standen dafür zwei Widgets nebeneinander („Hängt fest" und „Meilensteine diese Woche"), und keines sagte, aus welchem System seine Warnung kam.
    - Jede Zeile trägt ihre **Herkunft**: entweder `Zieltag` — an dem Vorgang ist seit länger als den Zieltagen seines Status nichts passiert — oder die **Nummer eines Meilensteins**, dessen Soll-Termin überschritten oder in den nächsten sieben Tagen fällig ist.
    - Rot heißt gerissen, gelb steht bevor. Rechts steht der Abstand in Tagen, in derselben Richtung für beide Arten.
    - **Beide Quellen kommen in der Liste vor.** Nach Abstand sortiert verdrängen die zahlreicheren Meilensteine sonst jeden Zieltag aus den sichtbaren Zeilen, während die Kopfzeile ihn zählt — jede vorhandene Quelle bekommt deshalb einige Plätze reserviert.
    - Vorgänge ohne gepflegte Zieltage zählt es als „nicht bewertbar" mit, statt sie als unauffällig zu führen. Ist nur eines der beiden Systeme freigeschaltet, sagt eine Zeile darunter, dass die Liste nur eine Hälfte zeigt.
    - **Meilensteine ohne Bedingung werden nicht bewertet** und stehen als Zahl in derselben Fußzeile. Ein Meilenstein, der weder eine eigene Bedingung noch Unter-Meilensteine hat, kann nie erfüllt werden — er galt früher ab seiner Soll-Woche für immer als überfällig. Im Modul „Fristen & Meilensteine" trägt so eine Zeile die Marke „ohne Bedingung".
- **Programm-Übersichtskarten** unterhalb der Widgets.

## Typische Aktionen

- Über das Hero-Band weitermachen oder zu kritischen/QS-Punkten springen
- Widgets ein-/ausblenden, sortieren, ein-/ausklappen und anpassen (Kanban-Lanes/Farben, Ampel-Schwellen) — per Rechtsklick auf die freie Fläche, `⋯` im Kopf einer Karte oder Kopfzeilen-Knopf
- Die zwei oberen Karten ausblenden, Kacheln abwählen, Arbeitsverlauf löschen — über ihr `⋯`
- Auf Antrag-/Ampel-Zeile springen (→ gefilterte Liste), Kanban-Karte öffnen
- Kanban-Bahn ein-/ausklappen; Kanban im eigenen Fenster öffnen und dort einrichten
- Notiz festhalten, KI verbinden, Selbsteintragung annehmen

## Technik

**Datenmodell dahinter:** Widget-Config gerätelokal (IDB-Key `home-widgets-config` v2, gespiegelt in PersonalEinstellungen, nie im Snapshot; v1→v2 blendet ein sichtbares „Weitermachen"-Widget aus; das Feld `hero` für die zwei oberen Karten kam additiv dazu — fehlt es, ist alles an); Inhalte aggregiert aus `useAntraegeStore` über `dashboardAggregate.ts`/`kanbanLanes.ts`; Profil (Bearbeiter-Kürzel), aktives Programm. Notizen nur in der IDB.

**Code:** `src/plugins/home/` — `HomePage.tsx`, `HomeHero.tsx` (Hero-Band), `widgets/` (Katalog, Config-Store, `WidgetShell`, `HomeWidgetStack`, Kanban/Notizen, `useQsFreigaben`), `anpassen/` (Startseiten-Menü, Untermenüs, Rückgängig-Leiste), `dashboardAggregate.ts`, `MeineAntraegeSection.tsx`/`EingangAmpelCard.tsx`/`AiAssistantCard.tsx`/`WeitermachenSection.tsx`.
