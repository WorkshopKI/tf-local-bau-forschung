# Testleitfaden — Förderfähigkeitsprüfung (MAP)

20-Minuten-Drehbuch für die Vorführung im Prüfteam. Voraussetzung: dev-Build
(`npm run build:dev`), per Doppelklick geöffnet, Daten-Share verbunden. Die
beiden Einreichungs-JSONs liegen griffbereit im Dateimanager.

Ziel der Runde ist **nicht**, die App gut aussehen zu lassen, sondern
herauszufinden, wo sie am realen Prüfprozess vorbeigeht. Widerspruch ist das
gewünschte Ergebnis.

---

## 1 · Import (3 Min)

Menüpunkt **Förderfähigkeit** öffnen. Das Dummy-JSON aus dem Dateimanager auf die
Drop-Zone ziehen.

Was zu zeigen ist:
- Der Import erkennt die Schema-Generation und schreibt sie in den Report.
- Die Eckdaten stehen sofort da: 23 Monate, 111.730 €, 50.279 €, 16 PM,
  62,5 % nicht benanntes Personal.
- Die Ampel meldet zwei Befunde.

**Frage an die Runde:** Welche Zahl schauen Sie beim Eingang zuerst an — steht sie
hier?

## 2 · Rechenchecks (3 Min)

Reiter **Rechenchecks**. Beide Befunde durchgehen:
- AP1 hat 12 Personenmonate, die Grenze liegt bei 6.
- Die Einsatzplanung verteilt Personenmonate auf 2028, obwohl die Laufzeit am
  30.04.2027 endet.

Beides fällt heute beim Durchsehen der Anlage 5 auf — oder eben nicht.

**Frage:** Welche Rechnung machen Sie heute von Hand, die hier fehlt?

## 3 · Schema-Moment (2 Min)

Jetzt den **Echtfall** in dieselbe Drop-Zone ziehen. Reiter **Import-Report**
öffnen und nebeneinanderhalten:
- Andere Generation, eindeutig erkannt.
- Der Report nennt die Erkennungsmerkmale, gegriffene Alias-Pfade und die
  Bereiche, die die Prüfung gar nicht liest.
- Der Echtfall löst **null** Befunde aus.

Botschaft: Ein Update der Einreichungsplattform bedeutet keinen Stillstand,
sondern eine Liste sichtbarer Abweichungen.

Ebenfalls im Report: der Abschnitt **aus Datenschutzgründen verworfen**.
Personalbögen, Bankverbindung und Ansprechpartner werden nicht importiert.

## 4 · Vorhaben verstehen (4 Min)

Reiter **Vorhabensbeschreibung** — Dokument zuordnen (die App schlägt es vor,
bestätigt wird von Hand), dann **Mit KI analysieren**.

Danach der Reihe nach:
- **Canvas** — deterministische Felder aus dem Antrag, Textfelder aus der
  Vorhabensbeschreibung. Amber gestrichelt heisst: dort steht nichts Belastbares.
- **Delta zum Stand der Technik** — je Zielparameter heute gegen Ziel, mit der
  Kennzeichnung quantifiziert / nur qualitativ / nicht beziffert.
- **Wirkungskette** — Problem bis Wirkung, darunter die Richtwerte
  (Umsätze ≥ Projektkosten, Personalzuwachs > 0).
- **Lesen nach Aspekt** — die Abschnitte im Wortlaut, je Prüfaspekt.

**Frage:** Stören die KI-Vorschläge, oder helfen sie? Und: Ist „0 Fundstellen" bei
einem Aspekt für Sie eine nützliche Aussage?

## 5 · Prüfen (4 Min)

Reiter **Förderfähig**. Die drei Kategorien der Entscheidungshilfe bewerten.

Bewusst vorführen: **eine Kategorie auf B0 setzen.** Die Punktzahl springt auf 0,
obwohl die anderen beiden hoch stehen — genau wie in der Entscheidungshilfe.
Wieder zurücknehmen und unter 8 Punkte bleiben: der vertiefte Block erscheint.

Dann ein K-Kriterium: „keine AP mit mehr als 6 PM" zeigt den Rechenbefund mit
**Befund übernehmen**. Bewertet wird trotzdem von Hand.

**Frage:** Fehlt ein Kriterium? — Und genau das jetzt live:

## 6 · Der Editor-Moment (2 Min)

Reiter **Checkliste bearbeiten**. Ein Kriterium aus der Runde ergänzen oder eines
umformulieren. Speichern.

- Die Fassung zählt hoch, Autor und Zeitpunkt stehen im Kopf.
- Die laufende Prüfung bleibt auf ihrer Fassung — mit sichtbarem Hinweis und der
  Möglichkeit, sie nachzuziehen.
- Eine neu gestartete Prüfung nutzt die neue Fassung.

Das ist der Kern der Vorführung: Die Checkliste gehört dem Prüfteam, nicht der
Software.

## 7 · Abschluss (2 Min)

Reiter **Abschluss**. Die drei Ausgänge zeigen:
- **Gutachten** — Gerüst aus den erfüllten Kriterien samt Bemerkungen.
- **Nachforderung** — je offenem Punkt der kuratierte Baustein im Wortlaut.
- **Ablehnung** — die nicht erfüllten Kriterien; bei B0 mit dem Hinweis auf den
  unzureichenden Innovationsgrad.

Markdown kopieren, in Word einfügen.

## 8 · Ausblick (1 Min)

Bereich **Portfolio (Prinzipansicht)**. Ausdrücklich sagen: erfundene Daten, nur
das Prinzip. ZIM ist technologieoffen — eine Themenliste wie diese wäre gesetzt,
nicht abgeleitet. Aussagekräftiger wären Projektform × Grössenklasse oder eine
Landkarte der Befunde über alle Prüfungen.

---

## Abschlussfragen

1. Was ersetzt die xlsx-Liste — und was nicht?
2. Fehlt ein Kriterium? (Bitte gleich live ergänzen.)
3. Stören die KI-Vorschläge?
4. Würden Sie damit einen echten Antrag prüfen — was fehlt für ein Ja?
5. Welcher Schritt hat heute am meisten Zeit gekostet, den die App abnehmen könnte?

## Was der MAP bewusst nicht kann

Verbund-Gesamtprüfung, Variante für Forschungseinrichtungen, vorgelagerter
PreCheck, Freigabe-Workflow der Checkliste, KI-Vorbewertung einzelner Kriterien,
Schreibzugriffe auf die Skill-Registry. Das sind Ausbaupfade, keine Lücken —
siehe [architecture/map-foerderfaehig.md](architecture/map-foerderfaehig.md).
