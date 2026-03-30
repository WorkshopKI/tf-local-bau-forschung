import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-031',
  filename: 'Hydrogeologie_BA010.md',
  format: 'md',
  tags: ['Hydrogeologie', 'Grundwasser', 'Baugrube'],
  created: '2026-01-20T10:00:00Z',
  vorgangId: 'BA-2026-010',
  markdown: `---
titel: Hydrogeologisches Gutachten Tiefgarage Parkstraße 30
aktenzeichen: BA-2026-010
datum: 2026-01-20
ersteller: AquaGeo Ingenieurgesellschaft mbH
---

# Hydrogeologisches Gutachten — Tiefgarage Parkstraße 30

## 1. Aufgabenstellung und Standort

Für die geplante zweigeschossige Tiefgarage Parkstraße 30 (Grundfläche 42 m × 28 m, Aushubtiefe bis 5,60 m unter GOK) wurde ein hydrogeologisches Gutachten zur Bestimmung der Grundwasserverhältnisse, zur Bemessung der Bauzeitwasserhaltung und zur Bewertung der Auswirkungen auf die Nachbarbebauung beauftragt. Das Grundstück liegt im Innenstadtbereich von Musterstadt in der Niederterrasse der Muster (quartäre Kiese und Sande über tertiärem Ton). Die Geländeoberfläche liegt bei 132,50 m ü. NHN.

Die Untersuchungen umfassen: Auswertung vorhandener geologischer und hydrogeologischer Daten (Geologische Karte GK25 Blatt 3912 Musterstadt, Grundwassergleichenplan des Kreises Musterland 2024), Einrichtung und Beprobung von 4 Grundwassermessstellen (GWM 1 bis GWM 4), einen Pumpversuch über 72 Stunden zur Bestimmung der Durchlässigkeit und Ergiebigkeit des Grundwasserleiters, eine Grundwasserstandsmessung über 12 Monate (Januar 2025 bis Januar 2026) und eine Setzungsprognose für die Nachbarbebauung.

## 2. Geologische und hydrogeologische Verhältnisse

### 2.1 Schichtenfolge

Die Schichtenfolge wurde anhand der 4 Bohrungen (Tiefe je 12 m) und der Auswertung vorhandener Bohrdaten (Bohrungsarchiv Geologischer Dienst NRW, 8 Bohrungen im Umkreis von 200 m) ermittelt:

0,00–0,80 m: Auffüllung (Schotter, Bauschutt, Humus) — durchlässig, heterogen. 0,80–3,50 m: Mittelsand, schwach schluffig, locker bis mitteldicht gelagert (quartäre Niederterrassensedimente) — kf ≈ 1 × 10⁻⁴ m/s. 3,50–8,20 m: Kies, sandig, mitteldicht bis dicht gelagert (quartäre Niederterrassenschotter, Hauptgrundwasserleiter) — kf ≈ 2,5 × 10⁻⁴ m/s. 8,20–8,80 m: Schluff, tonig, steif (Übergangszone, Grundwasserstauer) — kf ≈ 5 × 10⁻⁸ m/s. Ab 8,80 m: Tertiärton, steif bis halbfest (Grundwassersohle, praktisch undurchlässig) — kf < 1 × 10⁻⁹ m/s.

Der Grundwasserleiter (Kies-Sand-Schicht, 0,80–8,20 m) hat eine Mächtigkeit von 7,40 m und wird unten vom Tertiärton begrenzt (gespannter bis teilgespannter Grundwasserleiter). Die Transmissivität des Grundwasserleiters beträgt T = kf × M = 2,5 × 10⁻⁴ × 7,40 = 1,85 × 10⁻³ m²/s (bestimmt aus dem Pumpversuch, siehe Abschnitt 3).

### 2.2 Grundwasserstände

Die Grundwasserstände wurden über 12 Monate in den 4 Messstellen halbautomatisch erfasst (Drucksonden CTD-Diver, Messintervall 6 Stunden). Ergebnisse:

| Messstelle | Lage | MW [m ü. NHN] | HW [m ü. NHN] | NW [m ü. NHN] |
|-----------|------|--------------|---------------|---------------|
| GWM 1 | Oberstrom | 130,72 | 131,32 | 130,28 |
| GWM 2 | Baustelle N | 130,68 | 131,28 | 130,24 |
| GWM 3 | Baustelle S | 130,64 | 131,24 | 130,20 |
| GWM 4 | Unterstrom | 130,58 | 131,18 | 130,14 |

Mittlerer Grundwasserstand (MW) am Standort: 130,66 m ü. NHN = **1,84 m unter GOK** (132,50 m). Höchster gemessener Grundwasserstand (HW, März 2025, Schneeschmelze): 131,28 m ü. NHN = **1,22 m unter GOK**. Niedrigster Stand (NW, September 2025): 130,22 m ü. NHN = **2,28 m unter GOK**. Die Grundwasserfließrichtung ist von Südwest nach Nordost (Richtung Muster), das hydraulische Gefälle beträgt i = 0,003 (0,3 Prozent).

## 3. Pumpversuch

### 3.1 Versuchsdurchführung

Der 72-Stunden-Pumpversuch wurde am Förderbrunnen GWM 2 durchgeführt (Pumpe: Grundfos SP5A-33, Fördermenge 4,5 l/s konstant). Die Grundwasserstandsabsenkung wurde in den 3 Beobachtungsmessstellen (GWM 1, 3, 4) und im Förderbrunnen selbst mit 6-Stunden-Intervallen registriert. Die Fördermenge wurde über einen geeichten Durchflussmesser (MID, Endress+Hauser Promag P) kontrolliert und über die gesamte Versuchsdauer auf ±5 Prozent konstant gehalten.

### 3.2 Ergebnisse

Die Absenkung im Förderbrunnen erreichte nach 48 Stunden einen quasistationären Zustand bei s = 1,85 m (Grundwasserstand im Brunnen: 128,83 m ü. NHN). Die Absenkungen in den Beobachtungsmessstellen betrugen: GWM 1 (Abstand 18 m): s = 0,42 m. GWM 3 (Abstand 12 m): s = 0,68 m. GWM 4 (Abstand 32 m): s = 0,22 m.

Die Auswertung nach Theis (instationär, Curve-Matching) und Cooper-Jacob (Geradenverfahren) ergab: Transmissivität T = 1,85 × 10⁻³ m²/s (MW aus beiden Verfahren). Speicherkoeffizient S = 8,2 × 10⁻² (teilgespannter Grundwasserleiter). Durchlässigkeitsbeiwert kf = T / M = 1,85 × 10⁻³ / 7,40 = **2,5 × 10⁻⁴ m/s** (mitteldurchlässig, entspricht sandigem Kies nach DIN 18130). Der Reichweite des Absenktrichters bei Dauerpumpung (R = 3.000 × s × √kf nach Sichardt): R = 3.000 × 1,85 × √(2,5 × 10⁻⁴) = 88 m.

## 4. Baugrubenwasserhaltung

### 4.1 Erforderliche Absenkung

Die Unterkante der Tiefgaragen-Bodenplatte liegt bei 126,90 m ü. NHN (= 5,60 m unter GOK). Die Arbeitsraumtiefe unterhalb der Bodenplatte beträgt 0,40 m (Sauberkeitsschicht, Bewehrung). Die erforderliche Absenkung des Grundwasserspiegels beträgt: Zielwasserstand ≤ 126,50 m ü. NHN = 4,16 m unter dem mittleren Grundwasserstand (130,66 m). Unter Berücksichtigung des höchsten Grundwasserstands (131,28 m): Absenkung bis zu 4,78 m erforderlich.

### 4.2 Brunnenbemessung

Die Bemessung der Wasserhaltung erfolgt nach dem Verfahren von Forchheimer (Superposition von Einzelbrunnen). Für die Baugrube (42 m × 28 m) wird ein Ersatzradius r0 = √(A/π) = √(1.176/π) = 19,4 m angesetzt. Die erforderliche Gesamtfördermenge bei einer Absenkung von 4,78 m: Q = π × kf × (H² - h²) / ln(R/r0) = π × 2,5 × 10⁻⁴ × (7,40² - 2,62²) / ln(88/19,4) = π × 2,5 × 10⁻⁴ × (54,76 - 6,86) / 1,51 = **25,0 l/s** (worst case bei HW).

Gewählt werden 8 Brunnen (Bohrdurchmesser 400 mm, Filterrohr DN 200, Filterlänge 4 m im Kies-Aquifer) im Abstand von 12 m entlang der Baugrubenkante, Fördermenge je Brunnen 3,5 l/s (Pumpen: Grundfos SP3A-33, regelbar). Die Gesamtkapazität der Brunnenanlage beträgt 28 l/s, was eine Reserve von 12 Prozent über der berechneten Fördermenge bietet. Die Brunnen werden mit einer zentralen SPS-Steuerung betrieben, die die Fördermenge automatisch an den aktuellen Grundwasserstand anpasst (Zielwert: Wasserstand in der Baugrube konstant 0,50 m unter Baugrubensohle).

### 4.3 Wasserableitung

Das geförderte Grundwasser (geschätzt 12 l/s im Mittel, max. 25 l/s bei Hochwasser) wird in die Muster eingeleitet. Eine wasserrechtliche Erlaubnis nach §8 WHG für die Einleitung wurde am 20.12.2025 bei der unteren Wasserbehörde beantragt. Die Wasserqualität des geförderten Grundwassers wurde analysiert: pH 7,2, Leitfähigkeit 680 µS/cm, Eisen 1,8 mg/l, Mangan 0,12 mg/l — eine Enteisenungsanlage (Belüftung + Sandfilter, Kapazität 30 l/s) wird vor der Einleitung installiert, um die Einleitgrenzwerte (Eisen < 0,5 mg/l) einzuhalten.

## 5. Setzungsprognose Nachbarbebauung

### 5.1 Berechnungsmethode

Die Absenkung des Grundwasserspiegels im Umfeld der Baugrube erhöht die wirksamen Spannungen im Boden und kann Setzungen der Nachbargebäude verursachen. Die Setzungsprognose wurde nach dem Verfahren der effektiven Spannungserhöhung berechnet: Δσ' = γw × Δh (Wasserspiegelabsenkung × Wichte des Wassers). Bei einer Absenkung von 4 m am Baugrubenrand und einer Absenkung von 0,5 m am nächsten Nachbargebäude (Parkstraße 28, Abstand 15 m, Flachgründung auf Streifenfundamenten in 1,2 m Tiefe): Δσ' = 10 × 0,5 = 5 kN/m². Setzung: s = Δσ' × H / Es = 5 × 3,0 / 20.000 = 0,75 mm (Steifemodul des Sands Es = 20.000 kN/m², Zusammendrückbare Schicht H = 3 m unter Fundament bis zum Kies).

### 5.2 Ergebnis

Die maximale Setzung am Nachbargebäude Parkstraße 28 beträgt **0,75 mm** — deutlich unter dem Grenzwert von 5 mm (DIN 4107, Kategorie II: Gebäude mit konventioneller Gründung). Am Nachbargebäude Parkstraße 32 (Abstand 22 m) beträgt die prognostizierte Setzung 0,3 mm. Die Setzungsprognose zeigt, dass die Baugrubenwasserhaltung die Nachbarbebauung nicht gefährdet. Dennoch wird ein Setzungsmonitoring während der gesamten Bauzeit empfohlen.

## 6. Monitoring-Konzept

Das Monitoring-Konzept umfasst: (1) Kontinuierliche Grundwasserstandsmessung in den 4 GWM und in 4 zusätzlichen Beweissicherungsmessstellen an den Nachbargebäuden (Datenlogger, 6-Stunden-Intervall, Fernübertragung per Mobilfunk). (2) Nivellement an 12 Höhenmesspunkten (Setzungsbolzen) an den Fassaden der 4 nächsten Nachbargebäude (zweiwöchentlich während der Wasserhaltung). (3) Dokumentation der Fördermenge (MID-Durchflussmesser, stündliche Aufzeichnung). (4) Wasserqualitätsmonitoring am Einleitpunkt (monatlich: pH, Eisen, Mangan, AFS). Die Grenzwerte für das Monitoring sind: Grundwasserstand in der Baugrube ≤ 126,50 m ü. NHN, Setzung Nachbargebäude < 3 mm (Eingriffswert, bei dem die Fördermenge reduziert wird), Eisen im Einleitwasser < 0,5 mg/l. Bei Überschreitung der Eingriffswerte wird die Wasserhaltung angepasst (Reduzierung der Fördermenge, ggf. Rückversickerung zur Stützung des Grundwasserspiegels im Abstrom).

## Zusammenfassung in einfacher Sprache

Fuer den Bau einer Tiefgarage in der Parkstrasse 30 wurde untersucht, wie hoch das Grundwasser steht und wie man es waehrend der Bauzeit absenken kann. Das Grundwasser liegt nur etwa 1,80 Meter unter der Oberflaeche, die Tiefgarage muss aber 5,60 Meter tief ausgehoben werden. Deshalb muessen acht Brunnen rund um die Baugrube das Wasser abpumpen. Berechnungen zeigen, dass die Nachbargebaeude dadurch nicht gefaehrdet werden — die erwartete Absenkung an den naechsten Haeusern betraegt weniger als einen Millimeter. Waehrend der gesamten Bauzeit werden Grundwasserstaende und moegliche Setzungen ueberwacht.

Musterstadt, den 20.01.2026

_Dr. rer. nat. Julia Wasserstein, AquaGeo Ingenieurgesellschaft mbH_`,
};
