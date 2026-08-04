# Status-Katalog (Cockpit)

Vollbild-Verwaltungsseite für Kuratoren. Hier wird der **Status-Katalog** gepflegt
— die Daten hinter der Statusanzeige.

## Zweck

Der Katalog ordnet jedem Statuswert seine **ZAH-Phase** (Eingang →
Vollständigkeit → Prüfung → Entscheidung → Begleitung → Abgeschlossen) und seine
**Zieltage** zu — mehr wird nicht kuratiert. Die **Kategorie** (offen, in
Prüfung, Nachforderung …) folgt aus Phase und amtlichem Code; hängt die
Projektleitung einen Code auf eine andere Phase um, zieht sie automatisch nach.

**Die App leitet keinen Status ab.** Bis v2.384 rechnete sie aus allen gesetzten
Datumsfeldern eine eigene Verfahrensposition aus (Rang, terminal-Flag,
Konflikt-Meldung) — die lief dem Status im Fachsystem regelmäßig voraus. Das ist
entfallen: angezeigt wird, was das Fachsystem führt.

## Bereiche

- **Katalog**: alle Statuswerte mit Inline-Bearbeitung (Label, Kategorie,
  Prominenz, **Zieltage**, aktiv), **Vorkommen**, **zuletzt gesehen**, Feldname
  und **CSV-Spalte** als Herkunft. Leeres Label heißt: Rohwert gilt. Neue Werte
  erscheinen als **unkuratiert** und werden per „Übernehmen" geholt, nie
  automatisch.
  - **Zieltage** speisen den Stillstands-Wächter: nach wie vielen Tagen ohne
    Vorgangs-Aktivität gilt dieser Status als hängend? Leer heißt „nicht
    bewertbar", nicht „unauffällig". Neben dem Feld steht ein ⌀-Vorschlag aus
    der Ist-Verteilung (Median, Stichprobengröße im Tooltip); er wird pro Zeile
    einzeln übernommen. Über der Tabelle steht zusätzlich „Vorschläge ansehen":
    Vorschau (alt → neu, Stichprobe) und Übernahme in einem Schritt — nur die
    Phasen Eingang bis Entscheidung und erst ab fünf Beobachtungen; kleinere
    Stichproben stehen namentlich als „zu wenig Daten".
- **Kürzel**: der **Ordnerbaum des Fachsystems** (505 Einträge), Verbund und
  Teilvorhaben getrennt.
  - Editierbar je Eintrag: Bezeichnung, Ordner, **wird gesetzt von**
    (AB/FB/QS/PA/Juristen, Mehrfachauswahl; leer = jeder darf), **relevant**,
    Prominenz und die **ZAH-Phase** des Datums. Die Phase beantwortet „welches
    Datum gehört zum aktuellen Status?" — sie speist die „seit"-Angabe der
    Status-Erklärung und die Marke in der Chronik. Leer heißt ehrlich „trägt
    nichts bei", weil eine geratene Zuordnung schlechter wäre als keine. Bei
    Wert-Feldern hängt die Phase am Wert.
  - Zwei **Phasenvorschläge** über der Tabelle, je mit Vorschau, Beleg als Satz
    und zeilenweiser Auswahl: einer aus der **Trigger-Tabelle** (das Kürzel setzt
    Status X, X liegt in Phase P), einer aus der **Auslieferung** — nur dort, wo
    die Trigger-Tabelle schweigt, denn sie hat Vorrang.
  - Uneinigkeit wird benannt, nicht geglättet: verschiedene Phasen über die
    Richtlinien oder Widerspruch zwischen beiden Quellen ergeben **keinen**
    Vorschlag. Kürzel ohne Vorschlag stehen nach Grund gruppiert; ein Satz unter
    der Kopfzeile nennt, wie viele Kürzel überhaupt einen Status setzen — die
    verbleibende Lücke ist keine offene Arbeit.
  - Das **Relevanz-Häkchen** markiert die Kürzel, die für die
    Antragsbearbeitung zählen; es grenzt Navigator, Wächter und die
    Status-Erklärung ein.
  - Trägt ein Kürzel Trigger-Zeilen, steht neben dem Code ein **Blitz mit
    Anzahl** — Klick klappt auf, was das Setzen in C16 auslöst (Satzform).
    Jede Zeile beginnt mit `Richtlinie/Folge`, weil dasselbe Kürzel je
    Richtlinie etwas anderes auslöst.
  - „Ordner bearbeiten" ist ein **Baum**: Zweige klappen zu, Ziehen **am Griff**
    hängt um, F2 benennt um, Rechtsklick öffnet Umbenennen · Stilllegen ·
    Entfernen. Verbund und Teilvorhaben bleiben getrennte Bäume — ein Ordner
    wechselt die Ebene nicht.
  - Übernahme-Blöcke erscheinen nur, solange sie etwas bewirken: Auslieferung
    nachziehen, Bezeichnung/Rollen der Kürzel-Zuarbeit übernehmen, die beiden
    Phasenvorschläge, **AB-Dashboard-Spalten als relevant markieren** (setzt nur,
    nimmt nie weg), gefundene CSV-Spalten einsortieren. Für die übrigen Rollen
    dieselbe Aktion, gespeist aus „wird gesetzt von" statt aus einer erfundenen
    Liste; Kürzel, die jeder setzen darf, bleiben außen vor.
  - Filter: Ebene, Rolle, „nur relevante", „nur mit CSV-Spalte", „ohne Phase".
