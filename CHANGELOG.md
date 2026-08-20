# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

### v4.125.0 — Trennzeichen im Namen sind egal (August 2026)

MINOR — Nach dem Stern stand die Frage nach einem Abstandsmaß („meintest du …?") im Raum. Vor dem Bau wurde der Namensraum ausgezählt, und das Ergebnis kippte sie: von 377 Paaren Haupt-↔-Nebenschreibweise rettete ein Abstandsmaß **null**, während 17 Paare verschiedener Netzwerke bei Abstand 1 liegen. Was die Messung stattdessen fand, braucht kein Raten — dieselbe Sache, anders getrennt: `cannabisnet` lieferte 1 Treffer, `cannabis-net` 60.

- **Der Namenskern**: Bindestrich, Leerzeichen, Punkt und Klammer zählen in Akronym und Netzwerk nicht mit — 991 zusätzlich gefundene Anträge, 19 Anfragen, die vorher **null** lieferten ([namensKern.ts](src/core/services/search/namensKern.ts)); Zahlen + Preis in [suche-relevanz.md §12.2](docs/architecture/suche-relevanz.md)
- **Die Nadel muss an einem Wortanfang beginnen** — sonst fände `bona` das Netzwerk „lab on a chip"; über die 400 häufigsten Titelwörter ändern nur 5 Anfragen ihre Trefferzahl, um zusammen 12 Zeilen ([namensKern.ts](src/core/services/search/namensKern.ts))
- **Nur die beiden Namensfelder**, nicht Titel/Abstract/Snippet: dort liefe die Faltung über einen Satzpunkt hinweg ([suchbereich.ts](src/core/services/search/suchbereich.ts) bleibt unberührt, `KERN_FELDER` zieht die Grenze)
- **Der Kern liegt im Korpus vorberechnet** neben dem rohen Wert (+1 ms je Anfrage statt +8) und ist dieselbe Zeichenkette, wo der Wert keine Fuge trägt ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts))
- **Die Fundstelle wird als ein Stück markiert**, Bindestrich eingeschlossen; die Suchsprache lehrt es mit einer ausführbaren Zeile ([markierung.ts](src/core/services/search/markierung.ts), [suchsprache.ts](src/plugins/suche/start/suchsprache.ts))

### v4.124.0 — Förderanträge: 100 Befunde der Bug-Jagd (Schnitt 2) behoben (August 2026)

MINOR — Schnitt 2 nahm die andere Hälfte des Plugins (Detailseite, Ausklapp, Suche, Status, Gutachten, Aufbereitung, Artefakt-Nachbarn) und fand eine Klasse mit dem meisten Ertrag: **eine Stelle liest einen Feldschlüssel, den der echte Bestand nicht führt**, weil das Mapping die Spalte umbenennt. Dazu kamen Flächen, die etwas Falsches behaupten statt zu schweigen — eine unerreichbare Feld-Historie, eine phasenblinde Frist, ein Freigabe-Tor über leerem Text. 95 Brillen-Befunde + 5 eigene Mess-Befunde, dazu 15 der 25 offenen Kandidaten aus Schnitt 1.

- **Feldschlüssel gegen Mapping**: `T_XSW` liegt unter `wiedereinreicher` (1 452 Sätze), `LFZ_TV_*` unter `tv_beginn`/`tv_ende` (14 131), „beantragte Kosten" scheiterte an Klammern (8 105), `ANWEND_*` fehlte im Suchkorpus (9 614) — alle über Alias-/Normalisierungs-Auflösung nachgezogen ([xsw.ts](src/plugins/antraege/xsw.ts), [glanceFacts.ts](src/plugins/antraege/alleFelder/glanceFacts.ts), [descriptor-text.ts](src/plugins/antraege/services/descriptor-text.ts), Projektion v8 in [list-view.ts](src/core/services/csv/list-view.ts))
- **Die Feld-Historie ist erreichbar**: der `↻ N`-Knopf hing am Verbund an einem fest verdrahteten `{}`, am TV am nie befüllten `antrag_historie` — beide lesen jetzt das Import-Diff-Journal ([useFeldHistorie.ts](src/plugins/antraege/alleFelder/useFeldHistorie.ts))
- **Uhren und Zähler sagen, was sie messen**: die Artefakt-Karte verließ die phasenblinde Altregel (11 003 auseinanderlaufende Vorgänge), die Chronik zeigt ihre Textspalte nur noch, wenn sie etwas hinzufügt (62,2 % Echo), Kürzel-Angaben, Trichter-Zähler und Termin-Zahlen tragen ihre Einheit ([useArtefaktLeiste.ts](src/plugins/antraege/artefakte/useArtefaktLeiste.ts), [StatusChronik.tsx](src/plugins/antraege/status/StatusChronik.tsx))
- **Kein Tor über leerem Text**: leerer Bescheid ist nicht freigabereif, ein NF-Punkt ohne Baustein trägt seine `[TODO]`-Marke, das Freigabe-Tor rechnet mit dem Prüfstand der Erzeugung ([nf-service.ts](src/plugins/antraege/nachforderungen/nf-service.ts), [WerkbankSection.tsx](src/plugins/antraege/werkbank/WerkbankSection.tsx))
- **Kein Zustand über den Wechsel hinweg**: Entwürfe, Prompt-Ansicht, Werkbank-Auswahl und Suchkorpus folgen dem Verbund bzw. dem Bestandsstand ([useNachforderungen.ts](src/plugins/antraege/nachforderungen/useNachforderungen.ts), [antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts)) — Bericht: `~/.claude/plans/bug-jagd-antraege-schnitt-2.md`

### v4.123.0 — Die Suche kennt den Stern (August 2026)

MINOR — Das Fragezeichen (v4.101) verlangt, dass man abzählt: `mobi?nspec` findet die beiden Schreibweisen dieses Netzwerks nur, weil sie sich in genau einem Zeichen unterscheiden — `mob?nspec` liefert 0. Wer eine Namensdrift sucht, kennt ihre Länge aber nicht. Dazu kam der Platzhalter in keiner Zeile der Oberfläche vor: gefragt wurde nach einer Sache, die es seit zwei Monaten gibt.

- **`*` steht für beliebig viele Zeichen, auch für keines**: `mob*spec` liefert dieselben 33 Treffer wie `mobi?nspec`, ohne die Abweichung zu kennen ([wortstamm.ts](src/core/services/search/wortstamm.ts)) — Kosten wie ein gewöhnliches Wort, am Bestand gemessen ([suche-relevanz.md](docs/architecture/suche-relevanz.md))
- **Der Stern bleibt im Wort** (`[\p{L}\p{N}]*`, nicht `.*`): `mob*technik` findet 2 statt 119, weil er nicht über Leerzeichen spannt ([wortstamm.ts](src/core/services/search/wortstamm.ts))
- **Die Fundstelle wird als Muster markiert**, nicht als getippte Nadel — bis v4.122 kam ein Platzhalter-Treffer unmarkiert an ([markierung.ts](src/core/services/search/markierung.ts))
- **Die Suchsprache lehrt ihn**: eine ausführbare Zeile mehr im Startzustand, am echten Bestand gegengezählt ([suchsprache.ts](src/plugins/suche/start/suchsprache.ts))
- Erbt Feldpräfix und Anführungszeichen: `fkz:16KN0830*` (32), `nw:mob*spec` (33), `"mob*spec"` (0 — zitiert ist wörtlich gemeint)

### v4.122.0 — Förderantrags-Tabelle: 17 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Die read-only-Jagd über die meistgenutzte Seite fand ein Muster: **die Oberfläche verspricht eine Menge, eine Uhr oder eine Einheit, die die Liste darunter nicht einlöst.** Die Filterleiste zählte über den Vollbestand (14 225) und bot Werte an, die im aktuellen Reiter null Zeilen liefern; die Vorgabe-Sortierung „Frist" las ein anderes Feld als die Frist-Spalte zeigt; Massenleiste und Export rechneten auf der Liste vor den drei letzten Einschränkungen der Tabelle.

