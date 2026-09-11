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
  Schalter „aktiv" und „Frist") plus Fassungs-Leiste und frühere Fassungen.

  - Das Dreieck klappt die **Unter-Meilensteine** auf; ein Klick auf die Zeile
    öffnet **darunter** Beschreibung, Antragstyp-Filter und den Bereich
    **„Erfüllt, wenn"**: Bedingungen aus Feld, Vergleich und Wert aus den
    gemappten CSV-Spalten, zusammengefasst in Gruppen.

  - **Quellspalten**: Wer die Kurzform der Bedingung überfährt (auch in der
    Leiste und unter „Diese Woche" an der Bezeichnung), sieht, aus welchen
    CSV-Spalten sie liest — je Feld Code und Label, dazu die Regel „erfüllt,
    sobald ein Teilvorhaben sie trägt; Ist-Termin = der Tag, an dem die
    Bedingung wahr wurde — bei „alle" das späteste, bei „eine" das früheste
    Datum der erfüllten Bedingungen". Dieselbe Regel steht neben der Auswahl
    „Ist-Termin", solange dort kein eigenes Feld gewählt ist. Mappt ein
    Programm ein Feld nicht, steht das dabei. Der Feld-Wähler zeigt die
    Quellspalte kurz hinter dem Feldnamen („Antrags eingang · antragsdatum
    ← D_AAE").

  - **Die zugeklappte Zeile sagt, woran der Meilenstein hängt**: Bedingung in
    Kurzform, Antragstyp-Beschränkung (nur wenn es eine gibt), Ist-Termin-Feld
    und die Zahl der Unter-Meilensteine. Eine benannte Gruppe steht dort mit
    ihrem Namen vor dem Inhalt („PreCheck AB: (…)"). Das Bezeichnungsfeld ist
    dafür schmaler und bricht bei langen Titeln auf zwei Zeilen um.

  - **Das Feld einer Bedingung wird in einer Auswahl-Tabelle gewählt**, nicht in
    einem Auswahlfeld: Suche über Kürzel, Beschreibung und rohen Spalten-Code,
    sortierbare Spaltenköpfe, Filter für Datum/Wert und kanonisch/CSV, Bedienung
    per ↑/↓/Enter. Passt die Bezeichnung des Meilensteins zu Spalten, stehen
    diese oben als **Vorschlag** mit dem Wort, das sie ausgelöst hat. Ein
    Meilenstein ohne Bedingung bekommt zusätzlich eine Zeile „Vorschlag …
    Übernehmen" — der Vorschlag wird nie von selbst gesetzt. Feld und Vergleich
    stehen in festen Spalten, damit die Zeilen einer Gruppe untereinander
    fluchten.

  - **Alle oder eine**: oben im Bereich und im Kopf jeder Gruppe legt ein
    Schalter „alle | eine" fest, wie die Bedingungen zusammenwirken. Oben liest
    sich das als Satz („Erfüllt, wenn alle der folgenden zutreffen" bzw. „eine
    der folgenden zutrifft"), in einer Gruppe als „alle müssen zutreffen" bzw.
    „eine genügt". Zwischen den Zeilen steht links klein „und" bzw. „oder",
    auch vor und hinter einem Gruppenkasten. Eine Gruppe neben Bedingungen ist
    damit erkennbar deren **Nachbarin**, keine Untergruppe.

  - **Gruppen tragen einen Namen**: ohne Namen steht grau „Gruppe 1",
    „Gruppe 2" im Kopf; hineinklicken und tippen benennt sie („PreCheck AB").
    Enter oder Wegklicken übernimmt, Esc verwirft. Der Name ist ein Etikett —
    an der Auswertung ändert er nichts. Am Fuß jeder Gruppe sagt „+ Bedingung
    in „PreCheck AB"", wohin eine neue Bedingung kommt; „+ Gruppe" oben neben
    dem Schalter legt eine Gruppe auf **derselben** Ebene an.

  - **Gruppen klappen zu**: der Pfeil vor dem Namen klappt eine Gruppe
    zusammen. Sie zeigt dann „alle müssen zutreffen · …" bzw. „eine genügt · …"
    mit ihrer Regel in einem Satz; wer ihn überfährt, sieht die Quellspalten.
    Nach dem Verschieben, Ein- oder Ausrücken, Verpacken oder Entfernen klappen
    alle Gruppen wieder auf.

  - **Umhängen über Griff und Menü**: jede Bedingung und jede Gruppe trägt
    direkt hinter ihrem Inhalt einen Griff zum Ziehen und ein Menü (⋯) mit
    „Nach oben", „Nach unten", „Eine Ebene höher — hinter die eigene Gruppe",
    „In die Gruppe darüber", „In eine eigene Gruppe verpacken" und
    „entfernen". Das Menü geht auch per Tastatur (Tab, Enter, Pfeiltasten).
    Was gerade nicht geht, bleibt im Menü stehen und nennt in einer zweiten
    Zeile den Grund. Eingerückt wird nur in eine Gruppe, die schon darüber
    steht.

  - **Beim Ziehen einer Bedingung zeigen sich alle möglichen Ablagestellen.**
    Zwischen zwei Zeilen legt eine Linie sie dort ab, auf einen Gruppenkasten
    gezogen landet sie in dieser Gruppe.

  - **Probe am Bestand**: sobald der erste Regel-Bereich aufgeht, lädt die
    Seite einmal die Verbünde der Richtlinie 2025 und rechnet danach bei jeder
    Änderung sofort mit. Unter dem Bereich steht dann etwa „Probe · Richtlinie
    2025: erfüllt bei 988 von 1.094 offenen · 347 von 429 abgeschlossenen ·
    unverändert gegenüber Fassung 37". Ändert sich die Regel, stehen die
    Differenzen zur freigegebenen Fassung dahinter, etwa „(−985)". Der Tooltip
    nennt, über wie viele Verbünde gezählt wurde, den Stand und die Ladezeit.

  - Im Kopf jeder Gruppe steht knapp, was sie allein trifft („trifft
    1.000/1.094 offen · 359/429 abgeschl."). Gezählt wird nur über Verbünde,
    für die der Meilenstein gilt (Antragstyp-Filter). Ein inaktiver
    Meilenstein wird gezählt, als wäre er aktiv, und sagt das dazu; einer ohne
    Bedingung sagt „nichts zu zählen".

  - **Warum offen und abgeschlossen getrennt**: bei abgeschlossenen Verbünden
    sollte fast jeder Meilenstein erfüllt sein. Trifft eine Bedingung dort
    wenig, liest sie vermutlich die falsche Spalte. Eine Warnschwelle gibt es
    bewusst nicht — die Zahl steht da, das Urteil fällt die Projektleitung.

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

Bedingungs-Editor: `BedingungEditor.tsx` + `ZeilenAktionen.tsx` (⋯-Menü) +
`BlattZeile.tsx`, geteilt mit den To-do-Regeln des Status-Cockpits und dem
Dialog „Eigene Spalte". Gruppenname = optionales `name` an `{alle}`/`{einige}`
der `Bedingung`, max. 80 Zeichen, ohne Wirkung auf `pruefeBedingung`; Builds vor
v6.59 verwerfen ihn beim Lesen. Probe: `probe.ts` (rein), `useMeilensteinProbe.ts`
(lädt die Richtlinie 2025 einmal), `ProbeAnzeige.tsx`; nur im Meilenstein-Modul.
Spec: `docs/superpowers/specs/2026-09-11-bedingungs-editor-gruppen.md`.
