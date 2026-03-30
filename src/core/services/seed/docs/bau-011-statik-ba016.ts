import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-011',
  filename: 'Statik_Tragwerk_BA016.md',
  format: 'md',
  tags: ['Statik', 'Garage'],
  created: '2026-02-12T10:00:00Z',
  vorgangId: 'BA-2026-016',
  markdown: `---
titel: Tragwerksplanung Quartiersgarage Neue Mitte 8
aktenzeichen: BA-2026-016
datum: 2026-02-12
ersteller: Ingenieurbüro Stahl + Beton GmbH
---

# Tragwerksplanung — Quartiersgarage Neue Mitte 8

## 1. Konstruktionskonzept

Die viergeschossige Quartiersgarage für 120 PKW-Stellplätze wird als Stahlbeton-Fertigteilbau errichtet. Das offene Parkhaussystem (mindestens 1/3 der Außenwandfläche als natürliche Öffnung) erfüllt die Anforderungen nach Muster-Garagen- und Stellplatzverordnung (M-GarStVO) und verzichtet somit auf eine mechanische Lüftungsanlage und eine Sprinkleranlage. Die Gesamtabmessungen betragen 64,80 m × 16,20 m bei einer Gebäudehöhe von 12,40 m (Oberkante Brüstung 4. OG). Jedes Geschoss hat eine lichte Höhe von 2,50 m (Durchfahrtshöhe 2,10 m unter Unterzügen).

Das Tragsystem besteht aus Fertigteilstützen (40 × 40 cm), Fertigteil-Unterzügen (Spannbetonbinder, Querschnitt 40/70 cm) und Spannbetonhohlplatten (Breite 1,20 m, Höhe 320 mm) als Deckensystem. Das Stützenraster beträgt 16,20 m × 5,00 m für die senkrechte Stellplatzaufstellung mit einer Fahrgassenbreite von 6,00 m. Die lange Spannweite von 16,20 m in Fahrgassenrichtung ermöglicht eine stützenfreie Fahrgasse, was die Befahrbarkeit und Übersichtlichkeit erheblich verbessert. Die Rampenanlage wird als Halbrampe mit 15 Prozent Steigung an der Nordseite des Gebäudes ausgeführt, getrennt für Auffahrt und Abfahrt.

## 2. Fertigteilsystem

### 2.1 Stützen

Die Fertigteilstützen werden aus Beton C50/60 mit Bewehrung B500B hergestellt. Der Querschnitt beträgt 40 × 40 cm über alle Geschosse. Die Stützen werden als Einzelstützen über die gesamte Gebäudehöhe (4 Geschosse, 12,40 m) vorgefertigt und in einem Stück montiert. Die Köcherfundamente (Ortbeton C30/37) nehmen die Stützen auf, die Verbindung erfolgt über Vergussmörtel in der Köcherfuge. Die Normalkraft-Bemessung der Erdgeschoss-Stütze (maßgebend): NEd = 4 × (gk + qk) × A = 4 × (5,80 + 2,50) × 81 = 2.689 kN. Tragfähigkeit: NRd = 0,85 × fcd × Ac + fyd × As = 0,85 × 33,3 × 160.000 + 435 × 2.010 = 4.529 + 875 = 5.404 kN (mit 8 Ø 18 Längsbewehrung, As = 20,1 cm²). Auslastung: 50 Prozent. Die Knicklänge beträgt β × h = 0,70 × 12,40 = 8,68 m (unverschieblich ausgesteift). Schlankheit λ = 8.680 / (400/√12) = 75. Der Knicksicherheitsnachweis nach DIN EN 1992-1-1, Abschnitt 5.8 (Modellstützenverfahren) ergibt eine Auslastung von 72 Prozent — die Stützenbemessung ist ausreichend.

### 2.2 Spannbetonhohlplatten

Die Deckenelemente sind Spannbetonhohlplatten mit einer Spannweite von 16,20 m, einer Elementbreite von 1,20 m und einer Höhe von 320 mm. Die Hohlplatten werden im Spannbett vorgefertigt (Vorspannung mit sofortigem Verbund, Litzen 7-drähtig Y1860S7, Durchmesser 12,5 mm). Jede Platte enthält 8 Spannlitzen mit einer Vorspannkraft je Litze von Pm0 = 139 kN (nach Spannkraftverlusten). Die Biegetragfähigkeit der Hohlplatte beträgt MRd = 285 kNm/m (Breitenmeter). Einwirkendes Moment unter Volllast (Eigengewicht 3,80 kN/m² + Ausbau 1,00 kN/m² + Nutzlast 2,50 kN/m²): MEd = 1,35 × 4,80 × 16,20² / 8 + 1,50 × 2,50 × 16,20² / 8 = 212 + 123 = 335 kNm/1,20m = 279 kNm/m. Auslastung: 98 Prozent. Der Durchbiegungsnachweis ergibt eine Enddurchbiegung von L/320 = 50,6 mm (unter quasi-ständiger Last), Grenzwert L/250 = 64,8 mm — eingehalten mit 78 Prozent Auslastung.

### 2.3 Unterzüge

Die Fertigteil-Unterzüge (Spannbetonbinder 40/70 cm) spannen in Querrichtung von Stütze zu Stütze (5,00 m) und tragen die Hohlplatten über Auflagerplatten. Die Unterzüge werden als Spannbetonbinder mit nachträglichem Verbund gefertigt (Hüllrohre mit Spannlitzen, Verpressen nach Montage). Die Querkrafttragfähigkeit der Unterzüge an den Auflagern beträgt VRd,c = 285 kN (ohne Schubbewehrung). Einwirkende Querkraft: VEd = 210 kN. Auslastung: 74 Prozent.

## 3. Windverband und Aussteifung

Die horizontale Aussteifung des Gebäudes erfolgt über Stahlbetonscheiben in den Rampenbereichen (2 Wandscheiben je 8,00 m Länge, d = 20 cm) und den Treppenhäusern (2 Kerne). Die Scheibenkräfte werden über die als Scheibe wirkenden Hohlplatten-Deckenscheiben (Verguss der Längsfugen mit HPC-Vergussbeton C70/85) in die aussteifenden Wände geleitet. Die Windlast auf die offene Garage wird nach DIN EN 1991-1-4/NA für offene Bauwerke ermittelt. Maßgebende Windlast in Querrichtung: Fw = 245 kN je Geschoss (cp,net = 1,3 für offene Struktur). Die Wandscheiben nehmen je 122,5 kN Horizontalkraft auf. Schubspannung in der Scheibe: τ = 122.500 / (8.000 × 200) = 0,077 N/mm² — weit unter der Schubfestigkeit des Betons.

## 4. Fahrzeuglast und Anpralllasten

### 4.1 Verkehrslasten

Die Verkehrslasten werden nach DIN EN 1991-1-1, Tabelle 6.8 (Nutzungskategorie F — Verkehrs- und Parkflächen für leichte Fahrzeuge, Fahrzeuggewicht ≤ 30 kN) angesetzt. Gleichmäßig verteilte Last: qk = 2,50 kN/m². Einzellast (Radlast): Qk = 20 kN auf einer Aufstandsfläche von 200 × 200 mm. Für die Bemessung der Hohlplatten ist die Einzellast maßgebend, da sie lokal höhere Biegemomente erzeugen kann als die Flächenlast. Der lokale Biegemomentnachweis der Hohlplatte unter Einzellast (Lastverteilungsbreite 2,50 m nach Johansen-Plattentheorie) ergibt eine Auslastung von 85 Prozent.

### 4.2 Anpralllasten

Anpralllasten auf Brüstungen und Absturzsicherungen werden nach DIN EN 1991-1-7/NA, Tabelle NA.2 angesetzt. Horizontale Anpralllast an Brüstungen: Fdx = 50 kN (Fahrzeuggewicht ≤ 30 kN, Geschwindigkeit ≤ 20 km/h). Die Stahlbetonbrüstungen (h = 80 cm, d = 20 cm, C30/37) an der Fassade und den Rampenrändern werden auf diese Anpralllast bemessen. Erforderliche Bewehrung: As = 4,2 cm²/m horizontal (Ø 10/180) und As = 6,8 cm²/m vertikal (Ø 12/160), verankert in der Deckenscheibe. An den Gebäudeecken wird die Bewehrung auf das 1,5-fache erhöht. Die Anpralllast auf Stützen im Erdgeschoss (Fdx = 50 kN in 50 cm Höhe) wird als Sonderlastfall nachgewiesen: Die Stütze nimmt die Anpralllast als Einzellast auf, die resultierende Biegung erzeugt eine Zusatzauslastung von 8 Prozent — in Kombination mit der reduzierten Normalkraft (Anprall ist eine außergewöhnliche Einwirkung, γA = 1,0) bleibt die Gesamtauslastung unter 85 Prozent.

## 5. Dauerhaftigkeit und Korrosionsschutz

### 5.1 Expositionsklassen

Die Quartiersgarage ist als offene Garage der Expositionsklasse XD3 (Chlorideinwirkung durch Tausalzeintrag über Fahrzeuge) und XC4 (Wechselnd nass und trocken, Karbonatisierung) zugeordnet. Die Frost-Tau-Wechsel-Beanspruchung beträgt XF2 (mäßige Wassersättigung mit Taumittel). Die Betondeckung für die Hohlplatten und Unterzüge beträgt cnom = 45 mm, für die Stützen cnom = 40 mm (geschütztere Lage).

### 5.2 Oberflächenschutz

Die Fahrbahnflächen erhalten eine Oberflächenschutzbeschichtung OS 8 nach ZTV-ING (rissüberbrückend, chloridbremsend). Der Aufbau besteht aus: Grundierung (Epoxidharz, 0,3 kg/m²), Abdichtungsschicht (PUR, 1,5 mm), Verschleißschicht (PUR mit Quarzsandeinstreuung, 1,5 mm). Die Beschichtung wird alle 10 Jahre erneuert. An den Dehnfugen (alle 40 m) werden elastische Fahrbahnübergangskonstruktionen mit integrierter Entwässerungsrinne eingebaut. Die Regenwasserentwässerung der Parkdecks erfolgt über Bodenabläufe mit Leichtflüssigkeitsabscheider (Koaleszenzabscheider Klasse I nach DIN EN 858-1) in den Kanal. Die Entwässerungsanlage ist auf ein 5-jährliches Regenereignis bemessen.

## 6. Montagekonzept

Die Fertigteilmontage erfolgt mit einem Mobilkran (LTM 1100, Tragfähigkeit 100 t). Die Montagreihenfolge ist: (1) Köcherfundamente gießen und aushärten lassen (7 Tage), (2) Stützen einsetzen und ausrichten, Vergussmörtel einbringen, (3) Unterzüge auflegen und ausrichten (Neoprene-Lager zwischen Stütze und Unterzug), (4) Hohlplatten verlegen (Verlegegewicht 3,2 t je Platte), (5) Längsfugen vergießen (HPC C70/85), (6) Ortbetonergänzungen (Wandscheiben, Brüstungen, Rampe). Die gesamte Rohbaumontage dauert voraussichtlich 12 Wochen.

## Zusammenfassung in einfacher Sprache

Dieses Gutachten beschreibt die Statik fuer ein vierstoeckiges Parkhaus mit 120 Stellplaetzen an der Neuen Mitte 8. Das Parkhaus wird aus vorgefertigten Betonteilen zusammengebaut, was die Bauzeit auf etwa 12 Wochen verkuerzt. Die Decken bestehen aus speziellen Hohlplatten, die 16 Meter weit spannen koennen, sodass keine stoerenden Stuetzen in den Fahrgassen stehen. Das offene Parkhaus braucht keine kuenstliche Belueftung, weil genuegend Oeffnungen in den Aussenwaenden fuer frische Luft sorgen. Auch der Aufprallschutz an den Bruestungen und Stuetzen wurde berechnet, falls ein Auto dagegen faehrt.

Musterstadt, den 12.02.2026

_Dipl.-Ing. Petra Stahl, Stahl + Beton GmbH_`,
};