- **Zähler und Liste auf einer Grundmenge**: die Filterleiste holt ihre Facetten-Basis wie jede andere zählende Oberfläche aus `countBase`, ein vb_phase-Filter ohne die 9 schaltet den Irrläufer-Vorfilter nicht mehr ab, und „Auch außerhalb meiner Anträge" gilt auch für die Reiter-Zahlen ([FilterSidebar.tsx](src/plugins/antraege/filter/FilterSidebar.tsx), [useFilteredAntraege.ts](src/plugins/antraege/useFilteredAntraege.ts)) — Pitfall #46
- **Eine Uhr, nicht zwei**: „Frist (kürzeste)" sortiert über dieselbe Engine, die die Zelle zeigt — angehaltene Vorgänge sinken ans Ende statt an die Spitze ([sort.ts](src/plugins/antraege/sort.ts)); `daysUntilFrist` ist entfallen ([views.ts](src/plugins/antraege/views.ts))
- **Was dasteht, ist die Grundlage**: Massenleiste, beide Export-Wege und die schmale Spalte im Detail lesen die Meldung der Ansicht statt `filtered`; der Export nimmt die eigenen Spalten mit ([tabellenSicht.ts](src/plugins/antraege/tabellenSicht.ts), [export-xlsx.ts](src/plugins/antraege/services/export-xlsx.ts))
- **Kein Schalter ohne Wirkung**: „Gruppierung: Keine" gilt auch im Reiter „Fristen", der Nachlade-Fühler folgt seinem Knoten statt einer Zeilenzahl, ein angehakter Facetten-Wert bleibt abwählbar ([store.ts](src/plugins/antraege/store.ts), [AntraegeMain.tsx](src/plugins/antraege/AntraegeMain.tsx), [MultiSelectFacet.tsx](src/plugins/antraege/filter/facets/MultiSelectFacet.tsx))
- **Erklärungen, die stimmen**: `custom`-Mappings zählen als Mapping (kein „bleibt leer" über einer vollen Spalte), „Branche"/„Fördergeber" nennen ihren Grund, die Frist-Hilfe nur noch die Felder ihres Rechenwegs ([spalten-inventar.ts](src/core/services/csv/spalten-inventar.ts), [spaltenHilfe.ts](src/plugins/antraege/spaltenHilfe.ts))

### v4.121.0 — To-do-Regeln und Klaerfragen: 15 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Der zweite Schnitt der Jagd, über die beiden in v4.120 ausgeklammerten Reiter. Ein Muster trägt fast alles: **ein Ergebnis überlebt seinen Parameter und wird dem gerade gewählten zugeschrieben.** Der Wirkungs-Lauf lief unter AB und stand nach einem Pillen-Klick als „Regelsatz FB" da — samt einer Warnung, die einen falschen Grund nannte. Dazu Zahlen, die eine andere Liste zählen als die daneben.

- **Eine Messung nennt ihren Regelsatz**: Wirkungs-Lauf, Probe am Fall und Termin-Befunde sagen, unter welchem Satz sie liefen; fremde Zahlen werden nicht mehr gezeigt ([useRegelWirkung.ts](src/plugins/status-cockpit/useRegelWirkung.ts), [RegelProbelauf.tsx](src/plugins/status-cockpit/RegelProbelauf.tsx), [TerminBefundeBlock.tsx](src/plugins/status-cockpit/TerminBefundeBlock.tsx)) — neue Bug-Klasse [#25](docs/architecture/recurring-bug-classes.md)
- **Zwei Kaskaden, zwei Nummernkreise**: Nummer, „Position i von n" und Pfeile folgen dem eigenen Regelsatz, fremde Sperren stehen vorn und tragen keine Stelle ([todoRegelnAnsicht.ts](src/plugins/status-cockpit/todoRegelnAnsicht.ts), [TodoRegelKarte.tsx](src/plugins/status-cockpit/TodoRegelKarte.tsx))
- **Zähler zählen, was dasteht**: die Regelsatz-Pille sagte „AB 26" über 30 Zeilen und „FB 0" über vier; die Reiter-Lasche zählte alle Sätze zusammen ([TodoRegelnBereich.tsx](src/plugins/status-cockpit/TodoRegelnBereich.tsx), [StatusCockpitPage.tsx](src/plugins/status-cockpit/StatusCockpitPage.tsx))
- **Auslassungen in Fragen, nicht in Anlässen**: „243 ruhende Kürzel ausgelassen" stand über einer Liste mit einer Frage, obwohl keine unterdrückt war; die Kurzlabel-Spitze kappte still ([klaerfragen/index.ts](src/core/status/klaerfragen/index.ts), [KlaerfragenTab.tsx](src/plugins/status-cockpit/KlaerfragenTab.tsx))
- **Eine Id, eine Zeile**: zwei Schreibweisen desselben Statuswerts erzeugten zwei Klärfragen mit derselben ID — dem Schlüssel, über den die Antworten zurückkommen ([ableitung.ts](src/core/status/klaerfragen/ableitung.ts))

### v4.120.0 — Status-Cockpit: 24 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Die read-only-Jagd über „Ebenen · Statuswerte · Kürzel" fand ein Muster: **die Oberfläche beschreibt einen anderen Stand als den, der bearbeitet wird.** Der Reiter „Ebenen" las die Zuordnung aus der gespeicherten Fassung, während der Baum daneben den Entwurf zeigte; „neu berechnen" warf den Entwurf weg; der Lösch-Dialog verschickte die Phase, die er löscht. Dazu drei Zähler, die eine andere Grundmenge messen als der Filter neben ihnen.

- **Ein Stand, eine Antwort**: „Ebenen" folgt jetzt dem Entwurf (`schnittVon` statt Snapshot), „neu berechnen" lässt ihn stehen, und der Lösch-Dialog kann sich nicht mehr selbst als Ziel schicken ([ebenenModell.ts](src/plugins/status-cockpit/ebenenModell.ts), [useStatusCockpit.ts](src/plugins/status-cockpit/useStatusCockpit.ts), [PhaseLoeschenDialog.tsx](src/plugins/status-cockpit/PhaseLoeschenDialog.tsx))
- **Zähler und Filter sprechen dasselbe Vokabular**: Status statt Katalogzeilen (60 → 30), „Vorkommen" statt „Vorgänge", Chips mit Facetten-Zahl, Suche filtert nach dem Falten ([katalogZeilen.ts](src/plugins/status-cockpit/katalogZeilen.ts), [KatalogTab.tsx](src/plugins/status-cockpit/KatalogTab.tsx))
- **Keine Zusage ohne Mechanik**: die Arbeitsliste „folgt dem Code", nicht dem Verfahrensschritt; Zieltage nennen die Phasen aus `zieltageRelevant` statt einer festen Liste ([katalogSpalten.tsx](src/plugins/status-cockpit/katalogSpalten.tsx), [ZieltageUebernahmeDialog.tsx](src/plugins/status-cockpit/ZieltageUebernahmeDialog.tsx))
- **Nichts verschwindet still**: Sammelordner sind nicht löschbar (340 Kürzel), ein Zug nach unten landet nicht mehr eine Position zu weit, Kurzform-Zeile und Reihenfolge-Feld überleben das Tippen ([katalog-edit.ts](src/core/status/katalog-edit.ts), [phasenDrag.ts](src/plugins/status-cockpit/phasenDrag.ts), [KurzLabelPflege.tsx](src/plugins/status-cockpit/KurzLabelPflege.tsx))
- **Leere Grundlage heißt „unbeantwortbar", nicht „nichts"**: ohne geladene CSV-Spalten ruht kein Kürzel mehr, und kein Relevanz-Vorschlag markiert ruhende ([ruhende-kuerzel.ts](src/core/status/ruhende-kuerzel.ts), [katalog-edit.ts](src/core/status/katalog-edit.ts))

### v4.119.0 — Kuration-Hub: 23 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Sieben Sidebar-Seiten wurden mit v4.34 ein Hub; die Jagd suchte, **was beim Umzug liegen blieb**. Das Muster: die Oberfläche spricht weiter von etwas, das nicht mehr da ist — tote Plugin-Ids in drei Knöpfen, eine Karte ohne Inhalt, ein Untertitel, der eine verborgene Gruppe nennt, und die Zusage „nur lesbar", die drei Panels nicht hielten.

- **Alte Wege kommen an**: in prod endete jede `/kuration…`-Adresse auf leerer Fläche, drei Knöpfe zeigten auf Plugin-Ids, die es nicht mehr gibt, und das Lesezeichen „Programme" trägt jetzt seinen Abschnitts-Anker ([Router.tsx](src/core/Router.tsx), [routes.ts](src/core/routes.ts), [CsvAutoRefreshBanner.tsx](src/plugins/csv-sources-kuration/components/CsvAutoRefreshBanner.tsx))
- **„Nur nach Freischaltung" gilt für alle**: Sichtbarkeits-Marken und die Dienste-URL schrieben bei gesperrter Sitzung weiter team-weit; die Sperrseite nennt den Grund, den dieser Build wirklich hat, und „Sperren" hat einen Rückweg ([SichtbarkeitPanel.tsx](src/plugins/kuration/sichtbarkeit/SichtbarkeitPanel.tsx), [ModulSchlossGate.tsx](src/core/components/ModulSchlossGate.tsx), [useKuratorSeiten.ts](src/core/hooks/useKuratorSeiten.ts))
- **Keine Karte ohne Inhalt, kein Versprechen ohne Deckung** — `SettingsGruppe traegt` plus Guard `settings-karte-ohne-inhalt`, der eine dritte Fundstelle in den Einstellungen mitgefunden hat ([settings-layout.tsx](src/components/settings/settings-layout.tsx), [conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts))
- **Schreibende Wege halten, was sie beschriften**: „Nur Labels" schreibt nur Labels, ein Unterprogramm-Label lässt sich leeren, das gelöschte Standard-Programm bleibt gelöscht, der Filter-Assistent nennt das gewählte Feld ([unterprogrammLabelXlsx.ts](src/core/services/csv/unterprogrammLabelXlsx.ts), [programmRegistry.ts](src/core/services/csv/programmRegistry.ts), [FilterEditDialog.tsx](src/plugins/kuration/foerderprogramme/filter/dialogs/FilterEditDialog.tsx))
- **Zahlen und Statuszeilen nennen ihre Reichweite**: „nicht prüfbar" statt „noch kein Import", „Anträge mit Code", Zustand über alle Programme — und Dokument-Review hat ein eigenes Handbuch statt dem der Nachbarseite ([dokument-review.md](docs/feedback-kontext/dokument-review.md))

### v4.118.0 — Meilensteine & Fristen: 21 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Die read-only-Jagd über die Meilenstein-Oberfläche fand ein Muster: **die Anzeige behauptet mehr, als das Modell trägt.** Eine Restzeit, für die kein Meilenstein gilt; eine Reißquote ohne ihren Nenner; ein Leer-Satz, der eine Tatsache meldet, wo ein Filter greift. Dazu zwei stille Verluste — der geltende Plan fiel nach 21 Speicherungen aus der Historie, und „nur meine" traf 81 der 112 Kürzel im Bestand nie.

- **Kürzel folgen dem App-Vertrag** (uppercase, Komma-Trennung, „alle" = kein Filter, TIB **und** BIB; Vergleichs- und Anzeigeform getrennt) ([useMeilensteinStand.ts](src/plugins/meilensteine/useMeilensteinStand.ts), [monitoringLogic.ts](src/plugins/meilensteine/monitoringLogic.ts))
- **Die jüngste freigegebene Fassung überlebt die Historien-Kappung**; eine Bedingung `ist`/`ist nicht` **ohne Wert** wird verworfen statt für jeden Verbund wahr zu sein ([versionierung.ts](src/core/meilensteine/versionierung.ts), [plan-storage.ts](src/core/meilensteine/plan-storage.ts))
- **Betrachtungsbereich gilt für beide Hälften** — Abschlüsse waren ungefiltert (5.885 gegen 2.046) ([useMeilensteinStand.ts](src/plugins/meilensteine/useMeilensteinStand.ts))
- **Anzeige sagt, was sie weiß**: Prognose statt erfundener Restzeit, „Betrachtet"-Spalte als Nenner, „heute fällig" statt „in 0 T", markierte Ist-Termine vor dem Eingang, lesbare Zustands-Spalte, benannte Fassung ([meilensteine.md → Was die Anzeige nicht behaupten darf](docs/architecture/meilensteine.md))
- **Das Home-Widget „Fristen" bündelt je Vorgang** wie das Modul — acht Zeilen zeigten drei Akronyme ([fristAnlaesse.ts](src/plugins/home/widgets/fristAnlaesse.ts))

### v4.117.0 — Vorbelegung der Sichtbarkeit nachgezogen (August 2026)

MINOR — Die Vorbelegung aus v4.112 war ein Vorschlag; das Team ist sie durchgegangen und entscheidet an 13 Stellen anders. Solche Entscheidungen gehören zurück in den Katalog statt als Abweichung auf dem Share zu verharren — sonst erklärt die Sidecar irgendwann die halbe App.

- **Auf Standard**: Gutachten, Kurzfassung, Meilensteine, „Alle Felder" (Verbund-Detail) sowie „Suchsprache" und „Fragen" (Suche) ([katalog.ts](src/core/sichtbarkeit/katalog.ts))
- **Auf `beta`**: Statuseinträge, Werkbank, Widerspruch (Verbund-Detail) und die Seite „Dokumente"
- **Auf `experte`**: „Programme" und „CSV-Datenimport" der Datenpflege
- Bilanz: 199 Einträge, 46 markiert (23 `beta` / 18 `experte` / 5 beides); mit beiden Schaltern aus fehlen 8 der 18 Nav-Einträge ([sichtbarkeitsstufen.md](docs/architecture/sichtbarkeitsstufen.md))
- Kurator-Abweichungen auf dem Share bleiben unberührt — sie liegen über dem Katalog und schlagen ihn weiterhin

### v4.116.0 — Einstellungen: 48 Befunde der Bug-Jagd behoben (August 2026)

MINOR — Die read-only-Jagd über 4.886 Zeilen fand ein Muster, nicht Einzelfälle: **zwei Stellen entscheiden dieselbe Frage, und nur eine wurde nachgezogen.** Registry gegen Anker, Seite gegen Bauteil, Einstellung gegen Startseite, Klick gegen Neustart. Dazu ein zweiter Faden — Zusagen, die niemand einlöst: ein Zähler ohne Nachzug, ein Häkchen an einer Farbe, die nicht mehr gilt, ein Suchtreffer, der auf nichts zeigt.

- **Alle vier Layout-Bauteile fragen die Beta-/Experten-Achse** — `SettingsKlappe`/`SettingsBlock` rendertem ihren Anker bedingungslos, 9 von 16 markierten Abschnitten blieben stehen (Guard `sichtbarkeit-alle-bauteile`, [settings-layout.tsx](src/components/settings/settings-layout.tsx))
- **Die Primärfarbe speichert alle drei Werte** (`theme.sat`/`lit`), Bestands-Profile werden über den Farbton geheilt; das Profil wird bei jeder Änderung in den persönlichen Ordner gespiegelt ([theme.ts](src/components/ui/theme.ts), [useProfile.ts](src/core/hooks/useProfile.ts))
- **Fachprofil**: Ersatz-Befüllung nimmt die Kompetenzen mit, beide Hydrationen weichen einer laufenden Eingabe aus, der Auto-Save fasst nach statt zu verwerfen ([useFachprofil.ts](src/plugins/einstellungen/profil/useFachprofil.ts))
- **Suche + Deep-Links**: Rangfolge statt Reihenfolge, Groß-/Kleinschreibung egal, sechs unerreichbare Anker registriert, unauflösbare Ziele sagen es (Guard „jeder DOM-Anker steht in der Registry", [panels.ts](src/components/settings/panels.ts), [SettingsHubPage.tsx](src/components/settings/SettingsHubPage.tsx))
- **Tags, Ordner, KI-Karten**: Umbenennen erreicht die Dokumente, Zähler aus dem Bestand, acht Ordner-Aktionen melden ihre Fehler, Entwurf und wirksame Adresse getrennt ([tags.ts](src/core/services/tags.ts), [OrdnerGruppe.tsx](src/plugins/einstellungen/daten/OrdnerGruppe.tsx), [VerbindungGruppe.tsx](src/plugins/einstellungen/ki/VerbindungGruppe.tsx))

### v4.115.2 — Guard: die Kontext-Reserve muss das Output-Budget decken (August 2026)

PATCH — v4.115.1 hat die Reserve korrigiert, aber nichts hielt sie am Output-Budget fest: zwei unabhängige Zahlen, deren Verhältnis niemand nachrechnete. Genau daran scheiterte sie jahrelang unbemerkt — ein Kontext-Überlauf meldet sich nicht, er schiebt den System-Prompt hinaus.

- **Guard `reserve-deckt-output-budget`** — `RESERVE_TOKENS` muss `DEFAULT_MAX_TOKENS + THINKING_OUTPUT_HEADROOM` decken **und** jedes Seed-`maxTokens` tragen ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts))
- Adversarisch geprüft: mit der alten Reserve (4.096) schlagen beide Testfälle an — der Guard hätte den Bug gefangen
- Positiv-Kontrolle im Scan (22 gefundene Budgets): ein Guard, der nichts mehr findet, ist grün statt wirksam
- Die drei Konstanten sind dafür exportiert; `map-infografik` (8192) trägt eine begründete Ausnahme — es läuft über `runBaustein`, das nie `capVbMarkdown` ruft ([map-infografik.seed.ts](src/core/services/skills/registry/map-infografik.seed.ts))
- Nebenbefund: neun Seeds liegen bei genau 4096 — die 12.288 sind exakt die bindende Grenze, nicht großzügig gewählt

### v4.115.1 — Zeichen-Cap an der gemessenen Token-Quote (August 2026)

PATCH — Ein 220.000-Zeichen-Antrag (~20.000 Wörter, 23 Tabellen) galt als „länger als das Kontextfenster", obwohl er in der internen KI nur 42k von 62k Tokens belegt. Der Cap ist abgeleitet, nicht gesetzt — und beide Faktoren der Ableitung waren geraten, nicht gemessen.

- **Zeichen/Token-Quote 3 → 4,8** — gemessen statt als Sicherheitsmarge gesetzt (220.000 Zeichen ≙ 42k Tokens = 5,24, davon ~8 % Abzug); die alte Quote unterschätzte um Faktor 1,7 ([llm-context.ts](src/core/services/ai/llm-context.ts))
- **Token-Reserve 4.096 → 12.288** — bei aktivem Thinking belegt allein der Output 10.240 Tokens, das deckte die alte Reserve nie ([run-skill.ts](src/core/services/skills/run/run-skill.ts))
- Cap der Standard-KI damit 173.712 → **238.617** Zeichen, Default-Fenster → 334.233, agentisch → 1.198.617
- `computeVbCharCap` rundet ab — die Quote ist gebrochen, ein Zeichen-Cap ist eine ganze Zahl
- Beide Konstanten tragen Messwert + Verfahren im Kommentar: bei Wechsel des internen Modells neu messen

### v4.115.0 — Sichtbarkeits-Katalog als Baum (August 2026)

MINOR — 192 Zeilen in 21 Kästen hießen, an neunzig Zeilen vorbeizuscrollen, um eine zu finden. Und der An-Zustand einer Marke unterschied sich vom Aus-Zustand nur durch einen Hauch kräftigeren Rand.

- **Baum statt Kästen** — zugeklappt 21 Zeilen auf 490 px, also eine Bildschirmhöhe ohne Seiten-Scroll; die Seite ist ihr eigener Ordner und trägt ihre Marken in derselben Zeile ([sichtbarkeitBaum.ts](src/plugins/kuration/sichtbarkeit/sichtbarkeitBaum.ts), `TfTree`)
- **„N markiert" an der zugeklappten Seite** — sonst müsste man alle 21 öffnen, um zu sehen, wo überhaupt etwas festgelegt ist
- **Der An-Zustand trägt Fläche** — `Beta` in der Farbe des Abzeichens, das es erzeugt (6,3:1), `Experte` neutral gefüllt (19,5:1), aus bleibt ein Umriss (5,3:1) ([SichtbarkeitPanel.tsx](src/plugins/kuration/sichtbarkeit/SichtbarkeitPanel.tsx))
- **Rückstellen als Zeichen statt als Satz** — „zurück auf Vorgabe (Standard)" sprengte die Zeile; jetzt ein Pfeil-Knopf, dessen Tooltip die Vorgabe nennt
- Kein neuer Baum-Nachbau: `TfTree` mit `trailing`-Slot und `stopPropagation`, Adapter rein ([tree-komponenten.md](docs/architecture/tree-komponenten.md))

### v4.114.0 — Karten der Fachseiten kennzeichenbar (August 2026)

MINOR — Nachzug zu v4.112: dort endete der Katalog bei Seite und Reiter, die Karten der großen Fachseiten standen nur als JSX da. Jetzt tragen auch sie eine Id — 192 Einträge statt 173.

- **19 Karten aufgenommen** — Vorgangs-Regeln (2), Auslastung (6), Vorgangs-Board (4), Antrag-Aufbereitung (7); Hülle ist `<WennSichtbar>` mit der Id als Literal ([katalog.ts](src/core/sichtbarkeit/katalog.ts), [sichtbarkeitsstufen.md](docs/architecture/sichtbarkeitsstufen.md))
- **Nur eine trägt selbst eine Marke** — die Karte „Externe Recherche" ist `experte` wie der Reiter, auf den sie zeigt; die übrigen 18 sind Griffe für den Kurator, ihre Wirte sind bereits markiert (Regel 1)
- **Kein Verweis mehr auf einen verborgenen Reiter** — „Tab öffnen" im Aufbereitungs-Stepper erscheint nur, wenn es den Reiter für diesen Leser gibt ([UebersichtTab.tsx](src/plugins/antraege/aufbereitung/UebersichtTab.tsx))
- **Trennstriche verschwinden mit ihrer Karte** — die Verwaltungs-Sektionen der Auslastung stehen als gefilterte Liste, nicht als feste JSX-Folge ([EinstellungenView.tsx](src/plugins/auslastung/views/EinstellungenView.tsx))
- **Guard `sichtbarkeit-ids-existieren`** in beiden Richtungen: keine Id ohne Katalog-Eintrag, kein Karten-Eintrag ohne Hülle ([katalog-konventionen.test.ts](src/core/sichtbarkeit/__tests__/katalog-konventionen.test.ts))

### v4.113.0 — Zehn Befunde der Aehnlichkeitsstufe behoben (August 2026)

MINOR — Aus der erschöpfenden Bug-Jagd an der Ähnlichkeitsstufe: zehn Befunde, alle am echten Bestand gemessen (14 225 Anträge, 14 065 Vektoren) und adversarisch geprüft. Der schwerste zuerst — der Vektor eines Vorhabens kannte nie seinen Inhalt, nur seinen Titel.

- **Der Vektorkorpus kennt die Projektbeschreibung** — die Quell-Spalten kommen aus dem CSV-Schema statt aus geratenen Schlüsseln; `projektbeschreibung_text` war in 0 von 14 225 Sätzen gefüllt. Build-Version v3, **einmal neu bauen nötig** ([embedding-corpus.ts](src/plugins/auslastung/services/matching/embedding-corpus.ts), Guard in [conventions-daten](src/__tests__/conventions-daten.test.ts))
- **Der Korpus führt eine Signatur** — Modell, Dimension, Präfix, Textversion; ein inkrementeller Lauf verlängert keinen fremden Vektorraum mehr, und das Manifest stempelt den erzeugenden statt den aktiven Stand ([signatur.ts](src/core/services/embedding-corpus/signatur.ts))
- **Der Suchbereich gilt auch für die Ähnlichkeit** — „nur Einrichtung" und „nur Dokumente" legen die Stufe still, statt das ausgeschlossene Thema zurückzugeben; die Zeile sagt es an ([suchbereich.ts](src/core/services/search/suchbereich.ts))
- **Der Deckel verwirft keine neuen Treffer mehr** und der Rechenschaftssatz nennt die Zahl VOR dem Deckel plus das, was er zurückhielt ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts), [aehnlichkeitsSatz.ts](src/plugins/suche/aehnlichkeitsSatz.ts))
- Sechs Kleinere: trainierter Anfrage-Präfix statt selbst formuliertem, Modell lädt erst bei Bedarf, „lädt" heißt nicht mehr „fehlgeschlagen", Halbkorpus heilt, Einschalten verliert keinen Dokumenttreffer, der Indexer räumt alte Chunks ([suche-relevanz.md §8](docs/architecture/suche-relevanz.md))

