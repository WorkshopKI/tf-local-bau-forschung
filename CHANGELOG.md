# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v4.81.0 — Ruhende Kürzel: die Arbeitsmenge halbiert (August 2026)

MINOR — Gemeldet: 511 Kürzel erschlagen jede Abstimmung, viele davon seien von früher. Gemessen an Fassung 22 trifft „seit Richtlinie 2020 nicht gesetzt" nur 15 — die Masse sind **243 Kürzel ohne jede `D_`/`T_`-Spalte im Export**, die C16 vielleicht täglich setzt, die wir aber nie sehen. 85 davon trugen ein Relevanz-Häkchen, das nirgends wirken kann.

- **Ruhe-Achse abgeleitet, nur als Ausnahme kuriert** — `ruht` dreiwertig, Regelfall aus der Beobachtbarkeit ([ruhende-kuerzel.ts](src/core/status/ruhende-kuerzel.ts), [KATALOG-CODES.md](docs/status-system/KATALOG-CODES.md))
- **Sektion „Nicht im Blick"** unter dem Ordnerbaum, zwei Gründe getrennt beschriftet, je Zeile „trotzdem beachten" ([RuhendeKuerzel.tsx](src/plugins/status-cockpit/RuhendeKuerzel.tsx))
- **Einsatz-Bestandslauf** am vorhandenen Knopf, misst gegen die zwei jüngsten Richtlinien statt gegen den persönlichen Bereich ([useEinsatzErhebung.ts](src/plugins/status-cockpit/useEinsatzErhebung.ts))
- **Regel-Auswahl und Klärfragen lassen ruhende Kürzel aus** — eine Bedingung auf `YE` träfe stillschweigend nie zu ([todoFeldVorrat.ts](src/plugins/status-cockpit/todoFeldVorrat.ts), [klaerfragen/](src/core/status/klaerfragen/))
- **Guard: Ruhe ist Sichtbarkeit, nicht Wahrheit** — Chronik, Navigator, Wächter, `reconcile` und `referenzierbareFelder` bleiben unberührt (Pitfall #53)

### v4.80.0 — die Unterhaltung gehoert zu der Suche, unter der sie entstand (August 2026)

MINOR — Gemeldet: beim erneuten Öffnen der Suche stand der alte Chat wieder da, ohne Weg ihn zu löschen. Der Init des Panels reaktivierte die jüngste Unterhaltung — geerbt von der früheren Vollbild-Chatseite. Hier hängt der Chat an den Treffern darunter, und die alte Antwort ging als Verlauf in den nächsten Prompt.

- **Das Panel öffnet immer frisch** — kein Wiederaufnehmen der letzten Unterhaltung; die alten bleiben im Verlauf ([ChatPanelHost.tsx](src/plugins/chat/ChatPanelHost.tsx))
- **Löschen steht im Kopf** statt zwei Klicks tief im Verlauf-Aufklapper, und nur dann, wenn es etwas zu verwerfen gibt
- **Hinweis „Diese Unterhaltung gehört zur Suche »X«" + „neu beginnen"**, sobald die Treffer weitergezogen sind ([chat.css](src/plugins/chat/chat.css))
- **Kein automatisches Verwerfen** bei neuer Anfrage: die Stichwortsuche läuft je Tastendruck, ein Reset nähme dem Nutzer die Antwort weg, die er gerade liest

### v4.79.0 — Der Verfahrensschnitt reist allein (August 2026)

MINOR — Ein neu aufgesetzter Rechner lud nicht die jüngste Fassung; auf diesem Stand wurden viele Kürzel gepflegt und veröffentlicht. Die live geltende Fassung trug danach die richtigen Kürzel und den zurückgefallenen Verfahrensschnitt — und es gab keinen Weg, nur den einen zurückzuholen, weil Export, Import und „Als Entwurf laden" immer die ganze `MappingVersion` bewegten.

- **Die Phasen-Achse ist ein eigenes, transportables Paket** — Phasenliste, Code→Phase, Kürzel→Phase und Zieltage, geschlüsselt nach Code statt Wert-Id ([phasen-paket.ts](src/core/status/phasen-paket.ts))
- **„Phasen exportieren"** neben dem Ansichtsumschalter im Reiter Statuswerte ([KatalogTab.tsx](src/plugins/status-cockpit/KatalogTab.tsx)); 3,7 KB gegen 152,8 KB Voll-Export
- **Ein Import-Knopf, zwei Formate** — die Datei trägt die Marke `art: "zah-phasen"` und sagt selbst, was sie ist ([useStatusCockpit.ts](src/plugins/status-cockpit/useStatusCockpit.ts))
- **„Nur Phasen übernehmen"** je Fassung im Versions-Panel, ohne Dateiweg ([StatusCockpitPage.tsx](src/plugins/status-cockpit/StatusCockpitPage.tsx))
- Hintergrund: [status-achsen.md](docs/architecture/status-achsen.md)

### v4.78.0 — der Assistent sagt, wie viel er gesehen hat (August 2026)

MINOR — Getestet gemeldet: der Kontext-Chip über dem Assistenten nannte 558 Suchtreffer, im Prompt standen 8. Der Schaden war nicht der Zähler — die KI hielt die 8 für die Gesamtmenge und urteilte über die „übrigen" 550, die sie nie gesehen hatte. Dazu führte die Deutungszeile zwei Wörter als „nicht berücksichtigt", die niemand verloren hatte.

- **Chip und Prompt entstehen aus EINER Auswahl** — neue `waehleKontextTreffer`, gelesen von Block und Etikett ([assistentKontext.ts](src/plugins/suche/assistentKontext.ts), [ChatPanelHost.tsx](src/plugins/chat/ChatPanelHost.tsx))
- **40 statt 8 Treffer** im Kontext, gedeckelt durch ein Zeichen-Budget; der Kopf nennt „40 von 517" und verbietet das Urteil über die übrigen
- **Kurzbeschreibung, Relevanz und Fundstellen je Treffer** — bisher trug der Kontext nur Titel und Antragsteller, und das Modell reimte sich den Inhalt zusammen ([search-result.ts](src/core/types/search-result.ts), [useUnifiedSearch.ts](src/core/hooks/useUnifiedSearch.ts))
- **Frage- und Gewichtungswörter fallen aus „nicht berücksichtigt"** — als Konstanten, die der Prompt rendert und der Parser filtert ([frageplan.ts](src/core/services/search/frageplan.ts))
- Hintergrund: [suche-relevanz.md §8](docs/architecture/suche-relevanz.md)

### v4.77.1 — Die Tabelle stoesst gerade an die Leiste, die Trefferzahl steht in der Flucht (August 2026)

PATCH — Zwei Nachlesen am Kopfband (v4.76): die 12-px-Rundung des Tabellenkastens stand als Kerbe neben der geraden Kante der Filterleiste, und die Trefferzahl unter der Liste begann an der Außenkante des Kastens statt in der Flucht der Auswahl-Häkchen, die sie zählt.

- **Linke Ecken gerade, solange die Tabelle an die Leiste stößt** — neue Prop `linkeKanteGerade` an [SortableTable.tsx](src/components/data-table/SortableTable.tsx), gesetzt aus demselben `bandAktiv` wie `pl-0` ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx)); rechts bleibt sie gerundet
- **Trefferzahl in der Flucht der ersten Spalte** (nur Tabellen-Ansicht — Liste und Karten haben keine) — [AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx)
- **`ZELL_POLSTER_PX` zieht nach [tableLayout.ts](src/components/data-table/tableLayout.ts)** und bekommt dort mit `ERSTE_SPALTE_INSET_PX` einen zweiten Konsumenten — vorher modul-privat in `TableBody`
- Nachgemessen am `dev:local`: Häkchen und Trefferzahl auf derselben Kante (388/388 mit Leiste, 98/98 ohne), Radien 0/12 bzw. 12/12

### v4.77.0 — Einklappen ist ein Chevron (August 2026)

MINOR — Entwurf in `_design/handoff/hide`: der Einklapp-Knopf war doppelt laut — ein dauerhaft umrandeter Kasten um ein lucide-Panel-Icon, das selbst ein Kasten ist. Auf 16 px zählt nur die Silhouette, und die hatte das Icon nicht. Dazu drifteten acht verstreute Aufrufe auf drei Achsen auseinander: Icon-Größe 15/16/18, Hover-Fläche, Radius.

- **Ein Chevron statt `PanelLeftClose`/`PanelLeftOpen`**, ohne Rahmen in jedem Zustand — neues geteiltes Bauteil [EinklappIcon.tsx](src/components/ui/EinklappIcon.tsx) (`EinklappButton` 24 × 24 bzw. 30 × 30, `EinklappIcon` für die Schienen)
- **Alle acht Einsatzorte** ziehen daraus: [ShellLayout.tsx](src/core/ShellLayout.tsx), [FilterSidebar.tsx](src/plugins/antraege/filter/FilterSidebar.tsx) (beide Kopfvarianten), [KompaktListe.tsx](src/plugins/antraege/KompaktListe.tsx), [AnfragenPage.tsx](src/plugins/anfragen/AnfragenPage.tsx), [EinreichungListe.tsx](src/plugins/map-foerderfaehig/components/EinreichungListe.tsx), [AntraegePage.tsx](src/plugins/antraege/AntraegePage.tsx), [MasterDetailLayout.tsx](src/components/master-detail/MasterDetailLayout.tsx)
- **Vorlese-Text nachgeholt**: der Navigations-Knopf hatte kein `aria-label`, keiner der acht ein `aria-expanded` — beides sitzt jetzt im Bauteil
- Regel im Gestaltungsleitfaden festgehalten ([DESIGN_GUIDE.md](DESIGN_GUIDE.md) Kap. 8)

### v4.76.0 — Kopfband: Filterleiste und Tabellenkopf beginnen gemeinsam (August 2026)

MINOR — Gemeldet: „die Kopfzeile der Tabelle soll harmonischer mit der Filtersidebar aussehen, wenn diese eingeblendet ist" (Entwurf in `_design/handoff/anträge-kopfzeile`). Die Leiste begann direkt unter der Suchzeile, der graue Tabellenkopf rund 90 px tiefer — das „graue L" schloss nie, und die Unterkante des Leistenkopfes lief gegen nichts.

- **Die Filterleiste ist eine Spalte der Liste geworden** (neue [FilterSpalte.tsx](src/plugins/antraege/filter/FilterSpalte.tsx), aus [AntraegePage.tsx](src/plugins/antraege/AntraegePage.tsx) herausgelöst) — nur so kann die Zeile der Filter-Pillen über Leiste **und** Tabelle spannen
- **Leiste und Tabellenkopf bilden ein Kopfband**: „FILTER" in der Rubrikzeile, Verlauf + „N aktiv" + Einklappen in der Spaltenzeile ([FilterSidebar.tsx](src/plugins/antraege/filter/FilterSidebar.tsx)); ohne Tabellenkopf daneben (Liste/Karten, Leerzustände, Drawer) bleibt der gewohnte Kopf
- **Bandhöhe wird gemessen, nicht gesetzt** — neue Meldung `onKopfHoehe` an [TableHeadRows.tsx](src/components/data-table/TableHeadRows.tsx) / [SortableTable.tsx](src/components/data-table/SortableTable.tsx); gemessen 23 + 43,5 px statt der 22 + 30 des Entwurfs
- **Die weiße Rinne zwischen beiden entfällt** bei gebildetem Band (`pl-0` am Tabellenkasten), die Werkzeug-Zeile verliert ihren `max-w-6xl`-Deckel ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx))
- Kontext-Doc der Seite nachgezogen ([antraege.md](docs/feedback-kontext/antraege.md))

### v4.75.2 — Antragsdokumente statt Aufnehmen (August 2026)

PATCH — Gemeldet: „Button Aufnehmen und Download oben rechts muss nicht fett sein" und „Aufnehmen → ‚Antragsdokumente', als Tooltip eine Erklärung, was der Button macht". Der Knopf nannte die Tätigkeit, nicht den Gegenstand — und was dabei mit den Dateien geschieht, stand nur im Overlay dahinter.

- **„Aufnehmen" heißt „Antragsdokumente"**, mit Tooltip: ZIP/PDF/DOCX ablegen → FKZ aus dem Dateinamen → Text im persönlichen Ordner ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx))
- **Beide Kopf-Knöpfe wiegen leichter**: Schrift `font-normal` statt `font-medium`, Icons `strokeWidth` 1.75 statt 2 ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx))
- Kontext-Doc der Seite nachgezogen ([antraege.md](docs/feedback-kontext/antraege.md))

