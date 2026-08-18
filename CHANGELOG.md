# Changelog — TeamFlow Local App

Versionshistorie + Migrationsnotizen, chronologisch absteigend. **Append-only — nie umnummerieren oder löschen**; Überholtes mit „abgelöst durch …" markieren statt entfernen. Neue Einträge über `npm run version:bump -- <typ> "<Titel>" [--user]` (fügt oben ein Kompakt-Skeleton ein: max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile, Detail ins Themen-Doc; rotiert übergroße Blöcke ins Archiv) — Kopf nie manuell editieren. Bump-Regeln (MAJOR/MINOR/PATCH): [CLAUDE.md → Versionierung](CLAUDE.md). Aktuelle Architektur + Constraints: [CLAUDE.md](CLAUDE.md). Wiederkehrende Bug-Klassen: [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).


> ℹ️ Ältere Versionen (vor den unten gelisteten) im Archiv: **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)**.

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

### v4.85.1 — Der Status-Katalog kommt auch beim Kaltstart vom Share (August 2026)

PATCH — Gefragt wurde, ob eine frisch installierte PL die aktuellste Katalog-Fassung automatisch bekommt. Nein: `initStatusKatalog` lief als einziger Abgleich, und zwar **vor** dem Ordner-Picker — ohne Handle ging er leer aus, und `ladeAktiveVersion` schrieb daraufhin den Auslieferungs-Seed als kuratierte Fassung 1 fest. Betroffen war die ganze `MappingVersion`: Kürzel, ZAH-Phasen, Code→Phase-Schnitt und AB-Regeln. Nach einem echten Browser-Neustart traf es jede Installation, weil die FSAPI-Berechtigung unter `file://` wieder auf `prompt` steht.

- **Nachlauf, sobald der Share offen ist** — `synchronisiereKatalogNachGrant`, aufgerufen vor `runDataUpdate`, weil die List-View-Projektion ihre `kat_status`-Spalten aus der aktiven Fassung auflöst ([status/index.ts](src/core/status/index.ts), [App.tsx](src/core/App.tsx))
- **Lesen schreibt nichts mehr**: `ladeAktiveVersion` gibt den Seed zurück, statt ihn abzulegen; das Ablegen macht `sorgeFuerGespeicherteFassung` mit genau einem Aufrufer ([katalog-store.ts](src/core/status/katalog-store.ts), [useStatusCockpit.ts](src/plugins/status-cockpit/useStatusCockpit.ts))
- **Erst 4 KB Dateikopf, die Megabyte nur bei abweichender Nummer** — der Nachlauf entfällt, wenn der Startlauf die Datei schon hatte ([katalog-share.ts](src/core/status/katalog-share.ts))
- **Fünf Fälle abgesichert**, darunter „zieht die kuratierten ZAH-Phasen mit, nicht nur die Kürzel" ([katalog-nachlauf.test.ts](src/core/status/__tests__/katalog-nachlauf.test.ts))
- **Bug-Klasse 1, fünfter Mechanismus**: der Pre-Grant-Read schrieb einen Ersatzwert fest ([recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md), [status-system/README.md](docs/status-system/README.md))

### v4.85.0 — Das Lesezeichen lässt sich wieder ziehen (August 2026)

MINOR — Gemeldet: das Bookmarklet der KI-Bridge ließ sich nicht in die Chrome-Lesezeichenleiste ziehen (Verboten-Symbol beim Ablegen), danach war der Fehler nicht mehr reproduzierbar. Gemessen: bei zugeklappter Einrichtungs-Klappe stand der Anker mit `draggable="true"`, aber **`href=null`** in der Seite — ein `<a>` ohne `href` ist kein Link, Chrome hat nichts abzulegen. Weil `useCollapsedSection` den Aufgeklappt-Zustand merkt, traf das jeden Nutzer genau **einmal**: beim ersten Einrichten, also genau dann, wenn der Schritt sitzen muss.

- **Die Adresse kommt über eine Callback-Ref ins DOM** statt aus einem Mount-Effekt — der Anker steckt in einer `SettingsKlappe`, die ihre Kinder erst beim Aufklappen montiert ([VerbindungGruppe.tsx](src/plugins/einstellungen/ki/VerbindungGruppe.tsx))
- **Kopieren als Rückfallebene** neben dem Ziehen — in verwaltetem Chrome ist das Ablegen in der Leiste nicht überall erlaubt; ein Fehlschlag wird sichtbar statt still ([useKopierAktion.ts](src/core/hooks/useKopierAktion.ts))
- **Eingeschleppt mit v4.31**: derselbe Anker lag vorher — JSX byte-identisch — in einem `<details>`, und das hält seine Kinder montiert; nur der Behälter wechselte ([streamlit-bridge.md](docs/architecture/streamlit-bridge.md))
- **Guard `dom-attribut-per-callback-ref`** mit Selbsttest gegen die historische Zeile — die erste Fassung des Musters begann mit `\bref` und verfehlte ausgerechnet `linkRef.current` ([conventions-ui.test.ts](src/__tests__/conventions-ui.test.ts))
- **Bug-Klasse 23** „Mount-Effekt richtet einen Knoten ein, der erst später montiert" ([recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md))

### v4.84.0 — Das Bundesland wird verglichen, nicht durchsucht (August 2026)