### v4.112.0 — Beta-Funktionen und Expertenmodus (August 2026)

MINOR — 19 Plugins, ~75 Reiter, ~68 Abschnitte, 16 Widgets: vieles davon ist Erprobung oder Tiefenwerkzeug und stand doch gleichberechtigt neben dem Tagesgeschäft. Eine vierte Sichtbarkeits-Achse räumt auf — sie beantwortet „will ich das sehen?", nicht „darf ich das?".

- **Zwei unabhängige Marken, UND-verknüpft** — Reife (`beta`) und Zielgruppe (`experte`); was beides trägt, braucht beide Schalter. Eine einzige Stufe hätte „neu für alle" und „neu für Profis" in denselben Topf geworfen ([sichtbarkeitsstufen.md](docs/architecture/sichtbarkeitsstufen.md), Pitfall #54)
- **Zwei Schalter im Profil** (beide aus), mit Zähler, der den echten Zugewinn im aktuellen Stand des anderen nennt ([UmfangGruppe.tsx](src/plugins/einstellungen/profil/UmfangGruppe.tsx))
- **Kurator-GUI „Sichtbarkeit"** im Datenpflege-Hub: Baum aus Seite → Reiter → Abschnitt plus Widgets, zwei Marken je Zeile, Abweichungs-Sidecar `_intern/sichtbarkeit.json` über der Code-Vorbelegung ([SichtbarkeitPanel.tsx](src/plugins/kuration/sichtbarkeit/SichtbarkeitPanel.tsx))
- **173 Einträge vorbelegt**, 43 markiert (20 Beta, 19 Experte, 4 beides) — mit beiden Schaltern aus verschwinden 7 der 18 Nav-Einträge samt ihrer Reiter ([katalog.ts](src/core/sichtbarkeit/katalog.ts))
- Sieben Guards halten die Regeln: eine Frage-Stelle, keine Doppelmarke, Unantastbares unantastbar, keine Seite ohne Reiter ([katalog-konventionen.test.ts](src/core/sichtbarkeit/__tests__/katalog-konventionen.test.ts))

### v4.111.0 — Die Suchseite haelt ihre Zusagen (August 2026)

MINOR — Aus der erschöpfenden Bug-Jagd auf der Suchseite: sieben Befunde, alle gemessen und adversarisch geprüft. Gemeinsamer Nenner — die Seite sagte etwas zu („die häufigsten fünf", „+385 seit zuletzt", „422 Treffer"), das an der Stelle daneben nicht galt.

- **Ein Spaltenfilter gilt für beide Ansichten** und steht als entfernbarer Chip neben den Facetten; die Liste sortiert die spaltengefilterte Menge, nicht die davor ([SpaltenFilterChips.tsx](src/plugins/suche/SpaltenFilterChips.tsx), Guard in [conventions-ui](src/__tests__/conventions-ui.test.ts))
- **„Die häufigsten fünf" sind es jetzt** — die Stöbern-Vorschau ordnet nach Häufigkeit statt alphabetisch; Sachsen (2 742) statt Bremen (306) ([suche-relevanz.md §9.3](docs/architecture/suche-relevanz.md))
- **Werte mit Anführungszeichen sind wieder auffindbar**: Anfrage und Korpus legen dasselbe ab (13 von 5 407 Einrichtungen, `ast:"EIKBOOM …"` 0 → 2) ([suche-relevanz.md §9.4](docs/architecture/suche-relevanz.md))
- **„Häufig gesucht" zählt wirklich** und „+N seit zuletzt" misst beide Seiten mit derselben Latte ([anfrage-verlauf.ts](src/core/services/search/anfrage-verlauf.ts), [useGespeicherteSuchen.ts](src/plugins/suche/useGespeicherteSuchen.ts))
- Kleiner: `ort:Dresden` verspricht kein Bundesland mehr, das Merk-Datum ist der lokale Tag ([suchsprache.ts](src/plugins/suche/start/suchsprache.ts), [gespeicherteSuchen.ts](src/plugins/suche/gespeicherteSuchen.ts))

### v4.110.0 — Die Aehnlichkeitsstufe legt Rechenschaft ab (August 2026)

MINOR — Gemeldet: „auch ähnliche Themen" eingeschaltet, Trefferzahl unverändert, nach 20 s dieselbe KI-Antwort. Nachgemessen: die Stufe lief und fand 2 Kandidaten, einer neu — sichtbar war davon nichts. Ein Messfeld ohne Urteil meldet keinen Stillstand.

- **Der Schalter legt Rechenschaft ab**: „9 thematisch verwandte Vorhaben, 8 davon neu" / „alle standen schon im Wortlaut-Ergebnis" / „kein Vorhaben über der Schwelle" ([aehnlichkeitsSatz.ts](src/plugins/suche/aehnlichkeitsSatz.ts))
- **Die Reichweite steht dabei** — „Vergleichbar sind 1.086 von 14.225 Vorhaben"; ohne Vektor kann nichts ähnlich sein ([suche-relevanz.md §8.5](docs/architecture/suche-relevanz.md))
- **Relative Schwelle 0,85 statt 0,90** — nicht Floor und nicht TOP_K bremsten, sondern das enge Band; Messtabelle über fünf Fragen im Service ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts))
- Am selben Lauf gemessen: **2 Kandidaten → 9, davon 8 neu; 136 → 143 Treffer**
- Unverändert: der Deckel für reine Ähnlichkeitstreffer (nie über einem Wortlaut-Treffer)

