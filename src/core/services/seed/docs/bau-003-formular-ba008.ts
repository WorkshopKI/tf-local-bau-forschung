import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-003',
  filename: 'Bauantragsformular_BA008.md',
  format: 'md',
  tags: ['Formular', 'Gewerbe'],
  created: '2026-02-05T10:00:00Z',
  vorgangId: 'BA-2026-008',
  markdown: `---
titel: Bauantrag Gewerbehalle mit Bürotrakt
aktenzeichen: BA-2026-008
datum: 2026-02-05
---

# Bauantrag — Gewerbehalle mit Bürotrakt, Gewerbepark Süd 12

## 1. Bauherr und Grundstück

**Bauherr:** Metallbau Krämer GmbH & Co. KG, vertreten durch Komplementärin Krämer Verwaltungs-GmbH, Geschäftsführer Dipl.-Ing. Stefan Krämer
**Anschrift:** Gewerbepark Süd 12, 48149 Musterstadt
**Grundstück:** Gemarkung Musterstadt, Flur 22, Flurstück 803/1
**Grundstücksfläche:** 4.200 m²
**Bebauungsplan:** BP Nr. 178 "Gewerbepark Süd", rechtskräftig seit 03.09.2017
**Baugebiet:** Gewerbegebiet (GE) gemäß §8 BauNVO
**Gebäudeklasse:** 3 nach §2 Abs. 3 BauO NRW

Das Grundstück liegt im erschlossenen Gewerbepark Süd und grenzt im Norden an die Erschließungsstraße Gewerbepark Süd, im Osten an ein unbebautes Gewerbegrundstück und im Süden an eine Grünfläche. Die Erschließung über die vorhandene Zufahrt Gewerbepark Süd ist gesichert. Trinkwasser (DN 50), Schmutzwasserkanal (DN 200) und Stromversorgung (Mittelspannung) sind vorhanden. Der Fernwärmeanschluss für den Bürotrakt wird über eine Stichleitung vom Hauptverteiler am Gewerbepark Süd 6 hergestellt. Für die Abwassereinleitung aus der Produktionshalle ist ein Leichtflüssigkeitsabscheider nach DIN EN 858 vorgeschaltet. Der Kanalanschluss für das Gesamtobjekt wird auf DN 300 erweitert, da die bestehende Leitung für die Entwässerung der befestigten Flächen und des Hallendachs nicht ausreichend dimensioniert ist.

## 2. Baubeschreibung

### 2.1 Produktionshalle

Die eingeschossige Produktionshalle wird als Stahlrahmenkonstruktion mit einem Stützenraster von 15 m × 24 m errichtet. Die lichte Höhe unter der Unterkante des Hauptträgers beträgt 8,00 m, die Firsthöhe 9,80 m. Die Gesamtgrundfläche der Halle beträgt 720 m² (30 m × 24 m). Die Fassade besteht aus wärmegedämmten Sandwichpaneelen (PIR-Kern, d = 100 mm, U-Wert 0,22 W/(m²K)) in RAL 7016 Anthrazitgrau. Das Dach wird ebenfalls mit Sandwichpaneelen (PIR-Kern, d = 120 mm, U-Wert 0,18 W/(m²K)) eingedeckt und erhält ein Gefälle von 3 Prozent zur Traufe. In der Südfassade sind zwei Lichtbänder aus Polycarbonat-Stegplatten (je 12 m × 1,50 m) angeordnet, die neben der Belichtung auch als natürliche Rauchabzüge im Brandfall dienen. Der Hallenboden besteht aus einem geschliffenen Industrieestrich mit Oberflächenvergütung (Hartstoffeinstreuung Korund) auf einer Stahlbetonbodenplatte (d = 25 cm, C30/37) mit Dampfsperre und kapillarbrechender Kiesschicht.

### 2.2 Kranbahnanlage

In der Halle wird eine Kranbahnanlage für einen Einträger-Brückenkran mit einer Tragfähigkeit von 10 Tonnen installiert. Die Kranbahn-Fahrschienen sind auf Stahlkonsolen an den Hallenstützen befestigt. Die Hubhöhe beträgt 6,50 m, die Kranbahnlänge 26 m. Die Kranlast einschließlich dynamischer Zuschläge (Schwingbeiwert φ = 1,10) wurde bei der Bemessung der Hallenstützen und Fundamente berücksichtigt. Die elektrische Versorgung des Krans erfolgt über eine Schleppkabelanlage. Die Steuerung ist als Funkfernsteuerung mit Totmannschaltung ausgeführt. Der Kran wird nach DGUV Vorschrift 52 geprüft und entspricht der FEM-Klassifikation A5 (mittlerer Betrieb).

### 2.3 Büroanbau

Der zweigeschossige Büroanbau schließt an die Westseite der Halle an und hat Außenmaße von 16 m × 8 m (Bruttogrundfläche je Geschoss 128 m², gesamt 256 m², davon 240 m² Nutzfläche). Im Erdgeschoss befinden sich: Empfang und Flur (22 m²), Großraumbüro Arbeitsvorbereitung (42 m²), Besprechungsraum (20 m²), Sanitärräume mit behindertengerechtem WC, Serverraum und Technikraum. Im Obergeschoss: Geschäftsführerbüro (24 m²), Buchhaltung (18 m²), Personalraum mit Teeküche (30 m²), Archiv und Sozialraum. Die Geschosshöhe beträgt 3,00 m (licht 2,70 m). Der Büroanbau ist in Stahlbetonbauweise (Wände d = 24 cm, Decken d = 20 cm) errichtet und über eine Brandschutztür T30-RS direkt mit der Halle verbunden. Die Fassade erhält ein Wärmedämmverbundsystem (WDVS, Mineralwolle 180 mm, U-Wert 0,19 W/(m²K)) mit Silikonharzputz.

## 3. Haustechnik

### 3.1 Heizung und Lüftung

Die Beheizung der Produktionshalle erfolgt über dezentrale Gas-Warmlufterzeuger (3 Stück à 45 kW) unter der Hallendecke, die eine schnelle Aufheizung nach Wochenenden und Feiertagen ermöglichen und die Warmluft gleichmäßig im Hallenraum verteilen. Im Sommer wird die Halle über motorisch betriebene Lüftungsklappen in den Lichtbändern und Wandklappen in der Nordfassade natürlich belüftet. Der Bürotrakt wird über den Fernwärmeanschluss der Stadtwerke beheizt (Primärenergiefaktor fp = 0,5), mit Heizkörpern unter den Fenstern und Einzelraumregelung. Die Büroräume im Obergeschoss erhalten zusätzlich eine Kühlmöglichkeit über eine Split-Klimaanlage für Sommertage mit Außentemperaturen über 30 °C.

### 3.2 Elektro und Beleuchtung

Die Hallenbeleuchtung besteht aus LED-Hallentiefstrahlern (48 Stück, je 200 W) mit Tageslichtsteuerung und Präsenzmeldung. Die Beleuchtungsstärke am Arbeitsplatz beträgt mindestens 500 Lux nach DIN EN 12464-1. Der Stromanschluss ist als Mittelspannungsanschluss mit Trafostation (630 kVA) ausgelegt, um den Leistungsbedarf der Produktionsmaschinen (Laserschneider 120 kW, CNC-Fräse 45 kW, Schweißroboter 80 kW) zu decken. Die Erdung und der Blitzschutz der Stahlkonstruktion erfolgen nach DIN EN 62305 (Blitzschutzklasse III).

## 4. Erschließung und Verkehr

Die LKW-Zufahrt und Laderampe befinden sich an der Ostseite der Halle. Die Laderampe hat eine Höhe von 1,20 m über Gelände mit hydraulischer Überladebrücke und Torabdichtung. Der Rangierbereich für LKW bis 18 m Länge (Sattelzug) ist mit 24 m Tiefe ausreichend dimensioniert. Die Befestigung der Rangierfläche erfolgt mit Betonpflaster (10 cm Bettung, 25 cm Schottertragschicht), ausgelegt für Achslasten bis 11,5 Tonnen.

Der Stellplatznachweis gemäß Stellplatzsatzung sieht für Gewerbebetriebe 1 Stellplatz je 40 m² Nutzfläche vor: Halle 720 m² / 40 = 18, Büro 240 m² / 40 = 6, gesamt 24 Stellplätze erforderlich. Es werden 28 PKW-Stellplätze bereitgestellt, davon 2 barrierefreie nach DIN 18040-1. Die Stellplätze sind mit Rasengittersteinen befestigt, um die Versiegelung zu minimieren. Zusätzlich sind 8 überdachte Fahrradabstellplätze am Büroeingang vorgesehen.

## 5. Brandschutz und Genehmigungsverfahren

Das Brandschutzkonzept liegt als gesonderte Anlage bei und berücksichtigt die Trennung von Produktionshalle und Bürotrakt durch eine Brandwand F90. Die Halle erhält eine Rauch- und Wärmeabzugsanlage (RWA) über die Lichtbänder im Dach. Das Gesamtgebäude wird mit einer automatischen Brandmeldeanlage Kategorie 2 (Flure, Technikräume, Lagerbereich) ausgestattet. Der Standsicherheitsnachweis nach Eurocode 3 für den Stahlbau und Eurocode 2 für den Bürotrakt liegt bei. Der energetische Nachweis nach GEG 2024 wird gesondert geführt. Die Abstandsflächen nach §6 BauO NRW werden auf allen Seiten eingehalten. Die GRZ von 0,80 wird mit 0,52 unterschritten, die GFZ von 2,0 mit 0,29.

Musterstadt, den 05.02.2026

_Unterschrift Bauherr_ — _Unterschrift Entwurfsverfasser_`,
};