### v4.75.1 — Feedback-Knopf sitzt in der Blattecke (August 2026)

PATCH — Gemeldet: „das Feedback-Icon kann etwas weiter runter, so dass es in der Rundung des Blattes liegt". Es stand 14px über der Blattkante und ragte zugleich 4px darüber hinaus — eine Lage, die zu keiner der beiden Kanten gehörte.

- **Der Feedback-Knopf liegt in der Blattecke**: `bottom-1.5` statt `bottom-6` legt ihn nahezu konzentrisch auf den 14px-Eckbogen, rechts und unten je ~4px über die Kante ([FeedbackButton.tsx](src/components/feedback/FeedbackButton.tsx))

### v4.75.0 — Die Tabelle wird als Ganzes schmaler, der Griff sitzt oben rechts (August 2026)

MINOR — Gemeldet: „wenn ich die Fördertabelle schmal mache sollte kein weißer Bereich entstehen, sondern die ganze Tabelle schmaler werden" und „den Drag über die gesamte Höhe wegnehmen, wie früher nur die 3 Punkte oben rechts — der Drag und der Scrollbalken vertragen sich visuell nicht". Dazu drei kleinere Bitten zur selben Seite: „Darstellung" heißt jetzt „Ansicht", die Trefferzahl gehört nicht in die Filterzeile, und die Filterleiste braucht mehr Höhe.

- **Ein Pin ist die Breite des KASTENS**, nicht die der Tabelle — der Rahmen endet mit der letzten Spalte, die leere Fläche darin entfällt konstruktiv ([tableLayout.ts](src/components/data-table/tableLayout.ts), [SortableTable.tsx](src/components/data-table/SortableTable.tsx))
- Damit nur noch **zwei Größen-Modi** (Einpassen · Scroll); der Sonderzweig im Spalten-Drag entfällt ([useColumnResize.ts](src/components/data-table/useColumnResize.ts))
- **Der Griff sind drei Punkte oben rechts** statt eines Streifens neben dem Scrollbalken — sichtbar und anfassbar nur dort ([TotalWidthGrip.tsx](src/components/data-table/TotalWidthGrip.tsx))
- **„Darstellung" heißt „Ansicht"**; die gleichnamige Achse darin wurde zu „Ansichtsform" ([DarstellungDropdown.tsx](src/components/ui/DarstellungDropdown.tsx), [darstellungsAchsen.ts](src/plugins/antraege/darstellungsAchsen.ts))
- **Die Trefferzahl steht als Statuszeile unter der Liste**, und die Filterleiste gewinnt ~100px Höhe (Kopf 145 → 133px, Merkmals-Raster 47,5 → 39,5px) ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx), [FilterSidebarItem.tsx](src/plugins/antraege/filter/FilterSidebarItem.tsx))

### v4.74.1 — Bestandszahl rueckt an den Titel (August 2026)

PATCH — Gemeldet: „den Text ‚Index: 14.225 Anträge' nach oben nehmen, direkt hinter den Titel der Seite; der Text ‚14.005 Textabschnitte' kann weg". Die Optionszeile trägt sonst nur Regler — Dinge, die man verstellt; die Größe des Index verstellt niemand.

- **Die Bestandszahl steht am Seitentitel** statt rechts in der Optionszeile ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Die Zahl der Textabschnitte entfällt** — sie zählte Dokumentstücke, während die Seite Anträge findet ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx))
- Die Diagnose-Zeile für den **fehlenden** Dokumentenindex bleibt unberührt ([IndexInfoZeile.tsx](src/plugins/suche/IndexInfoZeile.tsx))

### v4.74.0 — Darstellung rueckt nach rechts, Warum nur zur Frage (August 2026)

MINOR — Gemeldet: „Ausführlich und Kompakt zeigt keinen Unterschied" — in der Tabelle stimmte das, dort wirkte auch die Sortierung des Menüs nicht (die Tabelle sortiert über ihre Spaltenköpfe). Ebenfalls gemeldet: „das ‚Warum?' macht doch nur bei einer Frage in natürlicher Sprache Sinn, nicht bei meiner Suche `ast:`".

- **Das Darstellungs-Menü steht rechts vor dem Export** statt links am Anfang der Leiste — es ist der einzige Knopf, der mit dem Zustand wächst ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **…und fehlt in der Tabelle ganz**: beide Achsen gelten nur für die Liste, ein Bedienelement ohne Wirkung ist schlimmer als keins ([darstellungsAchsen.ts](src/plugins/suche/darstellungsAchsen.ts))
- **„Warum?" gibt es nur zu einer Frage** — bei einer Feldsuche heißt derselbe Ausklapp „Mehr", trägt weiter die drei Zeilen-Aktionen und ruft keine KI ([TrefferZeile.tsx](src/plugins/suche/TrefferZeile.tsx))
- **„Alle begründen" folgt derselben Regel**: nur einen der beiden Wege zu sperren erzeugte Begründungen, die die Zeile dann nicht anzeigt
- Neuer Guard für die Achsen-Bindung an die Ansicht ([darstellungsAchsen.test.ts](src/plugins/suche/__tests__/darstellungsAchsen.test.ts))

### v4.73.0 — Der Einstieg in die Suche ist ein Panel mit Reitern (August 2026)

MINOR — Aus einem Design-Handoff (`_design/handoff/suche-startseite`): der Startzustand zeigte sechs gleichrangige Blöcke untereinander, nichts stach heraus, die Seite scrollte. Zwei der Blöcke trugen dabei nichts Eigenes — „Aus dem Index" nannte die Zahlen der Optionszeile ein zweites Mal, „Häufig gesucht" ist die zweite Hälfte derselben Verlaufsliste wie „Letzte Suchen".

- **Ein Panel mit fünf Reitern** (Alle · Zuletzt · Suchsprache · Fragen · Stöbern) auf fester Fläche, zuletzt benutzter Reiter gerätelokal gemerkt ([SucheStartzustand.tsx](src/plugins/suche/SucheStartzustand.tsx), Reiter-Inhalte je eigene Datei in [start/](src/plugins/suche/start/))
- **Neuer Reiter „Stöbern"**: Deskriptoren · Netzwerk · Einrichtung · Ort & Bundesland mit je den fünf häufigsten Werten und echter Trefferzahl; der volle Katalog bleibt die Vorschlagsliste im Suchfeld ([StartStoebern.tsx](src/plugins/suche/start/StartStoebern.tsx), [stoebern.ts](src/plugins/suche/start/stoebern.ts))
- **Die Suchsprache-Beispiele stehen nach Zweck gruppiert** statt als flache Zehnerliste ([suchsprache.ts](src/plugins/suche/start/suchsprache.ts))
- **Spalte „Aus dem Index" entfällt** — die Bestandszahlen stehen seit v4.69 in der Optionszeile; die leere Spalte „Gespeicherte Suchen" wurde ein Satz
- **Trefferzahlen in Schüben** einmal statt zweimal gebaut: die Vorschlagsliste und der neue Reiter teilen sich [useProbeZahlen.ts](src/plugins/suche/useProbeZahlen.ts)

Nicht übernommen aus dem Handoff: der Live-Filter des Panels beim Tippen (die Vorschlagsliste beantwortet denselben Tastendruck seit v4.71 und liegt darüber), die Zusammenfassung „3 Varianten" (der Verlauf entdoppelt bereits) und Zeitangaben je Suche (der Verlauf führt keine Zeitstempel).

### v4.72.0 — Anpinnen an Phasen und Spannen (August 2026)

MINOR — Gemeldet: „bei denen erscheint keine Nadel zum Anpinnen" (Bewilligungs-, Antrags-, Fristdatum) — und der Status-Block, der als einziger von sich aus offen steht, hatte nie eine. Von 8 Nadeln in der Leiste waren im Ausgangszustand genau 2 erreichbar.

- **Jede Status-Phase trägt eine Nadel**: angepinnt wird sie als Schalter „Phase Eingang (2)", der alle Stati der Phase dazulegt ([StatusFilterFacet.tsx](src/plugins/antraege/filter/facets/StatusFilterFacet.tsx))
- **Spannen und lange Listen** (Datum, Zahl, Freitext, 16 Richtlinien) pinnen die AKTUELLE Einstellung, sobald eine gesetzt ist — ohne Wert gibt es nichts einzufrieren ([FilterSidebarItem.tsx](src/plugins/antraege/filter/FilterSidebarItem.tsx), [pinnedFilters.ts](src/plugins/antraege/filter/pinnedFilters.ts))
- **Die Identität einer Phase hängt an der Phase**, nicht an ihrer Werteliste — sonst läse sich derselbe Pin nach dem nächsten Filter als „nicht angepinnt" ([pinnedFilters.test.ts](src/plugins/antraege/__tests__/pinnedFilters.test.ts))
- **Ein-Filter-Chips ohne „Satz:"** — der Wert benennt sich schon selbst ([PinLeiste.tsx](src/plugins/antraege/filter/PinLeiste.tsx), `label` an [FilterChip.tsx](src/components/ui/FilterChip.tsx) optional)
- **Datumsspannen deutsch statt ISO** in Chips und Verlauf, über die vorhandene Anzeige-Kette ([ActiveFilterChips.tsx](src/plugins/antraege/filter/ActiveFilterChips.tsx), [frequentFilters.ts](src/plugins/antraege/filter/frequentFilters.ts)); neuer Zeilen-Klassen-Slot am Baum ([tf-tree-types.ts](src/components/tree/tf-tree-types.ts))

### v4.71.1 — Verlauf breiter, Uhr neben den Titel (August 2026)

PATCH — Gemeldet: „Historie-Anzeige breiter machen, damit man mehr von der Suchanfrage lesen kann (die unterscheiden sich meist in den hinteren Worten)" und „das Uhr-Icon direkt hinter Filter, das braucht man oft". Am Verlauf gemessen brauchte der längste Eintrag 274 px bei 207 px Textbreite — abgeschnitten wurde genau der unterscheidende Schluss.

- **Verlaufs-Menü 280 → 440 px**, linksbündig am Knopf statt rechtsbündig ([VerlaufMenue.tsx](src/plugins/antraege/filter/VerlaufMenue.tsx))
- **Lange Einträge brechen auf zwei Zeilen um** statt mit „…" zu enden — 2 × 367 px lesbarer Text, Langfassung weiter im `title` ([FrequentFiltersSection.tsx](src/plugins/antraege/filter/FrequentFiltersSection.tsx))
- **Uhr-Zeichen direkt neben den Titel „Filter"**, „N aktiv" rückt nach rechts zum Einklapp-Knopf ([FilterSidebar.tsx](src/plugins/antraege/filter/FilterSidebar.tsx))

### v4.71.0 — Das Suchfeld schlaegt vor (August 2026)

MINOR — Gewünscht: eine Autovervollständigung im Suchfeld, „evtl. auch für die Feldsyntax (`ort:`, `nw:`)". Am Bestand gemessen ist der Wert das eigentliche Ratespiel: die Deskriptoren sind ein festes Vokabular von 43 Werten, das nirgends in der App steht, und die Einrichtung mit 305 Anträgen heißt „… angewandten Forschung **eingetragener Verein**", nicht „e.V.".

