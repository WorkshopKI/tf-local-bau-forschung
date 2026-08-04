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
    eine Vorschau (Status, Ebene, Phase, Stichprobe, alt → neu) und die Übernahme
    aller Vorschläge in einem Schritt. Übernommen werden nur die Phasen Eingang
    bis Entscheidung und nur ab fünf Beobachtungen — Statuswerte mit kleinerer
    Stichprobe stehen darunter namentlich als „zu wenig Daten".
- **Kürzel**: der **Ordnerbaum des Fachsystems** (505 Einträge), Verbund und
  Teilvorhaben getrennt.
  - Editierbar je Eintrag: Bezeichnung, Ordner, **wird gesetzt von**
    (AB/FB/QS/PA/Juristen, Mehrfachauswahl; leer = jeder darf), **relevant**,
    Prominenz und die **ZAH-Phase** des Datums. Die Phase beantwortet „welches
    Datum gehört zum aktuellen Status?" — sie speist die „seit"-Angabe der
    Status-Erklärung und die Marke in der Chronik. Leer heißt ehrlich „trägt
    nichts bei"; nur 24 der 505 Kürzel tragen eine, weil eine geratene Zuordnung
    schlechter wäre als keine. Bei Wert-Feldern hängt die Phase am Wert.
  - Das **Relevanz-Häkchen** markiert die Kürzel, die für die
    Antragsbearbeitung zählen; es grenzt Navigator, Wächter und die
    Status-Erklärung ein.
  - Trägt ein Kürzel Trigger-Zeilen, steht neben dem Code ein **Blitz mit
    Anzahl** — Klick klappt auf, was das Setzen in C16 auslöst (Satzform).
    Jede Zeile beginnt mit `Richtlinie/Folge`, weil dasselbe Kürzel je
    Richtlinie etwas anderes auslöst.
  - „Ordner bearbeiten" ist ein **Baum**: Zweige klappen zu (Klick oder
    Pfeiltasten), Ziehen **am Griff** hängt um, F2 oder Doppelklick benennt um.
    Rechtsklick öffnet Umbenennen · Stilllegen · Entfernen. Verbund und
    Teilvorhaben bleiben getrennte Bäume — ein Ordner wechselt die Ebene nicht.
  - Vier Übernahme-Blöcke: Auslieferung nachziehen, Bezeichnung/Rollen der
    Kürzel-Zuarbeit übernehmen, **AB-Dashboard-Spalten als relevant markieren**
    (setzt nur, nimmt nie weg), gefundene CSV-Spalten einsortieren. Für die
    übrigen Rollen gibt es dieselbe Aktion, gespeist aus der Zuarbeit-Spalte
    „wird gesetzt von" statt aus einer erfundenen Liste; Kürzel, die jeder
    setzen darf, bleiben dabei außen vor.
  - Filter: Ebene, Rolle, „nur relevante", „nur mit CSV-Spalte".
