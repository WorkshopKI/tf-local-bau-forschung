# Fristen & Meilensteine

Vollbild-Seite (`/meilensteine`, Flag `meilensteinMonitoring`; dev/pl/as/kurator).

## Zweck

Der amtliche Status sagt, WO ein Verbund steht — dieses Modul, ob er dort
**rechtzeitig** steht. Ziel ist die Bearbeitung binnen einer Gesamtfrist
(Standard 90 Tage) ab Antragseingang, unterteilt in Meilensteine mit Soll-Wochen
(MST 1 … 6). Anker ist das **späteste** Antragsdatum aller Teilvorhaben.

## Bereiche

- **Eingang** (Kopfzeile, gilt für Übersicht und Auswertung): Jahres-Chips,
  taggenaue Von-Bis-Felder, „Alle Eingänge" — **vorbelegt mit dem laufenden
  Jahr**. Ohne Antragsdatum nur unter „Alle Eingänge" sichtbar.
- **Übersicht**: links je offener Verbund eine Zeile (Akronym, Antragstyp,
  laufende Woche, ein Zustands-Punkt je Haupt-Meilenstein, Restzeit), rechts der
  Zeitstrahl — Soll hohle Raute, Ist gefüllter Punkt. Filter: Typ, Prognose,
  Suche, „nur meine"; nach Dringlichkeit sortiert.
- **Diese Woche**: überfällige und in 7 Tagen fällige Meilensteine über alle
  Verbünde — bewusst OHNE Eingangs-Zeitraum, sonst fielen ältere überfällige
  Vorgänge heraus.
- **Auswertung**: Ø-Dauer, Median, Anteil im Soll, Abweichung — gesamt und je
  FuE/DS/DL/NW; je Meilenstein Soll-Woche, Ø Ist-Woche, Δ, Reißquote.
- **Konfiguration**: der Meilenstein-Baum (Nummer, Bezeichnung, Soll-Woche,
  „aktiv"/„Frist"), aufgeklappt Beschreibung, Antragstyp-Filter und
  Bedingungs-Editor (UND/ODER über gemappte CSV-Spalten). Dazu Fassungen und
  Historie.

## Wichtig

- Die Seite startet auf **Diese Woche**. Tab, Zeitraum und Pills bleiben bis zum
  nächsten Öffnen erhalten (der Suchtext nicht); mit gesetztem Kürzel ist „nur
  meine" vorbelegt. Die Tab-Zähler zählen den Bereich, nicht die Listen-Filter.
- Der Plan ist eine Team-Datei auf dem Daten-Share: **schreiben darf nur die
  Projektleitung** (bzw. Kurator/dev), alle anderen sehen ihn read-only.
- **Speichern und Freigeben sind zwei Schritte** — ausgewertet wird nur die
  zuletzt freigegebene Fassung.
- Meilensteine mit unbestätigter CSV-Zuordnung tragen „unbestätigt"; ohne bekannte
  Quelle sind sie inaktiv und nie gerissen.
- Derselbe Zeitstrahl steht auf der Verbund-Detailseite; dort lässt sich ein
  **Risiko melden** (geht in den persönlichen Ordner, die PL sammelt es ein).
- Das Home-Widget „Meilensteine diese Woche" zeigt den eigenen Auszug.
- Nicht verwechseln mit den Projekt-Meilensteinen der Begleitphase
  (`MS01`–`MS03`) und der Prominenz „Meilenstein" der Status-Timeline.
