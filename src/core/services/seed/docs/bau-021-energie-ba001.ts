import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-021',
  filename: 'Energienachweis_BA001.md',
  format: 'md',
  tags: ['Energie', 'EFH', 'KfW-55'],
  created: '2026-01-25T10:00:00Z',
  vorgangId: 'BA-2026-001',
  markdown: `---
titel: Energetischer Nachweis EFH Ahornweg 15 — KfW-Effizienzhaus 55
aktenzeichen: BA-2026-001
datum: 2026-01-25
ersteller: Energieberatung Grünwald GmbH
---

# Energetischer Nachweis — EFH Ahornweg 15, KfW-55

## 1. Nachweisgrundlagen

Der energetische Nachweis wird nach dem Gebäudeenergiegesetz (GEG 2024) geführt. Das Einfamilienhaus Ahornweg 15 wird als KfW-Effizienzhaus 55 geplant, was bedeutet, dass der Primärenergiebedarf höchstens 55 Prozent des GEG-Referenzgebäudes beträgt und der Transmissionswärmeverlust höchstens 70 Prozent des Referenzwertes erreicht. Die KfW-Förderung (Kredit 261, Tilgungszuschuss 15 Prozent) ist an die Einhaltung dieser Grenzwerte geknüpft und wird durch einen Energieeffizienz-Experten (Eintrag in der dena-Expertenliste) bestätigt. Das Berechnungsverfahren folgt DIN V 18599 (Energetische Bewertung von Gebäuden) in allen Teilen. Die Klimadaten entsprechen dem Referenzklima Deutschland (Potsdam) nach DIN V 18599-10.

Das Gebäude hat eine beheizte Nutzfläche AN = 220 m² (berechnet nach GEG §3, vereinfachtes Verfahren: AN = 0,32 × Ve = 0,32 × 680 = 217,6 m², aufgerundet auf 220 m²). Das Gebäudevolumen Ve = 680 m³ (umbauter Raum). Die thermische Gebäudehülle umfasst: Außenwände (152 m²), Dachfläche (108 m²), Bodenplatte (88 m²), Fenster und Türen (32 m²). Das A/V-Verhältnis beträgt A/Ve = 380/680 = 0,56 m⁻¹ — typisch für ein kompaktes Einfamilienhaus.

## 2. Wärmeschutz der Gebäudehülle

### 2.1 Außenwände

Wandaufbau (von außen nach innen): Mineralischer Oberputz 8 mm, Armierungsschicht 5 mm, WDVS Mineralwolle WLG 035 d = 180 mm (λ = 0,035 W/(mK)), Kalksandstein-Planstein KS-PE 20-2.0 d = 175 mm, Kalkgipsputz 15 mm. U-Wert-Berechnung: Rsi = 0,13, Rse = 0,04, RDämmung = 0,180/0,035 = 5,143, RMauerwerk = 0,175/0,990 = 0,177, RPutz = 0,015/0,510 = 0,029. RT = 0,13 + 0,04 + 5,143 + 0,177 + 0,029 + 0,008/0,870 + 0,005/0,700 = 5,536 m²K/W. U-Wert = 1/RT = 0,181 W/(m²K), gerundet **U = 0,18 W/(m²K)**. GEG-Referenzwert: 0,28 W/(m²K) — Unterschreitung um 36 Prozent. Die Wärmedämmung mit 180 mm Mineralwolle bietet neben dem winterlichen Wärmeschutz auch einen guten sommerlichen Wärmeschutz, da die massive Innenschale (KS 175 mm) als thermische Speichermasse wirkt und Temperaturspitzen im Sommer abpuffert.

### 2.2 Dach

Dachaufbau (von außen nach innen): Betondachsteine, Lattung/Konterlattung mit Hinterlüftung, diffusionsoffene Unterspannbahn (sd ≤ 0,3 m), Zwischensparrendämmung Mineralwolle WLG 035 d = 200 mm, Untersparrendämmung Mineralwolle WLG 035 d = 60 mm auf Querlattung, Dampfbremse (sd = 2 m, feuchtevariabel), Gipskarton 12,5 mm. U-Wert: Rsi = 0,10, Rse = 0,04 (belüftetes Dach), RDämmung = (0,200 + 0,060)/0,035 = 7,429 (vereinfacht, ohne Sparrenanteil), RSparren-Korrektur nach DIN EN ISO 6946 (Sparrenanteil 12 Prozent, λSparren = 0,13 W/(mK)): UC = 1/(Rsi + Rse + Σ(d/λ)) unter Berücksichtigung des oberen und unteren Grenzwerts der Wärmedurchgangswiderstände. Ergebnis: **U = 0,14 W/(m²K)**. GEG-Referenzwert: 0,20 W/(m²K) — Unterschreitung um 30 Prozent.

### 2.3 Bodenplatte

Aufbau (von oben nach unten): Fußbodenbelag, Zementestrich 55 mm, PE-Folie, Trittschalldämmung 30 mm, XPS-Wärmedämmung d = 120 mm (λ = 0,035 W/(mK)) unter der Bodenplatte, Stahlbeton-Bodenplatte 250 mm, kapillarbrechende Kiesschicht 200 mm, Erdreich. U-Wert (mit Erdreichwiderstand nach DIN EN ISO 13370, vereinfachtes Verfahren für Bodenplatten auf Erdreich, B' = A/(0,5 × P) = 88/(0,5 × 37,6) = 4,68 m): **U = 0,22 W/(m²K)**. GEG-Referenzwert: 0,35 W/(m²K) — Unterschreitung um 37 Prozent.

### 2.4 Fenster und Außentüren

Fenster: Kunststoff-Mehrkammerprofile (6 Kammern, Bautiefe 82 mm) mit Dreifach-Isolierverglasung (4-16-4-16-4, Argonfüllung, Low-E-Beschichtung auf Position 2 und 5). Ug = 0,60 W/(m²K), g-Wert = 0,52. Rahmen-U-Wert Uf = 1,10 W/(m²K). Glasrandverbund Ψg = 0,040 W/(mK) (thermisch optimierter Abstandhalter, sogenannte warme Kante). Gesamt-Fenster-U-Wert (Standardfenster 1,23 m × 1,48 m): **Uw = 0,95 W/(m²K)** (berechnet nach DIN EN ISO 10077-1). Haustür: Aluminium-Haustür mit PUR-Kernfüllung, UD = 1,20 W/(m²K). GEG-Referenzwert Fenster: 1,30 W/(m²K) — Unterschreitung um 27 Prozent.

## 3. Heizlastberechnung

Die Heizlast wird nach DIN EN 12831 (Heizungsanlagen in Gebäuden — Verfahren zur Berechnung der Norm-Heizlast) berechnet. Norm-Außentemperatur für Musterstadt: θe = -12°C. Norm-Innentemperatur: 20°C (Aufenthaltsräume), 24°C (Bad). Transmissionswärmeverluste: HT = Σ(Ui × Ai × fxi) = 0,18 × 152 × 1,0 + 0,14 × 108 × 1,0 + 0,22 × 88 × 0,60 + 0,95 × 32 × 1,0 = 27,4 + 15,1 + 11,6 + 30,4 = 84,5 W/K. Lüftungswärmeverluste: HV = 0,34 × V̇ × n = 0,34 × 680 × 0,50 = 115,6 W/K (Mindestluftwechsel n = 0,50 h⁻¹, durch Lüftungsanlage sichergestellt). Gesamtlast: ΦHL = (HT + HV) × (θi - θe) = (84,5 + 115,6) × 32 = **6.403 W ≈ 6,4 kW**. Die Wärmepumpe mit 8 kW Heizleistung bei A-7/W35 (Bivalenzpunkt bei -7°C, elektr. Zuheizung unterhalb) deckt die Heizlast mit Reserve ab.

## 4. Anlagentechnik

### 4.1 Luft-Wasser-Wärmepumpe

Hersteller: Stiebel Eltron WPL 13 cool (Monoblock-Außenaufstellung). Heizleistung: 8,2 kW bei A2/W35 (COP 4,1), 5,8 kW bei A-7/W35 (COP 2,8). Jahresarbeitszahl (JAZ) nach VDI 4650 Blatt 1: **JAZ = 3,8** (berechnet mit Vorlauftemperatur 35°C Fußbodenheizung, Warmwasseranteil 18 Prozent, Standort Musterstadt). Kältemittel: R290 (Propan), natürliches Kältemittel mit GWP = 3 (Zukunftssicher, keine F-Gas-Problematik). Die Wärmepumpe ist schalloptimiert (Schallleistungspegel 52 dB(A)) und erfüllt die TA-Lärm-Anforderungen auch bei Nachtbetrieb (Abstand zur Grundstücksgrenze 3 m, berechneter Immissionspegel 32 dB(A) < 35 dB(A) Richtwert WR nachts).

### 4.2 Thermische Solaranlage

Zur Warmwasserbereitung ist eine thermische Solaranlage mit 2 Flachkollektoren (je 3,0 m² Aperturfläche, gesamt 6,0 m²) auf der Süddachfläche installiert (Neigung 38°, Azimut 0° Süd). Der bivalente Warmwasserspeicher fasst 300 Liter (Solar-Wärmetauscher unten, WP-Wärmetauscher oben). Der solare Deckungsgrad für Warmwasser beträgt ca. 60 Prozent (Simulation mit T*SOL, Standort Musterstadt, 4-Personen-Haushalt, 200 Liter/Tag bei 45°C). Der jährliche Solarertrag beträgt 2.400 kWh/a (spezifischer Ertrag 400 kWh/(m²a)).

### 4.3 Lüftungskonzept

Das Lüftungskonzept nach DIN 1946-6 ergibt für das EFH einen notwendigen Außenluftvolumenstrom zum Feuchteschutz von V̇FL = 85 m³/h. Die Lüftung zum Feuchteschutz kann nicht allein über Infiltration (n50 = 1,0 h⁻¹ nach Blower-Door-Test geplant) sichergestellt werden — eine lüftungstechnische Maßnahme ist erforderlich. Gewählt: ventilatorgestützte Abluftanlage mit Einzelraumventilatoren in Küche und Bädern (4 Stück, Gesamtvolumenstrom 120 m³/h bei Grundlüftung) und Fensterfalzlüfter (Regel-air FFL, 4 Stück) in den Aufenthaltsräumen als Zuluftöffnungen. Die Wärmerückgewinnung erfolgt über eine Abluftwärmepumpe, die in die Hauptwärmepumpe integriert ist (Abluft als Wärmequelle im Übergangsbereich).

## 5. Energiebilanz und KfW-55-Nachweis

### 5.1 Primärenergiebedarf

Heizwärmebedarf QH = 38 kWh/(m²a) (berechnet nach DIN V 18599). Warmwasserwärmebedarf QW = 12,5 kWh/(m²a) (Pauschalwert GEG). Hilfsenergien (Pumpen, Ventilator, Regelung): QHilf = 4,5 kWh/(m²a). Endenergiebedarf Strom (WP): QEnd = (QH + QW) / JAZ + QHilf = (38 + 12,5) / 3,8 + 4,5 = 13,3 + 4,5 = 17,8 kWh/(m²a). Solarertrag (Gutschrift Warmwasser): -3,2 kWh/(m²a). Primärenergiefaktor Strom (GEG 2024): fp = 1,8. Primärenergiebedarf: **QP = (17,8 - 3,2) × 1,8 = 26,3 kWh/(m²a)**, gerundet **QP = 27 kWh/(m²a)**. GEG-Referenzgebäude: QP,ref = 49 kWh/(m²a). Verhältnis: 27/49 = 55 Prozent. **KfW-55 Grenzwert (55 Prozent = 27 kWh/(m²a)): exakt eingehalten.**

### 5.2 Transmissionswärmeverlust

Spezifischer Transmissionswärmeverlust: H'T = HT / AHüll = 84,5 / 380 = 0,222 W/(m²K). GEG-Referenzwert für H'T: 0,40 W/(m²K) (freistehendes EFH, A/V = 0,56). KfW-55-Grenzwert: 0,70 × 0,40 = 0,28 W/(m²K). **H'T = 0,222 W/(m²K) < 0,28 W/(m²K)**: Nachweis erfüllt, Unterschreitung um 21 Prozent.

## 6. Sommerlicher Wärmeschutz

Der Nachweis des sommerlichen Wärmeschutzes nach DIN 4108-2:2013, Abschnitt 8 wird für den kritischsten Raum (Wohn-/Essbereich Süd-West, Fensterfläche 8,5 m² bei 42 m² Grundfläche) geführt. Sonneneintragskennwert: S = Σ(Aw,j × gtot,j × FC,j) / AG = (5,2 × 0,52 × 0,25 + 3,3 × 0,52 × 0,25) / 42 = 0,026. Zulässiger Sonneneintragskennwert (Klimaregion B, leichte Bauart wegen Holzbalkendecke im OG): Szul = 0,036. S = 0,026 < Szul = 0,036: Nachweis erfüllt. Die außenliegenden Raffstores (Abminderungsfaktor FC = 0,25) an den Süd- und Westfenstern sind die entscheidende Maßnahme. Ohne Raffstores wäre S = 0,105 > 0,036 — der Nachweis wäre nicht erfüllt. Die Raffstores werden als verbindlicher Bestandteil des Energienachweises festgeschrieben.

Musterstadt, den 25.01.2026

_Dipl.-Ing. (FH) Karl Grünwald, Energieberater (dena)_`,
};