- **Feldnamen vervollständigen sich beim Tippen**: „or" → `ort:` („nur Ort"); gesucht über alle Schreibweisen („netz" findet `nw:`), eingesetzt die eine, die die App selbst schreibt ([vervollstaendigung.ts](src/plugins/suche/vervollstaendigung.ts))
- **Werte kommen aus dem Bestand**, mit Trefferzahl aus einem echten Probelauf: `ort:` (2.055) · `ast:` (5.461) · `nw:` (1.270) · `wahlkreis:` (299) · `deskriptor:` (43, als Katalog durchblätterbar) ([wert-index.ts](src/plugins/antraege/services/wert-index.ts), im Korpus-Durchlauf gefüllt)
- **Anführungszeichen halten einen Wert zusammen** — `ort:"Frankfurt am Main"`, auch ohne Feld (`"additive Fertigung"`); ein zitierter Wert ist ein Chip und läuft ohne Wortstamm ([feldpraefix.ts](src/core/services/search/feldpraefix.ts))
- **Das war ein Defekt, kein Komfort**: `ort:Frankfurt am Main` fand bei „irgendein Wort genügt" **6.365** statt 40 Anträgen, bei „alle Wörter" 48 statt 40 ([suche-relevanz.md §9](docs/architecture/suche-relevanz.md))
- Eine Liste für drei Quellen — Feld, Wert, Verlauf — mit durchgehender Tastatur-Navigation; im Frage-Modus bleibt nur der Verlauf ([SearchSuggestions.tsx](src/plugins/suche/SearchSuggestions.tsx), [SearchInput.tsx](src/plugins/suche/SearchInput.tsx))

### v4.70.0 — Der Kopf der Foerderantraege wird stimmig (August 2026)

MINOR — Gemeldet: „links sind zwei Linien direkt übereinander", „die Ergebnistabelle klebt direkt oben am grauen Bereich", „das Layout/Design ist noch nicht stimmig". Der Handoff, pixelweise ausgelesen, hat oben gar keine graue Fläche — v4.68 hatte das Grau weiter gezogen als das Vorbild und damit die Oberkante der Tabelle verschluckt.

- **Seitenkopf und Werkzeugzeile wieder weiß** (Rücknahme v4.68): grau bleiben Filterleiste und Tabellenkopf, dazwischen stehen 12 px Weiß statt 0 ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx), [AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx))
- **Eine Linie statt zwei** in der Filterleiste — der Trenner steht nur noch ZWISCHEN Blöcken, nicht mehr direkt unter der Kopf-Unterkante ([FilterSidebar.tsx](src/plugins/antraege/filter/FilterSidebar.tsx))
- **Trefferzahl in die Werkzeugzeile** neben „Darstellung"/„Spalten" statt allein in einer eigenen Zeile; `abschluss`-Slot entfällt ([QuickfilterToolbar.tsx](src/plugins/antraege/filter/QuickfilterToolbar.tsx))
- **„Aufnehmen" + Export in den Seitenkopf**, links neben „Hilfe" — im Fokus-Modus bleiben weiter nur Titel + Hilfe ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx))
- **Der Bereichs-Chip beziffert nur die Abweichung**: „Anzeige: letzte 3 Richtlinien", Programm- und Ausgeblendet-Zahl im Tooltip — im Chip erst bei eigener Auswahl ([betrachtungsbereich.ts](src/core/status/betrachtungsbereich.ts), [BereichChip.tsx](src/components/bereich/BereichChip.tsx)); Pille „Status" statt „Status in dieser Sicht", Zusatz als Tooltip ([CollapsibleSeg.tsx](src/plugins/antraege/filter/CollapsibleSeg.tsx))

### v4.69.1 — der Trenner hebt sich von den Kastenraendern ab (August 2026)

PATCH — Der neue Gruppen-Trenner stand in `--tf-border` — derselben Farbe, in der die Auswahlkästen ihre Ränder zeichnen. Zwischen zwei umrandeten Kästen war er damit eine Kante unter vielen und trennte nichts.

- **Trenner in `--tf-border-hover` (0,15) statt `--tf-border` (0,08), 20 px statt 16 px hoch** ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx)); Layout unverändert: die fünf Regler enden weiter bei 1068 von 1152 px

### v4.69.0 — die Optionszeile stellt drei Fragen (August 2026)

MINOR — Gemeldet: „das Wording in diesem Dropdown ist noch etwas sperrig", dazu der Wunsch, die Auswahlboxen nach Fragen zu gruppieren. Sperrig war die Bauform: „Wortverknüpfung:" plus drei Substantiv-Fetzen, die erst durch das Label daneben einen Sinn ergaben — aufgeklappt liegt die Liste über der Seite, und das Label ist dann weit weg. Genau das hatte der Suchbereich mit „Suche in: …" schon gelöst.

- **Jede Auswahl trägt ihre Frage im Kasten**, die Zeile liest sich von links nach rechts: „Suche mit: …" · „Suche in: …" │ Feinjustierung ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx))
- **Die Wortverknüpfung sagt ihre Regel als ganzen Satz** — „alle Wörter müssen vorkommen" · „irgendein Wort genügt" · „genau diese Wortfolge"; das Label „Wortverknüpfung:" entfällt ersatzlos ([useSuchVerknuepfung.ts](src/core/hooks/useSuchVerknuepfung.ts))
- **Der Suchbereich rückt nach links**, direkt hinter die Art der Suche: er ist die zweite Grundentscheidung, nicht eine Feinheit — ein eingeengter Bereich lässt Treffer ganz verschwinden
- **„Suche mit: einer Frage" statt „mit natürlicher Sprache suchen"** — die Seite nennt das Verfahren überall sonst schon Frage („Frage stellen", „Oder stell eine Frage")
- Gemessen in `dev:local`: die fünf Regler stehen bei 1152 px auf einer Zeile und brauchen **1068 px statt 1092** — trotz längerer Texte 24 px weniger ([suche.md](docs/feedback-kontext/suche.md))

### v4.68.1 — die zwei Haken nennen ihre Achse selbst (August 2026)

PATCH — Gemeldet: „man muss sich als User genau beide Tooltips durchlesen, um den Unterschied zu verstehen". Der Befund lag in den Namen: „Wortformen mitsuchen" nannte Wörter, „Ähnlichkeitssuche" nannte Ähnlichkeit — wovon, sagte keiner. Weil keiner für sich stand, brauchte jeder Tooltip einen Verweis auf den anderen („Nicht zu verwechseln mit …"); genau das war das Symptom.

- **„auch andere Wortformen" ⇄ „auch ähnliche Themen"** ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx)): gleicher Satzbau, Wörter gegen Themen — der Unterschied steht in den Beschriftungen statt in zwei Tooltips
- **Der Zusatz „(lädt 200 MB)" nennt die Kosten statt der Technik** — er ist zugleich das zweite Unterscheidungsmerkmal, denn die Wortformen wirken sofort und laden nichts
- **Beide Tooltips öffnen mit ihrem eigenen Gegensatzpaar** („Gleiches Wort, andere Form" / „Gleiches Thema, andere Wörter") und verweisen nicht mehr aufeinander
- Kein-Treffer-Ausweg und Startzustand ziehen die neue Benennung mit ([auswege.ts](src/plugins/suche/auswege.ts), [SucheStartzustand.tsx](src/plugins/suche/SucheStartzustand.tsx)); die fünf Regler bleiben gemessen auf einer Zeile (1131 von 1152 px)

### v4.68.0 — die Frage-Zeile wird kuerzer, die Wortformen echter (August 2026)

MINOR — Drei Meldungen zur Suche, eine Wurzel: die Oberfläche behauptete Dinge, die nicht galten. Im Frage-Modus standen vier Regler, von denen keiner noch etwas bestimmte; ein toter lokaler KI-Server lieferte statt der Verbinden-Aufforderung den Browser-Text „Failed to fetch"; und „Wortformen mitsuchen" schlug zu „Normen" das Wort „enormes" vor — am echten Bestand **134 von 285** Treffern für den Stamm `norm` waren solche Buchstaben-Treffer.

- **Der Frage-Modus sucht erst auf Anforderung** und zeigt nur noch, was dort wirkt: Verknüpfung und Wortformen verschwinden, der Bereich bleibt sobald er einengt, die Ähnlichkeitssuche solange sie läuft ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx), [SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Der Wortstamm zählt nur an einer Wortgrenze** ([wortstamm.ts](src/core/services/search/wortstamm.ts)): `standard` und `bahn` verlieren keinen Treffer, `norm` 134 — jede Stichprobe „enorm…"; dieselbe Regel beim Suchen und beim Einsammeln der Chips ([suche-relevanz.md §5](docs/architecture/suche-relevanz.md))
- **Die acht gezeigten Wortformen sind die häufigsten**, nicht die des zufällig ersten Treffers ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts))
- **„von der KI prüfen" sortiert aus, was nur den Stamm teilt** — ein Lauf auf Wunsch, das Ergebnis landet in derselben Abwahl wie ein Nutzer-Klick und ist einzeln rücknehmbar ([wortformen-pruefung.ts](src/core/services/search/wortformen-pruefung.ts))
- **Der KI-Preflight prüft jeden internen Transport**, nicht nur die Bridge ([ki-guard.ts](src/core/services/ai/ki-guard.ts)); ein nicht erreichbarer direkter Server bekommt einen eigenen Dialogtext samt Adresse ([KiConnectPromptDialog.tsx](src/core/components/KiConnectPromptDialog.tsx))

### v4.67.0 — Eigene Reiter: den eingerichteten Arbeitsplatz merken (August 2026)

MINOR — Nachtrag zu v4.65: dort blieb der Wunsch nach eigenen Reitern liegen, weil von neun Dingen, die einen eingerichteten Arbeitsplatz ausmachen, nur vier am Reiter hingen — Spalten, Breiten, Dichte, Filter und die Auswahl in den Spaltenköpfen galten global, letztere überlebte nicht einmal einen Neustart. Ein Reiter, der elf von zwölf Achsen wiederherstellt, verspricht mehr, als er hält.

- **Eigener Reiter hinter dem Lesezeichen am Ende der Leiste**: er sitzt auf einer der vier festen Sichten und nimmt Filter, Ansichtsform, Gruppierung, Sortierung, Spaltensatz, Breiten, Dichte und Kopf-Auswahl mit ([eigeneReiter.ts](src/plugins/antraege/eigeneReiter.ts), [reiterZustand.ts](src/plugins/antraege/reiterZustand.ts))
- **Markiert, solange der Stand passt** — verglichen werden nur die Achsen, die im jeweiligen Zustand gelten (aus `baueDarstellungsAchsen`, keine zweite Tabelle); gezogene Breiten und die Kopf-Sortierung zählen nicht mit, werden aber wiederhergestellt
- **Die Spaltenkopf-Auswahl liegt jetzt im Store und überlebt einen Neustart** ([kopfFilter.ts](src/plugins/antraege/kopfFilter.ts)); `useColumnFilters` bekam dafür einen optionalen gesteuerten Modus, alle anderen Tabellen bleiben unberührt ([useColumnFilters.ts](src/components/data-table/useColumnFilters.ts))
- **Merken, Nachziehen, Umbenennen, Entfernen in EINEM Menü** ([EigeneReiterMenue.tsx](src/plugins/antraege/EigeneReiterMenue.tsx)); höchstens vier, ohne Trefferzahl — die müsste den ganzen Ausschnitt versprechen
- **Die drei Speicher-Schlüssel der Tabelle an einer Stelle** ([tabellenSpeicher.ts](src/plugins/antraege/tabellenSpeicher.ts)); Breiten, Gesamtbreite und Kopf-Sortierung werden über die Funktionen ihres Hooks geschrieben, die Tabelle danach neu aufgebaut

### v4.66.0 — Eine Frage stellen statt Wortformen raten (August 2026)

MINOR — Der Platzhalter lud seit v3.50 zu einer „analytischen Frage" ein und konnte keine beantworten: am echten Bestand liefert „Welche Vorhaben drehen sich hauptsächlich um Normung und Standards?" wörtlich **0 Treffer**, „Normung" allein 5 — obwohl die Sache tausendfach da ist, unter „Normen", „Normierung", „Standardisierung". Die interne KI ist damit die Synonymquelle, die [suche-relevanz.md §5](docs/architecture/suche-relevanz.md) als fehlend benannt hat: das Embedding kann Nachbarschaft messen, aber keine Begriffe BENENNEN.

