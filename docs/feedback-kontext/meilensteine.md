# Fristen & Meilensteine

## Zweck

Der amtliche Status sagt, WO ein Verbund steht — dieses Modul, ob er dort
**rechtzeitig** steht. Ziel ist die vollständige Bearbeitung binnen einer
Gesamtfrist (Standard 90 Tage) ab dem **wirksamen Eingang**, unterteilt in
Meilensteine mit Soll-Wochen (MST 1 … 6). Wirksamer Eingang heißt: je
Teilvorhaben das spätere aus Antragseingang (`D_AAE`) und „alle Anträge da"
(`D_XTE`), über alle Teilvorhaben das späteste. Ab diesem einen Datum zählen
Soll-Termine, Bearbeitungswoche, Gesamtfrist und die Dauern der Auswertung —
dasselbe Datum, von dem auch die Frist-Spalte der Förderanträge rechnet. Der
Tooltip an „Gesamtfrist" und an „Eingang" nennt die beiden Spalten.

## Bereiche

- **Betrachtungsbereich-Chip** im Seitenkopf: er sagt, welche Förder-Richtlinien zum Arbeitsvorrat zählen. Wie viele Verbünde das ausblendet, steht im Tooltip — im Chip selbst erst, wenn jemand vom Standard-Bereich abweicht. Klick öffnet die Auswahl. Der Eingangs-Zeitraum darunter ist davon unabhängig — „Alle Eingänge" holt weiter jeden Jahrgang, aber innerhalb des gewählten Bereichs.

- **Eingang** (Kopfzeile, gilt für alle drei Listen-Bereiche samt deren Zählern):
  Jahres-Chips als Kurzwahl auf ein einzelnes Jahr, „Letzte 3 Jahre" als Rückweg
  zur Vorbelegung, taggenaue Von-Bis-Felder, „Alle Eingänge" — **vorbelegt mit dem
  laufenden Jahr und den beiden davor**. Ältere Vorgänge sind kein Rückstand,
  sondern Altbestand mit unsauber gesetzten Status im Fachsystem; über „Alle
  Eingänge" bleiben sie erreichbar. Bezug ist der Antragseingang; Vorgänge ohne
  Antragsdatum sind nur unter „Alle Eingänge" sichtbar.
- **Übersicht**: links je offener Verbund eine Zeile (Akronym, Antragstyp,
  laufende Woche, ein Zustands-Punkt je Haupt-Meilenstein, Restzeit), rechts der
  Zeitstrahl — Soll hohle Raute, Ist gefüllter Punkt. Filter: Typ, Prognose,
  Suche, „nur meine"; nach Dringlichkeit sortiert.
