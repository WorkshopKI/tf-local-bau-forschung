import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-043',
  filename: 'Projekt_FA013.md',
  format: 'md',
  tags: ['Agrivoltaik', 'Solar', 'Landwirtschaft'],
  created: '2026-01-28T10:00:00Z',
  vorgangId: 'FA-2026-013',
  markdown: `---
titel: Agrivoltaik — Nutzpflanzenproduktion unter Solarmodulen
aktenzeichen: FA-2026-013
datum: 2026-01-28
antragsteller: Prof. Dr. agr. Martin Feldmann, Institut für Pflanzenbau, Universität Musterstadt
---

# Agrivoltaik: Nutzpflanzenproduktion unter Solarmodulen

## 1. Hintergrund und Zielkonflikt

Deutschland steht vor einem doppelten Flächenkonflikt: Einerseits erfordert die Energiewende einen massiven Ausbau der Photovoltaik — das Ziel der Bundesregierung von 215 GW installierter PV-Leistung bis 2030 (EEG 2023) bedeutet einen Zubau von 22 GW pro Jahr, wovon ein erheblicher Anteil auf Freiflächenanlagen entfallen muss. Andererseits steht die landwirtschaftliche Fläche unter Druck: Versiegelung, Naturschutzausgleich und die Sicherung der Nahrungsmittelproduktion konkurrieren um dieselben Flächen. Agrivoltaik-Systeme (APV) bieten einen Ausweg aus diesem Dilemma, indem sie Stromerzeugung und landwirtschaftliche Produktion auf derselben Fläche kombinieren. Die aufgeständerten PV-Module (Höhe 5 m über Boden) ermöglichen die Bewirtschaftung mit konventionellen Landmaschinen (Mähdrescher, Pflug, Drillmaschine) und bieten gleichzeitig positive Nebeneffekte: Verschattung reduziert Hitzestress der Pflanzen bei Trockenperioden, verringert die Evapotranspiration und kann den Bewässerungsbedarf um 20–30 Prozent senken.

Die DIN SPEC 91434 (Agri-Photovoltaik-Anlagen — Anforderungen an die landwirtschaftliche Hauptnutzung) definiert die Kriterien für eine Agrivoltaik-Anlage: Der landwirtschaftliche Ertrag muss mindestens 66 Prozent des Referenzertrags ohne PV-Module betragen, die Fläche muss weiterhin als landwirtschaftliche Nutzfläche gelten (keine Umwidmung in Gewerbefläche) und die Anlage muss rückbaubar sein. Das vorliegende Projekt untersucht systematisch die Ertragsauswirkungen verschiedener APV-Konfigurationen auf ausgewählte Nutzpflanzen unter mitteleuropäischen Klimabedingungen.

## 2. Versuchsdesign

### 2.1 Standort und Versuchsfläche

Der Feldversuch wird auf dem Versuchsgut der Universität Musterstadt (Gemarkung Feldheim, Bodentyp Parabraunerde aus Löss, Ackerzahl 72, langjähriges Niederschlagsmittel 680 mm/a, Jahresmitteltemperatur 10,2°C) durchgeführt. Die Gesamtfläche beträgt 6 ha, aufgeteilt in 4 Versuchsparzellen à 1 ha mit APV-Modulen und 2 Referenzparzellen à 1 ha ohne Module (Kontrolle). Die Parzellen sind randomisiert angeordnet (vollständig randomisiertes Blockdesign mit 3 Wiederholungen je Kultur, Gesamtfläche inklusive Randstreifen und Wege: 8 ha).

### 2.2 APV-Konfigurationen

Drei APV-Modulkonfigurationen werden verglichen: Konfiguration A — Fest montiert: Bifaziale Glas-Glas-Module (Longi Hi-MO 7, 580 Wp, Transparenz 30 Prozent) auf Stahlständern in 5 m Höhe, Modulreihen in Nord-Süd-Richtung, Reihenabstand 10 m, Modulneigung 20° nach Süden. Bodenbedeckungsgrad (GCR): 35 Prozent. Konfiguration B — Einachsig nachgeführt: Gleiche Module auf Trackern (Nextracker NX Horizon), Drehung Ost-West folgend dem Sonnenstand, Reihenabstand 12 m, GCR 30 Prozent. Der Tracker maximiert den Solarertrag (+15 Prozent gegenüber fest) und ermöglicht eine gleichmäßigere Lichtverteilung auf dem Boden. Konfiguration C — Semi-transparent: Speziell für APV entwickelte Module (Fraunhofer ISE Prototyp) mit streifenförmig angeordneten Solarzellen (Zellbreite 10 mm, Zellenabstand 10 mm, Transparenz 50 Prozent), Modulhöhe 5 m, Reihenabstand 8 m, GCR 45 Prozent. Die höhere Transparenz ermöglicht mehr Licht am Boden bei geringerer Energieerzeugung je Modul.

### 2.3 Kulturpflanzen

Drei Kulturen werden auf jeweils allen Parzellen angebaut (Split-Plot-Design: Hauptfaktor APV-Konfiguration, Unterfaktor Kultur): Winterweizen (Sorte RGT Reform, Referenzertrag 8,5 t/ha) — die wichtigste Ackerbaukultur in Deutschland, Sommerkartoffeln (Sorte Belana, Referenzertrag 42 t/ha) — eine schattenempfindlichere Hackfrucht als Kontrastkultur und Grünland (Dauergrünland-Mischung, 4 Schnitte/Jahr, Referenzertrag 10 t TM/ha) — für Futterbau und extensive Grünlandbewirtschaftung. Die Fruchtfolge wird über 3 Jahre auf jeder Parzelle rotiert, sodass nach 3 Jahren jede Kultur auf jeder APV-Konfiguration und auf der Referenzparzelle angebaut wurde (vollständiges lateinisches Quadrat).

## 3. Messungen und Datenerhebung

### 3.1 Mikroklimatologie

An jeder Parzelle wird eine automatische Wetterstation (Campbell Scientific CR1000X Datenlogger, 1-Minuten-Messintervall) installiert, die folgende Parameter erfasst: Photosynthetisch aktive Strahlung (PAR, 400–700 nm) am Boden — mit 5 Quantensensoren (Apogee SQ-520) in einem Transekt senkrecht zu den Modulreihen (Messung der räumlichen Lichtverteilung: direkt unter dem Modul, am Modulrand, in der Mitte zwischen den Reihen), Globalstrahlung über den Modulen (Pyranometer Kipp & Zonen CMP3), Bodentemperatur in 5 und 20 cm Tiefe (PT1000-Fühler), Bodenfeuchte (FDR-Sonden Decagon EC-5, 10, 30, 60 cm Tiefe), Lufttemperatur und -feuchte in 1,5 m Höhe (Vaisala HMP155), Windgeschwindigkeit und -richtung in 2 m Höhe (Young 05103) und Niederschlag (Kippwaage, Eigenschaftliche, PLUVIO² OTT). Die Mikroklimadaten ermöglichen die Quantifizierung des Verschattungseffekts und die Modellierung der Pflanzenverfügbarkeit von Licht, Wasser und Temperatur unter den Modulen.

### 3.2 Pflanzenertrags- und Qualitätsmessung

Der Ertrag wird bei Winterweizen mit einem Parzellenmähdrescher (Wintersteiger Classic) auf 10 m² Kernbeerntungsflächen (je Parzelle und Kultur 6 Wiederholungen) geerntet und gewogen (Kornertrag bei 14 Prozent Feuchte, Protein-% per NIR-Spektroskopie). Bei Kartoffeln werden 10 Pflanzen je Parzelle einzeln geerntet (Knollenzahl, Sortierung nach Größe, Stärkegehalt per Unterwassergewicht). Das Grünland wird 4-mal pro Jahr geschnitten (Balkenmäher) und die Trockenmasse (Trocknung bei 105°C, 24h) und Futterqualität (Rohprotein, Rohfaser per NIRS) bestimmt.

### 3.3 Verschattungssimulation

Parallel zu den Feldmessungen wird eine Verschattungssimulation mit PVsyst 7.4 (Modul: 3D-Shading Scene) durchgeführt, die den zeitlichen und räumlichen Verlauf der Verschattung am Boden für alle drei APV-Konfigurationen berechnet. Die Simulation wird mit den PAR-Bodenmessungen kalibriert und validiert. Die kalibrierte Simulation ermöglicht die Extrapolation auf andere Standorte (verschiedene Breitengrade, Klimaregionen) ohne erneuten Feldversuch.

## 4. Ökonomische Gesamtbilanz

### 4.1 Dual-Use-Ertrag

Die ökonomische Bewertung berücksichtigt beide Einkommensquellen: Stromerzeugung: Die APV-Anlage (Konfiguration A, 1 ha, installierte Leistung ca. 350 kWp) erzeugt geschätzt 330 MWh/a (spezifischer Ertrag 943 kWh/kWp). Bei einer Einspeisevergütung von 7,0 Ct/kWh (Innovationsausschreibung APV 2026): Stromerlös 23.100 Euro/ha/a. Landwirtschaft: Winterweizen (geschätzt 80 Prozent des Referenzertrags = 6,8 t/ha, Weizenpreis 250 Euro/t): Erlös 1.700 Euro/ha/a (netto nach Betriebskosten). Gesamterlös APV: 23.100 + 1.700 = 24.800 Euro/ha/a. Referenz ohne APV: 2.125 Euro/ha/a (Weizen 8,5 t × 250 Euro/t). Die Flächenproduktivität (Land Equivalent Ratio, LER) beträgt: LER = Ertrag_Strom/Referenz_Strom + Ertrag_Landwirtschaft/Referenz_Landwirtschaft = 1,0 + 0,80 = 1,80. Eine LER von 1,80 bedeutet, dass die APV-Fläche 80 Prozent mehr Gesamtoutput erbringt als die getrennte Nutzung auf zwei separaten Flächen (100 Prozent PV + 100 Prozent Acker).

### 4.2 Investitionskosten

Die Investitionskosten der APV-Anlage betragen ca. 1.200 Euro/kWp (erhöht gegenüber Standard-PV-Freifläche mit 700 Euro/kWp wegen der aufwändigen 5-m-Aufständerung). Für 350 kWp/ha: 420.000 Euro/ha. Amortisation (ohne Förderung): 420.000 / 23.100 = 18 Jahre. Mit EEG-Innovationsausschreibung und KfW-Förderung (Zuschuss 20 Prozent): 14 Jahre.

## 5. Gesellschaftliche Akzeptanz

### 5.1 Landwirte-Befragung

Eine schriftliche Befragung von 200 Landwirten im Kreis Musterland (Fragebogen: 35 Items, 5-stufige Likert-Skala, offene Fragen) erhebt die Akzeptanz und Zahlungsbereitschaft für APV-Systeme. Die Stichprobe umfasst 100 Ackerbaubetriebe und 100 Grünlandbetriebe (stratifiziert nach Betriebsgröße: < 50 ha, 50–200 ha, > 200 ha). Hypothesen: (H1) Landwirte mit Erfahrung in PV-Dachanlagen haben eine höhere APV-Akzeptanz, (H2) die Akzeptanz steigt mit der Dürre-Erfahrung der letzten 5 Jahre (Klimawandel als Treiber), (H3) die Hauptbedenken betreffen die eingeschränkte Bearbeitbarkeit und den Landschaftseindruck. Die Befragung wird im Winter 2026/27 durchgeführt (außerhalb der Feldsaison), die statistische Auswertung mit R (Strukturgleichungsmodell, lavaan-Paket).

## 6. Arbeitspakete und Zeitplan (36 Monate)

AP 1 (Monat 1–6): Anlagenbau (Fundamente, Aufständerung, Modulinstallation, Messtechnik). AP 2 (Monat 4–36): Pflanzenbau und Ertragserhebung (3 Anbaujahre, jeweils Aussaat–Ernte). AP 3 (Monat 4–36): Mikroklimatologie (kontinuierliche Messung über 3 Jahre). AP 4 (Monat 12–30): Verschattungssimulation und Modellkalibrierung. AP 5 (Monat 18–30): Ökonomische Gesamtbilanz und LCA. AP 6 (Monat 12–24): Landwirte-Befragung und Akzeptanzforschung. AP 7 (Monat 30–36): Synthese, Handlungsempfehlungen, Publikation. Personal: 1 Postdoc Pflanzenbau, 1 Doktorand/in Agrarökonomie, 1 Techniker/in Versuchsfeld, studentische Hilfskräfte. Gesamtkosten: 1.050.000 Euro (inkl. APV-Anlage).

Musterstadt, den 28.01.2026

_Prof. Dr. agr. Martin Feldmann, Universität Musterstadt_`,
};
