# Feedback-Tickets

## Zweck

Öffentliche Übersicht aller gemeldeten Probleme, Ideen und Lob: Fortschritt verfolgen, per Stimme („Ich auch") Nachfrage zeigen, kommentieren und Ideen mit einem Punkte-Budget sponsern (priorisieren). **Die einzige Feedback-Seite** — Verwalten, Ergänzen und Löschen passieren direkt hier.

Die Seite bedient zwei Blickwinkel auf denselben Bestand: der **Ersteller** will wissen, was mit seinem Ticket ist und wie lange es dauert; die **Entwicklung** will Status, Aufwand und Zuständigkeit setzen, ohne die Ansicht zu wechseln. Welchen Blick man bekommt, entscheidet das Schreibrecht; wer verwalten darf, kann oben rechts zwischen **Nutzer** und **Entwickler** umschalten, um zu sehen, was beim Melder ankommt.

## UI-Elemente & Begriffe

- **Kopf:** Titel „Feedback-Tickets", daneben die Pille **„Sicht: Entwickler"** bzw. **„Sicht: Nutzer"** (nur mit Schreibrecht; ein Klick schaltet um und zeigt, was beim Melder ankommt), dann die Zähler „N gesamt · N neu · N in Arbeit". Rechts: Benachrichtigungs-Glocke (ungelesene Team-Antworten → springt zu „Meine Tickets"), Budget-Badge „Budget Q3 · N/10 Pkt", Posteingangs-Knopf für die Verwaltung, **„Neues Ticket"**, ganz außen **Hilfe**.
- **Sichten** (Pillen mit Trefferzahl, je nach Rolle andere):
  - Nutzer: *Alles · Meine Tickets · Wartet auf mich · Neu diese Woche · Zuletzt umgesetzt*. An „Meine Tickets" hängt ein roter Punkt mit der Zahl der ungelesenen Antworten.
  - Entwicklung: *Alles offen · Mir zugewiesen · Triage · ungeschätzt · Rückfragen offen · Meiste Unterstützer · Alles*.
- **Werkzeugleiste:** links der Filter-Schalter (blendet die Filterleiste ein und aus; ist sie zu und es sind Filter gesetzt, trägt er einen kleinen Punkt), das Suchfeld (Titel, Text, Nummer, Person) und der Ergebniszähler „24 von 312". Rechts, nach Häufigkeit sortiert: Umschalter **Liste/Board**, **„Sortiert nach: …"** und das Menü **„Darstellung"**; in der Board-Ansicht zusätzlich der Stift „Board anpassen".
- **Das Menü „Darstellung"** fasst zusammen, was man selten anfasst — je Achse eine Zeile: **Gruppierung** (Keine · Bereich · Aufwand · Ersteller), **Dichte** (Komfortabel · Kompakt · Sehr kompakt) und **Archivierte zeigen** (ein Schalter, nur mit Schreibrecht). Es bleibt nach einer Wahl offen, weil man meist zwei Dinge zugleich stellt; „Zurücksetzen" in der Kopfzeile stellt alles auf einmal zurück — die Dichte landet dabei auf **Kompakt**, dem Startwert der Seite, nicht auf Komfortabel. Der Knopf trägt nur „Darstellung", solange alles auf Standard steht; sonst nennt er die erste Abweichung und zählt die übrigen („Darstellung: Bereich +1"). Dasselbe Menü gibt es auf der Seite Förderanträge.
- **Sortierung:** Letzte Änderung · Neueste zuerst · Meiste Unterstützer · Kleinster Aufwand · Meiste Punkte · Kurz vor dem Ziel · Meiste Sponsoren · Meiste Kommentare.
- **Filterleiste links (206 px):** drei Gruppen — **Typ** (Problem · Idee · Lob · Frage · Unklassifiziert), **Status**, **Bereich** — jede Zeile mit Farbpunkt und Trefferzahl, je Gruppe ein „zurücksetzen". Die Zahlen gelten **innerhalb der gewählten Sicht**: was dort steht, bekommt man beim Klick auch.
- **Board:** Spalten in der Reihenfolge **Neu · Rückfrage · Geplant · In Bearbeitung · Umgesetzt · Abgelehnt**, farbige Oberkante, Kopf mit Zähler und darunter die Summenzeile „384 h geschätzt · 44 ungeschätzt". Je Spalte werden 15 Karten gezeigt, der Rest hängt hinter „+ N weitere". Lob läuft mit (es steht in der Spalte seines Status). Die Spalten teilen sich die verfügbare Breite; wird es zu eng, scrollt das Board waagerecht.
- **Leere Spalten klappen ein** — sie stehen als schmaler Streifen mit gedrehter Beschriftung da, statt Platz zu belegen. Ein Klick faltet einen Streifen auf; beim Ziehen einer Karte klappen alle von selbst auf, damit man überall ablegen kann.
- **Spalten, die die gewählte Sicht gar nicht zeigen kann,** melden keine „0", sondern **„nicht in dieser Sicht"** (gepunkteter Rand). In *Alles offen* betrifft das Umgesetzt und Abgelehnt: setzt man dort ein Ticket auf „umgesetzt", verlässt es die Sicht, statt in die Spalte zu wandern. Der Streifen sagt das, ein Klick darauf wechselt zu *Alles* und zeigt sie. Ablegen per Ziehen bleibt möglich.
- **Verlässt eine Änderung die Sicht,** nennt die Meldung unten das mit: „#A7K2 → Umgesetzt · nicht in der Sicht „Alles offen"". Gilt für Karten-Menü, Ziehen, Mehrfachauswahl und Detail gleichermaßen; „Rückgängig" steht wie immer daneben.
- **Karte:** Farbpunkt für den Typ, Kurz-Nummer (z. B. `#A7K2`), „Antwort"-Marker, `⋯`-Menü, Titel, optionales Vorschaubild, darunter die Chips **Bereich · Aufwand · Zuständig**, im Fuß Autor, Stimmen, Kommentare und wann sich zuletzt etwas bewegt hat. Eigene Tickets tragen links eine Akzentkante.
- **Liste:** feste Kopfzeile, Spalten Typ · Nr. · Ticket (Titel + „Bereich · Text") · Status · Aufwand · Ersteller · Geändert · `⋯`; 60 Zeilen auf einmal, dann „Weitere N laden". Der Typ steht als beschriftetes Badge da (Problem · Idee · Lob · Frage · Offen), nicht als bloßer Farbpunkt. Wird die Liste schmaler (Detail offen), fallen Spalten in fester Reihenfolge weg — zuerst Ersteller, dann Geändert, dann Aufwand, dann Typ, zuletzt Status und der Untertext.
- **Chips ändern direkt.** Status, Aufwand, Zuständigkeit und Bereich sind anklickbar; ein Klick öffnet die Auswahl. Der Aufwand steht als T-Shirt-Größe da (XS bis Epic) und zeigt in der Auswahl gleich die Dauer dazu. Jede Änderung meldet sich unten als kurze Rückmeldung mit **„Rückgängig"**.
- **Detail-Panel rechts** (Klick auf Karte oder Zeile): Kopf mit Typ, Nummer, Blättern (‹ ›) und Schließen. Es startet gut 450 px breit, das Board behält den Rest; am Trenner lässt sich das verschieben (Doppelklick stellt den Ausgangszustand her).
  - Mit Schreibrecht in der Entwickler-Sicht steht direkt darunter eine feste Leiste mit **Status · Aufwand · Zuständig · Bereich** — kein Aufklappen nötig.
  - In der Nutzer-Sicht steht der Status als Pille im Kopf und im Körper ein **Fortschritt** samt Klartext-Streifen: „Noch nicht geschätzt", „Aufwand M · Umsetzung 8 h · ist eingeplant", „**Wartet auf dich.** Das Team hat eine Rückfrage gestellt", „**Umgesetzt.**", „Wird nicht umgesetzt". Am eigenen Ticket stehen dort **„Ticket bearbeiten"** (nur solange es niemand angefasst hat) bzw. **„Ergänzung hinzufügen"** und **„Kommentar"**; beide springen ins Eingabefeld des Verlaufs.
  - Darunter Beschreibung, Anhänge, Antwort vom Team, Sponsoring und der **Verlauf**; ganz unten die Stimme.
- **Verlauf mit Eingabefeld:** unter den bisherigen Beiträgen ein Textfeld mit Bausteinen (Umsetzung · Rückfrage · Erledigt · Nicht möglich bzw. Ergänzung · Antwort), `Strg+↵` sendet. Das Team hat zusätzlich **„Als Rückfrage senden"** (schreibt den Text und setzt das Ticket auf Rückfrage), der Ersteller **„Als Ergänzung"**. Klappt das Speichern nicht, bleibt der Text stehen.
- **Antwort vom Team auf der Karte:** Sobald das Team geantwortet hat, trägt die Karte den Marker „Antwort" — dauerhaft, nicht nur solange sie ungelesen ist. Wer mit der Maus darauf stehen bleibt, liest sie ganz. Rot heißt „neue Antwort auf dein eigenes Feedback", neutral heißt „beantwortet". Die Suche findet Tickets auch über den Wortlaut der Antwort.
- **Kommentare beim Überfahren:** Auf dem Sprechblasen-Zähler erscheinen die letzten vier Kommentare. Tickets mit neuen fremden Beiträgen tragen ein blaues **„+N"**; es verschwindet, sobald man das Ticket geöffnet hat. Eigene Kommentare zählen nicht mit.
- **„Board anpassen"** (nur in der Board-Ansicht): eine Zeile je Spalte — Häkchen blendet sie ein/aus, rechts ein 1/2-Schalter für die Kartenspalten; darunter „Farben der Köpfe" Bunt/Einfarbig. Ausgeblendete Spalten zeigen ihre Tickets nicht im Board, wohl aber in der Liste. Die Einstellung gilt nur auf diesem Gerät.
- **Feedback geben** liegt zusätzlich auf dem globalen Button unten rechts.

## Mehrere Tickets auf einmal

- Links an jeder Karte und Zeile sitzt ein **Häkchen**. Sobald eines gesetzt ist, erscheinen alle anderen mit, und unten schwebt eine dunkle Leiste: „n ausgewählt · Status · Aufwand · Zuweisen · Archivieren". Auch hier lässt sich jede Aktion zurücknehmen — jedes Ticket kehrt auf seinen eigenen vorherigen Wert zurück, nicht auf einen gemeinsamen.
- Wechselt man Sicht oder Filter, bleibt nur markiert, was noch sichtbar ist.
- **Karten lassen sich zwischen den Spalten ziehen** (mit Schreibrecht, Entwickler-Sicht). Ist die gezogene Karte markiert, wandert die ganze Auswahl mit; ist sie es nicht, nur sie.
- **Rechtsklick** auf Karte oder Zeile öffnet dasselbe Menü wie der `⋯`-Knopf.
- Im Menü steht **„Kommentar schreiben"**: ein Textfeld mit Bausteinen (Umsetzung · Rückfrage · Erledigt · Nicht möglich bzw. Ergänzung · Antwort), `Strg+↵` sendet. **„Als Rückfrage"** schickt den Text und setzt das Ticket gleichzeitig auf Rückfrage.
- **Gruppieren** (im Menü „Darstellung") teilt die Treffer in klappbare Bänder nach Bereich, Aufwand oder Ersteller — quer zur Statusachse des Boards. Beim Aufwand laufen die Bänder von XS nach Epic, Ungeschätztes steht am Ende.
- **Tastatur:** `Esc` hebt erst die Auswahl auf und schließt beim zweiten Mal das Detail-Panel; bei offenem Panel blättern `J`/`K` (oder ↓/↑) durch die Treffer.
- Im Verlauf sind **Ergänzungen** (gelb) und **Rückfragen** (rot) als solche gekennzeichnet.

## Der Status „Rückfrage"

Braucht das Team eine Antwort vom Melder, setzt es das Ticket auf **Rückfrage**. Es bekommt eine eigene Board-Spalte, und beim Ersteller taucht es in der Sicht **„Wartet auf mich"** auf — samt Klartext im Detail. Vorher versandete so eine Nachfrage als Kommentar, den niemand bemerkte.

## Eigenes Ticket ändern

- Solange **noch niemand das Ticket angefasst hat** (Status „Neu"), kann der Autor Titel und Text frei überarbeiten — Knopf **„Ticket bearbeiten"**.
- Sobald das Team daran arbeitet, bleibt der ursprüngliche Text stehen: er ist die Bezugsgröße der Diskussion. Neues gehört dann als **Ergänzung** in den Kommentar-Verlauf; ein Hinweis an Ort und Stelle erklärt das.
- Wer Schreibrecht auf dem Datenspeicher hat, darf **jedes** Ticket nachziehen (Titel, Antwortfelder, weitere Anhänge) — passend dazu, dass Status, Team-Antwort und Löschen ohnehin an fremden Tickets offenstehen. Unter dem Autor steht dann „bearbeitet <Datum>".

## Verwalten (nur mit Schreibrecht — PL, Kurator, Entwicklung)

- Status, Aufwand, Zuständigkeit und Bereich stehen als Chips an Karte, Zeile und im Detail. Alles Übrige (Kategorie, Priorität, interne Notizen, öffentliche Antwort, FAQ-Markierung, „Claude Code Prompt", Löschen) liegt im Detail unter **„Weitere Verwaltung"**.
- Das `⋯`-Menü an jeder Karte: mir zuweisen, als umgesetzt markieren, auf Rückfrage setzen, archivieren, Details öffnen.
- Im Seitenkopf ein **Posteingangs-Knopf** → Dialog „Feedback-Verwaltung" mit vier Reitern: **Inbox** (Feedback der Nutzer ohne Schreibrecht einsammeln, einmaliger Ordner-Connect), **FAQ**, **Sponsoring** (Ranking, Schwellen, Budget), **Einstellungen** (Modell, System-Prompt, Status der geteilten Datei).
- Der Reiter „Einstellungen" zeigt zur geteilten Datei die Zahl der Einträge und das Datum der letzten Änderung. „nicht verbunden" heißt, der Zugriff auf den gemeinsamen Datenspeicher fehlt; „vorhanden, aber nicht lesbar" heißt, dass Änderungen bewusst abgelehnt werden, statt den Bestand zu überschreiben.
- Schlägt ein Speichern fehl, sagt die Seite das — als Meldung an der Stelle, an der man geklickt hat.

## Typische Aktionen

- Sicht wählen, filtern, suchen, sortieren, zwischen Board und Liste wechseln, im Menü „Darstellung" gruppieren/verdichten, Board-Spalten anpassen
- Fortschritt und Antworten verfolgen, stimmen, kommentieren, Idee sponsern
- Detail öffnen, mit ‹ › durch die Treffer blättern, eigenes Ticket bearbeiten oder ergänzen, neues melden
- Mit Schreibrecht zusätzlich: Status/Aufwand/Zuständigkeit/Bereich am Chip setzen, auf Rückfrage stellen, archivieren, als FAQ markieren, löschen, Nutzer-Feedback einsammeln, Sponsoring-Schwellen pflegen

## Technik

**Datenmodell dahinter:** `FeedbackItem` (title, category, kurator_status inkl. `rueckfrage`, `assignee`, `bereich`, context.page, effort_estimate, votes[], comments[], sponsors[], kurator_response, updated_at); Titel notfalls aus der Hauptantwort abgeleitet; Votes/Kommentare team-geteilt (Merge + Outbox), getrennt vom Sponsoring. Stepper aus `kurator_status` abgeleitet (kein Verlauf); Ungelesen-Status gerätelokal. Die Kurz-Nummer ist kein Zähler, sondern die letzten vier Stellen der Ticket-Id.

**Zugehörigkeit:** ob ein Ticket „mir" gehört, entscheidet `istMeinTicket` (`core/services/feedback/feedbackIdentitaet.ts`) gegen Kürzel UND Profilname — neue Einträge tragen die kanonische `schreibId` aus `useMeineFeedbackIdentitaet`.

**Code:** `plugins/feedback-board/` — `FeedbackBoardPage.tsx` (Zustand + Verdrahtung), reine Module `smartViews.ts` / `boardFilter.ts` / `boardZahlen.ts` / `boardSpalten.ts` / `auswahl.ts` / `gruppierung.ts` / `darstellungsAchsen.ts`, Ansichtszustand `useBoardAnsicht.ts`, Rollen-Pille `RollenPille.tsx`, Oberfläche in `ticket/` (`TicketKarte`, `TicketZeile`, `TicketBoard`, `TicketListe`, `TicketDetail`, `VerlaufBlock`, `InlineChip`, `chipMenues`, `TicketMenue`, `bausteine`, `FacettenLeiste`, `DauerStreifen`, `BulkLeiste`, `Swimlane`, `TicketToast`, `useTicketAktionen`), Stile in `ticketsystem.css`, Verwaltung in `verwaltung/`. Geteilte Bausteine weiter in `components/feedback/` (Stepper, SponsorPanel, VotePill, CommentList, ErgaenzenForm, Hovers); die Werkzeugleiste sitzt auf `components/ui/` (`DarstellungDropdown`, `ViewModeToggle`, `Button`, `Select`) und `components/kanban/FarbmodusToggle`. Service `core/services/feedback/` (Schreib-Lagen in `feedbackSharedFile.ts`); Rechte-Gate `canManageFeedback` in `config/feature-flags.ts`.