- **To-dos**: die To-do-Kaskade — geordnet, die erste zutreffende Regel gewinnt.
  Weicht der ausgelieferte Regelsatz von der gepflegten Fassung ab, steht das
  oben mit Bilanz („4 neue Regeln · 6 geändert · 1 entfallen") und einem
  Nachziehen-Knopf; Nachziehen ersetzt die gelieferten Regeln, legt entfallene
  still und lässt eigene unangetastet. Eine Bedingung auf eine Spalte, die der
  Katalog nicht führt, wird als Fehler angezeigt („trifft nie zu").
  Die Reihenfolge IST das Ergebnis, deshalb wird sie über Pfeile gesetzt, nicht
  per Ziehen. Jede Regel liest sich als deutscher Satz („WENN Status 71 und
  D_ARQ leer → To-do «RNE ergänzen», zuständig AB").
  - **Zwei Ansichten, ein Reiter**: ohne geöffnete Regel steht die ganze Kaskade
    als Karten über die volle Breite (Nummer, Pfeile, Satz, Zustand,
    „Bearbeiten"). Ein Klick teilt die Ansicht: links die schlanke Liste mit
    Markern für Sperre, stillgelegt und „trifft nie zu", rechts die Regel mit
    Editor. Die Trennlinie ist ziehbar und ihre Lage bleibt erhalten; Esc bringt
    die Karten zurück.
  - In der geteilten Ansicht stehen die **Positions-Pfeile im Regel-Kopf**
    („Position 5 von 27"), weil die schlanken Zeilen selbst nur die Auswahl
    tragen. Erklärtext, Nachziehen-Hinweis und die Tagesordnung erscheinen nur,
    solange keine Regel geöffnet ist — sie brauchen die volle Breite.
  - **Regelsatz je Rolle**: über der Liste stehen Reiter (AB, FB, weitere sobald
    dort Regeln existieren). Ausgewertet wird immer genau ein Satz. Sperren
    gelten vorgangsweit und erscheinen deshalb in jedem Reiter, dort mit dem
    Hinweis „gilt für alle Regelsätze" und ohne Pfeile — verschoben werden sie
    in ihrem eigenen Satz.
  - **Rollout-Sperre**: Regeln außerhalb von AB entstehen stillgelegt, Aktivieren
    fragt nach. Grund steht am Reiter: die Katalog-Datei gilt für alle
    Installationen gleichzeitig, und ältere App-Fassungen würden eine fremde
    Regel in der AB-Kaskade mitwerten.
  - **Tagesordnung statt Leerzustand**: für einen Satz ohne eigene Regeln zeigt
    der Reiter, in welchen Situationen die bestehenden Regeln heute auf diese
    Rolle warten — mit Anzahl, Herkunftsregel und Beispiel-Aktenzeichen. Aus
    jeder Zeile lässt sich die fehlende Regel direkt anlegen, vorbefüllt mit der
    Bedingung, die schon feststeht. Jede Zeile trägt **zwei** Zahlen: wie oft die
    Rolle das To-do heute geliehen sieht, und wie oft die Bedingung der
    Herkunftsregel im Bestand überhaupt zutrifft. Die zweite ist die Reichweite
    einer eigenen Regel und regelmäßig ein Vielfaches der ersten.
  - Daneben die Zahl der Vorgänge **ohne To-do in jedem Regelsatz**, bei denen
    ein Kürzel-Paar einseitig offen steht — die fachlichen Lagen, für die die
    bestehende Kaskade blind ist, mit Median-Standzeit je Paar.
  - **Erhebung exportieren** legt diese drei Auswertungen als Arbeitsmappe ab,
    plus eine Kurzfassung für die Einladung zum Fachtermin. Der Export braucht
    kein Schreibrecht — er nimmt nichts mit auf den Daten-Ordner.

## Versionen

Änderungen sind ein **Entwurf**; „Für das Team speichern" legt eine Fassung an.
Ältere Fassungen sind als Entwurf ladbar.

Weil den Katalog mehrere Personen pflegen, wird vor dem Veröffentlichen
nachgesehen, was inzwischen auf dem Daten-Ordner liegt. Fremde Fassungen, die
dieser Rechner nicht kennt, wandern dabei in die Fassungsliste — sie gehen nie
verloren, auch wenn danach eine andere gilt.

Hat jemand anderes zwischenzeitlich veröffentlicht, wird **nichts geschrieben**;
eine Meldung nennt Nummer, Kürzel und Zeitpunkt der fremden Fassung. Die eigene
Arbeit ist da bereits als neue Fassung gespeichert — offen ist nur die
Veröffentlichung. Zwei Wege:

- **Fremde Fassung laden** — sie gilt danach für das Team; vorher steht da, in
  wie vielen Einträgen sich beide unterscheiden. Die eigene bleibt in der Liste
  und ist wieder als Entwurf ladbar.
- **Trotzdem veröffentlichen** — die eigene gilt danach; die Änderungen der
  fremden sind darin nicht enthalten, sie bleibt aber erhalten.

„Später entscheiden" schließt die Meldung; im Seitenkopf bleibt der Hinweis, dass
die eigene Fassung noch nicht veröffentlicht ist. Liegt beim Zurückkommen ins
Fenster eine neuere Fassung vor, steht auch das im Seitenkopf — mit Knopf zum
Laden. Umgeschaltet wird nie von allein.

## Wichtig

- Der Katalog gilt **team-weit**: Speichern legt ihn auf dem Daten-Share ab, alle
  übernehmen ihn beim nächsten App-Start. Ohne erreichbaren Share bleibt die
  Fassung lokal — die Seite sagt das und bietet „Erneut veröffentlichen" an.
- Zwei Fassungen werden **nie inhaltlich zusammengeführt**. Zusammengeführt wird
  allein die Liste der Fassungen; welche gilt, entscheidet ein Mensch.
- Die **Historie** (Statusverlauf) bleibt auf dem eigenen Rechner: sie hält fest,
  wann er eine Änderung gesehen hat.
- JSON-Export/Import dient der Sicherung, nicht dem Team-Abgleich.
- Ändert nichts am Legacy-System — reine Anzeige und Einordnung.
- Die **Parametertabelle** („Erklärung Parameter") ist eine Legende ohne
  Kopfzeile: Wert · Erklärung · Kategorie. Codes entstehen **nur** aus den Zeilen
  der Kategorie „Status"; was übersprungen wird, nennt die Vorschau nach Art
  („4 Statuscodes übernommen · übersprungen: 2 Textbausteine, 3 Bearbeiter").
  Bearbeiter-Kürzel und die Nummern 210/211 werden gegen die Annahme der App
  geprüft; Abweichungen stehen als Hinweis, gespeichert wird davon nichts. Eine
  reine Code/Text-Tabelle wird weiter gelesen.
- Die **Trigger-Tabelle gilt je Richtlinie**. Der Bereich „Referenzdaten" nennt
  Stand, Zeilenzahl und Programme; die Vorschau zählt Zeilen und Kürzel je
  Programm und nennt die Programme des Bestands, für die die Datei nichts führt
  (mit Antragszahl). Zeilen aus einem Import vor v2.380 tragen keine Richtlinie
  und greifen an keinem Vorhaben — die Seite bittet um einen neuen Import. Kürzel
  ohne Katalog-Eintrag meldet die Vorschau als Warnung, die vier geklärten
  (`ID` = Rollenvergabe, `TTV1`/`TTV2`/`TVB1` = Testkürzel) nur als Hinweis.
- Die **Journal-Frische** steht als dritte Angabe unter „Referenzdaten", schon in
  der Kopfzeile: letzter Stempel mit Alter, Einträge des laufenden Monats,
  Nullpunkt. Nach mehr als drei Tagen ohne journalisierten Export warnt die Seite
  und nennt die Folge — Änderungen aus dieser Zeit sind danach nur noch als
  **Zeitraum** erfassbar, nicht als Datum. Ohne Journal steht „noch nicht
  angelegt" statt einer leeren Angabe. Keine Bearbeiter-Angabe — das Journal
  führt keine.
- **Referenzdaten** und **Versionen** stehen in den Reitern Katalog und Kürzel.
  Der Reiter To-dos füllt die Höhe stattdessen mit der geteilten Regel-Ansicht,
  deren beide Spalten für sich scrollen.

## Technik

**Route & Sichtbarkeit:** `/status-cockpit`, Flag `statusCockpit`; dev/pl/kurator.

**Datenmodell dahinter:** Katalog als Team-Sidecar `_intern/status-katalog.json` (Zugriff nur über `katalog-share.ts`), Event-Log `status_event` + Unkuratiert-Puffer gerätelokal. Siehe `docs/status-system/README.md` und `KATALOG-CODES.md`.
