# Fristen & Meilensteine

Vollbild-Seite (`/meilensteine`, Flag `meilensteinMonitoring`; dev/pl/as/kurator).
Hier wird der **Meilenstein-Plan** gepflegt — die Soll-Achse hinter der
Bearbeitung eines Verbunds.

## Zweck

Der amtliche Status sagt, WO ein Verbund steht. Dieses Modul sagt, ob er dort
**rechtzeitig** steht: Ziel ist die vollständige Bearbeitung binnen einer
Gesamtfrist (Standard 90 Tage) ab Antragseingang, unterteilt in Meilensteine mit
Soll-Wochen (MST 1 … 6, mit Unter-Meilensteinen).

Der Anker ist das **späteste Antragsdatum** über alle Teilvorhaben — vorher kann
der Verbund nicht vollständig bearbeitet werden. Ein Meilenstein gilt als
erreicht, sobald seine Bedingung über die Antragsdaten zutrifft; ein
Sammel-Meilenstein zusätzlich dann, wenn alle seine Unter-Meilensteine erreicht
sind.

## Bereiche

- **Fassungs-Leiste** (oben): aktuelle Fassungsnummer, Freigabe-Zustand, Autor
  und Stand. Rechts „Für das Team freigeben" bzw. „Zurück in Entwurf".
- **Konfiguration**: der Meilenstein-Baum. Je Zeile Nummer, Bezeichnung,
  Soll-Woche und die Schalter „aktiv" und „Frist" (zählt in die Prognose).
  Aufgeklappt: Beschreibung, Antragstyp-Filter (FuE/DS/DL/NW) und der
  **Bedingungs-Editor** — verschachtelte UND/ODER-Gruppen mit Feld, Operator und
  Wert, alles per Auswahl statt Freitext. Das Feld-Angebot stammt aus den
  gemappten CSV-Spalten aller Programme.
- **Frühere Fassungen**: Historie mit Autor, Stand, Umfang und Kommentar; jede
  Fassung lässt sich als Entwurf übernehmen.

## Wichtig

- Der Plan liegt als Team-Datei auf dem Daten-Share. **Schreiben darf nur die
  Projektleitung** (bzw. Kurator/dev); alle anderen sehen dieselbe Seite
  read-only.
- **Speichern und Freigeben sind zwei Schritte.** Eine gespeicherte Fassung ist
  zunächst ein Entwurf; ausgewertet wird immer nur die zuletzt freigegebene.
- Meilensteine des Auslieferungs-Plans, deren CSV-Zuordnung noch nicht bestätigt
  ist, tragen das Kennzeichen **„unbestätigt"**. Wo gar keine plausible Quelle
  bekannt war, ist der Meilenstein zusätzlich inaktiv — inaktive Meilensteine
  werden nie als gerissen gezählt.
- Nicht zu verwechseln mit den Projekt-Meilensteinen der Begleitphase
  (`MS01`–`MS03` im Verwendungsnachweis) und mit der Anzeige-Prominenz
  „Meilenstein" der Status-Timeline.