### v4.109.0 — Das Suchfeld schlaegt Fragen vor (August 2026)

MINOR — Gewünscht: das Dropdown im Frage-Modus der Suche nach dem Vorbild der Förderanträge. Dort schwieg die Vervollständigung (niemand tippt `ort:` in einen Satz), übrig blieb der nackte Verlauf — und der beantwortet nicht, was man hier überhaupt fragen kann.

- **Mechanik geteilt, Katalog je Seite**: Abschnitte, Lücken `‹…›` und Tastatur liegen jetzt in [frage-vorschlaege](src/components/frage-vorschlaege/abschnitte.ts), beide Seiten reichen ihren `FrageKatalog` herein
- **Der Katalog der Suche** kennt Thema, Ort, Jahr und Stand — die Achsen, die ihr Frageplan wirklich setzt ([katalog.ts](src/plugins/suche/frage/katalog.ts))
- **Eine Liste, zwei Orte**: `FRAGEN` speist Dropdown und Reiter „Fragen" des Startzustands; zwei Vorräte liefen auseinander
- **Eine halbe Frage erreicht die KI nie** — `frageStellen` bricht bei offener Lücke ab, der Knopf ist gesperrt ([suche-relevanz.md §8.4](docs/architecture/suche-relevanz.md))
- **Erst ab dem ersten Zeichen**, damit die Reiterleiste des Startzustands frei bleibt (Regel aus v4.107.1)

### v4.108.0 — Suchfeld ziehbar, Quickfilter gehoeren zum Reiter (August 2026)

MINOR — Gewünscht: „Suchfeld breiter machen (die Breite von Suche in Stichworten nehmen). Bei Suche mit Frage Textfeld vertikal resizable machen." Dazu die Zusage von v4.107.2, die Quickfilter in die Reiter-Räumung zu ziehen — beim Bauen zeigte sich, dass sie stattdessen zum Reiter gehören müssen.

- **Ein Feld, zwei Betriebsarten**: Stichworte einzeilig, Frage mehrzeilig mit ziehbarer Unterkante und gemerkter Höhe ([SuchFeld.tsx](src/plugins/antraege/SuchFeld.tsx))
- **Gleiche Breite in beiden**: die Zeile bricht um, statt das Feld zu stauchen (gemessen 640 px hier wie dort)
- **Die Quickfilter-Pillen gehören zum eigenen Reiter** — gespeichert, wiederhergestellt und identitätsstiftend; ein Reiter „PreCheck offen" trug bisher nur den Namen ([eigeneReiter.ts](src/plugins/antraege/eigeneReiter.ts))
- **Ältere gemerkte Reiter** bekommen beim Laden „keine Einschränkung" nachgefüllt (`ergaenzeQuickfilter`)
- **Höhe im Callback-Ref herstellen und überwachen**, nicht im Effekt (Bug-Klasse 23): das Element wechselt mit dem Modus die Sorte

### v4.107.2 — Vom eigenen Reiter zurueck auf einen festen (August 2026)

PATCH — Gemeldet: „wenn ich eigene Suche als Tab gespeichert habe, geht die Umschaltung zu anderen Tabs (insb. zum ersten Tab Antragsphase) nicht mehr." Die Markierung des eigenen Reiters hängt an der Signatur des Stands — sitzt er auf derselben Basis, ändert `setActiveView` nichts an ihr, und der Klick war ein Nichts.

- **Der Klick auf einen festen Reiter verlässt den eigenen** (`verlasseEigenenReiter`) ([reiterZustand.ts](src/plugins/antraege/reiterZustand.ts))
- **Abgeräumt wird der Ausschnitt, nicht die Anordnung**: Filterleiste, Kopf-Auswahl und Beendet-Sicht gehen, Spaltensatz und Dichte bleiben eine Vorliebe
- **Gemessen in dev:local**: eigener Reiter 799 → Antragsphase 845 → und zurück, Filterzähler 1 → 0 ([verlasseEigenenReiter.test.ts](src/plugins/antraege/__tests__/verlasseEigenenReiter.test.ts))

### v4.107.1 — Das Vorschlags-Dropdown deckt die Suchhilfen nicht mehr zu (August 2026)

PATCH — Gemeldet: das Verlaufs-Dropdown verdeckt die Reiterleiste der Suchhilfen komplett. Es zeigte dort denselben Verlauf, den der Reiter „Zuletzt" zwei Zeilen tiefer ungekürzt führt — und nahm dafür „Alle · Zuletzt · Suchsprache · Fragen · Stöbern" weg.

- **Beim leeren Feld bleibt die Liste zu** — eine Bedingung für Anzeige, Tastatur und `aria-expanded` ([vervollstaendigung.ts](src/plugins/suche/vervollstaendigung.ts))
- Nicht durchsichtig gemacht: die Fläche fängt die Klicks weiterhin ab, und Text auf Text fällt unter AA ([DESIGN_GUIDE.md](DESIGN_GUIDE.md))

### v4.107.0 — Die getippte Frage filtert die Liste nicht mehr (August 2026)

MINOR — Gemeldet: „habe getestet, es wurde gar keine KI genutzt." Der Fragesatz lief beim Tippen sofort als Wortlaut-Suche mit und traf über Titel und Antragsteller nichts: die Liste war leer, alle Pillen standen auf „Alle" — es sah aus wie ein KI-Ergebnis. Gefragt worden war nie jemand.

- **Der Fragesatz ist kein Suchbegriff** — eine Quelle für Liste und Hybrid-Suche, statt zweier Leser von `search` ([suchtext.ts](src/plugins/antraege/frage/suchtext.ts), [antrags-frage.md](docs/architecture/antrags-frage.md))
- **Auch ein erfolgreicher Lauf ohne Themen sucht nicht im Wortlaut**: der Normalfall (Status + Jahr + PreCheck) nennt kein Thema und hätte leer zurückgegeben
- **Knopf „Frage stellen"** wie in der Dokumenten-Suche, dazu die Zeile „Noch nicht gestellt …" ([AntraegeHeader.tsx](src/plugins/antraege/AntraegeHeader.tsx))
- **Umschalter und Knopf stehen rechts vom Feld** — erst schreiben, dann die Suchart, dann abschicken
- **`frageModus`/`frageGestellt` im Antrags-Store** statt in einem eigenen: die Frage entscheidet mit, ob der Feldtext eine Anfrage ist ([store.ts](src/plugins/antraege/store.ts))

### v4.106.1 — Frage stellen ist ein Knopf wie die anderen (August 2026)

PATCH — Gemeldet: der Knopf neben dem Suchfeld ist größer als die CTAs sonst in der App. Er war auch keiner — ein hand-gebauter `<button>` mit eigenem Fill, am `<Button>` vorbei, den [DESIGN_GUIDE.md](DESIGN_GUIDE.md) dafür vorschreibt.

- **„Frage stellen" ist jetzt `<Button variant="primary" size="sm">`** — 28 statt 36 px, wie die 412 anderen `size="sm"` in der App ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Kein Text-Tausch mehr im Ladezustand** („Übersetze…"): Spinner + Sperre kommen aus `loading`, wie im Design-Guide vorgeschrieben

### v4.106.0 — Vorschlaege fuer den Frage-Modus der Foerderantraege (August 2026)

MINOR — Gewünscht waren Vorschläge für den Frage-Modus: vergangene Fragen, konkrete Beispiele und Vorlagen zum Ausfüllen. Ein leeres Feld, das einen ganzen Satz erwartet, zeigte bis dahin genau ein Beispiel im Platzhalter — welche Achsen es sonst gibt, stand nirgends.

- **Drei Abschnitte in einer Liste** — Zuletzt gefragt · Beispielfragen · Zum Ausfüllen, mit einer Auswahlmarke über alle ([vorschlagsAbschnitte.ts](src/plugins/antraege/frage/vorschlagsAbschnitte.ts), [antrags-frage.md](docs/architecture/antrags-frage.md))
- **Fertige Frage gegen halbe Frage**: Verlauf und Beispiel werden gestellt, eine Vorlage nur eingesetzt — der Cursor landet markiert auf der ersten Lücke `‹…›` ([useFrageVorschlaege.ts](src/plugins/antraege/frage/useFrageVorschlaege.ts))
- **Enter springt zur nächsten Lücke**, statt eine halbe Frage an die KI zu schicken ([FrageVorschlaege.tsx](src/plugins/antraege/frage/FrageVorschlaege.tsx))
- **Gemerkt wird erst, was übersetzt werden konnte** — gerätelokal und getrennt vom Verlauf der Dokumenten-Suche ([frageVerlauf.ts](src/plugins/antraege/frage/frageVerlauf.ts))
- **Die Verlaufs-Mechanik steht jetzt einmal** statt in der Such-Seite, die eine React-Komponente hinter sich herzöge ([anfrage-verlauf.ts](src/core/services/search/anfrage-verlauf.ts))

### v4.105.1 — Die gezaehlte Gruppe steht in den Belegen (August 2026)

PATCH — Gemeldet: „die Antwort ist nicht hilfreich, wenn die 4 nicht gelistet sind". Der Befund zählte „4 von 499 tragen ALLE gefragten Themen", die Antwort erklärte sie für nicht im Auszug enthalten — sie standen auf den Plätzen 1 bis 4. Keine Belegzeile wies die Gruppe aus, also konnte das Modell sie zählen, aber nicht benennen.

