# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v3.28.0 — VerlaufsBand (August 2026)

MINOR — Seit v3.19 liegt der Verlauf als Daten vor — je Spur lückenlose Abschnitte mit Dauer, 82,4 % zweiseitig verankert. Gezeichnet wurde er nie: der Reiter zeigte eine Aufzählung, ausdrücklich als Sicherheitsnetz, solange die Bauform offen war. Jetzt steht die Bahn, und die Liste ist eine Stufe tiefer gerückt — geteilt, nicht ersetzt.

- Mehrspurige Statusbahn (Verbund + je Teilvorhaben) auf **einer gewarpten Zeitachse**: derselbe Tag sitzt in jeder Spur an derselben Stelle, kurze Abschnitte bleiben über der Klickgrenze — [bandGeometrie.ts](src/plugins/antraege/verlauf-band/bandGeometrie.ts)
- Konfidenz sitzt an den **Kanten**, nie am Statusfeld: der Status ist beobachtete Tatsache, unsicher ist die Zuschreibung — [VerlaufsBand.tsx](src/plugins/antraege/verlauf-band/VerlaufsBand.tsx)
- Zwei leere Spurzustände sprechen verschieden („für diese Richtlinie keine Regeln" ≠ „kein Bearbeitungsstand"), dafür neu `VerlaufsSpur.regelLage` — [typen.ts](src/core/status/verlauf/typen.ts)
- „Verlauf kopieren" gibt Labels **und** Codes heraus, samt Katalogfassung und Rekonstruktions-Hinweis — [bandText.ts](src/plugins/antraege/verlauf-band/bandText.ts)
- `bezugsZeitpunkt` liest endlich die Frist-Uhr statt des nackten Stichtags; am Bestand heute folgenlos, weil kein Haltedatum belegt ist — [frist-bezug.ts](src/core/status/frist-bezug.ts), [vorgangssystem.md §14.9](docs/architecture/vorgangssystem.md)

### v3.27.2 — Kurator-Passwort im pl-Build gesetzt (August 2026)

PATCH — Der Slot `moduleAuth.kurator` trug seit seiner Einführung nur einen Platzhalter-Verifier: die Kurations-Rolle war in `pl` gar nicht erreichbar, der einzige Weg hinein war ein Überbleibsel aus einem Stand vor dem Schloss (v3.27.0). Mit dem gesetzten Passwort greift die dritte Regel erstmals wirklich.

- Beide Modul-Slots tragen echte Salt/Verifier-Paare, der Platzhalter-Hinweis ist raus — [pl.config.json](configs/pl.config.json)
- Damit gilt in `zah-pl.html`: Standard → beide Module zu · Auslastungs-Passwort → nur Auslastung · Kurations-Passwort → nur Kuration — [modul-freischaltung.md](docs/architecture/modul-freischaltung.md)

### v3.27.1 — Build-Ziel devpl statt devprod (August 2026)

PATCH — Die Zusammenlegung auf drei Varianten (v3.0) hat `build:all` mitgezogen, das Standard-Paar aber nicht: `build:devprod` baute weiter dev + prod, obwohl der Fach-Stack seit v3.0 komplett in `pl` liegt und der End-User-Build ihn gar nicht kompiliert. Wer der Default-Regel folgte, baute die Variante nicht, aus der getestet wird.

- `build:devprod` → **`build:devpl`** (dev + pl); `build:all`, `build:dev`, `build:pl`, `build:prod` bleiben, wie sie sind — [package.json](package.json)
- Die Default-Regel im Cheatsheet dreht sich entsprechend: dev + pl immer, `build:prod` zusätzlich bei geteiltem Code — [which-build-to-run.md](docs/agents/which-build-to-run.md)
- Drei Cheatsheets nannten `build:devprod` als Abnahme-Schritt — [add-embedding-model.md](docs/agents/add-embedding-model.md), [add-auslastung-tab.md](docs/agents/add-auslastung-tab.md), [optimize-remount-latency.md](docs/agents/optimize-remount-latency.md)

### v3.27.0 — Anmeldung legt den Freischalt-Zustand fest (August 2026)

MINOR — In `zah-pl` erschienen **beide** Modul-Menüs, egal welches Passwort an der Wall getippt wurde. Kein Code-Defekt: eine Freischaltung galt 12 h und überlebte jede Anmeldung, also blieb offen, was ein früherer Login geöffnet hatte. Für den Kurator-Slot existierte zudem nie ein benutzbares Passwort — der einzige Weg hinein war ein Überbleibsel aus einem pl-Stand vor dem Schloss.

- Steht eine Anmeldung an, wird jedes Modul mit Schloss VOR dem `rehydrate` geschlossen; die Wall öffnet danach genau den getroffenen Slot — [modul-freischaltung.ts](src/core/modul-freischaltung.ts), [App.tsx](src/core/App.tsx)
- Die Profil-Flagge `is_kurator` folgt dem getippten Passwort, sonst fordert eine Standard-Anmeldung weiter Schreibrechte auf dem Share an — [AppPasswordGate.tsx](src/core/AppPasswordGate.tsx)
- Die Ebenen-Prüfung ist als reine Funktion testbar (Basis → `auslastung` → `kurator`, erster Treffer gewinnt) und erstmals abgedeckt — [app-password.ts](src/core/services/infrastructure/app-password.ts)
- Die Wall nennt Modul-Passwörter, die Freischalt-Sektion sagt jetzt die Wahrheit über ihre Geltung — [AppPasswordGate.tsx](src/core/AppPasswordGate.tsx), [ModulFreischaltungSection.tsx](src/plugins/einstellungen/ModulFreischaltungSection.tsx)
- Einstellungs-Registry: „Module freischalten" ist auffindbar, der in `pl` tote Eintrag „Kurator-Bereich" ist weg — [settingsPanels.tsx](src/plugins/einstellungen/settingsPanels.tsx), [modul-freischaltung.md](docs/architecture/modul-freischaltung.md)

### v3.26.0 — Klaerfragen als Arbeitsmappe (August 2026)

MINOR — Was am Status- und Kürzelkatalog fachlich offen ist, stand bisher nur in `vorgangssystem.md` — als Handmessungen aus einer Konsolensitzung, die mit jedem Nacht-Export veralten und die niemand nachrechnen konnte. Die Befragung läuft Wochen und braucht eine Datei, die reihum geht. **70 Klärfragen** aus 14.222 Vorgängen, in sechs Herkünften mit je eigener Zuständigkeit.

- Neuer Reiter „Klärfragen" mit Bestandslauf, Zähler je Herkunft und XLSX-Export; read-only, kein Rückweg (das ist „Zu klären") — [KlaerfragenTab.tsx](src/plugins/status-cockpit/KlaerfragenTab.tsx)
- Die Ableitung entsteht bei jedem Lauf neu und ist rein; die drei Wert-Herkünfte sind disjunkt geordnet, Ids kommen aus Daten — [klaerfragen/](src/core/status/klaerfragen/)
- Fixierte Kopfzeile, Zeilenumbruch, entsperrte Antwortzellen und Auswahllisten kann der XLSX-Writer nicht; ein Nachschritt über `jszip` ergänzt sie und bricht ab, wenn seine Formatannahme nicht mehr stimmt — [arbeitsmappe-veredelung.ts](src/core/status/export/arbeitsmappe-veredelung.ts)
- `uneinigeKuerzel()` liefert erstmals, WELCHE Projektform was sagt — bisher nur die Namensliste — [kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts)
- §14.4 ist bis auf die DS-Lücke abgearbeitet; `AB` → 51 und `XHSP` → 50 sind fachlich bestätigt und decken sich mit C16 — der erste direkte Beleg für die Güte des Exports — [vorgangssystem.md](docs/architecture/vorgangssystem.md)

### v3.25.0 — Arbeitsliste folgt dem Phasenschnitt nicht mehr (August 2026)

MINOR — Katalog-Fassung 19 löste die Phase „Vollständigkeit" auf und hängte deren Codes an „Prüfung" — ein gewollter Schnitt, der nebenbei **448 Anträge** die Arbeitsliste wechseln ließ: „Wartet auf Antragsteller" fiel von 52 auf 0, der Altanträge-Balken der Auslastung von 395 auf 22 Teilvorhaben (leer bei 22 von 32 MAs). Entschieden hatte das niemand; in den Reitern blieb es unsichtbar, weil das Aggregat „Vor Entscheidung" drei Kategorien bündelt.

- Codes mit fachlich fester Arbeitsliste (33–37, 59) hängen jetzt am **Code** statt an einer Phasen-Id — `kategorieVorgabe` bleibt für alle übrigen wirksam — [kategorie-ableitung.ts](src/core/status/kategorie-ableitung.ts)
- „Altlast" ist an die fünf amtlichen Codes gebunden statt an zwei Kategorien der beweglichen Achse, mit Rückfall für unbekannte Schreibweisen — [altlast.ts](src/plugins/auslastung/services/kapazitaet/altlast.ts)
- Regressionsgatter setzt den Phasenschnitt der Fassung 19 aktiv, statt auf dem Seed zu laufen, wo die Lücke unsichtbar blieb — [altlast.test.ts](src/plugins/auslastung/__tests__/altlast.test.ts)
- Gegenprobe hält fest, dass nicht verankerte Codes weiter dem kuratierten Schnitt folgen — [zah-phasen-daten.test.ts](src/core/status/__tests__/zah-phasen-daten.test.ts)
- Warum `status-category-not-curated` allein nicht reichte, steht bei den Achsen — [status-achsen.md](docs/architecture/status-achsen.md), Pitfall #50

### v3.24.1 — Freischaltung ueberlebt den Reload (August 2026)

PATCH — Auf dem Produktivsystem verlor die Modul-Freischaltung nach dem erzwungenen Reload ihren Eintrag: Slot wieder „gesperrt", kein Menüpunkt, keine Meldung — ein zweiter Versuch klappte. Ein Wettlauf, den nur langsame Maschinen verlieren, deshalb im Dev nie sichtbar.

- Schreiben löst erst beim **Commit** der Transaktion auf statt beim Request; `onabort` lehnt ab, damit aus stillem Verlust kein stiller Hänger wird — [idb-store.ts](src/core/services/storage/idb-store.ts)
- `updateProfile` schreibt nicht mehr im `setState`-Updater und ist damit tatsächlich abwartbar (betraf `is_kurator` vor dem Reload) — [useProfile.ts](src/core/hooks/useProfile.ts)
- Der Store behauptet die Freischaltung erst nach dem Schreiben, und Fehler nach der Passwortprüfung stehen sichtbar da statt geschluckt zu werden — [useModulFreischaltung.ts](src/core/hooks/useModulFreischaltung.ts), [ModulFreischaltungSection.tsx](src/plugins/einstellungen/ModulFreischaltungSection.tsx)
- Regressionsgatter „Commit vor Aufloesung" für `set`/`delete` samt Abbruch-Fall — [idb-store.test.ts](src/core/services/storage/__tests__/idb-store.test.ts)
- Bug-Klasse 18 „Schreiben und sofort neu laden" festgehalten — [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)

### v3.24.0 — Feedback-Werkzeugleiste an Förderanträge angeglichen (August 2026)

MINOR — In einer Toolbar-Zeile standen fünf Bauformen für dieselbe Art Aufgabe, und drei Icons trugen eine Bedeutung, die sie in der übrigen App nicht haben. Was Förderanträge schon konnte, war hier nachgebaut statt benutzt.

- Das „Darstellung"-Menü der Förderanträge ist geteilt und trägt am Board Gruppierung · Dichte · Archivierte — aus drei Bedienelementen wird eines — [DarstellungDropdown.tsx](src/components/ui/DarstellungDropdown.tsx)
- Liste/Board läuft über den geteilten `ViewModeToggle` (Modi jetzt als Prop) statt über eine eigene Segmentgruppe — [ViewModeToggle.tsx](src/components/ui/ViewModeToggle.tsx)
- Der Rollen-Umschalter ist eine Kopf-Pille im Stil von „Profil: THÜ"; die Hilfe steht wie überall als letztes Element — [RollenPille.tsx](src/plugins/feedback-board/RollenPille.tsx)
- Icon-Vokabular vereinheitlicht (`Filter`, `SquareKanban`, `Inbox`, `Pencil`, `ThumbsUp`) und in der Muster-Doku festgehalten — [ui-muster.md](docs/architecture/ui-muster.md)
- Zwei Doppelbauten aufgelöst: `FarbmodusOption` (2×) → [FarbmodusToggle.tsx](src/components/kanban/FarbmodusToggle.tsx), zwei handgebaute Punkte-Menüs → ein `Popover` in [SponsorButton.tsx](src/components/feedback/SponsorButton.tsx)

### v3.23.0 — C16 als alleinige Regelquelle, Bedingungen ausgewertet (August 2026)

MINOR — Die Verlaufsableitung rechnete gegen 41 Regeln, die eine einzelne Bearbeiterin für ihr eigenes Excel-Dashboard notiert hatte: unvollständig und nur für NW. C16 ist der Export aus dem laufenden Fachsystem und damit die tatsächliche Konfiguration. Der Wechsel hebt die Verbund-Deckung von 21,0 % auf 62,9 % und die messbaren Verweildauern von 16.200 auf 62.396 Abschnitte.

- C16 ist alleinige Regelquelle: Nachschlag je Richtlinie statt je Projektform, `statusTv`/`statusVb` als getrennte Wirkungsebenen — [c16-regeln.ts](src/core/status/verlauf/c16-regeln.ts)
- Vorbedingungen werden ausgewertet, und zwar gegen den Stand **am Tag des Kürzels**: laufender Status plus damals gesetzte Kürzel; 3.193 Übergänge scheitern daran — [uebergaenge.ts](src/core/status/verlauf/uebergaenge.ts)
- Der Bedingungs-Auswerter des Navigators bekommt eine Heimat und einen zweiten Aufrufer statt einer Kopie; `navigator.test.ts` blieb ohne Änderung grün — [trigger-bedingung.ts](src/core/status/trigger-bedingung.ts)
- Nicht auswertbar ist weder wahr noch falsch: neue Konfidenz `trigger_bedingt` samt Grund im aufgeklappten Bereich — [typen.ts](src/core/status/verlauf/typen.ts)
- Die Zuarbeit-Regeln bleiben erhalten (`quelle: 'zuarbeit'`); drei von 41 bleiben als Klärfall übrig, alle drei die `XPC`-Familie — [klaerfaelle.ts](src/core/status/verlauf/klaerfaelle.ts), [§14.7](docs/architecture/vorgangssystem.md)