- **Ein Leitbegriff = ein Suchteil, seine Schreibweisen = dessen Nadeln** ([frageplan.ts](src/core/services/search/frageplan.ts)): `abdeckung` zählt damit die gefragten SACHEN statt der Schreibweisen — gemessen 4 hoch / 20 mittel gegen 0 / 0 bei flacher Liste, bei identischen 583 Treffern ([suche-relevanz.md §8](docs/architecture/suche-relevanz.md))
- **`pflicht` trennt Einschränkung von Alternative** ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts)): „Was läuft in Bayern zum Thema Leichtbau?" liefert 87 statt 2.625; ohne Plan verhält sich die Stufe bitweise wie zuvor
- **Ein Aufruf, nur intern, Ziel `standard`, kein Retry, wirft nie** ([frageplan-lauf.ts](src/core/services/search/frageplan-lauf.ts))
- **Die Leitbegriffe als abwählbare Chips mit Schreibweisen-Zähler** ([DeutungsZeile.tsx](src/plugins/suche/DeutungsZeile.tsx)): Abwählen rechnet ohne neuen KI-Aufruf; was aus der Frage nicht übersetzt wurde, steht daneben
- **Verknüpfung und Wortformen geben sichtbar ab** („von der KI bestimmt", [SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx)); Flag `sucheNatuerlicheSprache`, dev + pl

### v4.65.0 — Vier Reiter, tote Segmente weg, Sortierung ins Menue (August 2026)

MINOR — Vierte Runde am Redesign-Handoff, diesmal die Überschneidung der drei Filter-Ebenen: Reiter, Quickfilter-Pillen und Filterleiste beantworteten teils dieselbe Frage. „Begleitung" stand dreimal auf einem Bildschirm — als Reiter, als gespiegelter Chip in der Leiste und als Segment mit einer 0, weil der Reiter selbst schon nach Status schneidet.

- **Vier Reiter statt sechs**: Antragsphase · Fristen · Begleitung · Alle. „Fristen" fasst „Diese Woche" und „Überfällig" zusammen und öffnet nach Dringlichkeit gebändert; „Bewilligt <Jahr>" entfällt ([views.ts](src/plugins/antraege/views.ts))
- **Tote Segmente stehen nicht mehr da**: was in dieser Sicht 0 liefert, entfällt — Anker und getroffene Auswahl bleiben ([segAnzeige.ts](src/plugins/antraege/filter/segAnzeige.ts))
- **„Eigene Auswahl" statt stillem „Alle"**: setzt die Filterleiste etwas, das die Pille nicht ausdrücken kann, sagt sie das, statt das Gegenteil zu behaupten ([phaseQuickfilter.ts](src/plugins/antraege/filter/phaseQuickfilter.ts), [kategorieQuickfilter.ts](src/plugins/antraege/filter/kategorieQuickfilter.ts))
- **Sortierung ins Darstellungs-Menü** (nur Liste/Karten — die Tabelle sortiert über ihre Spaltenköpfe): die Pillenzeile trägt nur noch die Menge, das Menü nur noch die Form ([darstellungsAchsen.ts](src/plugins/antraege/darstellungsAchsen.ts))
- **Verlauf statt „Häufig benutzt"**: die zuletzt benutzten Filterstände hinter einem Uhr-Knopf im Kopf der Leiste, der Vorschlag führt zum Anpinnen; die gespiegelte Schnellauswahl entfällt ([VerlaufMenue.tsx](src/plugins/antraege/filter/VerlaufMenue.tsx))

### v4.64.0 — Suchzeile entschlackt, Ansicht ins Menue, graues L (August 2026)

MINOR — Dritte Runde am Redesign-Handoff, diesmal Rückbau statt Zubau: über der Tabelle standen rund 15 Bedienelemente, im Entwurf 8. Weg kommt, was selten angefasst wird oder woanders hingehört; dabei kam ein Zusagenbruch heraus — die Dokumentsuche hing am Opt-in der Ähnlichkeitssuche und war im Normalzustand aus.

- **Dokumenttreffer ohne Vorbedingung**: die DMS-Stufe läuft immer (Orama-Wortlaut, kein Modell), nur die Embedding-Stufe bleibt Opt-in ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts))
- **Das Dauer-Auswahlfeld „Ohne Ähnlichkeitssuche" ist weg** — der Weg dorthin erscheint als Satz unter dem Suchfeld, sobald gesucht wird, mit Rückweg an derselben Stelle ([AehnlichkeitsHinweis.tsx](src/plugins/antraege/AehnlichkeitsHinweis.tsx))
- **Ansichtsform als Achse im Darstellungs-Menü** statt drei Symbolen im Kopf; die Tabelle ist jetzt der Standard ([viewModes.ts](src/plugins/antraege/viewModes.ts), [darstellungsAchsen.ts](src/plugins/antraege/darstellungsAchsen.ts))
- **Filter-Knopf links neben das Suchfeld**, an die Kante, an der die Leiste aufgeht; „inaktive MAs" ist als „Bestand" in die Filterleiste gezogen ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx), [FilterSidebar.tsx](src/plugins/antraege/filter/FilterSidebar.tsx))
- **Fläche statt Strich**: Filterleiste und Tabellenkopf teilen eine getönte Grundfläche, die Trennlinie entfällt; die Achse „Spalten" heißt „Spaltensatz" ([AntraegePage.tsx](src/plugins/antraege/AntraegePage.tsx))

### v4.63.0 — Filter links, Schnellzugriff, Auswahl (August 2026)