MINOR — Gefragt wurde, warum `bl:SN` und `bl:Sachsen` verschieden viel finden — niemand kann wissen, in welcher Schreibweise der Export sein Land ablegt. Beim Nachmessen kam der schwerere Fehler heraus: `bl:Sachsen` lieferte 3 278 statt 2 742 Treffer, weil die am Wortanfang verankerte Nadel `" sachsen"` auch in `" sachsen anhalt st "` steckt — **536 Anträge aus Sachsen-Anhalt liefen als Sachsen mit**, ohne dass die Trefferzeile es verriet.

- **Das Bundesland wird verglichen statt durchsucht** — ein geschlossenes Vokabular aus 16 Werten hat abzählbare Werte, keine Textstellen ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts))
- **Kürzel und Name sind dieselbe Frage** — `bl:SN`, `bl:sn`, `bl:Sachsen`, `bl:sachsen` lösen alle auf `SN` auf ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts))
- **Sachsen-Anhalt zählt nicht mehr als Sachsen**: `bl:Sachsen` 3 278 → 2 742, `bl:Sachsen-Anhalt` 550 ([bundeslandSuche.test.ts](src/plugins/antraege/__tests__/bundeslandSuche.test.ts))
- **Halb Getipptes und fremde Werte fallen auf die verankerte Suche zurück** — `bl:sach` zeigt beim Tippen weiter beides ([suche-relevanz.md](docs/architecture/suche-relevanz.md))
- **Die Facetten-Zahl stimmt jetzt mit dem Klick überein** — die Vorschlagsliste versprach 3 278 und lieferte 3 278 aus zwei Ländern ([suche.md](docs/feedback-kontext/suche.md))

### v4.83.0 — Der Rückweg führt dorthin, wo man hergekommen ist (August 2026)

MINOR — Gemeldet: aus der Suche ins Detail und nicht zurück, Schließen landet in der Förderanträge-Tabelle, und der Board-Link „kommt ein Fehler". Gemessen: der Rückweg lag im `location.state` und wurde von **einem** von sieben Aufrufern gesetzt; das Board schickte die **Verbund-Nummer** in den Aktenzeichen-Slot (`#/antraege/ZDS26026` → „Antrag ZDS26026 nicht gefunden", kein Rückweg).

- **Herkunft app-weit statt pro Aufrufer** — die Navigation merkt die letzte Seite (Detail-Routen ausgenommen), das Detail bietet „← <Seite>"; `sessionStorage` trägt sie über ein Neuladen ([herkunft.ts](src/core/nav/herkunft.ts), [ui-muster.md](docs/architecture/ui-muster.md))
- **Ein Bauteil baut den Detail-Pfad** für alle sechs Aufrufer — der Board-Klick trifft jetzt die Verbund-Route ([detailPfad.ts](src/plugins/antraege/detailPfad.ts), [VorgangsBoardPage.tsx](src/plugins/vorgangs-board/VorgangsBoardPage.tsx))
- **Ein Verbund-Schlüssel im Antrags-Slot heilt**, statt in „nicht gefunden" zu enden — alte Lesezeichen und History bleiben brauchbar ([detailAufloesung.ts](src/plugins/antraege/detailAufloesung.ts))
- **Anfrage, Facetten und Frageplan überleben F5** — ohne sie war die Trefferliste nach einem Neuladen unerreichbar ([sitzungsAnfrage.ts](src/plugins/suche/sitzungsAnfrage.ts))
- **Der Rückweg ist als Brotkrume lesbar** (13,5 px, Primärfarbe, Hover-Fläche) statt als 12,5-px-Sekundärtext ([detailRahmen.tsx](src/plugins/antraege/detailRahmen.tsx))

### v4.82.0 — Ort und Bundesland sind zwei Suchfelder (August 2026)

MINOR — Gemeldet: `ort:` schlug Bundesländer vor, `bl:` schlug dieselben vor — beschriftet mit „Ort". Beide Präfixe zeigten auf **ein** Feld `standort`, und weil jeder Antrag ein Land trägt, die Orte sich aber auf 2 055 Werte verteilen, führten die 16 Ländernamen jede Ortsliste an. Daneben standen rohe Kürzel („SN" 1 508) — ein Mapping-Schaden der Quelle 7737.

- **Trefferfeld `bundesland` mit eigenem Präfix `bl:`, Etikett, Facette und Spalte** — `ort:` schlägt nur noch Städte vor ([trefferstelle.ts](src/core/services/search/trefferstelle.ts), [feldpraefix.ts](src/core/services/search/feldpraefix.ts), [suche-relevanz.md](docs/architecture/suche-relevanz.md))
- **Korpus trennt Ort und Land**, `bundeslandFelder()` liefert Klartext zum Anzeigen und Klartext+Kürzel zum Suchen — `bl:SN` findet weiter ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts))
- **„nur Ort, Bundesland & Wahlkreis" und „alle Felder"** führen das neue Feld mit ([suchbereich.ts](src/core/services/search/suchbereich.ts))
- **Stöbern zeigt Ort und Bundesland als eigene Spalten**, der Sonderfall „Ort & Bundesland" entfällt ([stoebern.ts](src/plugins/suche/start/stoebern.ts))
- **Mehrdeutige Schema-Schlüssel werden an keinen Korpus-Slot vergeben** — 7737 wirft `PLZ_AFS`/`ORT_AFS`/`BULAND_AFS` auf einen Schlüssel; die Basis-Aliasse bleiben unangetastet ([korpusFeldAufloesung.ts](src/plugins/antraege/services/korpusFeldAufloesung.ts))

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