- **Die Belegzeile beschriftet die Gruppe** („trägt ALLE gefragten Themen", erst ab zwei gefragten Sachen) ([assistentKontext.ts](src/plugins/suche/assistentKontext.ts))
- **Die Auswahl zieht sie nach vorn** — Relevanz allein garantiert nicht, dass sie unter die 40 Belege kommt ([suche-relevanz.md §8.3](docs/architecture/suche-relevanz.md))
- **Die Prompt-Regel hängt an der Marke selbst**: einzeln nennen statt zählen, und nie behaupten, sie fehlten ([frageantwort-lauf.ts](src/core/services/search/frageantwort-lauf.ts))
- **Eine Schwelle für Zählen und Beschriften** (`traegtAlleThemen`) statt zweier Vergleiche auf dieselbe Gruppe ([trefferstelle.ts](src/core/services/search/trefferstelle.ts))

### v4.105.0 — Frage an die Foerderantrags-Liste (August 2026)

MINOR — Gewünscht war die Frage in natürlicher Sprache auch für die Förderanträge. Die Fragen dort sind aber anderer Art als in der Dokumenten-Suche: sie nennen kein Thema, sondern Metadaten-Kombinationen („alle Netzwerke, die für Phase 2 abgelehnt wurden"). Übernommen wurde deshalb das Muster, nicht der Frageplan.

- **Die Frage setzt die vorhandenen Filter** statt einer eigenen Trefferliste — Pillen und Chips zeigen, was verstanden wurde, und bleiben einzeln korrigierbar ([antrags-frage.md](docs/architecture/antrags-frage.md))
- **Stillstand als eigene Achse**: „seit wann kein neues Kürzel", auch ohne Frage per Klick. Ohne datierbares Kürzel lautet das Urteil **„nicht prüfbar"**, nie „läuft" ([letzteAktivitaet.ts](src/plugins/antraege/frage/letzteAktivitaet.ts))
- **Kürzel-Ausschnitt aus einer Frage** — die Liste konnte bisher nur das eigene Profil-Kürzel; bei fester Identität (MA-Login) greift er bewusst nicht ([useBearbeiterSicht.ts](src/core/hooks/useBearbeiterSicht.ts))
- **Eine tote Statuskategorie wird gar nicht erst angeboten**: `abgelehnt` hat im Katalog null Rohwerte, ein Filter darauf verglich nichts ([antragsplan.ts](src/plugins/antraege/frage/antragsplan.ts))
- **Die sechs Pflichten eines einschüssigen KI-Laufs stehen jetzt einmal** statt in drei Dateien; Frageplan, Frageantwort und Wortformen-Prüfung laufen darüber ([ein-schuss-lauf.ts](src/core/services/ai/ein-schuss-lauf.ts))

### v4.104.0 — Belege und Vorschlaege getrennt an die KI (August 2026)

MINOR — Vorgeschlagen wurde, dem großen Kontext mehr Treffer zuzumuten und die Ähnlichkeits-Treffer als zweite Menge zu schicken, damit das Modell selbst entscheidet, ob einer dazugehört. Beides trifft zu: 20 Belege waren eine Vorsicht ohne Grund, und untergemischte Vorschläge waren von Funden nicht zu unterscheiden.

- **40 statt 20 Belege** — gemessen 355 Zeichen je Zeile über 12 180 Anträge, also 14 209 statt 7 105 unter einem Deckel von 24 000 ([useFrageAntwort.ts](src/plugins/suche/antwort/useFrageAntwort.ts))
- **Ähnlichkeits-Treffer fahren als eigene, benannte Menge mit** (bis zu 12) — das Modell prüft sie einzeln und muss „(thematisch verwandt)" hinter das Kennzeichen schreiben ([frageantwort-lauf.ts](src/core/services/search/frageantwort-lauf.ts), [assistentKontext.ts](src/plugins/suche/assistentKontext.ts))
- **Eine Gesamtzahl bleibt eine**: der Befund nennt die Zusammensetzung in derselben Zeile („671, davon 75 nur thematisch ähnlich") ([frageBefund.ts](src/plugins/suche/frageBefund.ts))
- **Kandidaten allein reichen für einen Lauf** — eine Frage, die nur thematisch trifft, bekommt trotzdem eine Antwort statt „keine Treffer"
- **Warum das die Rang-Frage erledigt**: die Vorschläge konkurrieren nicht mehr um die 40 Plätze ([suche-relevanz.md §8.2](docs/architecture/suche-relevanz.md))

### v4.103.1 — Der Schalter sagt, was er bei einer Frage tut (August 2026)

PATCH — Gefragt wurde, ob „auch ähnliche Themen" bei einer Frage überhaupt Sinn ergibt und was der Haken dort bewirkt. Er tut dort etwas anderes als bei Stichworten — verglichen wird die ganze Frage —, und das stand nirgends außer im Quelltext.

- **Eigener Tooltip im Frage-Modus**: ganze Frage statt Suchbegriffe, bis zu 50 zusätzliche Vorhaben, gedeckelt auf „mittel", nichts davon bei einer einschränkenden Frage ([SuchOptionenZeile.tsx](src/plugins/suche/SuchOptionenZeile.tsx))
- **Nicht gebaut, weil vorhanden**: schränkt der Plan ein, steht an der Stelle des Hakens schon seit v4.66 „ohne Ähnlichkeitssuche" samt Begründung
- **Nicht automatisch eingeschaltet** — die Antwort-KI liest die ersten 20 Treffer, gedeckelte Ähnlichkeits-Treffer erreichen sie fast nie, zählen aber im Befund mit ([useFrageAntwort.ts](src/plugins/suche/antwort/useFrageAntwort.ts))
- **Die Zahlen stehen im Seiten-Kontext-Doc** ([suche.md](docs/feedback-kontext/suche.md))

### v4.103.0 — Vorgangs-Board und Vorgangs-Regeln laden beim Wiederbesuch sofort (August 2026)

MINOR — Beide Seiten rechneten bei JEDEM Menü-Aufruf den ganzen Bestand neu — gemessen 7,8–18,2 s (Board) bzw. 10,8–12,4 s (Regeln), auch beim Wiederbesuch. Gemeldet als „dauert es bei jedem Aufruf 5 Sekunden ehe die Seiten Inhalte anzeigen".

- **Ergebnis überlebt den Seitenwechsel**: Wiederbesuch < 1 s (Board) bzw. 126 ms (Regeln), mit sichtbarem Alter + „neu berechnen" ([boardCache.ts](src/plugins/vorgangs-board/boardCache.ts), [cockpitCache.ts](src/plugins/status-cockpit/cockpitCache.ts), [BestandsFrische.tsx](src/components/ui/BestandsFrische.tsx))
- **Fassungs-Indizes einmal je Fassung statt je Antrag** — Wächter 2 459 → 602 ms, Neuberechnung gesamt 10,5 → 5,3 s ([version-index.ts](src/core/status/version-index.ts))
- **Kompilierter Vorkommen-Plan + Kaskaden-Index** statt Closure/Sortierung je Antrag ([feld-aufloesung.ts](src/core/status/feld-aufloesung.ts), [todo-engine.ts](src/core/status/todo-engine.ts))
- **`stand.json` + Trigger-Parse je Sitzung einmal**, `filterRecord` auf die sechs Kürzel-Spalten eingedampft ([stand.ts](src/core/status/journal/stand.ts), [trigger-share.ts](src/core/status/trigger-share.ts), [boardFilter.ts](src/plugins/vorgangs-board/boardFilter.ts))
- **Gechunktes Lesen wurde gemessen und VERWORFEN** (28 Transaktionen statt einer, ~7 s teurer) — der Absatz steht im Code, damit es niemand erneut „verbessert" ([vorgangs-quelle.ts](src/core/status/vorgangs-quelle.ts))

### v4.102.2 — Der Chip filtert auch die Tabelle (August 2026)

PATCH — Der Chip „nur die genannten 6" filterte Kopfzahl, Liste und Export, die **Tabelle** aber nicht: über 671 Zeilen stand „6 Treffer". Gemeldet als „obwohl ‚nur 6' an ist, werden in der Tabelle weiterhin alle Ergebnisse angezeigt".

- **Die Tabelle bekommt dieselbe Menge wie alle anderen Anzeigestellen** ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Guard `suche-eine-gezeigte-menge`**: Kopfzahl, Liste, Tabelle, Export und KI-Kontext müssen denselben Namen nennen — nachgewiesen scharf (Rückbau ⇒ rot) ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts))
- **Die zweite Meldung („KI-Antwort nur für 5 der 6") war dieselbe Ursache** — der sechste Beleg stand weiter unten in der ungefilterten Tabelle; die Zerlegung liefert für den echten Antworttext sechs Belege ([genannteTreffer.test.ts](src/plugins/suche/antwort/__tests__/genannteTreffer.test.ts))
- **Antwortkarte + Chip stehen jetzt im Seiten-Kontext-Doc** ([suche.md](docs/feedback-kontext/suche.md))

### v4.102.1 — CSV-Quellordner darf nicht der eigene Kopie-Ordner sein (August 2026)

PATCH — Auf der Entwickler-Maschine importierte die App bei JEDEM Reload alle drei CSV-Quellen, obwohl sich kein Export geändert hatte. Nicht die Erkennung war schuld: `dev:local` las den Ordner, in den die App ihre eigene UTF-8-Kopie schreibt, `zah-pl` den echten Export — zwei Dateien, ein Schema-Record, 195× hin- und hergekipptes `encoding` bei null inhaltlicher Änderung.

- **`csvSourceDir` der Variante „local" zeigt auf den Export-Ordner**, nicht mehr in den Daten-Share ([local.config.json](configs/local.config.json))
- **`istEigenerKopieOrdner` meldet den Fall zur Laufzeit** — einmal je Lauf in `collectCandidates`, als Warnung + Audit-Eintrag, ohne den Lauf abzubrechen ([csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts))
- **Convention-Test `csv-quellordner-nicht-kopieordner`** hält alle Configs davon frei ([conventions-daten.test.ts](src/__tests__/conventions-daten.test.ts))
- **Wiederholte Encoding-Heilung ist ein eigener Befund** — Hergang, Messung und Audit-Grep als Erstdiagnose ([csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md), [local-variante.md](docs/architecture/local-variante.md))

### v4.102.0 — Die Auswahl fragt selbst (August 2026)

MINOR — Zwei Meldungen aus dem Test, beide über eine Geste zu viel: eine Frage aus dem Verlauf stand nach der Auswahl nur im Feld und wartete auf einen zweiten Klick, und über ihr stand ein Richtlinien-Chip, der noch gar nichts gefiltert hatte.

- **Eine ausgewählte Anfrage läuft sofort** — Verlaufs-Zeile im Vorschlagsfeld wie Zeile unter „Zuletzt gesucht"; im Frage-Modus geht sie damit direkt an die interne KI ([SearchInput.tsx](src/plugins/suche/SearchInput.tsx), [SucheStartzustand.tsx](src/plugins/suche/SucheStartzustand.tsx))
- **Feldnamen und Werte laufen weiterhin nicht los** — sie sind ein Stück Anfrage, kein Auftrag; die Auswahl tut genau das, was die Eingabetaste täte
- **Der Richtlinien-Chip verschwindet bei offener Frage** und steht sonst wie bisher im Ergebniskopf bzw. im Startzustand ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Pitfall #46 präzisiert**: keine heruntergezählte Zahl ohne Chip — und kein Chip, wo keine Zahl steht ([vorgangssystem.md §10](docs/architecture/vorgangssystem.md))

### v4.101.0 — Ein Fragezeichen mitten im Wort (August 2026)

MINOR — 306 der 733 Netzwerke führen mehr als eine Schreibweise ihres Namens; bei `mobiInspec` gegen `mobilnspec` erreichte keine feste Nadel beide Hälften. Dazu zwei Meldungen aus dem Test: die Marke der KI-Antwort fehlte in der Tabellenansicht, und der Richtlinien-Chip stand nicht bei der Zahl, auf die er wirkt.

- **`?` steht für genau ein Zeichen** — überall außer am Wortende, wo es das Fragezeichen einer Frage bleibt ([wortstamm.ts](src/core/services/search/wortstamm.ts))
- **Vor dem Bau gemessen**: der Muster-Pfad kostet 4,7 ms gegen 5,8 ms heute (12 358 Anträge × 6 Felder) — teuer ist nur eine zu weite Anfrage, dagegen steht die Drei-Zeichen-Grenze ([suche-relevanz.md](docs/architecture/suche-relevanz.md))
- **Spalte „KI-Antwort" in der Tabelle** — dieselbe Auskunft wie die Marke in der Liste, Kurzform in der Zelle, ganzer Satz im Tooltip und im Export ([antwortSpalte.ts](src/plugins/suche/antwort/antwortSpalte.ts))
- **Der Richtlinien-Chip steht im Ergebniskopf**, direkt hinter „180 Treffer in 14.225 Anträgen"; ohne Ergebnis weiter über den Facetten ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Am Bestand nachgemessen**: `mobi?nspec` 33 · `16KN0830?1` 14 · `Normung?` 0 · `????` 0

### v4.100.0 — Verwaltungsnotizen raus aus der Suche, Antwort rein in die Liste (August 2026)

MINOR — Zwei Meldungen, eine Wurzel: die Suche zeigte Dinge nebeneinander, die nicht zusammengehören, und trennte, was zusammengehört. Gemeldet als „warum kann ich die Spalte Notiz nicht abwählen, da steht oft was mit Vollmachten" und „wie kann der User die Liste der KI ganz oben mit den Suchergebnissen darunter zusammenbringen?".

- **Die Arbeitsnotizen laufen nicht mehr im Standard mit** — sie hängen am Vorgang, nicht am Vorhaben: 1.054 der 5.345 Notizen nennen eine Vollmacht ([suchbereich.ts](src/core/services/search/suchbereich.ts))
- **Der Standardbereich heißt „alle Vorhabensfelder"** statt „alle Felder"; die drei Ausnahmen stehen benannt in `NICHT_IM_STANDARD`, der Guard hält es bei dreien
- **Der Klick auf ein Kennzeichen in der Antwort springt in die Liste** statt die Suche zu verlassen — die Liste lädt dafür bis zur Zielzeile nach ([useAntwortBruecke.ts](src/plugins/suche/antwort/useAntwortBruecke.ts))
- **Genannte Treffer tragen die Marke „in der Antwort"** und den Satz der KI als Kurzform, den vollen im Tooltip — ohne zweiten KI-Aufruf ([genannteTreffer.ts](src/plugins/suche/antwort/genannteTreffer.ts))
- **Chip „nur die genannten (13)"** hinter den Facetten; der Antwort-Lauf bleibt bewusst auf der ungefilterten Menge ([GenannteChip.tsx](src/plugins/suche/antwort/GenannteChip.tsx))

### v4.99.0 — Ein Ordner sagt, ob er eine Spalte traegt (August 2026)

MINOR — Der Ordnerbaum sah nach Zierrat aus: über 25 Fassungen hat ihn niemand umgebaut, vier seiner 19 Ordner sind leer. Er ist es nicht — aus `kategorieId` entstehen die Ordner-Spalten der Fördertabelle. Ein leerer Ordner ist damit eine Spalte, die nie erscheinen kann, und das stand nirgends.

- **Bilanzzeile über dem Ordnerbaum**, die die Ordner ohne Spalte **namentlich** nennt ([ordnerBilanz.ts](src/plugins/status-cockpit/ordnerBilanz.ts), [KategorieEditor.tsx](src/plugins/status-cockpit/KategorieEditor.tsx))
- **Marke „ohne Spalte" am Ordner** — nur dort, wo etwas fehlt; ein Haken am Regelfall wäre Rauschen
- **Das Kriterium wird geholt, nicht nachgebaut**: `kategorienMitDatumsfeldern` bleibt die einzige Quelle, sonst behauptete die Zeile etwas, das die Tabelle nicht einlöst
- **„Leer" und „ohne Spalte" sind nicht dasselbe** — nötig ist ein aktives Datums-Kürzel mit Prominenz ≠ Ignoriert ([ordnerBilanz.test.ts](src/plugins/status-cockpit/__tests__/ordnerBilanz.test.ts))
- **Korrektur der Analyse vom 18.08.**: der vorgeschlagene Rückbau der Ordner-Achse hätte dem Team Spalten aus der Fördertabelle genommen ([status-achsen.md](docs/architecture/status-achsen.md))

### v4.98.0 — Ein Status ist eine Zeile (August 2026)

MINOR — Der Reiter sagte „Statuswerte 60", der Baum daneben zeigte 30, und die Drift-Zeile schrieb ausdrücklich „gezählt werden Status, keine Katalogzeilen". Drei Stellen, zwei Vokabulare. In der Tabelle stand jeder Status zweimal untereinander — über 25 Fassungen wich kein einziges der 30 Paare in irgendeinem kuratierten Feld ab.

- **Eine Zeile je Status** statt je Katalogzeile; die erste Spalte heißt jetzt **Ebene** und sagt „TV · Verbund" ([katalogZeilen.ts](src/plugins/status-cockpit/katalogZeilen.ts), [katalogSpalten.tsx](src/plugins/status-cockpit/katalogSpalten.tsx))
- **Reiter, Umschalter und Baum zählen dasselbe** — `zaehleStatus` ist die eine Quelle ([StatusCockpitPage.tsx](src/plugins/status-cockpit/StatusCockpitPage.tsx))
- **Eine Änderung trifft beide Katalogzeilen** (`aendereCodeWerte`) — derselbe Schlüssel, den `setzeCodePhasen` und `setzeKurzLabel` längst nehmen ([katalog-edit.ts](src/core/status/katalog-edit.ts))
- **Abweichung wird nicht verschwiegen**: sagen TV und Verbund Verschiedenes, steht ein ≠ neben der Ebene und nennt die Felder ([katalogFaltung.test.ts](src/plugins/status-cockpit/__tests__/katalogFaltung.test.ts))
- **Vorkommen summiert, „zuletzt gesehen" das jüngste** — die Zahl gilt für den Status, nicht für eine seiner zwei Zeilen

### v4.97.1 — Erst suchen, dann speichern; die Relevanz zeigt Striche (August 2026)

PATCH — Zwei Meldungen aus dem Test des Suchkopfs: „Diese Suche speichern" stand rechts vom Menü der gespeicherten Suchen und bot sich schon an, während der Hinweis darunter „Noch nicht gestellt" sagte. Und die Score-Spalte der Tabelle zeigte „0.88", wo die Liste daneben drei Striche und „hoch" zeigt.

- **Erst speichern, dann nachschlagen** — die beiden Kopf-Aktionen sind vertauscht ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Der Speichern-Knopf erscheint erst nach einem Suchlauf**, an derselben Bedingung wie Deutung, Facetten und Trefferzahl; eine getippte, nicht gestellte Frage ist keiner
- **Er steht links vom Menü, damit sein Erscheinen die Nachbarn nicht verschiebt** — gemessen: „Gespeicherte Suchen" und „Hilfe" bleiben in beiden Zuständen auf 831 px / 1.002 px
- **Die Spalte „Score" heißt „Relevanz"** und zeigt den `StufenBalken` der Listenansicht; der rohe Score bleibt Tooltip und Sortierwert ([columns.tsx](src/plugins/suche/columns.tsx))

### v4.97.0 — Die Auswahl zeigt sich ganz, die Zahl sagt wovon (August 2026)

MINOR — Gemeldet an der Richtlinien-Auswahl: die Kurzwahlen brachen um, die Programmliste scrollte, und das Panel legte sich über genau die Zeile, deren Zahl es ändert. Dazu die Rückfrage, ob „0 Treffer in 14.225 Anträgen" unter einer Einschränkung noch stimmt — sie stimmte nicht.

- **Drei Kurzwahlen in einer Zeile, Programme in zwei Spalten** — die volle Liste ohne Scrollen, Deckel ist die von Radix gemessene Resthöhe ([BereichPanel.tsx](src/components/bereich/BereichPanel.tsx))
- **Das Panel geht unter dem Ergebniskopf auf** statt über ihm; der Versatz wird beim Öffnen gemessen, nicht verdrahtet ([BereichAuswahlChip.tsx](src/components/bereich/BereichAuswahlChip.tsx))
- **„94 Treffer in 2.537 von 14.225 Anträgen"** — unter einer Einschränkung nennt die Zeile beide Mengen ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx), [richtlinienWahl.ts](src/plugins/suche/richtlinienWahl.ts))
- **Der Nenner kommt aus dem Slim-Store**, aus dem auch die Index-Zahl kommt, und wird nur bei einer Einschränkung gelesen ([idb-csv.ts](src/core/services/csv/idb-csv.ts))
- **620 px statt 420**: am längsten Programmnamen gemessen, `title` als Reißleine für künftige Label-Importe

### v4.96.0 — Das Board stellt drei Fragen statt fuenf (August 2026)

MINOR — Gemeldet: die Vielfalt der Reiter sei für die PL-Rolle zu verwirrend. Die Leiste mischte drei Sorten Menge: eine Partition (453 + 331 + 3.101 = 3.885), eine Risiko-Teilmenge (538) und die Gesamtmenge (3.885) — gleich aussehend, aber nicht gegeneinander lesbar. Und der größte Zähler war zu 96 % falsch beschriftet.

- **Drei Reiter statt fünf**: Arbeit · Fristen · Auswertung — drei Fragen, nicht fünf Mengen ([VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx))
- **Wer dran ist, wird ein Filter** mit vier Chips, deren Zahlen sich zur Gesamtmenge addieren ([zustaendigkeit.ts](src/plugins/vorgangs-board/zustaendigkeit.ts), [vorgangs-board.md](docs/feedback-kontext/vorgangs-board.md))
- **„Kein To-do ermittelt 3.101" zerfällt in seine zwei Sorten**: 107 echte Regel-Lücke, 2.994 abgeschlossene Verfahren — das eine ein Mangel, das andere ein Ergebnis
- **Vorbelegt ist der Arbeitsvorrat** (meine + wartet = 784); die anderen beiden stehen mit ihrer Zahl daneben, plus Rückweg „zurück zum Arbeitsvorrat" — abgewählt ist nicht versteckt
- **Der letzte Chip lässt sich nicht abwählen**: eine leere Liste läse sich als „nichts zu tun" ([zustaendigkeit.test.ts](src/plugins/vorgangs-board/__tests__/zustaendigkeit.test.ts))

### v4.95.0 — Wirkungslose Regeln stehen mit Namen da (August 2026)

MINOR — Die Kaskade zählte je Regel zwei Zahlen, sprach aber kein Urteil: „trifft 21 · gewinnt 0" las sich wie jede andere Teilverdeckung. Am Bestand gemessen stehen zwei der 30 Regeln drin, ohne je etwas zu bestimmen — und das sah man nur, wer den Messlauf startete und danach dreißig Zeilen absuchte.

- **Bilanzzeile am Kopf der Kaskade**, die die wirkungslosen Regeln **namentlich** nennt statt sie zu zählen ([todoRegelnAnsicht.ts](src/plugins/status-cockpit/todoRegelnAnsicht.ts), [TodoRegelListe.tsx](src/plugins/status-cockpit/TodoRegelListe.tsx))
- **Drei Gründe statt einer Zahl**: `trifft nie` (Bedingung meint etwas anderes), `immer verdeckt` (Position falsch), `greift nie` (Sperre) — [vorgangssystem.md §11b](docs/architecture/vorgangssystem.md)
- **„gewinnt 0" ist jetzt ein Nullbefund**, nicht der generische Verdeckungs-Satz — die Regel bestimmt bei keinem Vorgang etwas
- **Stillgelegte Regeln bleiben draußen** — sonst meldete die Bilanz als Mangel, was jemand absichtlich abgeschaltet hat ([wirkungsBilanz.test.ts](src/plugins/status-cockpit/__tests__/wirkungsBilanz.test.ts))
- Gemessen in `dev:local` an **12.359** Vorgängen (Richtlinien 2015 + 2020 + 2025, Regelsatz AB): `R10` trifft nie, `R23b` trifft 21 und gewinnt bei keinem

### v4.94.0 — Ein Klick auf die laufende Richtlinie (August 2026)

MINOR — Gewünscht: eine Kurzwahl für „nur die aktuell gültige Richtlinie". Bisher kostete das acht Häkchen — und landete in „eigene Auswahl", inklusive Abweichungs-Notiz. Eine so gesetzte Liste veraltet außerdem still: sie zeigt beim nächsten Richtlinien-Wechsel weiter auf die Programme von 2025.

- **Dritte Kurzwahl „Aktuelle Richtlinie"** im Bereichs-Popover, zwischen Standard-Bereich und Alle Richtlinien ([BereichPanel.tsx](src/components/bereich/BereichPanel.tsx))
- **Eine eigene Stufe, keine vorgesetzte Häkchen-Liste**: `aktuell` leitet seine Programme aus `RICHTLINIEN_GENERATIONEN.slice(-1)` ab und folgt einem Richtlinien-Wechsel von selbst ([betrachtungsbereich.ts](src/core/status/betrachtungsbereich.ts), [vorgangssystem.md §10.1](docs/architecture/vorgangssystem.md))
- **Der Chip nennt das Jahr** statt „letzte Richtlinie" — die Satzform gab es schon für einzelne Generationen („Anzeige: Richtlinie 2015"), sie gilt jetzt auch für die jüngste
- **In beiden Chips**, weil das Panel geteilt ist: Arbeitsvorrat („Anzeige: Richtlinie 2025") und Suche („Treffer: Richtlinie 2025")
- Gemessen in `dev:local` an 14.225 Anträgen: Standard-Bereich blendet **1.866** aus, die neue Kurzwahl **11.688**; die Wahl überlebt den Reload, der Grundzustand bleibt unberührt

### v4.93.0 — Der Netzwerkantrag traegt den Namen seines Netzwerks (August 2026)

MINOR — Gemeldet: „das Netzwerk selbst wird nicht gefunden, es werden nur die FuE-Anträge aus dem Netzwerk gefunden — und im Antragstyp auf NW umschalten geht nicht, der ist leer." Beides stimmte: `nw:<name>` fand nie den Netzwerkantrag. Kein Datenfehler, sondern strukturell — die Spalte `NETZWERKNA` führen nur die Teilvorhaben, der Netzwerkantrag lässt sie leer, weil er das Netzwerk IST.

- **Der Netzwerkantrag bekommt den Namen seines Netzwerks** — aus dem `NETZWERKNA` seiner Mitglieder, ersatzweise aus dem eigenen Akronym ([netzwerk-leads.ts](src/plugins/antraege/services/netzwerk-leads.ts), [suche-relevanz.md §11](docs/architecture/suche-relevanz.md))
- **Gemessen an 1.775 Netzwerkanträgen**: 1.306 aus den Mitgliedern, 468 aus dem Akronym, **einer** bleibt namenlos — geraten wird nicht ([netzwerkLeads.test.ts](src/plugins/antraege/__tests__/netzwerkLeads.test.ts))
- **Der Tippfehler wird nicht weggewaschen**: bei mehreren Schreibweisen gewinnt die häufigste (29 `mobiInspec` gegen 1 `mobilnspec`), beide bleiben einzeln auffindbar
- **Der Nachlauf läuft im Speicher** über die schon geladenen Sätze — der Cursor-Walk über die IDB bleibt ein Durchgang ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts))
- Wirkung, gemessen in `dev:local`: `nw:mobiInspec` **29 → 32**, Antragstyp-Facette **FuE 29 · NW 3**, Vorschlagszahl wieder deckungsgleich mit dem Ergebnis

