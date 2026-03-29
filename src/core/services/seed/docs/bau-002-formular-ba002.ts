import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-002',
  filename: 'Bauantragsformular_BA002.md',
  format: 'md',
  tags: ['Formular', 'MFH'],
  created: '2026-01-22T10:00:00Z',
  vorgangId: 'BA-2026-002',
  markdown: `---
titel: Bauantrag Neubau Mehrfamilienhaus mit Tiefgarage
aktenzeichen: BA-2026-002
datum: 2026-01-22
---

# Bauantrag — Neubau Mehrfamilienhaus, Lindenstraße 42

## 1. Bauherr und Grundstück

**Bauherr:** Wohnbau Musterstadt GmbH, vertreten durch Geschäftsführer Martin Berger
**Anschrift des Bauherrn:** Rathausplatz 3, 48149 Musterstadt
**Grundstück:** Gemarkung Musterstadt, Flur 8, Flurstück 291/5
**Grundstücksfläche:** 1.850 m² (laut Katasterauszug vom 08.01.2026)
**Bebauungsplan:** BP Nr. 312 "Lindenstraße-Ost", rechtskräftig seit 22.06.2021
**Baugebiet:** Allgemeines Wohngebiet (WA) gemäß §4 BauNVO
**Gebäudeklasse:** 4 nach §2 Abs. 3 BauO NRW (Oberkante Fußboden oberstes Geschoss >7m und ≤13m über Geländeoberfläche)

Das Grundstück ist über die Lindenstraße voll erschlossen. Der Anschluss an das Mischwassersystem besteht über einen Revisionsschacht DN 300 am südlichen Grundstücksrand. Trinkwasser, Strom und Fernwärme sind über Versorgungsleitungen im Gehweg der Lindenstraße verfügbar. Ein Glasfaseranschluss FTTH wurde bei der Erschließung des Quartiers 2022 verlegt. Die Zufahrt zur Tiefgarage erfolgt über eine bestehende Bordsteinabsenkung an der Lindenstraße mit einer Rampenneigung von 15 Prozent.

## 2. Baubeschreibung

### 2.1 Gebäudeform und Abmessungen

Geplant ist ein viergeschossiges Mehrfamilienhaus mit zurückgesetztem Staffelgeschoss und unterirdischer Tiefgarage in Stahlbetonbauweise. Das Gebäude hat eine L-förmige Grundrissfigur mit den Außenmaßen 38,40 m × 14,80 m (Längstrakt) und 18,60 m × 12,20 m (Quertrakt). Die Traufhöhe beträgt 12,60 m, die Oberkante des Staffelgeschosses liegt bei 15,20 m über Gelände. Die Bruttogrundfläche aller Geschosse beträgt 2.940 m², die Wohnfläche nach Wohnflächenverordnung insgesamt 1.280 m². Das Staffelgeschoss ist gegenüber der Fassade um mindestens 2,00 m zurückgesetzt und wird mit einem extensiv begrünten Flachdach abgeschlossen.

### 2.2 Wohnungen und Nutzungseinheiten

Das Gebäude umfasst 12 Wohneinheiten, die sich wie folgt aufteilen: 4 Zwei-Zimmer-Wohnungen (je 55 m²), 4 Drei-Zimmer-Wohnungen (je 80 m²) und 4 Vier-Zimmer-Wohnungen (je 110 m²). Im Erdgeschoss befinden sich zusätzlich Abstell- und Technikräume, ein Fahrradabstellraum für 24 Fahrräder mit Lademöglichkeit für E-Bikes, ein Müllsammelraum gemäß Abfallsatzung der Gemeinde sowie der Zugang zum Treppenhaus und zum Aufzug. Jede Wohnung verfügt über einen Balkon oder eine Loggia mit mindestens 6 m² Fläche. Die Erdgeschosswohnungen erhalten Terrassen mit direktem Gartenzugang.

### 2.3 Barrierefreiheit

Sämtliche Wohnungen sind barrierefrei nach DIN 18040-2 gestaltet. Die Erschließung erfolgt stufenlos vom Gehweg über den Haupteingang. Der Aufzug ist als Personenaufzug mit Krankentragen-Aufnahme nach DIN EN 81-70 ausgeführt (Kabinengröße 1,10 m × 2,10 m). Türbreiten in den Wohnungen betragen mindestens 90 cm, in den Bädern mindestens 80 cm. Die Bewegungsflächen vor den Sanitärobjekten entsprechen den Anforderungen der DIN 18040-2. Zwei Erdgeschosswohnungen sind rollstuhlgerecht nach DIN 18040-2 R mit bodengleichen Duschen und unterfahrbaren Waschtischen ausgeführt.

## 3. Konstruktion und Tragwerk

Die Gründung erfolgt als wasserundurchlässige Stahlbetonkonstruktion (WU-Beton nach DAfStb-Richtlinie) für die Tiefgarage. Die Bodenplatte hat eine Stärke von 35 cm, die Außenwände 30 cm. Das Tragwerk der Obergeschosse besteht aus Stahlbetonflachdecken (d = 22 cm, Betongüte C30/37, Bewehrung B500B) auf tragenden Mauerwerkswänden und Stahlbetonstützen. Die Aussteifung erfolgt über die Treppenhäuser und Aufzugsschächte als Stahlbetonkerne. Der statische Nachweis wird nach Eurocode 2 (DIN EN 1992-1-1) geführt. Die Erdbebenzone 1 nach DIN EN 1998-1/NA wird berücksichtigt. Das Tragwerkskonzept liegt als gesonderter Standsicherheitsnachweis bei, erstellt durch das Ingenieurbüro Hartmann + Partner, Musterstadt.

## 4. Fassade und Dach

Die Fassade wird als vorgehängte hinterlüftete Fassade (VHF) mit Klinkerriemchen ausgeführt. Der Aufbau besteht aus der tragenden Stahlbetonwand (20 cm), einer Mineralfaserdämmung (200 mm, WLG 035), einer Hinterlüftungsebene (40 mm) und den Klinkerriemchen auf einer Aluminium-Unterkonstruktion. Der resultierende U-Wert der Außenwand beträgt 0,16 W/(m²K). Die Klinkerfassade verleiht dem Gebäude eine hochwertige Anmutung und sorgt gleichzeitig für einen wartungsarmen, langlebigen Witterungsschutz. Das Flachdach wird extensiv begrünt mit einer Substratschicht von 10 cm, Drainageschicht und wurzelfester Dachabdichtung. Der U-Wert des Dachaufbaus beträgt 0,12 W/(m²K).

## 5. Haustechnik

### 5.1 Heizung und Warmwasser

Die Wärmeversorgung erfolgt über einen Fernwärmeanschluss der Stadtwerke Musterstadt mit einem Primärenergiefaktor von fp = 0,5. Die Übergabestation befindet sich im Technikraum der Tiefgarage. Die Wärmeverteilung in den Wohnungen erfolgt über Fußbodenheizung mit raumweiser Einzelregelung. Die Warmwasserbereitung erfolgt zentral über einen Plattenwärmetauscher im Durchlaufprinzip mit Zirkulationsleitung.

### 5.2 Lüftung

Jede Wohneinheit erhält eine zentrale Zu- und Abluftanlage mit Wärmerückgewinnung (WRG-Grad mindestens 85 Prozent nach DIN EN 308). Die Lüftungsgeräte sind als Wohnungslüftungsgeräte in den Installationsschächten der Bäder installiert. Die Volumenstromregelung erfolgt bedarfsabhängig über CO₂- und Feuchtesensoren. Jeder Raum erhält individuell regelbare Zuluft- und Abluftventile. Das Lüftungskonzept wurde nach DIN 1946-6 erstellt und gewährleistet die notwendige Lüftung zum Feuchteschutz auch bei geschlossenen Fenstern. Die Schalldämmung der Lüftungsleitungen entspricht DIN 4109.

### 5.3 Elektroinstallation

Jede Wohnung erhält einen eigenen Zählerplatz im Hauptverteiler des Erdgeschosses. Die Vorbereitung für eine spätere Photovoltaikanlage auf dem Staffelgeschoss-Dach ist vorgesehen (Leerrohre, Wechselrichterplatz). In der Tiefgarage sind 4 Stellplätze mit Wallbox-Vorbereitung ausgestattet (Leerrohr und Absicherung für je 11 kW).

## 6. Tiefgarage und Stellplätze

Die eingeschossige Tiefgarage bietet 18 PKW-Stellplätze, davon 2 barrierefreie Stellplätze nach DIN 18040-1 (Breite 3,50 m). Die Zufahrt erfolgt über eine einspurige Rampe mit Wechselverkehrsregelung und Ampelanlage. Die lichte Höhe in der Tiefgarage beträgt 2,30 m. Die Entwässerung der Tiefgarage erfolgt über eine Hebeanlage mit Leichtflüssigkeitsabscheider. Die Belüftung wird mechanisch über Zuluft- und Abluftöffnungen an der Rampe sichergestellt. 4 Stellplätze erhalten eine Ladeinfrastruktur für Elektrofahrzeuge. Der Stellplatzschlüssel von 1,5 pro Wohneinheit wird eingehalten (12 WE × 1,5 = 18 Stellplätze).

## 7. Entwässerung und Außenanlagen

Das Schmutzwasser wird über den bestehenden Kanalanschluss DN 300 in das Mischwassersystem eingeleitet. Die Rückstauebene liegt bei 133,80 m ü. NHN. Sämtliche Entwässerungsgegenstände in der Tiefgarage liegen unterhalb der Rückstauebene und werden über eine Hebeanlage nach DIN EN 12056-4 entwässert. Das Niederschlagswasser des Daches wird über die Dachbegrünung zurückgehalten (Retentionsvolumen 45 l/m²) und gedrosselt in den Mischwasserkanal eingeleitet (Drosselabfluss 5 l/s). Die Retentionsberechnung nach DWA-A 138 liegt bei. Das Versickerungsgutachten zeigt, dass eine Versickerung auf dem Grundstück aufgrund des lehmigen Untergrunds (kf = 8 × 10⁻⁷ m/s) nicht wirtschaftlich möglich ist.

Die Außenanlagen umfassen begrünte Innenhofflächen mit Spielbereich für Kinder, eine Fahrradabstellanlage im Erdgeschoss sowie Müllcontainer-Stellplätze mit Sichtschutzbepflanzung. Die Grundflächenzahl (GRZ) von 0,45 wird mit 0,42 eingehalten, die Geschossflächenzahl (GFZ) von 1,20 wird mit 1,08 unterschritten. Die Abstandsflächen nach §6 BauO NRW betragen 0,4 × H = 0,4 × 12,60 m = 5,04 m. Zur Lindenstraße beträgt der Abstand 6,20 m, zu den seitlichen Grundstücksgrenzen 5,50 m und 5,80 m. Alle Abstandsflächen liegen vollständig auf dem eigenen Grundstück.

Das Brandschutzkonzept, der Standsicherheitsnachweis und der energetische Nachweis nach GEG 2024 liegen als gesonderte Anlagen bei.

Musterstadt, den 22.01.2026

_Unterschrift Bauherr_ — _Unterschrift Entwurfsverfasser_`,
};