- **Diese Woche**: überfällige und in sieben Tagen fällige Meilensteine der
  Verbünde im gewählten Eingangs-Zeitraum. Standardmäßig **nach Verbund gebündelt** (Schalter
  „nach Verbund"): eine Zeile je Vorhaben, die den dringendsten Punkt nennt
  („hängt seit 1.2 Antrag zugewiesen" bzw. „nächster …") plus die Zahl der offenen
  Meilensteine; Klick klappt sie auf, das Pfeil-Symbol rechts führt zum Verbund.
  Die Abschnitte Überfällig / Diese Woche fällig bleiben getrennt.
- **Auswertung**: Ø-Dauer, Median, Anteil im Soll und Abweichung — gesamt und je
  FuE/DS/DL/NW; je Meilenstein Soll-Woche, Ø Ist-Woche, Δ und Reißquote. Die
  Dauer-Statistik zählt abgeschlossene Vorgänge, die Meilenstein-Statistik offene.
- **Konfiguration**: der Meilenstein-Baum (Nummer, Bezeichnung, Soll-Woche,
  Schalter „aktiv" und „Frist", daneben „gilt für" mit den Antragstypen als
  Chips) plus Fassungs-Leiste und frühere Fassungen.

  - Das Dreieck klappt die **Unter-Meilensteine** auf; ein Klick auf die Zeile
    öffnet **darunter** eine leise Zeile für die Beschreibung und den Bereich
    **„Erfüllt, wenn"**: Bedingungen aus Feld, Vergleich und Wert aus den
    gemappten CSV-Spalten, zusammengefasst in Gruppen. Klicks in den Bereich
    selbst klappen ihn nicht zu.

  - **Quellspalten**: Wer die Kurzform der Bedingung überfährt (auch in der
    Leiste und unter „Diese Woche" an der Bezeichnung), sieht, aus welchen
    CSV-Spalten sie liest — je Feld Code und Label, dazu die Regel „erfüllt,
    sobald ein Teilvorhaben sie trägt; Ist-Termin = der Tag, an dem die
    Bedingung wahr wurde — bei „alle" das späteste, bei „eine" das früheste
    Datum der erfüllten Bedingungen". Neben der Auswahl „Ist-Termin" steht
    diese Regel übersetzt auf den gerade offenen Meilenstein. Mappt ein
    Programm ein Feld nicht, steht das dabei. Der Feld-Wähler zeigt die
    Quellspalte kurz hinter dem Feldnamen („Antrags eingang · antragsdatum
    ← D_AAE").

  - **Die zugeklappte Zeile sagt, woran der Meilenstein hängt**: Bedingung in
    Kurzform, Ist-Termin-Feld und die Zahl der Unter-Meilensteine (die
    Antragstypen stehen als Chips „gilt für" im Kopf). Eine benannte Gruppe steht dort mit
    ihrem Namen vor dem Inhalt („PreCheck AB: (…)"). Das Bezeichnungsfeld ist
    dafür schmaler und bricht bei langen Titeln auf zwei Zeilen um.

  - **Das Feld einer Bedingung wird in einer Auswahl-Tabelle gewählt**, nicht in
    einem Auswahlfeld: Suche über Kürzel, Beschreibung und rohen Spalten-Code,
    sortierbare Spaltenköpfe, Filter für Datum/Wert und kanonisch/CSV, Bedienung
    per ↑/↓/Enter. Passt die Bezeichnung des Meilensteins zu Spalten, stehen
    diese oben als **Vorschlag** mit dem Wort, das sie ausgelöst hat. Ein
    Meilenstein ohne Bedingung bekommt zusätzlich eine Zeile „Vorschlag …
    Übernehmen" — der Vorschlag wird nie von selbst gesetzt. In der Karte steht
    der Feldname schlicht mit gepunkteter Unterlinie, darunter Vergleich und
    Wert.

  - **Karten nebeneinander**: jede Gruppe steht als Karte, eine einzelne
    Bedingung als kleine Karte, eine Gruppe in einer Gruppe als Innenkarte.
    Darüber steht die Regel in einem Satz, etwa „Erfüllt, wenn „PreCheck AB"
    und „PreCheck FB" zutreffen." — wer ihn überfährt, sieht die Quellspalten.
    Im Kopf einer Karte steht, wie ihre Bedingungen zusammenwirken („alle
    müssen zutreffen" bzw. „eine genügt").

  - **„und" und „oder" sind Schalter**: zwischen zwei Karten und zwischen zwei
    Bedingungen steht eine getönte Pille „und" bzw. „oder". Ein Klick schaltet
    die Verknüpfung dieser Gruppe um — alle Pillen derselben Gruppe wechseln
    zugleich. Einen eigenen Schalter „alle | eine" gibt es nicht mehr, und
    Gruppen klappen nicht einzeln zu: die Karten sind kompakt, der Satz oben
    sagt die Regel.

  - **Anlegen**: die gestrichelte Karte am Ende legt eine einzelne Bedingung
    oder eine neue Gruppe an; am Fuß jeder Karte stehen „+ Bedingung" und
    „+ Gruppe" (eine Gruppe in dieser Karte). Eine leere Gruppe sagt dazu, was
    sie bedeutet: „Leer = immer erfüllt" bzw. „Leer = nie erfüllt".

  - **Gruppen tragen einen Namen**: ohne Namen steht grau „Gruppe 1",
    „Gruppe 2" im Kartenkopf (in einer Innenkarte „Gruppe 1.1");
    hineinklicken und tippen benennt sie („PreCheck AB"). Enter oder
    Wegklicken übernimmt, Esc verwirft. Der Name ist ein Etikett — an der
    Auswertung ändert er nichts.

  - **Menü (⋯) an Karte und Bedingung**: Griff und Menü erscheinen an der
    Bedingung unter der Maus (oder per Tab). Eine Karte lässt sich nach links
    oder rechts schieben, duplizieren (eine benannte heißt dann „… (Kopie)"),
    auflösen, aus ihrer Gruppe lösen und entfernen. Beim Auflösen sagt der
    Eintrag vorher, ob sich die Aussage der Regel ändert („Auflösen — ändert
    nichts" bzw. „Auflösen — ändert die Aussage").

  - Eine Bedingung lässt sich nach oben oder unten schieben (als eigene Karte:
    nach links oder rechts), zur Gruppe machen bzw. in eine eigene Gruppe
    verpacken, in die Gruppe davor schieben, aus der Gruppe lösen und
    entfernen. Das Menü geht auch per Tastatur (Tab, Enter, Pfeiltasten). Was
    gerade nicht geht, bleibt stehen und nennt in einer zweiten Zeile den
    Grund.

  - **Ziehen am Griff** verschiebt eine Bedingung an eine andere Stelle oder in
    eine andere Karte. Sobald man zieht, zeigen sich die Ablagestellen:
    zwischen zwei Bedingungen eine Linie, auf eine Karte gezogen landet sie am
    Ende dieser Karte, in der Lücke zwischen den Karten als eigene Karte am
    Ende. Karten selbst wandern über das Menü.

  - **Zahlen am Bestand**: sobald der erste Regel-Bereich aufgeht, lädt die
    Seite einmal die Verbünde der Richtlinie 2025 und rechnet danach bei jeder
    Änderung sofort mit. Jede Zahl trägt ihre Beschriftung: im Kopf jeder Karte
    etwa „trifft 1.000 offen · 359 abgeschl." mit einem Balken, an jeder
    Bedingung etwa „872 offen · 213 abgeschl.". Wer eine Zahl überfährt, sieht
    die Gesamtzahlen dazu. Gezählt wird nur über Verbünde, für die der
    Meilenstein gilt.

  - **Die Wirkungsleiste** unter den Karten hat drei Spalten. „Probe": etwa
    erfüllt bei 988 von 1.094 offenen und 347 von 429 abgeschlossenen
    Verbünden, je mit Balken. „Gegenüber Fassung 37": unverändert oder
    geändert, darunter etwa „offen +92 · abgeschlossen +68". „Ist-Termin": die
    Auswahl eines Datumsfelds und ein Satz, woher der Termin bei genau dieser
    Regel kommt, etwa „Hier: das spätere Datum von Gruppe 1 und Gruppe 2; je
    Gruppe das frühere ihrer gefüllten Datumsspalten."

  - **Befunde**: eine gelbe Marke steht nur bei einer Tatsache, nie bei einer
    Schwelle. Eine Bedingung „trifft keinen Verbund" oder „trifft jeden
    Verbund" (dann steht dabei, was die Regel ohne sie träfe); ein Meilenstein
    ist „erfüllt bei allen" oder „erfüllt bei keinem"; die Regel liefert „kein
    Datum"; oder etwa „224 ohne Termin": so viele offene Verbünde gelten als
    erreicht, haben aber kein Ist-Datum und fehlen damit in jeder Abweichung.
    Ein Punkt in der Meilenstein-Zeile zeigt Befunde auch zugeklappt.

  - Ausnahme: ein Meilenstein, der nur verlangt, dass sein Ist-Termin-Feld
    gefüllt ist (etwa „Antrag im System eingegeben"), soll bei jedem Verbund
    zutreffen und bekommt deshalb keinen Befund.

  - **Feld-Suche mit Treffern**: in der Auswahl-Tabelle eines Felds zeigt die
    Spalte „offen · abg.", bei wie vielen offenen und abgeschlossenen Verbünden
    das Feld gefüllt ist — auch für Felder, die der Plan noch nicht benutzt.

  - **Warum offen und abgeschlossen getrennt**: bei abgeschlossenen Verbünden
    sollte fast jeder Meilenstein erfüllt sein. Trifft eine Bedingung dort
    wenig, liest sie vermutlich die falsche Spalte. Eine Warnschwelle gibt es
    bewusst nicht — die Zahl steht da, das Urteil fällt die Projektleitung.
    Ein inaktiver Meilenstein wird gezählt, als wäre er aktiv, und sagt das
    dazu; einer ohne Bedingung sagt „nichts zu zählen".

  - **Sammel-Meilenstein**: hat ein Meilenstein keine eigene Bedingung, aber
    Unter-Meilensteine, zeigt er diese als Karten mit ihren Zahlen; ein Klick
    öffnet den Unter-Meilenstein. Inaktive stehen gestrichelt daneben und
    „zählen nicht mit". Darunter lässt sich trotzdem eine eigene Bedingung
    anlegen — dann ist er auch erreicht, sobald sie zutrifft.

  - **Mehrere Meilensteine bleiben gleichzeitig offen**, damit sich Regeln
    vergleichen lassen; die offene Zeile trägt links eine Kante, ein zweiter
    Klick schließt sie.

  - Umsortiert und untergeordnet wird per **Ziehen am Griff**: eine Marke zeigt
    die Einfügestelle, ein Rahmen das Hineinlegen. Als Zweitweg die Pfeile
    hoch/runter und „eine Ebene höher" (◁, nur an Unter-Meilensteinen).

  - Ein neuer Meilenstein erscheint **sofort** — aufgeklappt, mit dem Cursor in
    der Bezeichnung. Rechtsklick: Unter-Meilenstein anlegen · Eine Ebene höher ·
    Stilllegen · Löschen.

## Wichtig

- Die Seite startet auf **Diese Woche**. Tab, Zeitraum und Pills bleiben bis zum
  nächsten Öffnen erhalten (der Suchtext nicht); mit gesetztem Kürzel ist „nur
  meine" vorbelegt. Die Tab-Zähler zählen den Bereich, nicht die Listen-Filter.
- Der Plan ist eine Team-Datei auf dem Daten-Share: **schreiben darf nur die
  Projektleitung** (bzw. Kurator/dev), alle anderen sehen dieselbe Seite read-only.
- **Speichern und Freigeben sind zwei Schritte** — ausgewertet wird nur die
  zuletzt freigegebene Fassung. Ein neu geschnittener Plan, der nur gespeichert
  ist, ändert also nirgends eine Zahl; alle sehen weiter die vorige Freigabe.
  Das ist der häufigste Grund für „meine Änderung kommt nicht an".
- Meilensteine mit unbestätigter CSV-Zuordnung tragen „unbestätigt"; ohne bekannte
  Quelle sind sie inaktiv und gelten nie als gerissen.
- Derselbe Zeitstrahl steht auf der Verbund-Detailseite; dort lässt sich auch ein
  **Risiko melden** — die Meldung geht in den persönlichen Ordner, die PL sammelt
  sie ein.
- Das Home-Widget „Fristen" zeigt den Auszug für eigene Verbünde — eine Zeile je
  Vorgang, mit „N offen", wenn mehrere Meilensteine desselben Vorgangs anstehen.
- Nicht zu verwechseln mit den Projekt-Meilensteinen der Begleitphase
  (`MS01`–`MS03`) und der Anzeige-Prominenz „Meilenstein" der Status-Timeline.

## Technik

Alles ab hier bekommt nur die KI — der Hilfe-Dialog schneidet es weg
(`entferneTechnik` in `src/core/services/feedback/screenContext.ts`).

Vollbild-Seite (`/meilensteine`, Flag `meilensteinMonitoring`; dev/pl/as/kurator).
Plan als Team-Sidecar, Ansicht gemerkt in `ansichtPersistenz.ts`;
Architektur: `docs/architecture/meilensteine.md` (§ Der Bedingungs-Bereich,
§ Probe am Bestand).

Bedingungs-Editor: `BedingungEditor.tsx` (Karten, Innenkarten, Kopfsatz
`bedingungKopfsatz`) + `BlattZeile.tsx` (Zelle) + `BedingungsFugen.tsx`
(`Verbinder` = Schalter der Verknüpfung) + `ZeilenAktionen.tsx` (⋯-Menü, Einträge
vom Aufrufer), geteilt mit den To-do-Regeln des Status-Cockpits und dem Dialog
„Eigene Spalte"; Zahlen nur über Render-Props (`probe`, `trefferBlatt`,
`kennzahlFeld`). Gruppenname = optionales `name` an `{alle}`/`{einige}` der
`Bedingung`, max. 80 Zeichen, ohne Wirkung auf `pruefeBedingung`; Builds vor
v6.59 verwerfen ihn beim Lesen. Umbau rein in `bedingung-baum.ts`
(`dupliziereBedingung`, `loeseGruppeAuf`, `aufloesenAendertAussage`).

Probe: `probe.ts` (rein; `ohneDatum`, `probeBefund`), `ist-termin.ts`
(`istTerminErklaerung`, `istDatumsFeldAus`, `misstNurZeitpunkt`),
`useMeilensteinProbe.ts` (lädt die Richtlinie 2025 einmal; `zaehleFeld` für die
Feld-Suche), `ProbeAnzeige.tsx` (Karte, Bedingung, Wirkungsleiste); nur im
Meilenstein-Modul. Der Regelbereich trägt `data-regelbereich`, damit ein Klick
auf eine Karte die Zeile nicht zuklappt. Specs:
`docs/superpowers/specs/2026-09-11-bedingungs-editor-gruppen.md`,
`docs/superpowers/specs/2026-09-11-regelbereich-karten.md`.
