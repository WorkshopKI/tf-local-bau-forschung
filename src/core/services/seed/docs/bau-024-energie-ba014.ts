import type { Document } from '@/plugins/dokumente/store';

export const doc: Document = {
  id: 'seed-doc-024',
  filename: 'Energienachweis_BA014.md',
  format: 'md',
  tags: ['Energie', 'EFH', 'PV'],
  created: '2026-02-12T10:00:00Z',
  vorgangId: 'BA-2026-014',
  markdown: `---
titel: Energetischer Nachweis EFH mit Einliegerwohnung Feldweg 4
aktenzeichen: BA-2026-014
datum: 2026-02-12
ersteller: Energieberatung Grünwald GmbH
---

# Energetischer Nachweis — EFH mit Einliegerwohnung, Feldweg 4

## 1. Gebäudebeschreibung und Zonierung

Das Einfamilienhaus mit Einliegerwohnung am Feldweg 4 wird als Zweifamilienhaus nach GEG behandelt. Die energetische Bilanzierung erfolgt getrennt für die beiden Nutzungseinheiten, da sie über getrennte Wärmezähler verfügen und die Nebenkosten separat abgerechnet werden. Die Hauptwohnung (Erdgeschoss und Obergeschoss) hat eine Nutzfläche von AN,1 = 175 m² (Wohnfläche 135 m²), die Einliegerwohnung (Kellergeschoss, teilweise ebenerdig aufgrund der Hanglage) hat eine Nutzfläche von AN,2 = 72 m² (Wohnfläche 55 m²). Das Gesamtgebäude hat ein beheiztes Volumen Ve = 750 m³.

Die Konstruktion ist ein Massivbau in KS-Mauerwerk mit WDVS. Das Satteldach (Neigung 35°) ist nach Süden ausgerichtet und bietet eine optimale Fläche für die Photovoltaikanlage. Die Hanglage ermöglicht eine ebenerdige Erschließung der Einliegerwohnung über die Gartenseite (Süden), während der Haupteingang der Hauptwohnung straßenseitig (Norden) auf Erdgeschoss-Niveau liegt. Die Wohnungstrennung erfolgt über eine Stahlbetondecke d = 20 cm mit Trittschalldämmung — die Decke ist gleichzeitig die thermische Trennung zwischen den Zonen, obwohl beide Zonen beheizt sind (interne Trennfläche, kein Wärmeverlust an die Außenluft).

## 2. Wärmeschutz der Gebäudehülle

### 2.1 Bauteil-U-Werte

Die Gebäudehülle wurde auf KfW-55-Niveau geplant. Die U-Werte der einzelnen Bauteile betragen:

Außenwand (KS 17,5 cm + WDVS 200 mm Mineralwolle WLG 032): **U = 0,15 W/(m²K)** — dieser Wert unterschreitet den GEG-Referenzwert von 0,28 W/(m²K) um 46 Prozent und ist einer der niedrigsten U-Werte, die mit einem WDVS-System wirtschaftlich sinnvoll erreichbar sind. Eine weitere Erhöhung der Dämmstärke (z.B. auf 240 mm) würde den U-Wert nur noch um 0,02 W/(m²K) verbessern, bei überproportional steigenden Kosten (abnehmender Grenznutzen der Dämmung).

Dach (Zwischen- und Untersparrendämmung 220 + 60 mm Mineralwolle WLG 035): **U = 0,13 W/(m²K)**. Bodenplatte (XPS 140 mm unter Bodenplatte + 40 mm Perimeterdämmung): **U = 0,20 W/(m²K)**. Kelleraußenwand erdberührt (Perimeterdämmung XPS 120 mm): **U = 0,24 W/(m²K)** (effektiv mit Erdreichwiderstand: Ueff = 0,18 W/(m²K)). Fenster (Dreifachverglasung, Kunststoff-Alu): **Uw = 0,90 W/(m²K)** (g-Wert = 0,50). Haustür: UD = 1,10 W/(m²K).

### 2.2 Wärmebrücken

Die Wärmebrücken werden nach dem detaillierten Verfahren nach DIN 4108 Beiblatt 2 berechnet (nicht pauschal mit ΔUWB = 0,10 W/(m²K), sondern individuell). Die maßgebenden Wärmebrücken sind: Fensteranschluss mit WDVS-Laibungsdämmung 40 mm: ψ = 0,020 W/(mK). Bodenplattenanschluss mit Perimeterdämmung: ψ = 0,035 W/(mK). Dach-Wand-Anschluss: ψ = 0,015 W/(mK). Balkonplattenanschluss mit thermischer Trennung (Schöck Isokorb KXT, λeq = 0,12 W/(mK)): ψ = 0,050 W/(mK). Rollladenkasten (Aufsatzrolllade, gedämmt): ψ = 0,060 W/(mK). Gesamter Wärmebrückenzuschlag: ΔUWB = Σ(ψi × li) / AHüll = 18,5 / 420 = 0,044 W/(m²K) — deutlich unter dem Pauschalwert von 0,10 W/(m²K) und auch unter dem Grenzwert 0,05 W/(m²K) für den reduzierten Wärmebrückenansatz nach DIN 4108 Beiblatt 2.

## 3. Anlagentechnik

### 3.1 Luft-Wasser-Wärmepumpe Split

Die Wärmeversorgung erfolgt über eine Luft-Wasser-Wärmepumpe im Split-System. Die Außeneinheit (Verdampfer und Kompressor) steht auf einem schallgedämmten Fundament an der Nordseite des Gebäudes (Abstand zur Grundstücksgrenze 4 m). Zwei Inneneinheiten (Verflüssiger-Hydraulikmodule) versorgen die Hauptwohnung und die Einliegerwohnung getrennt mit Heizwärme und Warmwasser. Die Nennheizleistung der Außeneinheit beträgt 12 kW bei A2/W35 (COP 4,3). Die Aufteilung auf die Inneneinheiten erfolgt über ein hydraulisches Weichenmodul mit Pufferspeicher 500 Liter (Hauptwohnung) und 200 Liter (Einliegerwohnung). Die JAZ wird getrennt berechnet: Hauptwohnung JAZ = 4,0 (größere Heizfläche, niedrigere Vorlauftemperatur 32°C), Einliegerwohnung JAZ = 3,6 (kleinere Heizfläche, höhere Vorlauftemperatur 38°C wegen der Fußbodenheizung im Bad mit erhöhter Raumtemperatur).

### 3.2 Photovoltaikanlage mit Batteriespeicher

Auf dem Süddach wird eine PV-Anlage mit 24 Modulen (je 410 Wp, monokristallin, schwarze Rahmen) installiert. Gesamtleistung: **9,84 kWp**. Simulierter Jahresertrag (PVsyst): 9.450 kWh/a (spezifischer Ertrag 960 kWh/kWp). Der Batteriespeicher (BYD HVS 10.2, nutzbare Kapazität 10,24 kWh, Entladetiefe 96 Prozent) ermöglicht die Zwischenspeicherung des Tagesstrom-Überschusses. Die Eigenverbrauchsquote (Simulation mit Polysun): 62 Prozent. Der Autarkiegrad (Anteil des Eigenverbrauchs am Gesamtverbrauch): 47 Prozent.

Die Wallbox in der Garage (11 kW, Typ 2) ist an das Energiemanagement-System angebunden und lädt das E-Fahrzeug bevorzugt mit PV-Überschuss. Bei einer jährlichen Fahrleistung von 15.000 km und einem Verbrauch von 18 kWh/100 km beträgt der Ladebedarf 2.700 kWh/a, wovon 1.620 kWh (60 Prozent) aus PV-Strom gedeckt werden können. Die Wallbox-Leistung von 11 kW übersteigt die maximale PV-Leistung selten — an sonnigen Sommertagen werden typisch 6–8 kW eingespeist, der Rest kommt aus dem Netz (PV-geführtes Laden mit Netzzuschuss).

### 3.3 Wärmemengenzähler für Nebenkostenabrechnung

Die Wärmeversorgung beider Wohneinheiten erfolgt über eine gemeinsame Wärmepumpe, die Kosten werden jedoch getrennt abgerechnet. Zwei geeichte Wärmemengenzähler (Kamstrup Multical 303, Genauigkeitsklasse 2 nach EN 1434) erfassen den Wärmeverbrauch jeder Einheit. Die Hilfsenergie (Strom für die Wärmepumpe) wird über einen separaten Stromzähler erfasst und anteilig nach dem Wärmeverbrauch umgelegt. Der PV-Eigenverbrauch wird über ein Smart-Meter-Gateway erfasst und kann künftig für die mieterstrom-konforme Abrechnung nach dem Mieterstromgesetz genutzt werden, sofern die Einliegerwohnung als eigenständige Mieteinheit betrieben wird.

## 4. Energiebilanz

### 4.1 Hauptwohnung (Zone 1)

Heizwärmebedarf: qH,1 = 22 kWh/(m²a) (AN,1 = 175 m²). Warmwasserwärmebedarf: qW,1 = 12,5 kWh/(m²a). Endenergiebedarf Strom: qEnd,1 = (22 + 12,5) / 4,0 + 3,5 (Hilfsenergie) = 8,6 + 3,5 = 12,1 kWh/(m²a). PV-Gutschrift (Eigenverbrauch anteilig 65 Prozent der Hauptwohnung): -4,8 kWh/(m²a). Primärenergiebedarf: qP,1 = (12,1 - 4,8) × 1,8 = **13,1 kWh/(m²a)**. GEG-Referenz: 49 kWh/(m²a). Verhältnis: 27 Prozent — **deutlich unter KfW-55 (55 Prozent)**.

### 4.2 Einliegerwohnung (Zone 2)

Heizwärmebedarf: qH,2 = 28 kWh/(m²a) (AN,2 = 72 m², etwas höher wegen mehr Außenwandfläche im Verhältnis zur Nutzfläche und erdberührter Wände). Warmwasserwärmebedarf: qW,2 = 12,5 kWh/(m²a). Endenergiebedarf Strom: qEnd,2 = (28 + 12,5) / 3,6 + 4,0 = 11,3 + 4,0 = 15,3 kWh/(m²a). PV-Gutschrift: -3,2 kWh/(m²a). Primärenergiebedarf: qP,2 = (15,3 - 3,2) × 1,8 = **21,8 kWh/(m²a)**. GEG-Referenz: 62 kWh/(m²a) (höherer Referenzwert wegen ungünstigerem A/V-Verhältnis). Verhältnis: 35 Prozent — **unter KfW-55**.

### 4.3 Gesamtgebäude

Gewichteter Primärenergiebedarf (flächengewichtet): qP,ges = (13,1 × 175 + 21,8 × 72) / (175 + 72) = (2.293 + 1.570) / 247 = **15,6 kWh/(m²a)**. Transmissionswärmeverlust: H'T = 0,24 W/(m²K). KfW-55-Grenzwerte: qP ≤ 55% × qP,ref = 0,55 × 53 = 29,2 kWh/(m²a) ✓ und H'T ≤ 70% × H'T,ref = 0,70 × 0,40 = 0,28 W/(m²K) ✓. Beide Grenzwerte werden eingehalten. Die KfW-Förderung (Kredit 261) kann beantragt werden.

## 5. Sommerlicher Wärmeschutz und Lüftungskonzept

Der sommerliche Wärmeschutz wird nach DIN 4108-2 für den kritischsten Raum (Wohnzimmer Süd, Hauptwohnung, Fensterfläche 6,5 m², Grundfläche 32 m²) nachgewiesen. Sonnenschutz: außenliegende Raffstores mit Lichtlenkfunktion (FC = 0,25). Sonneneintragskennwert S = 0,024 < Szul = 0,036 — Nachweis erfüllt. Die PV-Module auf dem Süddach verschatten die Dachfenster im Obergeschoss teilweise und tragen zusätzlich zur Reduktion des solaren Wärmeeintrags bei.

Das Lüftungskonzept nach DIN 1946-6 sieht für die Hauptwohnung eine zentrale Lüftungsanlage mit WRG (Wärmerückgewinnung 80 Prozent) vor. Die Einliegerwohnung erhält ein dezentrales Lüftungsgerät (Paar-weise angeordnete Einzelraumlüfter mit Pendellüftung, WRG 73 Prozent). Der Blower-Door-Test (Zielwert n50 ≤ 1,0 h⁻¹) wird nach Fertigstellung durchgeführt und ist Voraussetzung für die KfW-Förderung. Die Ergebnisse des Energienachweises werden im Energieausweis dokumentiert: Energieeffizienzklasse A+ für beide Wohneinheiten.

## Zusammenfassung in einfacher Sprache

Dieses Gutachten zeigt, wie energieeffizient das geplante Einfamilienhaus mit Einliegerwohnung am Feldweg 4 sein wird. Das Haus bekommt eine sehr gute Waermedaemmung, eine Luft-Wasser-Waermepumpe zum Heizen und eine grosse Solaranlage auf dem Dach mit Batteriespeicher. Dadurch verbraucht das Haus so wenig Energie, dass es den sogenannten KfW-55-Standard deutlich unterschreitet und eine Foerderung beantragt werden kann. Ausserdem gibt es eine Wallbox fuer ein Elektroauto, die bevorzugt mit Solarstrom laedt. Das Haus erreicht die beste Energieeffizienzklasse A+.

Musterstadt, den 12.02.2026

_Dipl.-Ing. (FH) Karl Grünwald, Energieberater (dena)_`,
};