MINOR — Zweite Runde aus dem Redesign-Handoff `_design/handoff/Förderanträge/`: der Filterblock (Leiste links, beschrifteter Knopf, Anpinnen) und die Mehrfachauswahl. Die Massen-Aktionen bleiben auf das begrenzt, was die App wirklich kann — sie liest das Fachsystem, sie schreibt nicht hinein (Pitfall #44).

- **Die Filterleiste steht links** neben der Liste, der Drawer fährt von links herein; der Knopf trägt Beschriftung und Zahl statt eines Punkts ([AntraegePage.tsx](src/plugins/antraege/AntraegePage.tsx))
- **Schnellzugriff zum Anpinnen** — Einzelwert als Umschalt-Chip, ganze Facette als Umschalter-Pille, Kombination als Schalter, der dazulegt und nur sein eigenes Zutun zurücknimmt ([pinnedFilters.ts](src/plugins/antraege/filter/pinnedFilters.ts))
- **Mehrfachauswahl** mit Häkchen in der Identitätsspalte und Leiste unten: Auswahl als XLSX exportieren, FKZ-Liste kopieren, aufheben ([auswahl/](src/plugins/antraege/auswahl/))
- **Kurzname und Kennzeichen in einer Spalte „Antrag"**, gelockt und klebend; die Einzelspalten bleiben wählbar, gespeicherte Spaltenwahlen werden einmalig umgeschrieben ([useAntraegeColumnsStore.ts](src/plugins/antraege/useAntraegeColumnsStore.ts))
- **Zeilendichte Kompakt/Normal** als Achse im Darstellungs-Menü, und das ⓘ der Status-Zellen erscheint erst beim Überfahren der Zeile ([useDichteStore.ts](src/plugins/antraege/useDichteStore.ts))

### v4.62.0 — Die Frist rueckt nach vorn, Spalten kommen als Satz (August 2026)

MINOR — Übernahme aus dem Redesign-Handoff `_design/handoff/Förderanträge/`, auf das Tragfähige eingekürzt: die Frist stand als **letzte** Spalte am rechten Rand, und der Weg zu einem Arbeits-Spaltensatz führte durch 26 Einzelhaken. Nicht übernommen wurden die Massen-Leiste (die App schreibt nicht ins Fachsystem, Pitfall #44) und „Zeile öffnet die Detailseite" (die Klickzonen sind vergeben).

- **Die Frist steht als zweite Spalte**, in eigener Rubrik zwischen FKZ und Zuständigkeit — die Rubrik-Bänder bleiben dabei zusammenhängend ([tableColumns.tsx](src/plugins/antraege/tableColumns.tsx))
- **Dringlichkeits-Rinne** am Zeilenanfang, rot/orange/gelb nach denselben Schwellen wie der Ampelpunkt; grün und stehende Uhren bleiben ohne (`rowAccent`, [TableBody.tsx](src/components/data-table/TableBody.tsx))
- **Gruppierung „Frist"** als vierte Sektionierungs-Achse — Abschnitte und Beschriftungen aus `FRIST_AMPEL_STUFEN`, nicht aus zweiten Grenzen ([tableGrouping.ts](src/plugins/antraege/tableGrouping.ts))
- **Vier Spaltenprofile** (Standard · Triage · Fristen · Alle) als Achse im Darstellungs-Menü; „Triage" passt bei 1340 px ohne waagerechtes Scrollen ([spaltenProfile.ts](src/plugins/antraege/spaltenProfile.ts))
- **Zwei verdichtete Spalten** „Zuständig" (FB+AB der Antragsphase) und „FB / PreCheck" — Farbpunkt nur am PreCheck, weil nur der eine kuratierte Einteilung hat

### v4.61.0 — Chronik nach Datum als Standard, Ausklapp zeigt den juengsten Abschnitt (August 2026)

MINOR — Die chronologische Chronik rendert an zwei Stellen dieselbe Komponente — Detailseite und Tabellen-Ausklapp — und sah trotzdem verschieden aus: andere Träger-Marken, andere Standard-Ordnung, anderer Reiter-Name. Jetzt eine Bildsprache, zwei Tiefen: in der Tabelle der jüngste Abschnitt, auf der Detailseite alles. Detail: [chronik-und-zeitstrahl.md](docs/status-system/chronik-und-zeitstrahl.md).

- **„Nach Datum" ist der Standard** der Chronik — und erreicht auch gespeicherte Stände, weil `modusGewaehlt` den Klick auf den Schalter von der Mitschrift trennt ([timelinePrefs.ts](src/plugins/antraege/status/timelinePrefs.ts))
- **Der Ausklapp zeigt die acht jüngsten Zeilen** statt Median 22/p90 32, mit Schalter „N ältere Einträge zeigen" darüber; die Kennzahlen nennen weiter den ganzen Vorgang (`juengsteZeilen`, [StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx))
- **Träger-Marken lesen überall `TV 1 … TV n` / „alle N"** statt der Aktenzeichen-Endung — die Karte kommt aus `tvAchse` über den ganzen Verbund ([chronik-matrix.ts](src/core/status/chronik-matrix.ts))
- **Der Bahn-Reiter heißt in beiden Wirten „Zeitstrahl"** ([AusklappInhalt.tsx](src/plugins/antraege/ausklapp/AusklappInhalt.tsx)); der gespeicherte Wert bleibt `zeitverlauf`
- **Guard `chronik-zwei-wirte-ein-vokabular`** hält beide Zusagen fest ([conventions-status.test.ts](src/__tests__/conventions-status.test.ts))

### v4.60.2 — Die Quellen-Zeile bekommt ihre Breite zurueck (August 2026)

PATCH — Auf **Datenpflege → CSV-Quellen** zerfiel jede Quellen-Zeile: die Metazeile brach zeichenweise in eine ~47 px schmale Säule, die vier Aktionsknöpfe legten sich darüber. Grund war kein Umbruch-Detail, sondern ein Breitenbudget: die Knöpfe brauchen ~494 px, die Nebenspalten-Form des Hubs gab der Zeile ~541 px — auch bei maximaler Seitenbreite.

- **Die Quellen-Liste bekommt die volle Breite** ([CsvQuellenPanel.tsx](src/plugins/kuration/csv-quellen/CsvQuellenPanel.tsx)) — die Nebenspalte entfällt, wie es `settings-layout.css` für Listen-Panels ausdrücklich vorsieht
- **Der Zustand steht als schmaler Streifen über der Liste** — vier Kennzahlen statt Hochkant-Block, Anker `sec-csv-zustand` und Badge unverändert
- **Die Zeile bricht anständig um statt sich zu überlagern** ([SourceList.tsx](src/plugins/csv-sources-kuration/SourceList.tsx)) — `flex-wrap` + `basis-72`/`shrink-0`; bei schmalem Fenster rutscht die Knopfreihe rechtsbündig unter den Text
- **Keine Aktion verschwindet** — alle vier Knöpfe bleiben sichtbar und beschriftet, die Metazeile ungekürzt

### v4.60.1 — Kurator-Schalter oeffnet die Sitzung (August 2026)

PATCH — In Builds **ohne** Kurator-Zusatzpasswort öffnete nichts die Kurator-Sitzung: der freie Schalter im Profil setzte nur die Menü-Sichtbarkeit. Die Kurations-Seiten standen offen, aber jede Schreib-Aktion darin blieb grau — ohne dass irgendwo stand, warum. Detail: [modul-freischaltung.md](docs/architecture/modul-freischaltung.md).

- **Ohne Schloss folgt die Sitzung dem Schalter** (`spiegleKuratorSchalterInSession`, [modul-freischaltung.ts](src/core/modul-freischaltung.ts)) — beim Umlegen und bei jedem Start; mit Schloss unverändert ein No-op, dort entscheidet allein das Passwort
- **Der Schalter tut jetzt beides**, wie der Passwort-Weg: Profil-Flagge, Sitzung und Handle-Hochstufung auf `readwrite` in derselben Geste ([ZusatzModuleGruppe.tsx](src/plugins/einstellungen/profil/ZusatzModuleGruppe.tsx), Pitfall #25)
- **Ein grauer Knopf nennt seinen Grund sichtbar** ([CsvSchemaDetailDialog.tsx](src/plugins/csv-sources-kuration/CsvSchemaDetailDialog.tsx)) — er stand im `title` eines `disabled`-Buttons, und den zeigt kein Browser an; der Dialog verdeckte zusätzlich den Seiten-Banner
- **Vier Tests** halten die Invariante: mit Schloss unangetastet, ohne Schloss beidseitig gespiegelt, und eine laufende Sitzung wird nicht bei jedem Start verlängert ([modul-freischaltung.test.ts](src/core/__tests__/modul-freischaltung.test.ts))

### v4.60.0 — Spalten fuellen die Breite, der Griff schaltet um (August 2026)

MINOR — Die Fördertabelle stand fest auf Inhaltsbreite: jede Spalte nahm, was ihr längster Eintrag brauchte, und was übrig blieb, landete in einer leeren Füllspalte. Jetzt teilen sich die Spalten die verfügbare Breite und skalieren mit ihr; die alte Darstellung liegt einen Klick entfernt. Detail: [ui-muster.md](docs/architecture/ui-muster.md).

- **Einpassen wächst jetzt auch** (`flex: 1 1 auto`) — vorher blieb die Tabelle bei ihrer Wunschbreite stehen, sobald die Spaltensumme kleiner war als der Container ([tableLayout.ts](src/components/data-table/tableLayout.ts))
- **Der Griff trägt zwei Gesten**: Ziehen pinnt eine Pixelbreite, Klick verwirft erst einen Pin und schaltet danach Einpassen ↔ Inhaltsbreite um (der Doppelklick-Reset geht darin auf); 4px → 6px ([TotalWidthGrip.tsx](src/components/data-table/TotalWidthGrip.tsx))
- **Fix: ein Klick ohne Bewegung pinnte die Tabelle** — der Griff kannte die `DRAG_SCHWELLE` der Spaltengriffe nicht und committete auf jedem Mouseup
- **Umschalt-Zustand je Tabelle persistiert** in einem eigenen Schlüssel neben der gepinnten Breite ([useTotalTableWidth.ts](src/components/data-table/useTotalTableWidth.ts))
- **Boden der Fördertabelle** ist die Summe der Spalten-Mindestbreiten statt pauschal 720px ([AntraegeTable.tsx](src/plugins/antraege/AntraegeTable.tsx))

### v4.59.0 — Die Chronik zeigt zurueckgenommene Termine (August 2026)

MINOR — Nimmt jemand in C16 eine Setzung zurück, überschreibt der Nacht-Export die Spalte und die Zeile ist spurlos. Das Journal hielt es fest, die Chronik zeigte es nicht — die Aussage, für die es das Journal gibt, war die einzige unsichtbare. Detail: [chronik-und-zeitstrahl.md](docs/status-system/chronik-und-zeitstrahl.md) + [vorgangssystem.md §12.10](docs/architecture/vorgangssystem.md).

- **Durchgestrichene Zeile am alten Tag** für jeden Termin, den der Export nicht mehr führt — `geleert` als „zurückgenommen", `geaendert` als „verschoben auf …", über Träger gefaltet ([chronik-zurueckgenommen.ts](src/core/status/chronik-zurueckgenommen.ts))
- **Fünfter Knotenzustand** (gestrichelter grauer Ring) samt Legende und Kennzahl „· 2 zurückgenommen"; beides zählt nicht in die Datumsangaben ([StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx), [verlauf-kennzahlen.ts](src/core/status/verlauf-kennzahlen.ts))
- **Nullpunkt unter der Chronik**, in drei unterschiedenen Fassungen und im selben Wortlaut wie die Historie-Sektion ([JournalNullpunkt.tsx](src/plugins/antraege/status/JournalNullpunkt.tsx), [journalTexte.ts](src/plugins/antraege/status/journalTexte.ts))
- **Ein Journal-Lesevorgang je Seite** statt drei — `stand.json` wiegt über 5 MB und ist bewusst nicht gecacht ([useJournalChroniken.ts](src/plugins/antraege/status/useJournalChroniken.ts))
- **Fix: „kein Journal" war beim Kaltstart eine Falschaussage** — `leseSidecar` wirft fehlenden Share-Handle und fehlende Datei auf dasselbe `null`; ein Deep-Link-Reload traf das zuverlässig. Vier Versuche über 11 s, bis dahin „lädt" (Bug-Klasse 1); heilt die Historie-Sektion seit v4.13 mit

### v4.58.0 — Der manuelle CSV-Import zeigt seinen Lauf (August 2026)

MINOR — Der Lauf dauert bei mehreren Quellen Minuten, und die manuellen Türen zeigten dabei nichts als einen Knopf, der „Importiere…" hieß. Das liest sich als Hänger. Detail: [csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md).

- **Fortschritt im „● CSV"-Dialog** (Spinner + Phase + Balken + Prozent, Quellen-Zähler „2/3") — beide manuellen Türen riefen `runDataUpdate` mit leerem Options-Objekt, also ohne den `onPhase`-Kanal, den der Orchestrator seit je anbietet ([CsvFreshnessIndicator.tsx](src/components/ui/CsvFreshnessIndicator.tsx), [OrdnerGruppe.tsx](src/plugins/einstellungen/daten/OrdnerGruppe.tsx))
- **„Fertig" nach dem Lauf**: der Import-Knopf verschwindet, sobald der Status auf `fresh` kippt — nichts sagte danach, dass man das Fenster zumachen kann
- **Drift ist keine Sackgasse mehr**: der Dialog zeigt den Bericht selbst, statt auf einen Banner zu verweisen, den nur der Banner-Lauf füllt; `driftAkzeptiertFuer` reicht „Trotzdem importieren" durch ([data-update.ts](src/plugins/csv-sources-kuration/services/data-update.ts))
- **„Verarbeitet" ist nicht „geändert"**: `RefreshReport.changedAntraege` trennt beides, die Meldung sagt „keine inhaltlichen Änderungen" statt neue Daten zu versprechen ([datenUpdateMeldung.ts](src/plugins/csv-sources-kuration/services/datenUpdateMeldung.ts))
- **`loadAll` schweigt nicht mehr, wenn es scheitert** ([store.ts](src/plugins/antraege/store.ts)): `console.warn` + `lastLoadedAt: 0`, sonst strandete ein fehlgeschlagener Post-Import-Refresh hinter dem TTL-Skip bis zum Browser-Reload

### v4.57.1 — Kanonische Felder zeigen ihre Kuerzel (August 2026)

PATCH — In der Feldauswahl standen die kanonischen Felder ohne Herkunft: `antragsdatum` sagt nicht, aus welcher Spalte des Fachsystems es entsteht. Die rohen Codes standen daneben, die Standardfelder schwiegen.

- **Kanonische Felder nennen ihre Quell-Kürzel** (`antragsdatum ← D_AAE`) in der Feldauswahl des Anlege-Dialogs; voller Satz im Tooltip, wenn mehrere Programme verschiedene Spalten mappen ([SpaltenDialog.tsx](src/plugins/antraege/eigene-spalten/SpaltenDialog.tsx))
- **Suchbar nach dem Code**: wer „D_AAE" eintippt, findet `antragsdatum` — die Herkunft anzuzeigen, aber nicht danach suchen zu lassen, wäre eine halbe Auskunft
- **Eine Auflösung statt zweier**: `rohSpaltenJeKanonisch` ist vom Plugin in den Kern gezogen ([spalten-inventar.ts](src/core/services/csv/spalten-inventar.ts)) — Kopf-Tooltip und Feldauswahl lesen jetzt dieselbe, statt bei der ersten Mapping-Feinheit auseinanderzulaufen

### v4.57.0 — Eigene Spalten fuer das Team (August 2026)

MINOR — Eine eigene Spalte war bisher eine Privatsache: gerätelokal, für niemanden sonst sichtbar. Wer eine erprobt hatte, konnte sie nur beschreiben, nicht weitergeben. Jetzt hebt sie ein Griff ins Team. Detail: [eigene-spalten.md](docs/architecture/eigene-spalten.md).

- **Team-Spalten** in der Sidecar `_intern/eigene-spalten.json`, idempotent-overwrite, Schreiben self-gated + `canManageTeamSpalten` ([team-store.ts](src/core/spalten/team-store.ts)); Lesen für alle, eigene Rubrik im Spalten-Menü
- **„Ins Team übernehmen"** am Stift einer persönlichen Spalte: Einweg-Kopie auf eine `frei:team:`-Id, die persönliche entfällt — und die Spaltenwahl zieht mit, sonst verschwände die Spalte im Moment des Teilens ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx))
- **Jede Ablage filtert beim Lesen auf ihre Herkunft** ([lesen.ts](src/core/spalten/lesen.ts)) — die Sidecar liegt im Klartext auf dem Share, eine `frei:ich:`-Zeile darin schöbe sonst allen eine „persönliche" Spalte unter, die niemand löschen kann
- **Ein gescheiterter Share-Write bricht ab, statt halb zu übernehmen** ([useEigeneSpalten.ts](src/plugins/antraege/useEigeneSpalten.ts)); neuer Guard: `team-store.ts` ist der einzige Share-Berührpunkt unter `core/spalten/`
- **Der Team-Cache unterscheidet zwei Fälle**: fehlende Datei leert ihn (gelöscht bleibt gelöscht), unerreichbarer Share lässt ihn stehen

### v4.56.0 — Regel-Spalten, Bearbeiten und Entfernen (August 2026)

MINOR — Die dritte Spaltenart: eine geordnete Regelkaskade, die je nach Zustand einen anderen Text zeigt. Dazu die beiden Wege, die bis hierher fehlten — eine angelegte Spalte ließ sich weder bearbeiten noch entfernen. Detail: [eigene-spalten.md](docs/architecture/eigene-spalten.md).

- **Regel-Spalten**: „erste zutreffende Regel gewinnt", Bedingungen über den geteilten [BedingungEditor](src/plugins/meilensteine/BedingungEditor.tsx) — dieselbe Komponente wie Meilensteine und Vorgangs-Regeln, kein Fork
- **Sortiert nach dem Rang der Regel**, nicht nach ihrem Text: die Reihenfolge ist die Aussage des Autors, alphabetisch stünde sie zufällig ([anzeige.ts](src/core/spalten/anzeige.ts))
- **Bearbeiten und Entfernen** über den Stift an der Spalte im Menü — ausblenden ist nicht löschen ([AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx))
- **Belegt, dass Textänderungen frei sind**: am echten Bestand 0,5 s gegen 6,0 s mit neuem Feld (14.225 Anträge) — genau die Zusage, für die die Rohwert-Projektion gebaut wurde
- **Behoben**: das Bearbeiten-Formular übernahm die Art einer bestehenden Spalte nicht und hätte eine Regel-Spalte beim Speichern in eine Feld-Spalte verwandelt ([SpaltenDialog.tsx](src/plugins/antraege/eigene-spalten/SpaltenDialog.tsx))

### v4.55.0 — Eigene Spalten: Feld und Sammel (August 2026)

MINOR — Der Spaltenvorrat war geschlossen: wer ein Feld brauchte, das die Registry nicht führt, hatte keinen Weg. Jetzt legt der Nutzer eigene Spalten an — aus einem rohen Feld oder als jüngstes Datum aus mehreren. Detail: [eigene-spalten.md](docs/architecture/eigene-spalten.md).

- **Feld- und Sammel-Spalten**, persönlich und gerätelokal; Anlegen aus dem Fuß des Spalten-Menüs, mit Pflicht-Vorschau an echten Zeilen ([SpaltenDialog.tsx](src/plugins/antraege/eigene-spalten/SpaltenDialog.tsx), Flag `eigeneSpalten`, dev+pl)
- **Projiziert werden die Rohwerte, nicht das Ergebnis** ([anzeige.ts](src/core/spalten/anzeige.ts)) — dadurch bleiben Datumsregeln taggenau und das Ändern von Text oder Farbe kostet **keinen** Neuaufbau; nur ein neues Feld tut das (gemessen: 6,0 s bei 14.225 Anträgen)
- **Alle vier Slim-Schreibpfade** führen den Beutel `frei_roh`, Projektion 6 → 7 ([list-view-migration.ts](src/core/services/csv/list-view-migration.ts)); Regressionstest gegen die Vollersatz-Falle ([merge-behaelt-freie-spalten.test.ts](src/core/services/csv/__tests__/merge-behaelt-freie-spalten.test.ts))
- **Eigene Spalten erklären sich selbst** — ihre Herkunftsangabe entsteht aus der Definition, dieselbe Struktur wie bei den eingebauten (v4.54)
- **Guard `eigene-spalten-lokal`**: die persönlichen Definitionen gehen nie auf den Share oder in den Snapshot ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts))