### v3.22.0 — Feedback-Board: Platz für das Board, Typ-Badge, Verlauf im Panel (August 2026)

MINOR — Nachlese aus der Benutzung des Redesigns: neben dem Detail-Panel blieben dem Board 250 px, drei leere Lanes belegten die Hälfte der Breite, der Typ war in der Liste nur ein Farbpunkt, und die Kommentar-Spur war noch die alte von v2.199. Vier Stellen, an denen der Handoff nicht die bessere Vorgabe war.

- `MasterDetailLayout` misst die Startbreite wahlweise von RECHTS (`detailDefaultWidth`): das Detail startet schmal, die Liste bekommt den Rest und behält ihn beim Fenster-Resize — [masterDetailLayout-logic.ts](src/components/master-detail/masterDetailLayout-logic.ts)
- Board-Spalten wachsen mit (`flex: 1 1 262px`, 228–340 px) statt fest 262 px zu bleiben — [ticketsystem.css](src/plugins/feedback-board/ticketsystem.css)
- Leere Lanes klappen wieder zur 44-px-Schmalschiene ein (ging beim Redesign verloren) und bleiben Drop-Ziel: Ziehen faltet alle auf, Klick eine einzelne — [TicketBoard.tsx](src/plugins/feedback-board/ticket/TicketBoard.tsx)
- Der Typ steht in der Liste als beschriftetes Badge statt als Farbpunkt; die Container-Query-Schwellen wandern um die neue Spalte mit — [TicketZeile.tsx](src/plugins/feedback-board/ticket/TicketZeile.tsx)
- Eigener „Verlauf" im Detail-Panel mit Bausteinen, „Als Rückfrage senden" / „Als Ergänzung"; `ctx.kommentiere` meldet Erfolg zurück, damit der Entwurf bei einem Share-Fehler stehenbleibt — [VerlaufBlock.tsx](src/plugins/feedback-board/ticket/VerlaufBlock.tsx)

### v3.21.0 — Ausklappbarer Bereich an der Tabellenzeile (August 2026)

MINOR — Die Verlaufsableitung aus v3.19 hatte noch keinen Ort, an dem sie ankommt: sichtbar waren nur Bilanzzahlen im Kurator-Panel. Jetzt geht unter einer Tabellenzeile ein Bereich auf, der zeigt, wie der Vorgang zu seinem Status kam — und was seine Frist wirklich trägt.

- Status- und Frist-Zelle klappen einen Bereich mit zwei Reitern auf; FKZ und Akronym navigieren weiter ins Detail, der Zeilenklick entfällt — [ausklapp/](src/plugins/antraege/ausklapp/)
- Reiter *Verlauf*: je Teilvorhaben und Verbund die Statusabschnitte und die Kürzel dazwischen, mit Rolle, Konfidenz und Journal-Nullpunkt — der erste Renderer der Spuren aus v3.19
- Reiter *Fristen und Meilensteine*: dieselbe Engine mit tieferer Eingabe (`D_XTE` aus dem Schema, Haltedatum) — `ermittleHaltedatum` bekommt seinen ersten Produktions-Aufrufer — [FristenReiter.tsx](src/plugins/antraege/ausklapp/FristenReiter.tsx)
- `SortableTable` kann jetzt Detailzeilen (`isRowExpanded`/`renderRowDetail`) statt sie zum fünften Mal je Seite nachzubauen — [TableBody.tsx](src/components/data-table/TableBody.tsx)
- Die „Verlaufs-Näherung (max. 5)" im Popover weicht „Ganzen Verlauf zeigen"; die Regeln der Zuarbeit haben über eine Fassade weiter genau einen Leser, die Guard-Ausnahme entfällt — [fuer-vorgang.ts](src/core/status/verlauf/fuer-vorgang.ts)

### v3.20.0 — Verlaufs-Segmente: warum die Dauer unsicher ist (August 2026)

MINOR — 68,3 % der Abschnitte trugen „Dauer unsicher", und daraus las sich „die Verweildauern sind wertlos". Die Zahl mischte zwei Dinge: eine offene Grenze und eine gemessene Ein-Tages-Dauer. Vor dem Band in Phase 3 muss klar sein, welches davon überwiegt.

- Vier disjunkte Auslöser hinter `dauerUnsicher` (Summe = `segmenteUnsicher`, per Test): **nur 1.719 von 31.135 (5,5 %)** sind gemessene ≤ 1-Tages-Dauern, 94,5 % sind offene Grenzen — [erhebung.ts](src/core/status/verlauf/erhebung.ts)
- Verteilung der 16.200 messbaren Dauern aus einem Histogramm statt eines Sammel-Arrays: Median 10 T, p75 37 T, 28,9 % über 30 Tagen — die Dauerachse trägt — [VerlaufBefundeBlock.tsx](src/plugins/status-cockpit/VerlaufBefundeBlock.tsx)
- Negative Dauern (Termin nach dem Bezugszeitpunkt) sind ein eigener Befund statt stiller Teil von „stand einen Tag" — im Bestand null Fälle
- C16-Vergleich gemessen: **null Widersprüche** bei zwei Überlappungs-Paaren; die Zuarbeit deckt FuE, DS und DL mit **0** Verbünden, C16 löst `AB` → 51 und `XHSP` → 50 auf — [vorgangssystem.md §14.5](docs/architecture/vorgangssystem.md)
- Die 63,2 % C16-Deckung sind eine **Obergrenze**: alle 287 statusetzenden Zeilen tragen eine Bedingung, keine einzige ist bedingungsfrei

### v3.19.0 — Verlaufsableitung (August 2026)

MINOR — Das Vorgangssystem erklärt den aktuellen Status, aber nicht den Weg dorthin. Das Import-Diff-Journal beginnt erst am 05.08.2026 und kennt null Statuswechsel — eine Spur, die nur beobachten kann, erklärt bei jedem Vorgang nur ihre eigene Blindheit. Also wird abgeleitet, mit Herkunft an jeder Spur. Reines Modul, keine UI (Band und Ausklappmechanik folgen).

- `baueVerlauf` baut je Teilvorhaben und Verbund eine Spur aus den `D_`-Spalten und den Statuswechsel-Regeln der Kürzel-Zuarbeit; Kürzel-Nachschlag immer × Projektform, historische Formen doppelt geführt — [verlauf/](src/core/status/verlauf/)
- Vier Spurzustände statt einer leeren Zeile, und Abweichungen zum Export in zwei Arten getrennt: 11.134 „gar nicht ableitbar" gegen **152** echte Widersprüche — [typen.ts](src/core/status/verlauf/typen.ts)
- Bestandslauf im Reiter *Kürzel* der Vorgangs-Regeln: 12.356 Teilvorhaben in 6.614 Vorhaben, 86,1 % mit Verlauf, aber nur 21,0 % der Verbünde mit abgeleitetem Statuswechsel — [VerlaufBefundeBlock.tsx](src/plugins/status-cockpit/VerlaufBefundeBlock.tsx)
- Zwei Guards halten Pitfall #44: der Status-Pfad kennt das Verlaufs-Modul nicht, und die durchweg `aktiv: false`-Regeln der Zuarbeit haben genau einen Konsumenten — [codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)
- Gemessen und richtiggestellt: `Sonderstatus` und die Partner-Werte kommen im Antragsbestand **null**-mal vor — sie stehen nur auf Roh-Exportzeilen ohne Förderkennzeichen — [vorgangssystem.md §14](docs/architecture/vorgangssystem.md)

### v3.18.0 — Feedback-Tickets: Mehrfachauswahl, Ziehen, Kontextmenue, Swimlanes (August 2026)

MINOR — Etappe 2 des Feedback-Redesigns: alles, was MEHRERE Tickets betrifft. Nach Etappe 1 war jede Änderung ein Klick weit entfernt — aber vierzig Tickets an einen Bearbeiter zu geben blieben vierzig Einzelklicks.

- Mehrfachauswahl mit Häkchen + dunkle Bulk-Leiste (Status · Aufwand · Zuweisen · Archivieren); jede Aktion mit Sammel-Toast und Rückgängig je Ticket — [auswahl.ts](src/plugins/feedback-board/auswahl.ts), [BulkLeiste.tsx](src/plugins/feedback-board/ticket/BulkLeiste.tsx)
- `updateFeedbackMany`: ein Lese-/Schreiblauf statt n — fünfzig Einzelaufrufe wären fünfzig SMB-Runden und fünfzig Rennen um dieselbe Datei — [feedbackService.ts](src/core/services/feedback/feedbackService.ts)
- Karten zwischen den Spalten ziehen; eine markierte Karte nimmt die Auswahl mit, eine unmarkierte nur sich selbst — [TicketBoard.tsx](src/plugins/feedback-board/ticket/TicketBoard.tsx)
- Rechtsklick öffnet dasselbe Menü wie `⋯`; darin ein Schnell-Kommentar mit Bausteinen, `Strg+↵` und „Als Rückfrage" (Beitrag + Statuswechsel in einem Zug) — [TicketMenue.tsx](src/plugins/feedback-board/ticket/TicketMenue.tsx)
- Gruppierung in klappbare Bänder nach Bereich/Aufwand/Ersteller (Aufwand fachlich sortiert), Esc-Kaskade und `J`/`K` — [gruppierung.ts](src/plugins/feedback-board/gruppierung.ts)

### v3.17.0 — Feedback-Tickets: Verwaltung an der Karte, Status Rueckfrage, Sichten und Facetten (August 2026)

MINOR — Das Board hatte drei Defekte, die erst bei realer Ticketmenge greifen: die Verwaltungsfelder lagen vier Ebenen tief in einem eingeklappten Akkordeon, eine Entwickler-Rückfrage versandete als Kommentar, den niemand sah, und ab etwa hundert Tickets gab es keinen Einstieg außer „alle". Umbau nach Handoff `_design/handoff/feedback-redesign`; Etappe 1 von 2 (Massenbearbeitung folgt).

- Status, Aufwand, Zuständigkeit und Bereich sind Inline-Chips an Karte, Zeile und in einer festen Aktionsleiste im Detail — jede Änderung mit Toast und „Rückgängig" — [ticket/](src/plugins/feedback-board/ticket/)
- Neuer Status **Rückfrage** mit eigener Board-Spalte, Sicht „Wartet auf mich" und Klartext-Streifen, der Aufwand in Dauer übersetzt — [dauerText.ts](src/plugins/feedback-board/ticket/dauerText.ts)
- Rollenabhängige Sichten mit Zählern, Facetten-Leiste (Typ · Status · Bereich), Spalten-Kappung, Spaltenkopf-Summen, drei Dichte-Stufen — [smartViews.ts](src/plugins/feedback-board/smartViews.ts), [boardZahlen.ts](src/plugins/feedback-board/boardZahlen.ts)
- Neue Felder `assignee`/`bereich` + `FeedbackComment.kind` (additiv, Kurator-Felder shared-wins); Autor darf sein eigenes Ticket ändern, solange es auf „Neu" steht — [feedback.ts](src/core/types/feedback.ts)
- Zwölf abgelöste bzw. tote Bausteine entfernt (−1.400 LOC), `ScopeTabs` um Variante `pills-solid` + `trailing`-Slot erweitert — [feedback-system.md](docs/architecture/feedback-system.md)

### v3.16.1 — Gesamtbreiten-Griff auf 4px (August 2026)

PATCH — Der Griff am rechten Tabellenrand war auch nach 12 → 8 px noch zu breit für das, was er ist: eine Kante, kein Bedienelement mit Fläche.

- Griff 8 → 4 px, Griffpunkte 2 → 1,5 px (2 px füllten die 3 px Innenbreite fast randlos und lasen sich als Strich) — [TotalWidthGrip.tsx](src/components/data-table/TotalWidthGrip.tsx)
- Ziehen und Doppelklick-Reset in der 4-px-Rinne nachgemessen: 1.132 → 912 px gepinnt, Doppelklick zurück auf 1.132 und Eintrag gelöscht

### v3.16.0 — Kurzlabel aus einer Quelle (August 2026)

MINOR — Die Kurzform eines Statuswerts lag dreifach hartkodiert und war auseinandergelaufen: die Suche schrieb „Wiederspr. zur Ablehn." (Tippfehler), das Archiv-Kopfband „abgelehnt/zurückgez.", die Antragsliste „abgel./zurückgez.". Die Fassung für Code 72 war zudem auf eine Schreibweise geschlüsselt, die im Bestand gar nicht vorkommt — sie hat dort nie gegriffen (29 Fälle), und 65 % des Bestands (Sonderstatus, Skizze, Partner) hatten überhaupt keine Kurzform.

- Eine Quelle: `kurz` am Code-Katalog (30 Werte, gegen den Produktivbestand freigegeben) + kuratierbares `kurzLabel` je Code — [status-codes.ts](src/core/status/status-codes.ts), [katalog-edit.ts](src/core/status/katalog-edit.ts)
- Ein Lookup: `statusKurzLabel()` für enge Flächen, `statusLabel()` für Tooltip/Export/Prompt; fehlt beides, steht der gekürzte Bezeichner mit „…" da statt einer stillen Ersetzung — [status-wert-labels.ts](src/core/utils/status-wert-labels.ts)
- 15 Anzeigestellen tragen jetzt Kurzform **und** Tooltip mit dem vollen Bezeichner; `STATUS_LABELS`/`getStatusLabel` und die beiden anderen Kopien sind entfallen — [status-mappings.ts](src/core/utils/status-mappings.ts)
- Pflegeliste + Spalte „Kurzform" im Reiter *Statuswerte*, nach Vorkommen im Bestand sortiert; Längenhinweis meldet, blockiert aber kein Speichern — [KurzLabelPflege.tsx](src/plugins/status-cockpit/KurzLabelPflege.tsx)
- `statusKurz` heißt `statusHerleitungKopf`; das Herleitungs-Popover nennt die Kurzform und ihre Herkunft (Fassung / Auslieferung / nicht gepflegt) — [herleitung.ts](src/core/status/herleitung.ts)

### v3.15.0 — Spaltenfilter zeigen Trefferzahlen (August 2026)

MINOR — Die Spalten-Filter listeten nur die Werte auf; wie viele Zeilen hinter einem stehen, sah man erst nach dem Anwenden. Bei 605 Akronymen oder 33 FB-Kürzeln ist das ein Blindflug.

