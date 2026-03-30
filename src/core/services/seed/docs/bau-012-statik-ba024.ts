import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-012',
  filename: 'Statik_Tragwerk_BA024.md',
  format: 'md',
  tags: ['Statik', 'Brücke'],
  created: '2026-02-15T10:00:00Z',
  vorgangId: 'BA-2026-024',
  markdown: `---
titel: Tragwerksplanung Radschnellweg-Brücke Flussquerung
aktenzeichen: BA-2026-024
datum: 2026-02-15
ersteller: Brückenbau-Ingenieure Westfalen GmbH
---

# Tragwerksplanung — Radschnellweg-Brücke Flussquerung Km 2.4

## 1. Tragwerk und Bemessungsgrundlagen

### 1.1 Konstruktionsprinzip

Die Brücke wird als Stahl-Holz-Verbundkonstruktion mit einer Einzelspannweite von 42 m ausgeführt. Das Haupttragwerk besteht aus zwei parallelen Stahl-Fachwerk-Untergurtträgern (Werkstoff S355J2+N nach DIN EN 10025-2) im Abstand von 5,20 m. Die Fahrbahnplatte ist eine Brettschichtholz-Platte (GL28h nach DIN EN 14080, Festigkeitsklasse GL28h) mit einer Dicke von 200 mm, die über Schubverbindungsmittel mit den Stahl-Obergurten verbunden ist. Die Verbundwirkung ermöglicht eine gemeinsame Lastabtragung: Der Stahl nimmt primär die Zugkräfte im Untergurt auf, das Holz die Druckkräfte in der Fahrbahnplatte. Diese Materialaufteilung nutzt die Stärken beider Werkstoffe optimal aus und ergibt ein Tragwerk mit geringem Eigengewicht bei hoher Steifigkeit.

Die Bemessung erfolgt nach DIN EN 1993-2 (Stahlbrücken), DIN EN 1995-2 (Holzbrücken) und DIN EN 1994-2 (Verbundbrücken) jeweils mit nationalem Anhang. Die Einwirkungen werden nach DIN EN 1991-2 (Verkehrslasten auf Brücken — Fußgänger- und Radverkehr) ermittelt. Die Nutzbreite beträgt 4,50 m (Radweg 3,00 m, Gehweg 1,50 m), die Gesamtbreite einschließlich Geländer und Wartungsgang 5,80 m. Die Konstruktionshöhe des Tragwerks beträgt 1,80 m (Schlankheitsverhältnis L/H = 42/1,8 = 23,3).

### 1.2 Stahlbau-Querschnitte

Die Hauptträger bestehen aus geschweißten Hohlkastenprofilen: Untergurt 300 × 200 × 16 mm (A = 148 cm²), Obergurt HEB 400 (A = 198 cm²), Diagonalen CHS 168,3 × 8,0 mm (Kreishohlprofil, A = 40,3 cm²), Vertikalpfosten CHS 139,7 × 6,3 mm (A = 26,4 cm²). Die Querträger sind IPE 270 im Abstand von 3,00 m. Der gesamte Stahlverbrauch beträgt 42 Tonnen, was einem spezifischen Stahlgewicht von 200 kg/m² Brückenfläche entspricht. Alle Schweißnähte werden als Stumpfnähte mit voller Durchschweißung (DIN EN ISO 5817, Bewertungsgruppe B) ausgeführt, um die Ermüdungsfestigkeit zu maximieren.

## 2. Einwirkungen

### 2.1 Ständige Einwirkungen

Eigengewicht Stahlkonstruktion: 42 t / 42 m = 10,0 kN/m. Eigengewicht BSH-Fahrbahnplatte (200 mm, γ = 4,2 kN/m³): 0,20 × 5,20 × 4,2 = 4,37 kN/m. Eigengewicht Belag (Gussasphalt 30 mm + Abdichtung): 0,80 kN/m² × 4,50 = 3,60 kN/m. Eigengewicht Geländer (beide Seiten): 2 × 0,50 = 1,00 kN/m. Eigengewicht Beleuchtung und Kabel: 0,20 kN/m. Gesamt ständige Last: gk = 19,17 kN/m.

### 2.2 Verkehrslasten

Gleichmäßig verteilte Fußgänger-/Radfahrerlast nach DIN EN 1991-2, Tabelle 5.1: qfk = 5,0 kN/m² auf der gesamten Nutzbreite von 4,50 m = 22,5 kN/m. Einzellast (Wartungsfahrzeug): Qsv = 12 kN auf einer Achse, Radaufstandsfläche 200 × 200 mm (wird für den lokalen Nachweis der Holzfahrbahn verwendet). Horizontale Bremslast: Qlk = 10 Prozent der Verkehrslast = 0,10 × 5,0 × 4,50 × 42 = 94,5 kN (verteilt auf beide Widerlager).

### 2.3 Wind und Temperatur

Windlast auf das Tragwerk nach DIN EN 1991-1-4: Böengeschwindigkeitsdruck qp(z) = 0,75 kN/m² (exponierte Lage am Flussufer, Geländekategorie II). Kraftbeiwert cf = 2,0 (Fachwerk). Bezugshöhe: Oberkante Tragwerk 5,60 m über Gelände. Windkraft: Fw = qp × cf × Aref = 0,75 × 2,0 × (1,80 × 42) = 113,4 kN. Die Windlast erzeugt ein Torsionsmoment auf das Tragwerk, da der Angriffspunkt exzentrisch zur Schubmitte liegt. Temperaturdifferenz (gleichmäßig): ΔTN,con = -35 K (Kontraktion), ΔTN,exp = +35 K (Expansion). Längenänderung: ΔL = α × L × ΔT = 12 × 10⁻⁶ × 42.000 × 35 = 17,6 mm. Die Lager am Ostwiderlager müssen eine Verschiebung von ±18 mm aufnehmen.

## 3. Schwingungsnachweis

### 3.1 Eigenfrequenzanalyse

Bei Fuß- und Radwegbrücken ist der Schwingungsnachweis häufig bemessungsbestimmend, da die Anregung durch Fußgänger (Schrittfrequenz 1,6–2,4 Hz) und Radfahrer (Tretfrequenz 1,0–1,5 Hz) resonanznahe Schwingungen erzeugen kann. Die Eigenfrequenzen des Tragwerks wurden mittels FE-Modell (3D-Stabwerkmodell, 1.248 Elemente) bestimmt.

Erste Biegeeigenfrequenz (vertikal): f1 = 2,8 Hz. Zweite Biegeeigenfrequenz (vertikal): f2 = 8,4 Hz. Erste Torsionseigenfrequenz: fT1 = 4,1 Hz. Erste laterale Biegeeigenfrequenz: fL1 = 3,6 Hz. Die erste Biegeeigenfrequenz f1 = 2,8 Hz liegt im kritischen Bereich für Fußgängeranregung (1,6–2,4 Hz für 1. Harmonische, 3,2–4,8 Hz für 2. Harmonische). Da f1 = 2,8 Hz zwischen der 1. und 2. Harmonischen liegt, ist eine Resonanzanregung durch normale Fußgänger unwahrscheinlich, aber bei schnellem Gehen (Schrittfrequenz 2,8 Hz, Jogger) möglich.

### 3.2 Beschleunigungsnachweis

Der Beschleunigungsnachweis wird nach DIN EN 1990, Anhang A2 für Fußgängerbrücken geführt. Komfortklasse CL2 (Radschnellweg, keine Aufenthaltsfunktion): zulässige vertikale Beschleunigung alim = 0,70 m/s². Berechnete maximale Beschleunigung unter einem Einzelfußgänger (70 kg, Schrittfrequenz 2,0 Hz, DLF α1 = 0,40): avert = α1 × F0 × φ / (M × ζ) = 0,40 × 686 × 0,012 / (28.500 × 0,008) = 0,014 m/s². Berechnete Beschleunigung unter Fußgängerstrom (Fußgängerdichte d = 0,6 P/m², Brückenfläche 189 m², Neff = 10,8 × √(ζ × n) = 10,8 × √(0,008 × 113) = 10,3 äquivalente Fußgänger): avert,stream = avert × Neff = 0,014 × 10,3 = 0,14 m/s². Das logarithmische Dekrement der Dämpfung ζ = 0,008 (Stahl-Holz-Verbund, konservativer Ansatz). Die berechnete Beschleunigung von 0,14 m/s² liegt weit unter dem Grenzwert von 0,70 m/s². Der Schwingungsnachweis ist mit großer Reserve erfüllt.

### 3.3 Laterale Schwingungen

Für Brücken mit Eigenfrequenz fL < 1,5 Hz besteht die Gefahr der lateralen Synchronisation (Lock-in-Effekt, wie bei der Millennium Bridge in London). Die laterale Eigenfrequenz fL1 = 3,6 Hz liegt deutlich über dem kritischen Bereich. Ein Lock-in-Nachweis ist nicht erforderlich.

## 4. Ermüdungsnachweis

### 4.1 Kerbfallklassifizierung

Die maßgebenden Schweißnahtdetails werden nach DIN EN 1993-1-9 (Ermüdungsbemessung) klassifiziert. Maßgebend ist die Stumpfnaht am Anschluss der Diagonalen an den Untergurt-Knotenblechen: Kerbfallklasse K80 (Tabelle 8.4, Detailkategorie 80, Stumpfnaht mit bearbeiteter Schweißnahtoberfläche). Weiterhin kritisch: Kehlnaht Querträger-Anschluss an Hauptträger: Kerbfallklasse K71 (Tabelle 8.5, Angeschweißte Querträger).

### 4.2 Spannungsschwingbreiten

Die schädigungsäquivalente Spannungsschwingbreite wird nach DIN EN 1993-2, Abschnitt 9 für Fußgängerbrücken ermittelt. Verkehrslastmodell LM4 (Fußgängerstrom, gleichmäßig verteilte Last 5 kN/m²). Maximale Spannungsschwingbreite im Untergurt unter Vollbelastung/Entlastung: Δσ = 62 N/mm². Schädigungsäquivalente Spannungsschwingbreite: ΔσE,2 = λ × Φ × Δσ = 0,60 × 1,00 × 62 = 37,2 N/mm² (Schädigungsäquivalenzfaktor λ = 0,60 für Fußgängerbrücken nach DIN EN 1993-2/NA). Ermüdungsfestigkeit: ΔσC = 80 N/mm² (K80). Nachweis: γFf × ΔσE,2 / (ΔσC / γMf) = 1,0 × 37,2 / (80 / 1,15) = 37,2 / 69,6 = 0,53 < 1,0. Der Ermüdungsnachweis ist mit einer Auslastung von 53 Prozent erfüllt. Die Lebensdauer unter Ermüdungsbeanspruchung übersteigt 100 Jahre.

## 5. Korrosionsschutz und Holzschutz

### 5.1 Stahlbau-Korrosionsschutz

Korrosivitätskategorie C4 (hoch — Flussnähe, erhöhte Feuchtigkeit) nach DIN EN ISO 12944. Schutzdauer lang (> 25 Jahre). Beschichtungsaufbau: Strahlreinheitsgrad Sa 2½ nach DIN EN ISO 8501-1, Grundierung Zinkstaubgrundierung EP 80 µm, Zwischenbeschichtung EP 120 µm, Deckbeschichtung PUR 80 µm, Gesamtschichtdicke 280 µm. Farbton Stahlkonstruktion: RAL 7016 Anthrazitgrau. Die Beschichtung wird in der Werkstatt aufgebracht (bis auf die Montagestöße). Die Erstinspektion erfolgt nach 5 Jahren, Ausbesserung der Beschichtung nach 15 Jahren, Vollerneuerung nach 25 Jahren.

### 5.2 Holzschutz

Die BSH-Fahrbahnplatte aus GL28h (Fichte/Tanne, keilgezinkte Lamellen) wird in die Gebrauchsklasse GK 2 (Holzfeuchte gelegentlich über 20 Prozent) eingestuft. Konstruktiver Holzschutz: Ober- und Unterseitige Abdichtung der Fahrbahnplatte mit Bitumen-Schweißbahn und PUR-Beschichtung, Tropfkanten an den Plattenrändern, Hinterlüftungsspalt zwischen Holzplatte und Stahlträger. Chemischer Holzschutz: Imprägnierung der Fahrbahnplatte mit Kupfer-HDO (Schutzmittelklasse GK 2 nach DIN 68800-3), Aufbringmenge 80 kg/m³ Splintholz. Die Schubdübel-Bohrungen werden mit Epoxidharz versiegelt, um Feuchtigkeitseintritt an den Verbindungsstellen zu verhindern.

## 6. Lager, Dehnfugen und Montage

Die Brücke ruht auf Elastomer-Lagern (Typ B nach DIN EN 1337-3). Festlager am Westwiderlager (nimmt horizontale Kräfte auf), Loslager am Ostwiderlager (Verschiebung ±30 mm). Die Fahrbahnübergangskonstruktionen bestehen aus elastischen Fingerplatten mit Entwässerungsrinne, die für Radverkehr vibrationsarm überfahrbar sind (Stufenhöhe < 3 mm).

Die Montage erfolgt durch seitlichen Einschieben des vormontierten Stahltragwerks über Hilfsstützen im Fluss (temporäre Gründung auf Stahlprofilen, nach Montage zurückgebaut). Die BSH-Fahrbahnplatte wird in 6 m langen Segmenten auf das Stahltragwerk aufgelegt und vor Ort verschraubt. Gesamte Montagezeit: 4 Wochen.

## Zusammenfassung in einfacher Sprache

Dieses Gutachten beschreibt die Statik einer neuen Bruecke fuer Fahrraeder und Fussgaenger ueber einen Fluss. Die Bruecke ist Teil eines Radschnellwegs und hat einen 3 Meter breiten Radweg sowie einen 1,5 Meter breiten Gehweg. Die Konstruktion aus Stahl und Holz wurde so berechnet, dass sie auch bei vielen Radfahrern und Fussgaengern gleichzeitig nicht schwingt oder wackelt. Die Bruecke ist 42 Meter lang und wird an beiden Ufern auf Betonfundamenten gegruendet.

Musterstadt, den 15.02.2026

_Dr.-Ing. Hans-Peter Brückner, Brückenbau-Ingenieure Westfalen GmbH_`,
};