### v4.54.0 — Spaltenkoepfe erklaeren ihre Herkunft (August 2026)

MINOR — „PreCheck Status" war ein Badge ohne Herkunft: welche Kürzel darin zusammenlaufen und welche Regel den Wert wählt, stand nirgends in der Oberfläche. Der Tooltip nennt jetzt die Felder, die das geladene Schema wirklich mappt — nicht eine abgeschriebene Liste, die beim nächsten Mapping-Wechsel still falsch wäre.

- **Jeder Spaltenkopf erklärt sich beim Überfahren**: ein Satz, die Auswahlregel, die speisenden Felder als Code + Klartext ([SpaltenHilfeInhalt.tsx](src/components/data-table/SpaltenHilfeInhalt.tsx), [TableHeadRows.tsx](src/components/data-table/TableHeadRows.tsx))
- **Die Feldlisten kommen aus dem Schema, nicht aus dem Code** — PreCheck zeigt seine 9, FB seine 11 gemappten Spalten mit den Beschriftungen des Programms ([spaltenHilfe.ts](src/plugins/antraege/spaltenHilfe.ts), [useSpaltenHilfe.ts](src/plugins/antraege/useSpaltenHilfe.ts))
- **Eine leere Spalte sagt, warum sie leer ist**: „In diesem Programm ist dafür keine Spalte gemappt" statt einer stummen Zelle — gemessen an *Zuwendung* und drei Ordner-Spalten des Katalogs
- **Auch im Spalten-Picker**, am ⓘ je Zeile: die Herkunft steht da, wo man entscheidet, ob man die Spalte braucht ([ColumnPicker.tsx](src/components/data-table/ColumnPicker.tsx))
- **Guard `spalten-hilfe-abdeckung`** hält die Vollständigkeit in beide Richtungen — neue Spalte ohne Satz und Satz ohne Spalte fallen im Gate auf ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts))

### v4.53.0 — Verbundkennzeichen suchbar, nw statt netz, keine Null vor der Messung (August 2026)

MINOR — Nach dem FKZ ließ sich direkt suchen, nach dem Verbundkennzeichen nicht. Dieselbe Messung wie in v4.50, diesmal über die Spalten, die Codes tragen: von 512 Spalten bleiben genau vier — mehr Kennzeichen gibt es im Bestand nicht. Detail: [suche-relevanz.md](docs/architecture/suche-relevanz.md).

- **Verbundkennzeichen als eigene Fundstelle** (100 % gefüllt, 7.535 Verbünde): `vb:ZKN073232` → 9 Teilvorhaben, vorher 0 — die Nummer stand in keinem durchsuchten Feld ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts), [korpusFeldAufloesung.ts](src/plugins/antraege/services/korpusFeldAufloesung.ts))
- **Das Fachsystem-Aktenzeichen fällt mit dem FKZ zusammen** — `KNF065624` findet denselben Antrag wie `16KN065624`, über `fkz:`/`akz:`/`kennzeichen:` ([feldpraefix.ts](src/core/services/search/feldpraefix.ts))
- **Netzwerk-Präfix heißt jetzt `nw:`**; `netz:` wird weiter gelesen, damit gemerkte Suchen nicht ins Leere laufen
- **Keine Null vor der Messung**: der Ergebniskopf schrieb „0 Treffer", solange der erste Lauf noch lief (gemessen 357–666 ms) — jetzt steht dort „… Treffer" ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Spalte „Verbund-Nr."** blendet sich wie die übrigen Belege selbst ein ([autoSpalten.ts](src/plugins/suche/autoSpalten.ts), [columns.tsx](src/plugins/suche/columns.tsx)); `ALTAKZ` bleibt draußen — der Import setzt es auf „ignorieren"

### v4.52.0 — Bestandslauf: Befund oben, Zahlen eingeklappt (August 2026)

MINOR — Der Reiter *Kürzel* zeigte zwei Mess-Kacheln mit rund 40 gleichrangigen Zahlen in elf Abschnitten, alle immer offen: die eine Zeile, die eine Zusage bricht, stand neben einem Median. Jetzt steht die Wertung vor den Zahlen, und die Zahlen bleiben vollständig — §14.3 zitiert aus ihnen. Detail: [vorgangssystem.md §14.3/§15.4](docs/architecture/vorgangssystem.md).

- **Ein Block, ein Knopf, Befund in Sätzen** — Zusagen (✓), Auffälligkeiten (⚠) und Kennzahlen (ohne Symbol, weil kein Schwellwert erfunden wird) statt einer Zahlenwand ([BestandslaufBlock.tsx](src/plugins/status-cockpit/BestandslaufBlock.tsx)); die volle Auswertung liegt unter „Zahlen im Detail"
- **Die Wertung ist eine reine Funktion** und damit erstmals im Node-Test prüfbar — der Bestand selbst ist es nicht ([bestandslaufBefund.ts](src/plugins/status-cockpit/bestandslaufBefund.ts))
- **Auffälligkeiten tragen bis zu drei Belege**; ist der Beleg ein Kürzel, filtert ein Klick die Tabelle darunter ([erhebung.ts](src/core/status/verlauf/erhebung.ts))
- **„Vergleich: C16" hieß seit v3.23 falsch** — die Zeilen verglichen C16 mit sich selbst; jetzt „Obergrenze", und der Prozentwert der TV-Zeile entfällt, weil er Datumsfelder gegen Übergänge rechnete ([VerlaufBefundeBlock.tsx](src/plugins/status-cockpit/VerlaufBefundeBlock.tsx))
- **Neu gemessen: die dritte Haltedatum-Quelle greift nirgends** — 0 statt 1 638 aus §15.4, weil Stufe 2 inzwischen 5 585 Fälle beantwortet; offen sind 42 angehaltene Vorgänge, nicht 1 030 ([fristErhebung.ts](src/plugins/status-cockpit/fristErhebung.ts))

### v4.51.0 — Zeitstrahl zeigt jeden Termin, mit Rolle und Filter (August 2026)

MINOR — Teil 2 des Handoffs `_design/handoff/chronik`. Die Bahn zeigte nur die Termine, die einen Statuswechsel auslösen — gemessen 7,3 %; die übrigen standen vollständig in den Daten und wurden nicht gezeichnet. Rolle, Filter und Fokus der Chronik erbt sie jetzt mit. Detail + die vier Abweichungen vom Entwurf: [chronik-und-zeitstrahl.md](docs/status-system/chronik-und-zeitstrahl.md).

- **Jeder Termin als Marke über der Bahn**, getönt nach Rolle; ein Tag = eine Marke mit „+n", was kollidiert entfällt ([bandTermine.ts](src/plugins/antraege/verlauf-band/bandTermine.ts), gemessen an ZKN084412/TV2: 18 Marken für 22 von 78 Terminen)
- **Klartext-Zeile mit Rangfolge** — Warnung, fehlende Kürzel (rot), fokussierter Termin, übrige Termine, Abschnittsnamen, Dauern ([bandBeschriftung.ts](src/plugins/antraege/verlauf-band/bandBeschriftung.ts)); dazu die **Rollenbilanz je Bahn** ([VerlaufBadges.tsx](src/plugins/antraege/status/VerlaufBadges.tsx))
- **Wer/Wo/Fokus wirken auf beide Ansichten**: Wer blendet ab, Wo blendet Bahnen aus, und die Achse bleibt dieselbe (gemessen: 0 px Abweichung bei „nur TV 3") ([bandGeometrie.ts](src/plugins/antraege/verlauf-band/bandGeometrie.ts), [StatusDetailSection.tsx](src/plugins/antraege/status/StatusDetailSection.tsx))
- **„Wer setzt" hat nur noch eine Quelle**: `baueUebergaenge` liest die Rollen aus der geladenen Fassung statt aus der Zuarbeit — die widersprachen sich an ZKN084412 um 37 Termine „Juristen" gegen null ([uebergaenge.ts](src/core/status/verlauf/uebergaenge.ts))
- **Balkenfarbe bleibt der Status** (der Entwurf färbt nach Rolle): PA ist Neutralgrau und von „neutral" nicht zu unterscheiden, ein Kürzel trägt bis zu vier Rollen, und der Balken nennt seinen Status als Text — `--tf-rolle-*-bar` entfällt ([theme.css](src/theme.css)); die Bahn zieht nach [BandBahn.tsx](src/plugins/antraege/verlauf-band/BandBahn.tsx)

### v4.50.0 — Netzwerk, Notizen und Wahlkreis werden mitdurchsucht (August 2026)

MINOR — Gefragt war, ob weitere Roh-CSV-Spalten mit sinnvollem Text in die Suche können. Entschieden hat nicht die Textmenge, sondern die Messung über alle drei aktiven Quellen (512 Spalten, 14.225 FKZ): welcher Text ist nirgendwo sonst auffindbar? Detail + verworfene Kandidaten: [suche-relevanz.md](docs/architecture/suche-relevanz.md).

- **Netzwerk** (11.492 Anträge): Name UND Netz-Kennzeichen — `netz:ProAnimalLife` findet 80 Teilvorhaben, vorher fand dieselbe Anfrage nur den Netzwerkantrag ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts))
- **Arbeitsnotizen** „Wichtig" + „Bemerkung" als EIN Feld (5.335): `notiz:Einbehalt` → 50 Treffer; dieser Text stand in keinem anderen durchsuchbaren Feld
- **Wahlkreis** (14.218) gehört zum „wo": „Northeim" 1 → 51 Treffer, die Bereichs-Beschriftung heißt jetzt „nur Ort, Bundesland & Wahlkreis" ([suchbereich.ts](src/core/services/search/suchbereich.ts))
- **NACE-Branchentext** fließt in die Deskriptoren (2.256): „Anstrichmitteln" 0 → 12; drei neue Belege in Zeile und Tabelle ([autoSpalten.ts](src/plugins/suche/autoSpalten.ts), [columns.tsx](src/plugins/suche/columns.tsx))
- **Korpus liest jeden Datensatz in EINEM Durchgang** statt einmal je Feld: 8.225 ms → 1.168 ms über 14.225 Anträge, trotz fünf zusätzlicher Felder

### v4.49.1 — Kuerzel ueberall in der Schreibweise des Teams (August 2026)

PATCH — Nachzug zu v4.48.3: dort lernte die Kürzel-Auswahl die Schreibweise des Teams, überall sonst stand weiter die Vergleichsform („Kürzel THÜ"). Die Bearbeitenden kennen ihr Kürzel gemischt geschrieben — 81 der 112 im Bestand sind es.

- **`anzeigeTokens` am Filter-Modus**, aus den Anträgen gelesen und rein zum Beschriften; verglichen wird weiter mit `tokens` ([bearbeiterFilter.ts](src/plugins/antraege/bearbeiterFilter.ts), Fassade [useBearbeiterSicht.ts](src/core/hooks/useBearbeiterSicht.ts))
- **Chip, Popover-Option und sechs Widget-Meta-Zeilen** nennen dieselbe Fassung — Meine Anträge, Antragseingang, Kanban, QS, Hängt fest, Meilensteine, Status & Verlauf
- **Drei Widgets bauten das Label selbst** und tragen es jetzt aus `bearbeiterScopeLabel` ([HaengtFestWidget.tsx](src/plugins/home/widgets/HaengtFestWidget.tsx), [MeilensteineWidget.tsx](src/plugins/home/widgets/MeilensteineWidget.tsx), [StatusVerlaufWidget.tsx](src/plugins/home/widgets/StatusVerlaufWidget.tsx))
- **Das Vorgangs-Board liest die Schreibweise aus den EIGENEN Zeilen** — wer die Seite direkt aufruft, hat den Anträge-Store nicht geladen ([useVorgangsBoard.ts](src/plugins/vorgangs-board/useVorgangsBoard.ts))
- **Guard `anzeigetokens-nur-anzeigen`**: die Anzeige-Fassung steht in keinem Vergleich ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts))