- Hinter jedem Wert steht seine Trefferzahl — **einseitige Facette**: andere aktive Spaltenfilter zählen mit, der eigene nicht — [useColumnFilters.ts](src/components/data-table/useColumnFilters.ts)
- Ein Wert, den die anderen Filter auf 0 drücken, bleibt wählbar (ausgegraut statt weg) — [ColumnFilterDropdown.tsx](src/components/data-table/ColumnFilterDropdown.tsx)
- Im Jahr→Monat-Baum trägt auch der Ordner seine Summe; die Zahl steckt im Knoten, nicht im Render — [filterBaum.ts](src/components/data-table/filterBaum.ts)
- Gerechnet wird nur für die gerade geöffnete Spalte (ein Durchlauf beim Öffnen statt ~25 bei jedem Klick) — [TableHeadRows.tsx](src/components/data-table/TableHeadRows.tsx)
- Die Suche zieht mit, über ihren eigenen Wert-Zugriff (`filterType: 'year'`) — [useSearchResults.ts](src/plugins/suche/useSearchResults.ts)

### v3.14.1 — DS und Irrlaeufer sind zwei verschiedene Luecken (August 2026)

PATCH — Hinter dem fehlenden Projektform-Treffer standen zwei ganz verschiedene Sachverhalte, die als ein „unbekannt" verschmolzen waren: **DS** ist eine echte Projektform, die nur nach der Zuarbeit entstanden ist (nachlieferbar), **Irrläufer** ist begrifflich gar keine — an uns gesendet, aber nicht unsere Zuständigkeit (nie nachlieferbar).

- `projektformLage()` unterscheidet `zuarbeit-aelter` von `keine-projektform`, damit niemand das eine mit der Lösung des anderen „repariert" (etwa DS auf FuE mappt) — [kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts)
- `projektformVonVbPhase()` bleibt unverändert die schlanke Frage „kann ich nachschlagen?" und liest nur noch aus der Lage ab — kein zweiter Weg

### v3.14.0 — Kuerzelkatalog je Projektform aus der Zuarbeit (August 2026)

MINOR — Die Kürzeltabelle war flach: ein Kürzel, eine Bezeichnung. 77 Kürzel bedeuten aber je nach Projektform etwas anderes — `AB` ist in DL die „Bewilligungsempfehlung durch Haushaltsbeauftragte", sonst „bewilligungsreif/Akte an Euronorm". Am Produktivbestand gemessen: **11 216 von 14 222 Anträgen (78,9 %)** tragen mindestens ein Kürzel, dessen angezeigter Klartext für ihre Projektform falsch ist.

- Katalog mit Schlüssel **Kürzel × Projektform** (608 Kürzel, 1 350 Paare) aus der Zuarbeit generiert — [gen-kuerzel-katalog.mjs](scripts/gen-kuerzel-katalog.mjs)
- Nachschlagen nur über `kuerzelAuskunft(kuerzel, projektform)`; unbekannte Projektform + uneinige Formen ⇒ `eindeutig: false` statt geratener Bedeutung — [kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts)
- Historische Kürzel bleiben über `ersetztDurch` auflösbar (83 Umbenennungen), damit Altfälle lesbar bleiben — [kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts)
- 41 Trigger-Regeln importiert, **alle `aktiv: false`**; Benachrichtigung und Statuswechsel als getrennte Felder, 15 unauflösbare Zielstatus markiert statt geraten — [kuerzel-trigger.data.ts](src/core/status/kuerzel-trigger.data.ts)
- Guard `kuerzel-nie-flach` verbietet den direkten Zugriff auf die Rohtabelle — [codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)

### v3.13.1 — Projektart-Menue liegt vor der Tabelle (August 2026)

PATCH — Das neue Untermenü lag hinter der Tabelle: die aufgeklappte Pille trägt eine Animation mit `transform` und ist damit ein eigener Stacking-Context — ein `z-index` darin gilt nur innerhalb der Pille. Dazu las sich der Knopf „Einzelprojekt · Einzelprojekt 397", weil der Oberpunkt im Menü noch einmal steht und sich selbst als aktiven Unterpunkt fand.

- Untermenü hängt am `document.body` und wandert beim Scrollen mit dem Anker mit (Muster aus `ColumnFilterDropdown`) — [CollapsibleSeg.tsx](src/plugins/antraege/filter/CollapsibleSeg.tsx)
- Was der Segment-Knopf anzeigt (aktiv? welche Zahl? welcher Zusatz?) entscheidet ein reines, geprüftes Modul — [segAnzeige.ts](src/plugins/antraege/filter/segAnzeige.ts)

### v3.13.0 — Projektart-Filter: Einzelprojekt mit Menue, Zaehler folgen dem Antragstyp (August 2026)

MINOR — Die Projektart brachte fünf Segmente in eine Leiste, die schon vier Pillen trägt, und zwei davon lasen sich wie eine Aufteilung von „Einzelprojekt" (397 = 38 + 192), die sie nicht sind. Dazu zählten die Stufen den vollen Bestand, während der Antragstyp-Filter davor schon geschnitten hatte.

