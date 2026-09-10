# Vorgangs-Board

## Zweck

Das geteilte To-do-Board — der Ersatz für die privaten XLSX-Dashboards. Es sagt
je Antrag, **was als Nächstes zu tun ist**, abgeleitet aus einer geordneten
Regel-Kaskade, die unter „Vorgangs-Regeln" gepflegt wird. Dieselbe Rechnung, die eine
AB-Kollegin heute als verschachtelte WENN-Formel in ihrer Mappe führt, nur
versioniert und für alle sichtbar.

Die App **setzt nichts**. Sie leitet ab, was ansteht; gehandelt wird im
Fachsystem C16.

## Auswertungsmodell

Geordnete Liste, **erste zutreffende Regel gewinnt** — wie die verschachtelten
WENNs der Mappe. Vorangestellt sind **Sperren**: sie erzeugen kein To-do, sondern
legen ganze Stränge still (zurückgezogener Antrag, begonnene Rücknahmeempfehlung
oder Ablehnung). Trifft keine Regel, steht der Antrag unter „Kein To-do
ermittelt" — er verschwindet nicht.

Einheit ist das **Teilvorhaben**, nicht der Verbund: die Regeln lesen
überwiegend TV-Spalten. Verbund-Spalten stehen jedem seiner Teilvorhaben zur
Verfügung.

## Bereiche

- **Drei Reiter mit Zähler — drei Fragen**: *Arbeit* (was ist zu tun), *Fristen*
  (was läuft ab), *Auswertung* (wie steht der Bestand). Bis v4.95 waren es
  fünf, und sie mischten drei Sorten Menge in einer Leiste: eine Partition
  (meine/wartet/kein To-do), eine Risiko-Teilmenge (Fristen) und die
  Gesamtmenge (Auswertung). Gleich aussehend, aber nicht gegeneinander lesbar.
- **Betrachtungsbereich-Chip** im Seitenkopf: „Anzeige: letzte 3 Richtlinien". Er sagt, welche Förder-Richtlinien zum Arbeitsvorrat zählen — die drei jüngsten ZIM-Generationen 2015, 2020, 2025; draußen bleibt nur die Generation 2012. Wie viele Anträge das ausblendet, steht im Tooltip; im Chip selbst erst dann, wenn jemand einzelne Programme abwählt.
  - **Klick öffnet die Auswahl:** drei Kurzwahlen — Standard-Bereich / Aktuelle Richtlinie (nur die jüngste Generation, Chip: „Anzeige: Richtlinie 2025") / Alle Richtlinien — darunter die Programme mit Klartext-Namen, **nach Generation gruppiert**; ein Häkchen macht daraus eine eigene Liste.
  - **Das Board rechnet nur die aktuelle und die vorige Richtlinie** (2020 und 2025). Vorgänge älterer Richtlinien im Bereich — heute die Generation 2015, für die die Trigger-Zuarbeit ohnehin nichts führt — bekommen hier keine Karte; neben dem Chip steht dann „N Vorgänge älterer Richtlinien nicht gerechnet". In Liste, Startseite und Suche bleiben sie, mit der Nebenzeile „ältere Richtlinie – aus dem Status abgeleitet" statt einer Aufgabe aus den Kürzeln.
  - Die **Suche bleibt immer am ganzen Bestand** — Treffer außerhalb sind gekennzeichnet und lassen sich öffnen.
- **Wer dran ist**, eigene Chip-Zeile unter den Reitern (nur im Reiter *Arbeit*).
  Vier Teile mit ihrer Zahl, und **die vier addieren sich zur Gesamtmenge** —
  genau das konnte die alte Reiterleiste nicht:
  - **Meine Aufgaben** — To-dos, für die die gewählte Rolle zuständig ist.
    **Ohne Rollenwahl heißt der Chip „Jemand ist zuständig"** (seit v4.132): dort
    zählt er, wofür irgendeine Rolle im Haus benannt ist — für einen FB waren das
    17 Aufgaben, von denen 16 dem AB gehörten. „Alle Rollen" zeigt den
    AB-Regelsatz; das sagt der Chip beim Überfahren.
  - **Wartet auf andere** — dieselben Anträge aus der Fremdrollen-Sicht: was für
    den AB „RNE ergänzen" ist, erscheint dem FB als „wartet auf AB". Ohne
    Rollenwahl heißt er „Wartet auf außerhalb" (Antragsteller oder eine nicht
    benannte Rolle).
  - **Kein To-do** — keine Regel traf. Eine Lücke im Regelsatz.
  - **Abgeschlossen** — eine Sperre griff, weil Schlussvermerk oder
    Zuwendungsbescheid vorliegen. Ein **Ergebnis**, keine Lücke.
  - **Vorbelegt sind die ersten beiden** — was Arbeit ist. Die anderen beiden
    stehen mit ihrer Zahl daneben und sind einen Klick entfernt; abgewählt ist
    nicht versteckt. Bis v4.95 lagen sie in EINEM Reiter zusammen, und weil die
    abgeschlossenen 96 % davon stellten, trug der größte Zähler des Boards die
    Beschriftung eines Mangels.
  - **Der letzte Chip lässt sich nicht abwählen** — eine leere Liste läse sich
    als „nichts zu tun" statt als „nichts ausgewählt". Weicht die Auswahl von
    der Vorbelegung ab, steht daneben **„zurück zum Arbeitsvorrat"**.
