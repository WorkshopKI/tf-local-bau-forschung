import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-007',
  filename: 'Statik_Tragwerk_BA002.md',
  format: 'md',
  tags: ['Statik', 'MFH'],
  created: '2026-02-01T10:00:00Z',
  vorgangId: 'BA-2026-002',
  markdown: `---
titel: Standsicherheitsnachweis Mehrfamilienhaus Lindenstraße 42
aktenzeichen: BA-2026-002
datum: 2026-02-01
ersteller: Ingenieurbüro Hartmann + Partner
---

# Tragwerksplanung — MFH Lindenstraße 42

## 1. Grundlagen und Normen

Der Standsicherheitsnachweis wird nach folgenden Normen geführt: DIN EN 1990 (Grundlagen der Tragwerksplanung), DIN EN 1991-1-1 (Einwirkungen — Wichten, Eigenlasten, Nutzlasten), DIN EN 1991-1-3 (Schneelasten), DIN EN 1991-1-4 (Windlasten), DIN EN 1992-1-1 (Bemessung Stahlbeton), DIN EN 1997-1 (Geotechnik), DIN EN 1998-1 (Erdbeben) jeweils mit nationalem Anhang (NA). Die Expositionsklassen für die Stahlbetonbauteile werden wie folgt festgelegt: Innenbauteile XC1, Außenbauteile und Tiefgarage XC3, Tiefgaragenbodenplatte XC3/XA1 (leicht angreifender Boden laut Baugrundgutachten). Betongüte: C30/37 für alle Bauteile, Tiefgarage C35/45 (WU-Beton). Betonstahlsorte: B500B (hochduktil) für alle erdbebenrelevanten Bauteile. Die Betondeckung beträgt cnom = 30 mm (Innenbauteile), cnom = 40 mm (Außenbauteile) und cnom = 50 mm (Tiefgarage, erdberührt). Alle feuerfesten Bauteile, die im Brandschutzkonzept mit REI 90 klassifiziert sind, erhalten die brandschutztechnisch erforderliche Achsabstandserhöhung gemäß DIN EN 1992-1-2 Tabellenwerte.

## 2. Lastannahmen

### 2.1 Ständige Einwirkungen

Das Eigengewicht der Stahlbetonflachdecke d = 22 cm beträgt 5,50 kN/m² (Wichte Stahlbeton 25 kN/m³). Die Ausbaulast (Estrich, Trittschalldämmung, Bodenbelag) wird mit 1,50 kN/m² angesetzt. Nichttragende Trennwände werden als flächenbezogener Zuschlag von 0,80 kN/m² berücksichtigt (Wandgewicht der leichten Trennwände < 3,0 kN/m Wandlänge nach DIN EN 1991-1-1/NA Tabelle 6.1). Die vorgehängte hinterlüftete Klinkerfassade erzeugt eine Linienlast von 4,20 kN/m auf die Randunterzüge (Klinkerriemchen 0,85 kN/m², Unterkonstruktion 0,15 kN/m², Dämmung 0,20 kN/m², bezogen auf die Geschosshöhe 2,80 m). Das Gründach auf dem Staffelgeschoss wiegt im wassergesättigten Zustand 1,80 kN/m² (Substrat 10 cm: 1,20 kN/m², Drainageschicht: 0,30 kN/m², Abdichtung und Wärmedämmung: 0,30 kN/m²).

### 2.2 Veränderliche Einwirkungen

Die Nutzlast für Wohnräume beträgt 2,00 kN/m² (Kategorie A1 nach DIN EN 1991-1-1/NA). Für Balkone und Loggien wird eine Nutzlast von 4,00 kN/m² angesetzt (Kategorie A nach DIN EN 1991-1-1/NA, Tabelle 6.2). Die Tiefgarage erhält eine Nutzlast von 2,50 kN/m² für PKW-Verkehr (Kategorie F). Die Schneelast auf dem Flachdach beträgt sk = 0,85 kN/m² (Schneelastzone 2a, Geländehöhe 75 m ü. NHN). Der Formbeiwert μ1 = 0,8 für Flachdächer ergibt eine Dachlast von s = 0,68 kN/m². Verwehungszuschlag am Staffelgeschoss-Rücksprung: μ2 = 1,6, lokale Schneelast 1,36 kN/m² auf 2 m Breite. Die Windlast wird für Windzone 2, Binnenland, Geländekategorie III (Vorstadt, Baumbestand) ermittelt. Böengeschwindigkeitsdruck in 15 m Höhe: qp(15m) = 0,65 kN/m². Druckbeiwerte für Außenflächen: cpe,10 = +0,8 (Luv), cpe,10 = -0,5 (Lee), cpe,10 = -1,2 (Dachrand-Sog). Die resultierende Windlast auf die Gesamtfassade (Aussteifungsnachweis) beträgt Fw = 185 kN pro Geschoss.

### 2.3 Außergewöhnliche Einwirkungen

Das Gebäude liegt in der Erdbebenzone 1 (ag = 0,4 m/s²) nach DIN EN 1998-1/NA. Baugrund: Baugrundklasse C (mitteldichter Sand bis steifer Ton), Bodenparameter S = 1,15, TB = 0,10 s, TC = 0,50 s, TD = 2,00 s. Verhaltensbeiwert q = 1,5 (unbewehrtes Mauerwerk, niedrige Duktilität). Bemessungsspektrum: Sd(T1) = 0,26 m/s² × 1,15 / 1,5 = 0,20 m/s² (Grundschwingzeit T1 ≈ 0,35 s, geschätzt nach Höhe H = 15 m). Die Erdbebenersatzkraft beträgt Fb = 0,20 × 4.800 t / 9,81 = 98 kN, verteilt auf die Geschosse nach der Höhenverteilung gemäß DIN EN 1998-1, Gl. (4.11).

## 3. Gründung

### 3.1 Baugrundverhältnisse

Gemäß dem Baugrundgutachten (Büro GeoConsult, Bericht Nr. GC-2025-847 vom 15.11.2025) steht unter einer 0,80 m mächtigen Auffüllungsschicht ein Geschiebemergel (steif bis halbfest) an. Die zulässige Sohlpressung beträgt σzul = 250 kN/m² bei einer Einbindetiefe von 1,00 m. Der Grundwasserspiegel liegt im Mittel bei 1,80 m unter Geländeoberfläche (GOK), der höchste gemessene Wasserstand bei 1,20 m unter GOK (Messzeitraum 2023–2025). Die Frosttiefe beträgt 80 cm.

### 3.2 Tiefgarage als weiße Wanne

Die Tiefgarage wird als wasserundurchlässige Konstruktion (WU-Beton nach DAfStb-Richtlinie Wasserundurchlässige Bauwerke aus Beton, Ausgabe 2017) ausgeführt. Die Beanspruchungsklasse ist Klasse 1 (Nutzung ohne zusätzliche Abdichtung, trockene Oberfläche). Die Bodenplatte (d = 35 cm, C35/45) wird mit einer Mindestbewehrung zur Rissbreitenbegrenzung versehen: wk ≤ 0,15 mm (druckbeaufschlagte Seite). Die Rissbreitenbegrenzung wird nach DIN EN 1992-1-1, Abschnitt 7.3.4 nachgewiesen. Die Mindestbewehrung As,min beträgt 18,2 cm²/m je Seite (berechnet mit kc = 0,5, k = 0,65, fct,eff = 2,9 N/mm², σs = 200 N/mm²). Die Arbeitsfugen werden mit innenliegenden Fugenblechen (Stahlblech 1,5 mm, Breite 250 mm) gesichert. Die Raumfugen am Übergang Bodenplatte/Wand erhalten Elastomer-Fugenprofile.

## 4. Deckensystem

### 4.1 Flachdecken

Die Geschossdecken sind als Stahlbetonflachdecken d = 22 cm mit Stützweiten von 4,80 m bis 6,20 m konzipiert. Die Deckendicke wurde nach Durchbiegungsbegrenzung (L/d ≤ 28 für Endfelder, DIN EN 1992-1-1, Tabelle 7.4N) und Durchstanzwiderstand bemessen. Der maßgebende Nachweis ist die Durchstanzbemessung an den Innenstützen. Einwirkende Durchstanzlast an der Innenstütze (Regelfeld 5,40 m × 6,20 m): VEd = γG × gk × A × β = 1,35 × 10,30 × 33,5 × 1,15 = 536 kN. Rundschnittumfang u1 = 4 × (400 + 2 × 2d) = 4 × (400 + 880) = 5.120 mm. Durchstanztragfähigkeit vRd,c = CRd,c × k × (100 × ρl × fck)^(1/3) = 0,18/1,5 × 1,68 × (100 × 0,012 × 30)^(1/3) = 0,61 N/mm². Einwirkende Schubspannung vEd = VEd / (u1 × d) = 536.000 / (5.120 × 188) = 0,56 N/mm² < 0,61 N/mm². Der Nachweis ohne Durchstanzbewehrung ist an den Innenstützen knapp erfüllt. Zur Sicherheit werden Dübelleisten (Halfen HDB-KF, 3 Reihen à 8 Stück) an allen Innenstützen eingebaut, die den Durchstanzwiderstand auf vRd,cs = 0,95 N/mm² erhöhen.

### 4.2 Schwingungsnachweis

Für die größten Deckenfelder (6,20 m Spannweite) wird der Schwingungsnachweis nach DIN EN 1991-1-1/NA Anhang A geführt. Die Eigenfrequenz der Decke beträgt f1 = π/(2L²) × √(EI/m) = 7,8 Hz > 3,0 Hz (Grenzwert für Wohngebäude). Der Nachweis ist erfüllt. Die Beschleunigung unter einem Personenschritt (70 kg, Schrittfrequenz 2 Hz) wird nach der Methode von Willford/Young zu a = 0,018 m/s² berechnet, deutlich unter dem Grenzwert von 0,05 m/s² (OS-RMS90 Klasse A für Wohnungen).

## 5. Aussteifung und Erdbeben

Das Gebäude wird über zwei Stahlbetonkerne (Treppenhaus und Aufzugsschacht) und vier Wandscheiben in Querrichtung ausgesteift. Die Kerne haben Wandstärken von 25 cm und nehmen sämtliche horizontalen Lasten (Wind und Erdbeben) auf. Die Schubsteifigkeit der Kerne wurde nach der Methode der virtuellen Arbeit zu GA,eff = 245 MN (Kern 1) und GA,eff = 198 MN (Kern 2) bestimmt. Die Horizontalverschiebung im Kopfpunkt unter Windlast beträgt u = 8,2 mm (H/1830), deutlich unter dem Grenzwert H/500 = 30 mm. Die Torsionswirkung aufgrund der exzentrischen Kernlage wird berücksichtigt. Der zusätzliche Verdrehungsanteil erhöht die Horizontalverschiebung an der ungünstigsten Gebäudeecke auf u,max = 11,4 mm — noch deutlich innerhalb der zulässigen Grenzen.

Die Erdbebennachweis-Befreiung nach DIN EN 1998-1/NA, Abschnitt 4.1 wird geprüft: Das Produkt agR × S × γI = 0,4 × 1,15 × 1,0 = 0,46 m/s² < 0,6 m/s² (Grenzwert für Zone 1, Baugrundklasse C). Damit ist ein vereinfachter Nachweis nach DIN 4149 ausreichend. Die konstruktiven Mindestanforderungen an die Bewehrungsführung in den Kernen und Stützen (Bügelbewehrung, Verankerungslängen) werden dennoch nach Duktilitätsklasse DCL (niedrig) eingehalten, um eine robuste Konstruktion auch bei Beben sicherzustellen.

## 6. Zusammenfassung

Alle Nachweise der Standsicherheit, Gebrauchstauglichkeit und Dauerhaftigkeit sind erfüllt. Die kritischen Nachweise sind: Durchstanzen Innenstütze Regelgeschoss (Auslastung 92 Prozent mit Dübelleisten), Rissbreitenbegrenzung WU-Bodenplatte (wk,calc = 0,13 mm ≤ 0,15 mm), Horizontalverschiebung Gebäudekopf unter Wind (H/1830 bei Grenzwert H/500). Die Bewehrungspläne sind als Anlage beigefügt.

## Zusammenfassung in einfacher Sprache

Dieses Gutachten prueft, ob das geplante Mehrfamilienhaus an der Lindenstrasse 42 sicher und stabil genug gebaut ist. Es wird berechnet, wie viel Gewicht die Decken, Waende und die Tiefgarage tragen muessen — durch das Gebaeude selbst, die Bewohner, Schnee und Wind. Die Tiefgarage wird als wasserdichte Betonwanne gebaut, damit kein Grundwasser eindringt. Alle Berechnungen zeigen, dass das Gebaeude den Belastungen sicher standhaelt, auch bei einem leichten Erdbeben.

Musterstadt, den 01.02.2026

_Dipl.-Ing. Markus Hartmann, Prüfingenieur für Baustatik_`,
};
