# Vorgangs-Board

## Zweck

Das geteilte To-do-Board — der Ersatz für die privaten XLSX-Dashboards. Es sagt
je Antrag, **was als Nächstes zu tun ist**, abgeleitet aus einer geordneten
Regel-Kaskade, die im Status-Katalog gepflegt wird. Dieselbe Rechnung, die eine
AB-Kollegin heute als verschachtelte WENN-Formel in ihrer Mappe führt, nur
versioniert und für alle sichtbar.

Die App **setzt nichts**. Sie leitet ab, was ansteht; gehandelt wird im
Fachsystem (Foyer).

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
- **Drei Aufgaben-Sichten**, alle aus demselben Regelsatz:
  - **Meine Aufgaben** — To-dos, für die die gewählte Rolle zuständig ist.
  - **Wartet auf andere** — dieselben Anträge aus der Fremdrollen-Sicht: was für
    den AB „RNE ergänzen" ist, erscheint dem FB als „wartet auf AB".
  - **Kein To-do ermittelt** — die Ehrlichkeits-Anzeige, immer erreichbar.
- **Gruppen**: innerhalb einer Sicht nach To-do-Wert, in **Kaskaden-Reihenfolge**
  des Regelsatzes (nicht nach Häufigkeit) — so liest sich das Board in derselben
  Ordnung wie die Regeln. Jede Gruppe ist einklappbar und zeigt ihre Anzahl.
- **Zeile**: Aktenzeichen (Klick öffnet den Verbund), Titel, Status, zuständige
  Rolle bzw. „wartet auf …", und ein **„warum?"** — es klappt die treffende Regel
  samt der gelesenen Feldwerte auf. Ohne diese Herleitung wäre ein To-do eine
  Behauptung.
- **Filter**: Rollen-Chips (Vorbelegung aus dem Profil, umschaltbar auf alle),
  eigenes Kürzel an/aus, **„hängt fest"**, Jahr des Antragseingangs,
  Fördervariante, ZAH-Phase. Der Kürzel-Filter folgt der Rolle: ein AB sucht
  sich in der BIB-Spalte, ein FB in TIB.
- **Stillstands-Wächter**: eine Zeile, an der seit länger als den **Zieltagen**
  ihres Status nichts passiert ist, trägt die Marke „hängt n T". Im Kopf steht
  der **Stau je Rolle**; daneben — nicht darin — die Zahl der **nicht
  bewertbaren** Vorgänge, für deren Status niemand Zieltage gepflegt hat.
  Zieltage werden im Status-Katalog unter „Katalog" gepflegt.

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

- **Der Regelsatz wird nicht hier gepflegt**, sondern im Status-Katalog unter
  „Regeln" → To-do-Regeln. Führt die Katalog-Fassung keine Regeln, sagt das Board
  das und zeigt nichts an, statt Leere zu behaupten.
- Die Rollen-Zuordnung ist die **Soll-Rolle** aus dem Regelsatz, nicht die Person:
  der Export enthält keine Information darüber, wer einen Eintrag gesetzt hat.
- Die Berechnung ist **deterministisch zum Stichtag** des Seitenaufrufs. Zwei
  Rechner mit demselben Datenstand sehen dasselbe; Unterschiede können nur
  Unterschiede im Importstand sein.