- **Gruppen**: innerhalb der Auswahl nach To-do-Wert, in **Kaskaden-Reihenfolge**
  des Regelsatzes (nicht nach Häufigkeit) — so liest sich das Board in derselben
  Ordnung wie die Regeln. Jede Gruppe ist einklappbar und zeigt ihre Anzahl.
  „Kein To-do ermittelt" und „Keine Aufgabe mehr (Verfahren abgeschlossen)"
  stehen als eigene Gruppen **hinten**: erst die Kaskade, dann das, worüber sie
  nichts sagt.
- **Zeile**: Aktenzeichen (Klick öffnet den Verbund), Titel, Status, zuständige
  Rolle bzw. „wartet auf …", und ein **„warum?"** — es klappt die treffende Regel
  samt der gelesenen Feldwerte auf. Ohne diese Herleitung wäre ein To-do eine
  Behauptung. Jedes gelesene Feld steht mit Namen, Code und — wo sie anders
  heißt — seiner Quellspalte da; der Tooltip daran nennt Code und Label der
  CSV-Spalte.
  - Im Detail steht oben links **„Zurück zum Vorgangs-Board"**: der Weg zurück auf genau
    diese Liste, mit allen Filtern und Reitern, wie sie waren. Auch das Schließen
    des Details (×) führt dorthin, nicht in die Förderanträge-Tabelle.
- **Rollen-Sicht**: jede Rolle hat einen eigenen Regelsatz. Die Rollen-Chips
  schalten die Sicht um; ausgewertet wird immer genau ein Satz. „Alle Rollen"
  zeigt den AB-Satz — er ist der einzige mit einer vollstaendigen Kaskade.
- **Abgeleitete To-dos**: solange fuer eine Rolle keine eigene Regel gepflegt
  ist, uebernimmt das Board die Aussage der Regel, die auf sie wartet. Solche
  Eintraege sind mit **„abgeleitet"** markiert (Zeile und Gruppenkopf); der
  Tooltip nennt die Herkunftsregel. Eine spaeter geschriebene eigene Regel
  ersetzt den abgeleiteten Eintrag.
- **Rollen-Bilanz** im Kopf: „824 AB-To-dos · 68 FB-To-dos, davon 68 abgeleitet".
  Der zweite Teil sagt, wie viel von der Arbeit einer Rolle nur abgeleitet ist —
  und damit, wie viel Regelarbeit noch aussteht.
