import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-010',
  filename: 'Statik_Tragwerk_BA011.md',
  format: 'md',
  tags: ['Statik', 'Aufstockung'],
  created: '2026-02-08T10:00:00Z',
  vorgangId: 'BA-2026-011',
  markdown: `---
titel: Tragwerksplanung Aufstockung Schulstraße 14
aktenzeichen: BA-2026-011
datum: 2026-02-08
ersteller: Ingenieurbüro Holzbau Riedel
---

# Tragwerksplanung — Aufstockung Schulstraße 14

## 1. Bestandsanalyse

### 1.1 Gebäudebeschreibung Bestand

Das dreigeschossige Wohngebäude Schulstraße 14 wurde 1958 in konventioneller Mauerwerksbauweise errichtet. Die Außenmaße betragen 14,60 m × 10,20 m. Die Geschosshöhe beträgt 2,80 m (licht 2,55 m). Das vorhandene Flachdach (Bitumenabdichtung auf Gefälleestrich, Stahlbetondecke d = 16 cm) wird im Zuge der Aufstockung entfernt und durch das neue Geschoss ersetzt. Die Gründung besteht aus Streifenfundamenten (Stahlbeton, Breite 60 cm, geschätzt aus Bestandsplänen und Sondierungsgrabung).

Die Außenwände bestehen aus Vollziegelmauerwerk (MZ 28, Mauermörtel MG IIa) mit einer Wanddicke von 36,5 cm. Die Innenwände sind teils tragend (24 cm Vollziegel), teils nichttragend (11,5 cm Hochlochziegel). Die Geschossdecken sind Stahlbetondecken d = 16 cm (geschätzte Betongüte C16/20, Bewehrung BSt 420). Im Zuge der Bestandsuntersuchung wurden 6 Bohrkernentnahmen aus den Außenwänden und 4 Bohrkerne aus den Decken durchgeführt. Ergebnisse: Ziegeldruckfestigkeit fb = 28 N/mm² (Mittelwert, 6 Proben), Mörteldruckfestigkeit fm = 5 N/mm² (MG IIa bestätigt), Betondruckfestigkeit fc,cube = 22 N/mm² (entspricht C16/20).

### 1.2 Charakteristische Mauerwerksdruckfestigkeit

Die Berechnung der charakteristischen Mauerwerksdruckfestigkeit erfolgt nach DIN EN 1996-1-1/NA, Gleichung (3.2): fk = K × fb^α × fm^β. Mit K = 0,55 (Vollziegel, Normalmörtel), fb = 28 N/mm², fm = 5 N/mm², α = 0,70, β = 0,30: fk = 0,55 × 28^0,70 × 5^0,30 = 0,55 × 12,25 × 1,62 = 10,9 N/mm². Bemessungswert: fd = fk / γM = 10,9 / 1,50 = 7,27 N/mm² (Teilsicherheitsbeiwert für Bestandsmauerwerk nach DIN EN 1996-1-1/NA, Kategorie II — Eingeschränkte Überwachung Bestand).

## 2. Aufstockungskonzept

### 2.1 Holzrahmenbauweise

Die Aufstockung erfolgt in Holzrahmenbauweise, um das Zusatzgewicht gegenüber einer Massivbauweise um etwa 60 Prozent zu reduzieren. Der Wandaufbau der Aufstockung (von außen nach innen): Holzfassade Lärche 24 mm, Hinterlüftung 40 mm, MDF-Platte diffusionsoffen 16 mm, Ständer 60/200 mm KVH C24 mit Zellulosedämmung (WLG 039), OSB-3-Platte 15 mm als Dampfbremse und Aussteifung, Installationsebene 60 mm mit Mineralwolldämmung, Gipskarton 2 × 12,5 mm (GKF, feuchtebeständig, Brandschutz F30). U-Wert Außenwand: 0,16 W/(m²K). Wandgewicht: 0,85 kN/m² (verglichen mit 8,50 kN/m² für 36,5 cm Vollziegelmauerwerk).

Die Decke über der Aufstockung ist eine Brettsperrholz-Decke (BSP, 5-lagig, d = 180 mm, GL24h) mit Flachdachaufbau. Dachaufbau: extensive Dachbegrünung (Substrat 8 cm), Drainagematte, Wurzelschutz, Abdichtung zweilagig bituminös, Gefälledämmung EPS (120–200 mm), Dampfsperre, BSP-Decke. U-Wert Dach: 0,14 W/(m²K). Eigengewicht Decke mit Aufbau: 3,20 kN/m² (verglichen mit 7,50 kN/m² für eine Stahlbetondecke d = 22 cm mit gleicher Dachkonstruktion).

### 2.2 Gewichtsvergleich

Eigengewicht Aufstockung komplett (Wände, Decke, Innenwände, Fußboden): 3,50 kN/m² Geschossfläche. Eigengewicht eines vergleichbaren Massivgeschosses (Mauerwerk 24 cm + WDVS, Stahlbetondecke): 8,80 kN/m² Geschossfläche. Gewichtsersparnis: 5,30 kN/m², das entspricht 60 Prozent Reduktion. Bei einer Geschossfläche von 149 m² ergibt dies eine Gewichtsersparnis von 790 kN Gesamtlast auf die Bestandswände und Fundamente. Diese Ersparnis ist entscheidend, da die Bestandswände und Fundamente ohne Verstärkung nur eine begrenzte Zusatzlast aufnehmen können.

## 3. Nachweis Bestandswände

### 3.1 Vertikale Lastabtragung

Die zusätzliche Last aus der Aufstockung wird über die Holzrahmen-Schwellhölzer auf die Bestandsdecke und von dort über die tragenden Wände in die Fundamente abgeleitet. Die maßgebende Außenwand (Westseite, größte Einflusslänge) wird nachgewiesen. Vorhandene Last aus 3 Bestandsgeschossen: NEd,Bestand = 1,35 × (3 × 2,80 × 36,5 × 0,01 × 18 + 3 × 6,25 × 5,10) = 1,35 × (55,2 + 95,6) = 204 kN/m (Wandeigengewicht + 3 Decken). Zusatzlast Aufstockung: NEd,Aufstockung = 1,35 × 3,50 × 5,10 + 1,50 × 2,00 × 5,10 = 24,1 + 15,3 = 39,4 kN/m. Gesamtlast: NEd,ges = 204 + 39,4 = 243,4 kN/m.

Tragfähigkeit der Bestandswand im Erdgeschoss (maßgebend, da höchste Last): NRd = Φ × fd × t = 0,62 × 7,27 × 365 = 1.645 kN/m (Abminderungsfaktor Φ = 0,62 für Schlankheit hef/t = 2,80/0,365 × 0,75 = 5,75, Exzentrizität ei/t = 0,05, nach DIN EN 1996-1-1 Tabelle NA.3). Auslastung: NEd / NRd = 243,4 / 1.645 = 15 Prozent. Die Bestandswand ist nur zu 15 Prozent ausgelastet — die Aufstockung ist problemlos möglich.

Hinweis: Die errechnete Auslastung von nur 15 Prozent entspricht der Realität bei typischen Wohngebäuden aus den 1950er-Jahren, deren Außenwände wegen der Wärmedämmfunktion mit 36,5 cm überdimensioniert sind. Die Tragfähigkeit des Mauerwerks liegt weit über dem statisch Erforderlichen.

### 3.2 Knicksicherheit

Die Knicklänge der Erdgeschoss-Außenwand beträgt hef = β × h = 0,75 × 2,80 = 2,10 m (β = 0,75 für beidseitig gehaltene Wand). Schlankheit λ = hef / t = 2,10 / 0,365 = 5,75. Bei einer Schlankheit unter 12 ist ein vereinfachter Nachweis nach DIN EN 1996-1-1/NA, NCI zu NA.6.1.2.1 zulässig. Der Abminderungsfaktor Φm = 0,85 × (1 - 2 × em/t) = 0,85 × (1 - 2 × 0,05) = 0,77. Die Knicksicherheit ist mit großer Reserve gewährleistet.

## 4. Nachweis Bestandsfundamente

Die Bestandsfundamente wurden durch eine Sondierungsgrabung an der Südwest-Ecke freigelegt. Festgestellte Abmessungen: Streifenfundament Breite 60 cm, Höhe 40 cm, Stampfbeton (geschätzte Druckfestigkeit C12/15). Vorhandene Sohlpressung (Bestand): σBestand = 204 / 0,60 = 340 kN/m². Zulässige Sohlpressung laut Baugrundgutachten: σzul = 250 kN/m² (mitteldichter Sand). Die vorhandene Sohlpressung im Bestand ÜBERSCHREITET bereits die zulässige Bodenpressung, was bei Altbauten aus den 1950er-Jahren nicht ungewöhnlich ist, da damals mit geringeren Sicherheitsfaktoren gerechnet wurde.

### 4.1 Fundamentverstärkung durch Unterfangung

Die Fundamente werden durch Unterfangung verstärkt. Das bestehende Streifenfundament wird abschnittsweise (Abschnittslänge 1,20 m, nie mehr als 1/5 der Wandlänge gleichzeitig) unterfangen. Unter dem Bestandsfundament wird ein neues Stahlbetonfundament (C25/30, B500B) mit einer Breite von 1,00 m und einer Höhe von 50 cm eingebaut. Die neue Sohlfläche beträgt 1,00 m. Neue Sohlpressung (Bestand + Aufstockung): σges = 243,4 / 1,00 = 243,4 kN/m² < σzul = 250 kN/m². Nachweis erfüllt. Die Unterfangungsarbeiten werden nach DIN 4123 (Ausschachtungen, Gründungen und Unterfangungen im Bereich bestehender Gebäude) durchgeführt. Ein Setzungsmonitoring der Bestandswände mit Nivellement-Messpunkten wird während der gesamten Bauzeit durchgeführt (Grenzwert: 3 mm Setzungsdifferenz).

## 5. Anschluss Aufstockung an Bestand

Die Holzrahmen-Schwellhölzer (KVH C24, 60 × 120 mm) der Aufstockung werden auf einer Ausgleichsschicht aus Vergussmörtel auf der Bestandsdecke aufgelegt und mit Schwerlastankern (Fischer FAZ II 12/10, Tragfähigkeit Zug 18 kN, Abstand 600 mm) in der Decke verankert. Die Verankerung nimmt horizontale Kräfte aus Wind und Erdbeben auf. Zwischen Schwellholz und Betonoberfläche wird eine Elastomerlage (EPDM, Shore-Härte 40, Dicke 5 mm) eingelegt, die als akustische Entkopplung wirkt und die Flankenübertragung von Trittschall zwischen Bestand und Aufstockung reduziert (Verbesserung der bewerteten Norm-Trittschallpegel-Differenz um ΔLw = 8 dB). Der Schallschutznachweis für die Trennfuge zwischen Bestand und Aufstockung liegt als separate Anlage bei.

## 6. Erdbeben und Aussteifung

Die Aufstockung wird durch die OSB-beplankten Holzrahmen-Wandscheiben in beiden Richtungen ausgesteift. Die Schubsteifigkeit der OSB-Scheiben (15 mm OSB/3, Klammern 1,53 × 50 mm, Abstand 75 mm am Rand) beträgt Gd × t / s = 490 kN/m (Längsrichtung, Wandlänge 4,80 m). Die Gesamtschubsteifigkeit in Querrichtung (3 Wandscheiben) beträgt 1.470 kN/m, ausreichend für die Erdbebenersatzkraft von 12 kN (Zone 1, Aufstockung allein). Die Verankerung der Wandscheiben gegen Abheben (Zuganker an den Wandenden) wird mit 2 × M16 Gewindestangen je Wandende in die Bestandsdecke verankert (Tragfähigkeit Zug 2 × 45 = 90 kN > Zugkraft aus Kippmoment 28 kN).

## Zusammenfassung in einfacher Sprache

Dieses Gutachten prueft, ob auf das bestehende dreistoeckige Wohnhaus in der Schulstrasse 14 ein zusaetzliches Stockwerk aufgebaut werden kann. Das neue Geschoss wird in leichter Holzbauweise gebaut, wodurch es nur etwa 40 Prozent des Gewichts eines normalen Stockwerks aus Stein wiegt. Die alten Ziegelwaende sind stark genug und nur zu 15 Prozent belastet. Die vorhandenen Fundamente muessen allerdings verbreitert werden, da sie fuer heutige Anforderungen zu schmal sind. Der Anschluss zwischen Alt- und Neubau wird mit einer Gummischicht schallisoliert, damit man die Nachbarn nicht hoert.

Musterstadt, den 08.02.2026

_Dipl.-Ing. (FH) Johannes Riedel, Ingenieurbüro Holzbau Riedel_`,
};