### v4.92.0 — Die Kuerzel-Zeile fuehrt nur, was auch entschieden wird (August 2026)

MINOR — Gemeldet: die Pflege der Kürzel falle schwer, zu viele neue Begriffe — klar sei nur „wird gesetzt von". Die Messung der Fassung 23 gegen die Auslieferung erklärt beides: an Ordner und Prominenz wurde in 23 Fassungen **keine einzige** Änderung vorgenommen (sie kommen richtig aus der Zuarbeit), und die ZAH-Phase kann für 91 % der Kürzel gar keine Antwort haben. Drei Auswahlfelder in 509 Zeilen waren vor allem eines: eine Aufforderung.

- **Die Zeile führt nur noch, was hier entschieden wird** — Ordner, Prominenz und Verfahrensschritt stehen in der Klappe der Zeile, mit ihrer Herkunft dabei ([FelderTab.tsx](src/plugins/status-cockpit/FelderTab.tsx))
- **Die Klappe ist immer erreichbar** statt nur bei vorhandener Trigger-Wirkung — sonst sähen die übrigen Zeilen aus, als hätten sie nichts zu zeigen ([FelderTab.tsx](src/plugins/status-cockpit/FelderTab.tsx))
- **„Welches Datum speist einen Schritt?" steht am Schritt** statt am Kürzel; über dem Baum werden ungedeckte Schritte **namentlich** genannt ([phasenDatumsfelder.ts](src/plugins/status-cockpit/phasenDatumsfelder.ts), [PhasenDetail.tsx](src/plugins/status-cockpit/PhasenDetail.tsx))
- **Gezählt wird nur, was wirkt**: ein stillgelegtes oder als `ignoriert` ausgeblendetes Kürzel deckt keinen Schritt ([phasenDatumsfelder.test.ts](src/plugins/status-cockpit/__tests__/phasenDatumsfelder.test.ts))
- **Prominenz `meilenstein` heißt „Hauptereignis"** — das Wort gehört dem Meilenstein-Plan; der Bezeichner bleibt, ein Test hält die Beschriftung ([labels.ts](src/plugins/status-cockpit/labels.ts), [status-achsen.md](docs/architecture/status-achsen.md))