- **To-dos**: die To-do-Kaskade — geordnet, die erste zutreffende Regel gewinnt.
  Weicht der ausgelieferte Regelsatz von der gepflegten Fassung ab, steht das
  oben mit Bilanz („4 neue Regeln · 6 geändert · 1 entfallen") und einem
  Nachziehen-Knopf; Nachziehen ersetzt die gelieferten Regeln, legt entfallene
  still und lässt eigene unangetastet. Eine Bedingung auf eine Spalte, die der
  Katalog nicht führt, wird als Fehler angezeigt („trifft nie zu").
  Die Reihenfolge IST das Ergebnis, deshalb wird sie über Pfeile gesetzt, nicht
  per Ziehen. Jede Regel liest sich als deutscher Satz („WENN Status 71 und
  D_ARQ leer → To-do «RNE ergänzen», zuständig AB").
  - **Regelsatz je Rolle**: über der Liste stehen Reiter (AB, FB, weitere sobald
    dort Regeln existieren). Ausgewertet wird immer genau ein Satz. Sperren
    gelten vorgangsweit und erscheinen deshalb in jedem Reiter, dort mit dem
    Hinweis „gilt für alle Regelsätze" und ohne Pfeile — verschoben werden sie
    in ihrem eigenen Satz.
  - **Rollout-Sperre**: Regeln außerhalb von AB entstehen immer stillgelegt, und
    das Aktivieren fragt nach. Grund steht dauerhaft am Reiter: die Katalog-Datei
    gilt für alle Installationen gleichzeitig, und ältere Fassungen der App
    würden eine fremde Regel in der AB-Kaskade mitwerten.
  - **Tagesordnung statt Leerzustand**: für einen Satz ohne eigene Regeln zeigt
    der Reiter, in welchen Situationen die bestehenden Regeln heute auf diese
    Rolle warten — mit Anzahl, Herkunftsregel und Beispiel-Aktenzeichen. Aus
    jeder Zeile lässt sich die fehlende Regel direkt anlegen, vorbefüllt mit der
    Bedingung, die schon feststeht. Die Anzahl ist eine **Untergrenze**: eine
    eigene Regel steht in ihrem Satz allein und trifft meist deutlich mehr.
  - Daneben die Zahl der Vorgänge **ohne To-do in jedem Regelsatz**, bei denen
    ein Kürzel-Paar einseitig offen steht — die fachlichen Lagen, für die die
    bestehende Kaskade blind ist, mit Median-Standzeit je Paar.
  - **Erhebung exportieren** legt diese drei Auswertungen als Arbeitsmappe ab,
    plus eine Kurzfassung für die Einladung zum Fachtermin. Der Export braucht
    kein Schreibrecht — er nimmt nichts mit auf den Daten-Ordner.

## Versionen

Änderungen sind ein **Entwurf**; „Für das Team speichern" legt eine Fassung an.
Ältere Fassungen sind als Entwurf ladbar.

## Wichtig

- Der Katalog gilt **team-weit**: Speichern legt ihn auf dem Daten-Share ab, alle
  übernehmen ihn beim nächsten App-Start. Ohne erreichbaren Share bleibt die
  Fassung lokal — die Seite sagt das und bietet „Erneut veröffentlichen" an.
- Die **Historie** (Statusverlauf) bleibt auf dem eigenen Rechner: sie hält fest,
  wann er eine Änderung gesehen hat.
- JSON-Export/Import dient der Sicherung, nicht dem Team-Abgleich.
- Ändert nichts am Legacy-System — reine Anzeige und Einordnung.
- Die **Parametertabelle** („Erklärung Parameter") ist eine Legende ohne
  Kopfzeile: Wert · Erklärung · Kategorie. Codes entstehen **nur** aus den Zeilen
  der Kategorie „Status"; was übersprungen wird, nennt die Vorschau nach Art
  („4 Statuscodes übernommen · übersprungen: 2 Textbausteine, 3 Bearbeiter,
  2 Zuordnungen"). Bearbeiter-Kürzel und die Bezugsdatei-Nummern 210/211 werden
  gegen das geprüft, was die App annimmt — Abweichungen stehen als Hinweis in der
  Vorschau, gespeichert wird davon nichts. Eine reine Code/Text-Tabelle wird
  weiterhin gelesen.
- Die **Trigger-Tabelle gilt je Richtlinie**. Der Bereich „Referenzdaten" nennt
  Stand, Zeilenzahl und die geführten Programme; die Vorschau vor der Übernahme
  zählt Zeilen und Kürzel je Programm und nennt die Programme des Bestands, für
  die die Datei nichts führt (mit Antragszahl). Zeilen aus einem Import vor
  v2.380 tragen keine Richtlinie und greifen an keinem Vorhaben — die Seite sagt
  das und bittet um einen neuen Import.
- Die **Journal-Frische** steht als dritte Angabe im Bereich „Referenzdaten" —
  schon in der Kopfzeile, weil der Bereich eingeklappt startet: letzter Stempel
  mit Datum und Alter, Einträge des laufenden Monats, Nullpunkt der Historie.
  Ist seit mehr als drei Tagen kein Export journalisiert worden, warnt die Seite
  und nennt die Folge: Änderungen aus dieser Zeit lassen sich danach nur noch als
  **Zeitraum** erfassen, nicht als Datum. Gibt es noch kein Journal, sagt die
  Seite das ausdrücklich („noch nicht angelegt") statt eine leere Angabe zu
  zeigen. Keine Bearbeiter-Angabe — das Journal führt keine.
- Im Tab **To-dos** trägt jede Platzhalter-Zeile **zwei** Zahlen: wie oft die
  Rolle das To-do heute geliehen sieht, und wie oft die Bedingung der
  Herkunftsregel im Bestand überhaupt zutrifft. Die zweite ist die Reichweite
  einer eigenen Regel und regelmäßig ein Vielfaches der ersten.

## Technik

**Route & Sichtbarkeit:** `/status-cockpit`, Flag `statusCockpit`; dev/pl/kurator.

**Datenmodell dahinter:** Katalog als Team-Sidecar `_intern/status-katalog.json` (Zugriff nur über `katalog-share.ts`), Event-Log `status_event` + Unkuratiert-Puffer gerätelokal. Siehe `docs/status-system/README.md` und `KATALOG-CODES.md`.
