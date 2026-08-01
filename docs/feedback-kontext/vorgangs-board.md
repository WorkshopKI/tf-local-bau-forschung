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

- **Drei Sichten** (Reiter mit Zähler), alle aus demselben Regelsatz:
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
  eigenes Kürzel an/aus, Jahr des Antragseingangs, Fördervariante, ZAH-Phase.
  Der Kürzel-Filter folgt der Rolle: ein AB sucht sich in der BIB-Spalte, ein FB
  in TIB.

## Wichtig

- **Der Regelsatz wird nicht hier gepflegt**, sondern im Status-Katalog unter
  „Regeln" → To-do-Regeln. Führt die Katalog-Fassung keine Regeln, sagt das Board
  das und zeigt nichts an, statt Leere zu behaupten.
- Die Rollen-Zuordnung ist die **Soll-Rolle** aus dem Regelsatz, nicht die Person:
  der Export enthält keine Information darüber, wer einen Eintrag gesetzt hat.
- Die Berechnung ist **deterministisch zum Stichtag** des Seitenaufrufs. Zwei
  Rechner mit demselben Datenstand sehen dasselbe; Unterschiede können nur
  Unterschiede im Importstand sein.
