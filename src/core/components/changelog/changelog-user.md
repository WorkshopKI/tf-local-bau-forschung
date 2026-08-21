<!--
  Nutzer-Changelog (geglättete Fassung) — HAND-GEPFLEGT.

  Diese Datei ist die nutzerfreundliche Fassung des Changelogs, die das „Was ist
  neu?"-Modal (Klick auf die Versionsnummer unten in der Sidebar) anzeigt. Sie wird
  zusammen mit CHANGELOG.md gepflegt: pro neuer Version hier einen geglätteten
  `## vX.Y`-Abschnitt ergänzen (Nutzen statt Technik, kein Jargon).

  Format (kanonisch, neueste oben):
      ## v2.98 — 2026-06
      ### Neu
      - Kurzer, verständlicher Satz …
      ### Verbesserungen
      - …
      ### Bugfixes
      - …

  Historie ab v2.100 durchgängig geglättet. Ältere Versionen (< v2.100) leitet das
  Modal automatisch aus CHANGELOG.md ab.
-->

## v6.5 — 2026-08

### Verbesserungen
- **Beim Einrichten der internen KI gibt es nur noch einen Weg**: das Lesezeichen in die Lesezeichenleiste ziehen. Der „Kopieren"-Knopf daneben sah aus wie eine zweite, gleichwertige Möglichkeit und hat mehr gestiftet als geholfen.
- **„Status & Verlauf" ist schlanker geworden.** Zeitraum, zurückgenommene Termine und fehlende Kürzel-Angaben stehen jetzt direkt in der Überschrift — auch wenn der Bereich zugeklappt ist. Ein Klick auf die roten fehlenden Angaben klappt auf und zeigt gleich nur diese Zeilen.
- **Wie groß der Verlauf ist**, sagt das ⓘ neben dem Status: „17 Schritte · 39 Datumsangaben".
- **Der Chip „Alle" zeigt seine Anzahl**, damit die Zahlen der Reihe aufgehen.
- **Der Umschalter heißt „nach Datum | nach Phase"** — der Normalfall steht links, und beide Namen sagen, was links in der Randspalte steht.
- **Beide Ansichten sehen jetzt gleich aus**: gleiche Zeilenhöhe, gleiche Spalten. Beim Umschalten wechselt die Ordnung, nicht das ganze Bild.

## v6.4 — 2026-08

### Verbesserungen
- In „Änderungen der letzten Nacht" steht die Zahl der Änderungen jetzt näher am Namen: Die Namensspalte wird nur so breit wie der längste angezeigte Name. Links läuft eine feine Linie mit, die über die Teilvorhaben **eines Verbunds** durchgeht und dazwischen absetzt — so verliert das Auge die Zeile nicht.

### Bugfixes
- Im Tab der internen KI war zuletzt nicht mehr zu sehen, was die App gesendet hat und was zurückkam — der Chat blieb leer, obwohl alles lief. Frage, Antwort und Chatlänge stehen wieder da, und die Antwort wächst beim Schreiben mit.
- Nach einem Zurücksetzen blieb der alte Verlauf sichtbar stehen, obwohl er schon verworfen war. Jetzt räumt das Zurücksetzen auch die Anzeige.

### Hinweis
- Dafür bitte das Lesezeichen einmal neu ziehen: **Einstellungen → KI → Einrichtung**, es heißt jetzt `interne-KI v4`. Bis dahin funktioniert alles wie bisher — nur der Chat im KI-Tab bleibt leer.

## v6.3 — 2026-08

### Neu
- Eine Bedingung lässt sich mit einem Klick **in eine eigene Gruppe verpacken** — praktisch, wenn ein Meilenstein aus mehreren Gruppen bestehen soll.

### Verbesserungen
- Im Meilenstein-Editor steht zwischen den Bedingungen jetzt **„UND" bzw. „ODER"** — auch vor und hinter einer Gruppe. Damit ist zu sehen, dass eine Gruppe neben den Bedingungen steht und nicht in ihnen.
- Gruppen heißen **„Gruppe 1", „Gruppe 2"** und haben ihre Schalter im Kopf, an derselben Kante wie eine Bedingung.
- Beim **Ziehen** zeigen sich alle möglichen Ablagestellen. Auf einen Gruppenkasten gezogen, landet die Bedingung in dieser Gruppe.

### Bugfixes
- Die kleinen Schalter am rechten Rand einer Bedingung waren kaum zu sehen, und ein gesperrter Schalter sagte nicht, warum er gesperrt ist. Beides behoben.

## v6.2 — 2026-08

### Neu
- In „Änderungen der letzten Nacht" ist „… und 10 weitere Vorgänge" jetzt ein Link: Ein Klick zeigt zehn weitere; sind einmal 20 Zeilen zu sehen, heißt er „Alle anzeigen". „Weniger anzeigen" führt zurück.
- Geht es um einen Statuswechsel, steht der Wechsel selbst oben in der Erklärung („Gutachten fertig → bewilligt") — nicht mehr als Nachsatz hinter dem Datum.

### Verbesserungen
- Die Zeilen der Karte sind in Spalten gesetzt: Bezeichnung, Anzahl, dann die Kürzel — untereinander in einer Flucht, statt je nach Länge des Namens versetzt.

### Bugfixes
- Die Beschreibung eines Kürzels gilt jetzt für die Projektform des Vorgangs. `D_AB` hieß in der Karte immer „Bewilligungsempfehlung durch Haushaltsbeauftragte" — das ist die Bedeutung bei Dienstleistungen; bei FuE-Vorgängen heißt dasselbe Kürzel „bewilligungsreif/Akte an Euronorm".
- `D_AAE`, `D_ABB` und `D_AZ1_1` standen ohne Beschreibung da. Jetzt trägt jedes Kürzel der Karte eine.

## v6.1 — 2026-08

### Neu
- In „Änderungen der letzten Nacht" erklärt sich jedes Kürzel selbst: Zeigen Sie mit der Maus auf `D_AB` oder `STATUS_TV`, und Sie sehen den Klartext dazu, wann es gesetzt wurde und welcher Wert vorher stand. Auch das „+2" verrät, welche Kürzel es verbirgt.
- Die Tilde `~` am rechten Rand hat jetzt eine Erklärung: Sie heißt, dass zwischen zwei Exporten mehrere Tage lagen — der genaue Tag der Änderung ist dann nicht belegt, nur der Zeitraum.
- Die Karte lässt sich einstellen (⋯ → Widget-Einstellungen): Zeitraum (letzter Lauf oder die letzten 3, 7, 14 Tage), wie viele Vorgänge und Kürzel je Zeile, Reihenfolge, welche Vorgänge, und ob die erklärenden Fußzeilen mitlaufen.

### Verbesserungen
- Die Zeilen der Karte sind deutlich flacher — bei gleicher Höhe passen rund ein Drittel mehr Vorgänge hinein, ohne zu scrollen.

## v6.0 — 2026-08

### Bitte einmal neu einrichten
- Das Lesezeichen für die interne KI heißt jetzt **„interne-KI v2"** und muss einmal neu in die Lesezeichenleiste gezogen werden: Einstellungen → KI → Einrichtung. Das alte darf danach weg. Solange das alte aktiv ist, meldet die App das sichtbar.

### Neu
- Die Modellwahl heißt jetzt **Standard** und **Stark** statt der technischen Modellnamen. Welches Modell dahintersteht, zeigt die App daneben an — sie liest es von der KI-Seite ab. Stellt die interne KI auf ein neues Modell um, stimmt die Anzeige weiterhin.
- Bietet die interne KI ein Modell an, das die App noch nicht kennt, steht das unter der Auswahl. Die App arbeitet normal weiter und lernt dessen Kontextfenster beim ersten Lauf.

### Verbesserungen
- Ein Modellwechsel auf Seiten der internen KI legt große Anträge nicht mehr lahm: die App wählt weiter sinnvoll, statt den Lauf abzubrechen.
### Verbesserungen
<!-- - … -->
### Bugfixes
<!-- - … -->

## v5.3 — 2026-08

### Neu
- Das Feld einer Meilenstein-Bedingung wählst du jetzt in einer kleinen Tabelle: tippen, um zu suchen, Spaltenköpfe zum Sortieren, Pfeiltasten und Enter zum Übernehmen. Vorher standen dort mehrere hundert Kürzel in einer Liste ohne Suche.
- Passt die Bezeichnung des Meilensteins zu vorhandenen Spalten, stehen diese oben als Vorschlag — mit dem Wort, das darauf hindeutet. Hat ein Meilenstein noch gar keine Bedingung, kannst du den Vorschlag mit einem Klick übernehmen. Von selbst gesetzt wird nie etwas.
- Bedingungen und Gruppen lassen sich nachträglich umhängen: hoch, runter, in eine Gruppe hinein, wieder heraus — oder am Griff an die gewünschte Stelle ziehen.

### Verbesserungen
- In der zugeklappten Liste steht jetzt neben jedem Meilenstein, woran er hängt: die Bedingung in Kurzform, für welche Antragstypen er gilt, woher der Ist-Termin kommt und wie viele Unter-Meilensteine er hat. Man muss nicht mehr jeden einzeln aufklappen.
- Der Regel-Bereich braucht weniger Höhe: die Chips sind flacher, die Beschriftungen stehen auf einer Kante. Zwei Meilensteine passen damit eher nebeneinander.
- „+ Gruppe" steht jetzt oben neben „ALLE müssen zutreffen" — dort, wo es hingehört. Unten in der eingerückten Liste las es sich, als lege es eine Untergruppe an.

### Bugfixes
- Spaltennamen, die in der Beschriftungs-Tabelle einen Zeilenumbruch enthalten, zerrissen die Zeile („Antrags / eingang"). Sie werden jetzt einzeilig angezeigt.

## v5.2 — 2026-08

### Neu
- Eigene Tickets lassen sich direkt auf dem Board ergänzen: ein Symbol auf deiner Karte öffnet ein kleines Schreibfeld — die Detailansicht bleibt zu.
- Auch im Feedback-Fenster unten rechts kannst du unter „Mein Feedback" jetzt etwas nachtragen, statt dafür aufs Board zu wechseln.

### Verbesserungen
- „Als Ergänzung" steht am eigenen Ticket jetzt allen offen. Wer selbst Tickets verwaltet, konnte sein eigenes bisher nicht als Ersteller ergänzen.
- Die Einträge im `⋯`-Menü führen direkt zum passenden Feld: „Ergänzung anhängen" schreibt eine Ergänzung, „Rückfrage" eine Rückfrage — ohne dass man den richtigen Knopf noch suchen muss.

## v5.1 — 2026-08

### Neu
- **Sie können das Modell der internen KI wählen**: gpt-oss-120b (schneller) oder Qwen3.6-35B (deutlich größeres Kontextfenster). Die Einstellung finden Sie unter Einstellungen → KI → Antwortverhalten; sie gilt für alle KI-Läufe.
- **Große Dokumente wechseln von selbst**: Passt ein Antrag nicht in das gewählte Fenster, führt die App diesen einen Lauf auf Qwen3.6-35B aus und sagt Ihnen das. Sie müssen nichts umstellen.

### Verbesserungen
- Lange Vorhabensbeschreibungen werden erst dann gekürzt, wenn auch das größte Fenster nicht reicht — vorher wurde schon gekürzt, obwohl daneben ein viermal größeres Modell bereitstand.
- Das Lesezeichen für die interne KI heißt jetzt **„interne-KI v1"**. So sehen Sie in Ihrer Lesezeichenleiste auf einen Blick, ob Sie die aktuelle Fassung haben.
- Der „Agentische Chat" erscheint in der Auswahl als gesperrt, mit Begründung — er bringt eigenen Kontext mit, und den stellt diese App bewusst selbst zusammen.

## v5.0 — 2026-08

### Bitte einmal erledigen
- Die interne KI hat eine neue Oberfläche bekommen. **Bitte ziehen Sie das Lesezeichen neu** (Einstellungen → KI → Einrichtung) und klicken Sie es im KI-Tab einmal an. Ohne das kommen keine Antworten mehr an — die App weist Sie darauf hin, solange das alte Lesezeichen läuft.

### Bugfixes
- Antworten der internen KI kamen seit dem Umbau ihrer Oberfläche nicht mehr zurück. Die Verbindung liest die Antwort jetzt direkt aus, statt sie aus der Seite abzulesen.
- Lange Antworten brechen nicht mehr vorzeitig ab: Die interne KI meldet jetzt selbst, wann sie fertig ist.

## v4.136 — 2026-08

### Bugfixes
- Unter **„Meine Anträge"** stand bei vielen Vorgängen weiter „Gutachten freigeben", obwohl das Gutachten längst in der QS lag. Der Grund: für die Rolle **FB** trifft keine der hinterlegten Regeln zu — sie sind alle an die AB oder die QS adressiert —, und dann sprang die alte Formel ein, die nur den Status kennt. Jetzt steht dort, was tatsächlich läuft und wer am Zug ist: „in QS · wartet auf QS", „GA schreiben · liegt bei AB". Dasselbe in den Kanban-Karten und in der Spalte „Status und nächster Schritt".

### Verbesserungen
- Wo eine Aufgabe aus dem Regelsatz einer **anderen Rolle** stammt, sagt die Karte das jetzt ausdrücklich („Aufgabe · Regelsatz AB · nicht FB") — statt sie wie die eigene aussehen zu lassen. Was wirklich Ihre Aufgabe ist, erkennen Sie weiterhin an der Zeile daneben: „liegt bei FB".

## v4.135 — 2026-08

### Neu
- Im Reiter „Suchsprache" steht jetzt auch das **Fragezeichen**: `?` steht für genau ein Zeichen, `16KN0830?1` findet alle Teilvorhaben, bei denen eine Stelle wechselt. Die Suche konnte das schon länger, erklärt hat es bisher nichts. Der Stern daneben sagt jetzt, was er tut — `mob*spec` steht für beliebig viele Zeichen, auch für keines.
- Neuer Abschnitt **„Alle Felder — vor dem Doppelpunkt"**: alle dreizehn Felder, die man vor den Doppelpunkt schreiben kann, mit einem Beispiel zum Anklicken, der Bedeutung (`ast:` = Einrichtung, `bl:` = Bundesland) und dem Spaltennamen der Fördertabelle daneben (`ORG_AST`, `VB_TITEL`, …). Vorher stand dort nur eine Liste von Abkürzungen ohne Erklärung.

### Verbesserungen
- Die Zahl am Reiter „Suchsprache" stimmt wieder mit dem überein, was darunter steht.

## v4.134 — 2026-08

### Verbesserungen
- **Die Kanban-Bahn „Wartet auf Antragsteller" heißt jetzt „Nachforderung läuft".** Sie enthält genau einen Status — „NF gestellt". Wer wegen einer versandten Ablehnung auf den Antragsteller wartet, steht weiterhin unter „Zu entscheiden"; wer gerade wartet, sagt Ihnen die Zeile selbst. Der neue Name gilt auch in den Reitern und Filtern der Förderanträge.
- **„QS-Freigaben offen" heißt jetzt „Meine Entwürfe in dieser App".** Die Karte zählt nur, was Sie in der App entworfen und noch nicht freigegeben haben — nicht die fachliche QS. Die steht in den Kürzeln und wird von „Meine Anträge" und dem Vorgangs-Board gesagt. Ihr eigener Entwurf verschwindet nicht mehr, wenn er an einem fremden Vorgang hängt.
- **„Änderungen der letzten Nacht" zeigt nur noch Ihre Vorgänge**, eine Zeile je Antrag mit Akronym, und sagt darunter, wie viele Änderungen andere betrafen. Die Karte steht jetzt unten in ihrer Spalte.
- **Hat der jüngste Import nichts geändert, zeigt die Karte den letzten Lauf mit Änderungen** und sagt dazu, dass sie das tut — statt „nichts geändert" zu melden und die Nacht davor zu verbergen.
- **Das Kanban sagt, was es zählt**: „Verbünde als eine Karte", und der Tooltip an der Zahl nennt die Kategorien, die keine Bahn haben.

### Bugfixes
- **Das Fristen-Widget meldete Meilensteine als gerissen, die gar nicht erfüllbar sind.** Vier Meilensteine des Plans tragen keine Bedingung — sie galten ab ihrer Soll-Woche für immer als überfällig und stellten den Großteil aller Einträge. Sie werden jetzt nicht mehr bewertet, und die Fußzeile sagt, wie viele es sind; im Meilenstein-Editor tragen sie die Marke „ohne Bedingung".
- **Die Fristen-Liste zeigte nur Meilensteine**, obwohl die Kopfzeile auch Zieltage zählte. Jetzt kommen beide Quellen vor.

## v4.133 — 2026-08

### Verbesserungen
- **Die Karte „Registry-Änderungen" auf der Startseite heißt jetzt „Zuletzt geändert".** „Registry" war ein Wort aus dem Maschinenraum, das sonst nirgends in der App vorkommt.
- **Ein Klick auf eine Zeile öffnet genau diesen Eintrag** — den Skill oder die Qualitätsregel, auf die Sie geklickt haben. Bisher landete man in der Skills-Liste und musste den Eintrag noch einmal suchen.
- **Die Skill-Verwaltung hat einen Rückweg.** Über dem Titel steht „← Zurück zu Home" (oder zu der Seite, von der Sie kamen). Das X am Editor bedeutet weiterhin etwas anderes: es schließt nur den Editor.

## v4.132 — 2026-08

### Verbesserungen
- **Die Startseite sagt jetzt dasselbe wie das Vorgangs-Board.** Beide lesen dieselben Regeln über die gesetzten Kürzel. Wo bisher „Gutachten freigeben" stand, obwohl das Kürzel AT4 längst gesetzt war, steht jetzt „in QS — wartet auf QS".
- **Jede Zeile sagt, wer am Zug ist**: „liegt bei AB", „wartet auf QS", „wartet auf Antragsteller". Der Antrag bleibt in Ihrer Liste, die Aufgabe gehört aber sichtbar jemand anderem.
- Dieselbe Aussage steht in den Kanban-Karten und in der Spalte „Status und nächster Schritt" der Förderanträge-Liste.
- Bei einem Verbund steht dabei, wenn die Aufgabe nur einen Teil der Teilvorhaben betrifft („3 von 4 TV").
- **Wer seine Rolle wählt, sieht seine eigene Arbeit.** Bisher zeigte das Vorgangs-Board einem FB entweder die Aufgaben des AB oder gar nichts. Die Einstellungen sagen jetzt auch, welche Rolle die Daten nahelegen.

### Bugfixes
- Vorgänge mit Schlussvermerk zählen nicht mehr als offen und stehen nicht mehr oben in der Liste, auch wenn ihr Status im Fachsystem noch etwas anderes sagt. Sie bleiben sichtbar — mit dem Hinweis, dass sich Status und Kürzel widersprechen.
- Die Chips im Vorgangs-Board heißen nur dann „Meine Aufgaben", wenn eine Rolle gewählt ist. Ohne Rollenwahl zählen sie, wofür irgendjemand im Haus zuständig ist.

## v4.131 — 2026-08

### Verbesserungen
- „Meine Anträge" sortiert jetzt genauso wie die Förderanträge-Liste. Vorgänge, für die keine Frist mehr läuft — etwa nach einer Ablehnung —, rechnet die Startseite nicht länger als überfällig hoch und stellt sie nicht mehr nach oben.
- Zahlen sagen, wenn sie nur einen Ausschnitt meinen: das Kanban nennt neben „573 Vorgänge" auch, wie viele in Kategorien liegen, für die keine Bahn eingerichtet ist. Ebenso die Feedback-Neuigkeiten und die Registry-Änderungen.
- Verbünde sind in „Meine Anträge" als solche erkennbar („2 TV"), und der Zähler erklärt, warum die Liste danach mehr Zeilen zeigt als die Karte Einträge.

### Bugfixes
- Ein am Spaltenkopf gesetzter Filter erscheint jetzt als Chip über der Tabelle. Bisher konnte er unbemerkt stehen bleiben und eine von der Startseite zugesagte Trefferzahl auf wenige Zeilen zusammenschmelzen lassen.
- „+ N weitere" einer Kanban-Bahn öffnet die Liste passend gefiltert, statt in der vollständigen Liste zu landen.
- „Rückgängig" nimmt nur noch das zurück, was in der Meldung steht. Ein danach ein- oder ausgeklapptes Widget bleibt, wie es ist. Außerdem erscheint die Meldung nicht mehr erneut, wenn man die Startseite kurz verlässt und später zurückkehrt.
- Der Hinweis unter den Widget-Einstellungen sagt jetzt korrekt „nur für Sie — nicht geteilt": Ihre Startseiten-Anordnung liegt auch in Ihrem persönlichen Ordner, damit sie auf einem anderen Rechner wieder da ist.
- „Alle Einstellungen öffnen" führt wieder auf die vollständigen Einstellungen statt in den Widget-Abschnitt.

## v4.130 — 2026-08

### Neu
- In der Skill-Verwaltung gibt es den Knopf „Paket…": er packt Skills, Regeln, Workflows und Textbausteine in eine Datei, mit der sich ein ganzer gepflegter Stand auf einen anderen Daten-Share bringen lässt — statt dort alles von Hand neu anzulegen.
- Beim Einspielen zeigt eine Vorschau je Eintrag, ob er neu ist, sich geändert hat oder unverändert bleibt; Sie entscheiden je Zeile, was übernommen wird. Geändert bedeutet nie „weg": der bisherige Stand bleibt als Fassung erhalten und lässt sich zurückholen.

## v4.129 — 2026-08

### Neu
- Im Feedback-Board gibt es die Sicht „Meine Tickets" jetzt auch für das Team — die Glocke springt dorthin, statt in den Arbeitsvorrat.
- Archivierte Tickets bekommen beim Einblenden eine eigene Spalte und eine eigene Filterzeile.
### Verbesserungen
- Die Vorschau „Nutzer-Sicht" zeigt jetzt wirklich, was beim Melder ankommt: Verwaltungsfelder, Massenauswahl und das Zahnrad sind dort nicht mehr bedienbar.
- Die Zahlen an den Filtern gelten neben der Suche und den anderen Filtern — was sie versprechen, kommt beim Klick auch.
- Ein erreichtes Sponsoring-Ziel sperrt das Zurückziehen der eigenen Punkte nicht mehr; „N Sponsoren" zählt Personen statt Einträge.
### Bugfixes
- Escape im Screenshot-Editor schließt nur noch diesen — Typ, Text und Bild bleiben stehen.
- Scheitert das Absenden, steht der Grund im Fenster; ein zweiter Versuch legt keine zweite Kopie mehr an.
- Ein halb getippter Text in „Weitere Verwaltung" wird nicht mehr überschrieben, wenn im Hintergrund neu geladen wird.
- Ein kaputtes Bild verwirft nicht mehr den ganzen eingefügten Stapel.
- Manuell angelegte FAQ-Einträge und über die Inbox genehmigte Tickets landen vollständig beim Team.

## v4.128 — 2026-08

### Neu
<!-- - Kurzer, verständlicher Satz (nur bei nutzersichtbaren Änderungen) -->
### Verbesserungen
- Auf der Seite „Suche & Index" heißen zwei Dinge „Index". Die Statusanzeige sagt jetzt, welches sie meint: **„Kein Dokumenten-Index"** bezieht sich auf die eingelesenen Dokumente, nicht auf die Vektoren der Ähnlichkeitssuche darunter.
- Die Vektor-Karte trennt zwei Aussagen, die sich vorher widersprachen: Der Korpus kann mit dem Datenspeicher übereinstimmen und trotzdem Vorhaben von diesem Rechner nicht abdecken — dann steht dort, wie viele es sind und warum.
- Nach einem Lauf steht in der Karte, wie viele Vorhaben er eingebettet und wie viele er übersprungen hat.
- Ein Netzwerk steht in der Vorschlagsliste jetzt **einmal**, nicht einmal je Schreibweise. „CannabisNET" und „CANNABIS-NET" waren zwei Zeilen mit derselben Trefferzahl und sahen aus wie zwei verschiedene Mengen — es ist dieselbe. Gezeigt wird die Schreibweise, die im Bestand am häufigsten vorkommt.
- Der Klick auf einen Netzwerknamen findet jetzt auch dann alle Schreibweisen, wenn der Name ein Leerzeichen trägt. Bisher lieferte „NaFa Tech" 9 Treffer und „NaFa-Tech" 29, obwohl beide dasselbe Netzwerk meinen.
### Bugfixes
<!-- - … -->

## v4.127 — 2026-08

### Neu
- Die Vektoren der Ähnlichkeitssuche werden jetzt in der Datenpflege unter „Suche & Index" gepflegt — dort stehen Neuaufbau, Holen vom Datenspeicher und Nachziehen an einer Stelle. Im Auslastungs-Modul bleibt die Statusanzeige.
- Ein Rechner kann neue CSV-Daten künftig automatisch nachziehen lassen (Schalter in derselben Karte, gilt nur für diesen Rechner).

### Verbesserungen
- Findet die Suche nichts, weil die eingestellte Richtlinien-Auswahl die Treffer wegblendet, steht der Ausweg jetzt gleich unter „Keine Treffer" — mit der Zahl der ausgeblendeten Treffer und einem Knopf „Alle Richtlinien einbeziehen". Vorher war er eine Zeile unter mehreren und wurde leicht übersehen.
- Die Zeile unter dem Suchfeld sagt jetzt auch, wenn die Vektoren aus einer überholten Textfassung stammen — bis dahin war genau das unsichtbar, weil die Anzahl vollständig aussah.
- Sie verweist außerdem nur noch auf Wege, die es in der eigenen Fassung wirklich gibt; vorher nannte sie einen Knopf, den viele gar nicht sehen konnten.

### Bugfixes
- Beim Start wird ein veralteter Vektor-Bestand nicht mehr vom Datenspeicher übernommen, nur weil er mehr Einträge hat; verglichen wird jetzt, aus welcher Fassung die Vektoren stammen.
- „Nachziehen" berücksichtigt jetzt Vorhaben, deren Kurzbeschreibung erst nachträglich im Wochen-Export ankam — vorher blieben sie dauerhaft auf ihrem alten Vektor.

## v4.126 — 2026-08

### Neu
- Im Reiter „Begleitung" steht jetzt eine echte Frist: sechs Monate ab Eingang des Verwendungsnachweises. 344 Vorgänge haben damit erstmals eine Uhr — 227 davon laufen normal, 117 sind überfällig.
- Die Bemerkung aus der Spalte T_HINT erscheint im Zuweisungscockpit der Auslastung. 2 420 Verbünde tragen eine.

### Verbesserungen
- Die Bearbeitungsfrist rechnet wieder ab dem wirksamen Eingang — dem späteren aus Antragseingang und „alle Anträge da". Tabelle, Vorgangs-Board und aufgeklappter Bereich sagen damit dasselbe.
- Der Tooltip über der Frist-Spalte nennt wieder alle drei Felder, aus denen die Zelle rechnet.

### Bugfixes
- „Kein Verwendungsnachweis eingegangen" stand über 344 Vorgängen, bei denen er längst eingegangen war.
- 12 Verbünde galten als überfällig, obwohl ihre Frist noch läuft: gerechnet wurde ab dem ersten statt ab dem letzten eingegangenen Antrag.

### Hinweis
- Beim ersten Start nach dem Update baut die App die Anträge-Liste einmalig neu auf (ein paar Sekunden, mit Fortschrittsanzeige).

## v4.125 — 2026-08

### Neu
- **Trennzeichen im Namen sind egal.** Bindestrich, Leerzeichen, Punkt und Klammer zählen bei Akronym und Netzwerkname nicht mehr mit: `cannabisnet` findet jetzt alle 60 Anträge des Netzwerks „Cannabis-Net" statt einem, `nafatech` findet „NaFa-Tech" und „NaFa Tech" (29 statt keinem). Sie müssen dafür nichts tippen und nichts einstellen — es gilt von selbst, und die Fundstelle wird als ein Stück hervorgehoben.

### Verbesserungen
- Der Reiter **Suchsprache** im Startzustand zeigt eine Zeile mehr, die das vormacht: ein Klick auf `nafatech` führt die Suche gleich aus.

## v4.124 — 2026-08

### Neu
- **Die Änderungen eines Feldes lassen sich wieder aufrufen.** In „Alle Felder" steht hinter jedem Feld, das sich seit dem Nullpunkt geändert hat, ein kleines `↻ N` — ein Klick zeigt, wann sich der Wert wie geändert hat. Der Knopf war da, aber er ist nie erschienen.

### Verbesserungen
- **Der Wiedereinreicher-Hinweis erscheint.** 1 452 Anträge tragen den Vermerk, dass dasselbe Vorhaben schon einmal eingereicht wurde — er stand bisher in keiner einzigen Ansicht. Jetzt steht er rot hinter dem Verbund-Titel, samt den Kürzeln der damaligen Bearbeitung.
- **„Auf einen Blick" ist nicht mehr halb leer.** Die Kacheln „beantragte Kosten" und „Laufzeit" zeigten in jedem Verbund „—", obwohl die Werte im Datensatz stehen. Dasselbe gilt für „Zuwendung" in der Teilvorhaben-Liste: dort stand „wird noch ergänzt".
- **Die Suche findet frisch importierte Anträge sofort.** Bisher durchsuchte das Suchfeld nach einer Datenaktualisierung bis zum nächsten Neuladen den alten Stand. Die Anwendungsdomänen (z. B. „Baugewerbe") sind jetzt ebenfalls durchsuchbar.

### Bugfixes
- **Uhren und Zahlen sagen, was sie messen.** Die Nachforderungs-Karte zeigte eine Frist, wo die Liste daneben „angehalten" sagt; die Chronik hängte an jeden zweiten Eintrag denselben Text noch einmal an; Zähler und Chips nannten mal Kürzel, mal Teilvorhaben.
- **Nichts wandert mehr von einem Vorhaben zum nächsten.** Beim Wechsel des Verbunds blieben Bescheid-Entwürfe, die zuletzt gesendeten Prompts und die Werkbank-Auswahl des vorigen stehen — jetzt nicht mehr.
- **Ein leerer Entwurf gilt nicht als freigabereif**, ein Punkt ohne Textbaustein wird im Entwurf markiert statt weggelassen, und ein Klick auf 👍 speichert kein 👎 mehr.
- **Escape schließt den aufgeklappten Bereich** einer Tabellenzeile jetzt auch direkt nach dem Öffnen.

## v4.123 — 2026-08

### Neu
- **Ein `*` im Suchwort steht für beliebig viele Zeichen.** Wenn ein Name im Bestand mal so und mal anders geschrieben ist, findet `mob*spec` beide Schreibweisen auf einmal — auch die 3 Anträge, in denen „mobiInspec" als „mobilnspec" verunglückt ist. Man muss dafür nicht wissen, wie viele Zeichen abweichen. Es geht überall: `fkz:16KN0830*` genauso wie ein Wort mitten in der Anfrage.
- **Im Startzustand unter „Suchsprache" steht das jetzt auch drin** — als anklickbares Beispiel, das die Suche gleich vormacht. Das Fragezeichen `?` (für genau ein Zeichen) gibt es schon länger, es stand nur nirgends.

### Verbesserungen
- **Bei einer Suche mit Platzhalter ist die Fundstelle im Treffer markiert.** Bisher blieb ausgerechnet dort alles blass, wo man am ehesten wissen möchte, warum die Zeile kam.

### Bugfixes
<!-- - … -->

## v4.122 — 2026-08

### Bugfixes
- **Die Zahlen in der Filterleiste meinen jetzt die Liste darunter.** Im Reiter „Antragsphase" bot die Leiste zum Beispiel „Richtlinie 36 (1.373)" an — der Klick darauf lieferte null Treffer. Gezählt wird ab sofort dieselbe Menge, die auch angezeigt wird: die aktive Sicht und der Betrachtungsbereich zählen mit. Und wenn doch einmal nichts übrig bleibt, sagt die leere Fläche, welche Einschränkungen gerade gelten.
- **„Frist (kürzeste)" sortiert nach der Frist, die in der Spalte steht.** Ganz oben standen bisher Vorgänge, deren Uhr längst angehalten ist — daneben zeigte die Frist-Spalte „angehalten". Jetzt stehen die dringenden oben und die angehaltenen am Ende, genau wie beim Klick auf den Spaltenkopf.
- **Auswahl und Export nehmen, was wirklich dasteht.** Wer über einen Spaltenkopf-Trichter filterte oder die beendeten Anträge ausblendete, bekam trotzdem die volle Liste exportiert. Auch die schmale Antragsspalte neben einem geöffneten Antrag zeigt nun dieselbe Menge wie die Tabelle davor. Selbst angelegte Spalten fehlen im Export nicht mehr.
- **Ein getipptes Zeichen im Frage-Modus blendet die beendeten Anträge nicht mehr ein.** Bisher genügte ein Buchstabe — noch ohne abgeschickte Frage —, um die ausgeblendete Hälfte zurück in die Liste zu holen.
- **„Gruppierung: Keine" lässt sich im Reiter „Fristen" wählen.** Der Schalter sprang zurück, die Bänder blieben stehen.
- **Spaltenköpfe erklären ihre Herkunft richtig.** Über der gut gefüllten Spalte „Ort AST" stand „In diesem Programm ist dafür keine Spalte gemappt — die Zelle bleibt leer". Umgekehrt sagen „Branche" und „Fördergeber" jetzt, warum sie leer sind, und die Frist-Hilfe nennt nur noch die Felder, mit denen wirklich gerechnet wird.
- **Nachladen beim Scrollen bleibt an.** Nach einem Spaltenkopf-Filter blieb die Tabelle bei 60 Zeilen stehen, mit dauerhaftem „Lade weitere Einträge …".

## v4.121 — 2026-08

### Bugfixes
- **Gemessene Zahlen bleiben bei ihrem Regelsatz.** Wer nach einem Messlauf von AB auf FB umschaltete, sah die AB-Zahlen unter der Überschrift „Regelsatz FB" — dazu die Meldung, die Regeln seien geändert worden, obwohl nichts geändert war. Jetzt steht dort, was gemessen wurde, und die Zahlen des anderen Satzes werden gar nicht erst gezeigt. Dasselbe gilt für die Probe am Einzelfall.
- **Die Zahl am Reiter zählt, was der Reiter zeigt.** „AB 26" stand über einer Liste, die bis 30 durchnummeriert war; „FB 0" über vier Zeilen.
- **Pfeile, die nichts bewegen, gibt es nicht mehr.** Eine Regel im FB-Satz bekam eine Nummer aus der AB-Reihenfolge und zwei aktive Pfeile — verschoben wurde sie dadurch nie. Sperren aus einem anderen Satz stehen jetzt vorn und tragen keine Nummer.
- **„Regel erzeugen" sagt, wenn die Regel schon steht.** Der zweite Klick auf dieselbe Zeile legte nichts an und meldete auch nichts.
- **Die Klärfragen sagen ehrlich, was fehlt.** Über einer Liste mit einer einzigen Frage stand „243 ruhende Kürzel ausgelassen", obwohl keine Frage weggefallen war. Jetzt wird in Fragen gezählt — und wo die Liste nur die häufigsten führt, steht das dabei, auch in der Arbeitsmappe.

## v4.120 — 2026-08

### Bugfixes
- **„Ebenen" zeigt jetzt Ihren Entwurf.** Wer im Baum einen Statuswert umhängte, sah im Reiter daneben weiter die alten Zahlen — zwei Seiten desselben Bildschirms widersprachen sich, bis gespeichert wurde.
- **„Neu berechnen" verwirft Ihre Arbeit nicht mehr.** Der Knopf frischt den Bestand auf; ungespeicherte Änderungen am Katalog blieben dabei bisher auf der Strecke, ohne Rückfrage und ohne Meldung.
- **Der Lösch-Dialog schlug den Schritt vor, den er löscht.** Auf dem Bildschirm stand ein anderer Verfahrensschritt als der, an den die Statuswerte tatsächlich gingen.
- **Ordner „Nicht zugeordnet" lässt sich nicht mehr entfernen.** Danach standen 340 Kürzel in keiner Liste mehr — ohne dass irgendwo stand, dass sie fehlen.
- **Beim Tippen bleibt die Zeile stehen.** Kurzform-Feld und Reihenfolge im Ordner-Editor sprangen mitten im Wort weg bzw. schrieben beim Leeren eine 0.

### Verbesserungen
- **Zahlen sagen, was sie zählen.** Der Katalog nennt durchgängig 30 Statuswerte statt einmal 30 und einmal 60; am Verfahrensschritt steht „Vorkommen" statt „Vorgänge"; Filter-Chips tragen ihre Trefferzahl und sind ausgegraut, wenn sie nichts treffen.
- **Die Suche im Katalog halbiert keine Zeile mehr.** Ein Suchwort wie „verbund" zeigte vorher nur noch die halben Vorkommen und die halbe Ebene.
- **Die Arbeitsliste sagt jetzt „folgt dem Code".** Der Hinweis „folgt dem Verfahrensschritt" lud zu einem Umhängen ein, das an ihr nichts ändert.

## v4.119 — 2026-08

### Bugfixes
- **Alte Lesezeichen auf die Kurations-Seiten kommen wieder an.** In der End-Anwender-Fassung landeten sie auf einer leeren Fläche statt auf der Startseite; „Programme" öffnet jetzt die richtige Stelle und sagt es, wenn der Abschnitt gerade ausgeblendet ist.
- **Drei Knöpfe sprangen auf die Startseite** statt zu ihrem Ziel — „In CSV-Sources prüfen" im Hinweis zu geänderten Spalten (der Bericht bleibt jetzt erhalten) und zwei Wege zu den Dokumentenquellen.
- **Ohne aktive Kurator-Sitzung ist wirklich nichts änderbar.** Die Beta-/Experten-Marken und die Adresse des FAQ-Assistenten ließen sich weiter für das ganze Team speichern, obwohl oben „nur lesbar" stand.
- **„Nur Labels" schreibt nur Labels.** Beim Übernehmen aus einer XLSX-Datei wurde bei Zeilen mit zwei Änderungen trotzdem auch das Jahr geschrieben. Ein Label lässt sich jetzt auch wieder leeren.
- **Ein gelöschtes Förderprogramm bleibt gelöscht** — es stand vorher sofort wieder da, während die zugehörigen Quellen und Filter weg blieben.

### Verbesserungen
- **Leere Karten verschwinden.** „Selten gebraucht" stand mit Überschrift über nichts, wenn ihr Inhalt hinter dem Expertenmodus liegt; dasselbe galt für „Persönlicher Assistent" in Ihrem Profil.
- **Zahlen sagen, worüber sie zählen.** „Letzter Import" meldet „nicht prüfbar", solange der Datenordner nicht verbunden ist, statt „noch kein Import"; die Antragszahl der Unterprogramme heißt jetzt „Anträge mit Code".
- **Ist der Kurator-Modus gesperrt, schaltet der Knopf daneben ihn wieder frei** — vorher führte der genannte Weg zu einem Schalter, der bereits an war.
- **„Hilfe" auf der Seite Dokument-Review zeigt deren eigene Anleitung** statt der Anleitung der Datenpflege.

## v4.118 — 2026-08

### Bugfixes
- **„Nur meine" findet Ihre Vorgänge wieder.** Das Kürzel wurde buchstabengenau verglichen — wer „ATH" im Profil stehen hatte, aber „ATh" in den Daten, bekam eine leere Liste. Jetzt gilt dieselbe Regel wie überall sonst in der App, inklusive Vertretung („MUE, SCH") und der zweiten Bearbeiter-Spalte.
- **Die Auswertung rechnet im selben Ausschnitt wie die Übersicht.** Die Bearbeitungsdauern liefen bisher über den gesamten Bestand, während die Liste darüber auf die eingestellten Richtlinien begrenzt war.
- **Ein Meilenstein, der heute fällig ist, sagt das auch** — statt „in 0 T" unter der Überschrift „Überfällig".
- **Kein erfundener Countdown mehr.** Vorgänge, für die der Plan gar keinen Meilenstein vorsieht, zeigten trotzdem „noch 7 Tage". Jetzt steht dort „Unbekannt" mit der Erklärung dazu.
- **Der freigegebene Plan geht nicht mehr verloren**, wenn oft hintereinander gespeichert wird; ein Meilenstein mit halb ausgefüllter Regel gilt nicht mehr für jeden Vorgang als erreicht.

### Verbesserungen
- **Jede Seite sagt, welche Fassung sie auswertet** — und dass ein gespeicherter Entwurf noch nicht gilt. Nicht gespeicherte Änderungen bleiben beim Reiterwechsel sichtbar, statt still verloren zu gehen.
- **Die Tabelle zeigt den Nenner ihrer Reißquote** („Betrachtet"), die Zustands-Spalte im Zeitstrahl ist lesbar, und der Plan warnt, wenn seine letzte Soll-Woche hinter der Gesamtfrist liegt.
- **Das Startseiten-Widget „Fristen" bündelt je Vorgang** — vorher füllten drei Projekte alle acht Zeilen.

## v4.117 — 2026-08

### Verbesserungen
- **Sechs Bereiche brauchen keinen Schalter mehr.** Der Gutachten-Workflow, die Kurzfassung, die Meilensteine und „Alle Felder" am Antrag sowie „Suchsprache" und „Fragen" in der Suche sind ab jetzt immer da — sie gehören zum Tagesgeschäft, nicht in die Tiefe.
- **Vier Bereiche stehen jetzt unter „Beta-Funktionen":** Statuseinträge, Werkbank und Widerspruch am Antrag sowie die Seite „Dokumente". Sie funktionieren, ändern sich aber noch.
- **Zwei Bereiche der Datenpflege stehen jetzt unter „Expertenmodus":** „Programme" und der „CSV-Datenimport" auf der Übersicht. Beide wiegen schwer und werden selten angefasst.
- Wer die beiden Schalter schon umgelegt hat, merkt davon nichts — mit beiden an ist weiterhin alles sichtbar.

## v4.116 — 2026-08

### Bugfixes
- **Die gewählte Primärfarbe bleibt jetzt erhalten.** Von den sieben Farben überstand bisher nur „Schiefer" einen Neustart — alle anderen kamen in einem kräftigeren Blaugrau zurück, während das Häkchen weiter an der gewählten Farbe stand. Die App merkte sich nur den Farbton, nicht die Sättigung und Helligkeit. Wer eine Farbe eingestellt hatte, sieht sie ab jetzt wieder; ein erneutes Anklicken ist nicht nötig.
- **Ihre Einstellungen überleben jetzt auch einen Geräte- oder Browserwechsel.** Die Sicherungskopie im persönlichen Ordner wurde nur einmal beim Einrichten geschrieben. Ging der Browser-Speicher verloren, kam der Stand des Einrichtungstags zurück — Kürzel, Kurator-Häkchen und alles seither Eingestellte waren weg. Jetzt wird die Kopie bei jeder Änderung mitgeschrieben.
- **Die Startseite zeigt so viele Anträge, wie die Einstellung sagt.** Dort stand „5", angezeigt wurden 10 — und der erste Klick auf „Mehr" machte daraus 6, verkürzte die Liste also. Beide Stellen rechnen jetzt mit derselben Zahl.
- **Ausgeblendete Bereiche sind wirklich ausgeblendet.** Wer „Beta-Funktionen" oder den Expertenmodus ausgeschaltet ließ, sah trotzdem neun Bereiche, die dazu gehören — darunter „Antrags-Daten zurücksetzen" in der Datenpflege. Ein Link auf so einen Bereich meldete gleichzeitig, er sei ausgeblendet, während er sichtbar danebenstand.
- **Kompetenzen im Fachprofil gehen nicht mehr verloren.** Wer noch kein eigenes Profil angelegt hatte, sah „0 Begriffe", obwohl im Team-Profil welche standen — und die erste beliebige Änderung schrieb sie dort auf leer.
- **Ein Tag umbenennen wirkt jetzt auch auf die Dokumente.** Bisher änderte sich nur der Name in der Liste; das nächste „Neu zählen" holte den alten zurück und stellte den neuen mit null Verwendungen daneben. Außerdem stehen technische Kennungen (z. B. die Verbund-Nummer) nicht mehr zwischen den echten Schlagwörtern.
- **Fehlgeschlagene Ordner-Aktionen sagen es jetzt.** Sieben der acht Aktionen in „Daten & Verbindungen" — verbinden, trennen, aktualisieren — brachen bisher stillschweigend ab: der Spinner ging aus, sonst passierte nichts.
- **Verzeichnisse mit abgelaufenem Zugriff verschwinden nicht mehr.** Sie wurden gar nicht angezeigt („Keine weiteren Verzeichnisse verbunden"), obwohl sie eingetragen waren. Jetzt stehen sie mit einem „Zugriff erneuern"-Knopf in der Liste.

### Verbesserungen
- **Die Suche in den Einstellungen findet zuerst, was am besten passt.** Wer „Verbindung" tippte, bekam sechs Abschnitte der Seite „Daten & Verbindungen" — und ausgerechnet nicht den Abschnitt, der „Verbindung" heißt. Groß- und Kleinschreibung spielt in Links jetzt keine Rolle mehr, und ein Link auf einen Abschnitt, den es hier nicht gibt, sagt das, statt wortlos auf der ersten Seite zu landen.
- **Sechs Bereiche sind neu über die Suche erreichbar** — darunter „Verbindung einrichten" mit dem ziehbaren Lesezeichen, die Tag-Liste und „Wer ist online".
- **„Zur Freischaltung" und „verwalten" führen jetzt an die richtige Stelle** statt auf den Anfang der Einstellungen.

## v4.115 — 2026-08

### Verbesserungen
- **Lange Anträge gelten nicht mehr vorschnell als „zu lang".** Beim Ablegen einer Vorhabensbeschreibung warnte die App ab rund 170.000 Zeichen, die KI würde den Schluss nicht mehr sehen — dabei belegt ein Antrag dieser Länge in der internen KI nur etwa zwei Drittel des Platzes. Die App rechnete Zeichen viel zu vorsichtig in Tokens um. Die Grenze liegt jetzt bei rund 238.000 Zeichen, gemessen an einem echten Antrag statt geschätzt.
- **„Datenpflege › Sichtbarkeit" passt jetzt auf einen Bildschirm.** Die Liste war fast 200 Zeilen lang; jetzt steht dort ein aufklappbarer Baum mit einer Zeile je Seite. An einer zugeklappten Seite sehen Sie, wie viel darunter markiert ist („3 markiert"), und „Alles aufklappen" öffnet bei Bedarf alles auf einmal.
- **Man sieht jetzt auf einen Blick, was an und was aus ist.** Eine eingeschaltete „Beta"-Marke ist blau ausgefüllt — dieselbe Farbe wie das Beta-Abzeichen in der App —, eine eingeschaltete „Experte"-Marke dunkel. Ausgeschaltet sind beide nur ein feiner Umriss. Vorher unterschieden sich an und aus fast nur durch die Randstärke.

## v4.114 — 2026-08

### Verbesserungen
- **Auch einzelne Karten lassen sich jetzt ausblenden.** Bisher konnte die Datenpflege ganze Seiten, Reiter und Startseiten-Widgets als „Beta" oder „Experte" kennzeichnen — jetzt auch die Blöcke mit eigener Überschrift darin, etwa „Statistik-Übersicht" in der Auslastung oder „Fristrisiko" im Vorgangs-Board.
- **Kein Verweis mehr auf etwas, das Sie gar nicht sehen.** In der Antrag-Aufbereitung stand ein Kasten „Externe Recherche — folgt im Recherche-Tab", auch wenn dieser Reiter für Sie ausgeblendet war. Er erscheint jetzt zusammen mit dem Reiter, und die „Tab öffnen"-Verweise im Fortschritts-Stepper führen nur noch auf Reiter, die es für Sie gibt.

## v4.113 — 2026-08

### Verbesserungen
- **„Auch ähnliche Themen" findet jetzt auch, was in der Projektbeschreibung steht.** Bisher verglich diese Suche nur die TITEL der Vorhaben — die Beschreibung floss nie ein, obwohl sie bei 9.259 Vorhaben dasteht und im Schnitt über 800 Zeichen lang ist. Wer „Verfahren zur Kadaversuche aus der Luft" suchte, fand das Vorhaben nicht, das genau das beschreibt. **Damit es wirkt, muss der Vektor-Bestand einmal neu gebaut werden** — der Hinweis dazu steht im Auslastungs-Modul unter „Themen-Vektoren".
- **Die Ähnlichkeitssuche hält sich an „Suchen in".** Wer auf „nur Einrichtung" einschränkte, bekam trotzdem 50 Vorhaben zum Thema — also genau das, was er ausgeschlossen hatte; unter „nur Dokumente" kamen 50 Anträge ohne einen einzigen Dokumenttreffer. Jetzt ruht die Stufe dort, und die Zeile unter dem Suchfeld sagt, warum und wie Sie sie wieder bekommen.
- **Das Embedding-Modell (200 MB) lädt erst, wenn Sie es brauchen.** Bisher lud es bei jedem Start der App, obwohl der Schalter dazu aus war — der Start ist jetzt spürbar leichter für alle, die nicht semantisch suchen.

### Bugfixes
- **Die Zeile unter dem Suchfeld sagt die Wahrheit über die Trefferzahl.** Sie meldete „50 thematisch verwandte Vorhaben — alle standen schon im Wortlaut-Ergebnis"; tatsächlich lagen 65 über der Schwelle, und die beiden abgeschnittenen wären die einzigen neuen gewesen. Jetzt steht dort die echte Zahl, und was nicht mehr in die Liste passte, wird benannt. Vor allem: neue Treffer werden nicht mehr als erste weggelassen.
- **„Das Modell konnte nicht geladen werden" erscheint nicht mehr, während es lädt.** Wer in den ersten Sekunden suchte, bekam eine Fehlermeldung über einen Fehler, der nicht stattfand — samt Verweis auf die Browser-Konsole.
- **Ein halb geladener Vektor-Bestand füllt sich von selbst auf.** Wer die App während des Ladens neu lud, blieb dauerhaft auf dem Teilbestand sitzen; die Zeile nannte den Ausweg nur, wenn gar nichts da war.
- **„Auch ähnliche Themen" kann keinen Dokumenttreffer mehr kosten.** Das Einschalten konnte bestehende Treffer verdrängen, obwohl „auch" dasteht.
- **Ein ersetztes Dokument hinterlässt keine Geister im Suchindex.** Wurde eine kürzere Fassung abgelegt, blieben Abschnitte der alten unter dem Namen der neuen Datei auffindbar — und ein gerade aktualisiertes Dokument rutschte im Ranking nach unten.

## v4.112 — 2026-08

### Neu
- **Die Oberfläche ist aufgeräumt — und Sie entscheiden, wie viel davon Sie sehen.** In „Einstellungen › Mein Profil" gibt es zwei neue Schalter unter „Umfang der Oberfläche". Beide sind zunächst aus: Sie sehen den täglichen Weg, ohne alles, was daneben in Erprobung ist oder nur selten gebraucht wird. Aus der Seitenleiste verschwinden damit sieben Einträge — unter anderem die ganze Gruppe „In Erprobung".
- **„Beta-Funktionen" zeigt, was noch in Erprobung ist.** Diese Bereiche funktionieren, können sich aber noch ändern; Rückmeldungen dazu sind ausdrücklich erwünscht. Sie erkennen sie am kleinen „Beta"-Zeichen.
- **„Expertenmodus" zeigt die selten gebrauchten Tiefen-Werkzeuge** — Verwaltungs-Reiter, Rohfelder, Diagnose-Abschnitte. Gesperrt war davon nie etwas; es steht nur nicht mehr im Weg, solange Sie es nicht brauchen.
- Unter jedem Schalter steht, wie viele Bereiche er zusätzlich einblendet. Was neu **und** für Profis gedacht ist, erscheint erst, wenn beide Schalter an sind. Beides wirkt sofort, ohne die App neu zu laden — und ein gespeicherter Link führt weiterhin auch zu einer ausgeblendeten Seite.

### Verbesserungen
- Die Datenpflege hat dafür eine neue Seite „Sichtbarkeit": dort legt die Kuration für das ganze Team fest, was als Beta oder als Experten-Sache gilt.

## v4.111 — 2026-08

### Bugfixes
- **Ein Spaltenfilter in der Tabelle gilt jetzt auch in der Liste.** Bisher zeigte dieselbe Suche in der Tabelle 422 Treffer und nach dem Umschalten auf die Liste wieder 484 — der Filter war dort wirkungslos, und ein Export aus der Liste enthielt die ungefilterten Zeilen. Der gesetzte Filter steht jetzt außerdem als Chip über dem Ergebnis („Status: 10 Werte") und lässt sich dort mit einem Klick wieder wegnehmen.
- **Der Reiter „Stöbern" zeigt wirklich die häufigsten fünf Werte.** Er zeigte den Anfang der alphabetischen Liste: unter „Bundesland" stand Bremen (306 Anträge), Sachsen (2 742) fehlte; unter „Netzwerk" waren vier der fünf Werte Einzeltreffer, unter „Einrichtung" fanden zwei gar nichts.
- **Einrichtungen mit Anführungszeichen im Namen sind wieder auffindbar.** Ein Klick auf eine Zeile wie `"EIKBOOM" Gesellschaft mit beschränkter Haftung` führte zu „Keine Treffer", obwohl es die Einrichtung gibt. Betroffen waren 13 von 5.407 Einrichtungen — und weil alphabetisch sortiert wird, standen sie ganz oben.
- **„Häufig gesucht" zählt jetzt, wie oft Sie etwas gesucht haben.** Bisher standen dort die Anfragen, die am längsten *nicht* mehr gesucht wurden. Die Gruppe erscheint nur noch, wenn Sie etwas mindestens zweimal gesucht haben, und wiederholt nichts, was schon unter „Zuletzt gesucht" steht.
- **„+385 seit zuletzt" an einer gemerkten Suche gibt es nicht mehr.** Wer eine Suche mit gesetztem Filter merkte, bekam sofort einen Zuwachs gemeldet, den es nie gab — verglichen wurden zwei verschiedene Zahlen. Außerdem trägt eine nachts gemerkte Suche jetzt das richtige Datum (bisher stand vor 2 Uhr der Vortag da).
- **Das Beispiel `ort:Dresden` verspricht kein Bundesland mehr.** In der Suchsprache-Hilfe stand „nur Ort und Bundesland"; für Bundesländer gibt es längst ein eigenes Feld (`bl:`).

## v4.110 — 2026-08

### Verbesserungen
- **„auch ähnliche Themen" sagt jetzt, was es gefunden hat.** Unter der Optionszeile steht nach dem Lauf eine Zeile wie „Ähnlichkeit: 9 thematisch verwandte Vorhaben, 8 davon neu in der Liste" — oder eben „alle standen schon im Wortlaut-Ergebnis, die Trefferzahl ändert sich dadurch nicht". Bisher blieb die Stufe stumm, und eine unveränderte Trefferzahl sah aus wie ein Defekt.
- **Die Zeile nennt auch die Reichweite:** „Vergleichbar sind 1.086 von 14.225 Vorhaben — nur sie haben auf diesem Rechner einen Vektor." Was keinen Vektor hat, kann nie als ähnlich gefunden werden.
- **Die Stufe ist großzügiger geworden.** Sie behielt bisher nur Vorhaben, die höchstens 10 % unter dem besten Treffer lagen — an echten Daten waren das meist eine Handvoll, die ohnehin schon in der Liste standen. Bei derselben Suche kommen jetzt 9 statt 2 Vorschläge, 8 davon neu. Ein rein thematischer Treffer steht weiterhin nie über einem, der Ihre Wörter wirklich enthält.

## v4.109 — 2026-08

### Neu
- **Das Suchfeld schlägt jetzt auch in der Suche Fragen vor** — dieselbe Liste wie bei den Förderanträgen: **Zuletzt gefragt**, **Beispielfragen** und **Zum Ausfüllen**. Eine Vorlage wie „Was läuft in ‹Bundesland› zum Thema ‹Thema›?" wird nur eingesetzt, nicht abgeschickt: der Cursor steht markiert auf der ersten Lücke, Enter springt zur nächsten. Solange eine Lücke offen ist, geht die Frage nicht an die KI — „Frage stellen" bleibt gesperrt, und unter dem Feld steht, was noch fehlt.
- Die Liste erscheint, sobald Sie das erste Zeichen tippen. Beim leeren Feld bleiben die Reiter des Startbilds frei — dort steht unter „Fragen" derselbe Vorrat, nur vollständig.

## v4.108 — 2026-08

### Neu
- Im Frage-Modus ist das Suchfeld der Förderanträge **mehrzeilig und an der unteren Kante aufziehbar** — lange Fragen stehen damit vollständig vor Ihnen statt in einer scrollenden Zeile. Die gewählte Höhe bleibt gemerkt.
### Verbesserungen
- Das Suchfeld ist in beiden Betriebsarten **gleich breit**. Umschalter, Knopf und Häkchen rutschen bei schmalem Fenster in die nächste Zeile, statt das Feld zu stauchen.
- **Ein eigener Reiter merkt sich jetzt auch die Quickfilter-Pillen** (Projektart, PreCheck, Stillstand) und stellt sie beim Klick wieder her. Bisher trug ein Reiter „PreCheck offen" nur den Namen. Bereits gemerkte Reiter bleiben gültig; bei ihnen gilt „keine Einschränkung".

## v4.107 — 2026-08

### Neu
- Neben dem Suchfeld der Förderanträge steht im Frage-Modus jetzt der Knopf **„Frage stellen"** — dasselbe, was die Eingabetaste tut, nur sichtbar. Der Umschalter „Suche mit:" ist mit ihm auf die rechte Seite des Feldes gewandert.
### Bugfixes
- **Eine getippte Frage filtert die Liste nicht mehr, bevor sie gestellt wurde.** Bisher durchsuchte die Liste sofort den Wortlaut mit dem ganzen Fragesatz — der trifft naturgemäß keinen Antragstitel, also stand die Liste leer da, obwohl gar keine KI gefragt worden war. Jetzt bleibt sie unverändert, bis „Frage stellen" oder die Eingabetaste sie übersetzt hat; die Zeile darunter sagt, dass die Frage noch offen ist.
- Auch **nach** einer erfolgreich übersetzten Frage wird der Satz nicht mehr als Stichwort gesucht: Fragen nach Status, Jahr oder PreCheck nennen kein Thema, und die Liste kam deshalb leer zurück.
- **Vom eigenen Reiter kommt man wieder zurück.** War eine gemerkte Ansicht aktiv, tat der Klick auf einen festen Reiter — vor allem auf „Antragsphase" — nichts: die Markierung des eigenen Reiters hängt daran, dass der Stand zu ihm passt, und der bloße Reiterwechsel änderte daran nichts. Jetzt räumt er dabei den Ausschnitt ab, den der eigene Reiter mitbrachte (Filter, Spaltenkopf-Auswahl, Beendet-Sicht); Spaltensatz und Dichte bleiben.
- **Das Vorschlags-Dropdown der Suche verdeckt die Suchhilfen nicht mehr.** Bei leerem Suchfeld klappt es nicht mehr auf — die Reiter „Alle · Zuletzt · Suchsprache · Fragen · Stöbern" liegen frei, und der Reiter „Zuletzt" führt denselben Verlauf ungekürzt. Sobald Sie tippen, schlägt das Feld wie bisher vor.

## v4.106 — 2026-08

### Neu
- Das Suchfeld der Förderanträge **schlägt Fragen vor**, sobald man es im Frage-Modus anklickt — in drei Abschnitten: **Zuletzt gefragt** (die eigenen Fragen, nur auf diesem Rechner gemerkt), **Beispielfragen** (drei fertige, jeweils mit den Filtern dahinter) und **Zum Ausfüllen** (drei Vorlagen mit Lücken).
- Eine Vorlage wird beim Auswählen nur **eingesetzt**: der Cursor steht auf der ersten Lücke, und Enter springt zur nächsten, statt eine halbe Frage abzuschicken. Erst wenn alle Lücken gefüllt sind, wird gefragt. Eine fertige Frage aus dem Verlauf oder den Beispielen wird dagegen sofort gestellt.
### Verbesserungen
- Der Verlauf lässt sich zeilenweise oder ganz löschen. Gemerkt werden nur Fragen, die auch übersetzt werden konnten.

## v4.105 — 2026-08

### Neu
- In den Förderanträgen lässt sich jetzt **eine Frage stellen** statt nur Stichworte einzutippen: „alle Netzwerke, die für Phase 2 abgelehnt wurden" oder „Einzelvorhaben aus 2025 und 2026 ohne PreCheck". Die Frage setzt die passenden Filter — was sie gesetzt hat, steht unter dem Feld und lässt sich einzeln ändern. Umschalten über „Suche mit:" links vom Suchfeld, absenden mit Enter.
- Neue Filter-Pille **Stillstand**: Anträge, an denen seit ein bis sechs Monaten kein Kürzel mehr gesetzt wurde. Anträge ohne datierbares Kürzel gelten dabei ausdrücklich als *nicht prüfbar* und nicht als unauffällig — ihre Zahl steht am Chip im Seitenkopf.
### Verbesserungen
- Eine Frage kann jetzt auch nach den Anträgen einer **anderen Person** fragen („für Bearbeiter THÜ"). Der Chip sagt, dass der Ausschnitt aus der Frage kommt, und nimmt ihn per Klick zurück.
### Bugfixes
- **Fragt die KI-Antwort nach den Vorhaben, um die es „hauptsächlich" geht, nennt sie diese jetzt beim Namen.** Bisher konnte sie die Gruppe nur zählen („4 von 499") und schrieb dazu, die vier seien in den gezeigten Belegen nicht enthalten — sie waren die ersten vier Treffer. Vorhaben, die **alle** gefragten Themen tragen, sind für die KI jetzt als solche gekennzeichnet und stehen vorn.

## v4.104 — 2026-08

### Verbesserungen
- **Die Antwort auf Ihre Frage steht jetzt auf 40 statt 20 Treffern.** Bei einer Frage nach einer Liste ist jedes Beispiel mehr eines, das die KI nicht erraten muss.
- **Ist „auch ähnliche Themen" eingeschaltet, entscheidet die KI selbst, welche der thematisch verwandten Vorhaben dazugehören.** Sie bekommt sie als eigene, ausdrücklich gekennzeichnete Liste — in keinem davon steht eines Ihrer Suchwörter. Nimmt sie eines auf, schreibt sie „(thematisch verwandt)" dahinter; passt keines, erwähnt sie sie nicht. Die Trefferzahl über der Liste bleibt dieselbe, die Antwort sagt nur zusätzlich, wie sie sich zusammensetzt.

## v4.103 — 2026-08

### Verbesserungen
- **„auch ähnliche Themen" erklärt sich im Frage-Modus selbst.** Der Haken tut dort etwas anderes als bei einer Stichwortsuche: verglichen wird die **ganze Frage** als Text, nicht die Suchbegriffe daraus. Er holt bis zu 50 verwandte Vorhaben dazu, die kein einziges der gesuchten Wörter tragen — sie erscheinen mit der Fundstelle „Ähnlichkeit" und stehen nie vor einem Wortlaut-Treffer. Nennt Ihre Frage einen Ort oder eine andere Einschränkung, läuft die Stufe gar nicht mit; dann steht dort „ohne Ähnlichkeitssuche".
- **Vorgangs-Board und Vorgangs-Regeln öffnen beim Wiederbesuch sofort.** Bisher rechnete jede Rückkehr den ganzen Bestand neu durch; jetzt wird das Ergebnis behalten.
- Beide Seiten zeigen an, wie alt ihre Zahlen sind, und haben einen Knopf „neu berechnen".
- Auch die erste Berechnung ist rund doppelt so schnell.


## v4.102 — 2026-08

### Bugfixes
- **Der Chip „nur die genannten" wirkt jetzt auch in der Tabellenansicht.** Bisher zeigte die Tabelle weiter alle Treffer, während darüber schon die kleine Zahl stand — in der Listenansicht stimmte es. Damit fehlte auch die Spalte „KI-Antwort" bei Vorhaben, die weiter unten in der ungefilterten Tabelle standen.

### Verbesserungen
- **Eine Anfrage, die Sie aus dem Verlauf auswählen, läuft sofort.** Das gilt für die Vorschlagsliste im Suchfeld ebenso wie für „Zuletzt gesucht" im Startbild. Im Frage-Modus heißt das: die Frage geht direkt an die interne KI, statt im Feld zu stehen und auf einen zweiten Klick zu warten. Feldnamen wie `ort:` und einzelne Werte übernehmen wir weiterhin nur in das Feld — sie sind ein Stück Ihrer Anfrage, noch kein Auftrag.
- **Der Chip „Treffer: alle Richtlinien" hält sich zurück, solange eine Frage nur getippt ist.** Er sagt, welche Richtlinien in Ihre Trefferliste dürfen — vor der ersten Zahl gibt es nichts, worauf er sich beziehen könnte. Sobald das Ergebnis steht, steht er wieder direkt hinter der Trefferzahl.

## v4.101 — 2026-08

### Neu
- **Ein `?` mitten im Wort steht jetzt für genau ein Zeichen.** Damit finden Sie Namen, deren Schreibweise im Bestand schwankt: `mobi?nspec` liefert die Vorhaben, die als *mobiInspec* geführt werden, **und** die als *mobilnspec* — zusammen 33 statt 32 oder 3. Bei Kennzeichen geht dasselbe: `16KN0830?1`. Am Ende eines Wortes bleibt das Fragezeichen ein Fragezeichen, Ihre Fragen im Frage-Modus ändern sich also nicht.

### Verbesserungen
- Nach einer beantworteten Frage zeigt auch die **Tabellenansicht**, was die KI über ein Vorhaben gesagt hat — in der neuen Spalte *KI-Antwort*, mit dem ganzen Satz im Tooltip und im Export. Bisher stand das nur in der Listenansicht.
- Der Chip **„Treffer: alle Richtlinien"** steht jetzt direkt hinter der Trefferzahl, auf die er wirkt, statt über den Filtern.

## v4.100 — 2026-08

### Neu
- Nennt die **KI-Antwort** über der Trefferliste ein Vorhaben, führt ein Klick auf sein Kennzeichen jetzt **in die Liste darunter** — die Zeile wird angesteuert und kurz hervorgehoben, statt dass die Suche verlassen wird. Die genannten Vorhaben tragen dort die Marke „in der Antwort", darunter in einer Zeile, was die KI über sie gesagt hat (der ganze Satz steht im Tooltip). Mit dem Chip **„nur die genannten"** neben den Filtern sehen Sie ausschließlich diese.

### Verbesserungen
- Die **Arbeitsnotizen werden nicht mehr mitgesucht**. Dort steht Verwaltungsverkehr — Vollmachten, IBAN, Zahlungsstopps, Namen —, und wer fachlich suchte, bekam davon Treffer, deren einziger Grund ein Name in einer Vollmacht war. Gezielt erreichbar bleiben sie über `notiz:` (auch `bemerkung:` oder `wichtig:`). Weil der Standardbereich damit nicht mehr wörtlich alles durchsucht, heißt er jetzt **„alle Vorhabensfelder"**.

## v4.99 — 2026-08

### Verbesserungen
- Der **Ordnerbaum** der Kürzel sagt jetzt, was er bewirkt: aus jedem Ordner kann eine Spalte in der Fördertabelle werden — und über dem Baum steht, welche Ordner das **nicht** können, weil kein passendes Kürzel darin liegt. Wer eine Spalte vermisst, findet den Grund dort statt im Spaltenpicker.

## v4.98 — 2026-08

### Verbesserungen
- In den **Vorgangs-Regeln** steht jeder Status jetzt **einmal** statt zweimal. Das Fachsystem führt ihn auf zwei Ebenen (Teilvorhaben und Verbund), und deshalb stand er doppelt in der Tabelle — mit überall denselben Werten. Eine neue Spalte „Ebene" sagt, wo er gilt; eine Änderung wirkt auf beide.
- Damit sagen Reiter, Umschalter und Baum endlich dieselbe Zahl.

## v4.97 — 2026-08

### Verbesserungen
- Die **Richtlinien-Auswahl** (der Chip „Anzeige: …" bzw. „Treffer: …") zeigt jetzt alles auf einen Blick: die drei Kurzwahlen nebeneinander in einer Zeile, die Programme in zwei Spalten — kein Scrollen mehr, um nachzusehen, ob eine Richtlinie noch dabei ist.
- In der Suche legt sich die Auswahl nicht mehr über die Trefferzeile, sondern geht darunter auf. So sehen Sie beim Umschalten, wie sich die Trefferzahl ändert.
- Im Kopf der Suche stehen **„Diese Suche speichern" und „Gespeicherte Suchen" jetzt in der natürlichen Reihenfolge** — erst merken, dann nachschlagen. Und der Speichern-Knopf erscheint erst, wenn eine Suche tatsächlich gelaufen ist: eine getippte, aber noch nicht abgeschickte Frage lässt sich nicht mehr als leeres Ergebnis merken.
- Die Tabellenspalte **„Score" heißt jetzt „Relevanz"** und zeigt dieselben drei Striche mit „hoch / mittel / gering" wie die Listenansicht. Der genaue Wert steht weiterhin im Tooltip, und sortiert wird unverändert danach.

### Bugfixes
- Die Suche schrieb „0 Treffer in 14.225 Anträgen", auch wenn die Richtlinien-Auswahl den Bestand längst eingegrenzt hatte. Jetzt steht dort, worauf sich die Zahl wirklich bezieht: „0 Treffer in 2.537 von 14.225 Anträgen".

## v4.96 — 2026-08

### Verbesserungen
- Das **Vorgangs-Board** hat statt fünf Reitern nur noch drei: *Arbeit*, *Fristen*, *Auswertung*. Wer an einem Vorgang dran ist, wählen Sie jetzt darunter mit vier Chips — und deren Zahlen ergeben zusammen den ganzen Bestand.
- Der Reiter „Kein To-do ermittelt" hat zwei sehr verschiedene Dinge zusammengeworfen: eine Handvoll Vorgänge, für die keine Regel greift, und mehrere Tausend, die schlicht **abgeschlossen** sind. Beides steht jetzt getrennt da, mit eigener Zahl.

## v4.95 — 2026-08

### Neu
- In den Vorgangs-Regeln sagt der Messlauf jetzt auch, **welche Regeln gar nichts bewirken** — mit Namen und Grund, statt sie nur zu zählen. Aktuell sind das zwei von dreißig: eine trifft auf keinen Vorgang zu, eine wird immer von einer Regel weiter vorn verdeckt.
### Verbesserungen
<!-- - … -->
### Bugfixes
<!-- - … -->

## v4.94 — 2026-08

### Neu
- **„Aktuelle Richtlinie" mit einem Klick.** Im Auswahl-Fenster des Anzeigebereichs steht neben „Standard-Bereich" und „Alle Richtlinien" jetzt eine dritte Kurzwahl: sie zeigt nur die Anträge der laufenden Richtlinie. Der Chip im Seitenkopf nennt sie beim Jahr („Anzeige: Richtlinie 2025"). Kommt eine neue Richtlinie, schaltet die Kurzwahl von selbst auf sie um — nachpflegen muss das niemand.
- Dieselbe Kurzwahl gibt es im Richtlinien-Fenster der **Suche** („Treffer: Richtlinie 2025").

## v4.93 — 2026-08

### Bugfixes
- **Die Suche nach einem Netzwerk findet jetzt auch das Netzwerk selbst.** Bisher lieferte `nw:<Name>` nur die Teilvorhaben; der Netzwerkantrag fehlte, und im Filter „Antragstyp" gab es deshalb kein „NW" zum Umschalten. Grund: die Quellspalte führen nur die Teilvorhaben — der Netzwerkantrag lässt sie leer, weil er das Netzwerk ist. Sein Name wird jetzt aus seinen Teilvorhaben abgeleitet.
### Verbesserungen
<!-- - … -->
### Bugfixes
<!-- - … -->

## v4.92 — 2026-08

### Verbesserungen
- Die Kürzel-Tabelle in den **Vorgangs-Regeln** ist schmaler: sie zeigt nur noch, was dort auch entschieden wird. **Ordner**, **Prominenz** und der **Verfahrensschritt des Datums** stehen jetzt in der Klappe der Zeile (Pfeil vor dem Code) — zusammen mit dem Hinweis, dass die ersten beiden aus der Kürzel-Zuarbeit kommen und dort bereits stimmen.
- Die Frage, **welches Datum den „seit wann"-Hinweis speist**, wird jetzt am Verfahrensschritt beantwortet statt an jedem einzelnen Kürzel. Über dem Schritt-Baum steht, wie viele Kürzel das leisten — und welcher Schritt ohne Datum dasteht.
- Der Prominenz-Wert „Meilenstein" heißt jetzt **„Hauptereignis"**. Er hatte nie etwas mit dem Meilenstein-Plan zu tun, sondern sagt nur, wie stark ein Punkt in der Chronik gezeichnet wird.
### Verbesserungen
<!-- - … -->
### Bugfixes
<!-- - … -->

## v4.91 — 2026-08

### Neu
- **Die Suche lässt sich auf Richtlinien einschränken.** Über der Trefferliste steht ein Chip „Treffer: alle Richtlinien" — ein Klick öffnet dieselbe Auswahl wie auf den Förderanträgen. Voreingestellt bleibt der ganze Bestand; wer die alten Richtlinien ausblendet, muss das nur einmal sagen: die Einstellung wird gemerkt.
- Weicht die Auswahl vom ganzen Bestand ab, sagt der Chip, wie viele Treffer sie wegnimmt — und alle Zahlen daneben (Facetten, Vorschläge, Startseite) zählen dieselbe Menge.
### Verbesserungen
<!-- - … -->
### Bugfixes
<!-- - … -->

## v4.90 — 2026-08

### Neu
- Auf der Startseite gibt es jetzt **ein** Widget „Fristen" statt zweier. Es zeigt beides in einer Liste — Vorgänge, an denen zu lange nichts passiert ist, und überfällige Meilensteine —, am weitesten über der Frist zuerst. Jede Zeile sagt, woher die Warnung kommt.
- Im Status-Cockpit erklärt der neue Reiter **„Ebenen"**, welche Angaben über einem Antrag liegen, wer sie pflegt und was sich ändert, wenn man an einer dreht. Dort wird nichts eingestellt — er gibt nur Auskunft, mit den Zahlen des geltenden Stands.

### Verbesserungen
- **Ein neuer Verfahrensschnitt verschiebt keine Anträge mehr zwischen den Reitern.** Bisher hing beides zusammen: wer im Baum einen Status umhängte, änderte nebenbei, in welcher Arbeitsliste er auftaucht — einmal waren davon 448 Anträge betroffen, ohne dass es jemand entschieden hätte. Die Arbeitsliste steht jetzt fest am Status selbst; der Schnitt lässt sich frei umbauen.
- Im Phasen-Editor entfällt deshalb die Auswahl „Arbeitsliste". An ihrer Stelle steht ein Satz, der sagt, wo die Zuordnung jetzt herkommt.

## v4.89 — 2026-08

### Neu
- **Wenn Sie eine Frage stellen, bekommen Sie jetzt auch eine Antwort darauf.** Sie erscheint direkt über der Trefferliste, sobald die Suche gelaufen ist — Sie müssen die Frage nicht mehr ein zweites Mal im Assistenten abschicken.
- **Die Antwort stützt sich auf alle Treffer, nicht auf die ersten vierzig.** Wie viele Vorhaben *alle* gefragten Themen behandeln, wie sich die Treffer über Jahre, Länder und Orte verteilen — das wird ausgezählt und der Antwort mitgegeben. Genannte Förderkennzeichen sind anklickbar.

### Verbesserungen
- Der Assistent geht nach einer Frage nicht mehr von selbst auf. Er steht weiter bereit, mit Ihrer Frage im Eingabefeld, wenn Sie nachfassen möchten.
- Schlägt die Antwort fehl, sagt die Karte das — Ihre Trefferliste bleibt davon unberührt.

## v4.88 — 2026-08

### Verbesserungen
- **Die Vorschläge im Suchfeld stehen jetzt alphabetisch — und es sind alle.** Tippen Sie `nw:`, sehen Sie den vollständigen Katalog aller Netzwerke von A bis Z zum Durchblättern; bisher waren es die 50 häufigsten. Das gilt genauso für Orte, Einrichtungen, Bundesländer, Wahlkreise und Deskriptoren.
- Die Trefferzahl neben einem Vorschlag wird für das gerechnet, was Sie gerade sehen, und füllt sich beim Scrollen nach — so bleibt die Liste auch bei 5.000 Einträgen sofort bedienbar.

### Bugfixes
- **Netzwerke standen teils doppelt in der Liste**, wenn der Export sie unterschiedlich groß schrieb (`3D-Fab` und `3D-FAB`). Jetzt steht jedes Netzwerk einmal da.
- **Bei 25 Netzwerken fehlte im Export ein Anführungszeichen**; ihr Name erschien als Bruchstück mitsamt Kennzeichen. Jetzt steht auch dort der Name.

## v4.87 — 2026-08

### Verbesserungen
- **Das Eingabefeld des Assistenten wächst jetzt beim Schreiben mit** — bis zu fünf Zeilen. Wird es Ihnen zu klein, ziehen Sie es an der rechten unteren Ecke größer.
- Die vier Beispiel-Vorschläge im leeren Assistenten sind entfallen. Sie versprachen Dinge, die der Assistent so noch nicht kann.

### Bugfixes
- **Rechts gab es zwei Scrollleisten** — die äußere scrollte die ganze Seite weg, obwohl die Trefferliste ihre eigene hat. Jetzt gibt es nur noch eine.
- **Scrollen im Assistenten bewegt nicht mehr die Seite darunter**, auch nicht am Ende der Unterhaltung.

## v4.86 — 2026-08

### Bugfixes
- **„Phasen exportieren" schrieb den zuletzt gespeicherten Stand in die Datei, nicht den, der auf dem Bildschirm stand.** Wer die Verfahrensschritte gepflegt und noch nicht für das Team gespeichert hatte, bekam die alte Fassung — und beim Einspielen auf dem anderen Rechner meldete die App völlig zu Recht Erfolg, obwohl die Kuratierung nicht ankam. Beide Exporte nehmen jetzt das mit, was die Seite zeigt. Ist der Stand noch nicht gespeichert, heißt die Datei „…-entwurf", damit die Fassungsnummer im Namen nichts verspricht, was der Inhalt nicht hält.

### Verbesserungen
- **Wenn Sie auf „Suche mit: einer Frage" umschalten, zeigt die Seite Ihnen sofort Beispielfragen.** Bisher landeten Sie vor einem leeren Feld; die Beispiele gab es zwar, aber in einem Reiter, den man erst finden musste. Ihre eigene Reiter-Auswahl bleibt dabei erhalten.
- **Fünf Beispielfragen statt drei** — neu dabei: eine Frage nach einem Zeitraum („… seit 2023?") und eine nach dem Bearbeitungsstand („… bei den noch offenen Anträgen …?"). Beides konnte die Suche längst, es stand nur nirgends.
- **Fragen nach Normen finden mehr.** Kürzel wie DIN, ISO oder EN fielen bisher aus der Übersetzung heraus; jetzt sucht die App nach „DIN EN", „ISO 9001" und ähnlichen Schreibweisen mit.
- Der Hinweis unter dem Suchfeld passt jetzt in eine Zeile.

## v4.85 — 2026-08

### Neu
- **Die Verfahrensschritte lassen sich getrennt von den Kürzeln sichern und einspielen.** In den Vorgangs-Regeln stehen im Reiter „Statuswerte" jetzt „Phasen exportieren" und „Phasen importieren" nebeneinander. Die Datei enthält nur die Schritte, die Zuordnung der Statuswerte und die Zieltage — die Kürzel bleiben am Zielort unangetastet. In der Fassungsliste gibt es dasselbe ohne Dateiweg: „Nur Phasen übernehmen" holt aus einer älteren Fassung allein den Verfahrensschnitt zurück.

### Verbesserungen
- **Der Weg zurück ist als Weg zurück zu erkennen.** In der Antragsansicht stand oben links nur der Name der Seite, von der Sie kamen, mit einem Pfeil davor. Jetzt steht dort der ganze Satz — „Zurück zum Vorgangs-Board", „Zurück zur Suche", „Zurück zu den Dokumenten" — in normaler Schrift, und der Titel darunter hat etwas Luft bekommen, statt direkt anzuschließen.

### Bugfixes
- **Ein Kürzel stand im Glossar doppelt.** `VBE` erschien zweimal, mit zwei verschiedenen Beschriftungen — der Katalog führt es versehentlich in zwei Zeilen. Das Glossar zeigt es jetzt einmal, und zwar mit der Zeile, die tatsächlich Werte trägt (5.788 Vorgänge); der Widerspruch wird am Eintrag benannt, statt still eine der beiden Fassungen zu wählen. Aufräumen lässt er sich in den Vorgangs-Regeln unter „Referenzdaten" mit „Nachziehen".
- **Fünf Kürzel der Fachprüfung trugen nirgends einen Wert.** `QS` (kaufm. QS erfolgt), `AQ4`, `VQK`, `ARQ` und `ABLQ` blieben in Chronik, Zeitstrahl, Navigator und Wächter leer, obwohl der Export sie führt — `QS` allein in 7.135 Zeilen. Grund: die App unterschied `QS` und `QS-` („zurück an AB") nicht, weil sie beim Zuordnen der Spalten Bindestriche wegwarf. Zwei der Kürzel zeigten dabei sogar die Daten ihres Geschwisters an. Jetzt trägt jedes Kürzel seine eigene Spalte.
- **Neu eingerichtete Rechner arbeiteten mit einem veralteten Status-Katalog.** Nach der Installation las die App den Katalog, bevor der Datenordner freigegeben war — sie fiel dann auf den mitgelieferten Stand zurück und blieb den Rest der Sitzung dabei. Betroffen waren Kürzel, Verfahrensphasen und die Aufgaben-Regeln gleichermaßen. Die vom Team gepflegte Fassung wird jetzt automatisch nachgeladen, sobald der Ordner offen ist.
- **Das Lesezeichen für die interne KI ließ sich nicht in die Lesezeichenleiste ziehen.** Beim Ablegen kam ein Verboten-Symbol. Betroffen war genau der erste Versuch: hatte man den Abschnitt „Verbindung einrichten" einmal aufgeklappt und die Seite später erneut geöffnet, funktionierte es — deshalb ließ sich der Fehler danach nicht mehr nachstellen. Das Ziehen klappt jetzt in jedem Fall.
### Neu
- **„Kopieren" neben dem Lesezeichen.** Falls das Ziehen in die Leiste nicht erlaubt ist, lässt sich die Adresse kopieren und von Hand in ein Lesezeichen einsetzen — die Anleitung im Abschnitt nennt die Schritte.

## v4.84 — 2026-08

### Bugfixes
- **`bl:Sachsen` lieferte 536 Anträge aus Sachsen-Anhalt mit.** Der Grund: „Sachsen" steckt in „Sachsen-Anhalt". Die Suche nach einem Bundesland vergleicht jetzt das Land, statt im Namen zu suchen — `bl:Sachsen` findet 2.742 statt 3.278 Anträge, und alle 2.742 sind wirklich aus Sachsen.
### Verbesserungen
- **Kürzel oder ausgeschrieben ist jetzt egal.** `bl:SN` und `bl:Sachsen` liefern dasselbe; man muss nicht mehr wissen, in welcher Schreibweise das Land in den Daten steht. Beim Tippen zeigt die Suche wie bisher schon nach den ersten Buchstaben etwas an.

## v4.83 — 2026-08

### Neu
- Die Antrags-Detailseite hat oben links einen Rückweg, der sagt, woher man kam: „← Suche", „← Vorgangs-Board", „← Startseite". Auch das Schließen (×) führt jetzt dorthin — nicht mehr pauschal in die Förderanträge-Tabelle. Wer aus der Antragsliste kommt, sieht keinen Knopf: die Liste steht ja daneben.
### Verbesserungen
- Suchanfrage, Filter und Deutung überstehen ein Neuladen der Seite. Man kommt also auch nach einem F5 wieder auf dieselben Treffer; erst ein neues Fenster fängt leer an.
- Der Rückweg bleibt auch dann stehen, wenn man im Detail von einem Teilvorhaben zum nächsten springt.
### Bugfixes
- Ein Klick auf ein Aktenzeichen im Vorgangs-Board öffnet den Antrag wieder, statt „Antrag … nicht gefunden" zu melden. Betroffen war jeder Antrag, der zu einem Verbund gehört.
- Alte Lesezeichen und Verlaufs-Einträge mit einer Verbund-Nummer in der Adresse öffnen jetzt den Verbund, statt in derselben Fehlermeldung zu enden.

## v4.82 — 2026-08

### Neu
- Das Bundesland ist ein eigenes Suchfeld: `bl:Sachsen` (oder `bl:SN`) sucht nur noch Länder, `ort:Dresden` nur noch Orte. Beide haben eine eigene Spalte in der Ergebnistabelle.
### Verbesserungen
- Die Vorschlagsliste unter `ort:` zeigt jetzt Städte statt Bundesländer — vorher standen dort fast nur die 16 Länder, weil jeder Antrag eines trägt.
- Im Reiter „Stöbern" stehen Ort und Bundesland als zwei getrennte Spalten.
### Bugfixes
- Aus der Ortsliste sind die rohen Länderkürzel („SN", „BW", „NW", „BY") verschwunden. Sie stammten aus einer Quelle, deren Import Ort, PLZ und Bundesland in dasselbe Feld schrieb.

## v4.81 — 2026-08

### Neu
- **Die Kürzel-Liste zeigt nur noch, was wirklich läuft.** Von den gut 500 Kürzeln kommt knapp die Hälfte in keiner unserer CSV-Quellen vor — das Fachsystem setzt sie vielleicht, unsere Daten zeigen sie nie. Sie stehen jetzt zugeklappt unter „Nicht im Blick" statt zwischen den arbeitenden. Gelöscht wird nichts, und ein Häkchen holt jedes Kürzel zurück.
- **Ein Durchgang „Am Bestand messen" sagt zusätzlich**, welche Kürzel zwar eine Spalte haben, in den letzten beiden Richtlinien aber nicht mehr gesetzt wurden — mit einem Knopf lassen Sie diese ruhen.
### Verbesserungen
- **Die Auswahlliste beim Bauen einer To-do-Regel ist nur noch halb so lang.** Sie bot bisher auch Kürzel an, auf die eine Bedingung nie zutreffen konnte.
- **Die Klärfragen fragen nicht mehr nach Kürzeln, über die sich am Bestand nichts belegen lässt.** Wie viele ausgelassen wurden, steht über der Liste.
- **Ruhende Kürzel mit Relevanz-Häkchen werden benannt** — das Häkchen wirkt dort nicht, und ein Knopf räumt sie ab.
### Bugfixes
<!-- - … -->

## v4.80 — 2026-08

### Neu
<!-- - Kurzer, verständlicher Satz (nur bei nutzersichtbaren Änderungen) -->
### Verbesserungen
- **Der Assistent in der Suche beginnt jetzt jedes Mal neu.** Bisher stand beim Öffnen die letzte Unterhaltung wieder da — oft zu einer ganz anderen Suche, und die KI trug ihre alte Antwort in die neue Frage hinein. Frühere Unterhaltungen sind über das Uhr-Symbol weiterhin erreichbar.
- **Löschen liegt jetzt im Kopf des Panels** (Papierkorb neben dem Verlauf), nicht mehr nur im Aufklapper. Er erscheint, sobald in der Unterhaltung etwas steht.
- **Zieht Ihre Suche weiter, während ein Gespräch läuft**, steht darüber, zu welcher Suche es gehört — mit einem Knopf „neu beginnen". Automatisch gelöscht wird nichts: die Stichwortsuche läuft mit jedem Tastendruck, und eine Antwort, die Sie gerade lesen, soll nicht verschwinden, weil Sie die Anfrage nachschärfen.
### Bugfixes
<!-- - … -->

## v4.79 — 2026-08

### Neu
- **Die Verfahrensschritte lassen sich getrennt von den Kürzeln sichern und einspielen.** In den Vorgangs-Regeln gibt es im Reiter „Statuswerte" jetzt „Phasen exportieren" — die Datei enthält nur die Schritte, die Zuordnung der Statuswerte und die Zieltage. Eingelesen wird sie über denselben „Importieren"-Knopf wie bisher; die Kürzel bleiben dabei unangetastet.
- **In der Fassungsliste steht neben „Als Entwurf laden" jetzt „Nur Phasen übernehmen".** Damit holen Sie aus einer älteren Fassung allein den Verfahrensschnitt zurück, wenn die heutige Fassung die richtigen Kürzel hat, aber die falschen Schritte. Danach steht über der Seite, was sich dadurch geändert hat.
### Verbesserungen
<!-- - … -->
### Bugfixes
<!-- - … -->

## v4.78 — 2026-08

### Neu
<!-- - Kurzer, verständlicher Satz (nur bei nutzersichtbaren Änderungen) -->
### Verbesserungen
- **Der Assistent bekommt jetzt 40 Ihrer Suchtreffer statt 8** — und zu jedem die Kurzbeschreibung, die Relevanz und die Stellen, an denen das Suchwort gefunden wurde. Vorher kannte er nur Titel und Antragsteller und musste sich den Rest zusammenreimen.
- **Der Hinweis über dem Gespräch sagt jetzt, wie viel davon wirklich ankommt** („Kontext: 40 von 517 Treffern"). Bisher nannte er die volle Trefferzahl, obwohl nur acht Treffer mitgingen — die KI hielt diese acht für die ganze Liste und urteilte über die übrigen, die sie nie gesehen hatte. Jetzt steht ihr das ausdrücklich im Auftrag, und sie sagt es Ihnen in der Antwort.
### Bugfixes
- Bei der Suche mit einer Frage stand unter den Suchbegriffen „nicht berücksichtigt: hauptsächlich · Vorhaben". Beides stimmte nicht: „Vorhaben" ist das Wort für das, was ohnehin gesucht wird, und „hauptsächlich" beantwortet die Reihenfolge der Treffer — Vorhaben, die alle gefragten Themen behandeln, stehen oben.

## v4.77 — 2026-08

### Neu
<!-- - Kurzer, verständlicher Satz (nur bei nutzersichtbaren Änderungen) -->
### Verbesserungen
- Die Knöpfe zum Ein- und Ausklappen der Leisten zeigen jetzt überall dasselbe schlichte Pfeilzeichen — ohne Kasten drumherum, und in derselben Größe, egal ob Navigation, Filterleiste oder Antragsliste.
- Wo die Fördertabelle an die Filterleiste stößt, sind ihre linken Ecken gerade statt gerundet — die kleine Kerbe neben der geraden Kante der Leiste ist weg.
- Die Trefferzahl unter der Liste („60 Teilvorhaben · 40 Verbund-Zeilen") steht jetzt genau unter den Auswahl-Kästchen der Tabelle statt ein Stück weiter links.
### Bugfixes
<!-- - … -->

## v4.76 — 2026-08

### Verbesserungen
- Filterleiste und Tabellenkopf beginnen jetzt auf derselben Höhe: Die eingeblendete Filterleiste sitzt nicht mehr über der Tabelle, sondern bildet mit deren Kopfzeile ein durchgehendes Band. Der weiße Streifen dazwischen ist weg.
- Die Zeile mit den Filter-Pillen steht jetzt über der Filterleiste statt daneben — sie bleibt beim Ein- und Ausklappen der Leiste an ihrer Stelle.
- Im Kopf der Leiste steht „FILTER" auf einer Linie mit den Spalten-Rubriken; die Anzahl der aktiven Filter erscheint dort farbig, sobald etwas filtert.

## v4.75 — 2026-08

### Verbesserungen
- Der Knopf **„Aufnehmen" heißt jetzt „Antragsdokumente"** und erklärt beim Draufzeigen, was er tut: ZIP oder einzelne PDF/DOCX ablegen, das Förderkennzeichen kommt aus dem Dateinamen, die Dateien landen als Text unter dem Antrag in Ihrem persönlichen Ordner.
- Der **Feedback-Knopf** liegt jetzt in der abgerundeten Ecke des Blattes, statt darüber zu schweben.
- Wer die Fördertabelle schmaler zieht, macht jetzt die **ganze** Tabelle schmaler: der Rahmen endet mit der letzten Spalte, statt eine leere Fläche einzurahmen.
- Der Griff dafür sind wieder **drei Punkte oben rechts** an der Tabelle — der Streifen über die volle Höhe neben dem Scrollbalken ist weg.
- Das Menü **„Darstellung" heißt jetzt „Ansicht"**.
- Die Trefferzahl („60 Teilvorhaben · 40 Verbund-Zeilen") steht nun **unten links unter der Liste** statt zwischen den Filtern.
- In der **Filterleiste sind rund zwei Merkmale mehr sichtbar**: Seitenkopf und Merkmals-Abstände sind knapper.

## v4.74 — 2026-08

### Verbesserungen
- Die Größe des Bestands (**„Index: 14.225 Anträge"**) steht jetzt oben neben dem Titel „Suche" statt unten rechts zwischen den Sucheinstellungen. Die Zahl der Textabschnitte ist weggefallen: sie zählte Stücke von Dokumenten, während die Seite Anträge findet.
- Das Menü **„Darstellung"** sitzt jetzt rechts, direkt vor dem Export — und erscheint nur noch in der Listenansicht. In der Tabelle hatten seine beiden Einstellungen keine Wirkung: dort sortieren Sie über die Spaltenköpfe, und eine Zeilenhöhe gibt es nicht.
- **„Warum?" erscheint nur noch nach einer Frage in natürlicher Sprache.** Dort erklärt die KI, warum ein Treffer zu Ihrer Frage passt. Bei einer Feldsuche wie `ast:"EurA AG"` trifft jede Zeile aus demselben Grund — und der steht angestrichen schon in der Zeile. Der Knopf heißt dann **„Mehr"** und öffnet weiterhin *Antrag öffnen*, *Ähnliche Anträge* und *Als unpassend melden*, ohne die KI zu bemühen.

## v4.73 — 2026-08

### Neu
- Der Einstieg in die Suche steht jetzt in **einem Kasten mit Reitern**: *Alle · Zuletzt · Suchsprache · Fragen · Stöbern*. Vorher lagen sechs Blöcke untereinander, und die Seite scrollte. Der Reiter, den du zuletzt offen hattest, ist beim nächsten Mal wieder da.
- **Stöbern** zeigt, was im Bestand überhaupt steht: die häufigsten Deskriptoren, Netzwerke, Einrichtungen und Orte — jeweils mit der Trefferzahl, die nach dem Klick auch dasteht. Für die vollständige Liste tippst du weiterhin `deskriptor:` ins Suchfeld.

### Verbesserungen
- Die Suchbeispiele stehen nach Zweck sortiert: *ein Thema suchen*, *über eine Kennung*, *wer und wo*, *eigenes* — statt als eine Liste von zehn.
- „Aus dem Index" ist als eigener Block weggefallen: die Bestandszahlen standen ohnehin schon in der Optionszeile über dem Ergebnis.

## v4.72 — 2026-08

### Neu
- Eine ganze **Status-Phase** lässt sich anpinnen: die Nadel an der Phasen-Zeile macht daraus einen Schalter „Phase Eingang (2)" über der Tabelle.
- **Datumsspannen und lange Auswahllisten** lassen sich jetzt ebenfalls anpinnen. Dort wird die Einstellung festgehalten, die gerade gesetzt ist — etwa „Fristdatum · ab 01.01.2025". Steht nichts drin, gibt es auch nichts anzupinnen, und die Nadel bleibt weg.

### Verbesserungen
- Eine steckende Nadel bleibt sichtbar, ohne dass man mit der Maus darüberfahren muss — man sieht also, was oben liegt.
- Datumsangaben in den Filter-Chips stehen deutsch statt `2025-01-01`.

## v4.71 — 2026-08

### Neu
- Das Suchfeld schlägt vor, während du tippst: „or" wird zu `ort:`, und danach kommen die Werte, die es im Bestand wirklich gibt — mit der Trefferzahl daneben.
- `deskriptor:` zeigt den ganzen Katalog: 43 feste Schlagworte, die bisher nirgends in der App standen. Genauso die Netzwerknamen, die Einrichtungen, die Orte und die Wahlkreise.
- Mehrere Wörter als ein Wert: `ort:"Frankfurt am Main"`. Die Anführungszeichen setzt die Vorschlagsliste selbst. Ohne Feld geht das auch — `"additive Fertigung"` sucht die Wortfolge.

### Verbesserungen
- Der Filter-Verlauf (Uhr-Zeichen) ist deutlich breiter und bricht lange Einträge auf zwei Zeilen um. Vorher endeten mehrere Einträge gleich, weil genau der unterscheidende Teil hinten abgeschnitten wurde.
- Das Uhr-Zeichen steht jetzt direkt neben „Filter" statt am rechten Rand; die Anzeige „N aktiv" ist dorthin gerückt.

### Bugfixes
- Ein Feldwert aus mehreren Wörtern zerfiel bisher in Einzelwörter und suchte etwas anderes: `ort:Frankfurt am Main` lieferte bei „irgendein Wort genügt" 6.365 statt 40 Anträge.

## v4.70 — 2026-08

### Verbesserungen
- **„Aufnehmen" und der Export stehen jetzt rechts oben** in der Titelzeile neben „Hilfe" — am Ende der Reiterleiste standen sie zwischen Sichten und Suche etwas verloren.
- **Die Trefferzahl belegt keine eigene Zeile mehr.** „38 Teilvorhaben · 22 Verbund-Zeilen" steht jetzt rechts bei „Darstellung" und „Spalten".
- **Der Chip im Kopf sagt nur noch „Anzeige: letzte 3 Richtlinien".** Wie viele Programme das sind und wie viele alte Anträge dadurch draußen bleiben, steht beim Darüberfahren — und wieder im Chip, sobald Sie einzelne Programme abwählen.
- **Aus „Status in dieser Sicht" wurde „Status".** Die Zeile braucht ihre Breite für die Filter; dass die Zahlen innerhalb des gewählten Reiters zählen, steht beim Darüberfahren.

### Bugfixes
- **Die Tabelle klebte oben am grauen Bereich.** Kopfzeile und Werkzeugleiste sind wieder weiß, grau bleiben nur die Filterleiste und der Tabellenkopf — die Tabelle hat ihre eigene Oberkante zurück.
- In der Filterleiste standen unter „Filter" **zwei Trennlinien direkt übereinander**; jetzt ist es eine.

## v4.69 — 2026-08

### Verbesserungen
- **Die Einstellungen unter dem Suchfeld stellen jetzt Fragen.** Jeder Auswahlkasten sagt selbst, worum es geht: **„Suche mit: Stichworten"** · **„Suche in: alle Felder"** — und rechts davon, abgesetzt durch einen dünnen Strich, die Feinheiten. Vorher stand „Wortverknüpfung:" daneben, und aufgeklappt war diese Beschriftung verdeckt.
- **Die Wortverknüpfung sagt, was sie tut,** statt es zu benennen: **„alle Wörter müssen vorkommen"**, **„irgendein Wort genügt"**, **„genau diese Wortfolge"**.
- **Der Suchbereich steht jetzt weiter links,** gleich hinter der Art der Suche. Er entscheidet mit, ob ein Antrag überhaupt gefunden werden kann — das ist keine Feinheit.
- **Aus „mit natürlicher Sprache suchen" wurde „Suche mit: einer Frage".** Überall sonst auf der Seite hieß es ohnehin schon Frage.

## v4.68 — 2026-08

### Verbesserungen
- **Die beiden Haken in der Suche heißen jetzt so, dass man sie unterscheiden kann.** Aus „Wortformen mitsuchen" und „Ähnlichkeitssuche" wurde **„auch andere Wortformen"** und **„auch ähnliche Themen"** — links geht es um dasselbe **Wort** in anderer Form, rechts um dasselbe **Thema** in anderen Wörtern. Bisher musste man beide Erklärungstexte lesen und vergleichen.
- **Am rechten Haken steht jetzt „(lädt 200 MB)".** Er lädt beim ersten Mal ein Sprachmodell auf Ihren Rechner; das sollte an der Beschriftung stehen und nicht erst im Tooltip.

## v4.68 — 2026-08

### Neu
- **Sie können die gefundenen Wortformen von der KI prüfen lassen.** Der Wortstamm-Vergleich ist sprachlich: „normotherme" und „Normung" fangen wirklich gleich an, handeln aber von Verschiedenem. Ein Klick auf „von der KI prüfen" sortiert solche Wörter aus — sie stehen danach durchgestrichen da und lassen sich einzeln zurückholen. Ohne KI funktionieren die Wortformen wie bisher sofort.

### Verbesserungen
- **Im Frage-Modus stehen nur noch die Einstellungen, die dort auch gelten.** „Wortverknüpfung" und „Wortformen mitsuchen" bestimmt die KI aus Ihrer Frage — sie sind deshalb ausgeblendet statt ausgegraut. Der Suchbereich bleibt sichtbar, sobald er Treffer wegnimmt.
- **Eine Frage wird erst gesucht, wenn Sie sie stellen.** Vorher lief Ihr halb getippter Satz schon als Stichwortsuche mit und zeigte 0 Treffer. Jetzt steht dort der Hinweis, dass die Frage noch nicht gestellt ist.
- **Die acht gezeigten Wortformen sind die häufigsten** aus Ihren Treffern statt einer zufälligen Auswahl.

### Bugfixes
- **„Wortformen mitsuchen" schlug Wörter vor, die nur zufällig dieselben Buchstaben enthielten** — zu „Normen" etwa „enormes". Der Wortstamm zählt jetzt nur noch dort, wo ein Wort beginnen kann. Zusammensetzungen wie „Kalibrierstandards" bleiben selbstverständlich erhalten.
- **Ist die interne KI nicht erreichbar, kommt wieder die Aufforderung, sie zu verbinden** — statt einer technischen Fehlermeldung („Failed to fetch"). Ist ein direkter KI-Server eingestellt, der nicht antwortet, nennt der Hinweis seine Adresse.

## v4.67 — 2026-08

### Neu
- **Sie können sich einen eigenen Reiter einrichten.** Stellen Sie die Förderanträge-Liste so ein, wie Sie sie brauchen — Reiter, Filter, Ansicht, Spalten, Spaltenbreiten, Auswahl in den Spaltenköpfen — und merken Sie sich das Ganze über das Lesezeichen am Ende der Reiterleiste unter einem Namen. Ein Klick auf den Reiter stellt alles wieder her.
- **Der Reiter ist markiert, solange Sie darin arbeiten.** Sobald Sie etwas umstellen, leuchtet wieder der feste Reiter darunter — und Sie können Ihren eigenen im Menü mit einem Klick auf den neuen Stand bringen. Eine gezogene Spaltenbreite gilt dabei nicht als anderer Arbeitsplatz.
- Bis zu vier eigene Reiter, jederzeit umzubenennen und zu entfernen.

### Verbesserungen
- **Die Auswahl in den Spaltenköpfen der Fördertabelle bleibt jetzt über einen Neustart erhalten** — wie die Sortierung und die Filterleiste. Wo eine Auswahl liegt, zeigt der gefüllte Trichter am Spaltenkopf samt Anzahl.

## v4.66 — 2026-08

### Neu
- **Sie können der Suche jetzt eine Frage stellen.** Über dem Suchfeld auf „mit natürlicher Sprache suchen" umschalten, die Frage eintippen — „Welche Vorhaben drehen sich hauptsächlich um Normung und Standards?" — und Enter drücken. Bisher fand genau dieser Satz nichts: gesucht wurde nach den Wörtern, die darin stehen.
- **Sie müssen die Schreibweisen nicht mehr erraten.** Die interne KI benennt sie: Wer nach Normung fragt, findet auch „Normen", „Normierung" und „Standardisierung" — Wörter, die im Bestand stehen, aber nicht in der Frage.
- **Sie sehen, wonach gesucht wurde, und können es korrigieren.** Über dem Ergebnis stehen die gefundenen Begriffe als Chips. Ein Klick nimmt einen heraus, und die Liste rechnet sofort neu — ohne dass die KI noch einmal gefragt wird. Was aus Ihrer Frage nicht übersetzt werden konnte, steht dort ebenfalls.
- **Vorhaben, die wirklich davon handeln, stehen oben.** Wer nach zwei Themen fragt, bekommt die Vorhaben zuerst, die beide behandeln — nicht die, die eines davon einmal am Rand erwähnen. Ortsangaben wie „in Bayern" schränken dabei ein, statt weitere Treffer dazuzuholen.

### Verbesserungen
- Auf der Startseite der Suche stehen unter „Oder stell eine Frage" drei Beispiele zum Ausprobieren.
- Nach einer Frage öffnet sich das KI-Panel rechts mit Ihrer Frage im Eingabefeld — abgeschickt wird sie nicht, Sie entscheiden, ob Sie nachfassen wollen.

> Die Frage-Suche braucht die interne KI. Ist sie nicht verbunden, sagt die App das und bietet das Verbinden an; Ihre Eingabe bleibt stehen. Die gewohnte Stichwortsuche ändert sich dadurch nicht.

## v4.65 — 2026-08

### Neu
- **Der Reiter „Fristen"** zeigt alles, bei dem die Uhr läuft — überfällig zuoberst, darunter, was in den nächsten Wochen ansteht. Er ersetzt „Diese Woche" und „Überfällig", die dasselbe an zwei Stellen zeigten.
- **Ein Verlauf Ihrer Filter**: das Uhr-Symbol oben in der Filterleiste öffnet die zuletzt benutzten Filterstände. Ein Klick stellt einen davon wieder her; wer denselben öfter braucht, kann ihn anpinnen.

### Verbesserungen
- **Vier Reiter statt sechs**: Antragsphase, Fristen, Begleitung, Alle. „Bewilligt 2026" ist entfallen — dort war nie etwas zu tun; die Menge lässt sich über Status und Bewilligungsdatum filtern und anpinnen.
- **Filter, die in Ihrer Sicht nichts bringen, werden ausgeblendet.** In der Antragsphase stand bisher „Bewilligt 0", „Begleitung 0" und „Beendet 0" — Knöpfe, die zu einer garantiert leeren Liste führten.
- **Die Sortierung steht im Menü „Darstellung"** (in der Listen- und Kartenansicht). In der Tabelle sortieren wie bisher die Spaltenköpfe. Die Zeile über der Tabelle wählt damit nur noch aus, WELCHE Anträge zu sehen sind.
- **Die Schnellauswahl in der Filterleiste ist entfallen** — sie war eine Kopie der Reiter darüber und zeigte dieselben Zahlen zweimal.

### Bugfixes
- **Die Status-Pille sagt nicht mehr „Alle", wenn gefiltert wird.** Haben Sie in der Filterleiste einzelne Stati angehakt, steht jetzt „Eigene Auswahl" — vorher behauptete die Pille das Gegenteil dessen, was die Liste zeigte.

## v4.64 — 2026-08

### Verbesserungen
- **Weniger Knöpfe über der Tabelle.** Die drei Symbole für Liste, Tabelle und Karten stehen jetzt im Menü „Darstellung" unter „Ansicht" — die Tabelle ist dabei die neue Standard-Ansicht. Der Knopf „Filter" ist ans Suchfeld gerückt, an die Seite, auf der die Filterleiste aufgeht.
- **Das Auswahlfeld „Ohne Ähnlichkeitssuche" ist verschwunden.** Sobald Sie suchen, steht unter dem Feld, was gerade gefunden wird, und daneben „Auch inhaltlich ähnliche einbeziehen". Der Weg zurück steht an derselben Stelle.
- **Filterleiste und Tabellenkopf stehen auf einer gemeinsamen hellgrauen Fläche**; der Trennstrich dazwischen entfällt. Das Häkchen „inaktive MAs" ist als Abschnitt **Bestand** in die Filterleiste gezogen.

### Bugfixes
- **Die Suche findet wieder in Dokumenten.** Sie durchsucht jetzt immer auch den Volltext der aufgenommenen Dokumente — bisher ging das nur mit eingeschalteter Ähnlichkeitssuche, obwohl das Suchfeld die Dokumente stets mit angeboten hat.

## v4.63 — 2026-08

### Neu
- **Anträge auswählen und weiterverarbeiten:** Häkchen je Zeile, eines im Spaltenkopf für die ganze Liste. Unten erscheint eine Leiste — die Auswahl als Excel-Tabelle exportieren oder ihre Förderkennzeichen kopieren.
- **Filter anpinnen:** Was Sie oft brauchen, ziehen Sie mit der Nadel aus der Filterleiste nach oben — als Schalter über der Tabelle. Einzelne Werte, ganze Merkmale oder eine gespeicherte Kombination.
### Verbesserungen
- **Die Filterleiste steht jetzt links**, dort wo man mit dem Einschränken anfängt. Der Knopf oben rechts heißt „Filter" und nennt, wie viele aktiv sind.
- **Kurzname und Förderkennzeichen stehen zusammen** in der ersten Spalte, die beim Blättern nach rechts stehen bleibt. Beides gibt es weiterhin auch einzeln.
- **Zeilenhöhe wählbar** (Darstellung → Zeilendichte), und die ⓘ-Zeichen in den Status-Zellen zeigen sich erst, wenn Sie über die Zeile fahren — die Tabelle wirkt dadurch ruhiger.
### Bugfixes

## v4.62 — 2026-08

### Neu
- **Spaltensätze statt Einzelhaken:** Im Menü „Darstellung" stehen jetzt vier fertige Sätze — Standard, Triage, Fristen und Alle. „Triage" zeigt Frist, Status, Zuständigkeit und Titel und passt ohne seitliches Scrollen auf den Bildschirm.
- **Gruppierung nach Frist:** Die Tabelle lässt sich nach Dringlichkeit bändern — überfällig, noch ≤ 14 Tage, noch ≤ 30 Tage, mehr als 30 Tage, ohne laufende Frist.
- **Zwei zusammengefasste Spalten:** „Zuständig" zeigt FB- und AB-Kürzel nebeneinander, „FB / PreCheck" beide Stände in einer Spalte. Der volle Wortlaut steht beim Überfahren.

### Verbesserungen
- **Die Frist steht jetzt vorn** statt am rechten Rand — direkt hinter dem Förderkennzeichen.
- **Farbige Kante am Zeilenanfang** zeigt die Dringlichkeit auf einen Blick: rot bei überfällig, orange unter 14 Tagen, gelb unter 30. Wer Luft hat, bekommt keine — so fällt auf, wo etwas ansteht.

## v4.61 — 2026-08

### Neu
- Klappen Sie eine Tabellenzeile auf, zeigt die Chronik jetzt die **acht jüngsten Einträge** — was zuletzt passiert ist, ohne den ganzen Aktenvorgang. Darüber steht, wie viele ältere es gibt; ein Klick zeigt sie.

### Verbesserungen
- „Status & Verlauf" auf der Detailseite öffnet mit der **Chronik nach Datum** — dieselbe Ansicht wie im Ausklapp der Tabelle. Die Matrix „nach Schritt" bleibt einen Klick entfernt, und Ihre eigene Wahl gilt danach wieder.
- Die Teilvorhaben in der Chronik heißen im Ausklapp jetzt **„TV 1", „TV 2" …** wie überall sonst, statt der Endung des Aktenzeichens („…430").
- Der Reiter mit der Zeitachse heißt an beiden Stellen **„Zeitstrahl"** — es war dasselbe Bild unter zwei Namen.

## v4.60 — 2026-08

### Bugfixes
- **Der Schalter „Kurator-Menüs" wirkt jetzt vollständig.** Bisher machte er die Kurations-Seiten nur sichtbar — die Schaltflächen darin blieben grau, etwa „Mapping bearbeiten" oder „Spalten neu mappen". Jetzt genügt der Schalter; nach dem Umlegen können Sie sofort arbeiten.
- **Auf „Datenpflege → CSV-Quellen" war jede Quelle unlesbar.** Die Zeile mit Kennung, Zeilenzahl und letztem Import war zu einer schmalen Säule gequetscht, über der die Knöpfe lagen. Die Liste nimmt jetzt die volle Breite; der Zustand (Quellen, Zeilen, letzter Import, neuere Datei) steht als Streifen darüber. Bei schmalem Fenster rutschen die Knöpfe unter den Text, statt ihn zu verdecken.

### Verbesserungen
- In der Tabellen-Ansicht der Förderanträge teilen sich die Spalten jetzt **immer die verfügbare Breite**. Rechts bleibt nichts mehr leer, und wird die Fläche schmaler oder breiter, ändern sich alle Spalten gleichmäßig mit.
- **Der Griff am rechten Tabellenrand kann zweierlei**: Ziehen macht die ganze Tabelle breiter oder schmaler, ein Klick schaltet auf Inhaltsbreite um — dann nimmt sich jede Spalte, was ihr Text braucht, und die Tabelle scrollt seitwärts. Der nächste Klick schaltet zurück; die Wahl bleibt über einen Neustart erhalten. Der Griff ist etwas breiter geworden und damit leichter zu treffen.

### Bugfixes
- Ein Klick auf den Griff, ohne zu ziehen, legte die Tabellenbreite versehentlich fest. Jetzt zählt nur noch eine echte Ziehbewegung.

## v4.59 — 2026-08

### Neu
- **Zurückgenommene Vorgänge verschwinden nicht mehr aus dem Verlauf.** Wird im Fachsystem ein Kürzel gelöscht oder sein Datum korrigiert, überschreibt der Nacht-Export die Spalte — bisher war die alte Zeile am nächsten Tag spurlos weg. Jetzt steht sie durchgestrichen an ihrem alten Tag: „ART · Rücknahmeempfehlung techn. erstellt · zurückgenommen zwischen 12.08. und 14.08." bzw. „AL · Nachlieferung Eingang · verschoben auf 11.08.2026".
- Datum und Kürzel bleiben dabei lesbar — mit ihnen findet man den Vorgang im Fachsystem wieder. Wie viele es sind, steht oben in der Zeile mit den Kennzahlen; die Legende am Fuß erklärt das Zeichen.
- **Darunter steht immer, ab wann das belegt ist.** Vor diesem Tag hat der Export frühere Setzungen überschrieben und sie sind nicht mehr rekonstruierbar. Vorgänge, für die kein Änderungs-Journal geführt wird, sagen das ausdrücklich — das ist etwas anderes als „es wurde nichts zurückgenommen".

### Bugfixes
- **„Auf diesem Daten-Share wird kein Änderungs-Journal geführt" erschien manchmal, obwohl eines läuft.** Wer eine Antragsseite direkt nach dem Start öffnete, las diesen Satz, weil der Datenordner noch nicht bereitstand. Jetzt wartet die Anzeige, statt etwas Falsches zu behaupten. Betraf auch die Sektion „Historie".

## v4.58 — 2026-08

### Verbesserungen
- **Ein selbst gestarteter CSV-Import zeigt jetzt, was er gerade tut.** Statt eines stillen „Importiere…" laufen Fortschrittsbalken, Prozentzahl und der Name der Quelle mit („2/3"). Bei mehreren Quellen dauert der Lauf einige Minuten — das ist normal, und man sieht es ihm jetzt an.
- **Am Ende steht „Fertig".** Vorher verschwand nur der Knopf, und nichts sagte, dass man das Fenster wieder schließen kann.
- **Die Abschlussmeldung sagt, ob sich wirklich etwas geändert hat.** „2 Quellen importiert" hieß bisher nur, dass gelesen wurde. Jetzt steht dabei, ob Anträge geändert wurden oder ob der neue Export inhaltlich derselbe war — dann bleibt die Liste zu Recht gleich.
- Das Fenster darf während des Laufs geschlossen werden: der Import läuft weiter, und der Fortschritt wandert in die Leiste am oberen Rand.

### Bugfixes
- **Bleibt eine Quelle an geänderten Spalten hängen, ist der Bericht jetzt erreichbar** — samt „Trotzdem importieren". Vorher verwies die Meldung auf einen Hinweis, der an dieser Stelle nie erschien.

## v4.57 — 2026-08

### Neu
- **Eine eigene Spalte lässt sich jetzt ans Team weitergeben.** Wenn Sie eine Spalte angelegt und erprobt haben, steht beim Bearbeiten *Ins Team übernehmen* — danach sieht sie jede Kollegin im Menü *Spalten* unter „Team-Spalten" und kann sie einblenden.
- Angelegt wird weiterhin **erst für Sie allein**. So können Sie in Ruhe ausprobieren; geteilt wird bewusst in einem zweiten Schritt.

### Verbesserungen
- **Die Standardfelder zeigen jetzt, woraus sie entstehen.** In der Feldauswahl steht hinter `antragsdatum` das Kürzel des Fachsystems, aus dem es gebildet wird (`← D_AAE`) — und Sie können auch nach diesem Kürzel suchen.
- Beim Bearbeiten steht jetzt oben, **wen die Spalte betrifft** — nur Sie auf diesem Gerät, oder das ganze Team.
- Nach dem Übernehmen bleibt die Spalte in Ihrer Tabelle stehen, wo sie war — sie wechselt nur die Rubrik.
- Team-Spalten pflegt, wer auch sonst im Daten-Ordner schreiben darf. Alle anderen sehen und benutzen sie ganz normal.

## v4.56 — 2026-08

### Neu
- **Eigene Spalten können jetzt nach Regeln anzeigen.** Sie legen Regeln in einer Reihenfolge fest — „wenn Ablehnung gesetzt ist, zeig *abgelehnt*" — und die erste zutreffende gewinnt. Trifft keine zu, steht Ihr Auffangtext da (oder die Zelle bleibt leer).
- Die Reihenfolge ist die Aussage: **sortiert wird nach Ihrer Rangfolge**, nicht alphabetisch. Was Sie oben einsortieren, steht beim Sortieren auch oben.
- Die Bedingungen bauen Sie mit demselben Baukasten wie bei Meilensteinen und Vorgangs-Regeln — Feld, Vergleich, Wert, ohne Tippen von Formeln.

### Verbesserungen
- **Eigene Spalten lassen sich bearbeiten und entfernen**: im Menü *Spalten* steht neben jeder eigenen Spalte ein Stift. Vorher konnte man sie nur ausblenden — und Ausblenden ist nicht Löschen.
- **Text oder Farbe einer Regel zu ändern geht sofort.** Nur wenn Sie ein bisher ungenutztes Feld hinzunehmen, wird die Tabelle einmalig neu aufgebaut.

## v4.55 — 2026-08

### Neu
- **Sie können eigene Spalten anlegen.** Unten im Menü *Spalten* steht „Eigene Spalte anlegen". Zur Wahl stehen alle Felder, die das Förderprogramm führt — auch solche, die es bisher in keiner Spalte gab.
- Zwei Sorten: ein **einzelnes Feld** unverändert anzeigen, oder aus **mehreren Datumsfeldern** den jeweils jüngsten (oder ältesten) Termin. Die zweite Sorte funktioniert wie *FB Status*, nur mit Ihrer eigenen Auswahl.
- Bevor Sie speichern, zeigt eine **Vorschau an echten Zeilen**, was in der Spalte stünde. Eine Spalte, die überall leer bliebe, sehen Sie damit vorher statt nachher.
- Ihre Spalten gehören **Ihnen und diesem Rechner**. Sie werden nicht geteilt und nicht auf das Laufwerk geschrieben.
- Beim Anlegen einer Spalte mit einem bisher ungenutzten Feld wird die Tabelle **einmalig neu aufgebaut** (wenige Sekunden). Beschriftung später zu ändern kostet das nicht.

## v4.54 — 2026-08

### Neu
- **Die Spaltenköpfe der Fördertabelle erklären sich.** Fahren Sie einen Kopf an, und es steht da, was die Spalte zeigt, nach welcher Regel sie ihren Wert wählt und aus welchen Feldern sie sich speist — mit den Kürzeln des Fachsystems und deren Klartext. Bei *PreCheck Status* sind das neun Felder, bei *FB Status* elf.
- Die Feldliste ist nicht abgeschrieben, sondern kommt aus dem geladenen Programm. Ändert die Kuration ein Mapping, ändert sich der Hinweis mit.
- Bleibt eine Spalte leer, sagt sie warum: „In diesem Programm ist dafür keine Spalte gemappt." Vorher war eine leere Spalte nicht von einer unbefüllten zu unterscheiden.
- Dieselbe Erklärung steht im Menü **Spalten** hinter dem ⓘ — dort, wo Sie entscheiden, ob Sie die Spalte einblenden.
### Verbesserungen
<!-- - … -->
### Bugfixes
<!-- - … -->

## v4.53 — 2026-08

### Neu
- **Suche nach dem Verbundkennzeichen.** `vb:ZKN073232` holt alle Teilvorhaben eines Verbunds auf einmal — bisher gab es dafür keinen Weg über die Suche. Die Spalte „Verbund-Nr." blendet sich dabei von selbst ein.
- **Das Aktenzeichen aus dem Fachsystem findet jetzt auch.** Wer `KNF065624` einfügt, landet beim selben Antrag wie mit `16KN065624`.

### Verbesserungen
- Das Netzwerk-Kürzel heißt in der Suche jetzt `nw:` statt `netz:` — die alte Schreibweise funktioniert weiter.

### Bugfixes
- Beim Tippen stand für einen Moment „0 Treffer", bevor die richtige Liste kam. Jetzt steht dort „… Treffer", bis wirklich gezählt wurde.

## v4.51 — 2026-08

### Neu
- Der Zeitstrahl unter „Status & Verlauf" zeigt jetzt **jeden gesetzten Termin** über der Bahn, in der Farbe der Rolle, die ihn setzt — vorher standen dort nur die Kürzel, die einen Statuswechsel auslösen.
- Unter der Bahn steht ausgeschrieben, was der Balken nicht zeigen kann: fehlende Kürzel in Rot und die Termine ohne eigenen Abschnitt.
- Links neben jeder Bahn: **wer daran gearbeitet hat** („AB 24 · FB 22 · QS 30").
### Verbesserungen
- Die Filterleiste „Wer / Wo" und der Fokus wirken jetzt auch im Zeitstrahl. Eine abgewählte Rolle wird dort blass, statt zu verschwinden — der Verlauf behält seine Form. Der Zeitmaßstab bleibt gleich, auch wenn nur ein Teilvorhaben angezeigt wird.
### Bugfixes
- Wer einen Statuseintrag setzen darf, stand an zwei Stellen und wurde verschieden beantwortet. Es gilt jetzt überall die geladene Katalogfassung — dieselbe Auskunft wie in Chronik, Matrix und Filterleiste.

## v4.50 — 2026-08

### Neu
- Die Suche kennt jetzt das **Netzwerk**. `netz:ProAnimalLife` findet alle 80 Teilvorhaben dieses Netzwerks — und weil auch das Netz-Kennzeichen mitdurchsucht wird, führt `16KN062302` erstmals zu allen Vorhaben des Netzes statt nur zum Netzwerkantrag.
- **Ihre Arbeitsnotizen** („Wichtig" und „Bemerkung") sind durchsuchbar: `notiz:Einbehalt` findet die 50 Vorhaben, bei denen das notiert ist. Dieser Text stand bisher nirgends außer auf der Detailseite des Antrags.
- Der **Wahlkreis** zählt zum Ort: „Northeim" findet 51 statt 1 Vorhaben. Die Auswahl heißt deshalb jetzt „nur Ort, Bundesland & Wahlkreis".

### Verbesserungen
- Sie sehen weiter, **warum** ein Treffer erscheint: Netzwerk, Wahlkreis und Notiz stehen als Beleg in der Trefferzeile und blenden sich in der Tabelle als Spalte ein — wie bisher schon Ort, Deskriptoren und Web-Adresse.
- Die Branchenbezeichnung aus der Fördertabelle zählt zu den Deskriptoren; damit findet „Anstrichmitteln" 12 Vorhaben statt keines.
- Die Suche ist beim ersten Aufruf deutlich schneller startklar, obwohl sie mehr Felder liest.

## v4.49 — 2026-08

### Neu
- Sie können das Feld jetzt direkt in die Suche schreiben: `ast:Fraunhofer` sucht nur beim Antragsteller, `fkz:16KN08` nur im Förderkennzeichen, `ort:Dresden` nur bei Ort und Bundesland. Auch die Spaltennamen der Fördertabelle gehen (`ORG_AST:`, `VB_TITEL:`), und ein Leerzeichen nach dem Doppelpunkt stört nicht.
- Mehrere Felder in einer Anfrage sind erlaubt: `titel:Laser ort:Dresden`. Wörter ohne Feldangabe folgen weiterhin der Auswahl „Suche in".

### Verbesserungen
- Der Startbildschirm der Suche zeigt unter „So kannst du suchen" sechs Beispiele mit Erklärung — vom einfachen Thema bis zur Anfrage über zwei Felder. Ein Klick führt das Beispiel aus.
- Nennen Sie ein Feld, steht es zur Kontrolle im Chip unter dem Suchfeld („Einrichtung: GMBU"). Treffer aus Dokumenten und aus der Ähnlichkeitssuche bleiben dann außen vor — beide können eine Feldangabe nicht einhalten.
- Ihr Kürzel steht jetzt überall so da, wie Ihr Team es schreibt („Kürzel THü", nicht „THÜ") — im Chip, in seinem Menü und in den Meta-Zeilen aller Startseiten-Karten. Bisher zeigte nur die Auswahl im Profil die richtige Schreibweise.

## v4.48 — 2026-08

### Neu
- „Status & Verlauf" hat eine neue Ansicht **nach Schritt**: eine Zeile je Kürzel, eine Spalte je Teilvorhaben. Damit sehen Sie auf einen Blick, wer geliefert hat, wer später — und wo ein Kürzel fehlt. Bisher hieß dafür jedes Teilvorhaben einzeln aufzurufen.
- Eine Spalte **Spanne** zeigt, wie weit die Teilvorhaben bei einem Schritt auseinanderliegen.
- Neue Leiste **Wer / Wo**: nach Rolle (PA, AB, FB, QS, Jur) und nach Teilvorhaben eingrenzen. Beide Ansichten teilen die Auswahl, und ein angeklickter Schritt bleibt beim Wechsel markiert.

### Verbesserungen
- Die Rollen haben jetzt überall dieselbe Farbe — in der Leiste, in der Zeile und in der Matrix. Die Leiste ist damit zugleich die Legende.
- Die chronologische Ansicht nennt die betroffenen Teilvorhaben einzeln statt „3 Teilvorhaben".
- Die Kopfzeile unterscheidet **Schritte** von **Datumsangaben**: vier Teilvorhaben mit demselben Eingangsdatum sind ein Schritt und vier Angaben.
- Einträge, die jeder setzen darf, verschwinden bei einer Rollenwahl nicht mehr, sondern bleiben blass stehen — es sind rund 28 % aller Kürzel.
- In der Ansicht nach Datum hat jeder Monat wieder eine Trennlinie, und die Rollen-Marken sind schmaler: drei nebeneinander passen jetzt in ihre Spalte, statt in den Text daneben zu rutschen.
- Der Balken im Zeitstrahl ist kräftiger — seine Beschriftung stand vorher auf einem Strich statt in einer Fläche.
- Die Chips über dem Verlauf haben jetzt die Form der Marken, die sie erklären: eckig statt rund, ohne Häkchen und dadurch schmaler. Die Teilvorhaben-Chips nennen zusätzlich die Endung des Aktenzeichens („TV 1 …426") — die laufende Nummer ordnet, zitieren lässt sie sich nicht.
- Zahlen in Chips sind wieder lesbar: sie standen in einem Grau, das den Mindestkontrast verfehlte.
- Der Kopf der Startseite ist wieder schlank: Ihr Kürzel steht als Chip direkt neben der Begrüßung, die Angabe zu den angezeigten Richtlinien nur noch bei den Förderanträgen — dort, wo sie auch geändert wird.
- Das Menü hinter dem Kürzel-Chip kommt mit den zwei Optionen und einer Zeile aus. Der frühere Hinweis, Ihr Kürzel bleibe stehen, ist raus: nach dem Umschalten heißt der Chip „Alle Bearbeiter", Ihr Kürzel steht in der Option darunter.

- Die Kürzel-Auswahl im Profil führt die Kürzel so, wie das Team sie schreibt („THü" statt „THÜ") — bei 81 von 112 macht das einen Unterschied, und „THü" und „THu" sind wieder auseinanderzuhalten.
- Die Wege in die Einstellungen zeigen auf die gemeinte Karte: sie wird angesprungen und bleibt umrandet, bis Sie das nächste Mal klicken.

### Bugfixes
<!-- - … -->

## v4.47 — 2026-08

### Neu
- Zwischen „Meine Anträge" und „Alle Bearbeiter" umschalten — über den Chip im Kopf der Förderanträge und der Startseite. Ihr Kürzel bleibt dabei stehen, die Wahl merkt sich der Rechner, und sie wirkt auf beide Seiten samt allen Widgets.
- Die Startseite zeigt jetzt auch, welche Richtlinien gerade gelten und wie viele Anträge dadurch außen vor bleiben.
### Verbesserungen
- Die Kürzel-Auswahl im Profil ist vollständig: Sie finden dort auch Kürzel aus der administrativen Bearbeitung sowie ehemalige Kolleg:innen (als „· ehem." gekennzeichnet).
- Ein einmal gewähltes Kürzel bleibt stehen — bisher sprang die Auswahl bei ehemaligen Bearbeitenden ohne Hinweis auf „Alle" zurück.
### Bugfixes
<!-- - … -->

## v4.46 — 2026-08

### Neu
- **„Statuseinträge" lässt sich zuklappen** und startet zugeklappt. Die Liste aller gesetzten Einträge war der längste Block der Sektion „Status & Verlauf" — wer die Chronik lesen wollte, scrollte an ihr vorbei. Die Anzahl steht weiterhin in der Kopfzeile, ein Klick holt die Liste zurück.
- **„Offene Aufgaben" startet ebenfalls zugeklappt** und merkt sich, wie Sie es zuletzt hatten. Bisher stand der Block bei jedem Antrag wieder offen, egal ob Sie ihn zugeklappt hatten.

### Verbesserungen
- **Aufgaben, die aus der Regel einer anderen Rolle stammen, sind jetzt als „abgeleitet" markiert** — vorher stand dort „geliehen", obwohl die Zählung daneben schon von „abgeleitet" sprach. Gemeint ist beides Mal dasselbe: Für Ihre Rolle ist zu diesem Fall noch keine eigene Regel gepflegt, deshalb zeigt die App, worauf die Regel einer anderen Rolle wartet.
- **Die Antrags-Detailseite ist enger gesetzt.** Zugeklappte Abschnitte brauchen jetzt nur noch ihre Kopfzeile — der Leerraum, der früher unter ihnen hing, ist weg. Aufgeklappt zeigt „Status & Verlauf" damit gut dreimal so viel auf einem Bildschirm wie vorher.

## v4.45 — 2026-08

### Verbesserungen
- **Korrigierte Kürzel-Bezeichnungen wirken jetzt überall.** Wer im Kürzel-Verzeichnis eine Bezeichnung berichtigt, speichert und für das Team freigibt, sieht sie danach auch im **Zeitstrahl** — bisher zeigte der dort einen anderen Text als die Chronik direkt daneben. Auf dem echten Bestand betraf das 111 der 505 Kürzel; `ALQ` las sich links „NF von PL gelesen" und rechts „NF von QS gelesen".
- Eine Ausnahme bleibt mit Absicht: Kürzel, die je Antragstyp etwas anderes bedeuten (etwa `AB` in DL gegenüber NW), nennt der Zeitstrahl weiter typgenau. Das Verzeichnis kennt nur eine Bezeichnung je Kürzel und könnte diesen Unterschied nicht ausdrücken.

## v4.44 — 2026-08

### Verbesserungen
- Der Suchbereich steht jetzt auf **alle Felder** — der Standard hieß vorher „Titel, Beschreibung, Dokumente" und klang nach einer Einschränkung, die er nie war. Gesucht wurde immer schon in Titel, Kurzbeschreibung, Deskriptoren, Akronym, Aktenzeichen, Einrichtung, Web-Adresse, Ort und Bundesland — dazu in den Dokumenten. Wer nicht weiß, in welchem Feld sein Wort steht, muss es auch nicht wissen.
- Jede Option der Auswahl sagt jetzt selbst, worum es geht: **„Suche in: alle Felder"**, „Suche in: nur Dokumente" und so fort. Aufgeklappt liegt die Liste über der Seite — dort stand vorher nur „alle Felder", ohne die Frage dazu.
- Jede andere Wahl beginnt mit „nur …" und **färbt sich**, solange sie gesetzt ist. Ein eingestellter Bereich ist das Einzige, was Treffer verschwinden lässt, ohne dass am Ergebnis etwas davon steht.
- Ein früher eingestellter Bereich wird **einmalig zurückgesetzt**. Wer die Einschränkung weiter braucht, wählt sie einmal neu.

## v4.43 — 2026-08

### Neu
- **Die Chronik nennt jetzt das Kürzel.** Zwischen Datum und Rolle steht der Code, unter dem Sie den Eintrag aus dem Fachsystem kennen — `AAE`, `XTEC`, `XKS`. Dieselbe Reihenfolge wie dort: Datum, Kürzel, Rolle, Eintrag. Auch die fehlenden Gegenstücke nennen das Kürzel, das gesucht wird.

### Verbesserungen
- **„Nächste Schritte (in C16 zu setzen)" startet zugeklappt.** Der Block war mit bis zu 18 Kandidaten der längste der Seite und schob Chronik und Statuseinträge aus dem Blick. Die Anzahl steht weiterhin in der Überschrift, damit Sie sehen, ob sich das Aufklappen lohnt; Ihre Wahl wird gemerkt.

### Bugfixes
- **„DL-Gutachten fertig - FB/AB" heißt wieder „Gutachten fertig".** `DL` ist eine Antragsform (Dienstleistung zur Markteinführung) und hatte in diesem Eintrag nichts zu suchen — der Wortlaut stammte aus der DL-Spalte und galt versehentlich für alle Antragsformen. Ebenso bei `XQS`. Dazu vier Schreibfehler: „Schwiergigkeiten", „ausgestezt", „VN-Qualitätsicherung" und ein doppeltes „QS".
- Beim Nachgehen zeigte sich, dass die beiden Kürzel-Listen des Fachsystems sich bei **76 Kürzeln** widersprechen. Sechs davon waren eindeutig und sind korrigiert. Bei den übrigen 70 unterscheidet sich die *Aussage*, nicht die Schreibweise — etwa `ALQ` („NF von PL gelesen" gegen „von QS gelesen"). Die klärt der Fachbereich; geraten wird nichts.
- Die Korrekturen wirken erst, wenn die Projektleitung sie im Status-Katalog übernimmt („Zuarbeit übernehmen") — kuratierte Bezeichnungen werden nie ungefragt überschrieben.

## v4.42 — 2026-08

### Bugfixes
- **Die Suche durchsucht die Projektbeschreibung wieder.** Sie war unbemerkt aus dem Suchindex gefallen: die Beschreibung wurde bei keinem einzigen Antrag mitgesucht. Wer „Netzwerkpartner" in „nur Titel & Kurzbeschreibung" suchte, bekam nichts — jetzt sind es 696 Anträge. Betroffen waren alle 9.225 Anträge mit hinterlegter Beschreibung. Wenn Ihnen die Suche in letzter Zeit zu dünn vorkam, war das der Grund.

### Neu
- **Einrichtungen sind jetzt auch über ihr Kürzel zu finden.** Manche Einrichtungen führen ihr Kürzel im Namen („… e.V. (IUTA)") und waren darüber immer schon zu finden. Andere nicht: die „Gesellschaft zur Förderung von Medizin-, Bio- und Umwelt- Technologien e.V." heißt nirgends in den Daten „GMBU", obwohl jeder sie so nennt. Die Suche zieht solche Kürzel deshalb aus der Web-Adresse der Einrichtung — „GMBU" findet unter „nur Einrichtung" jetzt 35 Anträge statt keinen.
- In der Trefferliste steht bei einem solchen Treffer die **Web-Adresse** als Beleg dabei, damit erkennbar bleibt, warum der Antrag erscheint; in der Tabelle blendet sich die passende Spalte von selbst ein. Das klappt bei Anträgen, zu denen eine Kontaktadresse hinterlegt ist (rund 7.600).

## v4.41 — 2026-08

### Neu
- Die beiden Karten ganz oben auf der Startseite haben jetzt auch ein ⋯-Menü. „Weiter, wo du aufgehört hast" lässt sich ausblenden, und der gemerkte Arbeitsverlauf lässt sich dort löschen. Bei „Braucht heute Aufmerksamkeit" können Sie einzelne Kacheln abwählen — wer zum Beispiel nichts mit QS-Freigaben zu tun hat, nimmt die Kachel weg — und von dort direkt die Fristen-Schwellen ändern.
- Eine ausgeblendete Karte holen Sie über „Widgets" im Rechtsklick-Menü der Startseite zurück; die beiden stehen dort neu unter **Oben**.
### Verbesserungen
- Der Rechtsklick zeigt nur noch etwas, wo er auch etwas kann: das Menü der App auf einer freien Stelle der Startseite. Das Browser-Menü mit „Zurück" und „Neu laden" erscheint nicht mehr überall, wo es nichts nützt — in Textfeldern (Einfügen) und bei markiertem Text (Kopieren) bleibt es. Wenn Sie es doch einmal brauchen: Umschalt gedrückt halten und rechtsklicken.

## v4.40 — 2026-08

### Neu
- Die Gruppen „Kuration" und „Developer" in der Seitenleiste lassen sich zuklappen — wie „In Erprobung". Zugeklappt bleibt die Seite stehen, auf der Sie gerade sind, damit Sie nicht die Orientierung verlieren. Was Sie einklappen, bleibt auf diesem Gerät eingeklappt.
### Verbesserungen
- Die Kurations-Seite heißt jetzt **Datenpflege**. Vorher stand „Kuration" in der Seitenleiste zweimal untereinander: als Überschrift der Gruppe und als einziger Eintrag darunter.
- Die Unterseite „Verzeichnisse" heißt jetzt **Förderprogramme** — „Verzeichnis" klingt nach Ordner auf der Festplatte, gemeint waren aber immer Programme, Unterprogramme und die Filter, die daran hängen. Alte Lesezeichen führen weiterhin dorthin.
- Die Entwickler-Gruppe heißt schlicht **Developer**.
- Das ⋯-Menü eines Widgets zeigt nur noch, was dieses eine Widget betrifft. „Widgets" und „Darstellung" standen bisher in jeder Karte mit — sie öffnen sich jetzt nur noch über einen Rechtsklick auf eine freie Stelle der Startseite oder den Knopf „Startseite anpassen".
### Bugfixes
- Beim Start hakt die Freigabe-Karte jeden Ordner sofort ab, sobald Sie im Browser auf „Zulassen" geklickt haben. Bisher stand dort während aller Abfragen „Schritt 1 von 3" — es sah aus, als sei nichts angekommen.
- Fragt Ihr Browser von sich aus nicht weiter, sagt die Karte, welcher Ordner noch offen ist, statt ihn stillschweigend zu überspringen. Ein Ordner ohne Freigabe wird nie mehr als freigegeben verbucht.
- Ein Rechtsklick auf eine Widget-Karte öffnet kein App-Menü mehr, sondern wieder das Menü Ihres Browsers — Text lässt sich dort also wieder kopieren. Die Aktionen des Widgets stehen im ⋯ seiner Kopfzeile.

## v4.39 — 2026-08

### Neu
- Ein Klick auf ein angehängtes Bild zeigt es groß — praktisch, um vor dem Absenden zu prüfen, ob die Markierung sitzt.
- Sie können mehrere Screenshots anhängen; der Knopf sagt es jetzt auch („Weiteren Bereich aufnehmen").
### Verbesserungen
- Im Feedback-Fenster steht „Bereich aufnehmen" vor der Einfüge-Fläche und ist deutlicher als Knopf erkennbar — in der Reihenfolge, in der Sie es benutzen.
- Das Feedback-Fenster ist leicht durchscheinend, sodass Sie sehen, worüber es liegt.
- Im Titelfeld steht die erkannte Seite fest vor dem Eingabefeld — daneben steht jetzt sichtbar, dass Sie dort noch eine kurze Überschrift schreiben können.
- Die Textfelder im Feedback-Fenster lassen sich nach unten aufziehen, wenn Sie mehr schreiben möchten; das Fenster selbst ist wieder etwas breiter.
### Bugfixes
- Wer über „Typ ändern" nachsieht, ob eine andere Ticket-Art besser passt, findet seinen bereits getippten Text danach unverändert vor. Bisher war er weg.

## v4.39 — 2026-08

### Verbesserungen
- Die beiden Entwickler-Seiten stehen in der Seitenleiste jetzt unter einer eigenen Überschrift **„Werkbank (dev)"** statt unter „Kuration" — dort gehörten sie nie hin.
- **Dokument-Review** hat eine Überschrift bekommen und denselben Seitenrand wie die Kuration daneben. Vorher stand dort oben nur der Hilfe-Knopf.
- Der Hinweis „Kurator-Modus nicht aktiv" ist überall derselbe und nennt jetzt den richtigen Weg zum Freischalten (Einstellungen → Mein Profil → Zusatz-Module). Vorher stand er an vier Stellen unterschiedlich, mit einem Weg, den es so nicht mehr gab.

## v4.38 — 2026-08

### Verbesserungen
- Auch **CSV-Quellen** ist jetzt Teil der Seite „Kuration". Damit ist alles Kuratorische an einem Ort: Übersicht, CSV-Quellen, Verzeichnisse, Suche & Index, Dienste — in der Reihenfolge, in der die Daten durch die App laufen.
- Neben den Quellen steht jetzt ihr Zustand: wie viele Quellen, wie viele Zeilen, wann zuletzt importiert wurde und bei wie vielen Quellen eine neuere Datei bereitliegt.
- Selten Gebrauchtes (Antrags-Daten zurücksetzen) liegt eingeklappt darunter statt dauerhaft im Blick.
- In der Seitenleiste stehen unter „Kuration" noch vier Einträge statt der ursprünglich neun. Alte Lesezeichen funktionieren weiter und landen im passenden Abschnitt.

## v4.37 — 2026-08

### Neu
- **Screenshot, ohne dass das Feedback-Fenster im Weg steht.** „Bereich aufnehmen (Win+Shift+S)" klappt das Fenster auf eine schmale Leiste zusammen. Sie nehmen Ihren Ausschnitt auf, drücken Strg+V — und das Fenster geht mit dem Bild und Ihrem angefangenen Text wieder auf.

### Verbesserungen
- Das Feedback-Fenster ist deutlich schmaler und kürzer geworden: gleiche Möglichkeiten, gut ein Drittel weniger Höhe.
- Beim Melden eines Problems gibt es statt „Was hast du gemacht?" und „Was ist passiert?" **ein** Feld — beides in einem Satz, wie man es ohnehin schreibt.
- Die Überschrift ist mit der Seite vorbelegt, auf der Sie stehen („Home: …"). Lassen Sie sie stehen, wird der Titel wie bisher aus Ihrer Antwort abgeleitet.
- Der Bereich steht jetzt oben rechts als kleines Auswahlfeld und heißt nach Ihrer Seite („Seite: Home"); was automatisch mitgeschickt wird, steht im ⓘ daneben.
- Bei „Datei anhängen" stehen die erlaubten Formate direkt in der Ablage-Fläche.

## v4.36 — 2026-08

### Verbesserungen
- „Programme" und „Filter verwalten" sind keine eigenen Menüpunkte mehr, sondern die Seite **Kuration → Verzeichnisse**. Programme, Unterprogramme und Filter stehen dort untereinander.
- Bei den Filtern siehst du jetzt alle drei Bestände auf einen Blick — eingebaute, eigene und die privaten Vorlagen der Nutzer, jeweils mit Anzahl. Vorher lagen zwei davon hinter Reitern.
- Jede Gruppe sagt, für welches Programm sie gilt. Bei den Filtern stand das vorher nirgends.
- Ist der Kurator-Modus nicht freigeschaltet, steht das einmal oben auf der Seite — mit dem richtigen Weg dorthin.

### Bugfixes
- „Öffnen" beim Suchindex auf der Kurations-Übersicht führte auf die Startseite statt zum Suchindex.

## v4.35 — 2026-08

*(Nur für Kuratoren sichtbar.)*

### Verbesserungen
- **„Suchindex" und „Dokumentenquellen" sind eine Seite geworden:** „Suche & Index" in der Kuration. Links stehen die Aktionen und die Ordner, die eingelesen werden, rechts der Zustand — Sie sehen beim Indexieren zu, statt danach den Reiter zu wechseln.
- **Die Reiter „Übersicht" und „Verwaltung" entfallen.** Was Sie selten brauchen — Modellwahl, Suchqualität, Zurücksetzen — steht jetzt eingeklappt darunter, statt eine eigene Ansicht zu belegen.
- Alte Lesezeichen auf beide Seiten führen weiterhin ans richtige Ziel.

## v4.34 — 2026-08

*(Nur für Kuratoren sichtbar.)*

### Neu
- **Die Kuration hat eine Startseite.** „Übersicht" zeigt auf einen Blick, wie der Suchindex steht, wann zuletzt CSV-Daten importiert wurden und wie viele Dokumente auf eine Prüfung warten — mit einem Weg dorthin. Auch wenn nichts ansteht, sehen Sie das ausdrücklich, statt es aus einer leeren Liste schließen zu müssen.
- **Ihre Kurator-Sitzung steht jetzt dort, wo Sie arbeiten:** rechts auf der Übersicht, mit Restlaufzeit und einem Knopf zum Sperren.

### Verbesserungen
- **Die Kuration ist eine Seite mit Unterseiten geworden** — dieselbe Form wie die Einstellungen, mit Suchfeld über der Navigation. „E-Mail Anfragen: Einstellungen" ist darin als „Dienste" aufgegangen; alte Lesezeichen finden weiterhin ihr Ziel.

### Bugfixes
- Ein alter Link auf die Feedback-Verwaltung landete auf der Startseite statt im Feedback-Board.

## v4.32 — 2026-08

### Verbesserungen
- **Die Einstellungs-Suche sagt jetzt, wohin sie springt.** Unter jedem Treffer steht sein Weg — etwa „Mein Profil › Persönlicher Assistent". So wissen Sie schon vor dem Klick, in welcher Karte Sie landen.
- **Der gefundene Eintrag bleibt markiert**, bis Sie das nächste Mal klicken oder tippen. Bisher leuchtete er nur kurz auf — und wenn die Seite für den Sprung gar nicht scrollen musste, war das leicht zu übersehen.
- **Weniger Kleingedrucktes in den Einstellungen:** die Fußzeile unter der Navigation ist entfallen. Sie erklärte ein Tastenkürzel für das Suchfeld, das direkt darüber steht.

### Bugfixes
- **Interne KI:** In der rechten Spalte stand „KI-Variante" doppelt, und der Erklärtext lief über den Kartenrand hinaus. Die Zeile zeigt jetzt eine Beschriftung, ein ⓘ und die beiden Knöpfe.

## v4.31 — 2026-08

### Verbesserungen
- „Interne KI" zeigt oben eine Statuskarte: verbunden oder nicht, mit welcher Adresse, und daneben „Verbindung testen" und „Interne KI öffnen". Die Einrichtung in fünf Schritten samt ziehbarem Lesezeichen steht eingeklappt darunter.
- Das Kontextfenster lässt sich auf „Automatik" oder „Manuell" stellen und sagt in Klartext, für wie viele Zeichen es reicht.

### Bugfixes
- Die Einstellungs-Suche klappt den gefundenen Bereich jetzt auch dann auf, wenn er auf einer anderen Seite liegt. Vorher sprang sie hin, ließ ihn aber zugeklappt — man sah den Treffer nicht.

## v4.30 — 2026-08

### Verbesserungen
- „Darstellung & Bedienung" und „Daten & Verbindungen" stehen jetzt ebenfalls zweispaltig: links die Einstellungen selbst, rechts, was daran hängt (Startseiten-Widgets bzw. Team-Status und Tags).
- Jedes Widget hat einen Schalter statt zweier Zustands-Knöpfe; ausgeschaltete Zeilen sind gedimmt, und die Zeile sagt „13 von 15 sichtbar" statt nur „13 sichtbar".
- Die Tastenkürzel-Liste, die Widget-Liste, der Arbeitsverlauf, die Online-Liste und die Tag-Liste sind eingeklappt und nennen in ihrer Zeile, was dahinter steckt.
- Der Datenordner zeigt „Letzter CSV-Import" direkt in seiner Zeile; die Erklärungen zu den Ordnern stehen im ⓘ.

## v4.29 — 2026-08

### Verbesserungen
- „Mein Profil" ist zweispaltig: links Ihr Account und Ihr Fachprofil, rechts, was daraus folgt — welche Anträge Sie sehen, welche Zusatz-Module offen sind und was der persönliche Assistent mitschreibt.
- Selten Gebrauchtes steht eingeklappt und sagt in der Zeile, was dahinter liegt: „Themen aus Ihren Anträgen · 13 von 30 aktiv", „Eigene Kompetenzen · 3 Begriffe".
- Die lange Erklärung zum Arbeitsprotokoll steht jetzt im ⓘ; „Persönliches Gedächtnis" bleibt sichtbar gesperrt, solange das Arbeitsprotokoll aus ist, und nennt den Grund in der Zeile.
- Oben rechts steht, ob gerade gespeichert wurde — statt einer festen Zusage.

### Bugfixes
- Die Kürzel-Anzeige im Profil behauptete „Kürzel ALLE", wenn gar kein Kürzel gewählt war.

## v4.28 — 2026-08

### Verbesserungen
- Die Einstellungen haben statt fünf nur noch vier Seiten: „Meine Technologien" ist als Bereich „Mein Fachprofil" in „Mein Profil" umgezogen. Die Suche findet die Punkte weiterhin unter dem alten Namen.
- Jede Seite trägt jetzt eine Zeile darunter, die sagt, wofür sie zuständig ist.
- Die kleinen ⓘ öffnen sich auf Klick und bleiben stehen, bis Sie danebenklicken oder Esc drücken — vorher verschwanden sie beim Lesen.
- Die Einstellungs-Suche findet zwei Punkte, die es vorher nicht gab: „Arbeitsverlauf" und „Verbundene Verzeichnisse".

## v4.27 — 2026-08

### Bugfixes
- Wird die Art einer Spalte korrigiert (z.B. von Text auf Datum), wirkt sich das beim nächsten Import wirklich auf die Anträge aus. Bisher meldete der Dialog Vollzug, im Antrag stand aber weiter der alte Wert. Der erste Import nach diesem Update dauert einmalig länger, weil alle Zeilen neu berechnet werden.
- „Beispieldaten erzeugen" kann den Suchindex nicht mehr leeren, wenn echte Anträge vorhanden sind — und der Knopf verschwindet, sobald die Beispieldaten einmal angelegt wurden.
- Ein Import, der während des Einlesens abgebrochen wird, lässt die gespeicherte Kopie der Quelldatei unangetastet. Vorher konnte ein späterer Import einer anderen Quelle Werte aus dem abgebrochenen Lauf übernehmen.
- Eine neue Hauptquelle löst die bisherige wirklich ab; vorher gab es danach zwei, und die App arbeitete mit der falschen weiter.
- Der Hinweis „Standardfeld doppelt belegt" nennt jetzt die richtige Regel: es gewinnt die Spalte, die in der gespeicherten Zuordnung weiter unten steht — nicht die in der Datei spätere.

## v4.26 — 2026-08

### Neu
- Das Kanban-Fenster hat jetzt **eigene** Bahnen: über das Zahnrad stellen Sie ein, welche Sie dort sehen wollen, in welcher Reihenfolge und mit wie vielen Kartenspalten. Die Startseite behält ihre eigene Auswahl — im Fenster ist mehr Platz, also darf dort auch mehr stehen.
- „Anordnung zurücksetzen" stellt den Vorschlag wieder her, mit dem das Fenster gestartet ist.
### Verbesserungen
- Angehakte Bahnen ohne Vorgänge stehen jetzt als schmale Schiene da, statt zu fehlen; abgewählte fehlen ganz. Was im Zahnrad steht, ist damit das, was daneben zu sehen ist.
### Bugfixes
<!-- - … -->

## v4.25 — 2026-08

### Bugfixes
- „Quelle löschen" entfernt jetzt gleich, was zu dieser Quelle gehört. Bisher blieben ihre Felder in den Anträgen stehen und verschwanden erst nach und nach — bei jedem Antrag zu einem anderen Zeitpunkt.
- Wird ein Re-Import mit geänderter Spaltenzuordnung abgebrochen, gilt wieder die alte Zuordnung. Vorher zeigte die Quellen-Ansicht die neue, die Daten stammten aber weiter aus der alten.
- Eine gerade zugeordnete Spalte wird nicht mehr vom Auto-Import auf „ignorieren" zurückgesetzt.
- Ein Import über die Dialoge wird jetzt genauso aufgezeichnet wie der automatische — bisher fehlte dieser Tag im Verlauf.

## v4.24 — 2026-08

### Verbesserungen
- Die Suche zeigt jetzt, warum ein Treffer erscheint. Wer nach einem Ort oder Bundesland sucht, bekommt die Spalte „Ort & Bundesland" automatisch eingeblendet — mit dem gefundenen Wort markiert. Dasselbe gilt für Treffer in den Deskriptoren.
- Eingeblendete Spalten sind im Aufklapper „Spalten" mit „auto" gekennzeichnet. Sie ändern Ihre eigene Spaltenauswahl nicht und verschwinden wieder, sobald die Suche sie nicht mehr braucht.
- Die Trefferliste ist kompakter: die Trefferstellen stehen jetzt oben neben dem Förderkennzeichen statt in einer eigenen Zeile darunter. Statt des bloßen Etiketts „Ort" steht dort jetzt der Ort selbst.

## v4.23 — 2026-08

### Bugfixes
- „Demo-Quellen in echte umwandeln" entfernt die Beispiel-Anträge jetzt gleich mit. Der anschließende Hinweis empfiehlt nicht mehr das Zurücksetzen der Antragsdaten — das hätte auch die echten Daten gelöscht.
- „Bereits aktuell." erscheint nur noch, wenn wirklich geprüft wurde und nichts war. Lief gerade ein anderer Vorgang, wurden Quellen wegen geänderter Spalten übersprungen oder kam der Datenbestand unvollständig an, steht das jetzt da.
- Der Punkt „● CSV" unten prüft nach einem Import über das Banner sofort neu. Bisher blieb er den Rest der Sitzung rot und meldete „Neue CSV-Exporte verfügbar", obwohl der Import gerade gelaufen war.
- Wird im Statuskatalog ein Feld umbenannt, zeigt die Spalte in der Antragstabelle sofort den neuen Text — bisher erst nach einem Neustart der App.
- Netzwerk-Gruppen heißen auch dann mit ihrem Namen, wenn die Daten beim Öffnen der Seite noch nicht geladen waren.

## v4.22 — 2026-08

### Bugfixes
- Wer auf einem Rechner mit mehreren Programmen arbeitet, verliert beim Laden neuer Daten nicht mehr die Daten des jeweils anderen Programms.
- Ein im Fachsystem gelöschter Antrag verschwindet jetzt auch bei den Kolleginnen und Kollegen, wenn er im selben Lauf zusätzlich geändert wurde. Bisher blieb er dort als Karteileiche stehen.
- Ein Rechner, der nur mit den mitgelieferten Beispieldaten läuft, kann den echten Datenbestand des Teams nicht mehr überschreiben.
- Findet die App die Datei einer CSV-Quelle nicht wieder, greift sie nicht mehr zur nächstbesten Datei im Ordner. Sie meldet stattdessen, dass die Datei fehlt — das lässt sich beheben, eine falsche Zuordnung nicht.

## v4.21 — 2026-08

### Neu
- Eine Kanban-Spalte lässt sich jetzt auch **dreispaltig** stellen, nicht nur ein- oder zweispaltig. Der Schalter steht überall dort, wo Sie die Lanes einstellen: im „Board anpassen"-Popover des Feedback-Boards, im Menü des Kanban-Widgets, unter Einstellungen › Widgets und im Zahnrad des Kanban-Fensters. Die Karten behalten dabei ihre Größe — die Spalte wird breiter und dafür kürzer.

### Verbesserungen
- Die Einstellungs-Ansicht des Startseiten-Menüs ist etwas breiter, damit die Namen der Lanes nebeneinander Platz haben; wo ein Name doch nicht passt, zeigt ihn ein Tooltip vollständig.

## v4.20 — 2026-08

### Bugfixes
- Die kuratierten Ordner-Spalten in der Antragstabelle bleiben nach einem Import stehen. Bisher waren sie ausgerechnet bei den Anträgen leer, die sich gerade geändert hatten — bis zum nächsten Start der App sah die Spalte deshalb lückenhaft aus.
- Wird das Kürzel eines Verbundes im Fachsystem korrigiert, zieht die Verbund-Seite jetzt mit. Vorher zeigte die Liste den neuen Namen und die Detailseite weiter den alten.
- Fehlt ein Verbund-Datensatz und die App baut ihn nach, übernimmt sie nicht mehr Titel und Status des ersten Teilvorhabens. Angezeigt wird weiterhin etwas Sinnvolles — es wird nur nicht mehr als Verbund-Angabe gespeichert und ans Team verteilt.
- Führt ein Export einen Spaltennamen plötzlich unterschiedlich oft (das Fachsystem kürzt Spaltenköpfe, dadurch gibt es Namensdopplungen), meldet sich die Quelle und wird nicht importiert. Bei gleichnamigen Spalten entscheidet die Reihenfolge, welche Spalte welches Feld füllt — sonst hätte der Import stillschweigend die falsche gelesen.

## v4.19 — 2026-08

### Bugfixes
- Wie auf der Suchseite öffnet jetzt auch an vier weiteren Stellen kein Klick mehr ungefragt ein Fenster mit der internen KI: Assistent, Skill-Testlauf, Klassifizierung der Auslastung und der Entwurf einer Nachforderung. Ist die KI nicht verbunden, fragt die App nach, statt einen Tab aufzumachen, der ohnehin nicht antworten kann.

## v4.18 — 2026-08

### Verbesserungen
- Der Import sagt jetzt, was er übersprungen hat, und nennt die genaue Zahl: Zeilen mit leerem oder unbekanntem Unterprogramm, Zeilen ohne Förderkennzeichen und Zeilen, deren Spaltenzahl nicht zur Kopfzeile passt.
- Konnte ein Import zwar gelesen, aber nicht ans Team weitergegeben werden, steht das jetzt im Abschluss („Import lokal abgeschlossen") statt nur im Protokoll.

### Bugfixes
- Ein Antrag verschwindet nicht mehr, weil seine Unterprogramm-Angabe im Export fehlt oder im Katalog nicht steht — nur ein bewusst abgewähltes Unterprogramm entfernt ihn noch.
- Ein Leerzeichen in der Kopfzeile des Exports leerte bisher stillschweigend die ganze Spalte.
- Ließ sich beim Abgleich eine Datei nicht lesen, galt der Tag trotzdem als erledigt und die Änderungen fehlten dauerhaft. Jetzt wird es beim nächsten Abgleich nachgeholt.
- „Antrags-Daten zurücksetzen" leert nun auch die Listenansicht — vorher zeigten Tabelle, Startseite und Suche danach weiter den alten Bestand.

## v4.17 — 2026-08

### Neu
- „Suchen in" trennt jetzt „nur Einrichtung" und „nur Ort & Bundesland". Wer wissen will, welche Vorhaben in Bayern gefördert wurden, bekommt nicht mehr die Firmen mit „Bayern" im Namen dazu.

### Verbesserungen
- Der Schalter „Ähnliche Begriffe mitsuchen" heißt jetzt „Wortformen mitsuchen" — er sucht dasselbe Wort in anderer Form („Normen" findet „Normung"). Die „Ähnlichkeitssuche" daneben sucht dasselbe Thema in anderen Worten. Zwei verschiedene Dinge, jetzt auch zwei verschiedene Namen.
- In der Tabellenansicht ist der Suchbegriff jetzt genauso markiert wie in der Liste — im Titel, im Förderkennzeichen, beim Antragsteller und beim Ort.

### Bugfixes
- „Warum?" öffnete bisher ein neues Browser-Fenster mit der internen KI, auch wenn man nur wissen wollte, warum ein Treffer oben steht. Jetzt fragt die App erst nach, ob die KI überhaupt verbunden ist — und sagt es, wenn nicht.

## v4.15 — 2026-08

### Verbesserungen
- Der Knopf „Hilfe" steht jetzt auf jeder Seite an derselben Stelle: oben rechts am Rand, so wie auf der Startseite. Bisher rutschte er auf manchen Seiten weit in die Fläche hinein.
- Die Kurator-Seiten „CSV-Quellen", „Programme", „Suchindex" und „E-Mail Anfragen: Einstellungen" beginnen links statt mittig — Überschrift und Inhalt stehen wieder untereinander.

## v4.14 — 2026-08

### Neu
<!-- - Kurzer, verständlicher Satz (nur bei nutzersichtbaren Änderungen) -->
### Verbesserungen
- Unter „Suchindex → Verwaltung" steht bei der Textanalyse jetzt einfach das verwendete Modell (EmbeddingGemma 300M) statt einer Auswahlliste. Die anderen Modelle waren Erprobungs-Kandidaten: der gesamte Suchbestand ist mit diesem einen gebaut, ein Wechsel hätte ihn team-weit unbrauchbar gemacht.
### Bugfixes
<!-- - … -->

## v4.13 — 2026-08

### Neu
- Die Sektion „Historie" auf der Antragsseite zeigt jetzt, was sich seit dem Nullpunkt wirklich geändert hat — je Teilvorhaben, mit altem und neuem Wert. Vorher stand dort immer „Noch keine Verbund-Änderungen erfasst".
### Verbesserungen
- Die Antragsseite öffnet zugeklappt: sichtbar sind die Antragsdaten und die Kurzbeschreibung, sofern sie schon geschrieben ist. Was Sie auf- oder zuklappen, bleibt so beim nächsten Antrag.
- Die Seite ist enger gesetzt und zeigt keine leeren Blöcke mehr — die Antragsdaten stehen rund 120 Pixel weiter oben.
- Bei eingeklappter Antragsliste bleiben oben nur noch Titel und Hilfe stehen; Filter-Chips und Listen-Werkzeuge verschwinden mit der Liste, ohne ihre Einstellung zu verlieren.
### Bugfixes
<!-- - … -->

## v4.11 — 2026-08

### Verbesserungen
- Ein Antrag verschwindet erst, wenn er aus **allen** Quellen gefallen ist. Bisher genügte eine: fehlte eine Zeile im Export der Begleitung oder der Projektbeschreibung, war der Antrag weg — obwohl der Master ihn weiterführte. Da die Quellen unterschiedlich weit zurückreichen, passierte das regelmäßig bei älteren Vorhaben.
- Wird eine Löschung zurückgehalten, steht das am Ende des Imports als eigene Zeile — samt Zahl, wie viele Zeilen betroffen waren.

## v4.10 — 2026-08

### Neu
- Das Kanban im eigenen Fenster lässt sich jetzt dort einrichten: Ein Zahnrad in der Titelzeile öffnet dieselben Einstellungen wie auf der Startseite (Bahnen, Spalten, Farben) — Sie müssen dafür nicht mehr zurück.

### Verbesserungen
- Bahnen, die Sie im eigenen Fenster einklappen, bleiben eingeklappt — auch nachdem Sie das Fenster geschlossen und wieder geöffnet haben. Im Widget auf der Startseite gilt das Einklappen weiterhin nur für den Moment.
- `Esc` schließt bei offenen Einstellungen erst diese und nicht mehr gleich das ganze Fenster.

### Bugfixes
- Das Kanban-Fenster hieß in der Titelzeile „about:blank". Es trägt jetzt seinen Namen.

## v4.9 — 2026-08

### Bugfixes
- Das Menü „Startseite anpassen" ging sofort zweistöckig auf — mit bereits ausgeklappter Widget-Liste — und rutschte dabei vom Knopf weg nach links. Es öffnet jetzt einstöckig und bündig an der Stelle, an der Sie es aufrufen; die Widget-Liste klappt erst auf, wenn Sie „Widgets" ansteuern.
- Ein Export, in dem die Schlüsselspalte (z. B. `FKZ`) umbenannt wurde oder fehlt, hat den kompletten Antragsbestand dieser Quelle gelöscht — und dabei „Import abgeschlossen" gemeldet. Der Import bricht jetzt mit einer Erklärung ab und rührt nichts an; die Quelle wird beim nächsten Lauf erneut angeboten.
- Ein unvollständiger Datenbestand konnte den gemeinsamen Stand auf dem Laufwerk überschreiben — für alle im Team. Fehlt beim Veröffentlichen mehr als die Hälfte der Anträge, bricht die App ab und lässt den gemeinsamen Stand unverändert stehen.

## v4.8 — 2026-08

### Verbesserungen
- Die Dokumentensuche versteht deutsche Wörter jetzt als Ganzes. Bisher zerlegte sie Umlautwörter in Teile — „Fördergeber" wurde intern zu „f" und „rdergeber". Das brachte fremde Treffer mit: eine Suche nach „Förderung" konnte auch Dokumente über „Führung" hereinholen.
- Wörter mit Bindestrich sind jetzt über beide Teile auffindbar: „ZIM-Kooperationsprojekt" findet man auch mit „Kooperationsprojekt".
- Bestehende Suchindizes funktionieren unverändert weiter. Die Verbesserung greift, sobald der Suchindex das nächste Mal neu aufgebaut wird — der Kurator-Bereich weist darauf hin.

## v4.7 — 2026-08

### Neu
- **Startseite per Rechtsklick anpassen.** Ein Rechtsklick auf die Startseite blendet Widgets ein und aus, sortiert sie und wechselt Primärfarbe oder Hell/Dunkel — ohne den Umweg über die Einstellungen. Ein Rechtsklick auf ein Widget zeigt dessen eigene Aktionen. Denselben Weg öffnen der Knopf „Startseite anpassen" oben rechts und das `⋯` im Widget-Kopf.
- **„Widget hinzufügen"** am Ende jeder Spalte — auch eine leergeräumte Spalte bleibt damit bedienbar.

### Verbesserungen
- **Rückgängig** für Ausblenden und „Startseite zurücksetzen": eine Leiste unten mit einem Klick zurück, statt einer Sicherheitsabfrage vorher.
- Der Stift im Widget-Kopf ist einem `⋯`-Menü gewichen. Er erschien nur bei zwei Widgets; das Menü gibt es an jedem, und die Einstellungen stehen darin.
- Der Dunkelmodus arbeitet mit gestuften Flächen statt einer: Hintergrund, Blatt und Karten heben sich jetzt durch Helligkeit voneinander ab, Karten haben wieder eine sichtbare Kante.

## v4.6 — 2026-08

### Neu
- Die Suche zeigt Treffer wahlweise als Liste: mit der Textstelle, in der das Suchwort steht, und der Angabe, woher sie kommt.
- Unter dem Suchfeld steht jetzt, wie die Anfrage gelesen wurde. Ein Klick auf ein Wort nimmt es aus der Suche, ohne dass Sie im Feld editieren müssen.
- „Genaue Wortfolge" als dritte Möglichkeit neben „alle Wörter" und „irgendein Wort" — für Begriffe, die zusammengehören.
- „Ähnliche Begriffe mitsuchen" findet verwandte Wortformen: „Normen" findet auch „Normung". Welche dazugekommen sind, steht daneben und lässt sich einzeln abwählen.
- Filter für Status, Antragstyp, Jahr und Trefferstelle — mit der Zahl, die Sie nach dem Klick bekommen.
- Suchen lassen sich speichern und später mit einem Klick erneut ausführen.
### Verbesserungen
- Die Relevanz sagt jetzt etwas aus: ein Treffer im Titel wiegt schwerer als einer im Firmennamen. Vorher hatten alle Treffer denselben Wert, und „nach Relevanz sortieren" tat nichts.
- Treffer aus Dokumenten stehen nicht mehr als eigene Zeile daneben, sondern beim zugehörigen Antrag.
- Der Einstieg zeigt Ihre letzten, gespeicherten und häufigen Suchen — jeweils mit der aktuellen Trefferzahl.
- „Warum?" an jeder Zeile erklärt den einzelnen Treffer, statt gleich alle begründen zu lassen.
### Bugfixes
- Findet eine Suche nichts, stehen jetzt geprüfte Vorschläge da — jeder mit der Trefferzahl, die er tatsächlich bringt. Vorher endete die Suche in einer Sackgasse.

## v4.4 — 2026-08

### Neu
- In der Meilenstein-Konfiguration hebt ein neuer Knopf einen Unter-Meilenstein wieder eine Ebene höher.
### Verbesserungen
- Mehrere Meilensteine lassen sich gleichzeitig aufklappen — Regeln nebeneinander vergleichen, statt hin und her zu klicken.
- Beim Ziehen zeigt eine Marke, wo der Meilenstein eingefügt wird; ein Rahmen zeigt, wenn er in einen anderen hineinwandert.
- Die Bedingungen stehen dichter untereinander: ein Meilenstein mit vier Regeln braucht rund ein Fünftel weniger Höhe.
### Bugfixes
- „Unter-Meilenstein anlegen" zeigte den neuen Meilenstein nicht — er erschien erst nach dem nächsten Öffnen der Seite. Jetzt klappt die Zeile auf, und der Cursor steht gleich in der Bezeichnung.
- Die Suche findet ein Vorhaben jetzt auch über sein Akronym. Bisher wurde nur der Titel durchsucht — das Netzwerk „mobiInspec" (16KN083001) war unter genau diesem Stichwort nicht zu finden, weil sein Titel das Kürzel als einziger nicht trägt.
- Ebenso über das Aktenzeichen: „16KN083001" führt direkt zum Antrag, „16KN0830" zeigt alle 32 Anträge dieses Netzwerks.
- Und über den Antragsteller: 5 461 Einrichtungen sind jetzt über ihren Namen zu finden. Bisher ging das praktisch nie, weil der Firmenname weder im Titel noch in der Kurzbeschreibung steht. Gesucht wird sowohl die Rechtsperson als auch die ausführende Stelle — „Universität Münster" und „Universitätsklinikum Münster" führen zum selben Antrag.
- Ebenso über Ort und Bundesland: „Berlin" zeigt alle dortigen Vorhaben, zusammen mit der Sicht „Bewilligt 2026" die 68 Berliner Bewilligungen dieses Jahres. Auch Firmensitz **und** Arbeitsort zählen, wenn sie auseinanderfallen. Ortsnamen werden dabei ab Wortanfang verglichen — „essen" bringt daher nicht die hessischen Anträge mit.
- Ein Netzwerkantrag, der nach einer Ablehnung erneut eingereicht wurde, zählt wieder als Netzwerkantrag (47 Fälle im Bestand). 18 Netzwerke tragen dadurch den Namen der gültigen Einreichung statt den der zurückgezogenen — „Telemedizin" statt „(Telemedizin)".

## v4.3 — 2026-08

### Verbesserungen
- Ein neu zugeschnittener Verfahrensschritt wirkt jetzt überall: umbenannte, neue oder umgehängte Schritte schlagen auch dort durch, wo bisher noch alte Bezeichnungen standen.
- „Nächster Schritt" nennt nur noch die Handlung („Gutachten beginnen"). Wo keine hinterlegt ist, steht der Status — der Verfahrensschritt selbst steht ohnehin in der Leiste am Antrag.
- Ob in einem Schritt die Bearbeitungsfrist läuft, entscheidet jetzt der Katalog. In der Auslieferung hält sie ab der Entscheidung an; die Projektleitung kann das je Schritt einstellen.

### Bugfixes
- Meilenstein-Bedingungen mit „liegt länger zurück als", „liegt nach dem Datum von" oder „Fördervariante ist eine von" gingen beim nächsten Öffnen verloren. Sie bleiben jetzt erhalten.
- Verlor eine „alle müssen zutreffen"-Bedingung einen Teil, galt der Meilenstein plötzlich für **jeden** Verbund als erreicht. Jetzt gilt er als nicht erreicht.

## v4.2 — 2026-08

### Neu
- Neben dem Suchfeld steht jetzt ein Schalter „Alle Wörter / Irgendein Wort". Bei mehreren Stichwörtern finden Sie damit entweder nur Vorhaben, in denen jedes Wort vorkommt, oder schon solche mit einem davon.
- Das Suchfeld lässt sich an der unteren rechten Ecke größer ziehen — für längere Fragen. Enter startet wie gewohnt, Shift+Enter macht einen Zeilenumbruch, und die eingestellte Größe bleibt erhalten.
### Verbesserungen
- Mehrere Stichwörter werden endlich einzeln gesucht. Bisher musste die ganze Eingabe wortwörtlich so im Text stehen — „laser schweißen" fand deshalb nichts, obwohl es 21 passende Vorhaben gibt.
- Der Assistent sitzt auf der Suchseite jetzt am rechten Rand, genau wie auf allen anderen Seiten; der eigene Knopf im Seitenkopf entfällt. „Mit KI analysieren" öffnet ihn mit den aktuellen Treffern als Kontext.
- Die Begründungen je Trefferzeile gibt es weiterhin — der Knopf heißt jetzt „Treffer begründen" und steht bei den Filtern, direkt neben „Begründungen entfernen".
### Bugfixes
- Nach dem Klick auf einen Suchtreffer führte kein Weg zurück zur Trefferliste. Jetzt steht in der Detailansicht „Zurück zur Suche", und auch der Zurück-Knopf des Browsers zeigt Ihre Suche mit allen Treffern wieder an.

## v4.1 — 2026-08

### Neu
- Die persönlichen Ordner des Teams dürfen jetzt unter mehreren Wurzeln liegen (PL-Ordner, Bearbeiter-Ordner). Beim Einsammeln wird jede Gruppe einzeln verbunden — ein Knopf je Gruppe.
### Verbesserungen
- Nach dem Einsammeln steht in der Meldung, aus welcher Gruppe wie viel gelesen wurde. Eine nicht verbundene Gruppe wird benannt, statt stillschweigend zu fehlen.
- Taucht dieselbe Person unter zwei Wurzeln auf, gewinnt ihr neuester Stand — eine liegengebliebene Ordner-Kopie überschreibt nichts mehr und zieht auch keine Stimme zurück.
- Der bisherige Sammelordner aus der Zeit vor den Gruppen wird nicht mehr zum Neuzuordnen aufgefordert, sobald alle Gruppen verbunden sind: dann steht dort „wird nicht mehr gebraucht" und ein Knopf „Entfernen".
### Bugfixes
- Ein Ordner ohne Freigabe wurde in der Sammel-Meldung als „0 gelesen" geführt — also wie ein leerer Ordner. Jetzt steht dort „kein Zugriff".

## v4.0 — 2026-08

### Neu
- Der Datenordner ist umgezogen. Beim ersten Start zeigt die App den neuen Pfad und bittet einmalig darum, den Ordner neu zu verbinden — bis dahin bleibt die bisherige Verbindung bestehen.
### Verbesserungen
- Beim Verknüpfen der CSV-Quellen steht der vorgegebene Ordnerpfad jetzt daneben und lässt sich mit einem Klick kopieren, um ihn in die Adresszeile des Dialogs einzufügen.
- Wird beim Verbinden versehentlich der falsche Ordner gewählt, bleibt die bisherige Verbindung erhalten statt verloren zu gehen.
### Bugfixes
<!-- - … -->

## v3.49 — 2026-08

### Neu
- **Kanban im eigenen Fenster.** Das Vollbild-Zeichen rechts neben dem Stift öffnet die Anträge in einem großen eigenen Fenster — dort stehen **alle** Status-Kategorien, in denen Sie Anträge haben, auch die, die Sie im Widget nicht eingestellt haben, und ohne Begrenzung auf die ersten vier Karten. Volle Bahnen werden automatisch zweispaltig, lange bekommen einen Scrollbalken. Ein Klick auf eine Karte öffnet den Antrag in der App.
- **Kanban-Bahnen einklappen.** Ein Klick auf die Kopfzeile einer Bahn schiebt sie zu einer schmalen Schiene zusammen, ein Klick auf die Schiene holt sie zurück — auch leere Bahnen lassen sich jetzt aufklappen.

### Verbesserungen
- Zweispaltige Bahnen sind breiter geworden: die Karten darin waren bisher schmaler als in einspaltigen Bahnen, obwohl mehr Platz das Ziel war.

## v3.48 — 2026-08

### Neu
- Die **Chronik** eines Vorgangs sagt jetzt, **wer** einen Eintrag gesetzt hat: hinter dem Datum steht AB, FB, QS, PA oder Jur. Einträge, die jeder setzen darf, bleiben leer.
- Wer unter **Einstellungen → Profil** seine Rolle hinterlegt, erkennt die **eigenen** Einträge an einer farbigen Kante — hervorgehoben, nicht gefiltert: was der Partner gesetzt hat, bleibt sichtbar.
- **Fehlende Gegenstücke** stehen jetzt in der Chronik: Ist das Gutachten technisch fertig, das kaufmännische aber nicht, steht direkt darunter „Gutachten kaufmännisch fertig · fehlt seit 159 T" mit Rolle und Aktenzeichen. Betrifft die neun Paare, die es im Fachsystem doppelt gibt (Gutachten, Nachforderungs-Brief, Ablehnung …).

### Verbesserungen
- Auf der Antragsseite gibt es unter „Status & Verlauf" statt drei nur noch **zwei Sichten**: **Chronik** (die Liste) und **Zeitstrahl** (die Bahn, bisher „Band"). Die alte Zeitstrahl-Ansicht zeigte ein Protokoll, das auf den meisten Rechnern leer blieb.
- Der Block mit der **Fristherleitung** steht nicht mehr dauerhaft aufgeklappt über der Seite. Dieselben Angaben stehen weiterhin in der Frist-Spalte, in der Karte des aufgeklappten Bereichs und unter „Wie die Bearbeitungsfrist zustande kommt".

## v3.47 — 2026-08

### Verbesserungen
- Wenn eine Export-CSV mit der Meldung **„Spalten haben sich geändert"** hängen blieb, war das oft gar keine geänderte Spalte, sondern eine geänderte **Zeichensatz-Kodierung** der Datei: `Nachrücker` las sich dann als `NachrÃ¼cker` und galt als verschwunden. Die App erkennt das jetzt selbst, stellt die Quelle um und importiert normal weiter — ohne Nachfrage. Ein Import mit der falschen Kodierung hätte alle Umlaute im Datenbestand verstümmelt; genau davor schützt die Prüfung weiterhin.
- Fehlen wirklich Spalten, gibt es jetzt einen Ausweg: **„Trotzdem importieren"** direkt im Bericht, einzeln je Quelle. Der Bericht nennt dafür die betroffenen Spalten mit Namen und sagt, was passiert — die Felder, die nur aus dieser Quelle kommen, werden dabei geleert. Die Zustimmung gilt nur für diesen einen Import.
- Der Knopf **„Erzwungen prüfen"** meldete „keine Änderungen gefunden", auch wenn Quellen wegen Spalten-Drift übersprungen wurden. Jetzt sagt er, wie viele es waren.

## v3.46 — 2026-08

### Verbesserungen
- Die **Chronik** eines Vorgangs braucht deutlich weniger Platz: der Monat steht jetzt links in einer eigenen Spalte statt in einer eigenen Zeile, und jeder Termin belegt genau eine Zeile — der Zusatztext steht hinter der Bezeichnung, den vollen Wortlaut zeigt der Tooltip. Ein durchschnittlicher Vorgang passt damit auf einen Bildschirm.
- Über der Liste steht jetzt auch die **Zeitspanne** („28 Termine aus den Datumsfeldern · Aug. 2025 – Juli 2026"). Und wo zwei oder mehr Monate ohne jeden Termin verstrichen sind, sagt die Monatsspalte das ausdrücklich („4 Monate ohne Termin") — Stillstand musste man sich bisher aus den Überschriften zusammenrechnen.

### Bugfixes
- Beim Aktualisieren mehrerer Export-CSVs blieb der Lauf manchmal **nach der ersten Quelle stehen**, und die Meldung nannte dabei den eigenen Namen als angeblich blockierenden Kollegen („… aktualisiert gerade, bitte in 2-3 Min erneut versuchen") — obwohl niemand sonst in der App war. Die App hielt sich selbst auf; das passierte vor allem auf Citrix und deshalb nur gelegentlich. Der Datenbestand wird jetzt in einem Zug aktualisiert, und wenn wirklich jemand anderes gerade schreibt, sagt die Meldung das auch richtig.
- Der Schalter **Nebensächliches** über der Chronik bewirkte nichts. Grund: als nebensächlich gelten nur Kommunikations-Termine (Brief, E-Mail, Fax, Telefon), und die liefert das Fachsystem in der Tagesdatei gar nicht mit. Der Schalter erscheint deshalb nur noch, wenn es solche Termine wirklich gibt, und nennt dann ihre Anzahl. Im Reiter „Zeitstrahl" wirkt er wie bisher.

## v3.45 — 2026-08

### Verbesserungen
- Auf dem Feedback-Board lassen sich Spalten wieder **zweispaltig** stellen: unter „Board anpassen" den 1/2-Schalter einer Spalte umlegen, und sie wird doppelt so breit und stellt ihre Karten nebeneinander. Der Schalter war schon länger da, hat aber bisher nichts bewirkt.
- Board und Home-Kanban sehen jetzt gleich aus — bis dahin unterschieden sie sich in Kleinigkeiten (Breite der eingeklappten Streifen, Aussehen des „+ N weitere"-Knopfs), ohne dass das je jemand so entschieden hätte.
- Die Zahl im Spaltenkopf steht jetzt rechtsbündig am Rand statt direkt hinter der Bezeichnung, und lange Bezeichnungen wie „Wartet auf Antragsteller" passen wieder vollständig in eine schmale Spalte.

### Bugfixes
- In einer zweispaltigen Spalte waren die beiden Kartenspalten unterschiedlich breit; sie sind jetzt gleich.

## v3.44 — 2026-08

### Neu
- Der Reiter **Vorgangsverlauf** im aufgeklappten Bereich der Fördertabelle zeigt jetzt den Verlauf: alle Termine aus den Datumsfeldern, nach Monat sortiert, mit Bezeichnung und dem Teilvorhaben, das sie trägt — dieselbe Chronik wie auf der Antragsseite, nur direkt in der Zeile. Sie steht vollständig da, ohne eigenen Scrollbereich.
- Codes, zu denen das Fachsystem gar kein Datum liefert (beantragte Kosten, Mitarbeiterzahl, erwartete Teilvorhaben), stehen darunter in einem eigenen Block. Im Fachsystem sind sie datiert; im Export bleibt nur der Wert übrig.

### Verbesserungen
- Die Fristrechnung steht weiterhin im selben Reiter, jetzt mit eigener Überschrift — sie beantwortet „warum diese Zahl", nicht „was ist wann passiert".
- Beide Blöcke unter der Chronik — die terminlosen Codes und die Fristrechnung — fangen **zugeklappt** an. Man schlägt sie nach, wenn man sie braucht; die Überschrift der terminlosen sagt schon zu, wie viele es sind.

## v3.43 — 2026-08

### Neu
- Im Feedback-Board lässt sich jetzt **jede Spalte vorübergehend schmal stellen** — ein Klick auf den Spaltenkopf legt sie als Streifen an den Rand, ein Klick auf den Streifen holt sie zurück. Die Nachbarn werden dadurch breiter und besser lesbar. Die eingeklappte Spalte behält ihre Zahl und bleibt Ablageziel; nach dem Neuladen stehen alle Spalten wieder offen. Dauerhaft ausblenden geht weiterhin über „Board anpassen".

### Bugfixes
- **Der aufgeklappte Bereich einer Antragszeile meldete fast nie einen Stillstand.** „Bewegung" zeigte dort das Alter des Änderungs-Journals statt der letzten Bewegung des Vorgangs — dadurch sah jeder Antrag frisch aus, und wo das Vorgangs-Board „hängt fest" sagte, stand in der Zeile „läuft". Am Bestand gemessen betraf das 1 056 von 1 057 hängenden Vorgängen. Beide Ansichten rechnen jetzt mit derselben Zahl; wo nichts belegt ist, steht wie bisher „seit mindestens …".

## v3.42 — 2026-08

### Neu
- Der aufgeklappte Bereich einer Antragszeile zeigt jetzt auch **die Aufgabe**: was an diesem Antrag ansteht, nach denselben Regeln wie im Vorgangs-Board. „warum?" daneben nennt die Regel und die Felder, aus denen sie das ableitet.
- Bei einem Vorhaben mit mehreren Teilvorhaben steht die häufigste Aufgabe oben; tragen einzelne eine andere, stehen sie mit ihrem Aktenzeichen darunter.

### Verbesserungen
- **Liegt bei** ist jetzt viel öfter beantwortet: bisher kam die Auskunft nur aus einem halb offenen Kürzel-Paar, jetzt zusätzlich aus der Aufgaben-Regel. Der Tooltip sagt, woher. Warten mehrere Teilvorhaben auf verschiedene Stellen, steht genau das da — statt einer ausgewählten.
- Die Ebenen über der Zeitachse sind jetzt **Verbund · Kürzel · Meilensteine**; Verbund und Kürzel starten eingeschaltet. „Phasen" ist weg — die Balken der Teilvorhaben sind die Zeitachse selbst und lassen sich nicht mehr versehentlich ausblenden.

### Bugfixes
- Eine leere Board-Spalte, die man aufgeklappt hat, lässt sich wieder einklappen: In der aufgeklappten Spalte steht dafür **„leer — einklappen"**. Bisher blieb sie bis zum nächsten Neuladen offen.

## v3.41 — 2026-08

### Neu
- Im Feedback-Board lässt sich die **Reihenfolge der Spalten** selbst festlegen: im Stift-Menü „Board anpassen" schiebt ein Pfeilpaar jede Spalte vor oder zurück.

### Verbesserungen
- Das Menü zeigt die Spalten jetzt **so, wie sie im Board stehen** — nicht mehr in einer festen Liste, die etwas anderes behauptete.
- **Ausgeblendete Spalten behalten ihren Platz.** Wer eine wieder einblendet, findet sie dort, wo sie war, statt ganz rechts.
- Wann eine Spalte verschwindet, steht jetzt dabei: **leere klappen von selbst zum Streifen ein, abgewählte bleiben weg** — auch wenn Tickets darin liegen. Die sind weiterhin in der Listen-Ansicht zu sehen.

## v3.40 — 2026-08

### Neu
- Klappt man eine Zeile in der Antragsliste auf, steht jetzt ganz oben, **woran es hängt**: wie weit der Antrag über der Frist ist, wann zuletzt etwas passierte, wie viele Meilensteine gerissen sind — und der eine Meilenstein, an dem es gerade festsitzt, samt den Stufen, die deshalb mitwarten.
- Daneben drei Knöpfe: ein Risiko zu diesem Meilenstein melden (der Meilenstein ist schon vorausgewählt), die Detailseite bei „Fristen & Meilensteine" öffnen, oder den Verlauf als Text kopieren.
- Der Zeitverlauf zeigt die Meilensteine jetzt **auf derselben Zeitachse** wie die Bearbeitungsphasen: Erreichtes als grüner Punkt, Gerissenes als schraffierter Balken vom Soll-Termin bis heute, mit den Verzugstagen daneben.
- Darunter eine aufklappbare Gliederung aller Meilensteine mit Zustand, Soll- und Ist-Datum; Teilschritte klappen einzeln nach. Fährt man über eine Zeile, leuchtet ihre Marke auf der Zeitachse auf — und umgekehrt.
- Mit den Pillen „Phasen / Meilensteine / Kürzel / Verbund" lässt sich einstellen, was die Zeitachse zeigt.

### Verbesserungen
- Die beiden Reiter heißen jetzt **Vorgangsverlauf** (die Fristrechnung zum Nachlesen) und **Zeitverlauf** (das Bild). Wie bisher entscheidet die geklickte Zelle, welcher zuerst aufgeht.
- Der Vorgangsverlauf trennt sauber zwischen der **Bearbeitungsfrist** (die 90-Tage-Regelfrist) und den **Zieltagen des Schritts** (aus dem Statuskatalog) — die beiden wurden leicht verwechselt.
- Steht ein Antrag noch **in** der Frist, heißt die Karte „Wo der Antrag steht" und ist nicht mehr rot umrandet. Wo etwas nicht ableitbar ist, steht der Grund statt einer leeren Stelle.

### Bugfixes
- Frist und Meilensteine rechneten gegen zwei verschiedene „heute" — die Tage über der Frist und die offenen Tage eines Meilensteins konnten deshalb um einen Tag auseinanderliegen.

## v3.39 — 2026-08

### Bugfixes
- Ein Ticket auf „umgesetzt" zu setzen sah im Feedback-Board aus, als ginge es verloren: Es verschwand aus seiner Spalte und tauchte in „Umgesetzt" nicht auf. Gespeichert war es immer richtig — die Sicht „Alles offen" zeigt nur eben keine fertigen Tickets, und die Spalte daneben meldete trotzdem „0".

### Verbesserungen
- Spalten, die die gewählte Sicht gar nicht füllen kann, schreiben jetzt „nicht in dieser Sicht" statt einer Null. Ein Klick darauf wechselt zu „Alles" und zeigt sie.
- Verlässt eine Änderung die aktuelle Sicht, sagt die Meldung unten das dazu — samt „Rückgängig" wie bisher.

## v3.38 — 2026-08

### Neu
- Der Statusverlauf zeigt jetzt, **wie lange** ein Abschnitt gedauert hat („beantragt · 29 T"). Wo die Dauer nicht belastbar ist, steht bewusst keine Zahl.
- Über den Übergängen stehen die **Kürzel** aus dem Fachsystem (AAE, XPB …) — dort, wo Platz dafür ist. So lässt sich ein Wechsel direkt benennen, wenn man nachfragt.
- Hängt ein Vorgang fest, sagt das jetzt auch die Bahn selbst: „hängt fest" am rechten Ende.

### Verbesserungen
- Die Balken sind heller und die Schrift dunkel — vorher war weiße Schrift auf farbigen Balken schwer zu lesen, im dunklen Modus durchgehend zu blass.
- Gedrängte Abschnitte am Anfang eines Verlaufs bekommen mehr Platz und tragen wieder ihren Namen statt einer Nummer, die man in der Legende nachschlagen musste.
- Die Bahn liest sich als eine durchgehende Zeitleiste: gemeinsamer Rahmen, Hilfslinien an den Jahreszahlen, und der aktuelle Abschnitt ist hervorgehoben.

## v3.37 — 2026-08

### Verbesserungen
- Der Statusverlauf einer Zeile ist leichter zu lesen: höhere Balken, größere Schrift, und die Beschriftung links wird nicht mehr abgeschnitten.
- Die Legende steht jetzt direkt unter der Bahn — mit einer Farbmarke je Eintrag, die die Nummer aus dem Balken trägt.
- Unter der Bahn steht nur noch ein kurzer Satz, woher der Verlauf kommt; die ausführliche Erklärung liegt hinter dem Info-Zeichen daneben.

### Bugfixes
- An einem Tag mit mehreren Kürzeln zeichnete die Bahn mehrere Markierungen übereinander; die oberste war ein kaum sichtbares Symbol. Jetzt steht dort eine Markierung, und ihr Tooltip nennt alle Kürzel des Tages.

## v3.36 — 2026-08

### Verbesserungen
- Die Glossar-Suche nimmt es mit Umlauten nicht mehr genau: „Prufung" findet
  „Prüfung", „Strasse" auch „Straße".
- Mehrere Wörter lassen sich kombinieren, in beliebiger Reihenfolge — „brief nf"
  findet „Brief NF von BB angelegt". Die Wörter dürfen aus verschiedenen Feldern
  stammen, etwa eines aus dem Kürzel und eines aus dem Ordner.
- Auch die Spaltensuche in den Tabellen ist jetzt unempfindlich gegen „ß" und
  „ss".

## v3.35 — 2026-08

### Verbesserungen
- Das Menü **„Darstellung"** (Förderanträge und Feedback-Board) ist deutlich kürzer: jede Einstellung steht in **einer** Zeile — Beschriftung links, Auswahl rechts. Statt drei Bildschirmzentimetern Optionsliste sieht man alles auf einen Blick.
- Ja/Nein-Einstellungen wie „Beendete zeigen" oder „Archivierte zeigen" sind jetzt **Schalter**; man sieht die Stellung, ohne zwei Zeilen zu vergleichen.
- Neu in der Kopfzeile: **„Zurücksetzen"** stellt alle Einstellungen des Menüs auf einmal zurück.
- Der Knopf bleibt schmal: er nennt die erste Abweichung vom Standard und zählt die übrigen („Darstellung: Antrag mit TV +2") statt sie alle aufzureihen.

## v3.34 — 2026-08

### Verbesserungen
- **Jede** Status-Spalte klappt jetzt den Verlauf auf — auch „FB Status" und „PreCheck Status". Vorher reagierten nur zwei der vier, was niemand erraten konnte.

### Bugfixes
- Steht ein Statusname **unter** seinem Balken, ist jetzt erkennbar, zu welchem er gehört: der kleine Strich sitzt direkt an der Unterkante des Balkens und hat dessen Farbe. Vorher konnte man ihn dem Balken darüber zuordnen — etwa „keine weiteren NF" dem Balken „NF gestellt".

## v3.33 — 2026-08

### Verbesserungen
- Die Suche im Glossar steht jetzt ganz links und ist breit genug, dass man sie
  nicht mehr übersieht.
- Sie gilt in beiden Reitern — auch unter „Für meine Rolle wichtig", wo man
  vorher 585 Kürzel durchblättern musste.
- Mit der Tastatur: „/" springt ins Suchfeld, Pfeil hoch/runter geht durch die
  Treffer, Enter nimmt den ersten, Escape leert. Die Fundstelle ist im Treffer
  farbig hervorgehoben.
- Rolle und Richtlinien-Auswahl bleiben stehen, wenn man den Reiter wechselt.

## v3.32 — 2026-08

### Verbesserungen
- Der **aufgeklappte Bereich** unter einer Antragszeile nutzt jetzt die ganze sichtbare Breite der Tabelle statt eines schmalen Streifens.
- Im **VerlaufsBand** stehen dadurch **ausgeschriebene Statusnamen** in den Balken — „Ablehnung versandt" statt einer Ziffer, für die man in die Legende schauen musste.
- Passt ein Name nicht in seinen Balken, steht er **darunter**, mit einem Strich zu seinem Abschnitt. Das betrifft die ganz kurzen Abschnitte, die auch bei viel Platz schmal bleiben.
- Die **Legende bekommt ihre Nummern nur noch**, wenn wirklich ein Abschnitt eine trägt — sonst sind sie weg.
- Der Reiter **„Fristen und Meilensteine"** behält seine schmalere Lesebreite; lange Textzeilen bleiben lesbar.

## v3.31 — 2026-08

### Neu
- Der Reiter **„Fristen und Meilensteine"** zeigt die Bearbeitungsfrist jetzt als **Band**: eine Achse von der Basis über heute bis zum Ziel, darunter die Zahlen im Klartext.
- Man sieht endlich, **welches Eingangsdatum die Uhr trägt** — `D_AAE` oder `D_XTE` — und warum das andere nicht zählt.
- Der **farbige Punkt** in der Frist-Spalte wird erklärt: welche Schwellen es gibt, welche hier greift, und warum bei angehaltenen Vorgängen gar keiner steht.
- Auf der **Vorhaben-Seite** steht dasselbe Band ganz oben — man muss „Status & Verlauf" nicht mehr aufklappen, um die Frist zu sehen.

### Bugfixes
- Im aufgeklappten Bereich einer Teilvorhaben-Zeile kamen Frist und Zieltage aus verschiedenen Vorgängen (Teilvorhaben bzw. Verbund) — korrigiert.

## v3.30 — 2026-08

### Neu
- Bei angehaltenen Vorgängen steht jetzt meistens da, **seit wann** die Uhr steht — die App liest das Datum aus dem abgeleiteten Verlauf, wenn weder Journal noch Datumsfeld es hergeben. Rund 1.600 Vorhaben bekommen damit erstmals ein Haltedatum.
- Daneben steht immer, **woher** das Datum kommt: belegt (Journal, bestätigte Regel) oder hergeleitet (Datumsfeld, bedingte Regel). Eine hergeleitete Zahl sieht man ihr an.

## v3.29 — 2026-08

### Verbesserungen
- Die **Antworten der ersten Klärrunde** stecken jetzt in der App. Wo zwei Projektformen dasselbe Kürzel verschieden benannt haben, steht ab sofort der Wortlaut, den der Fachbereich bestätigt hat.
- **Durchführbarkeitsstudien** bekommen endlich eine eigene Auskunft: acht Kürzel haben eine eigens abgestimmte Bedeutung, der Rest folgt der Regel „wie FuE". Beides ist im Verlauf erkennbar.
- In der Übersicht der offenen Punkte stehen jetzt auch die **Schreibfehler des Fachsystems** — die App liest sie richtig, korrigiert gehören sie aber dort.

### Bugfixes
- `XVK` und `XVT` waren bei Netzwerken vertauscht (kaufmännisch/technisch) — korrigiert.
- Ein Statuswert galt fälschlich als „nicht im Katalog", obwohl die App ihn längst richtig anzeigte.

## v3.28 — 2026-08

### Neu
- Der **Verlauf** eines Vorhabens ist jetzt eine **Bahn**: oben der Verbund, darunter je Teilvorhaben eine Spur, alle auf derselben Zeitachse. Wie breit ein Abschnitt ist, sagt, wie lange der Status gestanden hat.
- Ein Klick auf eine Spur klappt darunter ihre Abschnitte und Kürzel im Klartext auf — die bisherige Liste ist also nicht weg, sie steckt eine Ebene tiefer.
- An den Übergängen steht, **wie sicher** ein Kürzel den Statuswechsel belegt. Wo die App gar keinen Verlauf ableiten kann, sagt sie den Grund — „für diese Richtlinie keine Regeln" ist etwas anderes als „kein Bearbeitungsstand".
- **„Verlauf kopieren"** legt den ganzen Verlauf als Text in die Zwischenablage, mit den Statuscodes des Fachsystems — gedacht für Rückfragen dorthin.
- Auf der Verbund-Seite gibt es die Bahn als dritte Ansicht neben Chronik und Zeitstrahl.

## v3.27 — 2026-08

### Verbesserungen
- Das Passwort, mit dem du dich anmeldest, entscheidet jetzt allein darüber, welche Bereiche du siehst. Vorher blieb offen, was eine frühere Anmeldung geöffnet hatte — auch wenn du dich danach mit dem allgemeinen Passwort angemeldet hast.
- Die Anmeldemaske sagt, dass ein Bereichs-Passwort dort ebenfalls gilt: wer nur eines davon hat, tippt weiterhin genau ein Passwort.
- „Module freischalten" ist in den Einstellungen auffindbar, und der Menüpunkt „Kurator-Bereich" verschwindet dort, wo es die zugehörige Einstellung gar nicht gibt.

## v3.26 — 2026-08

### Neu
- Die Vorgangs-Regeln haben einen Reiter **Klärfragen**: er sammelt aus dem Bestand, was am Status- und Kürzelkatalog fachlich offen ist, und sagt zu jeder Frage, wer sie beantwortet.
- Daraus entsteht auf Knopfdruck eine **Excel-Arbeitsmappe zum Herumreichen** — mit fixierter Kopfzeile, Filter, vorbereiteten Antwortfeldern und Auswahllisten. Beantwortet wird außerhalb der App; die Vorgabespalten sind gegen Verrutschen geschützt.

### Verbesserungen
- Der Kürzel-Katalog sagt jetzt nicht nur, *dass* eine Bedeutung je Projektform verschieden ist, sondern *welche* Projektform was sagt.

## v3.25 — 2026-08

### Bugfixes
- **Der Balken „Altlasten (Rückstand)" in der Auslastung ist zurück.** Er war bei den meisten Mitarbeitenden leer, obwohl sich an den Anträgen nichts geändert hatte: Als der Verfahrensschritt „Vollständigkeit" im Statuskatalog mit „Prüfung" zusammengelegt wurde, galten vier der fünf Status, die einen Altantrag ausmachen, plötzlich als „In Arbeit". Gezählt wurden zuletzt nur noch 22 statt 395 Teilvorhaben.
- **Die Arbeitsliste „Wartet auf Antragsteller" ist wieder gefüllt.** Aus demselben Grund stand sie auf null, obwohl 52 Anträge auf eine Nachlieferung warteten.
- Damit so etwas nicht wiederkehrt: Bei den Status, deren Zuständigkeit fachlich feststeht, hängt die Arbeitsliste jetzt am Status selbst. Der Verfahrensschnitt bleibt frei einstellbar — er kann die täglichen Arbeitslisten aber nicht mehr nebenbei umräumen.

## v3.24 — 2026-08

### Verbesserungen
- **Die Werkzeugleiste der Feedback-Tickets sieht jetzt aus wie die der Förderanträge.** Ganz links in der rechten Gruppe steht der Umschalter **Liste/Board** — der Griff, den man am häufigsten braucht. Alles Seltene ist in **ein** Menü „Darstellung" gewandert: Gruppierung, Anzeige-Dichte und ob archivierte Tickets mitlaufen. Es ist dasselbe Menü wie auf den Förderanträgen und bleibt offen, solange man mehrere Dinge einstellt.
- Die Sortierung sagt jetzt, was sie sortiert: **„Sortiert nach: Letzte Änderung"** statt eines allein stehenden „Zuletzt bewegt". Die Listen-Spalte heißt passend dazu **„Geändert"**.
- Der Umschalter zwischen **Nutzer- und Entwickler-Sicht** ist eine unaufdringliche Pille neben dem Seitentitel — dieselbe Form wie die Profil-Anzeige auf den Förderanträgen. Die **Hilfe** steht wie auf jeder anderen Seite ganz rechts außen.
- Gleiche Bedeutung, gleiches Symbol: Filter, Board-Ansicht, Verwaltung, „Board anpassen" und die Zustimmung tragen jetzt überall in der App dasselbe Zeichen.

### Bugfixes
- **Ein freigeschaltetes Modul bleibt jetzt freigeschaltet.** Nach der Eingabe des Zusatzpassworts lädt die App neu — dabei konnte die eben gespeicherte Freischaltung verloren gehen, und der Bereich stand danach wieder auf „gesperrt". Ein zweiter Versuch half meist, deshalb fiel es nur auf langsamen Rechnern auf. Betraf ebenso alles andere, was die App unmittelbar vor einem Neuladen speichert.
- Schlägt eine Freischaltung fehl, steht der Grund jetzt darunter. Bisher passierte sichtbar nichts.
- Die Menüs beim Sponsern schließen sich jetzt mit Esc und beim Klick daneben; beide hatten zuvor leicht unterschiedliche Schriftgrößen.

## v3.23 — 2026-08

### Verbesserungen
- **Der Verlauf eines Vorgangs ist jetzt für alle Projektformen da.** Bisher konnte die App nur bei Netzwerk-Vorhaben sagen, welches Kürzel welchen Statuswechsel ausgelöst hat — bei FuE, Durchführbarkeitsstudien und Dienstleistungen blieb der Bereich unter der Tabellenzeile leer. Grundlage sind jetzt die Trigger-Regeln aus C16 selbst, und die gelten je Richtlinie.
- **Die Abschnitte haben Zeiträume statt Lücken.** Weil deutlich mehr Statuswechsel belegt sind, lässt sich für vier von fünf Abschnitten sagen, wie lange der Vorgang darin stand — vorher war es gut ein Drittel.
- **Wo eine Regel-Bedingung nicht überprüfbar ist, steht das da** („Regel greift, eine Bedingung war nicht prüfbar") samt Grund. Ein Wechsel, den die App nicht absichern kann, wird weder verschwiegen noch als sicher ausgegeben.

### Bekannte Lücke
- Bei **Durchführbarkeitsstudien** stammt der Klartext eines Kürzels aus einer anderen Projektform — für DS gibt es keine eigene Liste. Wo die Formen sich widersprechen, steht „je Projektform verschieden" daneben. Das ist zur Klärung gemeldet.

## v3.22 — 2026-08

### Neu
- Im Ticket-Detail gibt es unter dem **Verlauf** jetzt ein eigenes Eingabefeld mit Textbausteinen. Das Team kann von dort „Als Rückfrage senden" (der Text geht raus und das Ticket wandert zugleich auf *Rückfrage*), der Ersteller „Als Ergänzung". `Strg+↵` sendet.
- Am eigenen Ticket führen **„Ergänzung hinzufügen"** und **„Kommentar"** direkt zu diesem Feld — vorher stand dort nur der Hinweis, man möge weiter unten suchen.

### Verbesserungen
- **Das Board behält seinen Platz, wenn rechts ein Ticket aufgeht.** Bisher blieb von sechs Spalten weniger als eine übrig. Jetzt ist das Detail die schmale Spur; am Trenner lässt sich das verschieben, ein Doppelklick stellt den Ausgangszustand her.
- **Leere Spalten klappen wieder ein** und stehen als schmaler Streifen da. Ein Klick faltet einen auf; beim Ziehen einer Karte öffnen sich alle, damit man überall ablegen kann. Die übrigen Spalten teilen sich die frei gewordene Breite.
- In der Listen-Ansicht steht der Typ als beschriftetes Kennzeichen (**Problem · Idee · Lob · Frage**) statt als kaum unterscheidbarer Farbpunkt.

### Bugfixes
- Schlägt das Speichern eines Kommentars fehl, bleibt der geschriebene Text jetzt stehen, statt mit der Fehlermeldung zu verschwinden.

## v3.21 — 2026-08

### Neu
- In der Tabellen-Ansicht der Förderanträge klappt ein Klick auf die **Status-Zelle** oder die **Frist-Zelle** unter der Zeile einen Bereich auf: der Reiter *Verlauf* zeigt, welche Kürzel wann gesetzt wurden und welche Statusabschnitte daraus entstanden sind, der Reiter *Fristen und Meilensteine* die Frist-Kennzahlen samt Meilenstein-Leiste. Es ist immer nur eine Zeile offen; jede Änderung an Sortierung, Filter oder Ansicht schließt sie wieder.
- Der Frist-Reiter rechnet vollständiger als die Frist-Spalte: er kennt das Datum „alle Anträge da" und, wo die Uhr steht, seit wann sie steht.

### Verbesserungen
- **Klicks in der Tabelle sind jetzt eindeutig**: Förderkennzeichen und Akronym öffnen den Antrag, Status und Frist klappen auf, alles andere tut nichts. Klickbare Zellen sind beim Überfahren an der gepunkteten Unterstreichung und dem kleinen Pfeil zu erkennen und lassen sich auch mit der Tastatur bedienen.
- Das Info-Popover am Status zeigt keine abgeschnittene Verlaufs-Liste mehr, sondern führt mit „Ganzen Verlauf zeigen" in den neuen Bereich — dort steht der vollständige Verlauf statt der ersten fünf Einträge.

## v3.19 — 2026-08

### Neu
- Interne Vorarbeit: Die App kann jetzt aus den Datumsspalten eines Vorgangs rekonstruieren, welche Statusabschnitte er durchlaufen hat und wie lange er in jedem stand. Zu sehen ist davon noch nichts — die Darstellung kommt in einem späteren Schritt.

## v3.18 — 2026-08

### Neu
- Mehrere Tickets auf einmal bearbeiten: Häkchen setzen, unten erscheint eine Leiste für Status, Aufwand, Zuweisung und Archivieren. Auch das lässt sich zurücknehmen — jedes Ticket kehrt auf seinen eigenen vorherigen Wert zurück.
- Karten lassen sich zwischen den Spalten ziehen. Ist die gezogene Karte markiert, wandert die ganze Auswahl mit.
- Rechtsklick auf eine Karte oder Zeile öffnet dasselbe Menü wie der `⋯`-Knopf.
- Kommentieren, ohne das Ticket zu öffnen: im Menü ein Textfeld mit Bausteinen. „Als Rückfrage" schickt den Text und stellt das Ticket gleichzeitig auf Rückfrage.
- Gruppieren nach Bereich, Aufwand oder Ersteller — klappbare Bänder quer zur Statusachse des Boards.

### Verbesserungen
- Tastatur: `Esc` hebt erst die Auswahl auf und schließt beim zweiten Mal das Detail; bei offenem Detail blättern `J`/`K` durch die Treffer.
- Im Verlauf sind Ergänzungen und Rückfragen jetzt als solche gekennzeichnet.

## v3.17 — 2026-08

### Neu
- Das Feedback-Board hat jetzt Sichten wie „Meine Tickets", „Wartet auf mich" oder „Neu diese Woche" — mit Trefferzahl, damit man nicht mehr bei „alle" anfangen muss.
- Links steht eine Filterleiste nach Typ, Status und Bereich; jede Zeile zeigt, wie viele Tickets sie trifft.
- Neuer Status **Rückfrage**: Wenn das Team etwas von dir wissen will, taucht dein Ticket unter „Wartet auf mich" auf, statt dass die Frage als Kommentar untergeht.
- Im Detail steht jetzt im Klartext, woran du bist: „Noch nicht geschätzt", „Aufwand M · Umsetzung 8 h · ist eingeplant" oder „Wartet auf dich".
- Solange noch niemand dein Ticket angefasst hat, kannst du Titel und Text selbst nachbessern.

### Verbesserungen
- Status, Aufwand, Zuständigkeit und Bereich lassen sich direkt an der Karte ändern — ein Klick statt vier. Jede Änderung meldet sich unten kurz und lässt sich zurücknehmen.
- Das Board zeigt je Spalte, wie viel Arbeit darin steckt („384 h geschätzt · 44 ungeschätzt") und lädt lange Spalten erst auf Klick nach.
- Das Board bleibt beim Öffnen eines Tickets stehen, statt in die Listenansicht zu springen; die Liste blendet stattdessen Spalten aus, wenn der Platz knapp wird.
- Neue Anzeigestufe „Sehr kompakt" für den Überblick über viele Tickets.

## v3.16 — 2026-08

### Verbesserungen
- Statusbezeichnungen sind überall gleich. Bisher hieß derselbe Status je nach Ansicht anders — in der Suche stand sogar ein Schreibfehler.
- Neben jeder abgekürzten Statusbezeichnung liegt jetzt ein Tooltip mit dem vollen amtlichen Namen.
- Statuswerte, die bisher gar keine Kurzform hatten (Sonderstatus, Skizze eingegangen, assoziierter/internationaler Partner), haben eine bekommen.
- In den Vorgangs-Regeln lassen sich die Kurzformen pflegen — sortiert danach, wie oft ein Status im Bestand vorkommt.

### Bugfixes
- „Stellungnahme zur Rücknahmeempfehlung" wurde in der Antragsliste ungekürzt ausgeschrieben; die vorgesehene Abkürzung passte auf eine Schreibweise, die im Export nicht vorkommt.
<!-- - … -->

## v3.15 — 2026-08

### Neu
- **Die Spaltenfilter zeigen jetzt Trefferzahlen.** Hinter jedem Wert steht, wie viele Zeilen er liefert — beim Antragseingang zusätzlich am Jahr die Summe seiner Monate. Bei 605 Akronymen oder 33 Kürzeln muss man dafür nicht mehr erst filtern.
  - Die Zahl berücksichtigt Filter aus **anderen** Spalten, den eigenen nicht: die Zahlen springen also nicht, während man in derselben Spalte auswählt.
  - Ein Wert, den die anderen Filter auf **0** drücken, verschwindet nicht, sondern wird nur blasser — sonst könnte man ihn nicht mehr abwählen.
  - Gezählt werden Teilvorhaben. In der Ansicht „Antrag" fasst die Tabelle Verbünde danach zu einer Zeile zusammen, dort stehen unter einer Zahl von 48 also z. B. 25 Zeilen.

## v3.14 — 2026-08

### Neu
- Der Kürzelkatalog aus der Zuarbeit ist eingelesen: 608 Kürzel, jeweils getrennt nach Projektform (NW, FuE, DL, EP), samt Rollen, Zuordnung zu Verbund oder Teilvorhaben und einer Gliederung fürs Glossar.
- Umbenannte Kürzel bleiben auflösbar. Ein Antrag von 2018 trägt noch `AAW`; dass das heute `ARW` heißt, weiß die App jetzt.

### Bugfixes
- Kürzel bedeuten je nach Projektform Verschiedenes — das war bisher nicht berücksichtigt. `AB` heißt bei Dienstleistungsprojekten „Bewilligungsempfehlung durch Haushaltsbeauftragte", bei allen anderen „bewilligungsreif/Akte an Euronorm"; angezeigt wurde immer dieselbe Fassung. Die Grundlage dafür ist jetzt gelegt.

## v3.13 — 2026-08

### Neu
- **„Einzelprojekt" hat jetzt ein Menü.** Der kleine Pfeil daneben öffnet die Auswahl **alle Einzelprojekte · mit NW Bezug · ohne NW Bezug**. Vorher standen die beiden Netzwerkbezug-Stufen als eigene Knöpfe daneben — das machte die Leiste breit und ließ die Zahlen wie eine Aufteilung von „Einzelprojekt" aussehen, die sie nicht sind (ein DS-Einzelprojekt trägt weder 16KN noch 16EP und zählt in keiner der beiden mit).

### Verbesserungen
- **Mehrere Filter dürfen gleichzeitig offen bleiben.** Bisher schloss das Aufklappen einer Pille die vorherige. Welche offen sind, merkt sich die App je Reiter.
- **Die Projektart-Zahlen folgen jetzt dem Antragstyp.** Wählen Sie oben „FuE", zählt die Projektart darunter nur noch FuE-Anträge (aus „Alle 889" wird „Alle 619"). Vorher zeigte sie Zahlen aus dem vollen Bestand, die ein Klick gar nicht liefern konnte.
- **Man sieht einer zugeklappten Pille an, ob sie filtert** — sie bekommt einen farbigen Rahmen und hinterlegt ihren Wert. Aufgeklappt ist die Beschriftung farbig.
- **Kürzere Beschriftung:** „· mit Netzwerkbezug" heißt jetzt „mit NW Bezug".

### Bugfixes
- **Das „Einzelprojekt"-Menü lag hinter der Tabelle** und war dadurch kaum bedienbar. Es liegt jetzt darüber und bleibt beim Scrollen an seinem Knopf.
- **Der Knopf las sich „Einzelprojekt · Einzelprojekt"**, sobald man im Menü „alle Einzelprojekte" wählte.

## v3.12 — 2026-08

### Verbesserungen
- In der Tabellen-Ansicht der Förderanträge bleibt die Kopfzeile beim Blättern nach unten stehen — man sieht also auch weit unten noch, welche Spalte man liest. Die Reiter, die Suche und die Filter darüber bleiben ebenfalls sichtbar; gescrollt wird nur noch die Tabelle.
- Die drei Schalter „Ansicht", „Gruppierung" und „Beendet" stehen jetzt zusammen in einem Menü „Darstellung". Der Knopf zeigt weiterhin an, was gerade vom Normalfall abweicht — er nimmt nur deutlich weniger Platz weg.
- Der Kopf der Seite ist zwei Zeilen kürzer: die Trefferzahl („403 Teilvorhaben · 183 Verbund-Zeilen") rückt ans Ende der Filter-Zeile, statt eine eigene, halb leere Zeile zu belegen. Dadurch beginnt die Liste rund 70 Pixel weiter oben.

## v3.11 — 2026-08

### Bugfixes
- Die Bearbeitungsfrist läuft nicht mehr weiter, wenn der Vorgang entschieden ist. Bisher zeigten längst abgeschlossene Anträge Werte wie „seit 2 760 T" — die Uhr rechnete auch dann, wenn niemand mehr an ihnen arbeitete.
- Die Zähler „Überfällig" und „Diese Woche" oben in den Förderanträgen messen jetzt dasselbe wie die Frist-Spalte. Vorher zählten sie das Alter des Antragseingangs und konnten deshalb von der Liste abweichen.

### Verbesserungen
- Eine leere Frist-Spalte sagt jetzt, warum sie leer ist: „angehalten" (im aktuellen Schritt läuft keine Frist) oder „—" mit dem Hinweis, dass kein Eingangsdatum hinterlegt ist. Bisher sahen beide Fälle gleich aus.
- Der Tooltip an der Frist nennt das Fristdatum und woraus es gerechnet ist.
- In welchen Verfahrensschritten die Frist läuft, ist jetzt in den Vorgangs-Regeln einstellbar (Reiter „Verfahrensschritte") — dafür braucht es kein neues Programm mehr.

## v3.10 — 2026-08

### Neu
- Beantwortete Tickets tragen im Feedback-Board den Marker „Antwort" — in Board und Liste, dauerhaft und für jeden. Wer mit der Maus darauf stehen bleibt, liest die Antwort des Teams, ohne das Ticket zu öffnen.
- In der Beta-Phase darf jedes PL-Mitglied jedes Ticket nachträglich ergänzen, nicht mehr nur das selbst gemeldete.

### Verbesserungen
- Die Suche im Feedback-Board findet Tickets jetzt auch über den Wortlaut der Team-Antwort.
- Der Reiter „Einstellungen" der Feedback-Verwaltung zeigt zur geteilten Datei die Zahl der Einträge und das Datum der letzten Änderung, statt fälschlich „Datenverzeichnis nicht verbunden" zu melden.

### Bugfixes
- Eigene Tickets wurden nicht mehr als eigene erkannt, sobald im Profil ein Bearbeiter-Kürzel stand: „Von mir" blieb leer, die Glocke zählte nichts, und „Ergänzen" fehlte. Sie werden jetzt unter beiden Schreibweisen gefunden.
- Änderungen in der Feedback-Verwaltung meldeten „Gespeichert", auch wenn sie den gemeinsamen Datenspeicher nie erreichten. Fehlschläge werden jetzt angezeigt.
- War die geteilte Feedback-Datei kurz nicht lesbar, konnte ein Speichern den Bestand des Teams auf ein einzelnes Ticket zusammenstreichen. Das Speichern bricht in diesem Fall ab.
- Der gepflegte System-Prompt des Feedback-Assistenten wurde nie vom Datenspeicher gelesen; der Assistent lief still auf der eingebauten Fassung.

## v3.9 — 2026-08

### Verbesserungen
- Die Spalten der Fördertabelle sind jetzt so breit wie ihr Inhalt und nicht breiter. Schmale Spalten wie FKZ, TIB/BIB oder Frist brauchen deutlich weniger Platz; der frei werdende Platz geht an die Spalten, deren Text vorher abgeschnitten war (etwa Antragsteller).
- Der Filter-Pfeil im Spaltenkopf erscheint erst beim Überfahren — sichtbar bleibt er dort, wo ein Filter gesetzt ist. Das schafft in jeder filterbaren Spalte Platz für den eigentlichen Inhalt.
- Der Kopier-Knopf in der FKZ-Spalte belegt keinen festen Platz mehr; er erscheint wie bisher beim Überfahren der Zeile.

### Bugfixes
- Eine Spalte, die man am Rand schmaler gezogen hat, wird nicht mehr ungefragt wieder mit aufgeblasen.
- Sehr schmale Spaltenüberschriften liefen um wenige Pixel über ihren Rand hinaus.

## v3.8 — 2026-08

### Neu
- Neuer Schalter **„Projektart"** über der Liste, neben „Antragstyp": **Einzelprojekt** (FuE- oder DS-Antrag mit genau einem Teilvorhaben) oder **Kooperationsprojekt** (mit mehreren) — oder wie bisher alles.
- Einzelprojekte lassen sich zusätzlich nach **Netzwerkbezug** trennen: „mit" sind die mit Förderkennzeichen 16KN, „ohne" die mit 16EP.

Zwei Hinweise zu den Zahlen: DL- und NW-Anträge haben keine Projektart und erscheinen nur unter „Alle". Und die beiden Netzwerkbezug-Zahlen ergeben zusammen weniger als „Einzelprojekt", weil ein DS-Einzelprojekt das Kennzeichen 16DS trägt und damit in keine der beiden Gruppen fällt.

## v3.7 — 2026-08

### Verbesserungen
- Der Filter der Spalte „Antragseingang" gliedert jetzt nach **Jahr und Monat**, mit dem jüngsten Jahr oben. Die Jahre sind zugeklappt; ein Klick auf den Pfeil zeigt die Monate, ein Häkchen am Jahr wählt alle seine Monate.
- „Werte suchen…" findet dort Monatsnamen ebenso wie Jahreszahlen und klappt die Treffer vorübergehend auf.

### Bugfixes
- Anträge ohne lesbares Eingangsdatum verschwanden aus der Tabelle, sobald man im Filter ein Jahr anhakte. Sie stehen jetzt als „(leer)" am Ende der Liste und lassen sich gezielt anzeigen.

## v3.6 — 2026-08

### Neu
- **Ein eigener Schalter für die beendeten Anträge.** Im Reiter „Alle" steht über der Liste jetzt „Beendet: ausgeblendet" — abgeschlossene und abgelehnte Anträge sind standardmäßig aus dem Weg, ein Streifen unter der Liste nennt ihre Zahl („Beendet 2.474 · Schlussvermerk 1.364 · abgelehnt/zurückgez. 1.110") und blendet sie auf Klick wieder ein. Neu ist vor allem, dass das **zusammen mit jeder Gruppierung** funktioniert: Sie können nach FB gruppieren *und* das Beendete ausblenden.

### Verbesserungen
- **Der Abschnitt „Arbeitsvorrat" erscheint nur noch, wo er etwas trennt.** Bisher hing die Trennung daran, dass keine Gruppierung eingestellt war — deshalb tauchte sie mit der letzten Version plötzlich bei allen auf, die zuvor nach Verbund gruppiert hatten. Jetzt entscheidet allein der neue Schalter; die beiden Bänder stehen nur noch da, wenn das Beendete eingeblendet und nichts gruppiert ist.
- **Eine laufende Suche zeigt den ausgeblendeten Teil weiterhin** — sonst fehlten Treffer, ohne dass man es merkt.

### Bugfixes
- **Die Zahl an einem Abschnittskopf meint jetzt den Abschnitt.** Bisher zählte sie nur die gerade geladenen Zeilen: „AAt 48" hieß „48 davon sind sichtbar", nicht „AAt hat 48" — und die Zahl wuchs beim Weiterscrollen. Betraf die Bänder in der Tabelle (Status/NW/FB/AB) genauso wie die Status-Abschnitte in Listen- und Kartenansicht.

## v3.5 — 2026-08

### Neu
- **Spalten passen sich dem Inhalt an.** Bisher hatte jede Spalte eine fest eingestellte Breite — bei mittlerweile über 30 wählbaren Spalten passte die selten. Jetzt richtet sich die Breite nach dem, was tatsächlich drinsteht. Lange Freitexte wie „Antragsteller" bekommen eine Obergrenze, damit sie die Tabelle nicht auseinanderziehen. Eine von Ihnen selbst gezogene Breite bleibt unangetastet.

- **Über den Spaltenköpfen steht jetzt, wozu sie gehören.** Eine zusätzliche Zeile bündelt die Spalten unter „Antrag", „Zuständigkeit", „Antragsdaten", „Status" und „Termine". Damit das zusammenhängende Bänder ergibt, sind die Spalten nach diesen Gruppen sortiert — die gewohnte Folge FKZ · TIB · BIB bleibt vorn, Akronym und Antragsteller rücken hinter die Kürzel. Der Excel-Export übernimmt dieselbe Reihenfolge.
- **Der Spalten-Auswahl hat ein Suchfeld bekommen.** Bei 38 wählbaren Spalten war das Scrollen durch die Liste mühsam. Dazu steht oben, wie viele Spalten gerade eingeblendet sind („9 von 38"), und jede Rubrik hat einen Schalter, der sie komplett ein- oder ausblendet. Die Suche kommt auch ohne Umlaute aus: „fordergeber" findet „Fördergeber".
- **Die FKZ-Spalte bleibt stehen.** Beim Blättern nach rechts scrollen die übrigen Spalten unter der FKZ-Spalte hindurch — man sieht also immer, zu welchem Antrag die Zeile gehört. Bei einer Gruppierung bleibt auch die Band-Beschriftung (z. B. „THÜ") links sichtbar.
- **Doppelklick setzt eine Spalte zurück.** Haben Sie eine Spalte selbst breiter oder schmaler gezogen und wollen das rückgängig machen: Doppelklick auf die Trennlinie im Spaltenkopf. Die Spalte richtet sich danach wieder nach ihrem Inhalt.

### Verbesserungen
- **Der Griff zum Stauchen der Tabelle ist immer erreichbar.** Der schmale Streifen am rechten Tabellenrand, mit dem sich die ganze Tabelle schmaler ziehen lässt, saß bisher am Ende der Spalten — bei vielen Spalten also außerhalb des Bildschirms. Jetzt steht er fest am rechten Rand und ist so hoch wie die Tabelle. Ziehen ändert die Breite, ein Doppelklick setzt sie zurück.
- Datumsangaben in der Tabelle stehen jetzt in deutscher Schreibweise: **30.07.2018** statt `2018-07-30`. Sortiert wird weiterhin chronologisch.
### Bugfixes
- Im Excel-Export standen unter „FB Status", „PreCheck Status" und den Ordner-Spalten Datumswerte, obwohl die Spalten in der Tabelle einen Status anzeigen. Jetzt steht dort derselbe Text wie auf dem Bildschirm.
- Ein einfacher Klick auf die Trennlinie zwischen zwei Spaltenköpfen hat die Spaltenbreite verändert, ohne dass man gezogen hat. Erst ein echtes Ziehen ändert die Breite.

## v3.4 — 2026-08

### Neu
- Neu unter „Werkzeuge": das **Glossar**. Ein Suchfeld über alles — Abkürzungen wie NF, RNE oder ZuwB, dazu die Statuswerte, die Kürzel des Fachsystems und die To-do-Regeln. Wer wissen will, was ein Kürzel bedeutet, muss dafür nicht mehr die Vorgangs-Regeln öffnen.
- Zu jedem Statuswert steht dort, in welchem Verfahrensschritt er liegt, in welche Arbeitsliste er fällt, wie viele Zieltage gepflegt sind, wie oft er im Bestand vorkommt — und **wodurch er entsteht**, also welche Kürzel ihn setzen.
- Zu jedem Kürzel steht, was es auslöst und **welche To-do-Regeln es prüfen**. Damit lässt sich die Kette Kürzel → Status → Verfahrensschritt in zwei Klicks nachgehen.
- **„Für meine Rolle wichtig"**: die Kürzel Ihrer Fachrolle, das häufigste zuerst, mit einem Filter auf die Richtlinie. Kürzel ohne Rollen-Vermerk stehen abgesetzt darunter — die darf jeder setzen.

### Verbesserungen
- Der Begriffs-Abschnitt in „Über die App" war überholt. „Rollen" vermischte zwei Dinge, die gleichzeitig gelten: welche Ausgabe der App jemand benutzt, und welche Fachrolle er im Verfahren hat. Beides steht jetzt getrennt im Glossar, zusammen mit Verfahrensschritt und Arbeitsliste.
- Im Hilfe-Dialog war die Überschrift der Seite kleiner gesetzt als die Zwischenüberschriften darin. Die Größen stimmen jetzt.
- Aus jedem Hilfe-Dialog und aus dem Info-Punkt am Status führt ein Weg direkt ins Glossar.

### Bugfixes
<!-- - … -->

## v3.3 — 2026-08

### Neu
- Die Tabelle der Förderanträge zeigt jetzt alle vier Zuständigkeiten: **TIB** und **BIB** für die Antragsphase, **ZTP** und **PFM** für die Begleitphase. **BIB** ist ab sofort standardmäßig eingeblendet, die übrigen lassen sich unter „Spalten" dazuschalten. Damit ist im Reiter „Begleitung" auf einen Blick zu sehen, wer einen Antrag tatsächlich begleitet — bisher stand dort nur, wer ihn im Antragsverfahren betreut hat.
- Nach jedem der vier Kürzel lässt sich auch filtern und sortieren (Pfeil bzw. Trichter im Spaltenkopf).

### Verbesserungen
- Das Menü „Spalten" ist gegliedert: **Antrag**, **Zuständigkeit**, **Status**, **Termine** und die Ordner des Fachsystems — letztere getrennt nach Teilvorhaben und Verbund, weil beide Ebenen gleichnamige Ordner führen. Die Überschriften bleiben beim Scrollen stehen, und das Menü nutzt jetzt die volle Fensterhöhe.

### Bugfixes
- Kürzel wurden in Großbuchstaben angezeigt und damit verfälscht: aus „StE" wurde „STE". Sie stehen jetzt so da, wie sie geschrieben werden.

## v3.2 — 2026-08

### Neu
- Die Tabelle der Förderanträge hat jetzt zwei getrennte Schalter statt einem. **Ansicht** bestimmt, was eine Zeile ist: „Antrag" fasst einen Verbund zu einer Zeile zusammen, „Antrag mit TV" zeigt jedes Teilvorhaben einzeln. **Gruppierung** bestimmt nur noch die Zwischenüberschriften. Beides lässt sich frei kombinieren — etwa eine Zeile je Antrag, sortiert unter den Zuständigen.
- Neue Gruppierungen in der Tabelle: nach **Netzwerk** (mit dem Netzwerknamen in der Zwischenüberschrift), nach **FB** und nach **AB**. Anträge ohne Netzwerk bzw. ohne Kürzel stehen gesammelt am Ende.

### Verbesserungen
- „Verbund" ist aus der Gruppierung verschwunden: es hat nie nach Verbund gruppiert, sondern die Teilvorhaben ausgeblendet. Genau das macht jetzt die Ansicht „Antrag" — und blockiert dabei nicht mehr die Gruppierung nach Status.
- Der Browser-Tab trägt jetzt ein eigenes Symbol (ein „Z") und einen sprechenden Namen: `zim-dashboard`. Wer mehrere Fassungen gleichzeitig offen hat, erkennt sie an der Farbe des Symbols — jede Fassung hat ihre eigene.

### Bugfixes
- Die Zwischenüberschriften der Status-Gruppierung in der Tabelle zeigten einen internen Schlüssel („VOR-ENTSCHEIDUNG") statt der Bezeichnung („Vor Entscheidung").

## v3.1 — 2026-08

### Neu
- Die Statuswerte-Seite zeigt jetzt oben, wie weit der gepflegte Katalog vom ausgelieferten Stand entfernt ist: wie viele Verfahrensschritte entfernt oder umbenannt wurden, wie viele Status umgehängt sind, wie viele Zieltage gepflegt sind. Aufklappen zeigt die Einzelheiten. Das ist keine Mängelliste, sondern die Grundlage für die nächste Programm-Fassung — es wird nichts automatisch übernommen oder zurückgesetzt.
- „Zu klären" stellt neben jeden Beschluss, was der Katalog dazu heute wirklich führt: umgesetzt, noch offen oder abweichend beschlossen. Mit dem neuen Reiter „Nicht umgesetzt" sieht man am Ende einer Sitzung in einem Klick, was noch nachzutragen ist.

### Verbesserungen
- Der Export „Seed-Änderungen" in „Zu klären" liest jetzt den gepflegten Katalog statt der Antworten und enthält damit auch Umbenennungen und entfernte Verfahrensschritte. Vorher konnte er einen Teil der tatsächlichen Änderungen verschweigen.

## v3.0 — 2026-08

### Neu
- **Module mit einem Zusatzpasswort freischalten:** Auslastung und die Kurations-Bereiche liegen jetzt hinter je einem eigenen Passwort. Du gibst es entweder gleich beim Anmelden ein — dann ist der Bereich sofort offen — oder später unter *Einstellungen → Mein Profil → Module freischalten*. Eine Freischaltung gilt 12 Stunden und übersteht das Schließen der App.

### Verbesserungen
- **Statt fünf Programm-Versionen gibt es nur noch drei.** Wer bisher `zah-as.html` oder `zah-kurator.html` benutzt hat, nimmt künftig **`zah-pl.html`** — dieselbe Datei für alle, der Rest hängt am Passwort. Die Version für alle Kolleg:innen heißt jetzt **`zim-dashboard.html`** (vorher `zah-prod.html`).
- **Einmalige Einrichtung beim Umstieg:** Weil die Datei einen neuen Namen hat, fragt sie beim ersten Start noch einmal nach dem Datenordner und Deinem Namen — wie bei einer Neuinstallation. Es gehen keine Daten verloren: alles Fachliche liegt auf dem gemeinsamen Laufwerk, Dein Rechner hält davon nur eine Kopie.

### Bugfixes
- **Kommentare gehen nicht mehr verloren.** Konnte die App die gemeinsame Feedback-Datei im Moment des Speicherns nicht lesen (etwa weil jemand anderes gerade schrieb), verschwand der Kommentar wortlos — er sah gespeichert aus, war aber nirgends. Jetzt wird nichts mehr stillschweigend verworfen: Der Text bleibt stehen und ein Hinweis bittet Dich, noch einmal zu senden.

## v2.416 — 2026-08

### Neu
- **Kommentare lesen, ohne zu klicken:** Bleib mit der Maus auf dem Sprechblasen-Zähler einer Feedback-Karte stehen — die letzten Kommentare erscheinen direkt daneben (mit Name und Datum, lange Beiträge gekürzt, ältere als Hinweis „+N ältere"). Bei viel Text kannst Du in der Vorschau scrollen; ein Klick öffnet wie gewohnt das Ticket.
- **Neue Kommentare fallen auf:** Hat seit Deinem letzten Besuch jemand anderes an einem Ticket kommentiert, trägt die Karte oben ein blaues **„+2"**, und der Sprechblasen-Zähler färbt sich blau. Im Ticket selbst sind die neuen Beiträge hinterlegt und mit „neu" markiert — so siehst Du auf einen Blick, wo gerade diskutiert wird. Der Marker verschwindet, sobald Du das Ticket geöffnet hast; eigene Kommentare zählen nicht mit.

## v2.415 — 2026-08

### Verbesserungen
- Das **Kommentarfeld im Feedback** ist jetzt drei Zeilen hoch statt einer und **wächst beim Schreiben mit** — wer Return drückt, hat sofort Platz für die nächste Zeile. Zusätzlich lässt es sich an der Ecke unten rechts größer ziehen; diese Höhe merkt sich die App auf Deinem Rechner.
- Bei „Zu klären" steht jetzt **Dein Name** an Deinen Antworten, nicht mehr Dein Bearbeiter-Kürzel. Zum Mitmachen genügt damit ein Name im Profil — wer kein Kürzel im Fachsystem hat (Projektleitung, Kuration) oder das Sammel-Kürzel „alle" benutzt, konnte bisher nicht antworten.
- Die Fassungsliste der Vorgangs-Regeln lädt schneller: Ältere Fassungen liegen in einem **Archiv daneben** und werden erst geholt, wenn Du die Liste aufklappst. Verloren geht nichts — archivierte Fassungen sind gekennzeichnet und lassen sich weiterhin als Entwurf laden.

## v2.413 — 2026-08

### Neu
- In den Vorgangs-Regeln lässt sich jetzt **messen, was eine Regel am Bestand tut**: auf wie viele Vorgänge ihre Bedingung zutrifft und bei wie vielen sie tatsächlich das To-do bestimmt. Der Unterschied zeigt, welche Regeln von einer früheren verdeckt werden.
- **Probe am Fall**: ein Aktenzeichen eingeben, und es steht da, welche Regel bei genau diesem Vorgang greift, welche Sperren wirken und mit welchen Feldwerten.
- Vor dem Speichern lässt sich **messen, was die Änderung am Bestand bewirkt** — bei wie vielen Vorgängen sich das To-do ändert, von welchem auf welches, mit Beispiel-Aktenzeichen. Gespeichert wird trotzdem erst auf Klick.
- Jede Regel kann eine **Begründung** tragen: woher sie stammt und wer sie beschlossen hat.

### Verbesserungen
- Das Jahres-Menü im Vorgangs-Board spricht jetzt durchgängig von **Jahren** statt von „Jahrgängen": „Letzte 3 Jahre", „Alle Jahre", „2 Jahre".
- Die Arbeitsliste „Entscheidungsreif" heißt jetzt **„Zu entscheiden"**. Der alte Name war zu lang für die Spalten im Kanban und wurde dort abgeschnitten — abgekürzt sah er aus wie der Verfahrensschritt „Entscheidung", und genau die beiden sollte man auseinanderhalten können.
- Die Tabelle unter **„Zu klären" steht deutlich dichter** — eine Zeile ist jetzt halb so hoch, es passt gut doppelt so viel auf einen Blick. Dafür heißt der mittlere Antwortknopf nur noch **„andere"** (statt „gehört nach …", was zweizeilig umbrach und jede Zeile in die Höhe zog); wohin, sagt weiterhin das Auswahlfeld darunter. Die Spalte „Stand" erscheint erst, sobald es etwas zu melden gibt.
- Sperren nennen jetzt **Stränge** statt einzelner Regeln („die Stränge PreCheck und Nachforderung ruhen"). Eine neu angelegte Regel gehört damit automatisch zur richtigen Kette, statt still an der Sperre vorbeizulaufen. Am Bestand geprüft: an den ermittelten To-dos ändert sich dadurch nichts.

## v2.412 — 2026-08

### Neu
- Am Statuswert steht jetzt, **wodurch er entsteht**: welche Kürzel des Fachsystems ihn setzen, wer sie setzen darf und in welchen Richtlinien. Damit lässt sich in der App belegen, wie sich etwa „beantragt", „unvollständig" und „bearbeitungsreif" voneinander abgrenzen.
- Vier neue Grundsatzfragen in „Zu klären" — unter anderem, ob die Zieltage eine Sollzeit sind oder nur beschreiben, wie lange es heute dauert.

### Verbesserungen
- „Status-Katalog" heißt jetzt **Vorgangs-Regeln** und steht direkt neben dem Vorgangs-Board. Vom Board führt „Regeln bearbeiten" hin, von dort „Wirkung im Vorgangs-Board ansehen" zurück.
- Die drei Reiter sagen jetzt, was dort zu tun ist: **Statuswerte**, **Kürzel**, **To-do-Regeln** — jeder mit einem Satz darunter.

### Bugfixes
- Die Antworten auf die Grundsatzfragen in „Zu klären" hängen nicht mehr an der Position der Frage. Vorher hätte eine eingefügte Frage alle Antworten dahinter stillschweigend verschoben; bereits gegebene Antworten bleiben erhalten.

## v2.411 — 2026-08

### Verbesserungen
- In der Reiterleiste der Förderanträge trennt eine feine Linie die beiden Bestandssichten („Antragsphase", „Begleitung") von den Zeitschnitten darauf („Diese Woche", „Überfällig", „Bewilligt 2026").
- Der Haken in den Einstellungen heißt jetzt „Meine ZTP-/PFM-Zuständigkeiten mitzählen" und erklärt, was ohne ihn passiert: Der Reiter „Begleitung" bleibt sichtbar, zeigt bei aktivem Kürzel-Filter aber nur noch Anträge, in denen Sie direkt als Bearbeiter stehen.

### Bugfixes
- Im Kanban auf der Startseite war die Anzahl in der Spalte „Entscheidungsreif" nicht zu sehen — die lange Überschrift hatte sie aus der Spalte geschoben.
- Erklärungs-Tooltips nahe dem rechten Fensterrand wurden zu einer schmalen, sehr hohen Textsäule zusammengedrückt.

## v2.410 — 2026-08

### Neu
- Der **Verfahrensschnitt lässt sich jetzt selbst zuschneiden**. Im Status-Katalog steht dafür ein Baum: links die Verfahrensschritte, darunter die Statuswerte. Einen Statuswert zieht man auf einen anderen Schritt, und er hängt dort. Bisher ging das nur mit einer neuen Programmversion.
- Es dürfen **drei bis neun Schritte** sein, die Beschriftung ist frei. Zu jedem Schritt legt man fest, in welchen Reiter von *Förderanträge* seine Anträge fallen und ob eine Liegezeit-Vorgabe für ihn überhaupt sinnvoll ist.
- Einen Schritt zu entfernen fragt immer, **wohin seine Statuswerte sollen** — sie verschwinden nie, sie ziehen um. Zeigt eine Zuordnung ins Leere, sagt der Katalog das oben ausdrücklich.

### Verbesserungen
- Die **Reiter und Abschnitte in Förderanträge heißen jetzt nach der Frage, die sie beantworten**: „Zu bearbeiten", „In Arbeit", „Wartet auf Antragsteller", „Entscheidungsreif", „Erledigt". Vorher trugen vier davon denselben Namen wie ein Verfahrensschritt, was sich las, als widerspreche sich die App.
- Zusammenfassungen haben eigene Namen bekommen — **Vor Entscheidung** und **Beendet** —, damit ein Reiter nicht so heißt wie eine der Kategorien darin.
- Im Status-Katalog heißen die beiden Spalten jetzt **Arbeitsliste** und **Verfahrensschritt** und sagen darunter, wofür sie jeweils gelten. Neben der Arbeitsliste steht, in welchem Abschnitt der Status dadurch erscheint.

### Bugfixes
- Ein umgehängter Statuswert wirkt sofort überall — in der Verfahrensleiste am Antrag, in der Filter-Gruppierung und in den Zieltagen. Vorher blieben diese drei Stellen auf dem ausgelieferten Stand stehen.
- Der zugeklappte Zustand der Status-Abschnitte in *Förderanträge* stellt sich einmalig auf die Voreinstellung zurück.

## v2.409 — 2026-08

### Verbesserungen
- Den **Status-Katalog** pflegen jetzt mehrere Personen. Damit dabei niemandem Arbeit verlorengeht, sieht die App vor dem Veröffentlichen nach, was inzwischen auf dem Daten-Ordner liegt. Fassungen von Kolleginnen und Kollegen, die dieser Rechner noch nicht kennt, wandern dabei in die Fassungsliste — sie gehen nie verloren.
- Hat jemand anderes zwischenzeitlich veröffentlicht, wird **nichts überschrieben**: eine Meldung nennt Nummer, Kürzel und Zeitpunkt der fremden Fassung, und man entscheidet selbst — die fremde laden oder die eigene trotzdem veröffentlichen. In beiden Fällen bleiben beide Fassungen erhalten und sind wieder ladbar. Zusammengeführt wird nie automatisch.
- Die eigene Arbeit ist zu diesem Zeitpunkt bereits gespeichert; offen ist nur die Veröffentlichung. Steht die Entscheidung noch aus, sagt das ein Hinweis im Seitenkopf.
- Kommt man ins Fenster zurück und es liegt eine neuere Fassung vor, steht auch das im Seitenkopf — mit einem Knopf zum Laden. Umgeschaltet wird nie von allein.

## v2.407 — 2026-08

### Neu
- Neuer Bereich **Zu klären** unter „Werkzeuge": dort stehen Fachfragen, die wir gemeinsam beantworten — jeder wann er Zeit hat, statt alle gleichzeitig in einer Sitzung. Erste Frage ist der **ZAH-Phasenschnitt**: welche Phase zu welchem Status gehört. Pro Zeile wählt man „passt", „gehört nach …" oder „unklar" und kann begründen.
- Uneinigkeit wird ruhig markiert und ist filterbar — sie ist das erwartete Ergebnis einer Abstimmung, kein Fehler. „unklar" zählt getrennt, weil eine Rückfrage etwas anderes ist als ein Widerspruch.
- Neben jeder Zeile steht, **wie viele Vorgänge** dieser Status im Bestand hat. Eine Zuordnung mit 222 Vorgängen wiegt anders als eine mit dreien.
- Am Ende lässt sich das Ergebnis mitnehmen: eine Tabelle für den Termin, eine Kurzfassung fürs Protokoll und eine Liste der Änderungen für die Umsetzung.

### Verbesserungen
- Im **Status-Katalog** ist die ZAH-Phase jetzt sichtbar (nur zum Lesen). Sie wirkte schon länger auf Gruppierung und Fristen-Vorschläge, stand aber nirgends.

## v2.406 — 2026-08

### Verbesserungen
- Unter **Nächste Schritte** stehen keine Testkürzel mehr (TTV1, TTV2, TVB1): sie sind im Fachsystem zum Testen angelegt und kein Arbeitsschritt. Betroffen waren die Richtlinien 78 und 138. Die Fußzeile sagt, wie viele ausgeblendet wurden — verschwiegen wird nichts.
- Das Kürzel **ID** heißt jetzt „Rollenvergabe" statt nur „ID".
- Beim Import der Trigger-Tabelle meldet die Vorschau nur noch **wirklich** unbekannte Kürzel als Warnung. Die vier geklärten stehen als Hinweis daneben — so fällt ein neuer Fall sofort auf.

## v2.405 — 2026-08

### Neu
- Im Status-Katalog unter **To-dos** öffnet ein Klick auf eine Regel jetzt eine **geteilte Ansicht**: links die Liste aller Regeln zum schnellen Springen, rechts die ausgewählte Regel zum Bearbeiten. Die Trennlinie lässt sich ziehen, und wo Sie sie hinlegen, bleibt sie.
### Verbesserungen
- Die Regelkarten sind rund ein Drittel flacher — die ganze Kaskade passt jetzt auf deutlich weniger Bildschirmhöhe, und „Bearbeiten" steht direkt in der Titelzeile.

## v2.404 — 2026-08

### Neu
- Der Reiter „Offen" heißt jetzt **„Antragsphase"** und hat einen neuen Nachbarn **„Begleitung"** — die beiden zusammen zeigen genau, was vorher in „Offen" steckte, jetzt aber mit eigener Fristanzeige je Phase.
### Verbesserungen
- Die Begleitphase ist ab sofort **ohne** eigene Profil-Einstellung sichtbar. Dadurch steigen die Zahlen in „Alle" und auf der Startseite — es sind keine neuen Anträge, sie waren vorher nur ausgeblendet.

## v2.403 — 2026-08

### Neu
- In der AS-Fassung stehen jetzt dieselben Bereiche zur Verfügung wie in der PL-Fassung: Status-Katalog, Vorgangs-Board und Förderfähigkeit in der Sidebar, dazu Nachforderungen samt Artefakt-Leiste und die Antrag-Aufbereitung auf der Verbund-Seite.
### Verbesserungen
- Einziger Unterschied zwischen AS und PL bleibt das Auslastungs-Modul, das in AS bewusst nicht erscheint — auch nicht als Mitarbeiter-Spalte in der Antragsliste oder als Startseiten-Kachel „Neue Anträge für dich".

## v2.402 — 2026-08

### Neu
- Im Vorgangs-Board lassen sich Jahrgänge, Fördervarianten und ZAH-Phasen jetzt **mehrfach** auswählen — etwa 2024 *und* 2025, oder FuE *und* DL.
- Neben jedem Wert steht, **wie viele Anträge er bringt** — und zwar unter den anderen gerade gesetzten Filtern. Man sieht vor dem Klick, ob sich ein Filter lohnt.

### Verbesserungen
- Die drei Filter sehen jetzt aus wie die übrigen Menüs der App, statt ein graues Windows-Menü zu öffnen.
- Die Vorbelegung „Letzte 3 Jahrgänge" zeigt die drei Jahre angekreuzt, statt sie hinter einem Sammelwert zu verstecken; ein Schnellweg stellt sie jederzeit wieder her.
- Der Hinweis zum Altbestand erscheint schon, wenn ein einzelner alter Jahrgang dazukommt — nicht erst bei „alle Jahrgänge".

## v2.401 — 2026-08

### Neu
- Der Status-Filter ist ein Baum mit Häkchen: das Häkchen an einer Phase wählt alle ihre Stati auf einmal und zeigt als Balken an, wenn nur ein Teil gewählt ist. Mit der Maus auf einen Status stehen Gruppe, Anzahl und die weiteren Schreibweisen desselben Status im Tooltip.
- Die Textbausteine in der Skill-Verwaltung stehen jetzt geordnet nach Bereich, Überkategorie und Thema statt in einer langen Liste. Themen lassen sich per F2 umbenennen, Bausteine per Rechtsklick in ein anderes Thema schieben, freigeben oder stilllegen.
### Verbesserungen
- Alle Baum-Ansichten (Status-Filter, Textbausteine, Ordner im Status-Katalog, Meilenstein-Konfiguration) lassen sich jetzt mit der Tastatur bedienen: Pfeiltasten zum Wandern, Pfeil rechts/links zum Auf- und Zuklappen, Pos1/Ende an den Anfang oder ans Ende.
- In der Meilenstein-Konfiguration klappt das Dreieck jetzt die Unter-Meilensteine auf; die Bedingung erscheint unter dem Meilenstein, den Sie angeklickt haben. Umsortiert wird per Ziehen — die Pfeiltasten hoch/runter bleiben daneben bestehen.
### Bugfixes
- Das Fachsystem heißt **C16** — die App nannte es an allen Stellen „Foyer". Betroffen waren unter anderem die Kurzanleitung des Vorgangs-Boards und die Überschrift „Nächste Schritte (in C16 zu setzen)" am Verbund. Das ZIM-Foyer, über das Anträge eingehen, ist ein anderes System und heißt weiterhin so.

## v2.400 — 2026-08

### Neu
- In der Status-Erklärung (das ⓘ neben dem Status) und unter „Nächste Schritte" sind Kürzel und Statuscodes jetzt erklärt: Maus auf `ABB` oder `59`, und die Bedeutung steht da — samt Rolle bzw. ZAH-Phase. Gepunktet unterstrichen ist nur, wofür der Katalog wirklich eine Bezeichnung führt.
### Verbesserungen
<!-- - … -->
### Bugfixes
- Die Sicht-Tabs über der Antragsliste und die Schnellauswahl-Chips im Filter-Panel nannten für dieselbe Sicht verschiedene Zahlen (z. B. 541 gegen 555). Beide zählen jetzt genau das, was die Liste darunter zeigt.

## v2.399 — 2026-08

### Verbesserungen
- Die Sicht-Tabs über der Antragsliste sind kürzer: „NF" ist weg. Dieselbe Auswahl trifft der Status-Filter direkt darunter mit einem Klick — „NF" dort zeigt genau die gleichen Anträge. „Bewilligt 2026" bleibt, weil der Filter alle Jahrgänge zusammen zeigt.
### Bugfixes
<!-- - … -->

## v2.398 — 2026-08

### Neu
- Die Anweisung an die KI lässt sich jetzt **direkt am offenen Antrag** ändern: Der Stift am Abschnittskopf öffnet Prompt, Umfang und die Regeln dieses Abschnitts, ohne dass Sie in die Skill-Verwaltung wechseln müssen.
- Unter der Vorlage steht aufklappbar **„Was daraus wirklich an die KI geht"** — mit Umfang, den angehängten Bausteinen in ihrer Reihenfolge und dem Wortlaut. Sie sehen also, was Ihre Änderung am fertigen Auftrag bewirkt, bevor Sie sie speichern.
- Nach dem Speichern sagt ein Hinweis über dem Abschnitt, welche Fassung jetzt gilt, und bietet **„Abschnitt neu erzeugen"** an. Freigegebene Abschnitte bleiben unangetastet.

### Verbesserungen
- Der Dialog erinnert sichtbar daran, dass solche Änderungen **für alle gelten** — und verweist auf „Persönlicher Stil", wenn nur der eigene Ton gemeint ist.
- Wird beim Bearbeiten der Platzhalter für die Vorhabensbeschreibung gelöscht, warnt die App: Der nächste Lauf würde den Antrag sonst gar nicht mehr sehen und trotzdem einen Text schreiben.

### Bugfixes
- In der Prompt-Ansicht stimmte die Aufteilung „davon Vorhabensbeschreibung / davon Anweisungen" nicht mehr, sobald eine Vorlage die Vorhabensbeschreibung nicht einsetzte.
### Verbesserungen
<!-- - … -->
### Bugfixes
<!-- - … -->

## v2.397 — 2026-08

### Bugfixes
- **Die Anzeige „letzte 3 Richtlinien" zeigte nur zwei.** Gemeint sind die drei jüngsten ZIM-Richtlinien — 2025, 2020 und **2015**; letztere fehlte im Arbeitsvorrat und damit rund 5.100 Anträge (ZIM FuE allein 4.190). Listen, Zähler, Fristen, Board und Auslastung rechnen jetzt mit allen zwölf Programmen ab 2015. Draußen bleibt nur noch die Richtlinie von 2012.

### Verbesserungen
- Die Auswahl hinter dem Anzeige-Chip ist nach Richtlinie gruppiert („Richtlinie 2025 / 2020 / 2015"), statt zwölf Programme in eine Liste zu schütten.
- Wer sich eine **eigene** Programm-Auswahl gesetzt hat, behält sie — sieht aber jetzt im Auswahl-Fenster, wovon sie abweicht, und kommt mit einem Klick zurück zum Standard.
- Wo sich die Zahl der Richtlinien nicht sauber angeben lässt (etwa bei einer Teilauswahl), nennt der Chip nur noch die Zahl der Programme statt eine falsche Richtlinien-Zahl zu behaupten.

### Zu beachten
- Für die Richtlinie 2015 liegen keine Trigger-Angaben vor. Bei diesen Vorhaben steht deshalb „für Programm N keine Trigger importiert", und es entstehen keine To-dos — die Anzeige ist korrekt, ein Nachexport ist mit der AB abzustimmen.

## v2.396 — 2026-08

### Neu
- Im Status-Katalog zeigt der Bereich **Referenzdaten** jetzt an, wie frisch das Änderungs-Journal ist: von wann der zuletzt verarbeitete Export stammt und wie viele Änderungen in diesem Monat erfasst wurden. Ist mehrere Tage lang keiner verarbeitet worden, warnt die Seite — Änderungen aus dieser Zeit lassen sich danach nur noch als Zeitraum festhalten, nicht mehr auf den Tag genau.
### Verbesserungen
- Die Erhebung für den Regelsatz-Termin nennt jetzt **zwei** Zahlen je Situation: wie oft sie heute sichtbar ist und wie viele Vorhaben tatsächlich betroffen wären. Die zweite ist oft ein Vielfaches der ersten — in einem Fall das Zweiundzwanzigfache.
- Die Liste der einseitig offenen Kürzel-Paare ist nach Alter getrennt (bis 400 Tage / darüber). Der ältere Block ist überwiegend Altbestand und kein Rückstand; das war in einer gemeinsamen Zahl nicht zu erkennen.
### Bugfixes
<!-- - … -->

## v2.395 — 2026-08

### Neu
<!-- - Kurzer, verständlicher Satz (nur bei nutzersichtbaren Änderungen) -->
### Verbesserungen
- Der Avatar-Kreis neben Ihrem Namen (Einstellungen → Mein Profil) zeigt jetzt Ihr Bearbeiter-Kürzel — ist kein Kürzel gewählt, erscheinen weiter die Namens-Initialen.
- Die Begrüßung auf der Startseite spricht nur noch mit dem Vornamen an.
### Bugfixes
<!-- - … -->

## v2.392 — 2026-08

### Neu
- Auf der Vorhaben-Seite steht unter „Status & Verlauf" neu der Block **Belegte Änderungen**: was sich seit Einführung des Änderungs-Journals an den Kürzeln getan hat — auch dann, wenn der nächtliche Export die frühere Setzung inzwischen überschrieben hat. Bisher war davon nur der jeweils letzte Stand sichtbar. Über welchem Zeitpunkt die Aufzeichnung beginnt, steht immer dabei.
- Neues Startseiten-Widget **Änderungen der letzten Nacht** (unter Einstellungen → Darstellung & Bedienung einschaltbar): was der jüngste Export gebracht hat, nach Feld gruppiert. Es zeigt bewusst keine Bearbeiter — festgehalten wird, *was* sich geändert hat, nicht *wer* es war.
### Verbesserungen
- Die Angabe „hängt seit n Tagen" im Vorgangs-Board sagt jetzt, wie sicher sie ist: ein vorangestelltes „≥" heißt, dass die Zahl aus den Datumsspalten geschätzt ist. Wo das Änderungs-Journal die letzte Aktivität belegt, steht sie ohne Vorbehalt — manche Vorgänge verschwinden dadurch aus der Stau-Liste, weil dort nachweislich gearbeitet wurde.
### Bugfixes
<!-- - … -->

## v2.391 — 2026-08

### Neu
- Das Vorgangs-Board zeigt die Aufgaben jetzt **je Rolle**. Über die Rollen-Auswahl sehen Sie, was aus Sicht von AB, FB oder QS ansteht. Für Rollen, für die noch keine eigenen Regeln gepflegt sind, leiht sich das Board die Aussage der Regel, die auf sie wartet — solche Einträge sind als „geliehen" gekennzeichnet, damit man sie nicht für ein gepflegtes Ergebnis hält.
- Auf der Vorhaben-Seite steht unter „Status & Verlauf" neu der Block **Offene Aufgaben**: was an welchem Teilvorhaben ansteht, je Rolle, mit „warum?"-Erklärung.
### Verbesserungen
- Im Status-Katalog lassen sich To-do-Regeln jetzt getrennt nach Rolle pflegen. Für eine Rolle ohne eigene Regeln zeigt der Tab, in welchen Situationen die bestehenden Regeln heute auf sie warten — samt Anzahl und Beispiel-Aktenzeichen — und man kann daraus direkt eine Regel anlegen.
### Bugfixes
- Ein Wechsel der Rollen-Auswahl im Vorgangs-Board wirkte sich bisher nicht auf die Berechnung aus; die Ansicht zeigte weiter die alten Werte.

## v2.390 — 2026-08

### Neu
- Der Assistent steht jetzt auch in der AS-Fassung zur Verfügung: das Frage-Antwort-Panel rechts am Bildschirmrand (Strg+Umschalt+K) und das persönliche Gedächtnis unter Einstellungen → Mein Profil. Beides bleibt freiwillig — Sie schalten es selbst ein, und die Daten bleiben auf Ihrem Rechner.
### Verbesserungen
<!-- - … -->
### Bugfixes
<!-- - … -->

## v2.389 — 2026-08

### Neu
- **Anzeigebereich**: Listen, Zähler und Fristen stehen jetzt auf den letzten drei Förder-Richtlinien statt auf dem gesamten Altbestand. Der Chip im Seitenkopf sagt, was gilt und wie viel ausgeblendet ist — ein Klick schaltet auf „alle Richtlinien" oder eine eigene Auswahl. Die Suche findet weiterhin alles; Treffer außerhalb sind gekennzeichnet.
- **Zieltage in einem Schritt**: der Status-Katalog schlägt für alle Statuswerte der Antragsphasen einen Wert aus der Ist-Verteilung vor — mit Vorschau, und ohne zu raten, wo zu wenig Daten vorliegen.

### Verbesserungen
- Die Aufgabenliste endet mit dem Verfahren: nach Schlussvermerk oder Zuwendungsbescheid meldet sie nichts mehr. „In QS" fiel damit von 1 756 auf 75.
- „Kein To-do ermittelt" trennt jetzt zwei Dinge: wirklich keine passende Regel — oder Verfahren abgeschlossen.
- „PC offen" sagt, auf wen gewartet wird: auf die AB (Teilvorhaben-PreCheck) oder auf die FB (Verbund-PreCheck).
- Programm-Nummern stehen überall mit Klartext-Namen daneben.
- Das Vorgangs-Board rechnet rund ein Drittel schneller.

### Bugfixes
- Trigger-Zeilen ohne Statuswechsel („Kürzel nur zulässig, wenn …") wurden als unverständlich abgetan — jetzt werden sie gelesen. Nicht interpretierbar sind nur noch 7 statt 30 Zeilen.
- Im Regel-Editor ließ sich eine Bedingung auf eine Spalte bauen, die es im Katalog nicht gibt — sie traf dann nie zu, ohne dass es jemand sah. Das steht jetzt als Fehler an der Regel.
- Der Verlauf erklärt jetzt, dass je Kürzel nur das zuletzt gesetzte Datum im Export steht.
- Ein Klick aus dem Vorgangs-Board auf einen Antrag ohne Verbund landete auf einer leeren Liste.

## v2.385 — 2026-08

### Verbesserungen
- Die App rechnet sich keinen eigenen Verfahrensstand mehr aus. Bisher leitete sie aus allen gesetzten Datumsfeldern eine Position ab, die dem Status im Fachsystem oft vorauslief — bei 485 von 7.534 Verbünden sagten beide etwas anderes. Angezeigt wird jetzt der Status, wie das Fachsystem ihn führt.
- Im Status-Katalog wird nur noch kuratiert, was wirklich eine Entscheidung ist: ZAH-Phase und Zieltage. Spine-Phase, Rang und das „terminal"-Häkchen waren Stellschrauben der alten Rechnung und sind weg — ebenso die Simulations-Leiste, die deren Wirkung abschätzte.
- Im Kürzel-Verzeichnis steht statt „Rang" die ZAH-Phase des Datums. Sie beantwortet „seit wann gilt dieser Status" und beschriftet die Marke in der Chronik; leer heißt ehrlich „trägt nichts bei".
- Der Regeln-Tab führt nur noch die To-do-Kaskade. Die fünf alten „Nächste-Schritte"-Regeln sind darin aufgegangen — feiner geschnitten und mit zuständiger Rolle.

## v2.384 — 2026-08

### Verbesserungen
- Die Schritt-Leiste am Verbund zeigt jetzt dieselben Phasen wie Filter und Cockpit: Eingang · Vollständigkeit · Prüfung · Entscheidung · Begleitung · Abgeschlossen. Vorher waren es fünf andere Stationen, die die App selbst ausgerechnet hatte.
- Irrläufer und Sonderstatus stehen als Kennzeichen **neben** der Leiste statt auf einer Stufe — sie laufen neben dem Verfahren, nicht darin. Und ein Status, den der Katalog nicht kennt, betont keine Station mehr, statt „Eingang" zu behaupten.
- Der Status-Filter ist nach denselben Phasen gruppiert und zeigt **eine Zeile je Status** statt einer je Schreibweise. „Ablehnung versandt" und „Ablehnung" waren zwei Einträge mit getrennten Zahlen; jetzt ist es einer mit der Summe, und ein Häkchen filtert beide.
- Das Feld „Warum dieser Status?" auf der Verbund-Seite ist entfallen. Es begründete eine Einordnung, die die App selbst vorgenommen hatte; die Frage beantwortet jetzt das Info-Icon am Status aus den amtlichen Daten.

## v2.383 — 2026-08

### Bugfixes
- 16 Vorgänge mit dem Status „Stellungnahme zur Rücknahmeempfehlung" tauchten in keiner Arbeitsliste auf. Grund: die App kannte diesen Status nur in der abgekürzten Schreibweise, der Export schreibt ihn aus. Alle Statuswerte kommen jetzt aus dem amtlichen Statuscode-Katalog, samt der bekannten Schreibweisen.
- Anträge mit Status „unvollständig" (6 Stück) galten als Sonderfall und standen in keiner Liste. Sie sind offene Arbeit in der Vollständigkeitsprüfung und erscheinen jetzt dort — „Irrläufer" bleibt bewusst außen vor.
### Verbesserungen
- „NL eingegangen" zählt jetzt zum Nachforderungs-Zyklus statt allgemein zu „offen" — wie „NF gestellt" und „keine weiteren NF" auch. Der NF-Reiter zeigt dadurch 52 Anträge mehr.
- Hängt die Projektleitung im Status-Katalog einen Code auf eine andere Phase um, folgt die Einordnung des Antrags jetzt automatisch. Vorher blieb sie auf dem Stand, unter dem die Katalog-Fassung angelegt wurde.

## v2.382 — 2026-08

### Verbesserungen
- Das Info-Icon am Status sagt jetzt, welchen Status es erklärt — „Verbund-Status" oder „TV-Status". Weicht die andere Ebene ab, steht sie mit Code und Phase darunter. Bei Verbünden mit nur einem Teilvorhaben war bisher am wenigsten erkennbar, welche Zahl gemeint war.
- Datumsangaben sehen überall gleich aus. In der Feldübersicht standen bisher „2026-07-08" und „08.07.2026" untereinander, im Meilenstein-Streifen daneben „1.9.2025".
### Bugfixes
- Der Stillstands-Wächter zählt geplante Termine nicht mehr als Bearbeitung. Ein Antrag mit einem Termin in der Zukunft galt als „gerade aktiv", auch wenn seit Wochen nichts passiert war; der Termin wird jetzt getrennt als „anstehend am …" genannt.

## v2.381 — 2026-08

### Bugfixes
- Die Parametertabelle aus dem Fachsystem lässt sich jetzt einlesen. Das Blatt „Erklärung Parameter" ist eine Legende ohne Überschriftenzeile — daran scheiterte der Import bisher, obwohl die Datei in Ordnung war.
### Verbesserungen
- Vor der Übernahme steht jetzt da, was in der Datei stand und was davon Statuscodes wurden („4 Statuscodes übernommen · übersprungen: 2 Textbausteine, 3 Bearbeiter, 2 Zuordnungen") — statt dass Zeilen stillschweigend verschwinden.

## v2.380 — 2026-08

### Bugfixes
- **Die Trigger-Tabelle gilt je Richtlinie — bisher galt überall die erste.** Die Zuarbeit führt dieselben Kürzel für neun Richtlinien mit je eigener Wirkung. Der Import hat davon nur eine behalten und sie allen Vorhaben gezeigt. Jetzt entscheidet die FM-Nummer des Vorhabens, welche Trigger gelten.
- Wo für eine Richtlinie keine Trigger eingelesen sind, steht das jetzt da („Für Programm 47 sind keine Trigger importiert") — statt der Wirkung einer fremden Richtlinie.
- Die Satzform der Trigger stimmt in zwei Punkten nicht mehr überein mit vorher: fehlende Argumente am Zeilenende heißen „unverändert" (nicht „der letzte Wert rutscht nach vorn"), und Kürzel-Aufzählungen wie `ABB,AB` werden als drei Bedingungen gelesen statt als ein Kürzel mit Kommas im Namen.

### Verbesserungen
- Das Kürzel-Glossar zeigt an jeder Wirkungszeile die Richtlinie, zu der sie gehört.
- Mail-Trigger nennen die Rolle des Empfängers (`TIB (FB)`) und — sofern die Parametertabelle sie mitliefert — den Klartext des Textbausteins.

### Wichtig
- **Die Trigger-Tabelle muss einmal neu eingelesen werden** (Status-Katalog → Referenzdaten). Der bisherige Stand trägt keine Richtlinien-Angabe und greift deshalb an keinem Vorhaben mehr; die Seite sagt es, wenn es so ist.

## v2.379 — 2026-08

### Neu
- Das Vorgangs-Board hat zwei neue Reiter: **Fristen** und **Auswertung**. „Fristen" listet Ihre Anträge nach Restfrist mit Ampel (rot ab 14, gelb ab 30 Tagen); „Auswertung" zeigt die Verteilung über die ZAH-Phasen, die Liegezeit je Status (Median, p90 und Anzahl) und die Vorgänge unter 30 Tagen Restfrist.
- Die Frist rechnet ab dem **wirksamen Eingang** — dem späteren von Antragseingang und „alle Anträge da". So beginnt auch in den bisherigen Excel-Listen die Uhr. Das Bezugsdatum steht in einer eigenen Spalte.
- Beide Sichten lassen sich **als XLSX exportieren** — genau die Zeilen, die Sie gerade sehen.

### Bugfixes
- Die Fristenliste führte abgeschlossene und bewilligte Vorgänge mit „853 Tage über" an. Eine Antragsfrist läuft nur in der Antragsphase; danach gilt die Verwendungsnachweis-Logik. Wie viele Vorgänge deshalb nicht in der Liste stehen, sagt sie jetzt ausdrücklich.

## v2.378 — 2026-08

### Neu
- **Stillstands-Wächter**: Er misst, wie lange an einem Vorgang nichts mehr passiert ist, und vergleicht das mit den **Zieltagen** des jeweiligen Status. Wo ein Kürzel-Paar halb offen ist (etwa Gutachten fachlich fertig, kaufmännisch offen), sagt er auch, auf wessen Schreibtisch es liegt.
- Neues Home-Widget **„Hängt fest"** (unter Einstellungen → Darstellung & Bedienung einschaltbar): Ihre Vorgänge nach Liegezeit, der längste zuerst.
- Im Katalog gibt es je Status eine Spalte **Zieltage**. Daneben steht ein Vorschlag aus der tatsächlichen Verteilung (⌀-Knopf, mit Stichprobengröße im Tooltip) — übernommen wird er einzeln, nie im Block.
- Das Vorgangs-Board hat einen Filter **„hängt fest"** und zeigt im Kopf den Stau je Rolle.

### Verbesserungen
- Ohne gepflegte Zieltage sagt der Wächter **„nicht bewertbar"** statt „in Ordnung" — und zählt diese Fälle sichtbar mit. Eine Ampel ohne Grundlage wäre schlimmer als keine.

## v2.377 — 2026-08

### Neu
- Neue Seite **Vorgangs-Board**: sie sagt je Antrag, was als Nächstes zu tun ist — in drei Sichten: *Meine Aufgaben*, *Wartet auf andere* und *Kein To-do ermittelt*. Ein Klick auf „warum?" zeigt die Regel und die Feldwerte, aus denen sich die Aufgabe ergibt.
- Die Aufgaben kommen aus einer **Regel-Kaskade**, die im Status-Katalog unter „Regeln" steht — dieselbe Rechnung wie in den bisherigen Excel-Dashboards, nur für alle sichtbar und versioniert. Jede Regel ist dort als deutscher Satz lesbar und lässt sich in der Reihenfolge verschieben; die Reihenfolge entscheidet, denn die erste zutreffende Regel gewinnt.
- Das Board startet mit den **letzten drei Jahrgängen**. Ältere Vorgänge führen viele Spalten gar nicht; dort meldeten die Regeln Aufgaben, die keine sind. Über „Alle Jahre" bleiben sie erreichbar — mit Hinweis.

## v2.376 — 2026-08

### Neu
- Der Verbund zeigt unter „Status & Verlauf" jetzt **„Nächste Schritte (in C16 zu setzen)"**: welche Kürzel unter dem aktuellen Status überhaupt greifen würden, was sie auslösen und wer sie setzt. Vorgefiltert auf Ihre Rolle, umschaltbar auf alle. Die App setzt nichts selbst — sie sagt, was in C16 zu tun wäre.
- Der Tab „Felder" im Status-Katalog heißt jetzt **„Kürzel"** und ist ein Glossar: neben dem Code steht ein Blitz mit der Anzahl der Trigger; ein Klick zeigt in einem Satz, was das Setzen auslöst.
- **Relevanz-Häkchen** je Kürzel grenzen die 505 Einträge auf die für die Antragsbearbeitung wichtigen ein. Eine Aktion übernimmt die 31 Spalten des AB-Dashboards als Startvorschlag; sie setzt nur Häkchen und nimmt nie welche weg.

### Verbesserungen
- Neue Filter im Kürzel-Tab: „nur relevante" und „nur mit CSV-Spalte".

### Bugfixes
- Vier Kürzel (u. a. Antragseingang und Bewilligung) wurden doppelt geführt und galten dadurch überall als nie gesetzt. Das Nachziehen im Status-Katalog räumt das auf und sagt vorher, was es entfernt.

## v2.375 — 2026-08

### Neu
- Neben jedem Status steht jetzt ein kleines Info-Zeichen. Ein Klick darauf erklärt, worauf der Status beruht: der amtliche Code, seit wann er gilt, welches Kürzel zuletzt gesetzt wurde (mit Bezeichnung und Rolle) und was davor passiert ist.
- Die Erklärung lässt sich mit einem Klick als Text kopieren — praktisch für Rückfragen und Support-Fälle.
- Angezeigt wird immer auch der Datenstand: wann zuletzt importiert wurde und mit welcher Katalog-Fassung gerechnet wird.

### Verbesserungen
- Der Verlauf ist ausdrücklich als Näherung gekennzeichnet: Das Fachsystem führt je Kürzel nur ein Datum, mehrfach gesetzte Kürzel lassen sich darin nicht unterscheiden. Fehlt eine Angabe, bleibt sie leer, statt geschätzt zu werden.

## v2.374 — 2026-08

### Neu
- Der Status-Katalog kennt jetzt die amtlichen Statuscodes (11 Skizze bis 99 Schlussvermerk) und ordnet ihnen die Verfahrensphase zu. Grundlage für die kommenden Erklär- und Erinnerungs-Funktionen.
- Zwei Zuarbeiten aus dem Fachsystem lassen sich als Excel-Datei einlesen: der Statuscode-Katalog und die Trigger-Tabelle. Vor jeder Übernahme zeigt eine Vorschau, was sich ändert.
- Die Trigger-Tabelle wird in lesbare Sätze übersetzt — statt `<59|ABB|YIRR||||31|31` steht dort, welche Bedingungen gelten und welcher Status gesetzt wird.

### Verbesserungen
- Statuswerte werden auch dann erkannt, wenn sie leicht anders geschrieben sind (etwa „Stellungnahme zur Rücknahmeempf." mit oder ohne Punkt). Unbekannte Werte werden als solche benannt, statt still einsortiert zu werden.
### Verbesserungen
<!-- - … -->
### Bugfixes
<!-- - … -->

## v2.373 — 2026-08

### Neu
- **„Zweitfassung mit anderer Einstellung".** Arbeiten Sie mit einer direkt angebundenen KI, gab es bisher keine Zweitfassung — es gibt dort ja nur ein Modell. Jetzt schreibt dasselbe Modell die zweite Fassung mit einer anderen Einstellung. Beide stehen anschließend unter „Vorfassungen" nebeneinander, jede mit dem Vermerk, wie sie entstanden ist.

### Verbesserungen
- **Die App gibt der KI jetzt eine feste Einstellung vor.** Bisher überließ sie das dem Server; welche Einstellung galt, war nirgends zu sehen. Der Wert steht jetzt unten in der Prompt-Ansicht neben dem Ausgabe-Budget.
- **Die Einstellung ist jetzt gemessen statt geraten.** Ein Vergleich über 25 fiktive Vorhabensbeschreibungen hat gezeigt, dass sie auf die Einhaltung der Vorgaben keinen erkennbaren Einfluss hat. Die App behält deshalb die bisher gewohnte Einstellung bei, statt sie auf Verdacht zu verändern — an den Texten ändert sich nichts.

## v2.372 — 2026-08

### Neu
- **„Prompt ansehen" in der Gutachten-Werkstatt.** Sie können jetzt nachlesen, was tatsächlich an die KI geht — vor dem Erzeugen als Vorschau und danach als das wirklich Gesendete. Oben stehen die Maße (Zeichen gesamt, davon Vorhabensbeschreibung, Platz im Fenster der KI), darunter die Liste der enthaltenen Bausteine, darunter der Wortlaut. Erreichbar neben „… generieren" und im ⋯-Menü der Abschnittskarte.
- **„Zweitfassung mit der anderen KI".** Derselbe Abschnitt lässt sich ein zweites Mal von der jeweils anderen internen KI schreiben. Beide Fassungen stehen anschließend unter „Vorfassungen" nebeneinander, mit hervorgehobenen Unterschieden und jeweils der KI, die sie verfasst hat — eine davon übernehmen Sie.

### Verbesserungen
- **Sie erfahren vor dem Lauf, wenn der Antrag nicht ins Kontextfenster passt.** Bisher stand erst am fertigen Abschnitt „auf gekürzter Basis entstanden". Jetzt steht die Warnung über der Karte, nennt die fehlenden Zeichen und schlägt vor, auf die andere KI zu wechseln — deren Fenster ist rund viermal so groß.
- Der Skill-Editor weist jetzt darauf hin, wenn sich Umfangs-Vorgaben gegenseitig ausschließen (etwa Satzzahl mal Satzlänge gegen das Zeichenlimit) oder wenn eine Zahl doppelt gepflegt ist.
- **Die Startseite nennt das Alter beim Namen.** Statt „493 über der 90-Tage-Frist" und „292 nähern sich" steht dort jetzt „493 älter als 90 Tage" und „292 zwischen 31 und 90 Tagen" — gemeint war nie ein versäumter Termin, sondern wie lange ein Antrag schon im Haus ist. Haben Sie die Tage-Grenzen im Widget „Antragseingang" verstellt, nennt der Text jetzt Ihre Werte statt fest 90.
- Das Startseiten-Widget heißt **„KI-Assistent"** statt „AI-Assistent" — direkt darunter stand schon immer „KI-Variante".
- Altersangaben sind ausgeschrieben: „vor 373 Tagen" statt „vor 373 T".
- **Die Startseite sagt jede Zahl nur noch einmal.** „493 älter als 90 Tage" stand bisher gleichzeitig in der Begrüßungszeile, auf der Kachel darunter und im Widget rechts. Die Begrüßungszeile nennt jetzt nur die Gesamtzahl der offenen Vorgänge; die Aufteilung steht dort, wo Sie sie auch anklicken können.
- **Klarer, was 638 und 930 bedeuten:** aus „638 Anträge · 930 TVS" wurde „638 Einträge · 930 Teilvorhaben" — Verbünde stehen als ein Eintrag, die zweite Zahl nennt die enthaltenen Teilvorhaben.
- Der Knopf „Zu meinen Anträgen →" ist entfallen; er führte an dieselbe Stelle wie „Alle →" oben in derselben Karte.
- **Die Startseite ist wieder gefüllt:** „Meine Anträge" zeigt anfangs 10 statt 5 Zeilen, und die rechte Spalte ist breiter — dort wurde bisher sogar die Überschrift „Antragseingang" abgeschnitten. Beides lässt sich weiterhin selbst einstellen bzw. ziehen.
- Im Rückstands-Balken zeigt auch das schmalste Segment seine Zahl, und beim Darüberfahren steht jetzt das Kalenderquartal dabei („Q-1 · Q2/2026") statt nur „Q-1".
- Auf der Förderanträge-Seite heißt die Filterzeile jetzt **„Status in dieser Sicht"** — ihre Zahlen beziehen sich auf den oben gewählten Reiter, was vorher wie ein Widerspruch aussah („Offen 909" oben, „Offen 852" darunter).
- **Die Sortierung sagt, wonach sie sortiert.** Aus „Neueste zuerst" wurde „Eingang (neueste)", aus „Älteste zuerst" „Eingang (älteste)" — in einer Liste, die auch nach Frist und nach Bewilligungsdatum sortieren kann, war „neueste" allein nicht eindeutig. Beim Darüberfahren steht die Langfassung.
- Der Knopf **„Hilfe"** nennt jetzt auch die Einführungs-Tour, solange Sie sie noch nicht gemacht haben — bisher pulsierte dort nur ein Punkt, der sich nicht erklärte.
- Auf der Startseite sagt der Knopf unter „Meine Anträge", wie viel er **nicht** zeigt: „+10 anzeigen (628 weitere)". Für die vollständige Liste führt „Alle →" oben in derselben Karte in einem Schritt dorthin.

### Bugfixes
- **Die Sortier-Anzeige nannte in der Sicht „Bewilligt" die falsche Sortierung.** Dort stand „Neueste zuerst", sortiert wurde aber nach Bewilligungsdatum — und diese Sortierung ließ sich nicht auswählen, war also nach einem Wechsel nicht mehr erreichbar. Beides ist behoben; die Auswahl bietet jetzt in jeder Sicht genau die Sortierungen an, die dort gelten.
- Der Punkt **„Sync"** unten links behauptete „Anträge sind aktuell", während der Punkt „CSV" direkt daneben neue, noch nicht eingelesene Exporte meldete. „Sync" spricht jetzt nur noch über das, was er kennt — die Erreichbarkeit des Datenordners — und verweist für den Datenstand auf „CSV".
- **Die Kurzfassung hielt sich schlechter an die Vorgaben, als sie musste.** Der Auftrag an die KI enthielt eine unsichtbare Formatvorgabe, die der Reihenfolge im Prompt-Text widersprach und deren Ergebnis anschließend ohnehin verworfen wurde. Sie ist entfernt. Außerdem sagt der Auftrag jetzt, welche Vorgabe gilt, wenn Zeichenlimit und Satzzahl nicht gleichzeitig erfüllbar sind.
- **Es wird keine KI mehr genannt, die gar nicht im Spiel war.** Arbeiten Sie mit einer direkt angebundenen KI statt über die Browser-Verbindung, gibt es weder eine „Standard-" noch eine „agentische" KI. Die Kontext-Warnung spricht dort jetzt vom „Fenster des Modells", und unter dem Abschnitt steht keine falsche Herkunft mehr.

## v2.371 — 2026-08

### Verbesserungen
- Auf der Startseite verschwinden die Kacheln unter „Braucht heute Aufmerksamkeit", wenn es dort nichts zu tun gibt — eine 0 unter dieser Überschrift war eher verwirrend als beruhigend. Die Kachel „QS-Freigaben offen" führt jetzt direkt in den ersten offenen Entwurf statt in die vollständige Antragsliste.
- In der Seitenleiste standen zweimal „E-Mail Anfragen" mit demselben Symbol, aber verschiedenen Zielen. Der Eintrag unter „Kuration" heißt jetzt **„E-Mail Anfragen: Einstellungen"**.

### Bugfixes
- **Die Seitenleiste bleibt nicht mehr dauerhaft auf Symbole zusammengeklappt.** Wer das Fenster einmal schmal gezogen hatte (angedockt, kleiner Bildschirm, Citrix), bekam die beschriftete Leiste danach auch auf einem großen Bildschirm nicht mehr zurück — ohne erkennbaren Grund. Schmale Fenster klappen die Leiste weiterhin ein, merken sich das aber nicht mehr: sobald wieder Platz ist, steht Ihre eigene Einstellung da.
- **Dunkles Erscheinungsbild bleibt jetzt auf jedem Weg erhalten.** Über Strg+Umschalt+D oder die Befehlssuche umgeschaltet, war es nach dem nächsten Start wieder hell — nur der Weg über Einstellungen → Darstellung wurde gespeichert.

## v2.370 — 2026-07

### Neu
- Neuer Knopf **„Bearbeiten mit KI"** an jedem Gutachten-Abschnitt: Sie schreiben in eigenen Worten, was geändert werden soll — etwa „technische Risiken auf die des Lösungswegs beschränken, die anderen entfernen" oder „Details des Lösungsweges vertiefen" — und die KI überarbeitet den vorhandenen Text entsprechend.
- Das Eingabefeld erscheint direkt in der Abschnitts-Karte, der Text bleibt dabei sichtbar. Ihre letzten fünf Anweisungen stehen als Vorschläge zum Anklicken bereit; sie bleiben nur auf Ihrem Rechner.
- Jede so überarbeitete Fassung landet wie gewohnt in den Vorfassungen — dort steht Ihre Anweisung als Beschriftung, sodass nachvollziehbar bleibt, welche Fassung woraus entstand.

## v2.369 — 2026-07

### Verbesserungen
- Im Hilfe-Fenster stehen „Einführungs-Tour" und „Über die App" jetzt oben neben dem Titel statt ganz unten — dort waren sie hinter dem Text kaum zu finden.
- Die Hilfetexte aller Seiten sind neu gesetzt: Abschnitte mit echten Überschriften statt einer Textwand, die Bedienelemente als Aufzählung nach Bereichen und „Typische Aktionen" als Liste.
- Aus den Hilfetexten sind technische Reste verschwunden (interne Namen, Adressen, Datenbank-Schlüssel), die nur Entwickler etwas angehen.

## v2.368 — 2026-07

### Verbesserungen
- In „Über die App" lässt sich die Trennlinie zwischen den beiden Spalten jetzt mit der Maus verschieben. Die Aufteilung startet halbe/halbe, wird auf diesem Rechner gemerkt, und ein Doppelklick auf die Trennlinie stellt sie wieder her.
- Der Knopf „Alle aufklappen" ist entfallen — bei fast 700 Einträgen hat er die Liste eher unbrauchbar gemacht.

## v2.367 — 2026-07

### Verbesserungen
- Im Gutachten liegen „Text kopieren" und „Persönlicher Stil" jetzt direkt in der Knopfleiste unter dem Abschnitt statt im ⋯-Menü. Kopieren ist das Icon neben „Bearbeiten".
- „Persönlicher Stil" lässt sich schon vor der ersten Generierung setzen — der Knopf steht neben „… generieren". Ist ein Stil aktiv, hebt sich der Knopf sichtbar ab.

## v2.366 — 2026-07

### Verbesserungen
- „Über die App" öffnet jetzt breit und fast bildschirmhoch, mit zwei Spalten: links der Überblick über die App, rechts die Änderungen und Updates. Beides ist sofort zu sehen, ohne zu scrollen.
- Die Einleitung sagt kürzer, worum es geht: Die ZAH-App (ZIM-Arbeitshilfe) unterstützt bei der Textarbeit zu Förderanträgen und beim Controlling der eigenen Anträge.

## v2.365 — 2026-07

### Bugfixes
- **Der Umschalter auf die Standard-KI wirkt jetzt.** Wer bei „Interne KI" von „Agentisch" zurück auf „Standard" stellte, bekam zwar sofort die passenden Hinweise zum Kontextfenster — die Anfrage ging aber weiter an die agentische KI. Grund: Die App hat den Tab-Wechsel in der KI-Oberfläche nur in eine Richtung angestossen, zurück nie. Ab sofort springt die KI-Oberfläche sichtbar auf den passenden Tab, in beide Richtungen. Das Lesezeichen muss dafür **nicht** neu installiert werden.
- **Der Notfall-Wechsel auf die Standard-KI wechselt wirklich.** Wenn die agentische KI nicht antwortet, übernimmt automatisch die Standard-KI. Dieser zweite Versuch lief bisher versehentlich in derselben KI weiter, die gerade ausgefallen war.

### Verbesserungen
- **Am Gutachten-Abschnitt steht, welche KI ihn geschrieben hat.** In der Fusszeile unter dem Text erscheint jetzt „Standard-KI" bzw. „Agentische KI" — bei älteren Abschnitten bleibt die Angabe leer, weil sie dort nicht mitgeschrieben wurde.

## v2.364 — 2026-07

### Neu
- **Eigenes Feedback ergänzen statt neu melden.** Beim eigenen Ticket steht neben dem Titel „Ergänzen": damit lassen sich Überschrift und Antworten nachträglich überarbeiten und weitere Screenshots oder Dateien anhängen. Gedacht für ein Ticket je Thema, das man fortschreibt — statt für jede Präzisierung ein neues aufzumachen. Wann es zuletzt bearbeitet wurde, steht unter dem Namen.
- **Statuswechsel erscheinen auf der Startseite.** Das Widget „Feedback-Neuigkeiten" meldete bisher nur, wenn das Team etwas geantwortet hat. Jetzt sieht man auch, wenn ein Feedback von „Neu" auf „In Bearbeitung" oder „Umgesetzt" springt — nicht nur beim eigenen, sondern bei jedem Ticket, an dem man beteiligt ist (abgestimmt, kommentiert oder gesponsert). Ein Klick öffnet das Ticket direkt.

### Verbesserungen
- **Feedback wird jetzt an einer Stelle bearbeitet.** Der separate Menüpunkt „Kuration → Feedback" ist entfallen. Alles passiert direkt im Feedback-Board: am geöffneten Ticket ein ausklappbarer Abschnitt „Verwaltung" (Status, Kategorie, Priorität, Aufwand, Notizen, öffentliche Antwort, FAQ, Löschen), im Seitenkopf ein Zahnrad für Inbox, FAQ, Sponsoring und Einstellungen. Wer noch ein Lesezeichen auf die alte Seite hat, landet automatisch auf dem Board.
- **Die Projektleitung kann Feedback bearbeiten.** Bisher war das an das Kurator-Profil gebunden und in der PL-Fassung gar nicht vorhanden. Zusätzlich lassen sich archivierte Tickets bei Bedarf einblenden.

## v2.363 — 2026-07

### Neu
- Förderkennzeichen kopieren: In der Tabelle der Förderanträge erscheint beim Überfahren einer Zeile neben dem FKZ ein kleines Kopier-Symbol. Ein Klick legt das FKZ in die Zwischenablage, ohne den Antrag zu öffnen — bei einer Verbund-Zeile ist es das Verbund-FKZ.

## v2.362 — 2026-07

### Bugfixes
- Beim Ablegen eines PDF (etwa einer Vorhabensbeschreibung im Gutachten) erschien auf manchen Rechnern die rote Meldung „Orama not initialized", und die Datei wurde nicht übernommen — obwohl sie längst gespeichert war. Der Suchindex, den die App dafür braucht, wird jetzt beim ersten Ablegen selbst angelegt. Sollte die Aufnahme in den Suchindex einmal nicht klappen, ist das nur noch ein grauer Hinweis: die Datei ist trotzdem da und lässt sich weiterverwenden.

### Verbesserungen
- **Die Seitenleiste ist jetzt gegliedert.** Ganz oben und ohne Überschrift steht der tägliche Weg: Home, Förderanträge, Auslastung. Darunter **Werkzeuge** (Suche, Skill-Verwaltung, Feedback) — stabil, aber seltener gebraucht.
- Darunter **In Erprobung**: Fristen & Meilensteine, E-Mail Anfragen, Förderfähigkeit und Status-Katalog. Diese vier sind noch nicht ausgereift — genau deshalb sind Rückmeldungen dazu besonders wertvoll.
- Die Gruppe „In Erprobung" lässt sich **zuklappen**, wenn Sie damit nicht arbeiten; Ihre Wahl bleibt bis zum nächsten Mal erhalten. Die Seite, auf der Sie gerade stehen, bleibt auch zugeklappt sichtbar.
- Die Befehlssuche (**Strg+K**) zeigt dieselbe Gliederung.

## v2.361 — 2026-07

### Neu
- Das Feedback-Board lässt sich jetzt anpassen: Über den Regler-Knopf rechts oben wählen Sie, welche Spalten Sie sehen wollen — und ob eine Spalte ihre Karten ein- oder zweispaltig zeigt. Gerade „Neu" wird damit deutlich kürzer, statt endlos zu scrollen. Auf Wunsch werden die Spaltenköpfe einfarbig statt bunt. Die Einstellung gilt nur auf Ihrem Gerät.

### Verbesserungen
- Das Anpassen-Fenster der Startseiten-Widgets ist aufgeräumt: eine Zeile je Spalte mit Häkchen links und dem Schalter für ein oder zwei Kartenspalten rechts. Vorher versteckte sich die Spaltenzahl als kleiner Zusatz im Auswahl-Knopf und musste unten erklärt werden.

## v2.360 — 2026-07

### Neu
- **„Über die App"** — ein Klick auf die Versionsnummer unten in der Seitenleiste (oder auf den Verweis im Hilfe-Fenster) zeigt jetzt drei Dinge: einen kurzen Überblick, wofür die App da ist und wie die Bereiche zusammenhängen; welche Fassung Sie gerade benutzen; und darunter wie bisher die Liste der Änderungen.
- Die **Einführungs-Tour** starten Sie jetzt im Hilfe-Fenster — von jeder Seite aus, nicht mehr nur auf der Startseite. Haben Sie sie noch nie gemacht, pulsiert auf der Startseite ein kleiner Punkt am Hilfe-Knopf.

### Verbesserungen
- Die **Seitenleiste ist unten aufgeräumt**: „Skill-Verwaltung" steht wieder oben als letzter Menüpunkt, die **Einstellungen** sind als Zahnrad in die untere Zeile neben die Versionsnummer gerückt. Damit fallen eine Trennlinie und der große Leerraum darüber weg.
- Die Einstellungen bleiben wie gewohnt über **Strg+Umschalt+E** und über die Befehlssuche (**Strg+K**) erreichbar.

### Bugfixes
- In der **Befehlssuche (Strg+K)** ließ sich ein Eintrag nur mit der Tastatur auswählen — ein Mausklick schloss das Fenster, ohne etwas zu tun. Klicken funktioniert jetzt.

## v2.359 — 2026-07

### Neu
- Im Hilfe-Fenster gibt es jetzt **„Text stimmt nicht"**: ein Klick öffnet die Rückmeldung mit passendem Typ und fertiger Überschrift. Beschreiben Sie nur noch, was nicht stimmt — den Rest füllt die App aus.

### Verbesserungen
- Der Knopf „Zeig es mir" in der Fußzeile ist verschwunden. Er hat auf jeder Seite geführte Touren angekündigt, die es noch nicht gibt. Solange die Seiten aktiv weiterentwickelt werden, wären solche Touren schneller veraltet als geschrieben — wir holen sie nach, wenn sich die Oberfläche beruhigt hat. Ein Hinweis dazu steht unten im Hilfe-Fenster.
- Auf der Startseite bleibt **„Neu hier?"** mit der Einführungs-Tour unverändert erhalten.

## v2.358 — 2026-07

### Neu
- „Fristen & Meilensteine" zeigt beim Öffnen nur noch die Anträge der letzten drei Jahrgänge — auch in der Arbeitsliste „Diese Woche". Die Altfälle aus 2013/2014, deren Status im Fachsystem nie sauber gesetzt wurden, verstopfen die Liste damit nicht mehr.
- Neue Schaltfläche „Letzte 3 Jahre" führt jederzeit zur Vorbelegung zurück, wenn Sie zwischendurch ein einzelnes Jahr angesehen haben.

### Verbesserungen
- „Alle Eingänge" zeigt weiterhin restlos alles — es ist nichts verschwunden, nur aus dem Weg geräumt.
- Die Zahlen an den Reitern folgen jetzt überall demselben Zeitraum, auch bei „Diese Woche".
- Ein zuvor gewählter Zeitraum wird einmalig zurückgesetzt, damit die neue Vorbelegung auch bei Ihnen ankommt; Reiter und übrige Filter bleiben erhalten.

## v2.357 — 2026-07

### Neu
- **Jede Seite hat jetzt einen Hilfe-Knopf** oben rechts. Er erklärt in Kurzform, wozu die Seite da ist, was die Bereiche zeigen und was die Fachbegriffe bedeuten — zum Nachlesen, ohne jemanden fragen zu müssen.
- Das Fenster ist groß genug, um die Erklärung auf einen Blick zu lesen, ohne zu scrollen.

### Verbesserungen
- Passt ein Hilfe-Text nicht zu dem, was Sie auf dem Bildschirm sehen, melden Sie es bitte über den Feedback-Knopf — der Hinweis steht auch unten im Hilfe-Fenster.

## v2.356 — 2026-07

### Neu
- „Diese Woche" fasst die Meilensteine eines Vorhabens jetzt zu einer Zeile zusammen, statt jeden einzeln aufzulisten — ein Klick klappt die Einzeltermine auf.
- Die zusammengefasste Zeile sagt, wo es hängt: „hängt seit 1.2 Antrag zugewiesen · Soll 23.9.2013", dazu die Zahl der offenen Meilensteine.

### Verbesserungen
- Über den Schalter „nach Verbund" lässt sich wieder auf die frühere Einzelliste umstellen — etwa wenn Sie sehen wollen, wer überall denselben Meilenstein offen hat. Die Wahl bleibt bis zum nächsten Öffnen erhalten.
- „Überfällig" und „Diese Woche fällig" bleiben getrennte Abschnitte; aufgeklappt wird jeweils nur dort, wo Sie klicken.

## v2.355 — 2026-07

### Neu
- **„Fristen & Meilensteine" hat jetzt einen Hilfe-Knopf** oben rechts: Er erklärt in Kurzform, wozu die Seite da ist, was die einzelnen Reiter zeigen und was hinter Begriffen wie „Soll-Woche" oder „freigegebene Fassung" steckt — zum Nachlesen, ohne jemanden fragen zu müssen.
- Vorerst ein Muster auf dieser einen Seite. Passt der Text nicht zu dem, was Sie auf dem Bildschirm sehen, melden Sie es bitte über den Feedback-Knopf — dann ziehen wir ihn nach und statten die übrigen Seiten aus.

## v2.354 — 2026-07

### Verbesserungen
- Das Feedback öffnet jetzt direkt in der **Board-Ansicht**: Alle Rückmeldungen stehen nach Bearbeitungsstand in Spalten (Neu · Abgelehnt · Geplant · In Bearbeitung · Umgesetzt), der Fortschritt ist ohne Klick sichtbar.
- Die Listen-Ansicht bleibt einen Klick entfernt — und wenn Sie sie wählen, merkt sich die App das wie bisher für das nächste Öffnen.

## v2.353 — 2026-07

### Verbesserungen
- „Fristen & Meilensteine" merkt sich Ihre Ansicht: Beim nächsten Öffnen sind der zuletzt benutzte Reiter, der Eingangs-Zeitraum und die gesetzten Filter wieder da. Nur das Suchfeld startet absichtlich leer.
- Die Seite öffnet jetzt mit **„Diese Woche"** — der Arbeitsliste. Wenn Ihr Kürzel hinterlegt ist, ist „nur meine" von Anfang an aktiv; ein Klick zeigt wieder alle.
- „Diese Woche" ist bewusst nicht mehr an den Eingangs-Zeitraum gebunden: Ein überfälliger Meilenstein bleibt sichtbar, auch wenn der Antrag aus einem früheren Jahr stammt.
- Der Eingangs-Zeitraum startet mit dem **laufenden Jahr** (vorher laufendes Jahr + Vorjahr) — der passende Jahres-Knopf ist damit sichtbar markiert. In der Übersicht räumt „Zurücksetzen" gesetzte Filter in einem Klick weg.

## v2.352 — 2026-07

### Verbesserungen
- „Auslastung" zeigt beim Öffnen nur noch **eine** Ladeanzeige: eine schmale Leiste unter der Überschrift mit dem Hinweis, was gerade geladen wird. Die Seite ist so lange abgedimmt — sichtbar „gleich fertig" statt halb bedienbar.
- Die Auslastungsdaten werden im Hintergrund vorgeladen, sobald die Datenaktualisierung beim Start durch ist. In den meisten Fällen ist beim ersten Klick nichts mehr abzuwarten.

### Bugfixes
- Beim ersten Öffnen von „Auslastung" erschien die gelbe Warnung „Vollständigkeits-Prüfung inaktiv", obwohl am Spalten-Mapping nichts falsch war — sie kam nur, weil die Daten noch luden. Die Warnung erscheint jetzt erst, wenn alles geladen ist, und meldet dann echte Mapping-Probleme wie bisher.

## v2.351 — 2026-07

### Neu
- „Status & Verlauf" zeigt den Vorgang jetzt als **Chronik**: alle Termine untereinander in Zeitfolge, nach Monat gruppiert, mit Begleittext. Der bisherige Zeitstrahl bleibt als zweite Ansicht erhalten.

### Verbesserungen
- Der Ordnerbaum im Status-Katalog verhält sich wie im Datei-Explorer: Ordner auf- und zuklappen, zum Umhängen ziehen, zum Umbenennen auf den Namen klicken.
- „Warum dieser Status?" ist kürzer: gleiche Angaben mehrerer Teilvorhaben stehen einmal mit Anzahl, und alles ohne Einfluss auf die Phase liegt hinter einem Klick.

## v2.350 — 2026-07

### Neu
- In „Fristen & Meilensteine" lässt sich der Eingangs-Zeitraum jetzt taggenau setzen — etwa 01.04. bis 30.06. für ein Quartal, statt nur ganze Jahre.

### Verbesserungen
- Die Jahres-Schaltflächen bleiben als Schnellwahl: ein Klick setzt das ganze Kalenderjahr, die Datumsfelder zeigen es dann als 01.01. bis 31.12.
- Ein leer gelassenes Datumsfeld bedeutet „so weit die Daten reichen"; weiter als der älteste bzw. jüngste Antrag lässt sich ohnehin nichts wählen.

## v2.349 — 2026-07

### Neu
- „Fristen & Meilensteine" lässt sich nach Jahrgang eingrenzen: Schnellwahl für die drei jüngsten Jahre, dazu eine Von-Bis-Auswahl für alles Ältere.
- Beim Öffnen sind das laufende Jahr und das Vorjahr eingestellt — die Seite startet damit im aktuellen Bestand statt in dreizehn Jahren Archiv.

### Verbesserungen
- Die Auswahl gilt für die ganze Seite: Übersicht, „Diese Woche" und Auswertung zeigen denselben Ausschnitt, auch in den Zählern an den Reitern.
- Damit bezieht sich die durchschnittliche Bearbeitungsdauer künftig auf die gewählten Jahrgänge. „Alle Jahre" zeigt wieder den Gesamtwert.
- Verbünde ohne Antragsdatum lassen sich keinem Jahrgang zuordnen; wie viele gerade ausgeblendet sind, steht neben der Auswahl.

## v2.348 — 2026-07

### Neu
- Der Statuskatalog kennt jetzt alle Kürzel des Fachsystems mit ihrer offiziellen Bezeichnung — statt der rund 180, die aus den Ordnerbäumen abgelesen waren.
- Zu jedem Eintrag steht, wer ihn setzt: AB, FB, QS, PA oder Juristen. Unter „Meine Rolle" im Profil wählen Sie Ihre eigene, und die Statusliste am Antrag startet darauf gefiltert.

### Verbesserungen
- Einträge, die jeder setzen darf, bleiben bei jeder Rollenwahl sichtbar — Sie verpassen nichts, wenn Sie filtern.
- Kürzel, deren Ordner nicht bekannt ist, stehen sichtbar unter „Nicht zugeordnet", statt zu fehlen.
- Weicht eine Bezeichnung von der Liste des Fachsystems ab, bietet der Statuskatalog die Korrektur mit Vorschau an — Ihre eigene Einsortierung bleibt dabei unangetastet.

## v2.347 — 2026-07

### Neu
- In der Förderfähigkeit lässt sich die Einreichungs-Liste ganz einklappen — ein Klick, und der Prüfbogen hat die volle Breite.

### Verbesserungen
- Die Trennlinie zwischen Liste und Detail ist überall sichtbar und lässt sich ziehen; mit den Pfeiltasten geht es feiner, ein Doppelklick setzt die Breite zurück.
- Auf der Förderfähigkeit-Seite bleiben Titel und Reiter beim Scrollen stehen; Liste und Detail scrollen getrennt.

## v2.346 — 2026-07

### Neu
- Mehrere Funktionen, die es bisher nur im Entwickler-Build gab, stehen jetzt auch in der PL- und der Kurator-Fassung: die **Antrag-Aufbereitung**, **Nachforderungen und Artefakt-Werkbank**, die **Förderfähigkeitsprüfung** und der **Assistent** in der rechten Spalte.
- Der Kurator kann den **Gutachten-Workflow** jetzt selbst durchspielen und sieht seine eigenen, noch nicht freigegebenen Workflow-Entwürfe.

### Verbesserungen
- Der Assistent ist damit nur sichtbar, nicht eingeschaltet: Ereignisprotokoll und Gedächtnis bleiben freiwillig und verlassen den eigenen Rechner nicht.
- In der Antrag-Aufbereitung sind zunächst die Ansichten ohne KI nutzbar; die KI-Bausteine bleiben gesperrt, bis sie ausreichend geprüft sind.

## v2.344 — 2026-07

### Neu
- Die Antragsseite zeigt jetzt alle Statuseinträge des Fachsystems — in denselben Ordnern wie dort (Kommunikation, Antragsbearbeitung mit pre-check, Ablehnung, Widerspruch …), getrennt nach Verbund und Teilvorhaben.
- In den Einstellungen lässt sich unter „Meine Rolle" AB oder FB hinterlegen. Die Statusliste startet dann auf die eigene Rolle gefiltert; ein Klick auf „Alle" zeigt wieder alles.
- Die Projektleitung kuratiert den Statuskatalog im Status-Cockpit: Ordner anlegen und umhängen, Einträge benennen, Zuständigkeit setzen und festlegen, welcher Termin die Phase eines Antrags anhebt.

### Verbesserungen
- Neue Statusspalten in den CSV-Quellen fallen nicht mehr unter den Tisch: sie werden beim Import gefunden und der Projektleitung zum Einsortieren vorgelegt.

## v2.338 — 2026-07

### Verbesserungen
- Wenn Sie die Antragsliste einklappen, räumt die Seite jetzt mit auf: Suchfeld, Sicht-Tabs, Export, Ansichts-Umschalter und Filter verschwinden, weil sie ohnehin nur die ausgeblendete Liste betreffen. Der Antrag bekommt den Platz; einmal wieder eingeblendet ist alles unverändert da — auch Ihr Suchtext und die gewählte Sicht.
- Der Knopf „Antrag-Aufbereitung öffnen" sitzt jetzt rechts oben in der Kopfzeile des Antrags statt als lose Zeile darunter.
- Die Kurzbeschreibung lässt sich zuklappen (standardmäßig ist sie offen) — praktisch, wenn Sie den Antrag schon kennen.
- „Verbundpartner und Teilvorhaben" ist keine eigene Klappzeile mehr, sondern steht in „Antragsdaten": eine Sektion weniger auf der Seite, alles Übrige unverändert.
- Die „Artefakt-Werkbank" (und darunter „Widerspruch/Stellungnahme") steht jetzt vor „Alle Felder" — in der Reihenfolge, in der Sie tatsächlich arbeiten.

## v2.337 — 2026-07

### Verbesserungen
- Im Meilenstein-Zeitstrahl stehen die Meilenstein-Namen jetzt vollständig; die Wochen-Achse gibt dafür Breite ab und ist etwas sparsamer beschriftet.
- Auf der Verbund-Seite starten „Status &amp; Verlauf" und „Fristen &amp; Meilensteine" jetzt eingeklappt — wie das Gutachten. Die Kopfzeile zeigt weiterhin das Wichtigste: die abgeleitete Phase bzw. Prognose, Frist und Restzeit.
- Die Gutachten-Karte ist aufgeräumt: Kopf, Text, eine Werkzeugzeile und eine ruhige Fußzeile. Die Aktionen liegen nicht mehr an drei verschiedenen Stellen, seltener Gebrauchtes steckt im ⋯-Menü.
- Hinweise zu einem Abschnitt stehen gesammelt in einer Zeile statt in bis zu fünf Bannern übereinander.
- Die KI-QS steht jetzt direkt unter dem Text: ein Klick auf einen Befund markiert die betroffenen Sätze. Das rechte Panel zeigt sie nicht mehr doppelt und startet eingeklappt, damit der Entwurf mehr Platz hat.
- Am Knopf „Freigeben und weiter" ist auf einen Blick zu sehen, wie die QS ausgegangen ist.

### Bugfixes
- Im Meilenstein-Zeitstrahl standen die Wochen-Beschriftungen neben den Punkten, auf die sie sich beziehen; „Eingang" und die letzte Woche ragten in die Nachbarspalten. Die Achse sitzt jetzt auf demselben Raster wie die Zeilen.
- Das Auswahlfeld „Meilenstein absehbar nicht zu halten?" war zu schmal und schnitt den gewählten Meilenstein mitten im Wort ab.

## v2.336 — 2026-07

### Neu
- Je Arbeitsschritt lassen sich in der Skill-Verwaltung eigene Abnahme-Kriterien hinterlegen („Aussagen durch den Antrag belegt"). Die KI-QS prüft dann genau diese Punkte und nennt die betroffenen Sätze.
- Ein Knopf schlägt passende Kriterien aus der Prompt-Vorlage vor. Übernommen wird nur, was angeklickt wird.

## v2.335 — 2026-07

### Verbesserungen
- Nach dem Generieren eines Gutachten-Abschnitts läuft der sprachliche Feinschliff automatisch mit — angezeigt wird direkt die polierte Fassung. Der Rohentwurf bleibt unter „Vorfassungen" zum Vergleich erhalten.
- Klappt der Feinschliff einmal nicht (oder wird gestoppt), bleibt der Rohentwurf stehen und sagt das kurz an. Nichts geht verloren, nichts blockiert.

## v2.334 — 2026-07

### Verbesserungen
- Ist die agentische KI gerade nicht erreichbar, übernimmt beim Gutachten automatisch die Standard-KI. Statt eines Fehlers steht am Abschnitt nur ein kurzer Hinweis, welche KI ihn geschrieben hat.

## v2.333 — 2026-07

### Neu
- Im Status-Katalog steht jetzt zu jedem Status die **CSV-Spalte**, aus der er stammt — der Name, unter dem er auch im Fachsystem-Export zu finden ist. Die Suche findet Stati auch darüber.

### Verbesserungen
- Die Spalte „Feld" zeigt den Klarnamen statt des technischen Kürzels: aus `status` wird „TV-Status". Das Kürzel erscheint beim Darüberfahren.
- Ein leeres Label ist als solches erkennbar („wie Rohwert") — vorher stand dort der Rohwert und sah aus wie ein bereits gesetzter Name.

## v2.332 — 2026-07

### Verbesserungen
- Der Status-Katalog gilt jetzt für das ganze Team: Was die Kuration einmal einsortiert, sehen alle anderen beim nächsten Start der App — bisher wirkte das nur auf dem eigenen Rechner.
- War der Datenspeicher beim Speichern nicht erreichbar, sagt die Seite das deutlich und bietet einen zweiten Versuch an. Die Arbeit ist in dem Fall trotzdem gespeichert, nur noch nicht veröffentlicht.
- Der Statusverlauf bleibt weiterhin auf dem eigenen Rechner — er hält fest, wann dieser Rechner eine Änderung gesehen hat.

## v2.331 — 2026-07

### Neu
- Neuer Bereich „Fristen & Meilensteine": Er zeigt je Verbund, welche Bearbeitungs-Meilensteine erreicht, fällig oder gerissen sind — und ob die drei Monate ab Antragseingang noch zu halten sind.
- Der Reiter „Diese Woche" listet alles, was überfällig ist oder in den nächsten sieben Tagen fällig wird. Dasselbe gibt es als Widget für die Startseite.
- Die Auswertung zeigt, wie lange die Bearbeitung tatsächlich dauert — im Schnitt und getrennt nach FuE, DS, DL und NW.
- Auf der Verbund-Seite kannst du melden, wenn du einen Meilenstein absehbar nicht hältst. Die Meldung geht über deinen persönlichen Ordner an die Projektleitung.
- Die Projektleitung legt fest, welche Meilensteine es gibt, wann sie fällig sind und welche Einträge aus dem Fachsystem sie erfüllen — ohne dass dafür etwas programmiert werden muss.

## v2.324 — 2026-07

### Verbesserungen
- Anonymisierung und Tagging von Anfragen nutzen jetzt fest die Standard-KI (nicht die agentische).
### Bugfixes
- Beim Ablegen einer Kurzanfrage öffnet sich kein KI-Tab mehr von selbst. Ist die interne KI nicht verbunden, erscheint stattdessen ein Hinweis mit „Jetzt verbinden".

## v2.324 — 2026-07

### Verbesserungen
- Feedback geben ist jetzt schneller: Für kleine Anfragen reicht eine ausgefüllte Textbox — die übrigen Felder sind klar als „optional" gekennzeichnet.
- Wenn du nur wenig ausfüllst, weist dich das Formular vor dem Senden freundlich darauf hin, dass ein Screenshot oft weiterhilft (du kannst trotzdem direkt senden).

## v2.323 — 2026-07

### Verbesserungen
- Anträge im Auslastungs-Modul werden erst klassifiziert, wenn sie vollständig sind. Solange noch nicht alle Teilvorhaben eines Verbundes eingegangen sind, wird der Antrag im Reiter „Anträge klassifizieren" zurückgehalten („wartet auf Vollständigkeit") und erscheint nur unter dem Filter „Unvollständig" — so wird keine Einordnung vergeben, die sich ohnehin noch nicht zuweisen lässt.

## v2.315 — 2026-07

### Neu
- Wenn zu einem Verbund eine Rücknahmeempfehlung oder Ablehnung entworfen wurde, gibt es jetzt eine Abgleich-Ansicht für die Antwort des Antragstellers: Links stehen die tragenden Gründe des Bescheids, rechts legen Sie die Stellungnahme ab. Zu jedem Grund halten Sie fest, ob er ausgeräumt, teilweise oder nicht ausgeräumt ist, mit einer Notiz. Ein Klick bereitet die Antwort in der Werkbank vor — mit den noch offenen Gründen schon angekreuzt.

## v2.314 — 2026-07

### Neu
- Die Artefakt-Werkbank kann jetzt nicht nur Nachforderungen, sondern auch Rücknahmeempfehlungen und Ablehnungen entwerfen. Der Ablauf ist derselbe (offene Punkte, Bausteine bestätigen), aber vor dem Export gibt es ein strengeres Freigabe-Tor: Jeder Punkt muss einen Baustein tragen, mögliche Widersprüche zur Fachbewertung werden angezeigt und sind einzeln zu bestätigen, und zum Schluss geben Sie den Entwurf ausdrücklich frei. Die passenden Textbausteine legen Sie vorab in der Skill-Verwaltung an.

## v2.312 — 2026-07

### Verbesserungen
- Die „● CSV"-Anzeige unten sagt jetzt klar, was los ist: „Keine CSV-Quellen", „CSV-Ordner verknüpfen" (mit Knopf) oder „offline" — statt eines wenig hilfreichen „unbekannt".
- Der Kurator-Build holt sich die täglichen CSV-Exporte jetzt automatisch, wie die PL-Version.
### Bugfixes
- CSV-Quellen konnten beim Daten-Abgleich still verschwinden (Anzeige wurde grau, kein Hinweis). Das ist behoben — ein fehlerhaft veröffentlichter Datenbestand löscht die verknüpften Quellen nicht mehr.

## v2.311 — 2026-07

### Neu
- Auf der Verbund-Seite gibt es eine neue „Artefakt-Werkbank": Sie halten die offenen Punkte eines Antrags fest, ordnen sie den Prüfaspekten zu und kreuzen an, welche in eine Nachforderung sollen. Zu jedem Punkt schlägt die App passende Textbausteine vor — Sie bestätigen die Auswahl, und der Entwurf wird daraus erzeugt. So bestimmen Sie, was nachgefordert wird, statt es der KI zu überlassen.

## v2.310 — 2026-07

### Neu
- Die Textbausteine für Nachforderungen lassen sich jetzt in der App pflegen: In der Skill-Verwaltung gibt es den neuen Reiter „Textbausteine". Dort können Sie Bausteine durchsuchen und filtern, den Wortlaut bearbeiten, einzeln freigeben oder stilllegen und frühere Fassungen mit einem Klick zurückholen.
- Über „Aus Word importieren" lesen Sie eine Word-Datei ein: Jeder Textblock wird als Baustein-Entwurf vorgeschlagen, den Sie noch einordnen (Typ, Thema, Prüfaspekte). Der Wortlaut bleibt dabei unverändert — importierte und neue Bausteine sind zunächst Entwürfe und werden erst nach Ihrer Freigabe verwendet.

## v2.308 — 2026-07

### Neu
- Der Zeitplan der Antrag-Aufbereitung ist wieder nutzbar, sobald zum Vorhaben eine Einreichung als JSON hinterlegt ist. Er zeigt dann die Arbeitspakete aus dieser Einreichung — nicht mehr die unzuverlässig aus PDF-Tabellen gelesenen.

### Verbesserungen
- Die Reiter „Fragen" und „Abdeckung" sind vorerst gesperrt und sagen auch, warum: die automatische Fragen-Ableitung und die Aspekt-Abdeckung sind noch nicht verlässlich genug. Ihre bereits markierten offenen Punkte bleiben gespeichert und tauchen wieder auf, sobald die Reiter zurückkommen.
- In der Übersicht steht bei jedem pausierten Teil der Grund, statt eines Verweises, der ins Leere führt.

## v2.307 — 2026-07

### Neu
- Im Recherche-Tab können Sie den externen Report jetzt einfach auf die Fläche „Report-Datei hier ablegen" ziehen — oder wie bisher klicken und auswählen. Neben PDF und Word werden auch Markdown- und Textdateien gelesen; ChatGPT Deep Research bietet den Download inzwischen ebenfalls als Markdown an.
- Sie können mehrere Dateien auf einmal ablegen. Jede wird einzeln gelesen und als eigener Import angelegt, ein Zähler zeigt den Fortschritt.

### Verbesserungen
- Lässt sich eine Datei nicht lesen (falscher Dateityp, gescanntes PDF), wird sie beim Namen genannt — die übrigen Dateien der Ablage sind trotzdem übernommen.
- Schlägt „Text übernehmen" fehl, bleibt Ihr eingefügter Report im Feld stehen. Bisher war er weg.

## v2.305 — 2026-07

### Bugfixes
- Kopier-Knöpfe zeigen bei einem Fehlschlag jetzt ein Warnzeichen statt eines Häkchens, und der Grund steht am Knopf. Bisher sah ein gescheitertes Kopieren an manchen Stellen genauso aus wie ein gelungenes — mit dem Ergebnis, dass beim Einfügen der alte Inhalt der Zwischenablage auftauchte.

## v2.302 — 2026-07

### Verbesserungen
- Vor dem Start der KI-Aufbereitung prüft die App kurz, ob die interne KI wirklich antwortet — bisher genügte ihr ein offener KI-Tab. Ist das Lesezeichen dort nicht aktiv, kommt jetzt sofort das Angebot zu verbinden, statt nach Minuten „Fehler" an allen sechs Abschnitten.
- Gescheiterte Abschnitte tragen keinen „Tab öffnen"-Link mehr — dort gab es nichts zu sehen. Der Grund steht direkt beim Abschnitt.
- In der Antrag-Aufbereitung steht jetzt schon vor dem Klick da, wenn die interne KI getrennt oder noch nicht verbunden ist. Der Knopf „Mit KI aufbereiten" bleibt bewusst klickbar — er bietet dann zuerst das Verbinden an, statt nur „geht nicht" zu sagen.
- Scheitert ein KI-Abschnitt, steht der Grund direkt beim Abschnitt statt nur „Fehler" — zum Beispiel der Hinweis, dass für Antragsinhalte die interne KI gewählt sein muss.
- Die Zahlen an den Filter-Knöpfen im Auslastungs-Modul zeigen jetzt genau das, was die Liste nach dem Klick anzeigt. Sind bereits andere Filter gesetzt, sind die eingerechnet. Gezählt werden Verbünde, nicht einzelne Teilvorhaben.
- Der Filter „Übernahme-Wunsch" findet auch Vormerkungen, die noch nicht eingesammelt sind — also genau die Anträge, die in der Liste mit „vorgemerkt" markiert sind.

### Bugfixes
- Kopier-Knöpfe melden jetzt, wenn das Kopieren nicht geklappt hat. Bisher schlossen manche still fehl: der Knopf zeigte „Kopiert", in der Zwischenablage lag aber noch der alte Inhalt. Besonders heikel war das bei den Zugangspasswörtern, die nur einmal anzeigbar sind, und beim Pfad im Startbildschirm.
- „Kopieren & ZIM FAQ-Assistent öffnen" kopiert jetzt nachweislich, bevor der neue Tab aufgeht. Vorher konnten beide gleichzeitig starten — mit dem Ergebnis, dass im Assistenten der vorherige Inhalt der Zwischenablage landete.
- Beim Einsammeln der Übernahme-Wünsche wurden Wünsche mitgezählt, die auf Anträge zeigten, die in der Zuweisungs-Liste gar nicht mehr auftauchen (inzwischen vergeben oder außerhalb des Verteil-Fensters). Die Meldung sagte „14 neu", der Filter fand nichts. Solche Wünsche werden jetzt getrennt als „nicht mehr zuweisbar" ausgewiesen — mit Angabe, wer welchen Antrag wollte und warum er nicht mehr zur Verteilung steht.
- Haben sich mehrere Kolleginnen oder Kollegen für denselben Verbund vorgemerkt, blieb nach einem Neustart der App nur eine Vormerkung übrig. Jetzt bleiben alle Interessenten erhalten, bis die Projektleitung zuweist.
- „Mit KI aufbereiten" und „Neu aufbereiten" taten gelegentlich gar nichts — kein Hinweis, keine Meldung; erst ein Neuladen der Seite half. Ursache war ein Antrag, der beim Öffnen der Seite noch nicht aus dem Datenbestand geladen war (etwa während einer laufenden Datenaktualisierung). Die Seite sagt das jetzt und bietet „Erneut versuchen" an — und sobald die Daten da sind, lädt sie den Antrag von selbst nach.
- Schlägt „Neu aufbereiten" fehl, steht der Grund jetzt oben auf der Seite. Bisher war diese Meldung nur im ausgeblendeten Zeitplan-Reiter zu sehen, der Knopf wirkte dadurch kaputt.

## v2.299 — 2026-07

### Verbesserungen
- Die KI setzt in Gutachten-Abschnitten keine Semikolons und keine Gedankenstriche mehr. Rutscht doch eines durch, meldet es die Prüfung unter dem Entwurf und zeigt die Stelle im Text.
- „Sprachlicher Feinschliff" löst solche Stellen jetzt zuverlässig auf: aus einem Satz mit Semikolon werden zwei Sätze, ein Einschub in Gedankenstrichen wird zu Komma oder Klammer.
- Bindestriche in Wörtern wie „KI-gestützt" und Zeiträume wie „2024–2026" bleiben selbstverständlich unangetastet.

## v2.298 — 2026-07

### Verbesserungen
- Die KI-Aufbereitung eines Antrags nutzt jetzt immer die Standard-KI — auch wenn oben „Agentisch" eingestellt ist. Sie ist damit deutlich schneller und liefert seltener unbrauchbare Ergebnisse. Welche KI gerade arbeitet, steht in der Übersicht.
- Sind die Dokumente eines Antrags zu umfangreich für die Standard-KI, sagt das der Hinweis über den Dokumenten — und bietet an, diesen einen Antrag mit der agentischen KI aufzubereiten (sieht alles, dauert länger).

### Bugfixes
- Der Hinweis „passt nicht ins Kontextfenster" rechnete bei eingestellter agentischer KI mit der falschen Größe und blieb deshalb manchmal aus, obwohl der Text abgeschnitten wurde.

## v2.296 — 2026-07

### Neu
- Wie lang ein Text werden soll — Wörter, Sätze, Zeichen, Absätze, Satzlänge — steht jetzt direkt beim Skill unter „Umfang & Form" und lässt sich dort mit einem Klick an- und ausschalten. Bisher brauchte jede dieser Angaben eine eigene Regel in der gemeinsamen Liste.
- Neuer Umschalter „Team | Persönlich" bei jedem Skill: Was die Kuration ändert, gilt für alle. Was Sie unter „Persönlich" ändern, gilt nur für Sie und wird in Ihrem persönlichen Ordner gespeichert — dort liegen auch Ihre Stil-Hinweise. Die Kuration gibt vor, welche Werte Sie anpassen dürfen; gesperrte Werte sind mit einem Schloss gekennzeichnet.

### Verbesserungen
- Die Liste der Qualitätsregeln ist deutlich kürzer und enthält nur noch Regeln, die in mehreren Skills gelten. Mehrfach vorhandene Einträge („Satzanzahl" gleich dreimal) und Überbleibsel, die zu keinem Skill mehr gehörten, sind verschwunden.
- Detailansichten schließen jetzt über das X oben rechts — wie überall sonst in der App.
- Tabellen passen sich der Fensterbreite an, statt rechts hinauszulaufen: die Spalten werden gemeinsam schmaler, und erst wenn es wirklich zu eng wird, erscheint der Scrollbalken. Das gilt für Skills, Qualitätsregeln, Anfragen und das Feedback-Board; die Förderanträge behalten ihr gewohntes Verhalten mit vielen Spalten.

### Bugfixes
- Beim Anwählen einer Regel blieb rechts der zuvor geöffnete Skill stehen. Jetzt wechselt die Detailansicht wie erwartet.
- Der Breiten-Griff am rechten Tabellenrand zog die Tabelle bisher nur breiter, nie schmaler — jetzt wirkt er in beide Richtungen.

## v2.295 — 2026-07

### Neu
- Skills haben jetzt eine Kategorie — Gutachten, Nachforderungen, Aufbereitung, Anfragen, Qualitätssicherung. Die Liste ist standardmäßig danach sortiert, und über die neue Auswahl „Kategorie" lässt sich auf eine davon einschränken. Die Zuordnung passiert automatisch; im Skill-Editor kann man sie überschreiben.

### Verbesserungen
- Die Skill-Verwaltung öffnet jetzt in der Tabellen-Ansicht, weil dort am meisten auf einen Blick zu sehen ist.
- Die Tabelle zeigt endlich auch Kategorie und Status (Entwurf/Erprobt/Empfohlen, bei gesperrten Skills zusätzlich „inaktiv") — bisher gab es diese Markierungen nur in der Listen- und Karten-Ansicht. Über „Spalten" lässt sich zusätzlich einblenden, ob ein Skill nur mit der internen KI laufen darf.
- Die Tabellen der Skill-Verwaltung (Skills und Qualitätsregeln) lassen sich am rechten Rand schmaler ziehen, wenn sie über den Bildschirm hinauslaufen — wie bei den Förderanträgen. Doppelklick auf den Griff setzt auf die Fensterbreite zurück.

## v2.294 — 2026-07

### Neu
- Ist ein Gutachten-Abschnitt inhaltlich und von der Länge her in Ordnung, gibt es jetzt den Knopf „Sprachlicher Feinschliff": Die KI überarbeitet den Abschnitt nur sprachlich — Satzbau, Wortwiederholungen, Grammatik — und lässt Inhalt und Umfang unangetastet. Anders als „Neu/Kürzer/Länger" wird dabei nicht neu aus der Vorhabensbeschreibung geschrieben.
- Nach dem Feinschliff vergleicht die App die Fassungen selbst: Verschwinden oder erscheinen Zahlen, oder ändert sich die Länge spürbar, erscheint ein Hinweis an der Karte. Die vorherige Fassung steht wie gewohnt im Versionsvergleich und lässt sich mit einem Klick zurückholen.

### Verbesserungen
- „Text kopieren" steht jetzt beschriftet direkt unter dem Abschnitt, neben dem Info-Symbol — statt als kleines Symbol unten in der Knopfleiste. Ein Klick legt den vollständigen Abschnitt in die Zwischenablage und der Knopf bestätigt kurz mit „Kopiert".
- Unter dem generierten Text steht neben der Satzzahl jetzt auch die Wortzahl („36 Sätze · 412 Wörter"). Sie wird genauso gezählt wie in der Umfangs-Prüfung, gilt also direkt als Abgleich mit den Vorgaben — auch in der Kurzfassung.

## v2.293 — 2026-07

### Verbesserungen
- Der Titel eines Teilvorhabens lässt sich jetzt mit der Maus markieren und kopieren; beim Überfahren der Zeile erscheint zusätzlich ein Kopier-Symbol, das den vollständigen Titel in die Zwischenablage legt — auch wenn er in der Anzeige gekürzt ist.
- Ein aufgeklapptes Teilvorhaben zeigt nicht mehr die „Eckdaten"-Karte (dieselben Angaben stehen bereits oben beim Verbund) und nicht mehr den unklaren „Klassifikation"-Block. Bei Anträgen ohne Verbund bleiben die Eckdaten erhalten.

## v2.292 — 2026-07

### Verbesserungen
- Im Feedback-Board wird der Titel eines Feedbacks nicht mehr abgeschnitten: In der Liste links bricht er über mehrere Zeilen um, im Detail rechts steht er vollständig. Gleiches gilt für die Ticket-Liste der Kuration.
- „Feedback verbessern" ist deutlich schneller: Es läuft jetzt immer über die Standard-KI (das steht auch im Ladehinweis), startet dafür einen frischen Chat und fragt nur noch nach, wenn im Formular wirklich etwas fehlt.

## v2.291 — 2026-07

### Verbesserungen
- Hat die Projektleitung dir einen Verbund zugewiesen, steht das jetzt auch so da: „Dir zugewiesen · Bestätigung folgt" statt „Vorgemerkt". Verbindlich wird die Zuweisung im Fachsystem — sie taucht mit deinem Kürzel im nächsten CSV-Import auf.
- Anträge, die bereits jemand anderes zugewiesen bekommen hat, werden dir nicht mehr zur Vormerkung angeboten.
- Die Projektleitung sieht in der Zuweisungs-Liste, wenn eine Zuweisung seit mehreren Tagen nicht per CSV bestätigt wurde — Hinweis, im Fachsystem nachzusehen.

## v2.290 — 2026-07

### Verbesserungen
- Nimmst du deinen Übernahme-Wunsch zurück, verschwindet er sofort aus der Zuweisungs-Liste der Projektleitung — ohne dass sie erst einsammeln muss.
- Die Projektleitung sieht per Tooltip, wer welchen Wunsch zurückgezogen hat.
- Wünsche, die erfüllt sind (der Verbund ist vergeben), räumen sich beim nächsten Besuch der Startseite von selbst weg. Die Einsammel-Meldung zeigt außerdem, wie viele der gelesenen Wünsche bereits vergeben sind.

## v2.289 — 2026-07

### Verbesserungen
- Feedback melden ist einfacher: Die Auswahl „Etwas ist umständlich" gibt es nicht mehr — solche Rückmeldungen gehören ab jetzt zu „Ich wünsche mir etwas". Damit stehen nur noch vier klar unterscheidbare Typen zur Wahl.
- Bereits gemeldete UX-Tickets erscheinen automatisch als „Idee" — mit allen Inhalten, Stimmen und Sponsoring-Punkten wie bisher.

## v2.288 — 2026-07

### Verbesserungen
- In „Anträge zuweisen" zeigt die Sicht „offen" jetzt auch Anträge, die sich jemand gewünscht hat — ein Übernahme-Wunsch ist eine Bewerbung, keine Zuweisung. Der Antrag bleibt so lange offen, bis er wirklich vergeben ist.
- In der Liste steht direkt in der Zeile, **wer** einen Antrag übernehmen möchte (Kürzel statt nur „2 will"). Bei mehr als drei Interessenten wird gekürzt; der komplette Kreis steht im Tooltip und im Detail rechts.

## v2.286 — 2026-07

### Neu
- **Eine KI-Zweitmeinung zum Innovationsgrad — erst nach Ihrem eigenen Urteil.** Das ist ein Versuch, und er ist bewusst so gebaut: Solange Sie eine der drei Kategorien nicht selbst eingestuft haben, steht auf der Karte nichts. Erst danach erscheint daneben, wie die KI dieselbe Kategorie einordnet, mit kurzer Begründung an den Ankertexten und den Fundstellen im Text. Es gibt keinen „Übernehmen"-Knopf: die Einschätzung ändert nichts, zählt nirgends mit und taucht in keinem Gutachten-, Nachforderungs- oder Ablehnungsentwurf auf. Sie kostet auch keine zusätzliche Wartezeit — sie entsteht im selben Durchlauf wie die übrigen Analysen. Zu finden in der Förderfähigkeitsprüfung unter „Förderfähig".

## v2.285 — 2026-07

### Verbesserungen
- **Die KI bekommt klarere Aufträge.** Nachdem sich beim Abschnitt „Technologiekompetenz" gezeigt hatte, dass eine widersprüchliche Formulierung die KI minutenlang im Kreis denken lässt, wurden alle Aufträge der App daraufhin durchgesehen. Gefunden und behoben: Anweisungen, die sich auf Angaben beriefen, die gar nicht mitgeschickt wurden; Überschriften, unter denen nichts stand; und Stellen, an denen zwei Vorgaben Gegenteiliges verlangten, ohne zu sagen, welche gilt.
- **Der Anonymisierer arbeitet zuverlässiger.** Sein Auftrag enthielt ein Beispiel mit einem erfundenen Namen — die KI konnte es für echte Daten halten und den Namen in den fertigen Text zurückschreiben. Das Beispiel ist jetzt eindeutig als Schablone erkennbar. Außerdem verlangte der Auftrag gleichzeitig „so viel wie möglich ersetzen" und „den fachlichen Sinn erhalten", ohne den Widerspruch aufzulösen.

### Neu
- **Der Assistent lässt sich abbrechen.** Denkt er ungewöhnlich lange, beendet ein Klick auf „Abbrechen" den Vorgang. Bisher gab es keine Möglichkeit, einen laufenden Vorgang zu stoppen.

## v2.284 — 2026-07

### Bugfixes
- **Der Gutachten-Abschnitt „Technologiekompetenz" bricht nicht mehr ab.** Die Vorgabe für den Pflicht-Satzanfang war für die KI nicht auflösbar: sie verlangte den Wortlaut „exakt", zeigte ihn aber abgeschnitten. Die KI suchte daraufhin immer wieder nach dem fehlenden Rest, bis ihr Antwortbudget aufgebraucht war — dieser Abschnitt lief lange und lieferte am Ende oft gar nichts. Der Pflicht-Anfang steht jetzt unmissverständlich da.
- **Dieselbe Datei erneut hochzuladen legt keine zweite Kopie mehr an.** Bisher bekam jeder Upload einen eigenen Eintrag — wer fünf Dateien dreimal ablegte (etwa nach einer misslungenen Umwandlung), hatte fünfzehn Dokumente am Verbund hängen. Sichtbar wurde das erst mit dem neuen Dokument-Inventar; verloren gegangen war nie etwas. Jetzt ersetzt eine gleichnamige Datei die vorherige Fassung.
- Ihre **Auswahl bleibt dabei erhalten**: Welches Dokument die maßgebliche Vorhabensbeschreibung ist und was im Gutachten-Kontext liegt, überlebt das erneute Hochladen.

### Neu
- Liegen aus früheren Uploads noch **mehrfache Fassungen** derselben Datei herum, sind sie im Inventar als *ältere Fassung* markiert. Ein Klick auf **„Ältere Fassungen entfernen"** räumt sie weg — je Dateiname bleibt die zuletzt hochgeladene erhalten. Von allein wird nichts gelöscht.

## v2.283 — 2026-07

### Verbesserungen
- Die **Regelprüfung steht jetzt direkt unter dem Entwurf**, nicht mehr rechts in der Quellen-Spalte. Ein Klick auf „prüft 3 Regeln" in der Zeile unter dem Text klappt sie auf.
- **Standardmäßig ist sie zugeklappt** — ist alles in Ordnung, stört sie nicht. Gibt es einen Hinweis oder Fehler, geht sie von selbst auf und zeigt genau die betroffene Regelgruppe. Schon zugeklappt sehen Sie am Text „prüft 3 Regeln · 1 Hinweis", woran Sie sind.
- Die rechte Spalte heißt jetzt **„Quelle & KI-Hinweise"** und zeigt, wofür sie gedacht ist: die Belegstellen aus dem Antrag, beratende KI-Hinweise und den Denkprozess.
- Der Knopf **„Prüfen" ist aus der Anpassen-Zeile verschwunden** — er tat dort nichts Sichtbares, weil die Prüfung nach jeder Generierung und jeder Bearbeitung ohnehin automatisch läuft. Als „Neu prüfen" sitzt er jetzt im aufgeklappten Prüfblock, wo sein Ergebnis auch zu sehen ist.

## v2.282 — 2026-07

### Neu
- Das Gutachten zeigt jetzt **alle Dokumente des Verbundes**, die Sie hochgeladen haben — mit Dokumenttyp, Umfang und der Kopfzeile „5 Dokumente · 1 im Gutachten-Kontext". Sie sehen damit auf einen Blick, was abgelegt ist und was die KI tatsächlich zu sehen bekommt.
- Pro Dokument entscheiden Sie mit **„ins Gutachten aufnehmen"**, ob es in den KI-Kontext einfließt. Haben Sie mehrere Dateien hochgeladen, meldet sich ein Hinweis mit *Alle aufnehmen* — er bleibt stehen, bis Sie sich entschieden haben, und verschwindet nicht beim Neuladen.
- Liegen mehrere Dateien als Vorhabensbeschreibung vor, **wählen Sie die maßgebliche selbst** aus. Diese Wahl gilt überall — Gutachten, Kurzfassung, Nachforderungen und Aufbereitung arbeiten danach mit demselben Dokument.

### Bugfixes
- **Hochgeladene Dokumente verschwanden nach „Fertig".** Sie waren nie verloren — gespeichert wurden sie immer, aber die Gutachten-Seite zeigte nur die Vorhabensbeschreibung an, und in die KI-Analyse floss ebenfalls nur diese eine Datei.
- **Bei mehreren Vorhabensbeschreibungen entschied der Zufall.** Dateien, deren Namen die App nicht zuordnen konnte — etwa „Projektbeschreibung" oder „Wirkung" —, wurden automatisch als Vorhabensbeschreibung eingestuft; welche davon das Gutachten verwendete, hing daran, welche zuerst fertig eingelesen war. Jetzt entscheiden Sie.
- Die Warnung „passt nicht ins Kontextfenster" rechnet jetzt mit **allen** aufgenommenen Dokumenten statt nur mit der Vorhabensbeschreibung.

## v2.281 — 2026-07

### Neu
- Die Förderfähigkeitsprüfung führt Sie jetzt durch den Ablauf, statt elf gleichrangige Reiter nebeneinanderzustellen. Die Schritte sind in drei Phasen gebündelt — **Verstehen**, **Bewerten**, **Abschluss** —, und eine Leiste am unteren Rand zeigt jederzeit, wo Sie stehen („Schritt 3 von 9"), bringt Sie mit *Zurück* und *Weiter* voran und benennt den nächsten offenen Punkt.
- Kleine Punkte an den Schritten zeigen auf einen Blick, was erledigt ist, was angefangen wurde und wo eine Warnung aus den Rechenchecks wartet.

### Verbesserungen
- Der Bewertungs-Schritt behält Fortschritt und Innovationsgrad beim Scrollen im Blick, und jede Kriteriengruppe zeigt ihren eigenen Stand (z. B. „3/5").
- „Checkliste bearbeiten" und „Import-Report" stehen jetzt sichtbar **neben** dem Prüfablauf statt mittendrin — sie sind Einstellungen, keine Prüfschritte.
- Ein Schritt behält beim Wechseln seinen Scrollstand und Ihre Eingaben.
- Eine schwache Bewertung fällt jetzt auf: Kriterien auf **B0** oder **B1** färben die ganze Karte (rot bzw. amber) statt nur das angeklickte Feld — beim Scrollen durch die Kriterienliste sehen Sie die Problemstellen sofort. Dasselbe gilt für „nicht erfüllt" und „NF notwendig".

### Bugfixes
- Der Innovationsgrad wurde grün angezeigt, sobald alle drei Kategorien bewertet waren — auch bei nur 3 von 9 Punkten. Unterhalb des Kurzpfads erscheint er jetzt amber: „fertig bewertet" heißt nicht „gut".

## v2.280 — 2026-07

### Neu
- Der Tab der internen KI zeigt jetzt im Tab-Titel, was gerade passiert. Sie sehen also von der App aus — ohne hinüberzuwechseln —, ob die KI arbeitet: `⏳ 0:42 · 1,4k` heißt „läuft seit 42 Sekunden, 1400 Zeichen Antwort sind schon da". Wächst die Zahl, kommt die KI voran; steht sie still, hakt es. Nach getaner Arbeit erscheint kurz `✅ Fertig`, bei einem Problem bleibt `⚠️` stehen.

### Wichtig
- Damit das funktioniert, muss das Lesezeichen („Bookmarklet") **einmalig neu installiert** werden: Einstellungen → Interne KI → Lesezeichen erneut in die Lesezeichenleiste ziehen. Ohne diesen Schritt läuft der bisherige Stand weiter.

## v2.278 — 2026-07

### Bugfixes
- Die Ergebnisse von „Mit KI analysieren" verschwinden nicht mehr, wenn Sie zwischendurch eine andere Seite aufrufen. Steckbrief, Canvas, Delta zum Stand der Technik und Wirkungskette sind beim Zurückkehren sofort wieder da — auch nach einem Neustart und beim Wechsel zwischen Einreichungen. Neu gerechnet wird erst, wenn Sie die zugrunde liegenden Dokumente ändern.
- Dasselbe gilt für die Antrag-Aufbereitung: ein bereits aufbereiteter Antrag zeigt Steckbrief, Abdeckung und Zahlen direkt beim Öffnen, ohne dass Sie den KI-Lauf erneut starten müssen.

### Verbesserungen
- Die Aufbereitungs-Seite lädt spürbar ruhiger: sie las die Vorhabensbeschreibung im Hintergrund immer wieder neu ein, statt einmal.
- Der Lesemodus einer Aufbereitung ist jetzt auch ohne KI-Lauf nutzbar.

## v2.276 — 2026-07

### Neu
- Wenn die App Sie nach Name und Kürzel fragt, obwohl Sie das längst eingerichtet hatten, können Sie jetzt oben auf „Aus persönlichem Ordner wiederherstellen" klicken: Einmal den persönlichen Ordner auswählen, und Name, Kürzel, Farbe und Ihre Einstellungen sind wieder da — ohne Tippen.
### Bugfixes
- Ursache dieser wiederkehrenden Abfrage ist der lokale Browser-Speicher, der in Citrix-Sitzungen verloren gehen kann. Die App bittet den Browser jetzt, ihre Daten zu behalten. Das verringert das Problem, kann es aber nicht ganz ausschliessen — deshalb die Wiederherstellung oben. Tipp: Verbinden Sie beim Einrichten Ihren persönlichen Ordner, dann liegt immer eine Sicherung bereit.
- Bei der Ordner-Freigabe konnte der „Persönliche Ordner" unter Last stillschweigend übersprungen werden, ohne dass je eine Abfrage erschien. Er wird jetzt zuverlässig als eigener Schritt angeboten.

## v2.275 — 2026-07

### Verbesserungen
- Die Ordner-Freigabe beim Start ist jetzt deutlich bequemer: Das Fenster sitzt direkt unter der Browser-Abfrage statt in der Bildschirmmitte — kein weiter Weg mit der Maus mehr zwischen „Zulassen" und dem nächsten Schritt.
- Nach dem ersten „Zulassen" genügt ein Druck auf die Enter-Taste für den nächsten Ordner. Wo der Browser es zulässt, werden die Ordner sogar ganz ohne weiteren Klick nacheinander abgefragt.
- Wer mitten in einem Gespräch die KI-Variante umschaltet, bekommt jetzt einen Hinweis: Die Unterhaltung bleibt sichtbar, aber die KI antwortet ab dann aus einem anderen Chat und kennt die bisherigen Fragen nicht. Zurückschalten stellt den alten Stand wieder her.

## v2.274 — 2026-07

### Bugfixes
- Die Umschaltung zwischen der normalen und der agentischen KI hatte im Chat keine Wirkung — es lief immer die KI des gerade offenen Tabs, unabhängig von der Auswahl. Jetzt wechselt der Chat wie überall sonst auf die gewählte Variante. Hinweis: Wenn Sie mitten in einem Gespräch umschalten, wechselt auch der Tab — das bisherige Gespräch bleibt im anderen Tab stehen.
- Die Stapelverarbeitung von Gutachten übergab die gewählte KI-Variante nicht und lief deshalb ebenfalls auf dem gerade offenen Tab.

## v2.273 — 2026-07

### Verbesserungen
- Die agentische KI hat ein deutlich grösseres Kontextfenster als die normale. Das wusste die App bisher nicht und hat lange Vorhabensbeschreibungen auch dort gekürzt, wo es gar nicht nötig war. Jetzt richtet sich die Grenze nach der gewählten KI-Variante — bei „Agentisch" passt rund das Dreifache hinein, eine übliche VB samt Marktkonzept und Verwertung wird damit praktisch nicht mehr gekürzt.
### Bugfixes
- Umgekehrt kam die Warnung „zu lang für die KI" bei der normalen KI-Variante bisher zu spät, weil intern mit einem zu grossen Fenster gerechnet wurde. Auch das stimmt jetzt.

## v2.272 — 2026-07

### Bugfixes
- Wenn die Dokumente eines Vorhabens zusammen zu umfangreich für die KI sind, steht das jetzt sichtbar unter „Dokumente zum Vorhaben". Bisher lief die Analyse in diesem Fall stillschweigend über einen abgeschnittenen Text — das Ergebnis sah vollständig aus, obwohl die KI das Ende nie gelesen hatte. Zeitplan, Tabellen und Gliederung waren davon nie betroffen.

## v2.255 — 2026-07

### Neu
- Neuer Arbeitseinstieg oben auf der Startseite: eine Karte „Weiter, wo du aufgehört hast" bringt dich direkt zurück in deine letzte Arbeit, daneben drei anklickbare Kacheln für kritische Fristen, näher rückende Fristen und offene QS-Freigaben.
### Verbesserungen
- Aufgefrischtes Design der Startseiten-Karten und des Kanban-Boards — ruhiger und aufgeräumter.
- Der Assistent sitzt jetzt als schmale, dauerhaft sichtbare Leiste am rechten Rand; ein Klick öffnet ihn.
### Bugfixes
- Beim Überfahren der Assistent-Leiste erschienen zwei Tooltips übereinander (eines davon ein hartes schwarzes Kästchen) — behoben, es erscheint nur noch ein einzelnes, dezentes Label.

## v2.253 — 2026-07

### Neu
<!-- - Kurzer, verständlicher Satz (nur bei nutzersichtbaren Änderungen) -->
### Verbesserungen
- Die App startet spürbar schneller: die Programmdatei ist von rund 70 MB auf etwa 18 MB geschrumpft (−75 %), bei unveränderter Bedienung. Besonders beim Öffnen vom Netzlaufwerk macht sich das bemerkbar.
### Bugfixes
<!-- - … -->

## v2.252 — 2026-07

### Neu
- In der Antrag-Aufbereitung gibt es jetzt oben den Knopf **„Mit KI aufbereiten"** — er erzeugt alle KI-Abschnitte (Steckbrief, Abdeckung, Zahlen, Glossar, Verwertung) auf einmal, mit Fortschrittsanzeige. Man muss nicht mehr jeden Abschnitt einzeln starten. „Neu aufbereiten" bleibt der schnelle Refresh ohne KI.
### Verbesserungen
- Der Knopf **„Antrag-Aufbereitung öffnen"** steht jetzt gleich oben unter dem Kopf (vor der Kurzbeschreibung) — passend zum Ablauf: erst den Antrag verstehen, dann Nachforderung/Gutachten.
- Fehlt die Kurzbeschreibung eines Vorhabens (wird oft erst nach dem Gutachten erstellt), erscheint jetzt ein dezenter Hinweis statt ersatzweise des Projekt-Titels.
### Bugfixes
<!-- - … -->

## v2.251 — 2026-07

### Neu
- Hochgeladene Dokumente lassen sich jetzt direkt wieder **entfernen** — praktisch, wenn eine PDF schlecht umgewandelt wurde (dann einfach als Word-Datei neu ablegen) oder die falsche Datei erwischt wurde. Das Dokument verschwindet dabei auch aus der Suche.
### Verbesserungen
<!-- - … -->
### Bugfixes
- Beim automatisch erzeugten Kurzfassungs-/Gutachten-Entwurf bekommt die KI jetzt den echten Projekt-Titel (Thema des Vorhabens) statt eines generischen Platzhalter-Titels.

## v2.250 — 2026-07

### Verbesserungen
- In der Antrag-Aufbereitung lässt sich die Breite zwischen dem Steckbrief-Inhalt und der „Eckdaten"-Spalte jetzt per Ziehen anpassen. Doppelklick auf den Griff setzt die Aufteilung zurück; die eingestellte Breite bleibt pro Gerät erhalten.

## v2.249 — 2026-07

### Neu
- **Agentische interne KI wählbar.** Überall, wo du die interne KI verbindest (Einstellungen, Sidebar, Startseite), kannst du jetzt zwischen der klassischen und der agentischen internen KI wählen. Standard bleibt die klassische — die Wahl gilt dann für alle KI-Aktionen.
- **Der Assistent kennt die Dokumente deines Vorhabens.** Er berücksichtigt jetzt gezielt die zu deinem Verbund hochgeladenen Dokumente (Vorhabensbeschreibung, Anlage 5, …), nicht nur zufällige Suchtreffer.

### Verbesserungen
- **Dokumente einmal hochladen — überall verfügbar.** Lädst du Dokumente beim Gutachten hoch, stehen sie jetzt auch in der KI-gestützten Aufbereitung bereit (z. B. die Anlage 5 im Zeitplan) — du musst sie nicht mehr doppelt hochladen. Ordnest du einer Datei nachträglich einen Typ zu, wird das sofort übernommen.
- **PDF-Tabellen werden erkannt.** Tabellen aus PDFs (z. B. die Anlage 5) werden jetzt als echte Tabelle eingelesen — sichtbar in der Vorschau und nutzbar für den Zeitplan. Klappt das bei einem PDF nicht, sagt die App das klar und empfiehlt DOCX (statt die Anlage fälschlich als „fehlt" zu melden).

### Bugfixes
- **Kein stilles Hängen mehr ohne verbundene KI.** Startest du eine KI-Aktion, ohne dass die interne KI verbunden ist, weist die App dich jetzt darauf hin und bietet „Jetzt verbinden" an — statt im Hintergrund einen Tab zu öffnen und lange zu warten.

## v2.248 — 2026-07

### Verbesserungen
- **Beim Hochladen von Dokumenten bleibt die Übersicht offen.** Wenn du für ein Gutachten (oder eine Kurzfassung/Nachforderung) Dateien ablegst, siehst du jetzt in Ruhe für **jede** Datei, ob sie erkannt wurde (Förderkennzeichen/Zuordnung) — die Übersicht schließt sich nicht mehr sofort. Über „Konvertierung prüfen" kannst du pro Datei den umgewandelten Text als Vorschau ansehen. Erst mit „Fertig" geht es weiter.

## v2.247 — 2026-07

### Neu
- **Workflows sichern und übertragen.** In der Skill-Verwaltung lässt sich jetzt ein ganzer Workflow als Datei **exportieren** und wieder **importieren** — samt der Skills und Regeln, die er verwendet. So kannst du einen Stand als Backup ablegen oder in einem anderen Browser weiterverwenden. Beim Import entstehen Kopien mit eindeutigen Namen; vorhandene Skills und Regeln werden nie überschrieben. (Einzelne Skills waren schon vorher exportier-/importierbar.)

## v2.246 — 2026-07

### Neu
- **„Neue Anträge für dich": auch ältere Anträge im Blick.** Das Startseiten-Widget zeigte bisher nur ganz frisch freigegebene Anträge (ein 7-Tage-Fenster). Anträge, die dir in der Auslastung weiterhin zuweisbar sind, deren Fenster auf der Startseite aber schon abgelaufen war, tauchten dort nicht mehr auf. Neu: darunter ein Abschnitt **„Weitere zuweisbare Anträge"**, der alle weiter für dich offenen Anträge (Haupt- und Nebenkategorie) auflistet — ohne Ablauf-Countdown, mit „Kann ich übernehmen". So verschwindet nichts mehr aus dem Blick.

### Verbesserungen
- **Qualitätsregeln im Skill-Editor übersichtlicher.** Die Liste der zuordenbaren Qualitätsregeln war eine lange Scroll-Wand. Sie ist jetzt nach Kategorie gruppiert (Umfang, Sprache, Struktur, Inhalt & Quellen, Vollständigkeit & Form) und je Gruppe einklappbar. Beim Öffnen eines Skills sind genau die Gruppen aufgeklappt, die bereits eine zugeordnete Regel enthalten; jeder Gruppenkopf zeigt, wie viele seiner Regeln zugeordnet sind (z. B. 2/4).
- **Skill bearbeiten: kompakter und mit Markdown-Vorschau.** Beim Bearbeiten eines Skills nahmen zwei Erklärkästen viel Platz ein. Die Erklärungen zu „Verarbeitet Dokumentinhalte" und „Skill aktiv" stecken jetzt hinter einem kleinen Info-Symbol neben dem jeweiligen Häkchen — der Text erscheint beim Darüberfahren, die Kästen sind deutlich schlanker. Zusätzlich zeigt das Prompt-Feld Markdown jetzt formatiert an (Überschriften, Fettdruck) — genauso wie beim Bearbeiten von Gutachten-Abschnitten.

### Bugfixes
- **Skill-Testlauf: alle Antragstypen auswählbar.** Beim Testen eines Skills zeigte die Antrags-Auswahl nur Anträge einer einzigen Förderlinie (die mit `16DL` beginnenden) — FuE-, DS-, DL- und NW-Anträge fehlten. Jetzt sind alle Typen da: darüber gibt es eine Filterleiste (Alle / FuE / DS / DL / NW) mit Anzahl, und die Anträge mit vorliegender Vorhabensbeschreibung — die einzigen, gegen die getestet werden kann — stehen oben. Sind es sehr viele Treffer, weist eine Fußzeile darauf hin, dass du über Typ oder Suche eingrenzen kannst.
- **Verständliche Abschnitts-Überschrift in der Gutachten-Werkstatt.** Bei selbst erstellten Workflow-Schritten stand über dem Abschnitt eine kryptische Zeichenkette statt eines Titels. Jetzt erscheint dort das gewohnte Abschnitts-Kürzel (z. B. „B2") samt Namen und eine Versionsnummer des verwendeten Skills. Auch der Titel des Stil-Dialogs und die „Weiter bei …"-Zeile zeigen jetzt das Kürzel statt der kryptischen Kennung.

## v2.245 — 2026-07

### Neu
- **Verbundprojekte: eigener Zeitplan je Teilvorhaben.** Die Anlage 5 (Arbeitsplan) gehört zu einem einzelnen Teilvorhaben — ein Verbund mit mehreren Teilvorhaben hat also mehrere. Die Antrags-Aufbereitung zeigt jetzt für **jedes Teilvorhaben** seinen eigenen Zeitplan und seine eigene Kapazitätsprüfung aus der jeweiligen Anlage 5, mit einer Gesamtübersicht oben (Personenmonate, eingesetzte Mitarbeitende, längster Zeithorizont). Du kannst einfach alle Anlagen 5 hochladen — sie werden automatisch am Förderkennzeichen im Dateinamen dem richtigen Teilvorhaben zugeordnet.
- **Fehlende Anlage 5 direkt nachreichbar.** Fehlt für ein Teilvorhaben die Anlage 5, siehst du das an dessen Stelle und kannst die Datei gleich dort ablegen — der Zeitplan aktualisiert sich automatisch.

(Einzelanträge sind unverändert.)

## v2.244 — 2026-07

### Bugfixes
- **Kein Fehler mehr, wenn „neuer Datenbestand" und „neue CSV-Quellen" gleichzeitig anstehen.** Bisher konnten oben zwei Aktualisierungs-Hinweise gleichzeitig erscheinen; klickte man beide, liefen sie parallel und einer meldete einen Fehler („… — 1 Fehler"). Jetzt fasst die App beides zu **einem** Knopf „Datenbestand aktualisieren" zusammen, der alles in der richtigen Reihenfolge und in einem Durchlauf erledigt. Steht nur eines an, erscheint wie gewohnt der einzelne Hinweis — und solange eine Aktualisierung läuft, sind die anderen Knöpfe gesperrt, damit sich nichts überschneidet.

## v2.243 — 2026-07

### Bugfixes
- **Absturz beim Öffnen einer Antrags-/Verbund-Detailseite behoben.** Zuvor konnte das Öffnen einer Detailseite — etwa über „Weiter" im Startseiten-Bereich „Weitermachen" — statt der Seite eine Fehlermeldung zeigen. Detailseiten öffnen jetzt wieder zuverlässig.

### Neu
- **Neuer Tab „Verwertung/Markt" in der Antrag-Aufbereitung.** Er fasst die Aussagen zu Zielmärkten, Wettbewerb, Verwertungswegen, geplantem Markteintritt und erwarteten Umsätzen zusammen — jeweils mit Fundstelle im Antrag. Ob diese Angaben in einem eigenen Marketing-/Verwertungskonzept oder schon in der Vorhabensbeschreibung stehen, spielt keine Rolle.

## v2.242 — 2026-07

### Neu
- **Dokumente direkt in der Antrag-Aufbereitung nachreichen.** Fehlt beim Aufbereiten ein Dokument — etwa die Anlage 5 mit dem Arbeits-/Zeitplan —, kannst du es jetzt direkt auf der Seite ablegen: im neuen Bereich „Dokumente zum Vorhaben" per Drag & Drop, und beim Ablegen wählst du, was drinsteht (Vorhabensbeschreibung, Arbeitsplan/Anlage 5, Marketing-/Verwertungskonzept …). Danach wird automatisch neu aufbereitet — kein Umweg mehr über eine andere Seite.
- **Egal, wie die Unterlagen aufgeteilt sind.** Ob das Marketing-/Verwertungskonzept in einem eigenen Dokument liegt oder schon in der Vorhabensbeschreibung steht, macht für die Aufbereitung keinen Unterschied mehr — Inhalt und Fundstellen sind in beiden Fällen gleich.

## v2.241 — 2026-07

### Verbesserungen
- **Gutachten „Technische Risiken": erst Entwurf, dann geschliffener Fließtext.** Der Abschnitt „Technische Risiken" sammelt die Risiken zunächst als Entwurf (einklappbar im Prüf-Panel sichtbar) und formuliert daraus einen zusammenhängenden Fließtext ohne Kurztitel — beschränkt auf die zentralen Risiken, die auf dem Lösungsweg des Vorhabens liegen und vom Vorhaben beeinflussbar sind. Externe, nicht beeinflussbare Risiken (z.B. Marktlage, Regulatorik) bleiben im finalen Text außen vor; bei mehr als drei Risiken werden die drei wichtigsten ausgewählt. Die Wortanzahl ist dabei nur noch ein Hinweis, kein blockierender Fehler.
- **Teilvorhaben-Titel auf einen Blick.** In der Verbund-Ansicht steht bei jedem Teilvorhaben jetzt direkt der Titel des Teilvorhabens unter dem Partner-Namen — man sieht sofort, was der jeweilige Partner im Projekt macht, ohne die Zeile erst aufklappen zu müssen.
- **Alle Teilvorhaben-Titel mit einem Klick kopieren.** Neben der Überschrift „Verbundpartner und Teilvorhaben" gibt es jetzt ein kleines Kopier-Symbol: Ein Klick legt alle Teilvorhaben-Titel als Textliste (ein Titel pro Zeile) in die Zwischenablage — praktisch, um sie in andere Dokumente zu übernehmen. Tragen alle Teilvorhaben denselben Titel, wird er nur einmal kopiert.
- **Sortierung und Filter bleiben in den Förderanträgen gemerkt.** Wie du die Liste sortierst (Klick auf eine Spaltenüberschrift) und welche Filter du gesetzt hast (Status, Antragstyp, PreCheck und die Filter in der Seitenleiste), bleibt jetzt beim nächsten Aufruf der Seite erhalten — auch nach einem Neuladen. Die Sicht-Tabs oben, die Gruppierung und die Spaltenbreiten wurden schon vorher gemerkt. (Der freie Suchtext startet weiterhin bewusst leer.)

## v2.240 — 2026-07

### Verbesserungen
- **Auslastungs-Widget: ein Balken statt zwei.** Aktuelles Quartal und Altanträge stehen jetzt in einem gemeinsamen Balken, von links nach rechts nach Alter sortiert: links die ältesten offenen Anträge (Q-3 bis 7, dunkelste Farbe), rechts das aktuelle Quartal (hellste Farbe). Das ist kompakter und liest sich als Zeitachse.
- **Widget-Einstellungen zeigen jetzt beide Spalten.** In Einstellungen › Darstellung ist die Liste der Startseiten-Widgets jetzt in „Hauptspalte" und „Seitenspalte" unterteilt — genau wie die Startseite selbst. So ist auf einen Blick klar, welches Widget in welcher Spalte steht, und die Hoch/Runter-Pfeile sortieren jede Spalte für sich (kein wirkungsloses Verschieben mehr über die Spaltengrenze hinweg).

## v2.239 — 2026-07

### Verbesserungen
- **Notizen griffbereit unten rechts.** Das Notizen-Feld steht standardmäßig am unteren Ende der rechten Spalte, damit du schnell etwas festhalten kannst — du kannst es bei Bedarf aber weiterhin in den Einstellungen verschieben. Der Hinweis heißt jetzt klarer „Nur lokal gespeichert, nie im Team Bereich".
- **Auslastungs-Widget aufgeräumt.** Es startet eingeklappt (klappt bei Bedarf auf) und zeigt die Zahlen zu den Altanträgen jetzt direkt in den farbigen Balken, wie im Auslastungs-Modul — jetzt mit besser lesbarem Kontrast. Die Fußzeile mit dem Vorquartals-Vergleich und dem „Zum Cockpit"-Link ist weggefallen; das Widget ist damit kompakter. Die Belegungs-Prozentzahl steht jetzt nur noch einmal (nicht mehr doppelt im Kopf und im Balken).
- **AI-Assistent kompakter.** Status und „Verbinden" stehen auf einer Zeile; der „Chat öffnen"-Link ist weg — den Assistenten öffnest du jetzt über das Symbol rechts am Bildschirmrand.
- Ein- und ausgeklappte Widgets bleiben pro Gerät gemerkt.

## v2.238 — 2026-07

### Verbesserungen
- **„Neue Anträge für dich" ist jetzt ein Widget.** Der Bereich mit passenden offenen Anträgen zum Selbst-Übernehmen sieht jetzt aus wie die anderen Startseiten-Karten (Rahmen, Ein-/Ausklappen) und lässt sich in Einstellungen › Widgets ein-/ausblenden und verschieben. Hinweis: Nach diesem Update ist er zunächst ausgeblendet — einmal in den Einstellungen auf „Sichtbar" stellen, dann ist er wieder da.

## v2.237 — 2026-07

### Verbesserungen
- **Startseite: mehr Platz für den Kanban.** Zwischen der breiten Hauptspalte und der schmalen rechten Spalte gibt es jetzt einen Zieh-Griff: einfach nach rechts ziehen, dann wird die Hauptspalte breiter und der Kanban zeigt mehr Spalten statt „+ N weitere". Die eingestellte Breite bleibt auf diesem Gerät gemerkt; Doppelklick setzt sie zurück.
- **Aufgeräumte Widget-Köpfe.** Der Bearbeiten-Stift erscheint nur noch bei Widgets, die sich wirklich einstellen lassen (Kanban und Antragseingang) — bei allen anderen ist er weg, statt ein leeres „keine Einstellungen"-Fenster zu öffnen. Außerdem ragt der Stift in der schmalen rechten Spalte nicht mehr über den Kartenrand hinaus. Und im Antragseingang-Widget stehen die kleinen Zähler-Punkte im Kopf nur noch im eingeklappten Zustand — aufgeklappt stehen die gleichen Zahlen ja schon in den Zeilen darunter.
- **Kompaktere Widget-Karten.** Die Karten auf der Startseite haben oben und unten etwas weniger Luft — so passt mehr auf einen Blick auf den Bildschirm, ohne dass es gedrängt wirkt.

## v2.236 — 2026-07

### Verbesserungen
- **Einstellungen ohne Scrollen:** Unter „Darstellung & Bedienung" lassen sich „Tastatur Shortcuts" und „Widgets auf der Startseite" jetzt auf- und zuklappen. Die lange Shortcut-Liste ist standardmäßig eingeklappt und steht direkt unter dem Erscheinungsbild, sodass die Widgets sofort im Blick sind — und die Widget-Liste selbst ist kompakter. Der aufgeklappte/zugeklappte Zustand bleibt gemerkt.

## v2.235 — 2026-07

### Bugfixes
- **Befehlspalette bleibt jetzt offen:** Mit Strg+K öffnest du die Schnellsuche für Aktionen — bisher klappte sie manchmal sofort wieder zu. Das ist behoben; geschlossen wird über Esc, einen Klick daneben oder eine Auswahl.

### Verbesserungen
- **Aufgeräumte Einstellungen:** „KI-Assistent" heißt jetzt „Interne KI". Der Entwickler-Bereich „Assistent & Gedächtnis" ist in „Mein Profil" umgezogen — ein Menüpunkt weniger.
- **Mehr Tastatur-Kürzel:** Strg+Umschalt+H springt zur Startseite, +F zu den Förderanträgen, +E zu den Einstellungen. Die anzeigten Kürzel in der Befehlspalette stimmen jetzt mit der Wirklichkeit überein.
- **Klarere Texte & mehr Ruhe:** Die langen Erklärungen zu „Thinking" und „Kontextfenster" sind kurz gefasst — das Detail steckt hinter dem kleinen „i". Die Speicherorte stehen luftiger, und die Startseiten-Widgets sind deutlicher vom Erscheinungsbild abgesetzt.

## v2.234 — 2026-07

### Neu
- **Registry-Änderungen auf der Startseite (nur Kurator):** Ein neues Widget zeigt Kurator:innen die jüngsten Änderungen an Skills und Regeln — neu, geändert, aktiviert oder deaktiviert, jeweils mit Zeitpunkt. Eine feste Erinnerung im Fuß hält den wichtigsten Grundsatz vor Augen: Aktivierungen wirken sofort für alle Varianten.

## v2.233 — 2026-07

### Neu
- **QS-Freigaben auf der Startseite:** Ein neues Widget sammelt alle Gutachten-/Artefakt-Entwürfe, die fertig generiert sind, aber noch auf deine Freigabe warten — mit „Entwurf seit N Tagen" und dem Regel-Status. Steht alles auf grün, führt „Freigeben →" direkt zum Artefakt; sonst „Prüfen →". Freigegeben wird weiterhin nur im Artefakt selbst, nie im Widget.

## v2.232 — 2026-07

### Neu
- **Auslastung auf der Startseite:** Ein neues Widget zeigt deine Quartals-Belegung auf einen Blick — belegt/frei in TVs, offene Altanträge nach Alter und der Vergleich zum Vorquartal. Führst du ein eigenes Kürzel, siehst du deine Zahlen; als Projektleitung („alle") das Team-Aggregat inkl. „N von M über 100 %". Nur dort verfügbar, wo das Auslastungs-Modul aktiv ist.

## v2.231 — 2026-07

### Neu
- **Feedback-Neuigkeiten auf der Startseite:** Ein neues Widget zeigt auf einen Blick, was sich seit deinem letzten Besuch im Feedback getan hat — Antworten des Teams auf deine Tickets, neue Ideen/Probleme von Kolleg:innen und wenn deine Vorschläge Stimmen bekommen. „Alles gelesen" setzt den Zähler zurück; ein Klick führt zum Feedback-Board. Einschalten in den Widget-Einstellungen.

## v2.230 — 2026-07

### Neu
- **Feedback als Kanban auf der Startseite:** Das Kanban-Widget kann jetzt statt der Förderanträge auch das Team-Feedback anzeigen — bunte Spalten nach Status (Neu, In Bearbeitung, Geplant, Umgesetzt …). Ein Klick auf eine Karte öffnet das passende Ticket direkt im Feedback-Board. Umschalten in den Widget-Einstellungen unter „Quelle".

### Verbesserungen
- **Wessen Zahlen sind das?** Die Widgets „Anträge — Kanban", „Meine Anträge" und „Antragseingang" zeigen jetzt in der Kopfzeile, ob sie deine eigenen Anträge („Kürzel THU") oder alle Bearbeiter zusammen zeigen — so liest man Team-Zahlen nicht mehr versehentlich als die eigenen.

## v2.229 — 2026-07

### Neu
- **Startseite anpassen:** Über den Stift am Widget-Kopf oder die neue Einstellungs-Sektion „Widgets auf der Startseite" (Darstellung & Bedienung) kannst du Widgets umsortieren, ein-/ausblenden und einstellen — z.B. das neue Kanban einschalten, seine Spalten und Farben wählen. Alles gilt nur für dein Gerät.
- **Notizen-Widget:** Ein einfacher Notizzettel für die Startseite — nur lokal auf deinem Gerät, landet nie im geteilten Datenordner.

### Verbesserungen
- **Antragseingang-Ampel:** Die Warn- und Kritisch-Schwellen (bisher fest 30/90 Tage) sind jetzt einstellbar, und ein Klick auf eine Ampel-Zeile öffnet direkt die passend gefilterte Antragsliste (mit sichtbarem, entfernbarem Filter-Chip). Die farbigen Punkte in den Listenzeilen behalten ihre gewohnten Stufen.

## v2.228 — 2026-07

### Neu
- **Kanban-Ansicht für Anträge auf der Startseite (Vorschau):** Ein neues Widget zeigt deine Förderanträge als Board mit farbigen Spalten je Bearbeitungsphase — mit kompakten Karten (Akronym, nächster Schritt, Eingangsalter) und Klick direkt in den Antrag. Wahlweise bunt oder in Abstufungen deiner Akzentfarbe, als Datenbasis auch ein gespeicherter Filter. Das Widget ist zunächst ausgeblendet; einschalten lässt es sich mit der Einstellungs-Seite der nächsten Version.

## v2.227 — 2026-07

### Neu
- **Startseite als Widgets:** Die Bereiche der Startseite (Weitermachen, Meine Anträge, Antragseingang, AI-Assistent) sind jetzt eigenständige Karten mit einheitlichem Kopf — jede lässt sich per Klick auf den Pfeil ein- und ausklappen. Eingeklappt bleibt eine kompakte Zeile mit den wichtigsten Zahlen sichtbar (z.B. die drei Ampel-Werte beim Antragseingang).

### Verbesserungen
- Inhalte und Reihenfolge der Startseite bleiben unverändert — nur der Rahmen ist neu. Das Umsortieren und Ein-/Ausblenden der Widgets folgt in einer der nächsten Versionen.

## v2.226 — 2026-07

### Verbesserungen
- **Unter der Haube:** Vorbereitung für die anpassbare Startseite — künftig lassen sich die Startseiten-Bereiche (Widgets) umsortieren, ein- und ausblenden. Sichtbar wird das in den nächsten Versionen; an der Startseite ändert sich in dieser Version noch nichts.

## v2.225 — 2026-07

### Neu
- **Kompakte Ansicht im Feedback-Board:** Ein neuer Knopf rechts neben dem Listen-/Board-Umschalter schaltet auf eine dichtere Darstellung — mehr Einträge auf einen Blick, in der Liste wie im Board. Die Wahl merkt sich die App auf deinem Gerät.

### Verbesserungen
- **Feedback-Board mit farbigen Spalten:** Die Board-Spalten haben jetzt eigene Farben und Symbole (Neu · Abgelehnt · Geplant · In Bearbeitung · Umgesetzt) — der Stand eines Beitrags ist auf einen Blick erkennbar. Die Karten sind aufgeräumter: Typ-Farbkante, Titel, optionales Vorschaubild und unten Autor, Kommentare und Punkte.
- **Lob hat einen festen Platz in der Liste:** Lob durchläuft keinen Bearbeitungs-Workflow und taucht deshalb nicht mehr als eigene Board-Spalte auf — du findest es weiterhin in der Listenansicht (Typ-Filter „Lob").

## v2.224 — 2026-07

### Neu
- **Persönliches Gedächtnis für den Assistenten (Vorschau, nur Entwicklungsversion):** Der Assistent kann sich jetzt — wenn du es aktivierst — wenige, knappe Notizen über deine Arbeit merken (woran du gerade arbeitest, bevorzugte Abläufe, offene Fäden). Ein Hintergrundlauf fasst dein Arbeitsprotokoll gelegentlich zusammen; die Notizen sind in den Einstellungen einsehbar, einzeln oder komplett löschbar, und fließen als „Hintergrundwissen" in die Antworten des Assistenten ein. Die Auswertung läuft ausschließlich über die **interne** KI vor Ort — nichts verlässt dein Gerät ins Internet. Doppelte Zustimmung nötig (erst Arbeitsprotokoll, dann Gedächtnis), jederzeit abschaltbar. Zunächst nur in der Entwicklungsversion.

## v2.223 — 2026-07

### Verbesserungen
- **Unter der Haube — bessere Qualitätsprüfung der KI-Bausteine (nur Entwicklungsversion):** Das interne Test-Werkzeug für die Antrag-Aufbereitung kann seine Übungsläufe jetzt zusätzlich gegen ein starkes Vergleichs-Modell fahren. So lässt sich sauber unterscheiden, ob ein schwaches Ergebnis an unserer Software liegt oder an den Grenzen des internen KI-Modells. Dabei werden ausschließlich fiktive Übungs-Anträge verwendet — echte Antragsdaten sind technisch ausgeschlossen. Für dich ändert sich im Alltag nichts.

## v2.222 — 2026-07

### Neu
- **Assistent-Panel (Vorschau, nur Entwicklungsversion):** Ein neues Panel rechts beantwortet Fragen zu deiner aktuellen Arbeit — „Was ist mein nächster Schritt?", „Welche Fristen stehen an?", „Was steht im Antrag zu Thema X?". Es sieht nur die gerade geöffnete Ansicht und die zugehörigen Dokumente (oben transparent als Kontext angezeigt) und antwortet ausschließlich über die **interne** KI — Antragsinhalte verlassen das Haus nie. Es merkt sich nichts über die Sitzung hinaus. Kommt als Probelauf zunächst nur in der Entwicklungsversion.

## v2.220 — 2026-07

### Verbesserungen
- **Unter der Haube — Grundstein für einen persönlichen Assistenten:** In der Entwicklungsversion kann jetzt optional ein rein lokales Arbeitsprotokoll geführt werden (welche Anträge und Dokumente geöffnet, was gesucht wurde) — als Basis für einen späteren persönlichen Assistenten. Standardmäßig aus, jederzeit ein- und ausschaltbar und vollständig löschbar; die Daten bleiben ausschließlich auf dem eigenen Gerät und gehen nie an eine KI oder aufs Laufwerk. Für dich ändert sich im Alltag nichts.

## v2.214 — 2026-07

### Verbesserungen
- **Unter der Haube — sauberer KI-Kontext:** Werkzeuge, die die interne KI nutzen (z. B. Gutachten-Entwürfe), starten den KI-Chat jetzt vor jedem Lauf automatisch frisch. So kann kein alter Gesprächsverlauf mehr das Ergebnis verfälschen; klappt das Zurücksetzen einmal nicht, weist ein Hinweis darauf hin. Für dich ändert sich im Alltag nichts.

## v2.213 — 2026-07

### Verbesserungen
- **Lesezeichen leichter erkennbar:** In den Einstellungen (KI-Tab) sieht der „Interne KI"-Knopf, den man in die Lesezeichenleiste zieht, jetzt wie ein ziehbares Lesezeichen aus (mit Greif-Punkten) statt wie ein normaler Klick-Knopf — so ist klarer, dass man ihn hinaufziehen und nicht anklicken soll.
- **Unter der Haube:** Ein neues internes Prüf-Werkzeug hilft dem Team, die KI-gestützte Antrag-Aufbereitung vor der Freischaltung zu testen. Für dich ändert sich sichtbar nichts.

## v2.212 — 2026-07

### Verbesserungen
- **Ruhigere Statusanzeige der internen KI:** Im KI-Tab zeigt die kleine Anzeige unten rechts jetzt nur noch **eine** dezente Status-Pill statt drei nebeneinander. Sie durchläuft kurz die Prüfungen und ruht dann auf „Verbunden"; ein Klick darauf prüft die Verbindung erneut. Sie sitzt außerdem etwas weiter links, damit Chromes Bildschirmfreigabe-Hinweis sie nicht mehr überdeckt. Hinweis: Das Lesezeichen muss dafür einmal neu installiert werden (aus den Einstellungen erneut in die Lesezeichenleiste ziehen).

## v2.211 — 2026-07

### Neu
- **Dein Rückstand auf einen Blick auf der Startseite:** Über „Meine Anträge" siehst du jetzt einen kleinen Balken, der deine offenen Anträge nach Alter aufteilt — „Ab Q-3 · Q-2 · Q-1 · aktuelles Quartal". So erkennst du sofort, wie viele Altlasten sich angesammelt haben. Wenn du mit der Maus über ein Segment fährst, klappt eine Liste der konkreten Anträge dieses Quartals auf (Förderkennzeichen, Akronym, Status, Datum, TVs) — genau wie im Auslastungs-Modul. Ein Klick auf „Zu meinen Anträgen →" bringt dich direkt in die nach Frist sortierte Liste.

### Verbesserungen
- **Einstellungen aufgeräumt:** Der Menüpunkt „Profil" heißt jetzt „Mein Profil", und der „KI-Assistent" steht im Bereich „System" nun an letzter Stelle.

## v2.210 — 2026-07

### Neu
- **Sponsoring direkt auf den Feedback-Karten:** Bei Ideen und Verbesserungen siehst du jetzt schon in der Liste, wie viele Punkte gesammelt sind und wie nah ein Vorschlag am Ziel ist („X/Y Pkt · N Sponsoren", grün bei „Ziel erreicht"). Sponsern selbst geht wie gewohnt im Detail — dort mit großer Anzeige, +/−-Knöpfen und deinem Rest-Budget.
- **Fortschritt auf einen Blick:** Jedes Feedback zeigt jetzt seinen Stand als kleine Schritt-Anzeige (Neu → Geplant → In Bearbeitung → Umgesetzt); im Detail als voller Fortschritts-Balken. Bei deinen eigenen Beiträgen ist die Schritt-Anzeige direkt in der Liste.
- **Du wirst benachrichtigt, wenn das Team antwortet:** Oben erscheint eine Glocke mit der Zahl neuer Antworten auf deine Feedbacks — ein Klick bringt dich direkt zu „Von mir". Beantwortete Beiträge sind mit „Antwort" markiert, und in der Sicht „Von mir" siehst du eine kleine Fortschritts-Übersicht deiner Beiträge.

### Verbesserungen
- **Übersichtlichere Karten:** Statt vieler Textzeilen zeigt jede Karte nur noch Titel und eine kurze Vorschau — schneller zu überfliegen. Details stehen weiterhin im aufklappbaren Bereich rechts.
- **Bessere Filter und Sortierung:** Neue Sortierungen (u. a. „Meiste Punkte" und „Kurz vor dem Ziel") und ein Status-Filter. Die Sichten „Alle / Von mir / Vom Team" sind jetzt deutlicher als Umschalter gestaltet.
- **Aufgeräumtes Board (Kanban):** eigene „Lob"-Spalte, und leere Spalten schrumpfen platzsparend zu einer schmalen Leiste.

## v2.209 — 2026-07

### Neu
- **„Weitere passende Anträge" auf der Startseite:** In „Neue Anträge für dich" gibt es jetzt einen Knopf, der dir auch Anträge zeigt, bei denen du nicht der erste Vorschlag bist — praktisch, wenn in deinem Hauptgebiet gerade nichts frei ist. Jeder dieser Anträge zeigt deine persönliche „Passung", damit du siehst, wie gut er zu dir passt.

### Verbesserungen
- **Mehr Anträge direkt einblenden:** „Neue Anträge für dich" lässt sich jetzt Schritt für Schritt („+10 mehr anzeigen") aufklappen, statt in einem separaten Fenster — genau wie „Meine Anträge" darüber.
- **Details beim Darüberfahren:** Fahre mit der Maus über einen Antrag, um den vollen Verbund- und Teilvorhaben-Titel, den Antragsteller und das Eingangsdatum zu sehen — so kannst du besser einschätzen, ob er für dich passt.

### Bugfixes
- **„Weitere passende Anträge" klappt nicht mehr zu:** Wenn du bei den weiteren Anträgen auf „Kann ich übernehmen" geklickt hast, klappte die Liste bisher jedes Mal zusammen und musste neu geöffnet werden. Jetzt bleibt sie offen, und der übernommene Antrag wird direkt als „Vorgemerkt" markiert.

## v2.208 — 2026-07

### Verbesserungen
- **Feedback wieder direkt in der Seitenleiste:** „Feedback" ist wieder ein eigener Menüpunkt (oben im Arbeitsbereich); das kleine Sprechblasen-Symbol unten in der Leiste ist dafür entfallen. Feedback geben geht weiterhin über den Knopf unten rechts.
- **Auslastung an neuer Stelle:** steht jetzt direkt unter „Förderanträge" (vor „E-Mail Anfragen").
- **Klarere Schreibweise:** der Menüpunkt heißt jetzt **„E-Mail Anfragen"**.
- **Aufgeräumte Seitenleiste:** das Globus-Symbol bei „Skill-Verwaltung" ist entfernt, und das Ein-/Ausklapp-Symbol zeigt jetzt eindeutig, in welche Richtung es klappt.
- **Eingeklappte Leiste:** die farbigen Status-Punkte (Sync / CSV / KI) sitzen enger beieinander; der Tooltip beim Darüberfahren bleibt.

## v2.207 — 2026-07

### Verbesserungen
- Im Modul **Auslastung** heißt der letzte Tab jetzt **„Verwaltung"** (vorher „Einstellungen" — das ließ sich leicht mit deinen persönlichen App-Einstellungen verwechseln).
- Der Knopf **„Passwörter für alle aktiven MAs"** sitzt jetzt in der **Verwaltung** direkt bei der zugehörigen E-Mail-Vorlage — Passwörter erzeugen/versenden und die Vorlage anpassen liegen damit an einem Ort.

### Bugfixes
- Wenn du dein Feedback **per KI verbessern** lässt, kommt jetzt auch wirklich die verbesserte Fassung beim Team an — vorher wurde in manchen Fällen noch dein ursprünglicher Text übermittelt.

## v2.206 — 2026-07

### Verbesserungen
- **Feedback mit KI verbessern — jetzt ein geführter Ablauf mit der internen KI:** Wenn du „Feedback speichern & verbessern" wählst, stellt die interne KI dir 1–3 kurze Rückfragen, formt daraus eine klare, vollständige Fassung samt umsetzbarer Anforderung und zeigt sie dir zum Anpassen. Du bearbeitest sie und speicherst — dein ursprünglicher Text bleibt erhalten. Die früheren zwei getrennten Funktionen („verbessern" und „Details ergänzen") sind damit zu einem Schritt zusammengefasst.

### Bugfixes
- Die **KI-Verbesserung von Feedback** funktioniert jetzt zuverlässig mit der **internen KI** (vorher kam oft eine Antwort, aber kein Ergebnis).
- „Details ergänzen" verlangt **nicht mehr OpenRouter** — es läuft jetzt über die interne KI wie erwartet.

## v2.205 — 2026-07

### Neu
- In der Tabelle **Auslastung MA** zeigt der **Rückstands-Balken** jetzt beim Überfahren mit der Maus eine kleine Liste der konkreten Anträge dieses Zeitraums (Akronym, Status, Datum, TVs) — so sieht man auf einen Blick, welche Altanträge hinter dem Balken stecken, ohne die Zeile aufzuklappen.

## v2.204 — 2026-07

### Bugfixes
- In der Tabelle **Auslastung MA** sitzen die beiden Balken (Rückstand und aktuelles Quartal) jetzt exakt auf gleicher Höhe nebeneinander.

## v2.203 — 2026-07

### Neu
- **Zweites internes KI-Modell (Erprobung):** Die interne KI hat einen neuen Reiter „Agentischer Chat" mit einem anderen Modell. Die Verbindung kann jetzt gezielt einen der beiden Chats ansprechen — zunächst als Test-Funktion für Entwickler, später z. B. für Qualitätssicherung oder eine Zweitmeinung.

### Verbesserungen
- **Interne KI hält jetzt auch lange Antworten durch:** Wenn der KI-Server stark ausgelastet ist und eine Antwort mehrere Minuten dauert, wartet die App mit, solange die KI erkennbar arbeitet — statt vorzeitig mit „Zeitüberschreitung" abzubrechen.
- Die kleine **Status-Leiste im KI-Tab** sitzt jetzt **unten rechts** (dort verdeckt sie nichts und wird nicht mehr von der KI-Oberfläche überlagert) und stellt sich selbst wieder her, wenn die KI-Seite sich umbaut.
- Die Antwort-Erkennung übersteht jetzt auch Oberflächen-Änderungen der KI-Seite besser (zweites Erkennungs-Verfahren als Reserve).

### Wichtig
- **Bitte das Lesezeichen „Interne KI" einmal neu einrichten** (Einstellungen → KI-Assistent → Interne KI): das alte Lesezeichen kennt die Verbesserungen noch nicht.

## v2.200 — 2026-07

### Neu
- Die **Einstellungen** haben ein neues, aufgeräumtes Layout: statt einer langen Reiter-Leiste gibt es jetzt links eine **Navigation** mit den Gruppen **Persönlich** (Profil, Meine Technologien) und **System** (Darstellung & Bedienung, KI-Assistent, Daten & Verbindungen).
- **Einstellungs-Suche:** Oben in der Navigation nach jeder Einstellung suchen (oder **Strg + Komma** drücken) — die App springt direkt zum passenden Abschnitt und hebt ihn kurz hervor. Auch die alten Reiter-Namen („Speicher", „Online", „Tastatur" …) werden gefunden.

### Verbesserungen
- Verwandte Einstellungen sind zusammengelegt: **Tastatur-Kürzel** stehen jetzt bei „Darstellung & Bedienung", und **Speicher, Dokumentenquellen, Tags und Team-Status** (früher „Online") unter „Daten & Verbindungen".
- Beim **Datenordner** sitzen „Letzter Import" und **„Jetzt aktualisieren"** direkt in der Zeile — kein separater Abschnitt mehr.
- Lange Erklärtexte stecken jetzt hinter kleinen **ⓘ-Symbolen**, sodass die Seite ruhiger wirkt.
- Das **Feedback-Board** ist weiter verfeinert: Suche, Sortierung und Ansichts-Umschalter sitzen jetzt aufgeräumt neben den Typ-Filtern, die **Karten sind kompakter** (kurze Frage/Antwort-Paare stehen nebeneinander), und die **Board-Spalten** grenzen sich klarer voneinander ab. **Lob** erscheint nur noch in der Listen-Ansicht.

## v2.199 — 2026-07

### Neu
- Das **Feedback-Board** ist komplett neu gestaltet: übersichtliche Karten mit **Titel**, Typ-Symbol, Status und Bild-Vorschau statt langer Textblöcke. Oben umschaltbar zwischen **„Alle / Von mir / Vom Team"**, mit **Suche**, **Sortierung** (Neueste ↔ Meiste Stimmen) und einer neuen **Board-Ansicht** (Spalten nach Bearbeitungs-Status).
- **Stimmen (Daumen hoch):** Für ein Feedback abstimmen zeigt dem Team, wie gefragt es ist — unabhängig vom bisherigen Sponsoring, das erhalten bleibt.
- **Kommentare:** Zu jedem Feedback lässt sich jetzt ein Gespräch führen — Rückfragen stellen, ergänzen, mitdiskutieren.
- Beim **Feedback-Geben** kann optional ein kurzer **Titel** vergeben werden (sonst wird er automatisch aus der Antwort abgeleitet).
- Beim **Feedback-Geben** lassen sich jetzt auch **Dateien anhängen** (PDF, Word, Excel, PowerPoint, CSV, TXT, MD — z. B. ein erläuterndes Dokument oder eine Tabelle), zusätzlich zu Screenshots. Sie erscheinen im Detail als Download.

## v2.198 — 2026-07

### Verbesserungen
- Die **Feedback-Übersicht** ist übersichtlicher: In der Vorschau steht jetzt **jede Frage mit ihrer Antwort auf einer eigenen Zeile** (Frage fett) statt alles in einer langen Zeile hintereinander. Das Kennzeichen **„Dein Feedback" sitzt jetzt ganz links**.
- Die **Antragsliste neben dem geöffneten Detail** ist jetzt **nach Verbund gruppiert**: Statt jedes Teilvorhaben einzeln aufzuführen, steht pro Verbund nur noch ein Eintrag (mit der Anzahl seiner Teilvorhaben). Ein Klick öffnet den Verbund — die Teilvorhaben stehen dann übersichtlich im Detail.
- Die **Detailseite eines Antrags** wurde aufgeräumt: Die Kurzbeschreibung steht wieder als eigene Karte ganz oben, die Eckdaten (Programm, Antragsdatum …) stehen kompakt in der Titelzeile, und das Gutachten ist als **ein** zusammenhängender Bereich nach oben gewandert — Fortschrittsbalken und „Weiter bei …" bleiben erhalten.
- Doppelte Angaben sind raus: Die Verbundpartner erscheinen nur noch einmal (in der Teilvorhaben-Liste), und die überflüssige Rückzeile über dem Gutachten wurde entfernt.

### Bugfixes
- Bei manchen Verbünden fehlte die **Kurzbeschreibungs-Karte** auf der Detailseite — unter dem Titel stand nur eine kurze Zeile. Jetzt wird die Kurzzusammenfassung zuverlässig über alle Teilvorhaben gefunden und immer als Karte angezeigt.
- Der **obere Bereich der Detailseite** (Titel, Untertitel, Fortschritt, Kurzbeschreibung) hat jetzt mehr Luft zwischen den Zeilen und wirkt weniger gedrängt.

## v2.197 — 2026-07

### Verbesserungen
- In der **Mitarbeiter-Übersicht** der Auslastung („Auslastung MA") lässt sich die Grenze zwischen den beiden Balken „Altlasten" und „Aktuelles Quartal" jetzt **mit der Maus verschieben** — die Trennlinie im Spaltenkopf greifen und ziehen, wenn die Altlasten-Spalte schmaler sein soll. Die Einstellung bleibt erhalten; ein Doppelklick auf die Trennlinie setzt sie zurück.
- Der **Rückstands-Balken** („Altlasten") liest sich jetzt chronologisch von links nach rechts — die ältesten Quartale ganz links und in der **kräftigsten Farbe**, das jüngste rechts und am hellsten.

## v2.196 — 2026-07

### Verbesserungen
- Die **Mitarbeiter-Übersicht** in der Auslastung („Auslastung MA") zeigt Auslastung und Rückstand jetzt in **zwei getrennten Balken nebeneinander**: Die aktuelle Quartals-Auslastung ist dadurch zwischen Mitarbeitern direkt vergleichbar, der aufgelaufene Rückstand („Altanträge") steht daneben. Die Rückstands-Farben wechseln von Gelb/Orange/Rot zu einer ruhigen Blau-Abstufung (dunkel = neu, hell = alt), damit sie nicht mehr mit den Status- und Kategorie-Farben verwechselt werden. Überbuchte Mitarbeiter bleiben am roten Balken erkennbar.

## v2.195 — 2026-07

### Verbesserungen
- In der **Auslastung** (Anträge zuweisen) fließt die inhaltliche Ähnlichkeit jetzt wieder in die **Reihenfolge der Mitarbeiter-Vorschläge** ein, wenn die reine Stichwort-Übereinstimmung dünn ist. Bei klaren Stichwort-Treffern bleibt die Reihenfolge wie gewohnt; bei schwacher Stichwortlage rücken thematisch passende Mitarbeiter nach oben. Bitte im Blick behalten und Bescheid geben, falls Vorschläge unpassend wirken.

## v2.194 — 2026-07

### Bugfixes
- In der **Auslastung** (Anträge zuweisen) werden unter jedem Mitarbeiter wieder die **ähnlichen früheren Projekte** angezeigt. Seit dem Quartalswechsel stand dort bei allen Mitarbeitern „keine ähnlichen Projekte", obwohl die Passung korrekt berechnet wurde — das ist behoben. Die Reihenfolge der Vorschläge ändert sich dadurch nicht.
- In der **Suche** passt sich die Trefferliste jetzt der verfügbaren Breite an: Ziehst du den **Assistenten** rechts weit auf, werden die Tabellenspalten schmaler und bleiben sichtbar — statt dass sofort ein waagerechter Rollbalken erscheint und die rechten Spalten (Status, Bewertung …) abgeschnitten werden. Erst wenn es wirklich eng wird, taucht der Rollbalken auf.

## v2.193 — 2026-07

### Verbesserungen
- Die **Suche** begrüßt dich jetzt mit einem hilfreichen Startbildschirm statt einer nüchternen Zahl: Er nennt, wie viele Anträge durchsuchbar sind, erklärt kurz die Suchfelder und bietet **anklickbare Beispiele**, die direkt eine Suche starten. Der Hinweis auf die (noch nicht eingerichtete) Volltextsuche in Dokumenten ist jetzt eine dezente Zeile am Rand — die Einrichtung ist Sache der Kuratoren, nicht deine.

## v2.192 — 2026-07

### Verbesserungen
- Im Einstellungen-Tab **„Meine Technologien"** sehen alle Auswahl-Chips (Kategorien, ergänzende Erfahrungen, Antragstypen, erkannte Themen) jetzt einheitlich aus: Ausgewählte sind gefüllt und mit einem Häkchen markiert, nicht ausgewählte als schlichte Umrandung — **nichts wird mehr durchgestrichen**, gesperrte Chips sind klar erkennbar mit Erklärung beim Draufzeigen. Bei „Aus deinen bisherigen Anträgen" zeigt der Kopf, **wie viele Themen gewählt** sind, und lange Listen werden auf die wichtigsten gekürzt („+ N weitere" zum Aufklappen — Ausgewähltes bleibt immer sichtbar).

## v2.191 — 2026-07

### Verbesserungen
- **Frisches Erscheinungsbild:** Der Arbeitsbereich „schwebt" jetzt als weißes Blatt mit sanften Ecken über einer dezent grauen Grundfläche, auf der die Seitenleiste liegt. Dadurch sind Navigation und Arbeitsbereich klarer voneinander getrennt und die App wirkt aufgeräumter — ohne dass sich an den Inhalten oder der Bedienung etwas ändert. Der aktuell geöffnete Menüpunkt ist als kleine helle Kachel markiert. Gilt in allen Bereichen und funktioniert auch im dunklen Modus.
- In der **Auslastung** (Tab „Auslastung MA") ist der Altanträge-Balken jetzt so herum gestapelt, dass die **ältesten Anträge links liegen** (rot = am dringendsten), gefolgt von orange und gelb. Die Farben sind zudem etwas weicher und der Balken einen Tick kräftiger — insgesamt leichter auf einen Blick zu erfassen.
- Klappt man in der **Auslastung** eine Mitarbeiter-Zeile auf, sind „Auslastung pro Antragstyp" und „Aktuelle Buchung" jetzt in einer Karte zusammengefasst. Das Detail ist dadurch kompakter und man sieht mehr auf einen Blick, ohne zu scrollen.

## v2.190 — 2026-07

### Verbesserungen
- In der **Suche** lässt sich der **Assistent** rechts jetzt viel breiter ziehen. Bisher war bei einer festen Breite Schluss — jetzt können Sie ihn fast bis zum Fensterrand aufziehen, wenn Sie mehr Platz zum Lesen brauchen. Die Trefferliste bleibt dabei immer sichtbar.
- In der **Auslastung** (Tab „Auslastung MA") zeigt der Balken der **Altanträge** jetzt auf einen Blick, *wie dringend* sie sind: Er ist nicht mehr grau, sondern nach Alter eingefärbt — **Gelb** (letztes Quartal), **Orange** (vorletztes Quartal) und **Rot** (noch älter). Je röter, desto länger liegt der offene Antrag schon.
- Dabei werden jetzt auch **ältere offene Anträge** berücksichtigt (bis zu sieben Quartale zurück statt bisher nur zwei) — die Spalte „Altanträge" kann dadurch höhere Zahlen zeigen als vorher.

## v2.189 — 2026-07

### Neu
- Die **Feedback-Übersicht** ist wieder mit einem Klick aus der Seitenleiste erreichbar: Das Feedback-Symbol unten in der Seitenleiste öffnet jetzt direkt die Übersicht aller gemeldeten Punkte. Eigenes Feedback *geben* geht weiterhin über den runden Knopf unten rechts.
- Im Feedback-Board ist **dein eigenes Feedback hervorgehoben** (farbige Markierung + „Dein Feedback"-Kennzeichen) — so siehst du auf einen Blick den Bearbeitungs-Status deiner Tickets (z. B. „In Bearbeitung"). Neu ist außerdem der Filter **„Mein Feedback"**, der die Liste auf deine eigenen Meldungen einschränkt.

## v2.188 — 2026-07

### Verbesserungen
- Die KI nutzt jetzt standardmäßig das **volle Kontextfenster** des internen Sprachmodells (80.000 statt 62.000 Token). Vorhabensbeschreibungen, die vorher unnötig gekürzt wurden, werden jetzt **komplett** analysiert.
- Neu in **Einstellungen → KI-Assistent**: der Knopf **„Vom Server erkennen"** liest die tatsächliche Kontextgröße direkt vom laufenden Modell aus — kein Wert mehr, der von Hand nachgetragen werden muss.
- Ist ein Dokument **wirklich zu lang** fürs Kontextfenster, warnt die App jetzt schon **beim Hochladen/Konvertieren** (statt erst nach der Generierung) — mit dem klaren Hinweis, es außerhalb der App zu kürzen (z. B. Anhänge, Literaturverzeichnis, große Tabellen entfernen) und erneut hochzuladen.
- Beim Hochladen einer Vorhabensbeschreibung sieht man jetzt direkt, dass **eingebettete Bilder nicht mitgelesen** werden (sie enthalten keinen Text für die KI) und wie viele Tabellen als Text übernommen wurden.

### Bugfixes
- Die nachträgliche, große Warnung „…wurde gekürzt" ist einem **unaufdringlichen Hinweis** gewichen; die eigentliche Warnung kommt jetzt rechtzeitig beim Hochladen.

## v2.187 — 2026-07

### Verbesserungen
- Findet die Prüfung eine **beanstandete Formulierung** (z. B. eine Passiv-Floskel), gibt es jetzt daneben einen Link **„Anzeigen"** — ein Klick springt im Entwurf direkt zur betroffenen Stelle und hebt den Satz kurz hervor. Bei mehreren Stellen springen weitere Klicks reihum zur nächsten („Anzeigen (2)").

## v2.186 — 2026-07

### Verbesserungen
- Die **Prüfung** im Gutachten (rechte Spalte „Quelle & Prüfung") zeigt jetzt auf einen Blick, wie ernst ein Punkt ist: erfüllte Regeln mit grünem Haken, kleinere Hinweise mit gelbem Punkt und **echte Fehler als rote Karte** mit dem gemessenen Wert und dem Limit (z. B. „1117 / 1000 Zeichen"). Die Kopfzeile fasst zusammen: „1 Fehler · 1 Hinweis".
- Bei einem Fehler gibt es direkt einen Knopf **„Mit KI kürzen/erweitern/korrigieren"** — ein Klick startet eine gezielte Überarbeitung genau in die richtige Richtung (mit konkretem Zielwert), und die Prüfung aktualisiert sich anschließend von selbst. Die vorherige Fassung bleibt über den Versionsverlauf erhalten. Stilfragen (z. B. Passiv-Floskeln) bekommen bewusst **keinen** Auto-Knopf — die entscheiden Sie selbst.
- Wenn die KI gerade **nicht erreichbar** ist, steht dort jetzt ein freundlicher Hinweis „Offline: manuell bearbeiten und prüfen weiter möglich." statt einer Warnung — die Prüfung und das manuelle Bearbeiten funktionieren offline unverändert weiter.

## v2.183 — 2026-07

### Verbesserungen
- Die **fertige Antwort** im Modul „Anfragen" lässt sich jetzt **mit Formatierung** kopieren: fette Überschriften und Absätze bleiben erhalten, wenn Sie sie in Outlook einfügen — statt der rohen `**`-Zeichen wie bisher. Ein kurzer **Haken** am Knopf bestätigt, dass kopiert wurde.
- Neuer Knopf **„Kopieren & Mail öffnen"**: kopiert die formatierte Antwort und öffnet in einem Schritt einen bereits adressierten Mail-Entwurf an den Absender (Betreff „Re: …") — Sie fügen nur noch mit Strg+V ein. Die frühere Meldung „Antwort zu lang für Direkt-Mail" entfällt damit.
- Der selten genutzte Knopf **„Vor dem Einsetzen intern glätten"** wurde entfernt — die Antwort wird direkt und zuverlässig mit den Originaldaten befüllt.

## v2.182 — 2026-07

### Verbesserungen
- Wenn Sie einen Antrag öffnen, wird die Liste daneben jetzt zu einer **schlanken Kompakt-Spalte** statt einer zusammengequetschten Tabelle: eine Zeile pro Antrag mit farbigem Fristpunkt, Kurzname und relativer Frist. Der gerade geöffnete Antrag ist deutlich hervorgehoben, und ein kleines **Filter-Feld** oben durchsucht schnell nur die sichtbare Liste. So behalten Sie beim Bearbeiten den Überblick und springen mit einem Klick zum nächsten Antrag. Beim Schließen des Details kehrt die volle Tabelle **an genau der Stelle** zurück, an der Sie waren.

## v2.181 — 2026-07

### Verbesserungen
- Die **Verbund-Detailseite** zeigt jetzt direkt unter dem Kopf **Fortschritts-Karten** für Gutachten und Nachforderung: auf einen Blick, wie viele Abschnitte freigegeben bzw. wie viele Teilvorhaben versendet sind, mit Sprung-Button direkt in die Bearbeitung. Karten erscheinen nur, wenn das jeweilige Thema für den Antrag relevant ist — keine leeren Platzhalter. Die Nachforderungs-Karte zeigt zusätzlich die Frist.
- Die **Datenbereiche** (Antragsdaten & Verbundpartner, Teilvorhaben, Alle Felder, Historie) sind jetzt **eingeklappte Zeilen** mit einer kurzen Vorschau rechts (z. B. „Symate GmbH · 2 weitere" oder „zuletzt 22.06."). So passt die ganze Seite kompakt auf einen Blick; jeder Bereich lässt sich bei Bedarf aufklappen. Einmal gewählte Auf-/Zu-Zustände bleiben erhalten.

## v2.180 — 2026-07

### Verbesserungen
- Der **Kopf der Verbund-Detailseite** ist aufgeräumt: oben Kurzname und Kennzeichen, eine kurze Projektbeschreibung (auf Wunsch per „… mehr" ausklappbar) und die wichtigsten Eckdaten (Programm/Typ, Anzahl Teilvorhaben, Antragsdatum, beantragte Summe) auf einen Blick.
- Der **Fortschritts-Balken (Eingang → Vollständigkeit → Fachprüfung → Bewilligung → Schluss)** zeigt jetzt zuverlässig den **richtigen** Stand — auch bei älteren, bereits abgeschlossenen Anträgen (vorher standen die oft fälschlich ganz am Anfang). Abgelehnte oder zurückgezogene Anträge sind mit einem roten ✕ an der Abbruchstelle klar erkennbar. Der Fortschritts-Balken ist damit selbst die Statusanzeige — das frühere separate Status-Schild entfällt.

## v2.179 — 2026-07

### Verbesserungen
- Der Tab **„Alle"** trennt jetzt aktive von abgeschlossenen Anträgen: oben Ihr **Arbeitsvorrat („In Arbeit")**, darunter das eingeklappte **Archiv („Abgeschlossen")** mit Anzahl und Kurzüberblick (z. B. „Schlussvermerk 128 · abgelehnt/zurückgez. 14"). Ein Klick klappt das Archiv auf oder zu. Die abgeschlossenen Anträge verstopfen so nicht mehr die Liste — sind aber jederzeit einen Klick entfernt.
- **Beim Suchen** klappt das Archiv automatisch auf, wenn es Treffer enthält — so „verschwinden" gefundene Anträge nicht im zugeklappten Bereich.
- Sortieren, Filtern und Gruppieren wirken weiterhin über beide Bereiche. Wählen Sie eine Gruppierung (z. B. nach Status), tritt diese an die Stelle der Arbeitsvorrat/Archiv-Aufteilung.

## v2.178 — 2026-07

### Verbesserungen
- Die Frist-Spalte der Anträge-Tabelle liest sich jetzt in Klartext: **„in 45 T", „seit 12 T" oder „heute"** mit einem farbigen Ampelpunkt (grün → gelb → orange → rot), statt einer nackten Tageszahl wie „-2807d". Überfällige Fristen stehen rot hervorgehoben. Abgeschlossene Anträge zeigen keine Frist mehr.
- Die Ansichten sortieren jetzt sinnvoller vor: **„Alle" zeigt die neuesten Antragseingänge zuerst**, „Offen" die dringendsten Fristen zuerst. Eine selbst gewählte Sortierung bleibt erhalten.

## v2.177 — 2026-07

### Verbesserungen
- Die Anträge-Tabelle hat jetzt **eine** klare Spalte „Status und nächster Schritt" statt drei verstreuter Status-Spalten: Sie sehen auf einen Blick den amtlichen Status **und** was als Nächstes zu tun ist (z. B. „Beantragt → PreCheck durchführen"). Abgeschlossene Anträge zeigen nur noch den Status, ohne Handlungsaufforderung.
- Die alten Einzelspalten (Status, FB-Status, PreCheck-Status) bleiben über „Spalten" weiterhin zuschaltbar. Wenn Sie Ihre Spaltenauswahl schon angepasst hatten, bleibt sie unverändert.

## v2.176 — 2026-07

### Neu
- Neuer Schnellfilter **PreCheck** über der Anträge-Liste: mit einem Klick nur Anträge mit positivem, negativem oder noch offenem PreCheck anzeigen.

### Verbesserungen
- Die Schnellfilter über der Anträge-Liste sitzen jetzt in **einer aufgeräumten Zeile**: Es ist immer nur ein Filter aufgeklappt, das Öffnen eines anderen klappt den vorherigen automatisch zu. Ihre zuletzt geöffnete Auswahl wird je Ansicht gemerkt.
- „Gruppieren" ist von den Schnellfiltern in ein eigenes „Gruppierung: … ▾"-Menü rechts neben „Spalten" umgezogen – die Filter-Zeile bleibt so übersichtlich. Aktive Filter und die Trefferzahl stehen jetzt in einer eigenen Zeile darunter.

## v2.175 — 2026-07

### Verbesserungen
- „Meine Anträge" auf der Startseite denkt den PreCheck mit: Ein früher Antrag ohne PreCheck zeigt jetzt „PreCheck durchführen", einer mit negativem PreCheck „PreCheck-Ergebnis klären" – so sehen Sie sofort, was als Nächstes ansteht, statt nur den Status.

## v2.174 — 2026-07

### Neu
- Anfragen werden jetzt automatisch getaggt: Sobald Sie eine `.msg` aufnehmen, erkennt die interne KI Antragsart, Absender-Name, Firma und Themengruppe und hängt sie an die Anfrage. So sehen Sie auf einen Blick, worum es geht – ganz ohne Handarbeit (alles bleibt lokal).
- Die Anfragen-Tabelle lässt sich jetzt filtern und sortieren: Die erkannten Tags (Art, Thema, Firma) sind direkt Filter in den Spaltenköpfen – so finden Sie z. B. alle Anfragen einer Themengruppe sofort.

### Verbesserungen
- Beim Kopieren zum ZIM-FAQ-Assistenten wird dem Text jetzt ein kurzer Hinweis vorangestellt: die Anrede ans Team soll ignoriert, nur die Fragen beantwortet und die Platzhalter unverändert übernommen werden. Das sorgt für passendere Antworten und verhindert, dass Platzhalter verloren gehen.
- Im Assistent-Verlauf können Sie Unterhaltungen jetzt anheften (bleiben oben) und umbenennen – nicht mehr nur öffnen und löschen.

## v2.173 — 2026-07

### Verbesserungen
- Der Assistent ist jetzt direkt in der Suche: Ein Klick auf „Assistent" öffnet ihn als Panel rechts neben den Treffern – so können Sie zu dem, was Sie gerade gefunden haben, gleich Fragen stellen. Er kennt dabei Ihre aktuellen Suchtreffer als Kontext (kleiner Hinweis „Kontext: N Suchtreffer", jederzeit entfernbar).
- Frühere Unterhaltungen erreichen Sie im Panel über das Verlauf-Symbol; „Chat"-Lesezeichen landen automatisch im geöffneten Assistenten. Der eigene „Chat"-Eintrag in der Seitenleiste entfällt dadurch.

## v2.172 — 2026-07

### Verbesserungen
- Die Startseite spricht jetzt eine einheitliche Sprache: Die Kopfzeile zeigt auf einen Blick, wie viele Vorgänge offen sind, wie viele über der 90-Tage-Frist liegen und wie viele sich ihr nähern – dieselben Zahlen wie die Ampel-Karte rechts.
- In „Meine Anträge" steht jetzt statt eines Status-Etiketts, was als Nächstes zu tun ist – z.B. „Fachprüfung → Gutachten beginnen". Ein farbiger Punkt und das Eingangsalter („vor N Tagen") zeigen die Dringlichkeit. Die vollständigen Details finden Sie weiterhin mit einem Klick in der Förderanträge-Liste.

## v2.171 — 2026-07

### Neu
- Neue „Weitermachen"-Karte auf der Startseite: Sie zeigt Ihre drei zuletzt bearbeiteten Gutachten, Nachforderungen und Kurzfassungen – ein Klick auf „Weiter →" bringt Sie direkt zurück an die richtige Stelle.
- Dieser Verlauf bleibt bewusst nur lokal auf Ihrem Gerät: Er wird nicht auf das Netzlaufwerk übertragen und nicht exportiert, und speichert keine Textinhalte. In den Einstellungen unter „Speicher" können Sie ihn jederzeit einsehen und löschen.

## v2.170 — 2026-07

### Verbesserungen
- Aufgeräumte Seitenleiste: Ihre Arbeitsbereiche (Home, Förderanträge, E-Mail-Anfragen, Auslastung, Suche) stehen oben zusammen, „Skill-Verwaltung" und „Einstellungen" ruhig am unteren Rand.
- Feedback geben ist jetzt auch direkt unten in der Seitenleiste möglich – neben der Versionsnummer. Das öffentliche Feedback-Board erreichen Sie weiterhin über den Feedback-Dialog.
- Das Modul „Anfragen" heißt jetzt „E-Mail-Anfragen" – damit klarer ist, worum es geht.

## v2.169 — 2026-07

### Verbesserungen
- Die Freischaltung der KI-Anonymisierung im Modul „Anfragen" greift jetzt automatisch: Nach dem Verbinden mit dem Ablageort schaltet die App den Anonymisierer einmalig team-weit frei – ohne dass jemand ihn von Hand aktivieren muss. Eine spätere bewusste Deaktivierung bleibt erhalten.

## v2.168 — 2026-07

### Neu
- Die KI-Anonymisierung im Modul „Anfragen" ist jetzt freigeschaltet: Nach bestandener Qualitätsprüfung kann eine Kurzanfrage in allen Rollen (außer der reinen End-User-Version) automatisch anonymisiert werden. Hinweis für bestehende Installationen: Der Anonymisierer muss einmalig unter Kuration → Skill-Verwaltung → „Anfrage anonymisieren" aktiviert werden – danach gilt das team-weit für alle.

## v2.167 — 2026-07

### Neu
- In der Kurator-Version ist das Modul „Anfragen" jetzt verfügbar. Damit können Kuratoren u. a. die Adresse (URL) des externen ZIM-FAQ-Assistenten zentral einstellen – sie wird team-weit auf dem gemeinsamen Ablageort gespeichert, sodass alle dieselbe Ziel-Adresse nutzen.

## v2.166 — 2026-07

### Neu
- Im Modul „Anfragen" lässt sich jetzt auch der **Original-Mailtext** (linke Spalte) direkt bearbeiten — z. B. um die Anrede, Signatur oder Textstellen zu entfernen, die die KI beim Anonymisieren nur verwirren. Änderungen werden automatisch lokal gespeichert. Wird der Originaltext nach dem Anonymisieren noch geändert, weist die Ansicht darauf hin und sperrt den Export, bis erneut anonymisiert wurde – so passt die anonyme Fassung immer zum Original.

## v2.165 — 2026-07

### Neu
- Beim Absenden von Feedback erscheint jetzt zusätzlich der Button „Feedback speichern & verbessern", sobald die interne KI verbunden ist. Sie formt das Feedback dann in eine klare, umsetzbare Anforderung um (mit Ist/Soll-Beschreibung und Prüfpunkten) — sichtbar direkt nach dem Speichern und später im generierten Claude-Code-Prompt.

### Verbesserungen
- Die interne KI kennt jetzt die aktuellen App-Bereiche statt einer veralteten Beschreibung — dadurch bessere, treffendere Feedback-Zusammenfassungen.

## v2.164 — 2026-07

### Verbesserungen
- Wartungs-Release: Aufräumen von Dokumentation, Tests und internem Code. Keine sichtbaren Änderungen – aber eine sauberere Basis für schnellere und fehlerärmere Weiterentwicklung.

## v2.163 — 2026-07

### Verbesserungen
- In der Feedback-Verwaltung lässt sich die Grenze zwischen Ticket-Liste und Detail-Ansicht jetzt mit der Maus verschieben – so kann man dem Detail-Panel mehr oder weniger Platz geben; die eingestellte Breite bleibt erhalten. Ist kein Ticket ausgewählt, nutzt die Liste die volle Breite.
- Der Haken zum Abhaken eines Tickets als „Umgesetzt" ist jetzt deutlich besser sichtbar.

## v2.162 — 2026-07

### Neu
- In der Feedback-Verwaltung lässt sich ein Ticket jetzt mit einem Klick auf den Haken links in der Zeile direkt als „Umgesetzt" abhaken – ohne das Ticket zu öffnen und ohne zu speichern. Nochmal klicken macht es wieder rückgängig.

## v2.161 — 2026-07

### Neu
- Die Förderanträge-Tabelle lässt sich jetzt am rechten Rand mit einem Griff insgesamt breiter oder schmaler ziehen; die Spalten skalieren dabei proportional mit. Ein Doppelklick setzt sie zurück auf „Fensterbreite füllen".

### Verbesserungen
- In der Suche zeigt die Spalte „Programm" jetzt zusätzlich das Unterprogramm im Format „Programm/Unterprogramm" (z.B. „ZIM/ZIM FuE-Projekte 2025"), statt nur „ZIM" – so lassen sich Treffer besser unterscheiden und auch nach Unterprogramm filtern.
- Diese Änderungsliste ist jetzt durchgängig in verständlicher Sprache verfasst.
- Der selten genutzte Filter „Letzter Monat" in diesem Fenster wurde entfernt — die Ansicht ist damit aufgeräumter.

### Bugfixes
- Behoben, dass dieses „Was ist neu?"-Fenster manchmal eine ältere Version anzeigte, als tatsächlich installiert war — die neueste Version erscheint jetzt zuverlässig.
- In der Feedback-Verwaltung stimmen die Zahlen an den Filter-Knöpfen (Status, Kategorie, Bereich) jetzt mit der Anzahl der angezeigten Tickets überein — vorher zählten sie archivierte Tickets mit, obwohl diese in der Liste ausgeblendet waren (z.B. „Bug 5", aber nur 1 sichtbar).

## v2.160 — 2026-07

### Neu
- Der Nutzer-Changelog kann jetzt auch im Kurator-Build direkt „mit KI geglättet" und aktuell gehalten werden – vorher ging das nur im Entwickler-Build.

## v2.159 — 2026-07

### Neu
- Die Statusleiste am unteren Sidebar-Rand ist jetzt zweizeilig, damit auch bei schmaler Sidebar alles sichtbar bleibt (Einstieg oben, Status-Anzeigen darunter). Auf Unterseiten führt „Zeig es mir" zu einem kurzen Info-Hinweis.

### Verbesserungen
- Die Tabellenansicht der Förderanträge nutzt jetzt die volle Fensterbreite; auf breiten Monitoren sind alle eingeblendeten Spalten ohne seitliches Scrollen sichtbar.

### Bugfixes
- Die KI-Klassifizierung im Auslastungs-Modul kam trotz sichtbar korrekter Antwort nicht in der App an – die Verbindung greift jetzt zuverlässig die richtige Antwort ab (Hinweis: das KI-Bookmarklet muss einmal neu installiert werden).

## v2.158 — 2026-07

### Neu
- Die Statistik-Übersicht im Auslastungs-Modul bietet jetzt einen Quartals-Vergleich: ein zurückliegendes Quartal des laufenden Jahres lässt sich als dezente Vergleichs-Anzeige einblenden.

### Bugfixes
- Das aktuelle Quartal rollt jetzt automatisch mit dem Kalender weiter – nach einem Quartalswechsel hing das Auslastungs-Modul nicht mehr im alten Quartal fest.
- Die Tabellenspalten „FB Status" und „PreCheck Status" bleiben nach einer nachträglichen Feld-Zuordnung nicht mehr leer.

## v2.157 — 2026-07

### Verbesserungen
- Die Filter-Einstellungen in den Auslastungs-Tabs bleiben jetzt über einen Neustart hinweg erhalten und werden beim nächsten Aufruf wieder angewandt.

### Bugfixes
- Die „Anträge mit KI klassifizieren"-Antwort kommt wieder zuverlässig in der App an; bei getrennter interner KI erscheint sofort ein klarer Hinweis statt eines endlosen Ladekreisels (Hinweis: das KI-Bookmarklet muss einmal neu installiert werden).

## v2.156 — 2026-07

### Bugfixes
- Behoben, dass ein Import zwar durchlief, aber keine neuen Anträge ankamen (verursacht durch eine leere Unterprogramm-Konfiguration). Übersprungene Anträge sind jetzt zudem sichtbar nachvollziehbar.

### Verbesserungen
- Das Diagnose-Werkzeug „Erzwungen neu prüfen" ist jetzt nur noch für Kuration/Entwicklung sichtbar und verwirrt normale Nutzer nicht mehr.

## v2.155 — 2026-07

### Verbesserungen
- Der automatische CSV-Import macht jetzt sichtbar, wenn Quellen still übersprungen wurden (z. B. Demo-Quellen oder nicht erreichbare Dateien), statt fälschlich „Aktuell" anzuzeigen.
- Neuer Knopf „Erzwungen neu prüfen", der eine verknüpfte Quelle garantiert neu einliest – hilfreich, wenn eine geänderte Datei nicht automatisch erkannt wurde.

## v2.154 — 2026-07

### Neu
- Eine kuratierte CSV-Quellen-Konfiguration (Name, Spalten-Zuordnung, Beschriftungen) lässt sich jetzt exportieren und in einer anderen Umgebung wieder importieren.

## v2.153 — 2026-07

### Neu
- Das Modul „Anfragen" ist jetzt auch in den Projektleitungs- und AS-Varianten verfügbar.

### Verbesserungen
- Der tägliche automatische CSV-Import wird nicht mehr durch reine Zusatzspalten blockiert; nur noch tatsächlich fehlende Felder erfordern eine Rückfrage.

### Bugfixes
- Der CSV-Status zeigt jetzt pro Quelle Dateiname, Export-Datum und Zeilenzahl, damit man sieht, welche Datei-Version wirklich eingelesen wurde.

## v2.152 — 2026-06

### Neu
- Im Modul „Anfragen" trennt die interne Anonymisierung jetzt zwei Schritte in einem Durchlauf – Namen/Kennungen werden ersetzt, beschreibende Passagen fachlich verallgemeinert –, damit der externe Assistent den Sinn behält. (Der Anonymisierer bleibt bis zur manuellen Freigabe inaktiv.)

## v2.151 — 2026-06

### Verbesserungen
- Aktive Schaltflächen, Filter-Pillen und Auswahl-Elemente tragen jetzt app-weit die im Profil gewählte Akzentfarbe statt Schwarz – einheitlicheres Erscheinungsbild, keine Funktionsänderung.

## v2.150 — 2026-06

### Verbesserungen
- Aktions-Schaltflächen in der ganzen App verwenden jetzt einheitlich die im Profil wählbare Primärfarbe statt teils schwarzer oder abweichender Knöpfe.

## v2.149 — 2026-06

### Neu
- Im Feedback-Modul lassen sich archivierte Tickets jetzt gezielt ausblenden oder einblenden, und die Aufwand-Schätzung bietet feinere Stufen (von 2 Stunden bis über 2 Wochen).

### Verbesserungen
- Das öffentliche Feedback-Board startet jetzt mit dem Filter „Offen", damit offene Themen zuerst sichtbar sind; die Auswahl wird gemerkt.

## v2.148 — 2026-06

### Verbesserungen
- Technische Verbesserungen im Hintergrund (Stabilität und Wartung).

## v2.147 — 2026-06

### Verbesserungen
- Technische Verbesserungen im Hintergrund (Stabilität und Wartung).

## v2.146 — 2026-06

### Verbesserungen
- Technische Verbesserungen im Hintergrund (Stabilität und Wartung).

## v2.145 — 2026-06

### Verbesserungen
- Technische Verbesserungen im Hintergrund (Stabilität und Wartung).

## v2.144 — 2026-06

### Verbesserungen
- Die Haupt-Schaltfläche (Aktions-Button) trägt jetzt die im Profil gewählte Akzentfarbe statt Anthrazit; die Farbauswahl bleibt dabei immer gut lesbar.

## v2.143 — 2026-06

### Neu
- Neue Status-Anzeige „● CSV" unten in der Sidebar (für Import-Rollen): zeigt grün, ob alle CSV-Exporte eingelesen sind, und bietet per Klick einen direkten „Jetzt importieren"-Weg.

## v2.142 — 2026-06

### Verbesserungen
- Die Detailansicht einer Anfrage zeigt Original und anonymisierten bzw. finalen Text jetzt nebeneinander (Vorher/Nachher) mit synchronem Scrollen und farbigen Hervorhebungen.

## v2.141 — 2026-06

### Neu
- Das Anfragen-Modul bietet jetzt drei Ansichten (Liste, Tabelle, Karten), einklappbare Detail-Abschnitte, einen prominenten Status-Badge und eine Löschen-Funktion – analog zu den Förderanträgen.

## v2.140 — 2026-06

### Neu
- Ein Kurator kann eine versehentlich auf einem Produktiv-System gelandete Demo-Quelle jetzt ohne Neu-Zuordnung in eine echte Quelle umwandeln.

### Bugfixes
- Demo-/Fixture-Quellen werden nicht mehr versehentlich auf den gemeinsamen Datenbestand geschrieben und können echte Quellen nicht mehr überschreiben.

## v2.139 — 2026-06

### Neu
- Beim erneuten Einlesen einer CSV lässt sich jetzt die Zeichenkodierung wählen (inkl. Auto-Erkennung), damit Umlaute nicht mehr als Fragezeichen erscheinen.

### Verbesserungen
- Ein deutliches Warn-Banner weist jetzt darauf hin, wenn nur Demo-Quellen registriert sind und echte CSV-Exporte gar nicht importiert werden.

## v2.138 — 2026-06

### Neu
- Die Speicher-Einstellungen zeigen jetzt Datum und Uhrzeit des letzten CSV-Imports, damit sofort erkennbar ist, ob man auf aktuellen Daten arbeitet.

## v2.137 — 2026-06

### Neu
- Neue Kuration-Seite „Anfragen" zum Pflegen der Modul-Einstellungen inkl. der team-weit editierbaren Adresse des externen FAQ-Assistenten.

### Bugfixes
- Behoben, dass eine nächtlich geänderte CSV-Quelle auf manchen Rechnern nicht als „neu importieren" erkannt wurde und der Datenbestand still veraltete.

## v2.136 — 2026-06

### Verbesserungen
- Die Status-Anzeigen unten in der Sidebar sind jetzt als farbiger Punkt mit kurzem Wort („● Sync", „● KI") sofort verständlich, ohne Tooltip. „Getrennt" wird als handlungsbarer Gelb-Zustand statt als harter Fehler dargestellt.
- Kleinere Anpassungen im Anfragen-Modul: kompaktere Aufnahmefläche, klarere Umbenennung in „ZIM FAQ-Assistent" und übersichtlichere Panels.

### Bugfixes
- Behoben, dass der Anonymisieren-Schritt bei Nutzung der lokalen KI endlos im Ladezustand hängen bleiben konnte.

## v2.135 — 2026-06

### Neu
- Die Verbindung zur internen KI wird jetzt automatisch erkannt und überall angezeigt (Startseite und Sidebar); die KI lässt sich direkt per „Verbinden"-Button öffnen, und ein Hinweis erscheint, wenn der KI-Tab versehentlich geschlossen wurde. Der manuelle „Verbindung testen"-Klick entfällt.

## v2.134 — 2026-06

### Neu
- Im Entwickler-Test lässt sich im Antrag auswählen, welchen Gutachten-Workflow der Ablauf verwenden soll.

### Bugfixes
- Der „Speichern"-Knopf im Skill- und Workflow-Editor fragt nach erfolgreichem Speichern nicht mehr fälschlich nach ungespeicherten Änderungen.
- Die Anonymisierung im Anfragen-Modul kommt jetzt robust mit Eigenheiten der internen KI zurecht.

## v2.133 — 2026-06

### Neu
- Die Workflow-Verwaltung pflegt jetzt alle Workflows (Gutachten, Nachforderungen, …) mit einem Freigabe-Modell: im Entwickler-Build als Entwurf bauen und testen, per Freigabe für die anderen Varianten verfügbar machen.

### Bugfixes
- Die Statusleiste der internen KI-Seite war hinter der neuen Tab-Leiste verschwunden und ist jetzt wieder sichtbar (Hinweis: das KI-Bookmarklet muss einmal neu installiert werden).

## v2.132 — 2026-06

### Neu
- Erkennungs-Regeln lassen sich jetzt ohne Regex-Wissen pflegen – über einfache Phrasen oder Synonym-Gruppen mit Live-Test – und der erzeugte KI-Hinweis gibt keine technischen Muster mehr preis.

## v2.131 — 2026-06

### Verbesserungen
- Die Filterleiste der Qualitätsregeln wurde aufgeräumt (gruppierte Facetten, eigene Zeile für „Verwendet in", übersichtlichere Spaltenbreiten) und der Intro-Text hinter ein Info-Icon verlegt, damit die Tabelle sofort sichtbar ist.

### Bugfixes
- Behoben, dass eine Spalte beim Anfassen des Breiten-Griffs ansprang und der Griff nicht mehr bündig am Spaltenende stand.

## v2.130 — 2026-06

### Verbesserungen
- Die Qualitätsregeln-Liste (Skill-Verwaltung) hat jetzt eine sichtbare Filterleiste nach Art, Typ, Prüfart, Schweregrad und Verwendung — in allen Ansichten, mit Treffer-Zähler und „Zurücksetzen".
- Der Spalten-Umschalter der Tabellenansicht sitzt jetzt platzsparend direkt in der Filterzeile.

## v2.129 — 2026-06

### Neu
- Neues Modul „Anfragen": Eine kurze E-Mail-Anfrage aufnehmen, per interner KI anonymisieren, extern beantworten lassen und die Originaldaten anschließend automatisch wieder einsetzen — bis zur versandfertigen Antwort. (Nur in der Entwickler-Version.)

### Verbesserungen
- Tabellen zeigen im Kopf jetzt dünne Trennlinien, damit klarer erkennbar ist, wo eine Spalte endet und wo man sie zum Vergrößern greifen kann.

## v2.128 — 2026-06

### Neu
- Im Changelog-Fenster gibt es wieder einen Umschalter „Alle aufklappen / Alle zuklappen".

### Verbesserungen
- Technische Verbesserungen im Hintergrund (Stabilität und Wartung).

## v2.127 — 2026-06

### Verbesserungen
- Das Changelog-Fenster ist bei vielen Versionen übersichtlicher: ältere Versionen werden in Zehnerpakete gebündelt, die neuesten bleiben einzeln offen.
- Das Changelog-Fenster lässt sich frei in der Größe verändern; die gewählte Größe bleibt beim nächsten Öffnen erhalten.

## v2.126 — 2026-06

### Verbesserungen
- Der nutzerfreundliche Changelog wird jetzt zentral gespeichert und steht allen Varianten sofort zur Verfügung, ohne dass die App neu gebaut werden muss.

## v2.125 — 2026-06

### Verbesserungen
- Das Fenster „Änderungen & Updates" ist kompakter, zeigt beim Öffnen die drei neuesten Versionen offen und bietet einen neuen Zeitfilter „Letzter Monat".

## v2.124 — 2026-06

### Neu
- Die AS-Variante zeigt die Bearbeiter-Auswahl in den Einstellungen jetzt als Auswahlliste („Alle" + alle Kürzel) statt als Freitextfeld.

### Bugfixes
- Wählt man in der AS-Variante „Alle", zeigt die Startseite jetzt die Gesamtübersicht statt eines Hinweises, dass kein Kürzel gesetzt sei.
- Bei einer Datenaktualisierung wird jetzt der Name der Person angezeigt, die aktualisiert hat, statt „unbekannt".
- Vor „Mit KI analysieren" in der Suche wird der interne KI-Chat automatisch zurückgesetzt, damit alte Gesprächsverläufe die Begründungen nicht mehr verfälschen. (Lesezeichen einmalig neu installieren.)

## v2.123 — 2026-06

### Neu
- Neue einblendbare Tabellen-Spalte „PreCheck Status" (grauer Badge mit dem jeweiligen Datum als Tooltip) in den Förderanträgen.

## v2.122 — 2026-06

### Verbesserungen
- „Mit KI analysieren" in der Suche ergänzt jetzt die gewohnten Treffer um eine zusätzliche Spalte „Begründung" (2–3 Sätze pro Treffer), statt die Tabelle zu ersetzen. Der Anweisungstext lässt sich vor dem Lauf anpassen, und die Begründung ist im Export enthalten.

## v2.121 — 2026-06

### Neu
- Neue einblendbare Tabellen-Spalte „FB Status" in den Förderanträgen: zeigt den jüngsten Status als Badge, mit Datum im Tooltip; sortier- und filterbar.

## v2.120 — 2026-06

### Neu
- Die Förderanträge-Liste zeigt jetzt nach dem Filtern eine Trefferzahl (z. B. „1.054 Anträge") in allen drei Ansichten.

### Bugfixes
- Die Tab-Zähler oben (z. B. „Offen") stimmen jetzt wieder mit der Anzahl der tatsächlich angezeigten Zeilen überein.

## v2.119 — 2026-06

### Bugfixes
- Fehlerhafte Darstellung einzelner Bereiche („nackt" gerenderte Komponenten) strukturell behoben; die Schrift ist jetzt überall einheitlich.

## v2.118 — 2026-06

### Verbesserungen
- Die Sektion „Alle Felder" der Antrags-/Verbund-Detailseite ist neu gestaltet: ein kompaktes 8-Fakten-Raster auf einen Blick, eine übersichtliche Verbundpartner-Tabelle (eine Zeile pro Teilvorhaben) und die vielen Technologie-Kennzeichen gebündelt in einem aufklappbaren Cluster.

### Bugfixes
- Der Technologie-Kennzeichen-Cluster bündelt die Kennzeichen jetzt auch mit echten Daten korrekt; das Zeilen-Layout klafft nicht mehr auseinander.

## v2.117 — 2026-06

### Neu
- Die Abschnitte der Verbund-Detailseite (Antragsdaten, Gutachten, Kurzfassung, Nachforderungen, Historie) lassen sich jetzt einzeln ein- und ausklappen, um beim Arbeiten gezielt Platz zu schaffen; der Zustand bleibt erhalten.

### Verbesserungen
- Die Abschnitts-Überschriften der Verbund-Detailseite sind einheitlich und bündig gestaltet.

## v2.116 — 2026-06

### Verbesserungen
- Der Editor für Gutachten-Abschnitte zeigt Formatierungen (fett, kursiv, Überschriften) jetzt direkt als Vorschau an, während man tippt; Format-Zeichen erscheinen nur in der Zeile, in der man gerade schreibt.

## v2.115 — 2026-06

### Neu
- Neue Programm-Variante „AS" (wie PL, aber ohne das Auslastungs-Modul) mit eigenem Zugangspasswort.

## v2.114 — 2026-06

### Verbesserungen
- Die Gutachten-Werkstatt ist aufgeräumter: kompaktere Kopf- und Meta-Zeile, Anpassen-Werkzeuge direkt am Text und ein deutlicher Warnhinweis, sobald eine externe KI im Einsatz wäre.
- Die Abschnitts-Leiste der Gutachten-Werkstatt lässt sich zu reinen Kreis-Symbolen einklappen, um mehr Breite zu gewinnen.
- Kleine Wording-Korrektur an der Anpassen-Zeile.

## v2.113 — 2026-06

### Neu
- Die Abschnitts-Leiste der Gutachten-Werkstatt lässt sich einklappen (nur Kreise), wenn mehr Platz für Entwurf und Kontext gebraucht wird; der Zustand bleibt erhalten.

## v2.112 — 2026-06

### Verbesserungen
- Der Denkprozess-Schalter (Thinking) ist jetzt ein kompakter An/Aus-Umschalter.
- Das Layout der Gutachten-Werkstatt wurde überarbeitet: die Abschnitts-Leiste dockt direkt an die Entwurf-Karte an, die Aktionsleiste ist kompakter.

### Bugfixes
- Vom Skill erzeugte Formatierungen (z. B. **fett**) werden jetzt in der Vorschau und im Word-Export korrekt dargestellt, statt als Sternchen im Text zu erscheinen.

## v2.111 — 2026-06

### Verbesserungen
- Technische Verbesserungen im Hintergrund (Aufräumen und Wartung, ohne sichtbare Änderung).

## v2.110 — 2026-06

### Verbesserungen
- Die Verbund-/Antrags-Detailseite hat ein kompakteres Layout (kompakter Kopf, klemmbare Kurzbeschreibung, Sprung-Navigation, schlankere Teilvorhaben-Liste), damit Gutachten und Nachforderungen ohne langes Scrollen erreichbar sind.

### Bugfixes
- Eine unvollständig veröffentlichte Verbund-Datei wird jetzt bereits an der Quelle vollständig geschrieben, sodass Startseite und Historie keine lückenhaften Daten mehr erhalten.

## v2.109 — 2026-06

### Neu
- Die Gutachten-Werkstatt bekommt ein neues 3-Spalten-Layout und erlaubt jetzt das direkte Bearbeiten des Entwurfstexts (mit „bearbeitet"-Markierung und Zurücksetzen).

### Verbesserungen
- Der Dialog „Persönlicher Stil" ist übersichtlicher gestaltet (zentriert, mit Vorschau der Kombination).

## v2.108 — 2026-06

### Neu
- Neuer Artefakt-Typ „Nachforderungen" (ZIM): Aus kuratierten Textbausteinen entstehen pro Teilvorhaben ein Word-Dokument und ein E-Mail-Entwurf — es wird nichts automatisch versendet. (Nur in der Entwickler-Version.)
- Die Gutachten-Maschine wurde zu einem allgemeinen Baukasten für solche Dokument-Artefakte verallgemeinert, inklusive Qualitätsprüf-Regeln.

## v2.107 — 2026-06

### Verbesserungen
- Im Gutachten-Detail lässt sich die Antragsliste einklappen, um mehr Platz zu schaffen, und die Abschnitte werden über eine benannte Navigationsliste (mit Statussymbol) statt über Buchstaben-Tabs angesteuert.

## v2.106 — 2026-06

### Neu
- Im Gutachten-Workflow erzeugt ein Klick jetzt alle noch fehlenden Abschnitte nacheinander als Entwurf, ohne zwischendurch freigeben zu müssen; der Vorgang lässt sich jederzeit fortsetzen.

## v2.105 — 2026-06

### Verbesserungen
- Technische Verbesserungen im Hintergrund für den Gutachten-Workflow (gezielterer KI-Kontext), ohne sichtbare Änderung im Normalbetrieb.

## v2.104 — 2026-06

### Verbesserungen
- In der Skill-Verwaltung lässt sich jetzt frei zwischen Einträgen wechseln, auch wenn ein Editor offen ist — bei ungespeicherten Änderungen kommt eine Nachfrage (Speichern / Verwerfen / Abbrechen).

## v2.103 — 2026-06

### Neu
- Die KI-Qualitäts-Regel „nur interne KI für Dokumentinhalte" ist jetzt fest im Programm verankert, damit Dokumentinhalte zuverlässig nicht an externe Dienste gelangen.

### Bugfixes
- Beim Öffnen einer Verbund-Detailseite mit KI-generierten Abschnitten öffnet sich kein ungefragter zweiter Browser-Tab mehr.
- Die Meldung „Verbund nicht gefunden" auf der Detailseite tritt nicht mehr auf; die Ansicht heilt sich selbst und baut fehlende Daten aus den Teilvorhaben auf.

## v2.102 — 2026-06

### Neu
- Der Gutachten-Workflow kann einen Abschnitt jetzt optional per KI beratend auf Qualität prüfen (Erdung, Kohärenz, Vollständigkeit, Ton) — der Text wird dabei nie automatisch überschrieben.
- Optionaler, streng begrenzter automatischer Neuversuch, wenn ein generierter Abschnitt zu lang oder zu kurz ist.

## v2.101 — 2026-06

### Neu
- Der Gutachten-Workflow (Abschnitte A–G) ist jetzt frei anpassbar: Schritte lassen sich in der Skill-Verwaltung umsortieren, Skills zuordnen und in Unterschritte zerlegen.

## v2.100 — 2026-06

### Neu
- Das Changelog-Fenster (Klick auf die Versionsnummer) hat jetzt einen Filter nach Kategorie: „Alle", „Neu & Verbesserungen" oder „Bugfixes", jeweils mit Anzahl.

### Bugfixes
- Die eingebauten Demo-Daten lösen im Entwickler-Build keine fälschliche CSV-Aktualisierung mehr aus.
