import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-008',
  filename: 'Statik_Tragwerk_BA004.md',
  format: 'md',
  tags: ['Statik', 'Dachausbau'],
  created: '2026-02-03T10:00:00Z',
  vorgangId: 'BA-2026-004',
  markdown: `---
titel: Tragfähigkeitsnachweis Dachgeschossausbau Kastanienallee 23
aktenzeichen: BA-2026-004
datum: 2026-02-03
ersteller: Ingenieurbüro Statik Plus GmbH
---

# Tragfähigkeitsnachweis — Dachgeschossausbau Kastanienallee 23

## 1. Bestandsaufnahme und Dokumentation

### 1.1 Gebäudebeschreibung

Das dreigeschossige Wohngebäude Kastanienallee 23 wurde gemäß den vorliegenden Bauakten der Stadt Musterstadt (Akte BA-1965-0412) im Jahr 1965 errichtet. Der Grundriss ist annähernd rechteckig mit den Außenmaßen 11,40 m × 8,60 m. Die Geschosshöhen betragen 2,80 m (Keller bis 2. OG). Das nicht ausgebaute Dachgeschoss hat eine Firsthöhe von 4,20 m über Oberkante Rohdecke. Die Gründung besteht aus Streifenfundamenten (vermutlich Stampfbeton) unter den Außen- und tragenden Innenwänden. Die Kelleraußenwände sind aus Bruchsteinmauerwerk (Basalt), die Geschosswände aus Hochlochziegeln HLz B 28 in Kalkmörtel MG IIa. Die Geschossdecken sind Stahlbetondecken d = 16 cm (vermutlich B225/St I, nach heutiger Bezeichnung etwa C16/20 und BSt 420).

### 1.2 Dachtragwerk Bestand

Das Dachtragwerk ist ein Pfettendach mit liegender Stuhlkonstruktion. Sparren: Nadelholz (vermutlich Fichte/Tanne, Sortierklasse S10 nach DIN 4074, entspricht C24 nach DIN EN 338), Querschnitt 10/16 cm, Achsabstand 80 cm. Die Pfetten (Querschnitt 16/20 cm) liegen auf einem liegenden Stuhl mit Streben (12/14 cm) und Spannriegel (10/14 cm). Die Pfetten sind über Holznägel und Zapfenverbindungen an den Stuhlständern befestigt. Die Dachneigung beträgt 42°. Die Dachhaut besteht aus Betondachsteinen auf Lattung und Konterlattung ohne Unterspannbahn. Die Entwässerung erfolgt über Dachrinnen aus verzinktem Stahlblech. Im Zuge der Bestandsaufnahme wurden Holzfeuchtmessungen an 24 Stellen durchgeführt: Alle Werte lagen zwischen 11 und 14 Prozent Holzfeuchte, was auf einen trockenen und gut belüfteten Dachraum hinweist. Schädlingsbefall oder Pilzbefall wurde nicht festgestellt. Einzelne Sparren zeigen Trocknungsrisse bis 3 mm Tiefe, die statisch unbedenklich sind.

### 1.3 Holzbalkendecke über Obergeschoss

Die Geschossdecke über dem 2. Obergeschoss ist eine Holzbalkendecke mit Einschub. Deckenbalken: Nadelholz 12/22 cm, Achsabstand 65 cm. Aufbau von oben nach unten: Dielung 24 mm auf Lagerhölzern, Lehmschlag auf Stakung als Einschub (Gewicht geschätzt 1,00 kN/m²), Unterseite Putz auf Schilfrohrmatten. Das Gesamteigengewicht der Decke wird zu 2,20 kN/m² abgeschätzt (Balken + Dielung + Einschub + Putz). Die Balkenenden in den Außenwänden wurden durch Endoskopie kontrolliert — keine Fäulnis, keine Mauerfeuchte an den Balkenauflagern.

## 2. Geplante Maßnahmen

Der Dachgeschossausbau umfasst den Einbau von 3 Schleppgauben (je 2,40 m breit, 1,80 m tief) auf der Südseite, den Ausbau zu einer Wohnung (65 m² Wohnfläche) mit Bad, Schlafraum und offenem Wohn-Essbereich sowie die Anhebung des Kniestocks um 40 cm zur Verbesserung der Raumhöhe. Der neue Fußbodenaufbau über der Holzbalkendecke umfasst: Trittschalldämmung Mineralwolle 30 mm, Trockenestrich 2 × 12,5 mm Gipsfaserplatten, Bodenbelag Parkett 15 mm. Zusatzlast des Fußbodenaufbaus: 0,45 kN/m². Die Zwischensparrendämmung (180 mm Mineralwolle WLG 035) und die Dampfbremse/Innenbekleidung (OSB 15 mm + GK 12,5 mm) ergeben eine Zusatzlast auf die Sparren von 0,25 kN/m² (bezogen auf die Dachfläche).

## 3. Nachrechnung Holzbalkendecke

### 3.1 Einwirkungen

Ständige Last gk: Eigengewicht Bestand 2,20 kN/m² + Fußbodenaufbau 0,45 kN/m² = 2,65 kN/m². Veränderliche Last qk: Wohnnutzung 2,00 kN/m² (Kategorie A1) + Trennwandzuschlag 0,50 kN/m² = 2,50 kN/m². Bemessungslast im Grenzzustand der Tragfähigkeit (GZT): pd = 1,35 × 2,65 + 1,50 × 2,50 = 3,58 + 3,75 = 7,33 kN/m². Lasteinzugsbreite eines Balkens: 0,65 m. Linienlast je Balken: qd = 7,33 × 0,65 = 4,76 kN/m. Stützweite (Achse Außenwand zu Achse Innenwand): L = 4,20 m.

### 3.2 Biegetragfähigkeit

Maximales Feldmoment: MEd = qd × L² / 8 = 4,76 × 4,20² / 8 = 10,50 kNm. Widerstandsmoment des Balkens 12/22: Wy = b × h² / 6 = 0,12 × 0,22² / 6 = 968 cm³. Bemessungswert der Biegefestigkeit (Fichte C24, Nutzungsklasse 1, Lasteinwirkungsdauer mittel, kmod = 0,80): fm,d = kmod × fm,k / γM = 0,80 × 24 / 1,30 = 14,77 N/mm². Aufnehmbares Moment: MRd = fm,d × Wy = 14,77 × 968 × 10⁻³ = 14,30 kNm. Auslastung: MEd / MRd = 10,50 / 14,30 = 73 Prozent. Die Biegetragfähigkeit ist ausreichend, die Auslastung von 73 Prozent liegt unter der im Vorbericht geschätzten 87 Prozent, da die genauere Berechnung günstigere Einschubgewichte ergab.

### 3.3 Durchbiegungsnachweis

Durchbiegung unter quasi-ständiger Kombination: qser = gk + ψ2 × qk = 2,65 + 0,30 × 2,50 = 3,40 kN/m². Trägheitsmoment Iy = b × h³ / 12 = 0,12 × 0,22³ / 12 = 10.648 cm⁴. Elastizitätsmodul E0,mean = 11.000 N/mm². Anfangsdurchbiegung: winst = 5 × q × L⁴ / (384 × E × I) = 5 × 2,21 × 4,20⁴ / (384 × 11.000 × 10.648 × 10⁻⁸) = 5,8 mm. Endkriechen kdef = 0,60 (NKL 1). Enddurchbiegung: wfin = winst × (1 + kdef) = 5,8 × 1,60 = 9,3 mm. Grenzwert L/250 = 4.200 / 250 = 16,8 mm. Auslastung: 9,3 / 16,8 = 55 Prozent. Die Durchbiegung ist unkritisch.

## 4. Verstärkungsmaßnahmen

### 4.1 Deckenverstärkung an Gaubenöffnungen

Im Bereich der drei Gauben werden jeweils zwei Sparren gekappt. Die Last wird über Wechselbalken aus KVH C24 (10/20 cm) auf die benachbarten Sparren umgeleitet. Die Anschlüsse der Wechsel an die durchgehenden Sparren erfolgen mit Balkenschuhen aus verzinktem Stahl (Simpson ABR-100-2, Tragfähigkeit 15 kN je Schuh) und zusätzlichen Vollgewindeschrauben (8 × 200 mm, SPAX). Die Durchlaufwirkung der Pfetten verteilt die Zusatzlast aus den Gauben auf die umliegenden Sparrenfelder. Die maximale Zusatzlast an den Trägersparren beträgt 2,8 kN, die vorhandene Reserve der Sparren (Auslastung Bestand ohne Gauben: 68 Prozent) ist ausreichend.

### 4.2 Sparrenverstärkung bei Kniestockerhöhung

Die Anhebung des Kniestocks um 40 cm verändert die Lastableitung im unteren Sparrenbereich. An 6 Stellen, wo die Sparren im Bereich des neuen Kniestocks geschwächt sind (vorhandene Kerven für die alte Pfette), werden BSH-Bohlen (Brettschichtholz GL24h, 80 × 220 mm) seitlich aufgedoppelt. Die Verdübelung erfolgt mit Vollgewindeschrauben (SPAX 8 × 200 mm) im Abstand von 200 mm in versetzter Anordnung. Der Verbundquerschnitt (Sparren 10/16 + Bohle 8/22) wird als T-Querschnitt mit nachgiebigem Verbund nach Anhang B der DIN EN 1995-1-1 (Gamma-Verfahren) berechnet. Der Verbindungsmittel-Schlupfmodul Kser = ρm^1,5 × d / 23 = 380^1,5 × 8 / 23 = 2.578 N/mm. Der effektive Trägheitsmoment Ief beträgt 18.400 cm⁴, was einer Steifigkeitssteigerung von 85 Prozent gegenüber dem Einzelsparren entspricht.

## 5. Nachweis Bestandsfundamente

Die Zusatzlast aus dem Dachgeschossausbau (Nutzlast + Fußbodenaufbau + Dachausbau) wird über die Bestandswände in die Streifenfundamente abgeleitet. Die zusätzliche Sohlpressung wird zu Δσ = 18 kN/m (Wandlast) / 0,60 m (Fundamentbreite geschätzt) = 30 kN/m² abgeschätzt. Die Gesamtsohlpressung (Bestand + Ausbau) beträgt σ = 185 + 30 = 215 kN/m² < σzul = 250 kN/m². Der Nachweis der Bestandsfundamente ist erfüllt, eine Fundamentverstärkung ist nicht erforderlich.

## 6. Lastpfad und Gesamtnachweis

Der vollständige Lastpfad vom Dach bis zum Fundament wurde nachgewiesen: Dachlasten (Sparren → Pfetten → Stuhlständer → Innenwand/Decke → Fundament) und Deckenlasten (Balken → Auflager Wand → Fundament). Alle Nachweise sind mit den genannten Auslastungen erfüllt. Die kritischste Stelle ist die Biegetragfähigkeit der Bestandsdeckenbalken mit 73 Prozent Auslastung. Empfehlung: Im Zuge der Bauarbeiten sollten die Balkenauflagen in den Außenwänden visuell kontrolliert und bei Auffälligkeiten eine ergänzende Untersuchung veranlasst werden.

## Zusammenfassung in einfacher Sprache

Dieses Gutachten prueft, ob der Ausbau des Dachgeschosses in der Kastanienallee 23 sicher moeglich ist. Das Haus stammt aus dem Jahr 1965, und es soll eine neue Wohnung unterm Dach entstehen, mit drei neuen Dachfenstern und einem erhoehten Kniestock. Die vorhandenen Holzbalken der Decke wurden untersucht und koennen die zusaetzliche Last tragen — sie sind nur zu 73 Prozent belastet. An einigen Stellen, wo Balken fuer die Dachfenster durchgeschnitten werden, kommen Verstaerkungen aus neuem Holz dazu. Auch die alten Fundamente sind stark genug und muessen nicht erneuert werden.

Musterstadt, den 03.02.2026

_Dipl.-Ing. Andrea Schneider, Statik Plus GmbH_`,
};