- **Filter**: Rollen-Chips (Vorbelegung aus dem Profil, umschaltbar auf alle),
  eigenes Kürzel an/aus, **„hängt fest"** — dazu drei Menüs mit
  **Mehrfachauswahl**: Jahre (Jahr des Antragseingangs), Fördervarianten und
  ZAH-Phasen. Der Kürzel-Filter folgt der Rolle: ein AB sucht sich in der
  BIB-Spalte, ein FB in TIB.
  - **Nichts angehakt heißt „alle"**, nicht „nichts". Jedes Menü hat oben einen
    Rücksetzer.
  - **Die Jahre starten auf den letzten dreien** — und zwar sichtbar angekreuzt,
    nicht als Sammelwert. Der Schnellweg „Letzte 3 Jahre" stellt sie wieder
    her, „Alle Jahre" hebt die Auswahl auf.
  - **Die Zahl neben jedem Wert ist eine Zusage**: sie sagt, wie viele Zeilen ein
    Klick brächte, und rechnet dafür unter den *jeweils anderen* aktiven Filtern
    — die eigene Achse bleibt ausgespart. Wer „FuE" wählt, sieht die Jahrgangs-
    Zahlen schrumpfen; die Varianten-Zahlen im eigenen Menü ändern sich nicht.
  - Der **Altbestands-Hinweis** erscheint, sobald die Auswahl einen Jahrgang vor
    der Drei-Jahres-Grenze enthält — auch bei einem einzeln gewählten alten Jahr,
    nicht erst bei „alle".
- **Stillstands-Wächter**: eine Zeile, an der seit länger als den **Zieltagen**
  ihres Status nichts passiert ist, trägt die Marke „hängt n T". Im Kopf steht
  der **Stau je Rolle**; daneben — nicht darin — die Zahl der **nicht
  bewertbaren** Vorgänge, für deren Status niemand Zieltage gepflegt hat.
  Zieltage werden unter „Vorgangs-Regeln" im Reiter „Statuswerte" gepflegt.

  Steht vor der Zahl ein **„≥"**, ist die Liegezeit eine Untergrenze: die
  Datumsspalten des Exports tragen je Kürzel nur das zuletzt gesetzte Datum.
  Wo das Änderungs-Journal die letzte Änderung belegt, steht die Zahl ohne
  Vorbehalt.

- **Fristen** (Bearbeiter-Sicht): die Anträge nach Restfrist, der knappste zuerst.
  Gerechnet ab **wirksamem Eingang** — dem späteren von Antragseingang und „alle
  Anträge da"; das Datum steht in einer eigenen Spalte, damit sichtbar ist,
  worauf sich die Zahl bezieht. Ampel rot ab 14, gelb ab 30 Tagen. Daneben das
  To-do und das Wächter-Urteil.
  - Eine Antragsfrist läuft nur in der **Antragsphase**. Abgeschlossene und
    bewilligte Vorgänge stehen nicht in der Liste — wie viele es sind, sagt eine
    Zeile darüber, statt sie stumm zu unterschlagen.
- **Auswertung** (PL-Sicht): Verteilung über die ZAH-Phasen, Stau je Rolle,
  Liegezeit je Status (Median, p90 und **n** — eine Zahl aus zwei Proben sieht
  sonst aus wie eine aus dreihundert) und die Fristrisiko-Liste unter 30 Tagen.
  Kein Wochentrend: der Export liefert nur den Stand von heute Nacht.
- **XLSX-Export** in beiden Sichten — genau die Zeilen, die auf dem Bildschirm
  stehen, in derselben Reihenfolge.

## Wichtig

- **Der Regelsatz wird nicht hier gepflegt**, sondern unter „Vorgangs-Regeln" im Reiter
  „Regeln" → To-do-Regeln. Führt die Katalog-Fassung keine Regeln, sagt das Board
  das und zeigt nichts an, statt Leere zu behaupten.
- Die Rollen-Zuordnung ist die **Soll-Rolle** aus dem Regelsatz, nicht die Person:
  der Export enthält keine Information darüber, wer einen Eintrag gesetzt hat.
- Die Berechnung ist **deterministisch zum Stichtag** des Seitenaufrufs. Zwei
  Rechner mit demselben Datenstand sehen dasselbe; Unterschiede können nur
  Unterschiede im Importstand sein.
- **Das Ergebnis wird für die Sitzung behalten** (seit v4.103). Wer die Seite
  verlässt und zurückkommt, sieht sie sofort statt nach Sekunden. Damit daraus
  keine stille Momentaufnahme wird, steht über der Liste, **wie alt** die Zahlen
  sind („12.359 Vorgänge · berechnet vor 3 min"), und daneben **„neu berechnen"**.
  Von selbst neu gerechnet wird nach einem CSV-Import, bei einer anderen
  Katalog-Fassung, bei geändertem Betrachtungsbereich, mit dem Datumswechsel und
  spätestens nach fünf Minuten.