### v4.91.0 — Die Suche waehlt ihre Richtlinien selbst (August 2026)

MINOR — Gefragt: „können wir bei der Suche eine Richtlinienauswahl machen wie bei den Förderanträgen, damit der User leicht alte Richtlinien ausblenden kann?" Der Betrachtungsbereich stand dafür nicht zur Verfügung: er schneidet den Arbeitsvorrat und steht auf „letzte 3 Richtlinien" — die Suche muss im Grundzustand alles finden. Zwei Fragen, also zwei Speicher, aber eine Bedienung.

- **Chip „Treffer: alle Richtlinien" über der Trefferliste** — gemerkte, gerätelokale Auswahl mit demselben Panel wie auf den Förderanträgen ([richtlinienWahl.ts](src/plugins/suche/richtlinienWahl.ts), [suche-relevanz.md §10](docs/architecture/suche-relevanz.md))
- **Ein Bauteil statt zweier Abschriften**: Speicher, Chip und Panel sind geteilt, verschieden sind nur Grundzustand und Präfix ([bereichsStore.ts](src/core/hooks/bereichsStore.ts), [BereichAuswahlChip.tsx](src/components/bereich/BereichAuswahlChip.tsx))
- **Alle Zahlen folgen der Auswahl** — Facetten, Vorschläge, Startzustand und Kein-Treffer-Auswege; der Korpus führt dafür die `unterprogrammId` mit ([useKorpusZahlen.ts](src/plugins/suche/useKorpusZahlen.ts))
- **Der Kein-Treffer-Zustand bietet „alle Richtlinien einbeziehen"** mit der echten Zahl — eigener Ausweg, damit „Filter entfernen" die gemerkte Wahl nicht mit wegräumt ([auswege.ts](src/plugins/suche/auswege.ts))
- **Das Panel zeigt in der Stufe „alle" jetzt alle 16 Programme** statt zwölf angehakter bei sechzehn geltenden ([BereichPanel.tsx](src/components/bereich/BereichPanel.tsx))

### v4.90.0 — Die Arbeitsliste haengt am Code, nicht am Verfahrensschritt (August 2026)

MINOR — Gefragt: „wir haben Kürzel, Stati, Phasen und Meilensteine — ist das zu kompliziert?" Nicht die Anzahl war das Problem, sondern dass eine unserer Erfindungen eine andere heimlich steuerte: die Arbeitsliste hing an der kuratierbaren ZAH-Phase. Genau so verschob Katalog-Fassung 19 unbemerkt 448 Anträge zwischen Reitern; die Reparatur von damals war eine Ausnahmeliste, also ein vierter Mechanismus statt der Abschaffung der Kopplung.

- **`kategorieVorgabe` entfällt** — die Arbeitsliste hängt für alle 26 Codes am Statuscode; kein Phasenschnitt kann sie mehr verschieben ([kategorie-ableitung.ts](src/core/status/kategorie-ableitung.ts), [zah-phasen.ts](src/core/status/zah-phasen.ts))
- **Der Wächter `status-category-not-curated` ist absolut**: kein Fassungs-Typ trägt mehr eine `StatusCategory`, weder einzeln noch als Liste ([conventions-status.test.ts](src/__tests__/conventions-status.test.ts))
- **Fünf Codes waren zwischen `prod` und `pl` uneinig** (32/72/75/90/91, gemessen an 64.385 Zeilen); die gelebte Fassung 23 gewinnt, `prod` zieht nach ([status-achsen.md](docs/architecture/status-achsen.md))
- **Ein Fristen-Widget statt zweier** — Zieltage und Meilenstein-Sollwochen in einer Liste, jede Zeile nennt ihre Herkunft ([fristAnlaesse.ts](src/plugins/home/widgets/fristAnlaesse.ts), [FristenWidget.tsx](src/plugins/home/widgets/FristenWidget.tsx))
- **Neuer Reiter „Ebenen" im Status-Cockpit** — die Karte mit Live-Zahlen: was aus C16 kommt, was wir darüber legen, wer was pflegt ([ebenenModell.ts](src/plugins/status-cockpit/ebenenModell.ts))

### v4.89.0 — eine Frage wird beantwortet, nicht zweimal gestellt (August 2026)

MINOR — Gemeldet: „der User will eine Frage beantwortet haben (und sehen, wonach gesucht wird)". Bisher endete der Frage-Modus bei der Trefferliste; daneben ging das Assistenten-Panel auf, trug dieselbe Frage im Feld und wartete auf eine zweite Absendung — die dann über 40 von 663 Treffern antwortete. Zwei Absendungen für eine Frage, und die zweite sah 6 % der Menge.

- **Die Antwort steht als Karte über der Trefferliste** und läuft von selbst — mit Fortschritt, anklickbaren Kennzeichen und dem Hinweis, dass die Zahlen gezählt und der Text formuliert ist ([antwort/](src/plugins/suche/antwort/))
- **Sie steht auf einem Befund über ALLE Treffer**, nicht auf 40 Zeilen: Relevanzverteilung, Fundstellen, Jahre, Länder, Orte — und wie viele Treffer **alle** gefragten Themen tragen ([frageBefund.ts](src/plugins/suche/frageBefund.ts))
- **`abdeckung` reist am Treffer mit** — gerechnet wurde sie immer, sie verschwand nur im `score` ([search-result.ts](src/core/types/search-result.ts))
- **Der Antwort-Lauf darf keine eigenen Mengen behaupten** und muss jede Aussage über ein Vorhaben mit FKZ belegen; er läuft nur intern, einmal, ohne Retry ([frageantwort-lauf.ts](src/core/services/search/frageantwort-lauf.ts))
- **Das Panel geht nicht mehr ungefragt auf** ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx)); gemerkte Suchen und ihr Menü ziehen aus der Seite aus ([useGespeicherteSuchen.ts](src/plugins/suche/useGespeicherteSuchen.ts), [GespeicherteSuchenMenu.tsx](src/plugins/suche/GespeicherteSuchenMenu.tsx))

### v4.88.0 — die Vorschlagsliste zeigt alle Werte, von A bis Z (August 2026)

MINOR — Gemeldet: „die Suchvorschläge sollten alphabetisch sein" — und auf Nachfrage „können wir nicht alle nw anzeigen?". Die Häufigkeits-Sortierung beantwortete bisher nur, WELCHE 50 von 1.243 zu sehen sind; zeigt die Liste alle, wird die Frage gegenstandslos. Die alphabetische Ordnung holte dabei zwei Fehlstände ans Licht, die vorher nur weit unten standen.

- **Alle Werte, alphabetisch** — kein Deckel, keine Fußzeile „50 von 1.243" mehr ([wert-index.ts](src/plugins/antraege/services/wert-index.ts), [vervollstaendigung.ts](src/plugins/suche/vervollstaendigung.ts))
- **Die Liste kommt in Stufen zu 200** — sonst blockiert ein Tastendruck bei `ast:` gemessen 1.338 ms; jetzt 51 ms mit 200 Zeilen sofort ([SearchInput.tsx](src/plugins/suche/SearchInput.tsx))
- **Trefferzahlen nur fürs Sichtfenster**, nachgerechnet beim Scrollen — sonst ~80 s Probeläufe; gemeldet über Scroll-Geometrie, weil ein `IntersectionObserver` im nicht dargestellten Fenster nie feuert ([useProbeZahlen.ts](src/plugins/suche/useProbeZahlen.ts), [SearchSuggestions.tsx](src/plugins/suche/SearchSuggestions.tsx))
- **25 Netzwerkwerten fehlt ein Anführungszeichen** — sie standen alphabetisch als Bruchstücke ganz vorn; das Paar bleibt die erste Regel, weil es nicht immer vorn steht ([wert-index.ts](src/plugins/antraege/services/wert-index.ts))
- **80 Netzwerke standen in zwei Schreibweisen** (`3D-Fab`/`3D-FAB`) — jetzt eine Zeile mit der häufigeren; behob nebenbei 688 React-Warnungen wegen doppelter Schlüssel

### v4.87.0 — der Assistent scrollt sich selbst, nicht die Seite (August 2026)

MINOR — Drei Meldungen aus dem Test am selben Panel: eine doppelte Scrollleiste rechts, deren äußere die ganze Seite wegscrollte; ein Eingabefeld, das zwei Zeilen zeigte und den Rest abschnitt; und vier Beispiel-Chips, die Fähigkeiten versprachen, die der Assistent noch nicht hat.

- **Die zweite Scrollleiste ist weg** — der Trefferliste fehlte `relative`, ihre absolut positionierten Nachfahren hingen deshalb am Seiten-Scroller des Shells statt an ihr; gemessen 10 px → 0 px äußere Leiste, innere unverändert ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Das Mausrad bleibt im Panel**: `overscroll-behavior: contain` an der Nachrichtenliste, und der Leerzustand ist selbst ein Scroll-Container statt gar keiner ([chat.css](src/plugins/chat/chat.css))
- **Das Eingabefeld wächst bis fünf Zeilen und ist danach ziehbar** — gemessen 111 px bei 5 Zeilen, ab der sechsten scrollt es intern; die gezogene Höhe wirkt als Mindesthöhe ([useAutoGrow.ts](src/core/hooks/useAutoGrow.ts), [autoGrowHoehe.ts](src/core/utils/autoGrowHoehe.ts))
- **Der Zeilendeckel steht einmal statt zweimal** — er wird aus der gerenderten Zeilenhöhe gerechnet; die zwei alten `200`-Konstanten meinten fünf Zeilen und waren neun ([Composer.tsx](src/plugins/chat/components/Composer.tsx))
- **Die vier Beispiel-Chips im Such-Panel entfallen** ([EmptyState.tsx](src/plugins/chat/components/EmptyState.tsx)); die kontextgebundenen Quick-Actions des Shell-Docks bleiben — die werden beantwortet