- Die Netzwerkbezug-Stufen hängen im **Menü** unter „Einzelprojekt" statt daneben; Kurzform „mit / ohne NW Bezug" — [projektartQuickfilter.ts](src/plugins/antraege/filter/projektartQuickfilter.ts)
- Segment-Knöpfe können ein Untermenü tragen (`unterpunkte`, opt-in — die fünf anderen Nutzer von `SegGroup` bleiben unverändert) — [CollapsibleSeg.tsx](src/plugins/antraege/filter/CollapsibleSeg.tsx)
- Projektart-Zähler folgen dem gewählten Antragstyp (einseitig: „FuE" schneidet mit, die eigene Auswahl nicht) — [QuickfilterToolbar.tsx](src/plugins/antraege/filter/QuickfilterToolbar.tsx)
- Mehrere Filter-Pillen dürfen gleichzeitig offen sein; der Zustand ist eine Menge statt eines Einzelwerts, alter Einzelwert wird gelesen — [quickfilterExpanded.ts](src/plugins/antraege/filter/quickfilterExpanded.ts)
- Eine filternde Pille ist markiert — zugeklappt Rahmen + Grund, aufgeklappt die Beschriftung — [CollapsibleSeg.tsx](src/plugins/antraege/filter/CollapsibleSeg.tsx)

### v3.12.0 — Tabelle: stehende Kopfzeile, Darstellungs-Menue, verdichteter Seitenkopf (August 2026)

MINOR — Der Seitenkopf der Fördertabelle war auf fünf Zeilen gewachsen: die drei Schalter „Ansicht", „Gruppierung" und „Beendet" belegten rechts rund 640 px und drängten die Quickfilter in einen Umbruch, unter dem die Trefferzahl noch eine eigene, links leere Zeile bekam. Nachgemessen bei 1.226 px Inhaltsbreite: 70 px weniger Kopf, zwei Zeilen weg. Und beim Blättern nach unten verschwand die Kopfzeile — bei 21 Spalten weiß dann niemand mehr, welche Spalte er liest.

- Die drei Achsen teilen sich ein Menü „Darstellung"; der Knopf nennt nur, was vom Standard abweicht — [darstellungsAchsen.ts](src/plugins/antraege/darstellungsAchsen.ts)
- Trefferzahl reitet im Umbruch der Quickfilter mit (Slot in der Toolbar, kein Geschwister — als Nachbar bricht sie immer eigenständig um) — [QuickfilterToolbar.tsx](src/plugins/antraege/filter/QuickfilterToolbar.tsx)
- Kopf- und Rubrikzeile bleiben stehen; dafür wird der Tabellenkasten selbst der senkrechte Scroller — [SortableTable.tsx](src/components/data-table/SortableTable.tsx)
- Lade-Streifen wandert MIT in den Scroller (`footerSlot`, `sticky left-0`) und der Beobachtungs-Bereich auf den Kasten — sonst lädt die Seite sofort alles nach oder gar nichts mehr — [AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx)
- Platz für den senkrechten Scrollbalken fest reserviert: er erschien sonst erst nach der Breitenmessung und verengte genau das gemessene Element — [SortableTable.tsx](src/components/data-table/SortableTable.tsx)

### v3.11.0 — Fristen-Stoppuhr: die Uhr haelt mit der Erstentscheidung an (August 2026)

MINOR — Die 90-Tage-Uhr rechnete für **jeden** Antrag bis heute weiter, auch für einen 2018 abgelehnten: CRISPROMIC zeigte „seit 2 760 T" — exakt Eingang + 90 Tage. Die Arithmetik stimmte, das Kriterium fehlte. Ebenso schwer wog die Gegenrichtung: „keine Basis", „keine Frist nötig" und „terminal" waren alle dieselbe leere Zelle. Das Haltekriterium existierte bereits — aber nur im Vorgangs-Board, als feste Code-Menge.

- Frist liefert einen **Zustand** statt einer Zahl (`laeuft` / `angehalten` / `nicht_berechenbar`), jeder mit eigener Anzeige und eigenem Grund — [frist-ergebnis.ts](src/core/services/csv/frist-ergebnis.ts)
- Das Haltekriterium ist **Katalogdatum am Verfahrensschritt** (`fristLaeuft`) und damit ohne Release änderbar; Seed hält ab „Entscheidung" an — [zah-phasen.ts](src/core/status/zah-phasen.ts)
- Haltedatum als Kaskade Journal → Datumsfeld derselben Phase → „unbekannt"; nie ersatzweise weiterlaufen lassen — [haltedatum.ts](src/core/status/haltedatum.ts)
- Tab-Zähler „Überfällig"/„Diese Woche" fragen dieselbe Engine wie die Spalte daneben (vorher Eingangsalter mit eigenen 84/90-Literalen) — [views.ts](src/plugins/antraege/views.ts)
- Guard `no-inline-frist-arithmetik`: die Zahl 90 gehört ins Fristmodul, `ANTRAG_SLA_DAYS` benutzen ist erwünscht — [codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)

### v3.10.0 — Team-Antwort im Board, Verwaltung fuer alle PL (August 2026)

MINOR — Eine öffentliche Team-Antwort war im Board unsichtbar: `kurator_response` lag in jedem Kanban-Item, wurde aber nirgends gerendert, und das einzige Signal war ein Badge hinter `mine && unread`. `mine` wiederum war kaputt — erfasst wurde unter `profile.name`, verglichen gegen das Kürzel, also galt jedes eigene Ticket als fremd („Von mir" leer, keine Glocke, kein „Ergänzen").

- „Antwort"-Pill auf Karte und Listenzeile, solange eine Antwort existiert; Wortlaut im Hover, Antworttext ist mitsuchbar — [FeedbackAntwortHover.tsx](src/components/feedback/FeedbackAntwortHover.tsx)
- Zugehörigkeit über eine tolerante Identität (Kürzel UND Profilname), Schreiben behält EINE kanonische Id; Guard `no-direct-feedback-user-id-compare` — [feedbackIdentitaet.ts](src/core/services/feedback/feedbackIdentitaet.ts)
- „Ergänzen" hängt nur noch am Schreibrecht: jedes PL-Mitglied darf jedes Ticket fortschreiben (Beta) — [FeedbackBoardDetail.tsx](src/components/feedback/FeedbackBoardDetail.tsx)
- Schreib-Lage `geschrieben|kein-schreibrecht|fehler`: „Gespeichert" nur noch bei echtem Write, und ein unlesbarer Stand dampft den Teambestand nicht mehr auf ein Ticket ein — [feedbackSharedFile.ts](src/core/services/feedback/feedbackSharedFile.ts)
- Einstellungen-Reiter fragt die Datei-Lage statt der nie gefüllten Legacy-Registrierung; System-Prompt kommt endlich vom Share — [FeedbackConfigPanel.tsx](src/plugins/feedback-board/verwaltung/FeedbackConfigPanel.tsx)

### v3.9.0 — Tabelle: Ueberschuss an abgeschnittene Spalten, Filter-Chevron on demand, FKZ-Kopierknopf ueberlagert (August 2026)

MINOR — Schmale Spalten waren breiter als ihr Inhalt: `min-width:100%` streckte im Scroll-Modus ALLE Prozent-`<col>` proportional (nachgemessen +25 % je Spalte), der Kopf reservierte 38 px für Sortierpfeil und Filter-Chevron, und der FKZ-Kopierknopf belegte 28 px für etwas, das nur beim Hover erscheint. Ergebnis: FKZ 179→111, die vier Kürzel-Spalten 101→64, Frist 116→90.

- Freier Platz geht nur noch an Spalten, deren Text `maxWidth` kürzt; ein gezogener Override schützt seine Spalte, der Rest parkt in einer zellenlosen Füller-`<col>` — [tableSizing.ts](src/components/data-table/tableSizing.ts)
- Filter-Chevron verlässt den Textfluss und erscheint beim Überfahren; dauerhaft sichtbar (und im Kopf eingerechnet) nur, wo ein Filter liegt — [TableHeadRows.tsx](src/components/data-table/TableHeadRows.tsx)
- FKZ-Kopierknopf liegt im rechten Zellpolster statt in einem reservierten Slot — [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)
- Kopf-Messmodell korrigiert: `<th>` ist fett, und `button` hebt `uppercase` auf („Status und nächster Schritt" war 31 px zu breit veranschlagt, ZTP 1,2 px zu schmal) — [textMessung.ts](src/components/data-table/messung/textMessung.ts)
- Drag-Rückrechnung deckelt `scale` auf 1 — mit verteiltem Überschuss hätte ein Zug an einer unverteilten Spalte ihre Breite durch 1,4 geteilt gespeichert — [useColumnResize.ts](src/components/data-table/useColumnResize.ts)

### v3.8.0 — Projektart: Einzel- und Kooperationsprojekt als eigene Achse (August 2026)

MINOR — Einzel- vs. Kooperationsprojekt war fachlich längst da (die Aufbereitung beschriftet den 1-TV-Fall so), aber nirgends filterbar. Einzelprojekt = FuE/DS mit genau einem Teilvorhaben, Kooperationsprojekt mit mehreren; der Netzwerkbezug (16KN/16EP) liegt als zwei Unterstufen darin.

- Neue Pille „Projektart" neben „Antragstyp", fünf Stufen mit Zählern und Klartext-Tooltips — [QuickfilterToolbar.tsx](src/plugins/antraege/filter/QuickfilterToolbar.tsx)
- Abgeleitete Klassifikation als eigener Pipeline-Schritt neben PreCheck, nicht als Seed-Facette (die Engine machte aus einem Nicht-Slim-Feld still ein `() => true`) — [projektartQuickfilter.ts](src/plugins/antraege/filter/projektartQuickfilter.ts)
- Die TV-Zahl kommt aus `verbundById`, also filter-unabhängig: ein Statusfilter macht aus einem Kooperationsprojekt kein Einzelprojekt — [useFilteredAntraege.ts](src/plugins/antraege/useFilteredAntraege.ts)
- `istEinzelFkz` (16EP) als Gegenstück zu `extractNetzwerkId` (16KN) — bewusst nicht „alles außer 16KN" — [netzwerk.ts](src/plugins/antraege/netzwerk.ts)
- Zähler und Filter laufen über dieselbe Prädikatsfunktion; ein Test hält fest, dass `mit + ohne < Einzelprojekt` gelten darf (16DS gehört in keine Unterstufe) — [projektartQuickfilter.test.ts](src/plugins/antraege/__tests__/projektartQuickfilter.test.ts)

### v3.7.0 — Antragseingang-Filter nach Monaten, neueste zuerst (August 2026)

MINOR — Der Spaltenfilter bucketete auf das Jahr und sortierte aufsteigend: die Liste startete bei 2018, das aktuelle Jahr stand hinter einer Scroll-Strecke. Nebenbefund: Zeilen ohne lesbares Datum lieferten `''`, waren nicht anwählbar und fielen still aus der Tabelle, sobald ein Jahr angehakt war.

- Filterwert ist der Monat, das Jahr die Gruppe; neueste zuerst, Jahre zugeklappt — [spaltenFilterWerte.ts](src/plugins/antraege/spaltenFilterWerte.ts)
- Das Dropdown wird mit `groupOf` zweistufig (`TfTree`, Tri-State); ohne die Prop bleibt es die flache Liste wie bisher — [ColumnFilterDropdown.tsx](src/components/data-table/ColumnFilterDropdown.tsx)
- Reiner Baum-Adapter; Werte außerhalb der Suchtreffer überleben einen Klick — [filterBaum.ts](src/components/data-table/filterBaum.ts)
- `SortableColumn.filterSort` / `.filterGroupOf`: Reihenfolge-Hoheit liegt bei der Spalte, nicht beim Dropdown — [types.ts](src/components/data-table/types.ts)
- Zeilen ohne Datum stehen als „(leer)" am Ende und bleiben wählbar — [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)

### v3.6.1 — Abschnitts-Bänder zählen den Abschnitt, nicht die Seite (August 2026)

PATCH — Die Zahl an einem Abschnittskopf kam aus den GERENDERTEN Zeilen, nicht aus dem Abschnitt: sie wuchs beim Nachladen, und ihre Summe ergab exakt die Seitengröße (gemessen: „AAt 48" + „AM 12" = 60). Betraf Tabelle (status/netzwerk/fb/ab) und die Status-Abschnitte in Listen- und Karten-Ansicht.

- Abschnitts-Zahlen kommen aus dem vollen Satz statt aus der Seite — eine Zählung für alle drei Ansichten — [zaehleJeAbschnitt](src/plugins/antraege/antragGroups.ts)
- Abschnitts-Id einer Gruppe hat eine Heimat (`statusSectionIdOf`); Zähler und Sektionierung können nicht mehr verschiedene Schlüssel bilden — [antragGroups.ts](src/plugins/antraege/antragGroups.ts)
- Der Arbeitsvorrat/Beendet-Zweig braucht dafür keine Sonderbehandlung mehr — er läuft über denselben Weg — [AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx)

### v3.6.0 — Beendet-Schalter: eigene Achse statt Kopplung an die Gruppierung (August 2026)

MINOR — Der Arbeitsvorrat/Beendet-Split hing an „Gruppierung: Keine". Das war eine stille Kopplung: wer gruppierte, verlor die Trennung. Als die Verbund-Verdichtung mit v3.4 aus der Gruppierung auf die Ansicht-Achse wanderte, tauchte der Split unangekündigt bei allen auf, die zuvor „Gruppierung: Verbund" stehen hatten.

- Dritter Toolbar-Schalter „Beendet: ausgeblendet | eingeblendet" im Reiter „Alle", unabhängig von Ansicht und Gruppierung — [arbeitsvorrat.ts](src/plugins/antraege/arbeitsvorrat.ts)
- Ausgeblendete Zeilen bleiben unter **jeder** Gruppierung abzählbar: Streifen unter der Liste mit Zahl und Aufschlüsselung — [AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx)
- Die zwei Bänder (Arbeitsvorrat/Beendet) erscheinen nur noch, wo sie etwas trennen — bei „Gruppierung: Keine" und eingeblendetem Beendet-Teil — [AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx)
- Drei Notbremsen in EINER reinen Funktion statt verstreut: nichts Beendetes, nur Beendetes, laufende Suche — [istBeendetVersteckt](src/plugins/antraege/arbeitsvorrat.ts)
- Schalter-Zustand behält seinen localStorage-Schlüssel — ein neuer hätte jeden bestehenden Wunsch verworfen — [useBeendetSichtbarkeit.ts](src/plugins/antraege/useBeendetSichtbarkeit.ts)

### v3.5.0 — Tabelle: Auto-Spaltenbreiten, sichtbarer Breiten-Griff, Sticky-Kopf, Spalten-Sets (August 2026)

MINOR — Seit v3.3.0 sind 24 Spalten plus die Ordner-Spalten des Statuskatalogs wählbar; die Tabelle war dafür nicht gebaut. Die Breiten stammten aus handgepflegten Pixelwerten statt aus dem Inhalt, der Griff für die Gesamtbreite lag im Scroll-Zustand außerhalb des Sichtfelds (gemessen: 731 px rechts daneben), und beim Scrollen verschwanden Kopfzeile und FKZ.

- Spaltenbreiten kommen aus dem Inhalt statt aus gepflegten Pixelwerten (Kette: gezogen > gemessen > gepflegt); gemessen wird der volle gefilterte Satz, damit Nachladen und Sortieren die Breiten nicht verschieben — [messung/spaltenBreite.ts](src/components/data-table/messung/spaltenBreite.ts)
- Rubrik-Kopfzeile über den Spaltenköpfen; dafür ist die Registry nach Rubrik geordnet (Antrag · Zuständigkeit · Antragsdaten · Status · Termine) — Tabelle und XLSX-Export ziehen gemeinsam mit — [rubrikSpannen.ts](src/components/data-table/rubrikSpannen.ts)
- Spalten-Picker mit Suchfeld (ab 12 Spalten), Zähler „x von y" und Rubrik-Schalter „alle/keine"; die erzwungene MA-Spalte steht jetzt als „auto" drin statt zu fehlen — [columnPickerLogik.ts](src/components/data-table/columnPickerLogik.ts)
- Die FKZ-Spalte bleibt beim waagerechten Scrollen stehen; die Beschriftung der Gruppierungs-Bänder ebenfalls — [TableBody.tsx](src/components/data-table/TableBody.tsx)
- Doppelklick auf den Spaltengriff verwirft eine gezogene Breite, statt die gemessene festzuschreiben — die Spalte folgt danach wieder dem Inhalt — [columnWidthStorage.ts](src/components/data-table/columnWidthStorage.ts)
- Der Griff für die Tabellenbreite steht jetzt neben dem Scroll-Container statt darin — bei vielen Spalten lag er außerhalb des Sichtfelds und war nur 15 px hoch — [TotalWidthGrip.tsx](src/components/data-table/TotalWidthGrip.tsx)
- Tabellen-Baustein entlang seiner Verantwortungen zerlegt — Layout-Rechnung, Resize, Griff, Kopf, Körper je eigene Datei; die drei Größen-Modi sind erstmals testbar statt nur im Dateikopf beschrieben — [tableLayout.ts](src/components/data-table/tableLayout.ts)
- Datumsspalten zeigen `30.07.2018` statt `2018-07-30`; der XLSX-Export schrieb unter „FB Status", „PreCheck Status" und allen Ordner-Spalten das ISO-Datum statt des Labels — [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)
- Ein Klick ohne Ziehen auf den Spaltengriff schrieb bisher eine Spaltenbreite (im gestauchten Modus sogar eine verrechnete) — [useColumnResize.ts](src/components/data-table/useColumnResize.ts)

### v3.4.0 — Glossar (August 2026)

MINOR — Statuswerte, Kürzel, Trigger-Herkunft und Zieltage sind gepflegt, waren aber nur über „Vorgangs-Regeln" erreichbar — ein Kurationswerkzeug voller Eingabefelder. Wer wissen will, was RNE heißt, öffnet es nicht. Dazu beschrieb der Begriffs-Abschnitt in „Über die App" einen Stand vor dem Vorgangssystem.

- Neues Modul „Glossar" unter Werkzeuge, ohne Feature-Flag: ein Suchfeld über Abkürzungen, Statuswerte, Kürzel und To-do-Regeln — [src/plugins/glossar/](src/plugins/glossar/), Seed in [abkuerzungen.seed.ts](src/core/glossar/abkuerzungen.seed.ts)
- Kürzel-Detail zeigt „Löst aus" (Trigger-Wirkung nach Wortlaut gebündelt) und „Wird verwendet von" (prüfende Regeln) — [navigator.ts](src/core/status/navigator.ts) `wirkungGruppen`, Rückwärts-Index über `todoFeld()` (Pitfall #44)
- Rollensicht „Für meine Rolle wichtig": Kürzel je Fachrolle nach Vorkommen, Filter auf die Richtlinie, neutrale Kürzel abgesetzt — [RollenSicht.tsx](src/plugins/glossar/RollenSicht.tsx)
- Begriffe richtiggestellt und ins Glossar umgezogen: „Rollen" getrennt in Ausgabe/Berechtigung und Fachrolle, Verfahrensschritt und Arbeitsliste ergänzt — [_app.md](docs/feedback-kontext/_app.md)
- Hilfe-Dialog: Titel 18 px über Abschnitten mit 16 px — die Hierarchie stand auf dem Kopf; dazu ein Weg ins Glossar aus Hilfe-Kopfzeile und Herleitungs-Popover

### v3.3.0 — Zuständigkeits-Spalten und geordneter Spalten-Picker (August 2026)

MINOR — Der Reiter „Begleitung" filtert nach den Antragsphasen-Kürzeln (TIB/BIB), zeigt aber Anträge in der Begleitphase — wer sie begleitet (ZTP/PFM), stand nirgends. Und der Spalten-Picker war eine ungegliederte Liste von 37 Einträgen.

- Vier Zuständigkeits-Spalten statt einer: TIB · BIB · ZTP · PFM, BIB ab Werk eingeblendet — [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx)
- Spalten-Picker nach Rubriken (Antrag/Zuständigkeit/Status/Termine/Ordner je Ebene), Überschriften bleiben beim Scrollen stehen — [ColumnPicker.tsx](src/components/data-table/ColumnPicker.tsx), opt-in über `SortableColumn.gruppe`
- Neue Standardspalten werden bestehenden Auswahlen einmalig nachgereicht statt still zu fehlen — [useAntraegeColumnsStore.ts](src/plugins/antraege/useAntraegeColumnsStore.ts)
- Kürzel-Pills ohne Versalien: „StE" bleibt „StE" — [MaKuerzelBadge.tsx](src/plugins/antraege/MaKuerzelBadge.tsx)

### v3.2.2 — Favicon prod auf ZIM-Lila (August 2026)

PATCH — Das Schiefer-Blau aus v3.2.1 war ein Platzhalter meiner Wahl; prod trägt jetzt die Hausfarbe.

- `build.faviconColor` der prod-Variante auf `#5C2483` — [prod.config.json](configs/prod.config.json); Weiß darauf 10,3:1
- Farbliste im Branding-Runbook nachgezogen, inklusive der Ansage, dass der Fallback `#506786` bewusst keiner Variante gehört — [change-app-branding.md](docs/agents/change-app-branding.md)

### v3.2.1 — Tab-Titel auf ZIM umgestellt + Favicon je Variante (August 2026)

PATCH — Der prod-Tab hieß „ZAH prod" — ein Bauzeit-Etikett vor Endnutzern, während die Datei längst `zim-dashboard.html` heißt. Und die App hatte überhaupt kein Favicon: unter `file://` läuft die `favicon.ico`-Anfrage ins Leere, im Tab stand das generische Blatt.

- Tab-Titel: prod `zim-dashboard`, pl `zim-pl`, dev `zim-dev` — [configs/](configs/prod.config.json). Dateinamen und Sidebar-Label bleiben (`outputFilename` hängt am IndexedDB-Namen)
- Favicon als Inline-`data:`-URI: Monogramm „Z" auf abgerundetem Quadrat, Geometrie auf 16 px gemessen — [scripts/favicon.mjs](scripts/favicon.mjs). Icon-**Dateien** gehen hier nicht: Vite lehnt das Inlinen von Icon-Links ab, singlefile inlined nur JS/CSS
- Neues optionales `build.faviconColor` (`#rrggbb`, validiert): prod schiefer-blau, pl grün, dev orange, local grau — gleichzeitig offene Builds sind im Tab unterscheidbar
- Injektion im bestehenden Hook (jetzt `teamflow-index-html-branding`), der schon Titel und Loader-Label ersetzt — [vite.config.ts](vite.config.ts)
- Guards: Farben paarweise verschieden, kaputte Farbe = Validierungsfehler statt stiller Default, `index.html`-Kopie byte-gleich zu `favicon.mjs` — [favicon.test.ts](src/config/__tests__/favicon.test.ts)

### v3.2.0 — Tabelle: Ansicht und Gruppierung getrennt (August 2026)

MINOR — Die Pille „Gruppierung" mischte zwei Dinge: „Status" bildete Abschnitte, „Verbund" verdichtete Teilvorhaben zu einer Zeile. Weil beides im selben Schalter saß, schlossen sie sich aus — wer nach Status gruppieren wollte, verlor die Verdichtung. Jetzt sind es zwei Achsen.

- Neue Achse **Ansicht** (`antrag` / `antrag-mit-tv`) mit eigenem Store-Slot; `verbund` ist als Gruppierung entfallen — [tableGrouping.ts](src/plugins/antraege/tableGrouping.ts), [store.ts](src/plugins/antraege/store.ts)
- Drei neue Gruppierungen: **NW** (reuse der Netzwerk-Engine inkl. Namens-Index), **FB** (`tib_kuerz`) und **AB** (`bib_kuerz`), alphabetisch, „ohne …" als letzter Abschnitt
- Persistenz-Whitelist kommt aus den Optionen (`istTableGroupingMode`) statt aus einer zweiten Literal-Liste — ein gespeichertes `verbund` fällt dadurch auf `none`
- **Fix:** die Status-Bänder der Tabelle zeigten die rohe Abschnitts-Id („VOR-ENTSCHEIDUNG"); die Beschriftung kommt jetzt vom Builder — [AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx)
- Nachgemessen in `dev:local` (Reiter „Diese Woche", 49 TV): Ansicht „Antrag" → 34 Zeilen, alle Band-Summen = Zeilenzahl, „Ohne Netzwerk" zuletzt, `__tf.fehler()` = 0

### v3.1.0 — Drift-Bilanz und Ist-Stand (August 2026)

MINOR — Der Phasenschnitt wird seit v2.409 in der App kuratiert, prod läuft weiter auf dem Seed — wie weit beide auseinander sind, wusste niemand. Und Beschluss und Umsetzung waren unverbunden: die Klärung sagte bei Code 29 „einig → Abgeschlossen", der Baum hielt ihn ohne Phase, der Widerspruch fiel nirgends auf.

- Neue Bilanz `katalogDrift(fassung, seed)` nach Phasen/Zuordnungen/Zieltagen/Statuswerten/Prominenz, angezeigt als ausklappbare Zeile im Statuswerte-Tab — [katalog-drift.ts](src/core/status/katalog-drift.ts), [README](docs/status-system/README.md). Kein Nachzieh-Knopf: sie stellt fest.
- Gezählt wird die **Sache**, nicht die Katalogzeile — ein Status steht an TV- und Verbund-Feld; ungefiltert meldete die Bilanz jeden Zieltag doppelt (30 statt 17 im Bestand)
- „Zu klären" zeigt je Zeile den **Ist-Stand** des Katalogs mit den Vermerken umgesetzt / noch offen / abweichend beschlossen, dazu den Filter „Nicht umgesetzt" — [gruppen.ts](src/plugins/zu-klaeren/gruppen.ts), [klaerung.md](docs/architecture/klaerung.md)
- Der Export „Seed-Änderungen" kommt aus der **Fassung** statt aus den Antworten ([seedExport.ts](src/plugins/zu-klaeren/seedExport.ts)): am 05.08. nannte er fünf Änderungen, während der Baum zehn Umhängungen und drei Phasenänderungen trug
- `useKlaerung` verglich Fassung und Auslieferung in einer eigenen Schleife — ersetzt durch dieselbe Bilanz; die Pillen-Zahl „30" kommt jetzt aus den Zeilen statt aus dem Code

### v3.0.1 — Kommentar geht nicht mehr still verloren (August 2026)

PATCH — Gemeldet: Kommentar schreiben, senden, Ticket schließen, wieder öffnen — Kommentar weg, ohne jede Meldung. Ursache ist eine Verwechslung zwei Ebenen tiefer: `readText` schluckt jeden Lesefehler und liefert `null`, ununterscheidbar von „Datei gibt es nicht".

- Neue Lage-Unterscheidung `ok`/`leer`/`unlesbar` ([readSharedFileLage](src/core/services/feedback/feedbackSharedFile.ts)); `readSharedFile` bleibt für Leser unverändert
- Schreibende Pfade (`addComment`, `toggleVote`, `sponsorTicket`, `unsponsorTicket`) brechen bei `unlesbar` ab, statt auf leerer Basis zu rechnen — vorher hielten sie das Ticket für nicht existent und verwarfen die Eingabe wortlos
- **Verhinderter Datenverlust:** in derselben Lage schrieb der Vorgang den lokalen Teilbestand über die geteilte Datei — fremde Kommentare/Stimmen wären verschwunden ([addComment.test.ts](src/core/services/feedback/__tests__/addComment.test.ts) hält beides fest)
- Fehlschlag ist jetzt sichtbar und der Text bleibt stehen ([FeedbackCommentThread.tsx](src/components/feedback/FeedbackCommentThread.tsx)) — `useAsyncAction.error` wurde nie gerendert, `ok:false` gar nicht ausgewertet
- Nachgemessen in `dev:local`: Kommentar senden → schließen → öffnen hält (vorher/nachher), kein Hinweis-Banner im Normalfall, `__tf.fehler()` = 0

### v3.0.0 — Build-Konsolidierung: drei Varianten, Module per Zusatzpasswort (August 2026)

MAJOR — Aus fünf Build-Varianten werden drei. `as` und `kurator` unterschieden sich von `pl` nur in Flags bei byte-gleichem Code — die Trennung sparte kein Byte und kostete Pflege (`as` fiel über zwölf Flags zurück, v2.403). Was die Zielgruppen trennte, entscheidet jetzt ein Zusatzpasswort zur Laufzeit.

- `pl`, `as` und `kurator` gehen in einem `zah-pl.html` auf; Auslastung und Kuration liegen dort hinter je einem Zusatzpasswort — [modul-freischaltung.md](docs/architecture/modul-freischaltung.md), Pitfall #51
- Der prod-Build heißt **`zim-dashboard.html`** (vorher `zah-prod.html`) — [prod.config.json](configs/prod.config.json)
- Elf Feature-Flags entfernt (38 → 27): sie trugen überall denselben Wert oder bedienten nur eine abgeschaffte Variante — [feature-flags.ts](src/config/feature-flags.ts)
- Der doppelte Kurator-Login ist weg: `_intern/kurator-config.enc` entfällt, geblieben ist der Build-Weg; die Audit-Identität kommt jetzt aus dem Profilnamen statt aus dem Build-Label — [update-author.ts](src/core/services/infrastructure/update-author.ts)
- Variant-Configs enthalten nur noch ihre Abweichungen (`buildBasis()` als neutrale Basis) — [config-schema.mjs](scripts/config-schema.mjs)

**Migration.** `zim-dashboard.html` leitet einen neuen IndexedDB-Namen ab (`teamflow-zim-dashboard`);
bestehende prod-Installationen laufen **einmalig** durch Onboarding + Ordner-Freigabe + Profil.
Fachdaten gehen nicht verloren — der Share ist die Quelle der Wahrheit, die IDB nur Cache. Die
alte `teamflow-zah-prod`-DB bleibt harmlos liegen und kann über die DevTools gelöscht werden.
Nutzer von `zah-as.html` / `zah-kurator.html` wechseln auf `zah-pl.html` (ebenfalls einmaliger
Erststart). `_intern/kurator-config.enc` wird nicht mehr gelesen.

**Vor dem Rollout**: die Platzhalter-Passwörter ersetzen —
`npm run set-password -- pl --modul auslastung "<pw>"` und `--modul kurator "<pw>"`.

### v2.416.0 — Kommentare im Hover lesen, neue Kommentare sichtbar (August 2026)

MINOR — Die Diskussion an einem Ticket war unsichtbar: das Board zeigte `💬 3` als stumme Zahl, den Inhalt gab es nur nach einem Klick im Detail-Panel. Genau die Tickets mit laufender Diskussion sind aber die wichtigen.

- Hover über den Kommentar-Zähler zeigt die letzten vier Kommentare direkt (gekürzt, scrollbar, „+N ältere") — [FeedbackCommentHover.tsx](src/components/feedback/FeedbackCommentHover.tsx); Klick öffnet weiterhin das Detail
- Thread und Vorschau teilen sich eine Darstellung ([FeedbackCommentList.tsx](src/components/feedback/FeedbackCommentList.tsx)) und eine reine Auswahl-Funktion (`waehleKommentarVorschau` in [feedbackUi.ts](src/components/feedback/feedbackUi.ts))
- Neue Kommentare tragen ein blaues **„+N"** im Kopf der Karte (neben „Antwort") und sind in Vorschau + Thread hinterlegt — [FeedbackKanban.tsx](src/components/feedback/FeedbackKanban.tsx) / [FeedbackCard.tsx](src/components/feedback/FeedbackCard.tsx)
- Gelesen-Stand gerätelokal je Ticket ([kommentarStand.ts](src/components/feedback/kommentarStand.ts) + [useUnreadComments.ts](src/components/feedback/useUnreadComments.ts)); Details + Invarianten in [feedback-system.md](docs/architecture/feedback-system.md)
- Nachgemessen in `dev:local`: Erststart setzt die Baseline und zeigt **kein** „+N"; nach zwei fremden Kommentaren „+2", nach dem Öffnen weg; Vorschau 340×282 mit Innen-Scroll (464 px Inhalt), am schmalen Rand vollständig im Bild; dense-Kopfzeile ohne Überlauf (Antwort + „+1" + Datum in 200 px); `__tf.fehler()` = 0
- `feedbackImprove.test.ts` nach `ISOLATED_TESTS` ([vitest.config.mts](vitest.config.mts)) — sein `screenContext`-Mock hielt der neuen Ladereihenfolge im geteilten Modul-Register nicht stand

### v2.415.2 — Feedback-Karte erzeugt keine verschachtelten Buttons mehr (August 2026)

PATCH — Das Feedback-Board meldete bei jedem Laden zwei React-Fehler: die Vote-Pille (ein `<button>`) saß in der Meta-Zeile innerhalb des Karten-`<button>` — ungültiges HTML.

- Die anklickbare Kartenfläche ist jetzt ein `div role="button"` mit `tabIndex` und Enter-/Leertaste-Handler ([FeedbackCard.tsx](src/components/feedback/FeedbackCard.tsx))
- Gleiches Muster wie die Board-Karte in [FeedbackKanban.tsx](src/components/feedback/FeedbackKanban.tsx); die Sibling-Lösung aus `FeedbackTicketRow.tsx` trägt hier nicht, weil die Pille im Textfluss sitzt statt am Rand
- Klick auf die Pille wählt die Karte weiterhin nicht mit aus — `FeedbackVotePill` stoppt die Propagation bereits selbst
- Nachgemessen in `dev:local`: Liste und Board je frisch geladen `__tf.fehler()` = 0 (vorher 2), `document.querySelectorAll('button button')` = 0
- Geometrie unverändert gegen den Vorher-Wert (Karte 950×96 bei x=259, Titel x=313/w=846, Pille x=1157); Fokusring bleibt (`:focus-visible`), Enter/Leertaste/Klick wählen, Vote zählt hoch und runter

### v2.415.1 — Kommentarfeld waechst mit und ist ziehbar (August 2026)

PATCH — Das Kommentarfeld im Feedback-Detail war einzeilig und fest: wer mehr als einen Satz schrieb, sah den eigenen Text nicht mehr.

- Feld startet auf **drei Zeilen** und **wächst beim Schreiben mit** (Rezept aus dem Chat-Composer), gedeckelt bei 320 px — darüber scrollt es intern ([FeedbackCommentThread.tsx](src/components/feedback/FeedbackCommentThread.tsx))
- Zusätzlich am nativen Anfasser ziehbar (`resize-y`); die gezogene Höhe wird gerätelokal gemerkt, weil das Detail-Panel je Ticket neu mountet
- Auto-Wachsen und Anfasser schreiben beide `style.height` — deshalb setzt das Ziehen die **Mindest**höhe, nicht eine feste Höhe ([berechneKommentarHoehe](src/components/feedback/feedbackUi.ts))
- Erkannt wird das Ziehen an der Zeiger-Geste, nicht per `ResizeObserver`: der könnte Tipp-Wachstum nicht unterscheiden und würde die Mindesthöhe beim Schreiben hochratschen
- Nachgemessen in `dev:local`: leer 70 px, 4 Zeilen 87 px, 20 Zeilen gedeckelt auf 320 px mit internem Scrollen; gezogene 200 px überleben Tastendruck, Ticket-Wechsel und Reload; ohne Ziehen bleibt der Schlüssel leer

### v2.415.0 — Autorschaft der Klaerung ist der Profilname (August 2026)

MINOR — Autorschaft ist eine Person, das Bearbeiter-Kürzel eine Rolle im Fachsystem. Projektleitung und Kuration haben keines und waren damit von der Klärung ausgesperrt — ausgerechnet die zwei Rollen, die den Phasenschnitt kuratieren.

- **Der Autor kommt aus `UserProfile.name`**, nicht mehr aus `bearbeiter_kuerzel`; gesperrt wird nur noch, wenn der Name leer ist ([useKlaerung.ts](src/plugins/zu-klaeren/useKlaerung.ts), `istAntwortfaehig` in [konsens.ts](src/plugins/zu-klaeren/konsens.ts))
- **Die Sonderfälle `alle` und `MUE,SCH` entfallen** — sie waren Sammelwerte des Kürzel-Felds; ein Profilname meint immer genau einen Menschen
- **Zwei Formen statt einer**: `normalisiereAutor` keyt Faltung und Dateiname, `anzeigeAutor` steht in der Datei, in Spaltenköpfen und im Export — sonst läse man „THOMAS HÜBSCH" ([typen.ts](src/plugins/zu-klaeren/typen.ts), `KlaerungStand.namen`)
- Der Share trug vorher **eine** Autor-Datei mit zwei Zeilen, beide von derselben Abnahme und die zweite ein Widerruf — kein wirksames Urteil, kein Kommentar, also keine Migration nötig ([klaerung.md](docs/architecture/klaerung.md))
- Nachgemessen in `dev:local` mit Profil „Local Dev" (Kürzel `alle`, bisher gesperrt): Urteil und Beitrag geschrieben, `LOCAL_DEV.jsonl` trägt `"autor":"Local Dev"`, Anzeige „Rückfrage von Local Dev", beides zurückgezogen — `__tf.fehler()` = 0

### v2.414.0 — Rotation der Fassungsdatei mit Archiv (August 2026)

MINOR — `_intern/status-katalog.json` trug 18 Fassungen à ~250 KB und wurde bei **jedem** App-Start vollständig gelesen und geparst; mit der `.backup` daneben waren das ~7 MB auf dem Share. Gelöscht wird nichts — die Versionierung existiert, damit man zurückkann.

- **Die jüngsten acht Fassungen bleiben in der Hauptdatei, ältere wandern nach `_intern/status-katalog-archiv.json`** — reine Aufteilung in [katalog-rotation.ts](src/core/status/katalog-rotation.ts), angewandt im Schreibpfad ([katalog-share.ts](src/core/status/katalog-share.ts))
- **Archiv zuerst, Hauptdatei danach**: ohne Schreibrecht aufs Archiv wird nicht rotiert und die Hauptdatei bleibt vollständig — lieber eine große Datei als eine verlorene Fassung (viertes Sidecar-Profil in [add-sidecar-persistence.md](docs/agents/add-sidecar-persistence.md), Pitfall #23)
- **Die aktive Fassung bleibt immer in der Hauptdatei**, auch wenn sie alt ist — sonst müsste jeder Client beim Start doch das Archiv lesen
- **Das Versions-Panel kennzeichnet archivierte Fassungen und lädt das Archiv nach, sobald es offen ist**; `reaktivieren` fällt auf das Archiv zurück, wenn die lokale IDB die Fassung nicht kennt ([StatusCockpitPage.tsx](src/plugins/status-cockpit/StatusCockpitPage.tsx), [useStatusCockpit.ts](src/plugins/status-cockpit/useStatusCockpit.ts))
- Am echten Share gemessen: Hauptdatei 3,47 → 2,07 MB, Archiv 2,28 MB, 18 Fassungen lückenlos; v3 aus der IDB gelöscht und über den Archivpfad reaktiviert (`__tf.fehler()` = 0)

### v2.413.4 — Zu-klaeren-Tabelle vertikal verdichtet (August 2026)

PATCH — Die Tabelle wird im Fachtermin per Bildschirmfreigabe durchgegangen; 30 Zeilen à 58,5 px passten auf keinen Bildschirm. Treiber war das einzige zweizeilige Label: „gehört nach …" machte jede Zeile 46 px hoch statt 28 px. Reine Darstellung, kein Verhalten.

- **Mittlerer Antwortknopf heißt „andere"** (Tooltip trägt den ganzen Satz) — drei gleich kurze Wörter, kein Umbruch ([labels.ts](src/plugins/zu-klaeren/labels.ts))
- **Die drei Knöpfe sitzen als Streifen auf gemeinsamer Kante** statt einzeln mit Zwischenraum: 254 → 207 px breit, 46 → 22 px hoch ([AntwortZelle.tsx](src/plugins/zu-klaeren/AntwortZelle.tsx)); das geteilte `ToggleChip` bleibt unangetastet
- **Keine Linie je Datenzeile mehr** (Gruppenkopf gliedert, `hover` führt), kleineres Zeilenpolster ([PunkteTabelle.tsx](src/plugins/zu-klaeren/PunkteTabelle.tsx))
- **Spalte „Stand" erscheint erst, wenn eine Zeile etwas meldet** — eine Quelle für Anzeige und Sichtbarkeit (`standMarke`/`zeigtStand` in [gruppen.ts](src/plugins/zu-klaeren/gruppen.ts)); die 132 px gehen an die Bezeichnung
- Nachgemessen in `dev:local` bei 1440×900: Zeile 58,5 → 30 px, Gruppenkopf 33 → 25 px, Tabelle 2042 → 1122 px (−45 %); für einen Bildschirm ohne Scrollen fehlen weiter 328 px — nicht durch kleinere Schrift erzwungen (12 px bleibt)

### v2.413.3 — Jahres-Menue heisst durchgaengig „Jahre" (August 2026)

PATCH — Nachzug zu v2.413.2: „Letzte 3 Jahre" neben „Alle Jahrgänge" im selben Menü war halb umbenannt.

- **Alle Beschriftungen des Jahres-Menüs sprechen von „Jahren"** — leere Auswahl „Alle Jahre", Mehrfachauswahl „N Jahre" ([VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx))
- Nachgemessen in `dev:local` über alle vier Zustände: Vorbelegung „Letzte 3 Jahre", leer „Alle Jahre", ein Jahr „2026", zwei Jahre „2 Jahre" (Tooltip „2026, 2025")

### v2.413.2 — Jahres-Filter heisst „Letzte 3 Jahre" (August 2026)

PATCH — Der Jahres-Filter des Vorgangs-Boards nannte sich „Letzte 3 Jahrgänge"; gemeint sind schlicht die letzten drei Jahre des Antragseingangs.

- **Schnellweg + Button-Beschriftung heißen „Letzte 3 Jahre"** statt „Letzte 3 Jahrgänge" ([VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx)); die übrigen Beschriftungen des Menüs („Alle Jahrgänge", „N Jahrgänge") bleiben unverändert

### v2.413.1 — Arbeitsliste entscheidung heisst Zu entscheiden (August 2026)

PATCH — „Entscheidungsreif" war ein unschrumpfbares Einzelwort von 117 px und passte in die 170-px-Lanes des Kanban nur mit Ellipse — abgekürzt las es sich wieder wie der Verfahrensschritt „Entscheidung", also genau die Verwechslung, die v2.409 beseitigt hat. Detail: [status-achsen.md](docs/architecture/status-achsen.md).

- **Arbeitsliste `entscheidung` heißt „Zu entscheiden"** (Kurzform „Zu entsch.") — bricht an der Wortgrenze und reiht sich neben „Zu bearbeiten" in dieselbe Frageform ein ([status-category-labels.ts](src/core/utils/status-category-labels.ts))
- Im Kanban nachgemessen bei 1280 und 1024 px über sieben Lanes: **keine Bezeichnung kürzt mehr ab** (83 px statt 117 in einer 83-px-Spur); die Leitplanken in [KanbanBoard.tsx](src/components/kanban/KanbanBoard.tsx) bleiben für die nächste lange Bezeichnung

### v2.413.0 — Regel-Werkstatt: Wirkung, Probelauf, Straenge (August 2026)

MINOR — Die To-do-Regeln sollen künftig von AB- und FB-Vertretern selbst festgelegt werden. Der Editor trug bereits; es fehlte alles vor und nach dem Bearbeiten: die Wirkung einer Regel am Bestand, die Probe am echten Fall, die Zahl vor dem Scharfschalten. Detail: [vorgangssystem.md §11a](docs/architecture/vorgangssystem.md).

- **Wirkung je Regel am Bestand messen** — „trifft 153 · gewinnt 43" macht die Kaskade sichtbar; Sperren zählen, wie oft sie greifen ([regel-wirkung.ts](src/core/status/regel-wirkung.ts), [useRegelWirkung.ts](src/plugins/status-cockpit/useRegelWirkung.ts))
- **Probe am Fall**: Aktenzeichen eingeben, Ergebnis der Engine samt Sperren und Feldwerten — dieselbe Ansicht wie am Antrag ([RegelProbelauf.tsx](src/plugins/status-cockpit/RegelProbelauf.tsx))
- **Änderungsmessung vor dem Speichern**: beide Fassungen über denselben Bestand, gruppiert alt → neu — gemessen, nicht geschätzt ([regel-aenderung.ts](src/core/status/regel-aenderung.ts))
- **Sperren greifen nach Strang** statt nach sieben Regel-Ids; eine später ergänzte Regel gehört automatisch dazu ([regelsatz.ts](src/core/status/regelsatz.ts), Pitfall #51)
- **Begründung je Regel** — Herkunft und Beschluss, überlebt Speichern, Export/Import und Nachziehen ([typen.ts](src/core/status/typen.ts))

### v2.412.0 — Vorgangs-Regeln: Klaerung, Trigger-Herkunft, Benennung (August 2026)

MINOR — Vor der AB-Sitzung fehlten zwei Dinge: die Antworten der Klärung hingen an einer Id, die sich beim nächsten eingefügten Punkt verschoben hätte, und in der App ließ sich nicht nachsehen, wodurch ein Status überhaupt entsteht. Dazu die Benennung: unter „Status-Katalog" vermutete niemand die Regeln. Detail: [klaerung.md](docs/architecture/klaerung.md), [vorgangssystem.md](docs/architecture/vorgangssystem.md).

- **Grundsatzfragen tragen stabile Ids**; bereits geschriebene Antworten werden beim Lesen übersetzt, nicht migriert (append-only Ablage) ([seed-phasenschnitt.ts](src/plugins/zu-klaeren/seed-phasenschnitt.ts), [fold.ts](src/plugins/zu-klaeren/fold.ts), Guard `no-index-punkt-id`)
- **Vier neue Grundsatzfragen** aus der Bestands-Erhebung: PreCheck jenseits „beantragt", PreCheck-Vollständigkeit, Zieltage als Soll oder Ist, Abgrenzung 31/33/34
- **„Wodurch dieser Status entsteht"** am Statuswert — setzende Kürzel mit Rolle, Ebene und Richtlinien, gebündelt statt neunmal derselbe Satz ([trigger-herkunft.ts](src/core/status/trigger-herkunft.ts), [StatusHerkunftBlock.tsx](src/plugins/status-cockpit/StatusHerkunftBlock.tsx))
- **Reiter benannt und erklärt**: Statuswerte / Kürzel / To-do-Regeln, je mit einem Zwecksatz ([labels.ts](src/plugins/status-cockpit/labels.ts))
- **Plugin heißt „Vorgangs-Regeln"** und ist mit dem Vorgangs-Board in beide Richtungen verknüpft; Route, Ordner und Id bleiben `status-cockpit` ([index.ts](src/plugins/status-cockpit/index.ts))

### v2.411.0 — Profilhaken benannt, Reitergruppen getrennt, Lane-Zaehler sichtbar (August 2026)

MINOR — Nachlese zu v2.404/v2.410 samt Sichtprüfung am echten Bestand. Der Profilhaken hieß seit der Trennung von Antrags- und Begleitphase falsch, die Reiterleiste zeigte zwei Bestandssichten und drei Zeitschnitte als eine Reihe, und die Prüfung fand zwei Stellen, an denen Text schlicht verschwand. Detail: [status-achsen.md](docs/architecture/status-achsen.md).

- **Profilhaken heißt jetzt „Meine ZTP-/PFM-Zuständigkeiten mitzählen"** und benennt die Folge ohne Haken genau, statt Sichtbarkeit zu suggerieren ([ProfilTab.tsx](src/plugins/einstellungen/ProfilTab.tsx))
- **Trenner in der Reiterleiste** vor „Diese Woche" — additiver Slot `trennerDavor` am Primitiv, keine zweite Leiste ([ScopeTabs.tsx](src/components/ui/ScopeTabs.tsx), [AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx))
- **Kanban-Lane „Entscheidungsreif": der Zähler war vollständig abgeschnitten** — die Zahl weicht nie mehr, die Bezeichnung als letzte ([KanbanBoard.tsx](src/components/kanban/KanbanBoard.tsx))
- **Tooltips am rechten Fensterrand** schrumpften auf einen Rest-Streifen (gemessen 151 statt 300 px) statt zu klemmen ([Tooltip.tsx](src/components/ui/Tooltip.tsx))
- `file://`-Tauglichkeit des `zah-pl`-Builds statisch geprüft: keine absoluten Asset-Pfade, kein relativer `fetch`, kein Datei-Worker; Restrisiken als Prüfliste im Protokoll (Doppelklick-Test bleibt Handtest)

### v2.410.0 — Verfahrensschritt kuratierbar, Arbeitsliste unterscheidbar (August 2026)

MINOR — Die Abstimmung mit AB und FB hat ergeben, dass der Phasenzuschnitt strittig ist und mehrfach geändert wird; ein Release je Iteration ist dafür zu langsam. Zugleich hießen vier der neun Arbeitslisten wortgleich wie ein Verfahrensschritt — zwei Spalten mit halb denselben Wörtern, und keine sagte wozu. Detail: [status-achsen.md](docs/architecture/status-achsen.md).

- **ZAH-Phasen sind kuratierbare Daten**: 3 bis 9 Schritte, freie Beschriftung, dazu Arbeitslisten-Vorgabe und Zieltage-Relevanz je Schritt ([zah-phasen.ts](src/core/status/zah-phasen.ts), [zah-phasen-edit.ts](src/core/status/zah-phasen-edit.ts))
- **Baum-Editor im Status-Katalog** — Statuswert per Zug umhängen, Schritte sortieren und umbenennen; Löschen fragt „wohin mit den n Statuswerten?" ([PhasenBaum.tsx](src/plugins/status-cockpit/PhasenBaum.tsx))
- **Vier Modul-Ebenen-Leser folgen jetzt der Fassung** statt beim Import einzufrieren: Sidebar-Gruppierung, Verfahrensleiste, Filter, Kategorie-Ableitung ([statusGroups.ts](src/plugins/antraege/filter/statusGroups.ts), [statusZuStepperPosition.ts](src/plugins/antraege/statusZuStepperPosition.ts))
- **Arbeitslisten umbenannt** (offen → „Zu bearbeiten", abgeschlossen → „Erledigt", …) und aus EINER Quelle bezogen; Reiter und Abschnitte tragen eigene Aggregatnamen ([status-category-labels.ts](src/core/utils/status-category-labels.ts))
- Abschnitte werden über stabile Ids gekeyt statt über Anzeigenamen — **der gespeicherte Zuklapp-Zustand der Status-Abschnitte geht dabei einmalig verloren** ([useStatusSectionCollapsed.ts](src/plugins/antraege/useStatusSectionCollapsed.ts))

### v2.409.0 — Konfliktschutz beim Veröffentlichen der Katalog-Fassung (August 2026)

MINOR — Der Katalog wird ab sofort von mehreren PL-Personen asynchron gepflegt; der Schreibweg war für einen Schreiber gebaut. `naechsteVersionsnummer` zählte die lokale Liste hoch und `schreibeKatalogAufShare` ersetzte die Datei damit — die fremde Fassung war überschrieben UND aus der Historie verschwunden, ohne Meldung. Detail: [status-system/README.md](docs/status-system/README.md) + [recurring-bug-classes.md §16](docs/architecture/recurring-bug-classes.md).

- **Read-before-write mit Vereinigung der Fassungsliste** — fremde Fassungen kommen vor dem Schreiben in den Cache, auch wenn der Konflikt bewusst übergangen wird; Inhalte werden nie gemischt ([katalog-konflikt.ts](src/core/status/katalog-konflikt.ts))
- **Optimistisch geprüft wie im Journal**: `aktiv > basisVersion` plus Nummern-Kollision, nachgeprüft unmittelbar vor dem Schreiben ([katalog-share.ts](src/core/status/katalog-share.ts))
- **Konflikt kommt vor den Menschen** — Nummer, Autor, Zeitpunkt, Zahl abweichender Einträge, zwei Wege; beide lassen beide Fassungen in der Datei ([KatalogKonfliktDialog.tsx](src/plugins/status-cockpit/KatalogKonfliktDialog.tsx))
- **Frühwarnung beim Fensterfokus** aus 4 KB Dateikopf statt 2,9 MB, kein Polling, kein automatisches Umschalten ([sidecar-datei.ts](src/core/status/sidecar-datei.ts))
- Reißleine für Kontext-Docs 10000 → 20000 Zeichen: `status-cockpit.md` stand bei 9992 an der Wand ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts))

### v2.408.0 — Phasenvorschlag für Kürzel aus Trigger-Tabelle und Auslieferung (August 2026)

MINOR — Kein einziges der 508 Kürzel trug eine ZAH-Phase, also lieferte `bestimmeSeit` für den gesamten Bestand `null` — die „seit"-Zeile der Status-Erklärung war tot. 508 Zuordnungen von Hand sind keine Option; Trigger-Tabelle und Auslieferung wissen es bereits. Detail: [vorgangssystem.md §13](docs/architecture/vorgangssystem.md).

- **Zwei Quellen, getrennte Bänder** — 33 Vorschläge aus der Trigger-Tabelle, 13 aus der Auslieferung, Endstand 46 von 508 ([feld-phase-vorschlag.ts](src/core/status/feld-phase-vorschlag.ts))
- **Kein Vorschlag bei Uneinigkeit**: verschiedene Phasen über die Richtlinien oder Widerspruch zwischen den Quellen werden benannt statt geglättet ([FeldPhasenUebernahmeDialog.tsx](src/plugins/status-cockpit/FeldPhasenUebernahmeDialog.tsx))
- **Kein Vorschlag ist eine Antwort**: 472 Kürzel nach Grund gruppiert, und die Kopfzeile sagt, warum mehr nicht ableitbar ist ([FelderTab.tsx](src/plugins/status-cockpit/FelderTab.tsx))
- **Zeilenweise Auswahl** statt alles-oder-nichts, übernommen in EINEM `setState` ([katalog-edit.ts](src/core/status/katalog-edit.ts))
- **Filterchip „ohne Phase"** für den Rest von Hand ([FelderAbgleich.tsx](src/plugins/status-cockpit/FelderAbgleich.tsx))

### v2.407.0 — Modul Zu klären: Export, Phasen-Lesespalte und Doku (August 2026)

MINOR — Zweiter Teil des Klärungs-Moduls: die Klärung war beantwortbar, aber ihr Ergebnis kam nicht heraus, und die Vorkommen-Spalte stand leer. Dazu die Nachlese am Phasenschnitt selbst — er ist jetzt auch im Katalog-Tab sichtbar, statt nur zu wirken.

- **Drei Ausgaben statt einer**: Arbeitsmappe für den Termin, Markdown-Kurzfassung fürs Protokoll, pastefähiger Seed-Diff für die Umsetzung — Strittiges bleibt aus dem Diff draußen ([export.ts](src/plugins/zu-klaeren/export.ts))
- **Vorkommen je Statuscode** mit Bestandsstempel, über den ganzen Bestand ohne Betrachtungsbereich ([vorkommen.ts](src/plugins/zu-klaeren/vorkommen.ts))
- **Neu gelesen bei Fensterfokus** und per Knopf, kein Polling ([useKlaerung.ts](src/plugins/zu-klaeren/useKlaerung.ts))
- **ZAH-Phase als Lesespalte** im Katalog-Tab — sichtbar, nicht änderbar ([KatalogTab.tsx](src/plugins/status-cockpit/KatalogTab.tsx))
- **Arbeitsmappen-Helfer hochgezogen** zum zweiten Konsumenten, doppeltes `zeitstempel` eingesammelt ([arbeitsmappe.ts](src/core/status/export/arbeitsmappe.ts))

### v2.406.0 — Katalogfremde Kürzel geklärt (ID, Testkürzel) (August 2026)

MINOR — Von 221 Kürzeln, welche die Trigger-Zuarbeit referenziert, fehlten genau vier im Katalog; die Fachabstimmung hat sie am 04.08.2026 benannt (V6): `ID` = Rollenvergabe, `TTV1`/`TTV2`/`TVB1` = Testkürzel. Bis dahin standen die drei Testkürzel als mögliche nächste Schritte in 78 und 138 (5337 Anträge), und die Import-Warnung zählte jedes Mal dieselben vier Namen auf.

- **Eine Tabelle, drei Konsumenten** — Navigator, Erklärung und Import lesen dieselbe Antwort ([sonderkuerzel.ts](src/core/status/sonderkuerzel.ts))
- **Testkürzel sind kein Arbeitsschritt** und fallen vor jedem anderen Filter aus der Kandidatenliste — gezählt und in der Fußzeile benannt ([navigator.ts](src/core/status/navigator.ts), [NaechsteSchritte.tsx](src/plugins/antraege/status/NaechsteSchritte.tsx))
- **`ID` steht mit seiner Bedeutung** statt nackt da und behält den Hinweis „nicht im Katalog" — es IST ein Vorgang, nur keiner mit Katalog-Eintrag
- **Import-Warnung nur noch für wirklich Unbekanntes**; die vier stehen als Auskunft in der Vorschau ([trigger-import.ts](src/core/status/import/trigger-import.ts), [ReferenzdatenSektion.tsx](src/plugins/status-cockpit/ReferenzdatenSektion.tsx))
- **Kein Raten nach Muster**: `TTV3` bliebe unbekannt — der fünfte Fall soll auffallen ([sonderkuerzel.test.ts](src/core/status/__tests__/sonderkuerzel.test.ts))

### v2.405.0 — To-do-Regeln: geteilte Ansicht + kompakte Karten (August 2026)

MINOR — Der Editor klappte IN der Karte auf und schob die folgenden Regeln nach unten — beim Bearbeiten verlor man damit genau den Überblick, auf den es ankommt: die Reihenfolge IST das Ergebnis. Gemessen: die Kaskade war 3017 px hoch, jede Karte 89 px.

- **Karte 89 → 57 px**, Kaskade 3017 → 1919 px: drei Zeilen wurden zwei, „Bearbeiten" steht in der Titelzeile ([TodoRegelKarte.tsx](src/plugins/status-cockpit/TodoRegelKarte.tsx))
- **Geteilte Ansicht bei Auswahl** über das geteilte `MasterDetailLayout` — links schlanke Zeilen, rechts Kopf + Editor, Trenner ziehbar und gemerkt ([TodoRegelnBereich.tsx](src/plugins/status-cockpit/TodoRegelnBereich.tsx))
- **Positions-Pfeile im Regel-Kopf** („Position 5 von 27"), weil die Auswahl-Zeilen selbst Knöpfe sind und keine weiteren tragen dürfen ([TodoRegelDetail.tsx](src/plugins/status-cockpit/TodoRegelDetail.tsx))
- **Auswahl wird abgeleitet, nicht synchronisiert**: verschwindet die Regel, schließt sich das Detail von selbst — geprüft in [todoRegelnAnsicht.test.ts](src/plugins/status-cockpit/__tests__/todoRegelnAnsicht.test.ts)
- **Reiter To-dos füllt die Höhe**; Referenzdaten und Versionen stehen in Katalog/Kürzel ([StatusCockpitPage.tsx](src/plugins/status-cockpit/StatusCockpitPage.tsx))

### v2.404.1 — Guard gegen as/pl-Feature-Drift (August 2026)

PATCH — Die as/pl-Angleichung aus v2.403.0 war eine Aufräumarbeit, die sich jederzeit wiederholen kann: kein Test verglich zwei Varianten miteinander, deshalb konnte as über acht Flags hinweg unbemerkt hinter pl zurückfallen. Der Nachtrag schließt die Lücke, statt sich auf Aufmerksamkeit zu verlassen.

- **Guard `variant-drift`** mergt beide Configs wie der Build und vergleicht die *effektiven* Flag-Werte; ein nur in pl gesetztes Flag macht ihn rot und nennt den Namen ([variant-drift.test.ts](src/config/__tests__/variant-drift.test.ts))
- **Vier erlaubte Abweichungen** stehen benannt und begründet in `ERWARTETE_ABWEICHUNGEN` — wer sie ändert, ändert die Definition der as-Variante
- **`kuerzelDropdown` gilt nicht als Drift**: roh verschieden (as explizit, pl abgeleitet), effektiv gleich — der Guard rechnet die Ableitungen aus [feature-flags.ts](src/config/feature-flags.ts) nach, statt roh zu vergleichen
- **Gegen den echten Vorher-Stand geprüft**: mit `as.config.json` aus 75725a46^ meldet der Guard exakt die acht historisch gedrifteten Flags
- [build-varianten.md](docs/architecture/build-varianten.md) hält fest, dass die Vier-Flag-Differenz jetzt maschinell abgesichert ist

### v2.404.0 — Begleitphase als eigene Sicht (August 2026)

MINOR — Der Reiter „Offen" bündelte Antragsphase (TIB/BIB, 3–9 Monate) und Begleitphase (ZTP/PFM, 3–4 Jahre) mit zwei verschiedenen Fristuhren in einer Sicht; ein Profil-Haken blendete die Begleitphase zusätzlich app-weit aus, solange niemand ihn aktivierte. Zwei Nachzieh-Fixes hoben außerdem 15 Anträge in ihre korrekte Sicht, die zuvor an einem eingefrorenen Seed bzw. einer unvollständigen Fassung vorbeifielen.

- **Antragsphase und Begleitung als eigene Reiter**, je eigene Frist-Uhr (`antragsdatum` + 90 Tage bzw. `vn_eingang_datum` + 6 Monate) ([views.ts](src/plugins/antraege/views.ts))
- **Profil-Haken „Begleitungen einschließen" blendet nichts mehr aus** — steuert nur noch das Kürzel-Matching ([bearbeiterFilter.ts](src/plugins/antraege/bearbeiterFilter.ts))
- **Status-Pille leitet ihre Wertemengen bei jedem Aufruf aus dem kuratierten Katalog ab** statt aus einem beim Modul-Laden eingefrorenen Seed ([statusQuickChips.ts](src/plugins/antraege/filter/statusQuickChips.ts))
- **Snapshot-Bau ergänzt amtliche Schreibweisen codierter Werte aus dem Code-Katalog**, bevor er indiziert ([snapshot.ts](src/core/status/snapshot.ts))

### v2.403.0 — as-Variante an pl angeglichen (ohne Auslastungs-Modul) (August 2026)

MINOR — Die as-Variante sollte laut Definition „pl ohne Auslastungs-Modul" sein, war aber in **zwölf** Feature-Flags verschieden: pl bekam über die letzten Versionen neue Opt-in-Features, `as.config.json` wurde nie nachgezogen. AS-Nutzern fehlten dadurch drei komplette Sidebar-Bereiche und die halbe Artefakt-Kette.

- **Acht gedriftete Flags nachgezogen** — `statusCockpit`, `vorgangssystem`, `mapFoerderfaehig`, `nfNachforderungen`, `artefaktWerkbank`, `antragAufbereitung`, `workflowEntwuerfe`, `feedbackDelete` ([as.config.json](configs/as.config.json))
- **Differenz as↔pl jetzt genau vier Flags**, alle aus der Auslastungs-Domäne (`auslastung`, `auslastungSelbstEintragung`, `deAnonymisierung`, `maVerwaltungPasswort`) — gemessen über `deepMerge` + `validateConfig`, beide Varianten fehlerfrei
- **Auslastung bleibt vollständig aus**: nicht nur Menü + Route, auch MA-Kürzel-Spalte, Home-Widget „Neue Anträge für dich", Kaltstart-Korpus-Download und Auslastungs-Feedback ([build-varianten.md](docs/architecture/build-varianten.md))
- **Sichtbarkeits-Matrix auf den Ist-Zustand gezogen** — Erprobungs-Bereiche ergänzt, Flag-Spalte dazu; die stale „Chat"-Zeile (seit v2.394 kein Plugin) und das falsche `–` bei prod/Suche korrigiert ([build-varianten.md](docs/architecture/build-varianten.md))
- Reine Config-Änderung, kein Code-Pfad angefasst

### v2.402.0 — Vorgangs-Board: Mehrfachauswahl-Filter (August 2026)

MINOR — Jahrgänge, Fördervarianten und ZAH-Phasen ließen je nur EINEN Wert zu: „2024 und 2025" war nicht wählbar, man musste auf „Alle" ausweichen und bekam den Altbestand dazu. Die drei Filter waren zugleich die einzigen nativen `<select>` in einer Filter-Leiste der App — daher das Betriebssystem-Menü in fremden Farben. Beides hat dieselbe Lösung.

- **`MultiSelectDropdown`** in der Layout-Schicht: Mehrfachauswahl, leere Auswahl = kein Filter, Schnellwege über der Liste; visuelle Familie von `GruppierenDropdown`/`ColumnPicker` (gemessen: identische Rahmen-, Radius-, Schrift-, Padding- und Höhenwerte) ([MultiSelectDropdown.tsx](src/components/ui/MultiSelectDropdown.tsx))
- **Trefferzahl je Wert als Facetten-Zahl** — gerechnet unter den jeweils anderen Filtern, die eigene Achse ausgespart; Filter-Logik dafür rein und geprüft aus dem Hook gelöst ([boardFilter.ts](src/plugins/vorgangs-board/boardFilter.ts))
- **Vorbelegung „Letzte 3 Jahrgänge" steht jetzt angekreuzt da** statt als Sammelwert; die Zahlen bleiben unverändert (gemessen: 3 881 nach Filter, wie zuvor) ([useVorgangsBoard.ts](src/plugins/vorgangs-board/useVorgangsBoard.ts))
- **Altbestands-Hinweis greift genauer**: schon bei einem einzeln gewählten alten Jahrgang, nicht erst bei „alle" ([VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx))
- **Fachliche Ordnung der Menüs**: ZAH-Phasen entlang des Verfahrens (statt nach Auftreten), Fördervarianten nach `VB_PHASE`-Nummer (statt alphabetisch „DL" vor „FuE" vor „NW 1") ([useVorgangsBoard.ts](src/plugins/vorgangs-board/useVorgangsBoard.ts))

### v2.401.1 — Fachsystem heisst C16 (August 2026)

PATCH — Das Legacy-Fachsystem, das die Vorgangskürzel führt und den Nacht-Export liefert, heißt **C16**; die App nannte es durchgängig „Foyer" und schickte Nutzer damit zum falschen System. Das ZIM-Foyer (Antragsportal) ist ein anderes System und bleibt unverändert.

- **Nutzersichtbar**: Abschnittsüberschrift „Nächste Schritte (in C16 zu setzen)" ([NaechsteSchritte.tsx](src/plugins/antraege/status/NaechsteSchritte.tsx)) und drei Seiten-Hilfe-Docs, die zugleich das App-Wissen der Feedback-KI speisen ([docs/feedback-kontext/](docs/feedback-kontext/))
- **Zweitname beseitigt**: das Substantiv „Legacy" für dasselbe System wurde mit umbenannt; die Komposita (`Legacy-Trigger`, `Legacy-Doku`) und das unverwandte Legacy im Sinne alter Schemata/Props bleiben ([vorgangssystem.md](docs/architecture/vorgangssystem.md))
- **Fremddaten unberührt**: die amtlichen Kürzel-Labels der Zuarbeit („Eingang Foyer", „Antragsimport aus ZIM-Foyer …") bleiben wortgetreu, Pitfall #43 ([seed-codes.data.ts](src/core/status/seed-codes.data.ts))
- **CSV-Label-Matcher unberührt**: `'ZIM-Foyer Vorgangscode'` und `'Antragsimport aus ZIM-Foyer'` vergleichen gegen echte Spaltenüberschriften ([felderKuration.ts](src/plugins/antraege/alleFelder/felderKuration.ts), [felderGruppen.ts](src/plugins/antraege/alleFelder/felderGruppen.ts))
- `T_AAI` trägt den Identcode des **Portals** und heißt deshalb jetzt explizit `ZIM-Foyer-Identcode` ([vorgangssystem.md](docs/architecture/vorgangssystem.md))

### v2.401.0 — Gemeinsame Tree-Basis für Status-Filter, Textbausteine, Ordner und Meilensteine (August 2026)

MINOR — Vier Module bauten Baum-Verhalten je selbst nach: eigenes Aufklapp-Set, im Ordner-Editor dazu hand-geschriebenes HTML5-Drag. Keines davon konnte Tastatur. Eine gemeinsame Basis ersetzt alle vier — sieben eigene Zustandsstücke fallen weg.

- **Tree-Basis `src/components/tree/`** auf `@headless-tree` (1.7.0, MIT, keine Runtime-Deps): Aufklappen, Pfeiltasten/Home/End, Tri-State-Checkboxen, Umbenennen, Ziehen, HoverCard und Kontextmenü — einziger erlaubter Ort für den Lib-Import (Guard `no-headless-tree-outside-wrapper`) ([TfTree.tsx](src/components/tree/TfTree.tsx))
- **Status-Filter als Checkbox-Baum** mit echtem Tri-State an der Phase; die Übersetzung Baum ↔ Filter-Store ist rein und erhält fremde Preset-Werte ([statusTreeAdapter.ts](src/plugins/antraege/filter/statusTreeAdapter.ts))
- **Textbaustein-Katalog als Hierarchie** Bereich → Überkategorie → Thema → Baustein, mit Umbenennen, Ziehen und Kontextmenü; kein Löschen, weil der Katalog keins kennt ([bausteinBaum.ts](src/plugins/skill-verwaltung-kuration/bausteinBaum.ts))
- **Status-Ordnerbaum** ohne die fünf eigenen Zustandsstücke und ohne den `umhaengen`-Zweitweg; gezogen wird am Griff, weil die Zeile ein Zahlenfeld trägt ([kategorieBaum.ts](src/plugins/status-cockpit/kategorieBaum.ts))
- **Meilenstein-Konfiguration**: Chevron klappt Unter-Meilensteine auf, der Bedingungs-Editor hängt am ausgewählten Knoten, Umsortieren per Ziehen über die neue reine `haengeKnotenUm` ([knoten-edit.ts](src/core/meilensteine/knoten-edit.ts))

### v2.400.1 — Sicht-Zähler auf eine Grundmenge (August 2026)

PATCH — Dieselbe Sicht trug zwei Zahlen: Tab „Bewilligt 2026" 541, Schnellauswahl-Chip 555. Der Kopf zählte über die Grundmenge der Liste (Bereich, inaktive MAs, Irrläufer-Schalter), die Chips über die rohe Store-Liste — genau der Fehlermodus, den Pitfall #46 benennt.

- **`useFilteredAntraege` liefert die Zähler mit** (`counts` je Sicht) — gerechnet dort, wo die Liste entsteht; Tab-Leiste und Chips lesen nur noch ([useFilteredAntraege.ts](src/plugins/antraege/useFilteredAntraege.ts))
- **Der Kopf rechnet nichts mehr nach**: eigene Bereichs-Filterung, Inaktiv-Ausschluss und Ausblend-Zahl entfallen ersatzlos ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx))
- **Guard `Sicht-Zaehler kommen aus EINER Grundmenge`** — außerhalb der Pipeline zählt niemand mehr selbst, inklusive Positiv-Kontrolle gegen einen ins Leere laufenden Pfad-Filter ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts))

### v2.400.0 — Kürzel und Codes im Herleitungs-Popover erklärt (August 2026)

MINOR — „Wenn VB-Status vor 59, TV hat kein ABB → setze TV-Status 31." ist für den Eingearbeiteten präzise und für alle anderen Geheimschrift. Die Zeichen tragen jetzt ihre Bedeutung im Tooltip — und nur die belegten, damit der fehlende Unterstrich selbst eine Aussage bleibt.

- **Der Satz entsteht als Segment-Liste, nicht als String**; `triggerSatz` ist nur noch deren Verkettung, Kopie und Bildschirm können damit nicht auseinanderlaufen ([trigger-satz.ts](src/core/status/trigger-satz.ts), abgespalten von [trigger-parser.ts](src/core/status/trigger-parser.ts))
- **Erklärt wird gegen die Katalog-Fassung**: Kürzel → Bezeichnung + Rolle, Statuscode → amtlicher Text + ZAH-Phase, Bezugsdatei-Nummer, Mail-Empfänger ([trigger-erklaerung.ts](src/core/status/trigger-erklaerung.ts))
- **Beide Flächen** — Herleitungs-Popover und „Nächste Schritte" auf derselben Seite ([ErklaerterSatz.tsx](src/plugins/antraege/status/ErklaerterSatz.tsx))
- **Geteilter `kuerzelIndex`** statt der dritten Kopie derselben Map ([feld-zugriff.ts](src/core/status/feld-zugriff.ts))
- Belegt am echten Bestand (2447 Trigger-Zeilen): `ABB` → „Bewilligung / wird gesetzt von QS", `211` → Ebene statt Statuscode, nicht interpretierte Zeilen ohne jede Geste

### v2.399.0 — Sicht-Tab NF entfällt (August 2026)

MINOR — Die Sicht-Tabs trugen mit „NF" eine Auswahl, die der Phasen-Quickfilter direkt darunter deckungsgleich trifft (beide über `isNachforderungStatus`). Zwei Bedienwege für dieselbe Menge; der obere fällt weg. „Bewilligt <Jahr>" bleibt — der Quickfilter „Bewilligt" ist jahrgangsübergreifend und damit kein Ersatz.

- **`VIEWS` ohne `nachforderungen`** — Tab-Leiste und Schnellauswahl-Chips der Filter-Sidebar leiten sich beide daraus ab, der Eintrag verschwindet in einem Zug ([views.ts](src/plugins/antraege/views.ts))
- **Persistierte Sicht wird gegen `VIEWS` validiert** statt gegen eine zweite Literal-Liste: ein Altwert fällt auf „Offen" zurück, statt die Seite ohne aktiven Tab auf eine ungefilterte Liste zu stellen ([store.ts](src/plugins/antraege/store.ts))
- Belegt am echten Bestand: Quickfilter „NF" liefert dieselben 105 Teilvorhaben, die der Tab zeigte

### v2.398.0 — Anweisung, Regeln und Prompt am offenen Antrag bearbeiten (August 2026)

MINOR — Wer ein Gutachten schreibt, merkt am Abschnitt, dass die Anweisung nicht passt — und musste dafür bisher das Plugin wechseln. Die Inline-Werkstatt gab es seit v2.247, aber nur hinter `isDevContext()`; pl und as durften die Registry längst schreiben und sahen den kurzen Weg trotzdem nicht.

- **Zugang als reine Funktion** statt zweier Prädikate nebeneinander: `registryEditierbar`/`werkstattZugang` — dev/local + pl/as + Kurator-mit-Session, prod raus; `canEditSkillRegistry` delegiert dorthin, kein neuer Flag ([registry-zugang.ts](src/config/registry-zugang.ts))
- **Regeln des Abschnitts inline bearbeitbar** (Stift je Zeile, „+ Neue Regel") über die geteilte Fabrik `buildRegelMutations` — dieselbe, die die Verwaltungsseite nutzt ([regelMutations.ts](src/plugins/skill-verwaltung-kuration/regelMutations.ts))
- **„Was daraus wirklich an die KI geht"** unter der Vorlage: Maße, Baustein-Reihenfolge und Wortlaut gegen den ungespeicherten Entwurf, rein gerechnet ohne KI-Aufruf ([PromptVorschauSpalte.tsx](src/plugins/antraege/gutachten/PromptVorschauSpalte.tsx))
- **Warnung bei entferntem Inhalts-Slot** — nicht primär DSGVO (die ist fail-safe), sondern: der Lauf sieht die Vorhabensbeschreibung nicht mehr und schreibt trotzdem ([promptSlotWarnung.ts](src/plugins/skill-verwaltung-kuration/promptSlotWarnung.ts))
- **Bugfix `promptMasse`**: die VB zählte auch dann als Anteil, wenn das Template ihren Slot nicht führt — die Anzeige meldete 78.040 VB-Zeichen bei 2.028 Gesamtzeichen ([promptAnsicht.ts](src/plugins/antraege/gutachten/promptAnsicht.ts))

### v2.397.0 — Betrachtungsbereich: alle drei ZIM-Richtlinien ab 2015 (August 2026)

MINOR — Der Chip versprach „letzte 3 Richtlinien", zeigte aber zwei Generationen: v2.389 hatte den Bereich nach der Trigger-Abdeckung geschnitten (neun Programme) und trotzdem als Generationszahl beschriftet. Die Generation 2015 fehlte — 5.086 Anträge, 47 allein 4.190.

- **Standard-Bereich sind die drei jüngsten Richtlinien-Generationen** (2015 + 2020 + 2025 = 12 Programme, 12.355 von 14.221 Anträgen); außerhalb bleibt nur die Generation 2012 ([betrachtungsbereich.ts](src/core/status/betrachtungsbereich.ts))
- **`RICHTLINIEN_GENERATIONEN` als Datenstruktur**, Seed ist `slice(-3)` davon — ein Richtlinien-Wechsel ist ein angehängter Listeneintrag, die älteste Generation rollt von selbst heraus
- **Chip-Beschriftung abgeleitet statt danebengeschrieben** (`bereichsLabel`): keine hartcodierte „3" mehr, Singular korrekt, und wo sich keine Generation belegen lässt, wird keine behauptet ([BereichChip.tsx](src/components/bereich/BereichChip.tsx))
- **Auswahl-Panel nach Generation gruppiert** (jüngste oben) + Hinweis, wenn eine eigene Auswahl vom Standard abweicht — der Ersatz für einen localStorage-Key-Bump ([BereichPanel.tsx](src/components/bereich/BereichPanel.tsx))
- **Gemessen** ([§10.2](docs/architecture/vorgangssystem.md)): nur „Alle" bewegt sich (5.542 → 7.468), Offen 892 / Überfällig 478 / NF 105 identisch; Board rechnet 12.355 statt 7.269 Vorgänge; Kompetenz-Basis der Auslastung bleibt 14.221

### v2.396.0 — Erhebungs-Fallzahl, Paar-Alter und Journal-Frische (August 2026)

MINOR — Drei Nachzüge aus den Protokollen zu v2.391/v2.392. Die FB-Erhebung nannte dem Termin die falsche Größenordnung, der Alterssplit fehlte, und ein ausgefallener Journal-Lauf war nur in der Konsole sichtbar.

- **Zweite Kennzahl `bedingungTrifft`** je Platzhalter — die Bedingung ohne Kaskaden-Vorrang ausgewertet; gemessen 10 sichtbar vs. 222 betroffen bei R16 ([fb-erhebung.ts](src/core/status/fb-erhebung.ts))
- **Alterssplit `PAAR_ALTBESTAND_TAGE = 400`** in den blinden Flecken, je Block Anzahl, Median-Standzeit und Median der letzten Aktivität — 952 aktuelle gegen 4.868 alte Fälle
- **Beide Zahlen und beide Blöcke** in Regeln-Tab, XLSX und Kurzfassung ([TodoRegelnBereich.tsx](src/plugins/status-cockpit/TodoRegelnBereich.tsx), [fbErhebungExport.ts](src/plugins/status-cockpit/fbErhebungExport.ts))
- **Journal-Frische im Bereich „Referenzdaten"** mit Warnschwelle 3 Tage, die die Folge nennt statt des Zustands ([JournalFrische.tsx](src/plugins/status-cockpit/JournalFrische.tsx), [lesen.ts](src/core/status/journal/lesen.ts))
- **Rollout-Sperre testgesichert** + Warnzeile, sobald ein Regelsatz ≠ AB aktive Regeln führt — deckt auch den Katalog-Import ab, der an keinem Dialog vorbeikommt

### v2.395.2 — Avatar traegt das Kuerzel, Begruessung nur den Vornamen (August 2026)

PATCH — Der Profil-Avatar trug die Namens-Initialen; das eigentlich identitätsstiftende Kürzel war nirgends sichtbar. Die Startseite sprach mit dem vollen Namen an statt nur dem Vornamen.

- **Profil-Avatar zeigt das Kürzel** wenn eines gewählt ist (z.B. „THÜ"), sonst weiter Namens-Initialen ([settings-primitives.tsx](src/plugins/einstellungen/_shared/settings-primitives.tsx), [ProfilTab.tsx](src/plugins/einstellungen/ProfilTab.tsx), [MeineTechnologienTab.tsx](src/plugins/einstellungen/MeineTechnologienTab.tsx))
- **Startseiten-Begrüßung nur noch mit Vornamen** — „Guten Tag, Thomas" statt „Guten Tag, Thomas Hollerith" ([HomePage.tsx](src/plugins/home/HomePage.tsx))
- **`profilAvatarText` / `vornameVon` / `initialenVon` / `kuerzelFuerAnzeige`** als gemeinsame Basis in [profil-anzeige.ts](src/core/utils/profil-anzeige.ts) (zuvor drei unterschiedliche Inline-Varianten)

### v2.395.1 — Doku auf den Ist-Zustand nach dem Bauantrag-Endausbau (August 2026)

PATCH — Nachtrag zu v2.395: sechs lebende Docs beschrieben noch „zwei Status-Domänen" und verwiesen auf die gelöschte Fixture. Docs beschreiben den Ist-Zustand (Doku-Konvention 1), also werden sie umgeschrieben statt ergänzt.

- [antrag-status-domaenen.md](docs/architecture/antrag-status-domaenen.md) neu geschnitten: „Rohwert vs. Kategorie" statt zwei Domänen, inkl. der unbesetzten Kategorie `abgelehnt` und der Messung aus dem echten Bestand.
- [add-view.md](docs/agents/add-view.md) + [add-filter-facet.md](docs/agents/add-filter-facet.md): keine Doppelfixture-Pflicht mehr.
- [CLAUDE.md](CLAUDE.md), [project-structure.md](docs/architecture/project-structure.md), [vorgangssystem.md](docs/architecture/vorgangssystem.md) auf `VorgangStatus = string` bzw. die entfallene Handliste gezogen.
- **Nicht angefasst:** `prompt-vorgangssystem.md` (Auftragsdokument einer vergangenen Runde) und `KATALOG-V1.md` (im README bereits als historisch markiert) — beides Archiv-Kandidaten für eine spätere Runde.

