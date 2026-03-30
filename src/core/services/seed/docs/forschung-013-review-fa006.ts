import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-048',
  filename: 'Review_FA006.md',
  format: 'md',
  tags: ['Review', 'Roboter', 'Sicherheit'],
  created: '2026-03-01T10:00:00Z',
  vorgangId: 'FA-2026-006',
  markdown: `---
titel: Gutachten Nachbesserung FA-2026-006 Autonome Lieferroboter im öffentlichen Straßenraum
aktenzeichen: FA-2026-006
datum: 2026-03-01
gutachter: Prof. Dr.-Ing. Kerstin Sicherheit, TÜV Akademie Rheinland
---

# Gutachten Nachbesserung — FA-2026-006 Autonome Lieferroboter

## 1. Gegenstand und Auftrag

Das vorgelegte Sicherheitskonzept für den Feldversuch mit autonomen Lieferrobotern (6 Einheiten, Betriebsgebiet: Innenstadtbereich Musterstadt, 2 km² Einsatzradius, Gehwege und Fußgängerzonen) wurde im Rahmen der Zweitbegutachtung des Förderantrags FA-2026-006 auf die Aspekte Betriebssicherheit, Verkehrssicherheit, Haftung und Datenschutz geprüft. Die Lieferroboter (Hersteller: StarShip Technologies, Modell S2, Gewicht 23 kg leer / 33 kg beladen, Geschwindigkeit max. 6 km/h, 6 Räder, Abmessungen 70 × 56 × 56 cm) navigieren autonom auf Gehwegen und liefern Pakete und Lebensmittel an Endkunden. Die Sensorik umfasst: 12 Kameras (360° Rundumblick), 5 Ultraschallsensoren (Nahfeld), 2 LiDAR-Sensoren (Velodyne Puck, Reichweite 100 m) und GPS/RTK (Genauigkeit ±2 cm). Die Lokalisierung erfolgt über eine vortrainierte HD-Karte (Visual Localization, Genauigkeit ±10 cm) in Kombination mit GPS-RTK.

## 2. Sicherheitstechnische Mängel

### 2.1 Notfall-Stoppszenarien unzureichend definiert

Das Sicherheitskonzept beschreibt einen manuellen Notfall-Stopp (roter Knopf auf dem Roboter, erreichbar für Passanten) und einen ferngesteuerten Stopp durch den Leitstand-Operator. Es fehlen jedoch Definitionen für folgende Szenarien: Totalausfall der Sensorik (z.B. Kamera-Blinding durch Gegenlicht, LiDAR-Ausfall durch Spiegelung auf nasser Fahrbahn) — das Konzept muss festlegen, ob der Roboter bei Sensorausfall sofort anhält (Safe Stop) oder mit reduzierter Geschwindigkeit (1 km/h) zum nächsten sicheren Punkt fährt (Safe Harbor). Kommunikationsausfall (Verlust der Mobilfunkverbindung zum Leitstand) — bei einem Ausfall der 4G/5G-Verbindung kann der Operator den Roboter nicht überwachen. Das Konzept muss eine autonome Notfallstrategie definieren (z.B. Anhalten nach 30 Sekunden ohne Verbindung, akustisches Signal zur Warnung der Passanten). Mechanischer Defekt (Blockade eines Rades, Umkippen auf unebenem Untergrund) — der Roboter muss einen Selbstdiagnose-Mechanismus haben, der mechanische Fehler erkennt und den Betrieb einstellt.

### 2.2 Mischverkehr mit Fußgängern und Radfahrern

Das Sicherheitskonzept adressiert die Interaktion mit Fußgängern nur oberflächlich. Folgende kritische Szenarien fehlen: Kinder, die den Roboter als Spielzeug wahrnehmen und darauf klettern oder ihn umwerfen — der Roboter muss eine Gewichtssensor-Erkennung auf dem Deckel haben und bei unerwarteter Last anhalten. Blinde und sehbehinderte Personen, die den Roboter auf dem Gehweg nicht wahrnehmen — der Roboter muss akustische Warnsignale bei Annäherung an Personen abgeben (z.B. dezentes Klickgeräusch, ähnlich einer Ampel-Signalanlage). Rollstuhlfahrer und Kinderwagen, für die der Roboter ein Hindernis auf dem Gehweg darstellt — der Roboter muss bei Begegnung ausweichen können oder anhalten und warten, wenn der Gehweg zu schmal ist (Restbreite < 1,50 m nach DIN 18040-3 Barrierefreiheit).

Es fehlt eine Simulation der Interaktionsszenarien — weder eine Monte-Carlo-Simulation mit variierenden Fußgänger-Trajektorien noch ein Hazard-and-Operability-Study (HAZOP) für den Mischverkehr wurde vorgelegt. Das Gutachten empfiehlt eine systematische Gefahrenanalyse nach ISO 13482 (Roboter und Robotikgeräte — Sicherheitsanforderungen für persönliche Assistenzroboter) und ISO 12100 (Sicherheit von Maschinen — Allgemeine Gestaltungsleitsätze), bevor der Feldversuch genehmigt werden kann.

### 2.3 Haftungsfragen ungeklärt

Das Sicherheitskonzept schweigt zu den haftungsrechtlichen Fragen bei Unfällen. Zentrale offene Fragen: Wer haftet, wenn ein Lieferroboter eine Person verletzt (Produkthaftung des Herstellers nach §1 ProdHaftG, Betreiberhaftung nach §7 StVG analog, oder Verschuldenshaftung des Projektleiters nach §823 BGB)? Der Roboter ist kein zugelassenes Fahrzeug nach StVZO und fällt nicht unter §7 StVG (Halterhaftung) — es besteht eine Regelungslücke. Das Gutachten empfiehlt dringend die Einholung eines juristischen Gutachtens zur Haftungsfrage vor Versuchsbeginn und den Abschluss einer speziellen Betriebshaftpflichtversicherung (Deckungssumme mindestens 5 Millionen Euro für Personenschäden).

## 3. Datenschutzrechtliche Mängel

### 3.1 Kamerasysteme im öffentlichen Raum

Die 12 Kameras des Roboters erfassen kontinuierlich den öffentlichen Raum einschließlich aller Personen im Bildbereich. Dies stellt eine Verarbeitung personenbezogener Daten (Bildaufnahmen von Gesichtern) nach Art. 4 Nr. 1 DSGVO dar. Eine Datenschutz-Folgenabschätzung (DSFA) nach Art. 35 DSGVO ist zwingend erforderlich, da: die Verarbeitung eine systematische Überwachung öffentlich zugänglicher Bereiche umfasst (Art. 35 Abs. 3 lit. c DSGVO), die Verarbeitung in großem Umfang erfolgt (6 Roboter × 12 Kameras × 8 Stunden/Tag = 576 Kamerastunden/Tag) und die betroffenen Personen nicht individuell informiert werden können (Ausnahme Art. 14 Abs. 5 lit. b DSGVO nur bei unverhältnismäßigem Aufwand).

Das Gutachten empfiehlt: Minimierung der Datenerfassung (Kamerabilder nur für Navigation verwenden, keine Speicherung der Rohbilder, Gesichtserkennung technisch unterbinden), on-device Verarbeitung (alle visuellen Daten werden auf dem Roboter verarbeitet und nicht an Server übertragen), automatische Löschung (Kamerabilder nach Verarbeitung sofort löschen, keine Aufzeichnung zu Trainingszwecken ohne explizite DSGVO-konforme Einwilligung) und Transparenz (Kennzeichnung der Roboter als kameraausgestattet, QR-Code auf dem Roboter mit Link zur Datenschutzerklärung, Informationsschild an den Einsatzgrenzen des Betriebsgebiets).

## 4. Nachbesserungsbedarf

Das Sicherheitskonzept wird in der vorliegenden Form **nicht** als ausreichend bewertet. Folgende Nachbesserungen sind vor Genehmigung des Feldversuchs erforderlich:

1. **Safety Case** nach ISO 13482: Systematische Gefahrenanalyse mit HAZOP und Risikograph für alle identifizierten Betriebsszenarien, Definition der Safety Integrity Level (SIL) für die sicherheitskritischen Funktionen (Notfall-Stopp, Hinderniserkennung, Kollisionsvermeidung).
2. **Versicherungsnachweis**: Betriebshaftpflichtversicherung mit Mindestdeckung 5 Mio. Euro Personenschäden, 2 Mio. Euro Sachschäden.
3. **DSFA nach Art. 35 DSGVO**: Vollständige Datenschutz-Folgenabschätzung mit Darstellung der technischen und organisatorischen Maßnahmen.
4. **Juristisches Gutachten**: Klärung der Haftungsfragen im Mischverkehr auf Gehwegen.
5. **Interaktionssimulation**: Monte-Carlo-Simulation oder Realwelt-Test auf abgesperrtem Testgelände (nicht im öffentlichen Raum) mit mindestens 50 Probanden verschiedener Mobilitätsgrade (Fußgänger, Rollstuhlfahrer, Kinder, Sehbehinderte).

Die Frist für die Nachbesserung beträgt 3 Monate. Nach Einreichung der nachgebesserten Unterlagen wird eine erneute Begutachtung durchgeführt.

## Zusammenfassung in einfacher Sprache

Ein Sicherheitsgutachten hat den geplanten Feldversuch mit autonomen Lieferrobotern auf Gehwegen geprueft. Das Ergebnis: Das Sicherheitskonzept ist noch nicht gut genug. Es fehlen klare Regeln fuer Notfaelle, zum Beispiel wenn die Sensoren oder die Funkverbindung ausfallen. Ausserdem ist nicht geklaert, wie die Roboter mit Fussgaengern, Kindern, Rollstuhlfahrern und blinden Menschen sicher zusammenarbeiten koennen. Auch die Haftungsfrage bei Unfaellen und der Datenschutz wegen der Kameras muessen noch geloest werden. Das Gutachten verlangt fuenf konkrete Nachbesserungen innerhalb von drei Monaten.

_Prof. Dr.-Ing. Kerstin Sicherheit, TÜV Akademie Rheinland_`,
};
