import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-009',
  filename: 'Statik_Tragwerk_BA010.md',
  format: 'md',
  tags: ['Statik', 'Tiefgarage'],
  created: '2026-02-05T10:00:00Z',
  vorgangId: 'BA-2026-010',
  markdown: `---
titel: Tragwerksplanung Tiefgarage Parkstraße 30
aktenzeichen: BA-2026-010
datum: 2026-02-05
ersteller: Ingenieurbüro Dr. Krause + Kollegen
---

# Tragwerksplanung — Zweigeschossige Tiefgarage Parkstraße 30

## 1. Konstruktionskonzept

Die zweigeschossige Tiefgarage für 86 PKW-Stellplätze wird als monolithische wasserundurchlässige Stahlbetonkonstruktion (WU-Beton nach DAfStb-Richtlinie, Ausgabe 2017) hergestellt. Die Grundfläche beträgt 42 m × 28 m bei einer Gesamttiefe von 5,60 m unter Geländeoberkante (GOK). Das Stützenraster beträgt 8,10 m × 5,40 m, optimiert für Doppelparker-Stellplätze (Stellplatzbreite 2,50 m, Fahrgassenbreite 6,00 m). Die Konstruktion umfasst: Bodenplatte d = 35 cm (UG2-Sohle), Zwischendecke d = 25 cm (UG1-Decke), Dachdecke d = 28 cm (Decke über UG1), Außenwände d = 30 cm, Innenstützen 40 × 40 cm und die Rampenanlage als gewendelte Halbrampe (Steigung 12 Prozent, Fahrkurvenradius 5,50 m innen).

Die Bemessung erfolgt nach DIN EN 1992-1-1 in Verbindung mit der DAfStb-Richtlinie Wasserundurchlässige Bauwerke aus Beton. Betongüte: C35/45, Expositionsklassen XC3/XD3 (Chlorideinwirkung durch Tausalz auf Fahrbahndecke) und XF4 (Frost-Tau-Wechsel mit Taumittel) für die Dachdecke, XC3/XA1 für Bodenplatte und Wände. Bewehrung B500B. Betondeckung: cnom = 55 mm (Dachdecke, XD3), cnom = 45 mm (Wände, erdberührt), cnom = 40 mm (Bodenplatte, XC3).

## 2. Lastannahmen

### 2.1 Ständige Einwirkungen

Eigengewicht Stahlbeton (25 kN/m³): Bodenplatte 8,75 kN/m², Zwischendecke 6,25 kN/m², Dachdecke 7,00 kN/m². Erdüberschüttung auf der Dachdecke: 1,20 m Bodenauflast bei γ = 19 kN/m³ = 22,80 kN/m². Gründachaufbau (extensiv, wassergesättigt): 1,80 kN/m². Gesamt ständige Last auf Dachdecke: 7,00 + 22,80 + 1,80 = 31,60 kN/m². Erddruck auf die Außenwände: aktiver Erddruck eagh = Ka × γ × h mit Ka = 0,33 (Reibungswinkel φ' = 30°, Geschiebemergel). Am Wandfuß (h = 5,60 m): eagh = 0,33 × 19 × 5,60 = 35,1 kN/m². Hydrostatischer Wasserdruck am Wandfuß: ew = γw × hw = 10 × 3,80 = 38,0 kN/m².

### 2.2 Veränderliche Einwirkungen

Verkehrslast Tiefgarage: PKW-Verkehr qk = 2,50 kN/m² (Nutzungskategorie F nach DIN EN 1991-1-1). Einzellast Radaufstandsfläche Qk = 20 kN auf Fläche 200 × 200 mm. Auf der Dachdecke (öffentlich zugängliche Freifläche über der Tiefgarage): Nutzlast qk = 5,00 kN/m² (Versammlungsfläche, da als öffentlicher Platz genutzt). Schneelast sk = 0,85 kN/m² auf der Erdüberdeckung. Die Schneelast wird mit der Verkehrslast nicht überlagert, da die Erdüberdeckung die Schneelast als ständige Last aufnimmt.

## 3. Wasserdruckbelastung und Auftriebsnachweis

### 3.1 Bemessungswasserstand

Der Grundwasserspiegel liegt laut hydrogeologischem Gutachten (Büro AquaGeo, Bericht HG-2025-114) im Mittel bei 1,80 m unter GOK. Der Bemessungswasserstand wird mit dem höchsten gemessenen Stand von 1,20 m unter GOK plus einem Sicherheitszuschlag von 0,50 m auf 0,70 m unter GOK festgelegt. Die maximale Wasserdruckhöhe auf die Bodenplatte beträgt damit hw = 5,60 - 0,70 = 4,90 m. Wasserdruck auf die Sohle: pw = γw × hw = 10 × 4,90 = 49,0 kN/m². Die Bemessung der Bodenplatte auf Biegung und die Rissbreitenbegrenzung werden für diesen Wasserdruck geführt.

### 3.2 Auftriebsnachweis

Der Auftriebsnachweis wird nach DIN 1054 (Grenzzustand UPL) geführt. Destabilisierende Einwirkung (Wasserdruck): Gdst,d = γG,dst × γw × hw × A = 1,05 × 10 × 4,90 × (42 × 28) = 60.530 kN. Stabilisierende Einwirkung (Eigengewicht des Bauwerks): Eigengewicht Bodenplatte: 35 × 0,01 × 25 × 42 × 28 = 10.290 kN. Eigengewicht Wände: 2 × (42 + 28) × 0,30 × 5,60 × 25 = 5.880 kN. Eigengewicht Zwischendecke: 42 × 28 × 0,25 × 25 = 7.350 kN. Eigengewicht Dachdecke: 42 × 28 × 0,28 × 25 = 8.232 kN. Eigengewicht Stützen: 24 Stück × 0,40 × 0,40 × 5,60 × 25 = 538 kN. Erdüberschüttung: 42 × 28 × 1,20 × 19 = 26.812 kN. Summe Gstb,k = 59.102 kN. Bemessungswert: Gstb,d = γG,stb × Gstb,k = 0,95 × 59.102 = 56.147 kN. Nachweis: Gstb,d / Gdst,d = 56.147 / 60.530 = 0,93 < 1,0. Der Auftriebsnachweis ist ohne zusätzliche Maßnahmen NICHT erfüllt.

Maßnahme: Einbau von 12 Zugpfählen (Mikropfähle GEWI Ø 63,5 mm, Tragfähigkeit Zug Rt,d = 450 kN je Pfahl) in der Bodenplatte. Zusätzliche Rückhaltekraft: 12 × 450 = 5.400 kN. Neuer Nachweis: (56.147 + 5.400) / 60.530 = 1,02 > 1,0. Der Auftriebsnachweis ist mit Zugpfählen erfüllt.

## 4. Durchstanznachweis

### 4.1 Innenstützen

Die Innenstützen (40 × 40 cm) tragen die Deckenlasten beider Geschosse. Maßgebend ist die Zwischendecke (d = 25 cm, statische Nutzhöhe d = 210 mm) mit der größten Einwirkung. Einwirkende Durchstanzlast: VEd = γG × gk × A + γQ × qk × A = 1,35 × 12,50 × 43,74 + 1,50 × 2,50 × 43,74 = 738 + 164 = 902 kN (Einzugsfläche A = 8,10 × 5,40 = 43,74 m², Erhöhungsfaktor β = 1,15 für Innenstütze berücksichtigt). Kritischer Rundschnitt u1 in Abstand 2d = 420 mm vom Stützenrand: u1 = 4 × (400 + 2 × 420) = 4.960 mm. Schubspannung: vEd = VEd / (u1 × d) = 902.000 / (4.960 × 210) = 0,87 N/mm². Durchstanztragfähigkeit ohne Bewehrung: vRd,c = 0,59 N/mm² (mit ρl = 0,015, k = 1,98, fck = 35 N/mm²). Da vEd > vRd,c, ist Durchstanzbewehrung erforderlich.

Gewählt: Halfen HDB Dübelleisten, 4 Reihen à 10 Doppelkopfanker (d = 16 mm), Tragfähigkeit vRd,cs = 1,12 N/mm² > 0,87 N/mm². Auslastung: 78 Prozent. Der maximale Durchstanzwiderstand vRd,max = 1,48 N/mm² wird nicht überschritten.

### 4.2 Randstützen

An den Randstützen (Erhöhungsfaktor β = 1,40) beträgt die Durchstanzlast VEd = 620 kN. Die Dübelleisten werden mit 3 Reihen à 8 Doppelkopfankern ausgeführt. Auslastung: 82 Prozent.

## 5. Rissbreitenbegrenzung WU-Konstruktion

### 5.1 Bodenplatte

Beanspruchungsklasse 1 (trockene Oberfläche, Nutzung als Parkfläche). Zulässige Rissbreite: wk,zul = 0,15 mm (druckwasserbeaufschlagte Seite). Die Mindestbewehrung zur Rissbreitenbegrenzung infolge Zwang (abfließende Hydratationswärme) wird nach DIN EN 1992-1-1, Abschnitt 7.3.2 berechnet. Wirksame Betonzugfestigkeit zum Zeitpunkt der Rissbildung: fct,eff = 0,5 × fctm = 0,5 × 3,2 = 1,6 N/mm² (für jungen Beton, t = 3 Tage). Mindestbewehrung je Seite: As,min = kc × k × Act × fct,eff / σs = 1,0 × 0,65 × (350/2 × 1000) × 1,6 / 200 = 9,1 cm²/m. Gewählt: Ø 12/125 = 9,05 cm²/m je Seite, obere und untere Lage. Rechnerische Rissbreite: wk = 0,14 mm < 0,15 mm. Nachweis erfüllt.

### 5.2 Außenwände

Erdberührte Außenwände mit einseitiger Wasserdruckbelastung. Dicke 30 cm. Die Rissbreitenbegrenzung wird sowohl für Zwangbeanspruchung (horizontale Bewehrung) als auch für Biegung aus Wasserdruck (vertikale Bewehrung) nachgewiesen. Mindestbewehrung horizontal: As,min = 8,4 cm²/m je Seite (Ø 12/130). Mindestbewehrung vertikal: As,min = 7,2 cm²/m je Seite (Ø 12/150). Arbeitsfugen werden mit innenliegenden Fugenblechen (Stahlblech 1,5 mm, Breite 300 mm) und Injektionsschläuchen gesichert.

## 6. Dauerhaftigkeit

Die Expositionsklassen XD3/XF4 für die Fahrbahnflächen erfordern besondere Dauerhaftigkeitsmaßnahmen. Die Betondeckung cnom = 55 mm (Vorhaltemaß Δcdev = 10 mm) gewährleistet eine Karbonatisierungsschutzzeit von über 100 Jahren. Zusätzlich erhält die Dachdecke eine Oberflächenschutzbeschichtung OS 8 (rissüberbrückend, chloridbremsend) nach ZTV-ING. Die Fahrbahnplatten in den Parkebenen erhalten eine OS 11b Beschichtung (Parkdeckbeschichtung mit Verschleißschicht). Dehnfugen sind alle 40 m angeordnet und mit wasserdichten Fugenband-Konstruktionen ausgestattet.

Musterstadt, den 05.02.2026

_Dr.-Ing. Thomas Krause, Prüfingenieur für Baustatik_`,
};
