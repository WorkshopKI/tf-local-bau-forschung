# Fristen & Meilensteine

## Zweck

Der amtliche Status sagt, WO ein Verbund steht — dieses Modul, ob er dort
**rechtzeitig** steht. Ziel ist die vollständige Bearbeitung binnen einer
Gesamtfrist (Standard 90 Tage) ab Antragseingang, unterteilt in Meilensteine mit
Soll-Wochen (MST 1 … 6). Anker ist das **späteste** Antragsdatum aller
Teilvorhaben.

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
    öffnet **darunter** Beschreibung, Antragstyp-Filter und den
    Bedingungs-Editor — UND/ODER-Gruppen mit Feld, Operator und Wert aus den
    gemappten CSV-Spalten.

  - **Die zugeklappte Zeile sagt, woran der Meilenstein hängt**: Bedingung in
    Kurzform, Antragstyp-Beschränkung (nur wenn es eine gibt), Ist-Termin-Feld
    und die Zahl der Unter-Meilensteine. Das Bezeichnungsfeld ist dafür schmaler
    und bricht bei langen Titeln auf zwei Zeilen um.

  - **Das Feld einer Bedingung wird in einer Auswahl-Tabelle gewählt**, nicht in
    einem Auswahlfeld: Suche über Kürzel, Beschreibung und rohen Spalten-Code,
    sortierbare Spaltenköpfe, Filter für Datum/Wert und kanonisch/CSV, Bedienung
    per ↑/↓/Enter. Passt die Bezeichnung des Meilensteins zu Spalten, stehen
    diese oben als **Vorschlag** mit dem Wort, das sie ausgelöst hat. Ein
    Meilenstein ohne Bedingung bekommt zusätzlich eine Zeile „Vorschlag …
    Übernehmen" — der Vorschlag wird nie von selbst gesetzt.

  - **Bedingungen und Gruppen lassen sich nachträglich umhängen**: jede Zeile hat
    Griff, Hoch, Runter, Aus- und Einrücken sowie „in eine eigene Gruppe
    verpacken". Eingerückt wird nur in eine Gruppe, die schon darüber steht;
    „+ Gruppe" liegt oben neben der Verknüpfung und legt eine Gruppe auf
    **derselben** Ebene an. Gesperrte Schalter nennen im Tooltip den Grund.

  - **Die Verknüpfung steht zwischen den Zeilen**: links vor jeder Bedingung ab
    der zweiten steht „UND" bzw. „ODER", auch vor und hinter einem Gruppenkasten.
    Eine Gruppe neben Bedingungen ist damit erkennbar deren **Nachbarin**, keine
    Untergruppe; Gruppen heißen „GRUPPE 1", „GRUPPE 2" und tragen ihre
    Verknüpfung im Kopf.

  - **Beim Ziehen einer Bedingung zeigen sich alle möglichen Ablagestellen.**
    Zwischen zwei Zeilen legt eine Linie sie dort ab, auf einen Gruppenkasten
    gezogen landet sie in dieser Gruppe.

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
Architektur: `docs/architecture/meilensteine.md`.
