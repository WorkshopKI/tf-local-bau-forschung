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

- **Fünf Reiter mit Zähler.** Die ersten drei zeigen dieselbe Menge nach
  Zuständigkeit, die letzten beiden dieselbe Menge unter einer anderen Frage.
- **Betrachtungsbereich-Chip** im Seitenkopf: „Anzeige: letzte 3 Richtlinien (12 Programme) · 1.866 ausgeblendet". Er sagt, welche Förder-Richtlinien zum Arbeitsvorrat zählen und wie viele Anträge das ausblendet. Gemeint sind die drei jüngsten ZIM-Generationen — 2015, 2020, 2025; draußen bleibt nur die Generation 2012.
  - **Klick öffnet die Auswahl:** Standard-Bereich / alle Richtlinien / eigene Liste, mit Klartext-Namen und **nach Generation gruppiert**.
  - **Für die Generation 2015 führt die Trigger-Zuarbeit nichts** — dort steht am Vorgang „für Programm N keine Trigger importiert", und es entsteht kein To-do.
  - Die **Suche bleibt immer am ganzen Bestand** — Treffer außerhalb sind gekennzeichnet und lassen sich öffnen.
- **Drei Aufgaben-Sichten**, alle aus demselben Regelsatz:
  - **Meine Aufgaben** — To-dos, für die die gewählte Rolle zuständig ist.
  - **Wartet auf andere** — dieselben Anträge aus der Fremdrollen-Sicht: was für
    den AB „RNE ergänzen" ist, erscheint dem FB als „wartet auf AB".
  - **Kein To-do ermittelt** — die Ehrlichkeits-Anzeige, immer erreichbar. Sie
    trennt zwei Sorten: „Kein To-do ermittelt" (keine Regel traf — eine Lücke im
    Regelsatz) und „Keine Aufgabe mehr (Verfahren abgeschlossen)" (eine Sperre
    griff, weil Schlussvermerk oder Zuwendungsbescheid vorliegen — ein Ergebnis).
- **Gruppen**: innerhalb einer Sicht nach To-do-Wert, in **Kaskaden-Reihenfolge**
  des Regelsatzes (nicht nach Häufigkeit) — so liest sich das Board in derselben
  Ordnung wie die Regeln. Jede Gruppe ist einklappbar und zeigt ihre Anzahl.
- **Zeile**: Aktenzeichen (Klick öffnet den Verbund), Titel, Status, zuständige
  Rolle bzw. „wartet auf …", und ein **„warum?"** — es klappt die treffende Regel
  samt der gelesenen Feldwerte auf. Ohne diese Herleitung wäre ein To-do eine
  Behauptung.
- **Rollen-Sicht**: jede Rolle hat einen eigenen Regelsatz. Die Rollen-Chips
  schalten die Sicht um; ausgewertet wird immer genau ein Satz. „Alle Rollen"
  zeigt den AB-Satz — er ist der einzige mit einer vollstaendigen Kaskade.
- **Geliehene To-dos**: solange fuer eine Rolle keine eigene Regel gepflegt ist,
  leiht sich das Board die Aussage der Regel, die auf sie wartet. Solche
  Eintraege sind mit **„geliehen"** markiert (Zeile und Gruppenkopf); der
  Tooltip nennt die Herkunftsregel. Eine spaeter geschriebene eigene Regel
  ersetzt den geliehenen Eintrag.
- **Rollen-Bilanz** im Kopf: „824 AB-To-dos · 68 FB-To-dos, davon 68 abgeleitet".
  Der zweite Teil sagt, wie viel von der Arbeit einer Rolle nur geliehen ist —
  und damit, wie viel Regelarbeit noch aussteht.
- **Filter**: Rollen-Chips (Vorbelegung aus dem Profil, umschaltbar auf alle),
  eigenes Kürzel an/aus, **„hängt fest"** — dazu drei Menüs mit
  **Mehrfachauswahl**: Jahrgänge (Jahr des Antragseingangs), Fördervarianten und
  ZAH-Phasen. Der Kürzel-Filter folgt der Rolle: ein AB sucht sich in der
  BIB-Spalte, ein FB in TIB.
  - **Nichts angehakt heißt „alle"**, nicht „nichts". Jedes Menü hat oben einen
    Rücksetzer.
  - **Jahrgänge starten auf den letzten dreien** — und zwar sichtbar angekreuzt,
    nicht als Sammelwert. Der Schnellweg „Letzte 3 Jahrgänge" stellt sie wieder
    her, „Alle Jahrgänge" hebt die Auswahl auf.
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