### v4.49.0 — Feldsuche in der Eingabe, Suchbeispiele auf der Startseite (August 2026)

MINOR — Wer weiß, in welcher Spalte sein Wort steht, konnte das bisher nur grob sagen: das Dropdown „Suche in" kennt fünf Bereiche und gilt für die ganze Anfrage. `FKZ: 16KN083001` oder `AST:GMBU` einzutippen fand nichts — „fkz:" war ein Suchwort wie jedes andere. Der Startzustand erklärte die Syntax bewusst nicht, weil es sie nicht gab; jetzt gibt es sie und er macht sie vor.

- **Feld direkt in der Eingabe**: `ast:Fraunhofer` (307), `ort:Dresden` (451), `titel:Laser ort:Dresden` (4) — Alltagswörter und Spaltencodes der Fördertabelle (`ORG_AST:`, `VB_TITEL:`), auch mit Leerzeichen getippt ([feldpraefix.ts](src/core/services/search/feldpraefix.ts))
- **Je Wort ein eigener Bereich**: das genannte Feld schlägt das Dropdown, Wörter ohne Präfix folgen ihm weiter ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts))
- **Dokumente und Ähnlichkeit bleiben außen vor**, solange ein Feld genannt ist — keine der beiden Quellen kann eine Feldangabe einhalten; die Deutungszeile schreibt es an ([useUnifiedSearch.ts](src/core/hooks/useUnifiedSearch.ts), [DeutungsZeile.tsx](src/plugins/suche/DeutungsZeile.tsx))
- **„So kannst du suchen"** auf der Startseite: sechs ausführbare Beispiele vom Thema bis zur Zwei-Felder-Anfrage ([SucheStartzustand.tsx](src/plugins/suche/SucheStartzustand.tsx))
- **Guard**: jedes Feld aus „alle Felder" braucht ein Präfix — sonst kann die Suche mehr, als sie sagt ([feldpraefix.test.ts](src/core/services/search/__tests__/feldpraefix.test.ts))

### v4.48.4 — Verlaufs-Leiste in Markenform: eckig, enger, lesbar (August 2026)

PATCH — Rückfrage zur neuen Leiste: warum sind die Chips rund? Weil sie das Filter-Idiom der App erben — nur ist diese Leiste zugleich die **Legende** der Marken in den Zeilen, und eine runde Legende neben einer eckigen Marke behauptet zwei verschiedene Dinge. Detail: [chronik-und-zeitstrahl.md](docs/status-system/chronik-und-zeitstrahl.md).

- **Zweite Form am geteilten Chip** (`form="marke"`): eckig, häkchenlos, enger — gemessen 54–62 px statt Pillen mit Haken; die Pillen-Form bleibt überall sonst ([ToggleChip.tsx](src/components/ui/ToggleChip.tsx))
- **Zustand ohne Haken heißt Breite ohne Sprung**: die Schriftstärke bleibt in beiden Zuständen 500, sonst wandert die Nachbarschaft beim Klick (Pitfall #14, [DESIGN_GUIDE.md](DESIGN_GUIDE.md) Kap. 5)
- **Zahl im Chip war unter AA** — grau auf Weiß 2,85:1, jetzt 5,0:1; im getönten Zustand trägt sie `currentColor` statt 0,75 Deckkraft (die drückte 4,7:1 auf ~3,3:1) ([ToggleChip.tsx](src/components/ui/ToggleChip.tsx))
- **Träger-Chips nennen die Endung des Aktenzeichens** („TV 1 …426") — die laufende Nummer ordnet, zitieren lässt sie sich nicht ([VerlaufFilterLeiste.tsx](src/plugins/antraege/status/VerlaufFilterLeiste.tsx))
- **Marken enger und mit Umriss**: 3 statt 4 px Polster (17–20 px je Rollenmarke, 25 px für `TV1`), Rand auf `--tf-border-hover` — mit 0,08 Alpha las sich die Marke als loser grauer Text ([VerlaufBadges.tsx](src/plugins/antraege/status/VerlaufBadges.tsx))

### v4.48.3 — Kuerzel in der Schreibweise des Teams, Sprung mit Ziel (August 2026)

PATCH — Zwei Nachbesserungen an der Kürzel-Auswahl. Sie zeigte jedes Kürzel großgeschrieben — 81 der 112 Kürzel im Bestand sind aber gemischt geschrieben („THü", „JuHe"), und wer sein eigenes in einer Liste von 112 sucht, sucht es in seiner Schreibweise. Und „Kürzel ändern → Einstellungen" landete auf einer Seite mit acht Karten, ohne zu sagen, welche gemeint ist.

- **Die Auswahl zeigt die Schreibweise der Quelle** — verglichen und ins Profil geschrieben wird weiter die Normalform, damit die Identität nicht an einem Quellendetail hängt ([kuerzelOptionen.ts](src/plugins/auslastung/hooks/kuerzelOptionen.ts))
- **„THü" und „THu" sind wieder zu unterscheiden**: großgeschrieben trennte die beiden nur der Umlaut ([AntraegeSichtGruppe.tsx](src/plugins/einstellungen/profil/AntraegeSichtGruppe.tsx))
- **Alle drei Wege zur Kürzel-Einstellung springen mit `?sektion=sec-filter`** — der Hub scrollt die Karte an und lässt ihre Markierung stehen wie bei einem Suchtreffer ([BearbeiterSichtChip.tsx](src/components/bearbeiter/BearbeiterSichtChip.tsx), [HomePage.tsx](src/plugins/home/HomePage.tsx), [MeineAntraegeSection.tsx](src/plugins/home/MeineAntraegeSection.tsx))
- **Kollisionsregel im Test**: eine gemischte Schreibweise schlägt die normalisierte der `kuerzel-map`, egal welche Quelle zuerst gelesen wird ([kuerzelOptionen.test.ts](src/plugins/auslastung/__tests__/kuerzelOptionen.test.ts))

### v4.48.2 — Chronik: Rollenspalte fasst drei Marken, Monatslinie, dickerer Zeitstrahl (August 2026)

PATCH — Vier Rückmeldungen aus dem Gebrauch der neuen Chronik, drei davon Maße: die dritte Rollenmarke schob sich in den Ereignistext, die Monatsblöcke liefen ohne Trennung ineinander, und der Zeitstrahl-Balken blieb hinter dem Entwurf zurück. Detail: [chronik-und-zeitstrahl.md](docs/status-system/chronik-und-zeitstrahl.md).

- **Die Rollenspalte fasst drei Marken** (76 statt 62 px, gemessen 67,5 belegt); mehr fällt zu „+n" zusammen, dessen Titel alle nennt — betrifft genau einen der 506 Codes ([VerlaufBadges.tsx](src/plugins/antraege/status/VerlaufBadges.tsx))
- **Rollen- und Träger-Marken sind schmaler** — ein Maß für beide, 4 statt 6 px Polster ([VerlaufBadges.tsx](src/plugins/antraege/status/VerlaufBadges.tsx))
- **Jeder Monatsblock beginnt mit einer Linie** über die ganze Breite, Monatsspalte eingeschlossen ([StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx))
- **Der Zeitstrahl-Balken ist 26 px hoch** statt 20 — das Maß des Entwurfs; die Schrift darin folgt der Konstanten statt einer eigenen Klasse ([VerlaufsBand.tsx](src/plugins/antraege/verlauf-band/VerlaufsBand.tsx))

### v4.48.1 — Startseiten-Kopf verschlankt, Sicht-Menue entrumpelt (August 2026)

PATCH — Die Startseite ist Einstieg, nicht Arbeitsfläche: unter der Begrüßung stand seit v4.47 eine eigene Zeile mit zwei Chips, obwohl der Betrachtungsbereich dort dieselbe Auskunft gibt wie im Förderanträge-Kopf und auch dort gewechselt wird. Das Sicht-Menü erklärte sich zudem mit einem Absatz, dessen Zusage („Ihr Kürzel bleibt dabei stehen") nach dem Umschalten sichtbar nicht mehr stimmte.

- **Der Kürzel-Chip steht neben der Begrüßung** statt in einer eigenen Zeile darunter — dieselbe Geometrie wie der `meta`-Slot im Förderanträge-Kopf ([HomePage.tsx](src/plugins/home/HomePage.tsx))
- **Bereichs-Chip nur noch dort, wo die Liste an ihm hängt**; das Startseiten-Aggregat verliert seine Ausblend-Zahl wieder ([useDashboardData.ts](src/plugins/home/useDashboardData.ts))
- **Sicht-Menü entrumpelt**: zwei Optionen, eine Zeile zu Reichweite und Gerätebindung, ein Weg in die Einstellungen ([BearbeiterSichtChip.tsx](src/components/bearbeiter/BearbeiterSichtChip.tsx))
- **Die unhaltbare Zusage ist raus** — nach dem Umschalten nennt der Chip „Alle Bearbeiter", das eigene Kürzel steht nur noch in der Option darunter ([home.md](docs/feedback-kontext/home.md))

### v4.48.0 — Chronik nach Schritt: Matrix ueber die Teilvorhaben, Rollenfarben, geteilter Filter (August 2026)

MINOR — Die Chronik kannte die Träger jedes Termins längst und faltete sie zu „3 Teilvorhaben" zusammen — genau die Auskunft, wegen der im Fachsystem der Verbund und danach jedes Teilvorhaben einzeln aufgerufen wird. Aus dem Design-Handoff `_design/handoff/chronik`, Teil 1 von 2 (der Zeitstrahl folgt).

- **Neue Ordnung „nach Schritt"** (Standard): eine Zeile je Kürzel, eine Spalte je Träger, dazu die TV-Streuung — an ZKN084412 gemessen 91 Schritte × 8 Spalten ([StatusSchrittMatrix.tsx](src/plugins/antraege/status/StatusSchrittMatrix.tsx), rein in [chronik-matrix.ts](src/core/status/chronik-matrix.ts))
- **Geteilte WER/WO-Leiste mit Fokus**: neutrale Einträge werden abgeblendet statt gefiltert — 144 der 505 Codes lässt das Fachsystem von jedem setzen ([verlauf-filter.ts](src/core/status/verlauf-filter.ts), [VerlaufFilterLeiste.tsx](src/plugins/antraege/status/VerlaufFilterLeiste.tsx))
- **Rollenfarben als Tokenfamilie** `--tf-rolle-*` für alle fünf Rollen inkl. Jur; die Filterleiste ist die Legende ([rollen-farbe.ts](src/core/status/rollen-farbe.ts), [theme.css](src/theme.css))
- **„Nach Datum" nennt die Teilvorhaben einzeln** statt „3 Teilvorhaben", und die Kopfzeile trennt Schritte von Datumsangaben ([VerlaufBadges.tsx](src/plugins/antraege/status/VerlaufBadges.tsx), [verlauf-kennzahlen.ts](src/core/status/verlauf-kennzahlen.ts))
- **Guard `rollen-farbe-eine-quelle`** misst den Kontrast jeder Rollenfarbe nach — fünf der zehn Werte des Entwurfs lagen unter 4,5:1 ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts), Doc: [chronik-und-zeitstrahl.md](docs/status-system/chronik-und-zeitstrahl.md))

### v4.47.0 — Meine/Alle umschaltbar, Kuerzel-Auswahl vollstaendig (August 2026)

MINOR — „Meine Anträge" oder „alle" war bisher kein Zustand, sondern der WERT des Profil-Kürzels: umschalten hieß, die eigene Identität zu überschreiben und danach neu einzutippen. Dazu fand sich die halbe Zielgruppe in der Kürzel-Auswahl gar nicht — inaktive Kürzel waren ausgeblendet (fast jede PL ist als ehemalige Bearbeitung geführt), und die AB-Spalte wurde nie gesammelt.

- **Chip „Kürzel THÜ / Alle Bearbeiter" im Kopf von Förderanträgen und Startseite**, in beiden Zuständen sichtbar ([BearbeiterSichtChip.tsx](src/components/bearbeiter/BearbeiterSichtChip.tsx))
- **Eine Quelle für den Ausschnitt**: Liste, Startseiten-Aggregat, Kanban, Antragseingang und QS lesen denselben Modus ([useBearbeiterSicht.ts](src/core/hooks/useBearbeiterSicht.ts), pures `sichtModus` in [bearbeiterFilter.ts](src/plugins/antraege/bearbeiterFilter.ts))
- **Die Startseite zeigt jetzt auch ihren Betrachtungsbereich** — sie wandte ihn an, ohne es zu sagen ([HomePage.tsx](src/plugins/home/HomePage.tsx), `ausgeblendet` aus [useDashboardData.ts](src/plugins/home/useDashboardData.ts))
- **Kürzel-Auswahl führt AB-Kürzel und Ehemalige**: 33 rein administrative Kürzel waren nie wählbar, inaktive stehen als „· ehem." drin ([kuerzelOptionen.ts](src/plugins/auslastung/hooks/kuerzelOptionen.ts), [AntraegeSichtGruppe.tsx](src/plugins/einstellungen/profil/AntraegeSichtGruppe.tsx))
- **Der Inaktiv-Schalter wirkt nur noch auf Antragsmengen**, nicht mehr auf die Auswahl — samt Wegfall des Stale-Guards, der eine solche Wahl still zurücksetzte ([auslastung.md](docs/architecture/auslastung.md))

### v4.46.1 — Abgeleitete To-dos heissen ueberall abgeleitet (August 2026)

PATCH — Am To-do stand die Marke „geliehen", während die Rollen-Bilanz derselben Seite „davon 68 abgeleitet" zählte: zwei Wörter für eine Sache, und das ungewöhnlichere davon an der sichtbarsten Stelle. `quelle`, Tooltip und Herkunftsspalte des Exports sagten ohnehin schon „abgeleitet".

- **Die Marke am To-do heißt „abgeleitet"** — Antrag-Detail, Ausklapp-Kopfkarte und Gruppenkopf im Vorgangs-Board ([TodoAnzeige.tsx](src/components/vorgang/TodoAnzeige.tsx), [aufgabe.ts](src/plugins/antraege/ausklapp/kopfkarte/aufgabe.ts), [VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx))
- **Gleicher Wortlaut im Status-Cockpit und in der FB-Erhebung** ([TodoPlatzhalterListe.tsx](src/plugins/status-cockpit/TodoPlatzhalterListe.tsx), [fbErhebungExport.ts](src/plugins/status-cockpit/fbErhebungExport.ts))
- **Die geliehene Kürzel-Bezeichnung bleibt „geliehen"** — anderer Sachverhalt (ein Wortlaut aus einer fremden Projektform), eigener Schirm ([kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts), [VerlaufBefundeBlock.tsx](src/plugins/status-cockpit/VerlaufBefundeBlock.tsx))

### v4.46.0 — Statuseintraege einklappbar, Detailseite vertikal verdichtet (August 2026)

MINOR — „Statuseinträge" war der einzige Block der Statussektion ohne Klapp-Zustand und rollte ungefragt aus: gemessen 1.383 px für „Status & Verlauf", davon über zwei Drittel Ordner-Liste. Dazu trugen mehrere Klapp-Köpfe ihren Bodenabstand am Button statt am Rumpf — die Marge blieb stehen, wenn der Rumpf verschwand.

- **„Statuseinträge" ist einklappbar, Default zu** — Kopfzeile behält die Anzahl, die Rollen-Chips erscheinen mit dem Inhalt, den sie filtern ([StatusCodeListe.tsx](src/plugins/antraege/status/StatusCodeListe.tsx))
- **„Offene Aufgaben" zieht mit**: startet zu und merkt sich den Zustand wie seine zwei Nachbarn ([OffeneAufgaben.tsx](src/plugins/antraege/status/OffeneAufgaben.tsx), zwei neue Einträge in [detailSektionen.ts](src/plugins/antraege/detailSektionen.ts))
- **Eingeklappt kostet nur noch die Kopfzeile** — die hängenden Margen von Statussektion, Aufgaben und Kurzbeschreibung gelten jetzt nur bei offenem Rumpf
- **Der Rumpf der Statussektion trägt `gap` statt `mt-5`-Wrapper**: ein Block, der `null` liefert, zeichnete bisher trotzdem seine 20 px ([StatusDetailSection.tsx](src/plugins/antraege/status/StatusDetailSection.tsx))
- **Trenn-Abstände enger**: Sektionsrahmen 32 → 24 px, Daten-Sektionskopf 40 → 36 px ([detailRahmen.tsx](src/plugins/antraege/detailRahmen.tsx), [CollapsibleDataSection.tsx](src/plugins/antraege/CollapsibleDataSection.tsx))

Gemessen am echten Bestand (1400 px, ein Verbund mit 25 Statuseinträgen): „Status & Verlauf" aufgeklappt **1.383 → 400 px**, Detailseite zugeklappt 835 → 791 px.

### v4.45.0 — Kuerzel-Wortlaut folgt der Kuration in der ganzen App (August 2026)

MINOR — Chronik und Zeitstrahl liegen in derselben Sektion und zeigten für dasselbe Kürzel verschiedene Texte: die Chronik den kuratierten Wortlaut der Fassung, die Spur die einkompilierten Fremddaten. Auf dem echten Bestand betraf das 111 von 505 Kürzeln.

- **Die kuratierte Fassung gewinnt** — was die PL im Kürzel-Tab freigibt, wirkt jetzt auch in der Verlaufs-Spur ([kuerzel-katalog.ts](src/core/status/kuerzel-katalog.ts), [uebergaenge.ts](src/core/status/verlauf/uebergaenge.ts))
- **Außer bei form-divergenten Kürzeln**: dort bleibt der Katalog, weil eine flache Kuration „AB in DL" nicht von „AB in NW" unterscheiden kann — 26 Kürzel, gewollt
- **Dem Katalog unbekannte Kürzel** bekommen den kuratierten Namen statt gar keinen (36 Codes der flachen Zuarbeit)
- **Rollen bleiben beim Katalog**: `rollenLage` unterscheidet „jede Rolle" von „Rolle unbekannt", was die Fassung nicht ausdrücken kann
- **Guard** `kuerzel-text-folgt-der-kuration` ([conventions-status.test.ts](src/__tests__/conventions-status.test.ts)) + Verhalten in [kuerzel-overlay.test.ts](src/core/status/__tests__/kuerzel-overlay.test.ts)

### v4.44.1 — Suchbereich-Optionen tragen Suche in selbst (August 2026)

PATCH — Aufgeklappt liegt die Optionsliste über der Seite; die Beschriftung „Suchen in:" daneben ist dann verdeckt, und jede Zeile las sich für sich allein als „alle Felder", „nur Dokumente" — ohne die Frage, die sie beantwortet.

- **Jede Option trägt „Suche in: …"** — zugeklappt wie aufgeklappt, damit der Kasten auch nach einem Zeilenumbruch lesbar bleibt ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx))
- **Die vorangestellte Beschriftung entfällt** — sonst stünde dort „Suchen in: Suche in: alle Felder"; die Auswahl trägt sie jetzt als `aria-label`
- **Der Präfix ist reine Darstellung**: `SUCHBEREICH_LABEL` bleibt der nackte Name, den Tooltip und Guards lesen ([suchbereich.ts](src/core/services/search/suchbereich.ts))

### v4.44.0 — Suchbereich heisst alle Felder und ist wieder der Standard (August 2026)

MINOR — Gewünscht war ein Eintrag „in allen Feldern suchen", standardmäßig gewählt. Den gab es bereits — er hieß nur „Titel, Beschreibung, Dokumente" und nannte damit drei von acht Feldern. Zweimal wurde deshalb gemeldet, ein Feld werde nicht durchsucht; beide Male stimmte es nicht.

- **Der Standardbereich heißt „alle Felder"**, im Gegensatz zu den vier „nur …"-Wahlen; die Zusage hält ein Guard ([suchbereich.ts](src/core/services/search/suchbereich.ts), [wortstamm.test.ts](src/core/services/search/__tests__/wortstamm.test.ts))
- **Ein eingeengter Bereich markiert sich farbig** — er ist der einzige Schalter der Zeile, der Treffer verschwinden lässt, ohne dass am Ergebnis etwas davon steht ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx))
- **Der gemerkte Bereich wird einmalig zurückgesetzt** (Schlüssel-Bump): eine irgendwann gewählte Einschränkung schlug bisher für immer den Code-Standard ([useSuchOptionen.ts](src/core/hooks/useSuchOptionen.ts))
- **Kein zweiter Eintrag im Aufklapper**: ein Duplikat neben „alles" hätte dasselbe zweimal angeboten — die Felder waren nie das Problem, die Beschriftung war es