### v4.86.1 — Der Export nimmt den Stand vom Bildschirm (August 2026)

PATCH — Beide Exporte der Vorgangs-Regeln lasen `aktiveVersion`, während der Baum daneben den Entwurf zeigt. Bei ungesichertem Stand lieferten sie lautlos etwas anderes aus als das, worauf der Nutzer sah: „Phasen exportieren" schrieb den alten Schnitt, der Import am Zielort meldete korrekt Erfolg — und die Kuratierung kam trotzdem nicht an. Zwei Symptome, eine Wurzel.

- **Beide Exporte nehmen den Entwurf**, also den Stand auf dem Bildschirm ([useStatusCockpit.ts](src/plugins/status-cockpit/useStatusCockpit.ts))
- **Ungespeicherter Stand heißt `…-entwurf.json`** — die Fassungsnummer allein wäre eine Zusage, die der Inhalt nicht hält ([katalogExport.ts](src/plugins/status-cockpit/katalogExport.ts))
- **Zweiter, unabhängiger Grund**: wo niemand speichern darf, gäbe es sonst gar keinen Weg, den gesehenen Stand herauszubekommen ([status-achsen.md](docs/architecture/status-achsen.md))
- **Guard hält beide Griffe am Entwurf** und beide Dateinamen am einen Helfer ([katalogExport.test.ts](src/plugins/status-cockpit/__tests__/katalogExport.test.ts))

### v4.86.0 — die Frage-Suche zeigt, wie eine Frage aussieht (August 2026)

MINOR — Wer im Test auf „Suche mit: einer Frage" umschaltete, stand vor einem leeren Feld und musste selbst erraten, wie eine Frage aussehen darf, die diese Suche beantwortet. Der Reiter „Fragen" beantwortet genau das und blieb ungesehen. Dazu zwei Meldungen am selben Ablauf: der Hinweis unter dem Feld brach immer um, und Normen-Kürzel wie „DIN" fielen aus jedem Frageplan heraus.

- **Umschalten auf „einer Frage" öffnet den Reiter „Fragen"** — Wunsch mit `nonce`, der die gemerkte Reiterwahl NICHT überschreibt ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx), [SucheStartzustand.tsx](src/plugins/suche/SucheStartzustand.tsx))
- **Fünf Beispielfragen statt drei** — je eine Form, die ein Frageplan ausdrücken kann; Zeitraum und Bearbeitungsstand hatten bis dahin kein Beispiel ([StartFragen.tsx](src/plugins/suche/start/StartFragen.tsx))
- **Der Hinweis „Noch nicht gestellt …" ist einzeilig** — 149 statt 211 Zeichen; am gerenderten `<span>` gemessen, einzeilig bei 1000/1280/1600 px ([SuchSeite.tsx](src/plugins/suche/SuchSeite.tsx))
- **Normen-Kürzel kommen MIT Kontext statt gar nicht** („din en", „iso 9001", „din-norm"); `MIN_NADEL_LEN` bleibt bei 4, weil „din" sonst „bedingt" träfe ([frageplan.ts](src/core/services/search/frageplan.ts))
- **Panel-Geometrie zieht aus der Suchseite aus** ([useAssistentPanel.ts](src/plugins/suche/useAssistentPanel.ts)) — sie beantwortet eine andere Frage als der Suchlauf; `assistentPanel.ts` bleibt React-frei

### v4.85.7 — der Rueckweg nennt die Seite im Dativ (August 2026)

PATCH — Der Rückweg im Antrags-Detail setzte seit v4.85.2 einheitlich „Zurück zu <Seite>" — für die halbe Navigation falsches Deutsch („Zurück zu Suche"). Der Artikel hängt am Wort, nicht an einer Regel, die sich aus dem Namen raten ließe.

- **Je Seite die fertige Fügung im Dativ** („zur Suche", „zum Vorgangs-Board", „zu den Dokumenten"); ohne Eintrag bleibt es bei „zu <Name>", für Eigennamen wie „Home" die richtige Form ([rueckwegSatz.ts](src/core/nav/rueckwegSatz.ts))
- **Guard `rueckweg-satz-abdeckung`** hält die Tabelle an den Plugin-Namen: neue Seite ohne Fügung fällt auf, Fügung ohne Seite ebenso ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts))

### v4.85.6 — Ein Kuerzel steht einmal im Glossar (August 2026)

PATCH — Gemeldet als React-Warnung („two children with the same key, `kuerzel:VBE`"). Dahinter steckte kein Anzeige-Fehler, sondern ein bekannter Fehlstand der Fassung: `VBE` ist eines der vier kanonisch belegten Kürzel und stand trotzdem zusätzlich als `D_VBE` (Pitfall #44). Gemessen am echten Bestand traf das genau **1 von 505** Codes, und **0 von 30** To-do-Regeln fassen ihn an — die Folge war also latent. `statuswertZeilen` entdoppelte längst je Code; `kuerzelZeilen` hatte dieselbe Behandlung nie bekommen.

- **Ein Kürzel steht einmal im Glossar** — gezeigt wird die Zeile, die den WERT trägt (das kanonische Feld), also exakt die Kollisionsregel der Feld-Auflösung ([glossarZeilen.ts](src/plugins/glossar/glossarZeilen.ts))
- **Der Widerspruch wird benannt statt verschluckt**: Badge „Doppelt geführt" nennt die überzählige Spalte und verweist aufs Nachziehen im Cockpit ([KuerzelDetail.tsx](src/plugins/glossar/KuerzelDetail.tsx))
- **Auch ohne kanonische Zeile bleibt die Liste heil** — dann gewinnt die erste, und der Hinweis trägt die Auskunft
- **Belegt am echten Bestand**: 607 → 606 Einträge, 506 → 505 Kürzel, `window.__tf.fehler()` leer; die gewählte VBE-Zeile trägt 5.788 Vorgänge, die verdrängte wäre leer
- **Fünf Fälle festgenagelt**, inklusive „je Code genau eine Glossar-Id" ([glossarZeilen.test.ts](src/plugins/glossar/__tests__/glossarZeilen.test.ts))

### v4.85.5 — Phasen importieren steht neben Phasen exportieren (August 2026)

PATCH — Es gibt nur EINEN Import (die Datei sagt an ihrer Marke selbst, was sie ist), also stand neben „Phasen exportieren" bewusst kein Gegenstück. Der erste Nutzer suchte es prompt vergeblich. Ein Knopf ohne sichtbares Gegenstück schickt Monate später jemanden auf die Suche nach einer Funktion, die es nur unter anderem Namen gibt.

- **„Phasen importieren" steht als Paar neben „Phasen exportieren"** — neue `PhasenAustausch`-Komponente, die dieselbe `api.importieren()` ruft wie der Seitenkopf ([KatalogTab.tsx](src/plugins/status-cockpit/KatalogTab.tsx)); eine Weiche, zwei Beschriftungen
- Beide Knöpfe erklären im Titel, was mitreist und was am Zielort bleibt
- Hintergrund: [status-achsen.md](docs/architecture/status-achsen.md)

### v4.85.4 — Ein Verweis ins Leere ist keine Aussage (August 2026)

PATCH — „Nur Phasen übernehmen" (v4.79.0) brach an der ersten echten Fassung ab, auf die es angesetzt wurde: v21 führt fünf Phasen, aber drei Datums-Kürzel zeigen noch auf die entfernte `vollstaendigkeit`. Das Paket erklärte sich für in sich widersprüchlich — an einem Zustand, den die App überall sonst ausdrücklich trägt (`verwaisteZuordnungen`: gelesen wie „ohne Phase", nicht umgeschrieben).

- **Ein Verweis ins Leere reist nicht mit** — `bauePhasenPaket` überspringt verwaiste Zuordnungen, statt das Paket zu verwerfen ([phasen-paket.ts](src/core/status/phasen-paket.ts)); der Abbruch-Guard trifft jetzt nur noch von Hand verbogene Dateien
- **Was durch den neuen Zuschnitt im ZIEL verwaist, steht im Ergebnissatz** — am Ergebnis gezählt, nicht als Differenz ([katalogDriftAnsicht.ts](src/plugins/status-cockpit/katalogDriftAnsicht.ts))
- Am echten Katalog (v21 → v22): 10 Codes, 10 Kürzel, 22 Zieltage geändert, 5 danach verwaist, alle 509 Kürzel byte-gleich
- Hintergrund: [status-achsen.md](docs/architecture/status-achsen.md)

### v4.85.3 — QS und QS- sind zwei Kürzel, nicht eines (August 2026)

PATCH — Nachtrag zu `bed9bde0` (lag zwischen v4.81.0 und v4.82.0 ohne eigenen Block). Die Spalten-Auflösung schlüsselte über `normCode`, das `-`/`_` streift — richtig zum Vergleichen von Kürzel-Schreibweisen, falsch hier: im Fachsystem heißt `QS` „kaufm. QS erfolgt" und `QS-` „kaufm. QS zurück an AB". Der Kollisionsschutz warf dann eines von beiden hinaus, und `D_ARQ-`/`D_VQK-` — ohne eigene Spalte — griffen die des Geschwisters ab. Betroffen: `QS` (7 135 Export-Zeilen), `AQ4` (6 758), `VQK` (3 208), `ARQ` (1 260), `ABLQ` (821), app-weit ohne Wert.

- **Eigener `spaltenSchluessel`** (NFC + trim + lowercase, keine Satzzeichen) — die Unschärfe wurde nur für Groß-/Kleinschreibung gebraucht (`vb_phase` ↔ `VB_PHASE`), `normCode` bleibt an seinem Platz ([feld-aufloesung.ts](src/core/status/feld-aufloesung.ts))
- **Die Herkunft gehört in den Kollisions-Schlüssel** — `verbund_status` liest `status` aus dem Verbund-Record, das kanonische `status` aus dem TV-Record; kein Konflikt, trotzdem fiel es heraus ([feld-aufloesung.ts](src/core/status/feld-aufloesung.ts))
- **Derselbe Schlüssel bei „ist gemappt?"** — sonst antworten Projektion und Auflösung verschieden; 4 Felder galten fälschlich als gemappt ([kategorie-projektion.ts](src/core/status/kategorie-projektion.ts), [spalten/aufloesung.ts](src/core/spalten/aufloesung.ts))
- **Unaufgelöste Felder am Echtbestand 12 → 4**; die vier sind Import-Mappings auf denselben kanonischen Key (`D_LZX`/`D_ÄZX`, `D_LG`/`D_ÄG`, `D_XRN-`/`D_XRN+`, `D_YPM_A`/`D_XYPM_A`), kein Auflösungsfehler ([KATALOG-CODES.md](docs/status-system/KATALOG-CODES.md))
- **8 Regressionstests** (vor dem Fix 6 rot); der Seed-Test prüft Eindeutigkeit jetzt **je Herkunft** plus Gegenprobe „genau ein Key doppelt", damit die Lockerung keine Leerprüfung wird ([feld-aufloesung-kollision.test.ts](src/core/status/__tests__/feld-aufloesung-kollision.test.ts))

### v4.85.2 — der Rueckweg sagt, wohin er fuehrt (August 2026)

PATCH — Der Rückweg aus dem Antrags-Detail zeigte nur den Namen der Herkunftsseite („← Vorgangs-Board") und ließ den Pfeil die Aussage machen. Halbfett und auf Kante zum Titel darunter las er sich als Überschrift des Panels, nicht als Weg zurück.

- **Der Knopf sagt den ganzen Satz**: „Zurück zu Vorgangs-Board" statt „← Vorgangs-Board" — Herkunft liefert weiter nur den Namen, den Satz baut die Brotkrume ([detailRahmen.tsx](src/plugins/antraege/detailRahmen.tsx))
- **Normale Strichstärke statt halbfett** (der volle Satz trägt sich selbst) und **5 px Luft zum Titel darunter**, der bisher direkt anschloss ([detailRahmen.tsx](src/plugins/antraege/detailRahmen.tsx))