### v4.43.0 — Chronik zeigt das Kuerzel, Naechste Schritte klappt zu, DL-Praefix korrigiert (August 2026)

MINOR — Gemeldet war dreierlei: der Chronik fehlt das Kürzel, „Nächste Schritte" steht immer offen, und „DL-Gutachten" nennt eine Projektform, die nicht dazugehört. Die dritte Meldung führte auf eine Datenursache: die App trägt **zwei** Kürzel-Zuarbeiten, die sich bei 76 Codes widersprechen — und keine der beiden ist pauschal die richtige.

- **Die Chronik führt das Kürzel** in eigener Spalte zwischen Datum und Rolle, wie im Fachsystem — auch an den kanonischen Feldern (`AAE`, `ABB`) und an den Fehlzeilen ([StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx))
- **„Nächste Schritte (in C16 zu setzen)" klappt zu**, Default zu; die Anzahl bleibt im Kopf stehen, die Rollen-Chips wandern in den Rumpf ([NaechsteSchritte.tsx](src/plugins/antraege/status/NaechsteSchritte.tsx), Vorgabe zentral in [detailSektionen.ts](src/plugins/antraege/detailSektionen.ts))
- **`XKS` heißt wieder „Gutachten fertig"** statt „DL-Gutachten fertig - FB/AB", `XQS` „Gutachten QS fertig" — dazu vier belegte Schreibfehler ([seed-label-korrekturen.ts](src/core/status/seed-label-korrekturen.ts)); ausgeliefert über den bestehenden Cockpit-Block, nicht automatisch
- **Der Abgleich beider Zuarbeiten ist gemessen**: 335 wortgleich, 58 zu Recht formabhängig, 36 nur flach geführt, **76 widersprüchlich** — davon 6 entschieden, 70 als Wasserstand im Test festgehalten ([KATALOG-CODES.md](docs/status-system/KATALOG-CODES.md))
- **Keine Vorrangregel zwischen den Quellen**: mal ist die flache veraltet (`XKS`), mal trägt die form-bewusste den Tippfehler (`Biref`, `Verwedungsnachweis`) — eine globale Übernahme tauschte Fehler gegen Fehler

### v4.42.0 — Suche findet die Projektbeschreibung wieder, Einrichtungen auch per Kuerzel (August 2026)

MINOR — Gemeldet war „der Antragsteller GMBU wird nicht gefunden, obwohl er da ist". Beim Nachmessen am Bestand fiel ein größerer Defekt auf: die alten Feld-Aliase des Suchkorpus trafen **0 von 14.225** Anträgen — die gesamte Projektbeschreibung fehlte im Suchindex. Sichtbar war das nur als dünner Bestand.

- **Korpus-Felder werden aus dem CSV-Schema aufgelöst** statt geraten (Spalten-CODE → `resolveFieldKey`, alte Listen als Fallback) — [korpusFeldAufloesung.ts](src/plugins/antraege/services/korpusFeldAufloesung.ts); zweiter Fall von [recurring-bug-classes](docs/architecture/recurring-bug-classes.md) Klasse 5
- **Projektbeschreibung ist wieder durchsuchbar**: 9.225 Anträge tragen sie; „Netzwerkpartner" findet in „nur Titel & Kurzbeschreibung" 696 statt 0 ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts))
- **Neue Trefferstelle „Web-Adresse"** aus der Kontakt-Mail (`bergmann@gmbu.de` → `gmbu.de`), im Bereich „nur Einrichtung" — „GMBU" findet 35 statt 0 Anträge ([trefferstelle.ts](src/core/services/search/trefferstelle.ts), [suchbereich.ts](src/core/services/search/suchbereich.ts))
- **Nur der Host, nie die Adresse**, ohne Top-Level-Domain in der Suchform, mit Sperrliste gegen Projektträger- und Freemail-Domains (`vdivde-it.de` steht 26.933× in der Quelle)
- **Der Beleg zeigt sich selbst**: Spalte „Web-Adresse" blendet sich bei einem Domain-Treffer ein ([autoSpalten.ts](src/plugins/suche/autoSpalten.ts)) — sonst stünde das Suchwort in keinem sichtbaren Feld der Zeile

